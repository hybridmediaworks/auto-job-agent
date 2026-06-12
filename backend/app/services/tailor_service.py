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
import logging
import math
import re
from typing import Optional

import anthropic

logger = logging.getLogger(__name__)

_MODEL = "claude-sonnet-4-6"
_COVER_LETTER_MODEL = "claude-haiku-4-5"

# Anthropic client resilience: the SDK retries 429/5xx/529 with exponential backoff
# and jitter (respecting Retry-After) up to _MAX_RETRIES times, and gives up after
# _TIMEOUT seconds per request. Bumped above the SDK default of 2 because tailoring
# is a user-initiated, one-shot action where a transient blip should not surface as
# a hard failure.
_MAX_RETRIES = 4
_TIMEOUT = 120.0


class TailoringError(Exception):
    """Raised when an AI call fails in a way worth surfacing cleanly to the user."""

# ── Template layout hints appended to the resume prompt ───────────────────────

_TEMPLATE_HINTS: dict[int, str] = {
    1: (
        "LAYOUT: Rida Saeed template. White page. Dark teal full-width header (name + title + contact). "
        "Dark teal left sidebar: About Me, Skills pills, Tools icons, Portfolio. "
        "White right column: Experience with company circles + bullets, Education. "
        "Keep skills_list short individual labels for pills. Keep tools_list as individual tool names."
    ),
    2: (
        "LAYOUT: Waleed template. White page. Full-width white header with circular photo, "
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
    5: (
        "LAYOUT: Muhammad Waqar template. White page, blue initials badge top right, name + blue role title header, "
        "contact row, About Me paragraph, Experience entries (title, blue company, dates) separated by dashed lines, "
        "and a bordered grid of skill cells at the bottom. "
        "Keep skills_list short individual labels (1-3 words) for the bordered grid cells. Keep tools_list as individual tool names."
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
    6: (
        "LAYOUT: Adeel Shahzad template. Dark blue centered header (name in large white uppercase text). Light gray contact bar below header with icons for email, phone, location. "
        "Two-column layout: Left column (~32%) has About Me summary, Skills (blue rectangular pills), Tools (icons), Portfolio images, and Useful Links. "
        "Right column (~68%) has Experience (title and company on one line with blue pipe separator, dates on right), Education. "
        "Blue accent color throughout (#1565c0). "
        "Keep skills_list short labels for blue rectangular pills. Keep tools_list as individual tool names for icons."
    ),
    8: (
        "LAYOUT: Adeel V2 template. Purple header band (#8b52ff) with large yellow name, white uppercase role title "
        "between two white lines, and a contact row (email, phone, location) with cyan circle icons. "
        "Two-column body split by a cyan vertical bar: Left column has About Me (summary), Skills (purple rectangular "
        "pills), Tools (icons), Portfolio images, Useful Links. Right column has Experience (underlined title, purple "
        "company name, dates in pipes) and Education (two columns side by side). "
        "Keep skills_list short individual labels (1-3 words) for the purple pills, around 15-20 of them. "
        "Keep tools_list as individual tool names for icons (max 6). "
        "Summary should be a single dense paragraph (4-6 sentences) since it fills the About Me box."
    ),
    7: (
        "LAYOUT: Mirza Waleed template. Light green top and bottom bars (#7DC242). "
        "Full-width header with circular photo on left, large name and bold green role title. "
        "Contact info row with location, phone, email icons. "
        "Two-column layout: Left column (~35%) has ABOUT ME summary, SKILLS (light gray pills), PORTFOLIO thumbnails, USEFUL LINKS. "
        "Right column (~65%) has EXPERIENCE (company in green bold text, title and dates on next line), EDUCATION, TOOLS. "
        "Green accent color throughout (#7DC242). "
        "Keep skills_list labels short for gray pills. Keep tools_list as individual tool names for icons."
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

HONESTY (STRICT):
- Never fabricate employers, companies, dates, schools, certifications, or metrics, or claim
  hands-on use of a technology the candidate has never worked with and has no closely transferable
  experience for.
- You MAY reframe genuine and adjacent experience using the job's own terminology, and you
  SHOULD emphasize the candidate's real strengths. But emphasis is not invention.
- ROLE TITLES: only the SINGLE most recent role's title IS intentionally aligned to the target
  role (see the Recency Weighting section); that is allowed. Do NOT change any other role's title,
  and never change a company/employer name.
- If the job requires something the candidate genuinely lacks, leave it out of the experience
  bullets and report it honestly under keywords_missing instead of claiming it.

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
      "company": "<original company name, UNCHANGED>",
      "original_title": "<the role's title EXACTLY as in the profile, UNCHANGED — this is used to match this entry back to the profile, so it must equal the original>",
      "title": "<the title to DISPLAY: identical to original_title for every role EXCEPT the single most recent one, which gets the JD target role with the candidate's original seniority kept (see Recency Weighting)>",
      "tailored_bullets": [
        "<XYZ bullet 1: Must-Have tech from JD — stated directly by name, no hedging>",
        "<XYZ bullet 2: More Required tech from JD — state exact tool/framework names>",
        "<XYZ bullet 3: Preferred tech from JD (e.g. Redux, Hooks, testing framework) — state by exact name>",
        "<XYZ bullet 4: More Preferred or stack-specific tech (e.g. MongoDB, cross-browser, responsive design)>",
        "<XYZ bullet 5: Remaining JD keywords not yet covered above>"
      ]
    }}
  ],
  "keywords_targeted": ["<key JD term>", "<key JD term>", "<key JD term>"],
  "fit_score": <integer 0-100: an HONEST assessment of how well the candidate's ACTUAL background, before any tailoring, matches this job's core requirements. Be realistic, not generous. 90+ only when they clearly meet almost everything; 60-80 for a solid partial match; below 50 when it is a stretch.>,
  "keywords_matched": ["<JD skill/keyword the candidate GENUINELY has or has closely transferable experience with>"],
  "keywords_missing": ["<JD skill/keyword the candidate does NOT genuinely have>"]
}}

