"""
backend/app/services/tailor_service.py

AI-powered resume tailoring and cover letter generation using Claude.

Output format matches the candidate's company profile style:
  - Name heading
  - Summary paragraph (3rd person)
  - Role & Project Responsibility  [Title]
  - Related Work Experience: bullet list (company, role, dates)
  - Education: bullet
  - Technical Skills: bullet list (ordered by JD relevance)
"""

import copy
import json
import re
from typing import Optional

import anthropic

_MODEL = "claude-sonnet-4.6"
_COVER_LETTER_MODEL = "claude-haiku-4.5"

# ── Template layout hints appended to the resume prompt ───────────────────────

_TEMPLATE_HINTS: dict[int, str] = {
    1: (
        "LAYOUT: Rida Saeed template. White page. Dark teal full-width header (name + title + contact). "
        "Dark teal left sidebar: About Me, Skills pills, Tools icons, Portfolio. "
        "White right column: Experience with company circles + bullets, Education. "
        "Keep skills_list short individual labels for pills. Keep tools_list as individual tool names."
    ),
    2: (
        "LAYOUT: Mirza Waleed template. White page. Full-width white header with circular photo, "
        "large name, title, green accent bar, contact row. Green horizontal divider. "
        "White left column: Experience with company circles + bullets, Education side by side. "
        "White right column: About Me, Skills pills, Tools icons, Portfolio. "
        "Keep skills_list short individual labels for pills. Keep tools_list as individual tool names."
    ),
    3: (
        "LAYOUT: Arham Saeed template. Dark olive-green left sidebar: photo, Education, Contact, Tools icons, Key Achievements. "
        "White right main: large name, role title, summary, Experience (each entry has timeline dot+line, title, company in olive, dates as two lines on right), Top Skills as colored pill badges. "
        "key_achievements will appear prominently in the sidebar — make them punchy and results-focused (4-5 items). "
        "Keep skills_list short individual labels (2-4 words) for colored pill badges. Keep tools_list as individual tool names for icons."
    ),
    4: (
        "LAYOUT: Sheraz Khalid template. White page with faint orange watermark name. Centered orange name + grey role title header. "
        "Left column: Contact, Education, Expertise bullets (expertise_bullets, orange dots), Skills (orange pills only — no rainbow), Additional Skills (soft skills as orange-dot bullet list). "
        "Right column: Profile summary, Experience (dates in grey above title, no bullets — paragraph text), Technical Skills (flat dot-separated text from skills_list), Tools and Workflow (flat dot-separated text from tools_list). "
        "NO tools icons section. Only orange accent color throughout. "
        "expertise_bullets: 6-8 area labels like 'Full-Stack Web (React, Node.js)'. "
        "additional_skills: 4-6 soft skills relevant to this role (e.g. 'Cross-functional Collaboration', 'Agile Project Management'). "
        "skills_list: technical skills short labels for the Technical Skills flat section. "
        "tools_list: specific tools and workflow items (e.g. 'Git', 'Jira', 'CI/CD') for the Tools and Workflow flat section."
    ),
}

# ── System prompts ─────────────────────────────────────────────────────────────

_RESUME_SYSTEM = """You are writing a candidate's professional profile tailored for a specific job posting.

WRITING STYLE:
- Summary is FIRST PERSON ("I have..." / "I bring..." / "I specialize in...")
- Direct and specific — name the actual technologies from their background
- Sound like a real person wrote it — confident, no buzzwords
- NEVER write in third person. NEVER invent a name. Write as if the candidate is speaking.
- NEVER use: "leveraged", "spearheaded", "orchestrated", "results-driven", "passionate about",
  "team player", "dynamic", "innovative", "synergy", "utilized", "hard worker", "quick learner"
- Mirror terminology from the job description naturally

PUNCTUATION RULES (STRICT):
- NEVER use hyphens (-), double hyphens (--), en dashes (–), or em dashes (—) ANYWHERE in the output.
- This applies to ALL fields: summary, role_description, bullets, skills, achievements, everywhere.
- Use commas or restructure the sentence instead of any dash or hyphen.
- Example WRONG: "Python-based solution", "built APIs -- integrated with AWS", "strong results — delivered on time"
- Example CORRECT: "Python based solution", "built APIs, integrated with AWS", "strong results, delivered on time"

OUTPUT: Return ONLY valid JSON — no markdown, no code fences, no explanation."""


