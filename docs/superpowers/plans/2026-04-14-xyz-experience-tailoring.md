# XYZ Experience Tailoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite work experience bullet points using the Google XYZ formula and ensure they are correctly merged and displayed in the tailored resume.

**Architecture:** Update the AI prompt to request XYZ-tailored bullets, update the merging logic to replace original bullets with tailored ones, and ensure the plain text output includes these bullets.

**Tech Stack:** Python (FastAPI), Anthropic Claude API, SQLAlchemy.

---

### Task 1: Create Unit Test for XYZ Tailoring

**Files:**
- Create: `backend/app/tests/test_tailor_xyz.py`

- [ ] **Step 1: Write the test for merging and plain text**

```python
import pytest
from app.services.tailor_service import _build_tailored_resume_data, _resume_to_plain_text

def test_merge_tailored_experience():
    original = {
        "experience": [
            {"company": "Google", "title": "Dev", "bullets": ["Did things"]}
        ]
    }
    claude_result = {
        "tailored_experience": [
            {"company": "Google", "title": "Dev", "tailored_bullets": ["Accomplished X by doing Y as measured by Z"]}
        ]
    }
    result = _build_tailored_resume_data(original, claude_result)
    assert result["experience"][0]["bullets"] == ["Accomplished X by doing Y as measured by Z"]

def test_plain_text_includes_bullets():
    data = {
        "experience": [
            {"company": "Google", "title": "Dev", "start_date": "2020", "bullets": ["XYZ Bullet"]}
        ]
    }
    text = _resume_to_plain_text(data)
    assert "XYZ Bullet" in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/app/tests/test_tailor_xyz.py`
Expected: FAIL (AttributeError or AssertionError)

### Task 2: Update AI Prompt in `tailor_service.py`

**Files:**
- Modify: `backend/app/services/tailor_service.py:100-200`

- [ ] **Step 1: Update `_RESUME_PROMPT` to include `tailored_experience`**

```python
# In _RESUME_PROMPT, add:
"tailored_experience": [
    {
      "company": "<original company name>",
      "title": "<original job title>",
      "tailored_bullets": [
        "<XYZ bullet 1: Accomplished [X] as measured by [Y], by doing [Z]>",
        "<XYZ bullet 2>",
        "<XYZ bullet 3>"
      ]
    }
]

# Add Strict Anti-Hallucination Rule:
"IMPORTANT for tailored_experience:
- Rewrite EVERY bullet point from the original experience using the Google XYZ formula: 'Accomplished [X] as measured by [Y], by doing [Z]'.
- If the original bullet lacks a metric, focus on the specific impact/result based ONLY on the provided context.
- DO NOT invent metrics, numbers, or projects that do not exist in the candidate's original profile.
- If no metric can be reasonably derived, use '[X]' as a placeholder."
```

### Task 3: Update Merging Logic and Plain Text

**Files:**
- Modify: `backend/app/services/tailor_service.py`

- [ ] **Step 1: Update `_build_tailored_resume_data`**

```python
def _build_tailored_resume_data(original: dict, claude_result: dict) -> dict:
    tailored = copy.deepcopy(original)
    # ... existing fields ...
    
    # New: Tailor experience bullets
    tailored_exp_map = {
        (e["company"].lower(), e["title"].lower()): e["tailored_bullets"]
        for e in claude_result.get("tailored_experience", [])
    }
    
    for exp in tailored.get("experience", []):
        key = (exp.get("company", "").lower(), exp.get("title", "").lower())
        if key in tailored_exp_map:
            exp["bullets"] = tailored_exp_map[key]
            
    return tailored
```

- [ ] **Step 2: Update `_resume_to_plain_text`**

```python
# Inside the experience loop of _resume_to_plain_text:
for exp in experience:
    # ... company/title/dates ...
    for bullet in exp.get("bullets", []):
        lines.append(f"  • {bullet}")
```

### Task 4: Verification Loop

- [ ] **Step 1: Run tests**
Run: `pytest backend/app/tests/test_tailor_xyz.py`
Expected: PASS

- [ ] **Step 2: Dispatch QA Agent**
Task: `code-reviewer` review `backend/app/services/tailor_service.py` against XYZ and Anti-Hallucination rules.

- [ ] **Step 3: Auditor Integration Test**
Task: Manually trigger a tailoring via the API (or a script) and verify the final result matches the XYZ requirement.