IMPORTANT for tailored_experience:
- Rewrite EVERY bullet point using the Google XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]".
- COVER GENUINE JD TECH: For every technology, framework, and tool named in the JD that the candidate genuinely has (or has closely transferable) experience with, make it appear by exact name in at least one bullet across the experience entries. Do NOT force-fit technologies the candidate has never used and has no adjacent experience for — those belong in keywords_missing, not in the bullets.
- USE THE EMPLOYER'S VOCABULARY for real experience: when the candidate's genuine work maps to a JD technology, describe it using the JD's exact terminology rather than a synonym (e.g. if the JD says React.js and the candidate has real component-based JavaScript/React work, write "React.js component-based development", not "React-style").
- NO DECEPTIVE HEDGING, NO INVENTION: do not pad bullets with vague "compatible with" / "inspired by" filler, and equally do not assert hands-on use of a named framework the candidate has never touched. State real and transferable experience directly and confidently; omit what is not real.
- CONCENTRATE JD TECH IN THE 2 MOST RECENT ROLES (see the Recency Weighting section below): the two most recent roles should carry the bulk of the JD's required stack and keywords. Older roles keep their original focus and only mention JD tech that genuinely applied there.
- Generate 4 to 6 bullets per role BY DEFAULT, unless the candidate's custom instructions specify a different number (then use exactly that number).
- DO NOT invent projects, employers, or technologies. Reframe and reinterpret EXISTING work to highlight what the employer needs.
- If a specific metric is unknown, use a compelling generic phrase. Examples: "across multiple client projects", "for several production environments", "significantly reducing manual effort", "improving delivery speed across concurrent builds". Never leave brackets like [X] or [Y] in the output.
- Keep each company and employer exactly as in the profile (never invent one). For the SINGLE MOST RECENT role only, set its "title" to the target role from the JD (see Recency Weighting). For ALL other roles (including the second most recent), keep the original title UNLESS the candidate's custom instructions ask to change a specific title.
- NEVER use hyphens or dashes in any bullet text. Use commas instead.

IMPORTANT for tools_list:
- Include ONLY tools, software, and technologies that are explicitly mentioned or clearly required by the job description above
- Do NOT include tools from the candidate's profile that are not referenced in the JD
- Each entry must be a single tool/software name only (e.g. "WordPress", "Figma", "React") — no sentences, no versions
- HARD CAP: never more than 6 tools — quality over quantity, only what the JD actually asks for
- If the candidate's custom instructions ask for fewer tools or to remove the tools section entirely, honor it (return fewer items, or an empty array [] to drop the section)