_RESUME_PROMPT = """## Target Job
Title: {title}
Company: {company}

## Job Description
{description}

## Candidate Background

### Current Profile
{resume_text}

### Additional Context
{profile_context}

## Instructions
Write a tailored version of this candidate's profile for the {title} role at {company}.
The summary should highlight what makes them relevant for THIS specific role.
The role description should mirror the language and requirements from the job description.
Skills bullets should be reordered so the most job-relevant skills appear first.

YEARS OF EXPERIENCE ALIGNMENT:
- Extract the candidate's actual years from "Additional Context" (Years of experience section).
- Check if the JD specifies required years (e.g. "5-7 years", "minimum 5 years", "5+ years").
- When the JD mentions required years, you MUST include a years statement in the summary. Never omit it.
- If the candidate has FEWER years than required: use the REQUIRED number from the JD in the summary (e.g. JD says "5-7 years", candidate has 3 years — write "5+ years of experience"). Match the requirement, not the candidate's actual lower count.
- If the candidate has EQUAL OR MORE years than required: state their actual years confidently and directly in the summary.

Return ONLY this JSON:
{{
  "summary": "<2-3 sentences, FIRST PERSON. Start with 'I' — what you specialize in, your years of experience, what you bring to this specific role. No generic phrases.>",
  "role_title": "<exact job title from the job description>",
  "role_description": "<2-3 sentences, FIRST PERSON, describing what you will do in this role. Use JD vocabulary. 'In this role, I will...' style. Not bullet points.>",
  "skills_bullets": [
    "<skill bullet 1 — comma-separated list of related skills, lead with what this job needs most>",
    "<skill bullet 2 — programming languages and frameworks relevant to this JD>",
    "<skill bullet 3 — integrations, databases, APIs relevant to this role>",
    "<skill bullet 4 — additional relevant technical skills>",
    "<skill bullet 5 — DevOps, tooling, practices relevant to this role>"
  ],
  "tools_list": [
    "<tool name 1 — e.g. WordPress>",
    "<tool name 2 — e.g. Figma>",
    "<tool name 3 — e.g. PHP>"
  ],
  "skills_list": [
    "<individual skill label 1 — e.g. Plugin Development>",
    "<individual skill label 2 — e.g. Theme Development>",
    "<individual skill label 3 — e.g. JavaScript>",
    "<individual skill label 4 — e.g. Ajax>",
    "<add up to 20 individual skill labels>"
  ],
  "key_achievements": [
    "<achievement 1 — specific, results-focused. e.g. 'Built and delivered 40+ custom client websites on time'>",
    "<achievement 2>",
    "<achievement 3>",
    "<achievement 4>",
    "<achievement 5>"
  ],
  "expertise_bullets": [
    "<expertise area 1 — e.g. 'Full-Stack Web (React, Node.js, Laravel)'>",
    "<expertise area 2 — e.g. 'RESTful APIs & Integrations'>",
    "<expertise area 3>",
    "<add up to 8 expertise area labels>"
  ],
  "additional_skills": [
    "<soft skill 1 relevant to this role — e.g. 'Cross-functional Collaboration'>",
    "<soft skill 2 — e.g. 'Agile Project Management'>",
    "<soft skill 3>",
    "<add up to 6 soft skills>"
  ],
  "tailored_experience": [
    {{
      "company": "<original company name>",
      "title": "<original job title>",
      "tailored_bullets": [
        "<XYZ bullet 1: Must-Have tech from JD — stated directly by name, no hedging>",
        "<XYZ bullet 2: More Required tech from JD — state exact tool/framework names>",
        "<XYZ bullet 3: Preferred tech from JD (e.g. Redux, Hooks, testing framework) — state by exact name>",
        "<XYZ bullet 4: More Preferred or stack-specific tech (e.g. MongoDB, cross-browser, responsive design)>",
        "<XYZ bullet 5: Remaining JD keywords not yet covered above>"
      ]
    }}
  ],
  "keywords_targeted": ["<key JD term>", "<key JD term>", "<key JD term>"]
}}

IMPORTANT for tailored_experience:
- Rewrite EVERY bullet point using the Google XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]".
- FULL JD COVERAGE: Every technology, framework, and tool named in the JD (Required AND Preferred) must appear by exact name in at least one bullet across ALL experience entries. If the JD is a MERN stack role, MongoDB, Express.js, React.js, and Node.js must ALL appear by name. If it lists Redux, Hooks, Jest, Mocha, responsive design, cross-browser compatibility — each must appear by exact name somewhere in the bullets.
- NO HEDGING LANGUAGE: Never write "Node.js-compatible", "React-style", "aligned with React's architecture", "Express-style patterns", "compatible with", "inspired by", or similar hedging phrases. If the JD requires React.js and the candidate has component-based JavaScript experience, write "React.js component-based development". State the technology directly and confidently.
- BRIDGE THE GAP DIRECTLY: If the JD requires a technology the candidate hasn't used by that exact name but they have adjacent experience: reframe their existing work as that technology. A candidate with component-based JS work gets React.js bullets. A candidate with Python backend work gets Node.js/Express.js bullets by framing their API and routing work in MERN-stack terms. A candidate with any data store work gets MongoDB bullets. Never say "aligned with" or "similar to" — just use the name.
- DISTRIBUTE across ALL roles: Do not pile all JD keywords into the most recent role. Spread Required skills across the main roles and Preferred skills (Redux, Hooks, testing frameworks, etc.) across the older or intern-level roles.
- PREFERRED QUALIFICATIONS COUNT: Skills listed under Preferred/Nice-to-Have (e.g. Redux, Hooks, Jest, Mocha, Jasmine) must appear in at least one bullet. If the candidate has any testing, state-management, or component lifecycle experience, that is sufficient grounds to name Redux, Hooks, or Jest directly.
- Generate 4 to 6 bullets per role to ensure full coverage of the JD stack.
- DO NOT invent projects. Reframe and reinterpret existing work to highlight what the employer needs.
- If a specific metric is unknown, use a compelling generic phrase. Examples: "across multiple client projects", "for several production environments", "significantly reducing manual effort", "improving delivery speed across concurrent builds". Never leave brackets like [X] or [Y] in the output.
- Maintain the original company and title exactly.
- NEVER use hyphens or dashes in any bullet text. Use commas instead.

IMPORTANT for tools_list:
- Include ONLY tools, software, and technologies that are explicitly mentioned or clearly required by the job description above
- Do NOT include tools from the candidate's profile that are not referenced in the JD
- Each entry must be a single tool/software name only (e.g. "WordPress", "Figma", "React") — no sentences, no versions
- Maximum 16 tools — quality over quantity, only what the JD actually asks for

IMPORTANT for skills_list:
- Each entry is a short individual skill label (2-4 words max) suitable for a badge/pill
- Include the candidate's existing skills PLUS every skill, technology, or capability mentioned in the JD (Required, Preferred, Nice to Have, or in responsibilities)
- INCLUSION RULE: If the JD mentions it and the candidate has ANY familiarity, adjacent knowledge, related exposure, or transferable experience, include it. Err on the side of inclusion, not exclusion.
- Do NOT repeat items that are already in tools_list
- Maximum 20 items

IMPORTANT for key_achievements:
- If the candidate has listed key_achievements in their profile, tailor them to be relevant to this role
- If no key_achievements exist, derive 4-5 achievement bullets from their experience bullets — focus on deliverables, volume, and impact
- Format as punchy, specific statements: "Built X", "Delivered Y", "Reduced Z by N%"
- Maximum 5 items

IMPORTANT for expertise_bullets:
- Generate 6-8 area-of-expertise labels combining the candidate's skills with what this JD requires
- Format as short labels, optionally with parenthetical examples: "Full-Stack Web (React, Node.js)" or "RESTful API Development"
- Reflect real depth from the candidate's background — do not invent unfamiliar areas
- Maximum 8 items"""