IMPORTANT for skills_list:
- Each entry is a short individual skill label (2-4 words max) suitable for a badge/pill
- Include the candidate's existing skills, PLUS JD skills the candidate has genuine familiarity, adjacent knowledge, or transferable experience with
- INCLUSION RULE: include a JD skill if the candidate has real or closely transferable exposure to it. Do NOT list a technology the candidate has never encountered just because the JD names it — that belongs in keywords_missing.
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
- Maximum 8 items

IMPORTANT for fit_score, keywords_matched, keywords_missing (HONEST GAP ANALYSIS):
- Assess the candidate's REAL background against this JD truthfully, as it stands BEFORE tailoring. Do not default to 100.
- keywords_matched = JD requirements the candidate genuinely satisfies (or has strong transferable experience for).
- keywords_missing = JD requirements the candidate genuinely lacks or has only weak adjacency to. It is normal and expected for this list to be non-empty.
- These three fields are a private, truthful self-assessment for the candidate's own awareness. Keep them honest even though the resume body emphasizes strengths — a missing skill belongs here, never invented into the experience bullets."""


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


# ── Custom-prompt sanitization ─────────────────────────────────────────────────

_MAX_CUSTOM_PROMPT_CHARS = 1500

# Patterns that look like attempts to override the system instructions.
# We strip whole lines that match these so user intent survives but injection
# attempts get neutered.
_INJECTION_PATTERNS = (
    re.compile(r"(?im)^\s*(ignore|disregard|forget)\b.*$"),
    re.compile(r"(?im)^\s*you\s+(are|will\s+be|must\s+now\s+be)\b.*$"),
    re.compile(r"(?im)^\s*new\s+(system|instructions?|rules?)\b.*$"),
    re.compile(r"(?im)^\s*system\s*[:>].*$"),
    re.compile(r"(?im)^\s*</?\s*system\s*>.*$"),
    re.compile(r"(?im)^\s*assistant\s*[:>].*$"),
    re.compile(r"(?im)^\s*```\s*$"),
)


def _sanitize_custom_prompt(text: Optional[str]) -> Optional[str]:
    """
    Treat user-supplied prompt text as data, not instructions.

    - Truncate to a hard char limit
    - Strip lines that match common prompt-injection patterns
    - Caller is responsible for fencing the result in the final prompt
    """
    if not text:
        return None
    cleaned = text.strip()[:_MAX_CUSTOM_PROMPT_CHARS]
    for pattern in _INJECTION_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned or None


# Few-shot examples that translate plain-English user instructions into concrete
# edits to the JSON output. Anthropic's models follow instructions literally and do
# not generalize unless scope is explicit, so we spell out the exact field changes.
_RESUME_DIRECTIVE_EXAMPLES = (
    '- "make the experience bullets 4" / "only 4 bullet points" -> EVERY tailored_experience entry\'s tailored_bullets array has EXACTLY 4 items.\n'
    '- "give ABC Corp 3 bullets" -> only the entry whose company is ABC Corp has exactly 3 tailored_bullets; leave the others as they are.\n'
    '- "discard the tools section" / "remove tools" / "no tools icons" -> return "tools_list": [] (an empty array).\n'
    '- "only 6 tools" / "max 6 tool icons" -> "tools_list" has at most 6 items (never more than 6 in any case).\n'
    '- "change the latest experience title to Lead PHP Developer" -> set the FIRST (most recent) tailored_experience entry\'s "title" to "Lead PHP Developer" (keep its company unchanged); also set the top-level "role_title" to "Lead PHP Developer".\n'
    '- "make it 10 years of experience" / "show 10 years" -> the summary explicitly states "10 years of experience", overriding the years-alignment heuristic.\n'
    '- "drop key achievements" / "no portfolio" -> return that section\'s field as an empty array (e.g. "key_achievements": []).\n'
    '- "emphasize React" / "focus on DevOps" -> reorder and weight skills_list, tools_list, and bullets toward that area first.'
)


def _fence_resume_directives(text: str) -> str:
    """
    Wrap the candidate's custom instructions for the RESUME and grant them top
    priority over the default formatting heuristics, while keeping the JSON
    structure and truthfulness non-negotiable.
    """
    return (
        "\n\n## Candidate's Custom Instructions (HIGHEST PRIORITY)"
        "\nThe candidate gave the explicit instructions below for THIS resume. Apply them EXACTLY and"
        " completely, even when they contradict the default formatting heuristics above (the default"
        " bullet counts, the default tool count, the default section choices, the years-of-experience"
        " phrasing, or keeping the original role title). Follow each instruction literally and apply it to"
        " every place it logically applies; do not partially apply it and do not ignore it."
        "\n\nNON-NEGOTIABLE rules that still win ONLY if an instruction would otherwise break them:"
        "\n- Output ONLY one valid JSON object with the SAME keys and shape specified above."
        "\n- Never invent an employer, company, job, school, certification, or date."
        "\n- Never use hyphens or dashes anywhere (use commas)."
        "\n\nHow to apply common instructions to the JSON output:"
        f"\n<examples>\n{_RESUME_DIRECTIVE_EXAMPLES}\n</examples>"
        f"\n<custom_instructions>\n{text}\n</custom_instructions>"
    )


def _fence_cover_letter_directives(text: str) -> str:
    """Wrap the candidate's custom instructions for the COVER LETTER (plain prose)."""
    return (
        "\n\n## Candidate's Custom Instructions (HIGHEST PRIORITY)"
        "\nApply the candidate's explicit instructions below EXACTLY for this cover letter, even when they"
        " override the default style guidance above. Keep it truthful (never invent employers or facts) and"
        " keep the no-dashes rule."
        f"\n<custom_instructions>\n{text}\n</custom_instructions>"
    )


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


def _build_tailored_resume_data(
    original: dict, claude_result: dict, allow_section_clearing: bool = False,
    one_page: bool = False,
) -> dict:
    """
    Merge Claude's tailored content into the resume structure.
    - summary, role_title, role_description, skills_bullets: from Claude
    - experience: tailored bullets (and a changed title, if requested) merged in
    - education, name, contact: kept from original unchanged

    allow_section_clearing: when True (a custom instruction is present), an EXPLICIT
    empty list from Claude (e.g. "tools_list": []) clears that section, so directives
    like "discard the tools section" take effect. When False, empty lists are ignored
    and the original section is preserved (avoids accidentally wiping a section).

    one_page: when True, hard-trim to fit one page while KEEPING ALL experiences —
    recent 2 roles ≤3 bullets, older roles ≤2, tools ≤6 (skills uncapped), summary ≤2 sentences.
    """
    tailored = copy.deepcopy(original)

    if claude_result.get("summary"):
        tailored["summary"] = claude_result["summary"]

    if claude_result.get("role_title"):
        tailored["role_title"] = claude_result["role_title"]

    if claude_result.get("role_description"):
        tailored["role_description"] = claude_result["role_description"]

    # List sections: a non-empty list always replaces; an explicit empty list clears
    # the section only when the user issued a directive (allow_section_clearing).
    def _merge_list_field(field: str) -> None:
        if field not in claude_result:
            return  # Claude didn't address it → keep the original section
        value = claude_result[field]
        if not isinstance(value, list):
            return
        if value:
            tailored[field] = value
        elif allow_section_clearing:
            tailored[field] = []

    for list_field in (
        "skills_bullets", "tools_list", "skills_list",
        "key_achievements", "expertise_bullets", "additional_skills",
    ):
        _merge_list_field(list_field)

    # Hard cap the tools section at 6 (matches every template's icon row).
    if isinstance(tailored.get("tools_list"), list):
        tailored["tools_list"] = tailored["tools_list"][:6]

    # ── Pass-through fields (kept from original, not tailored) ───────────────
    for passthrough_field in ("languages", "projects", "useful_links", "portfolio_images"):
        if passthrough_field not in tailored and original.get(passthrough_field):
            tailored[passthrough_field] = original[passthrough_field]

    # ── Tailor experience bullets (and honor a requested title change) ────────
    tailored_entries = [
        e for e in claude_result.get("tailored_experience", []) if isinstance(e, dict)
    ]

    # Priority 1: exact (company, ORIGINAL title) match → full entry.
    # We key on original_title (echoed back unchanged by Claude), NOT the display
    # "title", because the 2 recent roles get a JD-aligned display title — matching
    # on that would miss and mismap bullets when two roles share a company.
    def _orig_title(e: dict) -> str:
        return (e.get("original_title") or e.get("title") or "").lower().strip()

    exact_map = {
        (e.get("company", "").lower().strip(), _orig_title(e)): e
        for e in tailored_entries
    }
    # Priority 2: company-only match (first entry per company)
    company_map: dict = {}
    for e in tailored_entries:
        key = e.get("company", "").lower().strip()
        if key and key not in company_map:
            company_map[key] = e

    for idx, exp in enumerate(tailored.get("experience", [])):
        company_key = exp.get("company", "").lower().strip()
        title_key = exp.get("title", "").lower().strip()  # original title of this profile role

        entry = (
            exact_map.get((company_key, title_key))
            or company_map.get(company_key)
            # Priority 3: positional fallback (Claude returns entries in resume order)
            or (tailored_entries[idx] if idx < len(tailored_entries) else None)
        )
        if not entry:
            continue

        bullets = entry.get("tailored_bullets") or []
        if bullets:
            exp["bullets"] = bullets

        # Apply the display title: JD-aligned for the 2 recent roles, original for
        # older roles (and overridable via custom instructions). Matching above used
        # the original title, so this safely renames the right role.
        new_title = (entry.get("title") or "").strip()
        if new_title:
            exp["title"] = new_title

    # ── Strict one-page caps: KEEP every experience, just trim each one.
    # Skills are intentionally NOT capped (only tools are) — the PDF auto-fit
    # scale guarantees one page even with a full pill wall.
    if one_page:
        for idx, exp in enumerate(tailored.get("experience", [])):
            if isinstance(exp.get("bullets"), list):
                exp["bullets"] = exp["bullets"][: (3 if idx < 2 else 2)]
        if isinstance(tailored.get("tools_list"), list):
            tailored["tools_list"] = tailored["tools_list"][:6]
        if isinstance(tailored.get("summary"), str):
            tailored["summary"] = _first_n_sentences(tailored["summary"], 2)

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