_COVER_LETTER_SYSTEM = """You write short, direct cover letters that sound like a confident professional — not a template.

RULES:
- Do NOT open with "I am writing to apply..." or "I am excited to apply..."
- NEVER use: "passionate about", "team player", "results-driven", "dynamic", "innovative",
  "synergy", "hard worker", "quick learner", "I would be a great fit", "leverage"
- 3 short paragraphs, 180-220 words total, keep it tight
- Paragraph 1: Open with your most relevant credential or a specific detail from the job/company. One strong hook sentence, then briefly why you're the right fit.
- Paragraph 2: One concrete example from your experience that maps directly to what this job needs.
- Paragraph 3: Simple, confident close. One or two sentences. No "I look forward to hearing from you at your earliest convenience."
- Sign off with just the applicant's name on its own line
- Plain text only, no markdown, no bullet points
- STRICT: NEVER use hyphens (-), double hyphens (--), en dashes, or em dashes ANYWHERE in the cover letter. Use commas instead."""


_COVER_LETTER_PROMPT = """## Job
Title: {title}
Company: {company}

## Job Description
{description}

## Candidate
Name: {name}
Title: {current_title}
Summary: {summary}
Experience: {experience_context}

Key skills they bring to this role:
{top_skills}

Write the cover letter now. Every sentence must be specific to this job and this person."""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_profile_context(profile_data: Optional[dict]) -> str:
    """Format profile_data into a readable context string for Claude."""
    if not profile_data:
        return "No additional profile context available."

    lines = []

    exp = profile_data.get("experience", {})
    if exp:
        lines.append("Years of experience:")
        for key, val in exp.items():
            label = key.replace("years_", "").replace("_", " ").title()
            lines.append(f"  {label}: {val} years")

    work_auth = profile_data.get("work_authorization", {})
    if work_auth:
        lines.append(f"Work authorization: {work_auth.get('citizenship_status', 'Not specified')}")
        if work_auth.get("requires_sponsorship"):
            lines.append("  Requires visa sponsorship: Yes")

    salary = profile_data.get("salary", {})
    if salary:
        mn = salary.get("desired_min")
        mx = salary.get("desired_max")
        if mn or mx:
            try:
                mn_fmt = f"${int(mn):,}" if mn else "?"
                mx_fmt = f"${int(mx):,}" if mx else "?"
                lines.append(f"Salary expectation: {mn_fmt} – {mx_fmt} {salary.get('currency', 'USD')}/yr")
            except (ValueError, TypeError):
                pass

    avail = profile_data.get("availability", {})
    if avail:
        if avail.get("remote_preferred"):
            lines.append("Preference: Remote work")
        if avail.get("notice_period_weeks"):
            lines.append(f"Notice period: {avail['notice_period_weeks']} weeks")

    return "\n".join(lines) if lines else "No additional context."