# Established technical/English compound terms whose hyphens MUST be preserved.
# Matched case-insensitively. Add new entries here as they come up.
_PRESERVED_HYPHENATED_TERMS: tuple[str, ...] = (
    "full-stack", "front-end", "back-end", "end-to-end", "pre-trained",
    "fine-tuned", "self-hosted", "self-service", "open-source", "real-time",
    "state-of-the-art", "well-known", "high-performance", "high-availability",
    "data-driven", "user-friendly", "production-ready", "out-of-the-box",
    "API-first", "mobile-first", "cloud-native", "event-driven",
    "object-oriented", "test-driven", "domain-driven", "AI-powered",
    "machine-learning", "deep-learning", "in-memory", "on-premise",
    "on-prem", "low-latency", "near-real-time", "long-running",
    "well-documented", "battle-tested", "two-way", "one-on-one",
    "hands-on", "day-to-day", "cross-functional", "cross-platform",
)


def _clean_dashes(text: str) -> str:
    """
    Normalize dash/hyphen usage.

    Rules:
      - Em dash, en dash (when not a date range), and double hyphens → ", "
      - Date-range en dashes preserved (e.g. "2023 – Present")
      - Hyphens in whitelisted technical compounds (e.g. "full-stack") preserved
      - Other mid-word hyphens collapsed to a space
    """
    if not text:
        return text

    # ── Stage 1: protect tokens we want to keep verbatim ──────────────────────
    placeholders: dict[str, str] = {}

    def _stash(match: re.Match) -> str:
        token = f"\x00TKN{len(placeholders)}\x00"
        placeholders[token] = match.group(0)
        return token

    # Protect whitelisted compounds (case-insensitive, word-boundary anchored)
    for term in _PRESERVED_HYPHENATED_TERMS:
        pattern = r"\b" + re.escape(term) + r"\b"
        text = re.sub(pattern, _stash, text, flags=re.IGNORECASE)

    # Protect date-range en dashes ("2023 – Present", "Oct 2024 – Sep 2025")
    text = re.sub(r"\d\s*–\s*\S", _stash, text)

    # ── Stage 2: normalize remaining dashes ───────────────────────────────────
    text = re.sub(r"\s*--\s*", ", ", text)      # double hyphens
    text = re.sub(r"\s*—\s*", ", ", text)       # em dash
    text = re.sub(r"\s*–\s*", ", ", text)       # remaining en dash (non-date)
    text = re.sub(r"(?<=\w) - (?=\w)", ", ", text)   # " - " clause connector
    text = re.sub(r"(?<=\w)-(?=\w)", " ", text)      # other mid-word hyphens

    # ── Stage 3: restore protected tokens ─────────────────────────────────────
    for token, original in placeholders.items():
        text = text.replace(token, original)

    # ── Stage 4: tidy up ──────────────────────────────────────────────────────
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


def _parse_claude_json(raw: str) -> dict:
    """
    Parse Claude's response into a dict, tolerating code fences and stray prose.

    Claude is instructed to return raw JSON, but occasionally wraps it in ```json
    fences or prepends a sentence. Strip fences first; if that still fails, fall
    back to the outermost {...} block before giving up.
    """
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise


def _friendly_anthropic_error(exc: Exception) -> str:
    """Map a raw Anthropic SDK exception to a clear, user-facing message."""
    if isinstance(exc, anthropic.RateLimitError):
        return "The AI service is rate limited right now. Please wait a moment and try again."
    if isinstance(exc, anthropic.APITimeoutError):
        return "The AI service timed out. Please try again."
    if isinstance(exc, anthropic.APIConnectionError):
        return "Could not reach the AI service. Check the connection and try again."
    if isinstance(exc, anthropic.APIStatusError):
        return f"The AI service returned an error (HTTP {exc.status_code}). Please try again shortly."
    return f"AI request failed: {exc}"


def _log_usage(label: str, response) -> None:
    """Log token usage for cost visibility; never raise."""
    try:
        usage = response.usage
        logger.info("Claude %s usage — input=%s output=%s", label, usage.input_tokens, usage.output_tokens)
    except Exception:
        pass


def _coerce_fit_score(value) -> Optional[float]:
    """Clamp Claude's fit_score into 0-100. Returns None when unusable (honest absence)."""
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    # NaN/Infinity slip past float() but would clamp to a fake 100 (NaN) — the exact
    # "always 100" dishonesty this fix removes. Treat non-finite as an honest absence.
    if not math.isfinite(score):
        return None
    return max(0.0, min(100.0, score))


def _coerce_str_list(value) -> list:
    """Coerce Claude output into a clean list[str]. Anything non-list becomes []."""
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if item is not None and str(item).strip()]


def _first_n_sentences(text: str, n: int) -> str:
    """
    Return the first n sentences of text (used to hard-trim the summary in one-page mode).

    Only treats a period as a boundary when the next sentence starts with a capital,
    so abbreviations like "e.g. recommendation engines" or "Inc. and" (followed by a
    lowercase word) don't cause a mid-sentence chop.
    """
    if not isinstance(text, str) or not text.strip():
        return text
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text.strip())
    return " ".join(parts[:n]).strip()


def _recency_weighting_block(recent_roles: Optional[list], one_page: bool = False, jd_title: str = "") -> str:
    """
    Build the recency-weighting directive: the 2 most recent roles get bullets
    rewritten ~80% toward the JD (JD-max but truthful); ONLY the single most recent
    role also gets a JD-aligned title and the "As a {role}, ..." first bullet
    (doing it on both read as repetitive). Older roles stay ~80% original.
    """
    def _label(r) -> str:
        if not isinstance(r, dict):
            return ""
        company = (r.get("company") or "").strip()
        title = (r.get("title") or "").strip()
        return " at ".join(p for p in [title, company] if p)

    roles = recent_roles or []
    first = f' ("{_label(roles[0])}")' if roles and _label(roles[0]) else ""
    second = f' ("{_label(roles[1])}")' if len(roles) > 1 and _label(roles[1]) else ""
    target = (jd_title or "the target role").strip() or "the target role"
    return (
        "\n\n## Recency Weighting (IMPORTANT)"
        "\nThe candidate's experience is listed most recent first."
        f"\n\nTHE 2 MOST RECENT ROLES: rewrite the bullets of EACH of these two roles with the SAME strength"
        " (do not make the second one weaker) so that roughly 80% of the content reflects THIS job"
        " description — lead with the JD's exact stack, tools, and keywords; reframe the candidate's genuine"
        " and transferable experience into the JD's vocabulary; cover as many JD requirements as the candidate"
        " plausibly supports. You may rewrite all of their bullets to align with the JD."
        f"\n\nONLY THE SINGLE MOST RECENT ROLE{first} additionally gets:"
        f"\n- TITLE: set this role's \"title\" to the target role from the JD ({target}), keeping the"
        " candidate's ORIGINAL seniority level (do not inflate — if the original title was not Senior/Lead,"
        " do not add Senior/Lead). Keep it close and believable. Keep the company/employer unchanged."
        f"\n- FIRST BULLET: the FIRST bullet of this role must open by naming the target role, e.g."
        f" \"As a {target}, ...\" or \"Working as a {target}, ...\", then state a concrete achievement using"
        " the JD's stack."
        f"\n\nTHE SECOND MOST RECENT ROLE{second} keeps its ORIGINAL title exactly, and its bullets must NOT"
        f" open with \"As a {target}\" phrasing — repeating the opener on two roles reads as artificial."
        " Its bullets still get the full 80% JD rewrite described above."
        "\n\nStay truthful for all roles: do NOT claim a technology the candidate has never used and has no"
        " adjacent experience for (put those in keywords_missing, not in the bullets). The title may align to"
        " the JD only for the most recent role; never invent an employer, company, or dates."
        f"\n\n<example>"
        f"\nJD target role: \"{target}\". Most recent role: \"WordPress Developer at Acme\";"
        f" second most recent: \"Web Developer at Globex\"."
        f"\nMost recent entry -> title: \"{target}\" (seniority kept), first tailored_bullet:"
        f" \"As a {target}, designed and shipped ...\" (then JD-stack achievements)."
        f"\nSecond entry -> title stays \"Web Developer\"; bullets fully JD-aligned but with NO"
        f" \"As a {target}\" opener."
        f"\n</example>"
        "\n\nKEEP OLDER ROLES MOSTLY ORIGINAL. For every role AFTER the first two:"
        + (
            "\n- Keep only the 2 most representative, highest impact original bullets (one-page mode),"
            " ordering them most important first, and preserve their original substance and focus."
            if one_page else
            "\n- Preserve roughly 80% of the original bullets' substance and focus."
        )
        + "\n- Only lightly weave in JD terms that genuinely applied there; do NOT force-fit JD keywords."
    )