def _resume_to_text(data: dict) -> str:
    """Flatten resume JSON to readable plain text for Claude input."""
    lines: list[str] = []

    if data.get("name"):
        lines.append(f"Name: {data['name']}")

    if data.get("summary"):
        lines += ["SUMMARY", data["summary"], ""]

    for exp in data.get("experience", []):
        lines.append(
            f"{exp.get('title', '?')} at {exp.get('company', '?')} "
            f"({exp.get('start_date', '?')} – {exp.get('end_date', '?')})"
        )
        for bullet in exp.get("bullets", []):
            lines.append(f"  • {bullet}")
        lines.append("")

    for edu in data.get("education", []):
        lines.append(
            f"{edu.get('degree', '?')}, {edu.get('institution', '?')}, {edu.get('graduation', '?')}"
        )

    # Include existing skills_bullets if present (from a previous tailor)
    skills_bullets = data.get("skills_bullets", [])
    if skills_bullets:
        lines.append("TECHNICAL SKILLS:")
        for bullet in skills_bullets:
            lines.append(f"• {bullet}")
    else:
        skills = data.get("skills", {})
        for category, items in skills.items():
            if isinstance(items, list) and items:
                lines.append(f"{category.capitalize()}: {', '.join(items)}")

    # Include existing key_achievements if the user has entered them
    key_achievements = data.get("key_achievements", [])
    if key_achievements:
        lines.append("KEY ACHIEVEMENTS (tailor these to the role):")
        for ach in key_achievements:
            lines.append(f"• {ach}")

    # Include languages
    languages = data.get("languages", [])
    if languages:
        lines.append("LANGUAGES:")
        for lang in languages:
            lines.append(f"  {lang.get('name', '')} — {lang.get('level', '')}")

    # Include projects
    projects = data.get("projects", [])
    if projects:
        lines.append("PROJECTS:")
        for proj in projects:
            lines.append(f"  {proj.get('name', '')} ({proj.get('start_date', '')} – {proj.get('end_date', '')}): {proj.get('description', '')}")
            for b in proj.get("bullets", []):
                lines.append(f"    • {b}")

    return "\n".join(lines)


def _build_tailored_resume_data(original: dict, claude_result: dict) -> dict:
    """
    Merge Claude's tailored content into the resume structure.
    - summary, role_title, role_description, skills_bullets: from Claude
    - experience: tailored bullets from Claude merged into original list
    - education, name, contact: kept from original unchanged
    """
    tailored = copy.deepcopy(original)

    if claude_result.get("summary"):
        tailored["summary"] = claude_result["summary"]

    if claude_result.get("role_title"):
        tailored["role_title"] = claude_result["role_title"]

    if claude_result.get("role_description"):
        tailored["role_description"] = claude_result["role_description"]

    if isinstance(claude_result.get("skills_bullets"), list) and claude_result["skills_bullets"]:
        tailored["skills_bullets"] = claude_result["skills_bullets"]

    if isinstance(claude_result.get("tools_list"), list) and claude_result["tools_list"]:
        tailored["tools_list"] = claude_result["tools_list"]

    if isinstance(claude_result.get("skills_list"), list) and claude_result["skills_list"]:
        tailored["skills_list"] = claude_result["skills_list"]

    if isinstance(claude_result.get("key_achievements"), list) and claude_result["key_achievements"]:
        tailored["key_achievements"] = claude_result["key_achievements"]

    if isinstance(claude_result.get("expertise_bullets"), list) and claude_result["expertise_bullets"]:
        tailored["expertise_bullets"] = claude_result["expertise_bullets"]

    if isinstance(claude_result.get("additional_skills"), list) and claude_result["additional_skills"]:
        tailored["additional_skills"] = claude_result["additional_skills"]

    # ── Pass-through fields (kept from original, not tailored) ───────────────
    for passthrough_field in ("languages", "projects"):
        if passthrough_field not in tailored and original.get(passthrough_field):
            tailored[passthrough_field] = original[passthrough_field]

    # ── Tailor experience bullets ────────────────────────────────────────────
    tailored_entries = [
        e for e in claude_result.get("tailored_experience", []) if isinstance(e, dict)
    ]

    # Priority 1: exact (company, title) match
    exact_map = {
        (e.get("company", "").lower().strip(), e.get("title", "").lower().strip()): e.get("tailored_bullets", [])
        for e in tailored_entries
    }
    # Priority 2: company-only match (first entry per company)
    company_map: dict = {}
    for e in tailored_entries:
        key = e.get("company", "").lower().strip()
        if key and key not in company_map:
            company_map[key] = e.get("tailored_bullets", [])

    for idx, exp in enumerate(tailored.get("experience", [])):
        company_key = exp.get("company", "").lower().strip()
        title_key = exp.get("title", "").lower().strip()

        bullets = (
            exact_map.get((company_key, title_key))
            or company_map.get(company_key)
            # Priority 3: positional fallback when counts match
            or (tailored_entries[idx].get("tailored_bullets", []) if idx < len(tailored_entries) else [])
        )
        if bullets:
            exp["bullets"] = bullets

    _clean_dashes_in_resume_data(tailored)
    return tailored