def _call_claude_resume(
    client: anthropic.Anthropic,
    job: dict,
    resume_text: str,
    profile_context: str,
    custom_prompt: Optional[str] = None,
    template_id: Optional[int] = None,
    one_page: Optional[bool] = False,
    research_context: Optional[str] = None,
    tone: Optional[str] = None,
    focus_areas: Optional[list] = None,
    recent_roles: Optional[list] = None,
) -> dict:
    """Call Claude to produce a tailored resume JSON in the company profile format."""
    prompt = _RESUME_PROMPT.format(
        title=job.get("title", ""),
        company=job.get("company", ""),
        description=(job.get("description") or "")[:6000],
        resume_text=resume_text[:5000],
        profile_context=profile_context,
    )
    if research_context:
        prompt += f"\n\n## Industry Research Context\n{research_context}"
    if tone:
        prompt += f"\n\n## Tone\nWrite the resume in a {tone} tone."
    if focus_areas:
        prompt += f"\n\n## Focus Areas\nEmphasize these areas: {', '.join(focus_areas)}."
    if template_id and template_id in _TEMPLATE_HINTS:
        prompt += f"\n\n## Layout Instructions\n{_TEMPLATE_HINTS[template_id]}"

    # ── Recency weighting: recent 2 roles ~80% JD, JD-aligned title + first bullet ──
    prompt += _recency_weighting_block(
        recent_roles, one_page=bool(one_page), jd_title=job.get("title", "")
    )

    safe_custom_prompt = _sanitize_custom_prompt(custom_prompt)
    if safe_custom_prompt:
        prompt += _fence_resume_directives(safe_custom_prompt)
    if one_page:
        prompt += (
            "\n\n## One-Page Constraint (STRICT — do not ignore)"
            "\nThis resume MUST fit on ONE printed page, but KEEP ALL of the candidate's experiences"
            " (never drop a role — only shorten each one). Hard limits:"
            "\n- Keep EVERY experience entry. Do not remove any role."
            "\n- The 2 most recent roles: AT MOST 3 bullets each. All older roles: AT MOST 2 bullets each."
            "\n- Summary: exactly 2 sentences."
            "\n- tools_list: AT MOST 6 items. skills_list is NOT capped, keep it complete."
            "\n- When trimming, keep the highest impact, most JD relevant bullets, ordered most important first."
            "\n- These per-role bullet limits and the 6-item caps take PRIORITY over any requested counts"
            " (including custom instructions), because the resume must fit one page."
            "\nDo not exceed these limits under any circumstances."
        )
    try:
        response = client.messages.create(
            model=_MODEL,
            max_tokens=4096,  # headroom for full bullets + the honest assessment fields
            system=_RESUME_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
    except anthropic.APIError as exc:
        logger.error("Claude resume call failed: %r", exc)
        raise TailoringError(_friendly_anthropic_error(exc)) from exc

    _log_usage("resume", response)
    raw = response.content[0].text
    try:
        return _parse_claude_json(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Claude resume JSON parse failed; raw head: %s", raw[:300])
        raise TailoringError(
            "The AI returned a response that could not be read as a resume. Please try again."
        ) from exc


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
    safe_custom_prompt = _sanitize_custom_prompt(custom_prompt)
    if safe_custom_prompt:
        prompt += _fence_cover_letter_directives(safe_custom_prompt)
    try:
        response = client.messages.create(
            model=_COVER_LETTER_MODEL,
            max_tokens=800,
            system=_COVER_LETTER_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
    except anthropic.APIError as exc:
        logger.error("Claude cover-letter call failed: %r", exc)
        raise TailoringError(_friendly_anthropic_error(exc)) from exc

    _log_usage("cover_letter", response)
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
    research_context: Optional[str] = None,
    tone: Optional[str] = None,
    focus_areas: Optional[list] = None,
    location_override: Optional[str] = None,
    address_override: Optional[str] = None,
) -> dict:
    """
    Full tailoring pipeline: produce a job-targeted resume + cover letter.

    Returns dict with:
        tailored_resume_data, tailored_resume_text, cover_letter,
        fit_score (Claude's honest 0-100 assessment, or None),
        keywords_matched, keywords_missing (Claude's honest JD-vs-resume gap analysis)

    Raises TailoringError when the AI call fails in a recoverable, user-presentable way.
    """
    client = anthropic.Anthropic(
        api_key=anthropic_api_key,
        max_retries=_MAX_RETRIES,
        timeout=_TIMEOUT,
    )

    resume_text     = _resume_to_text(profile_resume_data)
    profile_context = _build_profile_context(profile_data)
    # The 2 most recent roles (list is most-recent-first) get the 80% JD rewrite.
    recent_roles    = (profile_resume_data.get("experience") or [])[:2]

    # ── Step 1: Tailored profile rewrite ─────────────────────────────────────
    claude_result = _call_claude_resume(
        client=client,
        job=job,
        resume_text=resume_text,
        profile_context=profile_context,
        custom_prompt=custom_prompt,
        template_id=template_id,
        one_page=one_page,
        research_context=research_context,
        tone=tone,
        focus_areas=focus_areas,
        recent_roles=recent_roles,
    )

    # ── Honest gap analysis from Claude (real JD-vs-resume comparison) ────────
    # keywords_matched falls back to keywords_targeted (the terms the resume leaned
    # into) only when Claude omits the dedicated field, so the UI is never blank.
    fit_score = _coerce_fit_score(claude_result.get("fit_score"))
    # Take keywords straight from Claude but enforce the list[str] contract — a
    # malformed (non-list) value would otherwise 500 in the preview path or write
    # garbage into the JSON column. Fall back to keywords_targeted only when
    # keywords_matched isn't a usable list.
    matched_raw = claude_result.get("keywords_matched")
    if not isinstance(matched_raw, list):
        matched_raw = claude_result.get("keywords_targeted")
    keywords_matched = _coerce_str_list(matched_raw)
    keywords_missing = _coerce_str_list(claude_result.get("keywords_missing"))

    # A custom prompt may ask to drop a whole section ("discard tools") — allow an
    # explicit empty list from Claude to clear sections only when the user directed it.
    tailored_resume_data = _build_tailored_resume_data(
        profile_resume_data, claude_result,
        allow_section_clearing=bool(custom_prompt),
        one_page=one_page,
    )

    # ── Override contact fields from manual form ──────────────────────────────
    if location_override:
        tailored_resume_data["location"] = location_override
    if address_override:
        tailored_resume_data["address"] = address_override

    tailored_resume_text = _clean_dashes(_resume_to_plain_text(tailored_resume_data, profile_data))

    # ── Step 2: Cover letter ──────────────────────────────────────────────────
    cover_letter = _clean_dashes(_call_claude_cover_letter(client, job, tailored_resume_data, profile_data, custom_prompt))

    return {
        "tailored_resume_data":  tailored_resume_data,
        "tailored_resume_text":  tailored_resume_text,
        "cover_letter":          cover_letter,
        "fit_score":             fit_score,
        "keywords_matched":      keywords_matched,
        "keywords_missing":      keywords_missing,
    }