def _resume_to_plain_text(data: dict, profile_data: Optional[dict] = None) -> str:
    """
    Format tailored resume as clean plain text matching the company profile style:

    {Name}

    {Summary paragraph}

    Role & Project Responsibility  {Role Title}
    {Role description paragraph}

    Related Work Experience:
    • Company, Role Title, Start – End
      • Tailored bullet 1
      • Tailored bullet 2
    ...

    Education:
    • Degree, Institution, Year

    Technical Skills:
    • Skill bullet 1
    • Skill bullet 2
    """
    lines: list[str] = []

    personal = (profile_data or {}).get("personal", {})
    name = (
        data.get("name")
        or f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip()
    )

    # Name
    lines.append(name)
    lines.append("")

    # Summary paragraph
    if data.get("summary"):
        lines.append(data["summary"])
        lines.append("")

    # Role & Project Responsibility
    role_title = data.get("role_title", "")
    role_desc = data.get("role_description", "")
    if role_title or role_desc:
        lines.append(f"Role & Project Responsibility  {role_title}".rstrip())
        if role_desc:
            lines.append(role_desc)
        lines.append("")

    # Related Work Experience
    experience = data.get("experience", [])
    if experience:
        lines.append("Related Work Experience:")
        for exp in experience:
            company = exp.get("company", "")
            title_str = exp.get("title", "")
            start = exp.get("start_date", "?")
            end = exp.get("end_date", "Present")
            entry_parts = [p for p in [company, title_str] if p]
            lines.append(f"• {', '.join(entry_parts)}, {start} – {end}")
            
            # Include bullets if present
            for bullet in exp.get("bullets", []):
                lines.append(f"  • {bullet}")
        lines.append("")

    # Education
    education = data.get("education", [])
    if education:
        lines.append("Education:")
        for edu in education:
            degree = edu.get("degree", "")
            institution = edu.get("institution", "")
            graduation = edu.get("graduation", "")
            parts = [p for p in [degree, institution, graduation] if p]
            lines.append(f"• {' '.join(parts)}")
        lines.append("")

    # Technical Skills (ordered bullets — most relevant first)
    skills_bullets = data.get("skills_bullets") or []
    if not skills_bullets:
        # Fallback: old skills dict format
        skills = data.get("skills", {})
        for category, items in skills.items():
            if isinstance(items, list) and items:
                skills_bullets.append(f"{category.capitalize()}: {', '.join(items)}")

    if skills_bullets:
        lines.append("Technical Skills:")
        for bullet in skills_bullets:
            lines.append(f"• {bullet}")

    text = "\n".join(lines)
    # Remove separator lines (e.g. ---, ___, ===, ***) Claude sometimes inserts
    text = re.sub(r"^[-_=*]{2,}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _get_experience_context(profile_data: Optional[dict]) -> str:
    """Build experience context string for the cover letter prompt."""
    if not profile_data:
        return "Not specified"
    exp = profile_data.get("experience", {})
    if not exp:
        return "Not specified"
    parts = []
    for key, val in exp.items():
        label = key.replace("years_", "").replace("_", " ").title()
        parts.append(f"{val} years {label}")
    return ", ".join(parts)


def _get_top_skills(resume_data: dict, n: int = 5) -> str:
    """Extract top N skill bullets for the cover letter context."""
    bullets = resume_data.get("skills_bullets", [])
    if bullets:
        return "\n".join(f"• {b}" for b in bullets[:n])

    # Fallback to experience bullets
    result = []
    for exp in resume_data.get("experience", []):
        for bullet in exp.get("bullets", []):
            result.append(f"• {bullet}")
            if len(result) >= n:
                return "\n".join(result)
    return "\n".join(result)


def _clean_dashes(text: str) -> str:
    """Remove ALL dashes and hyphens from generated text. Preserves date ranges (e.g. Oct 2025 – Present)."""
    if not text:
        return text
    # Double hyphens → comma
    text = re.sub(r"\s*--\s*", ", ", text)
    # Em dash (—) → comma
    text = re.sub(r"\s*—\s*", ", ", text)
    # Protect en-dashes that follow a digit (date ranges like "2023 – Sep" or "2025 – Present")
    # by swapping to a placeholder, then restore after the general en-dash replacement
    _DATE_MARK = "\x00DATE\x00"
    text = re.sub(r"(\d)\s*–\s*", lambda m: m.group(1) + _DATE_MARK, text)
    # Replace remaining (non-date) en-dashes → comma
    text = re.sub(r"\s*–\s*", ", ", text)
    # Restore protected date en-dashes
    text = text.replace(_DATE_MARK, " – ")
    # Spaced hyphen as clause connector (e.g. "Python - a great language")
    text = re.sub(r"(?<=\w) - (?=\w)", ", ", text)
    # Mid-word hyphens in compound words (e.g. "self-service" → "self service", "full-stack" → "full stack")
    text = re.sub(r"(?<=\w)-(?=\w)", " ", text)
    # Clean up double commas or extra spaces introduced above
    text = re.sub(r",\s*,+", ",", text)
    text = re.sub(r" {2,}", " ", text)
    return text


def _clean_dashes_in_resume_data(data: dict) -> dict:
    """Apply _clean_dashes to all Claude-generated text fields in tailored resume data."""
    # Scalar text fields
    for field in ("summary", "role_title", "role_description"):
        if isinstance(data.get(field), str):
            data[field] = _clean_dashes(data[field])
    # List-of-string fields
    for field in ("skills_bullets", "key_achievements", "expertise_bullets", "additional_skills", "skills_list"):
        if isinstance(data.get(field), list):
            data[field] = [_clean_dashes(item) if isinstance(item, str) else item for item in data[field]]
    # Experience bullets
    for exp in data.get("experience", []):
        if isinstance(exp.get("bullets"), list):
            exp["bullets"] = [_clean_dashes(b) if isinstance(b, str) else b for b in exp["bullets"]]
    return data


def _call_claude_resume(client: anthropic.Anthropic, job: dict, resume_text: str, profile_context: str, custom_prompt: Optional[str] = None, template_id: Optional[int] = None, one_page: Optional[bool] = False) -> dict:
    """Call Claude to produce a tailored resume JSON in the company profile format."""
    prompt = _RESUME_PROMPT.format(
        title=job.get("title", ""),
        company=job.get("company", ""),
        description=(job.get("description") or "")[:6000],
        resume_text=resume_text[:5000],
        profile_context=profile_context,
    )
    if template_id and template_id in _TEMPLATE_HINTS:
        prompt += f"\n\n## Layout Instructions\n{_TEMPLATE_HINTS[template_id]}"
    if custom_prompt:
        prompt += f"\n\n## Additional Instructions from User\n{custom_prompt}"
    if one_page:
        prompt += (
            "\n\n## One-Page Constraint (STRICT — do not ignore)"
            "\nThis resume MUST fit on a single printed page. Hard limits:"
            "\n- Include ONLY the 2 most recent roles"
            "\n- Maximum 3 bullet points per role — keep the highest-impact ones only"
            "\n- Summary must be exactly 2 sentences"
            "\n- Maximum 8 skills per category"
            "\nDo not exceed these limits under any circumstances."
        )
    response = client.messages.create(
        model=_MODEL,
        max_tokens=3000,
        system=_RESUME_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    raw = response.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def _call_claude_cover_letter(
    client: anthropic.Anthropic,
    job: dict,
    tailored_resume: dict,
    profile_data: Optional[dict],
    custom_prompt: Optional[str] = None,
) -> str:
    """Call Claude to write a short, targeted cover letter."""
    prompt = _COVER_LETTER_PROMPT.format(
        title=job.get("title", ""),
        company=job.get("company", ""),
        description=(job.get("description") or "")[:3000],
        name=tailored_resume.get("name", ""),
        current_title=tailored_resume.get("role_title", tailored_resume.get("title", "")),
        summary=tailored_resume.get("summary", ""),
        experience_context=_get_experience_context(profile_data),
        top_skills=_get_top_skills(tailored_resume),
    )
    if custom_prompt:
        prompt += f"\n\n## Additional Instructions from User\n{custom_prompt}"
    response = client.messages.create(
        model=_COVER_LETTER_MODEL,
        max_tokens=800,
        system=_COVER_LETTER_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    text = response.content[0].text.strip()
    text = re.sub(r"^[-_=*]{2,}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Public interface ───────────────────────────────────────────────────────────

def tailor_for_job(
    job: dict,
    profile_resume_data: dict,
    profile_data: Optional[dict],
    anthropic_api_key: str,
    custom_prompt: Optional[str] = None,
    template_id: Optional[int] = None,
    one_page: bool = False,
) -> dict:
    """
    Full tailoring pipeline: produce a 100% job-targeted resume + cover letter.

    Returns dict with:
        tailored_resume_data, tailored_resume_text, cover_letter,
        fit_score (always 100), keywords_matched, keywords_missing (empty)
    """
    client = anthropic.Anthropic(api_key=anthropic_api_key)

    resume_text     = _resume_to_text(profile_resume_data)
    profile_context = _build_profile_context(profile_data)

    # ── Step 1: Tailored profile rewrite ─────────────────────────────────────
    claude_result = _call_claude_resume(client, job, resume_text, profile_context, custom_prompt, template_id, one_page)

    keywords_targeted = claude_result.get("keywords_targeted", [])

    tailored_resume_data = _build_tailored_resume_data(profile_resume_data, claude_result)
    tailored_resume_text = _clean_dashes(_resume_to_plain_text(tailored_resume_data, profile_data))

    # ── Step 2: Cover letter ──────────────────────────────────────────────────
    cover_letter = _clean_dashes(_call_claude_cover_letter(client, job, tailored_resume_data, profile_data, custom_prompt))

    return {
        "tailored_resume_data":  tailored_resume_data,
        "tailored_resume_text":  tailored_resume_text,
        "cover_letter":          cover_letter,
        "fit_score":             100,
        "keywords_matched":      keywords_targeted,
        "keywords_missing":      [],
    }
