1# Design Spec: XYZ Experience Tailoring & Multi-Agent Verification Pipeline

**Status:** Draft
**Date:** 2026-04-14
**Author:** Gemini CLI (Super Agent)

## 1. Objective
Enhance the resume tailoring process to automatically rewrite work experience bullet points using the **Google XYZ formula** (Accomplished [X] as measured by [Y], by doing [Z]). Establish a rigorous multi-agent verification pipeline to ensure quality, adherence to rules, and prevention of AI hallucinations.

## 2. Technical Design

### 2.1 Backend: `tailor_service.py` Updates1
The core logic resides in `backend/app/services/tailor_service.py`.

#### A. Prompt Update (`_RESUME_PROMPT`)
Modify the prompt to:
1.  Request a new JSON field: `tailored_experience`.
2.  `tailored_experience` will be a list of objects, each containing `company`, `title`, and `tailored_bullets`.
3.  Explicitly instruct Claude to use the **XYZ formula**.
4.  Add a **Strict Anti-Hallucination Rule**: "Do not invent metrics or projects. If the original bullet lacks a metric, focus on the impact/result using only provided context or use a placeholder '[X]' for the user to fill."

#### B. Data Merging (`_build_tailored_resume_data`)
Currently, this function copies the original experience list. It will be updated to:
1.  Iterate through the original experience list.
2.  Match original entries with Claude's `tailored_experience` using `company` and `title`.
3.  Replace the `bullets` in the original entries with the `tailored_bullets`.

#### C. Plain Text Generation (`_resume_to_plain_text`)
Update to include the experience bullets in the "Related Work Experience" section, which are currently omitted.

### 2.2 Frontend: `JobDetails.tsx`
No significant changes expected as templates already iterate through `exp.bullets`. Verification required for all 4 templates (Rida, Waleed, Arham, Sheraz).

## 3. Multi-Agent Verification Pipeline

### 3.1 Agent Roles
1.  **Super Agent (Gemini CLI):** Orchestrates the process, dispatches sub-agents, and provides the final report.
2.  **Testing Agent (TDD):** Writes and executes unit tests for:
    *   JSON schema validation.
    *   XYZ format detection (regex-based or LLM-based verification).
    *   Merging logic correctness.
3.  **QA Agent (Code-Reviewer):** Performs a line-by-line review of the implementation. Checks for:
    *   Prompt clarity.
    *   Strictness of anti-hallucination rules.
    *   Code maintainability and naming conventions.
4.  **Auditor Agent (Integration):** Performs a "Blind Test" with a sample resume and JD. Verifies the end-to-end flow from API call to final generated resume output.

### 3.2 Workflow
1.  **Step 1: Research & TDD:** Testing Agent creates a test suite (`backend/tests/test_tailor_xyz.py`).
2.  **Step 2: Implementation:** Super Agent applies changes to `tailor_service.py`.
3.  **Step 3: Test Execution:** Testing Agent runs tests. If they fail, Super Agent fixes the code.
4.  **Step 4: QA Review:** QA Agent reviews the code. If rejected, Super Agent revises.
5.  **Step 5: Final Audit:** Auditor Agent runs an integration test and signs off.
6.  **Step 6: Reporting:** Super Agent compiles the results and presents to the user.

## 4. Success Criteria
*   Experience bullets in the tailored resume follow the XYZ pattern.
*   No "hallucinated" projects or metrics are introduced by the AI.
*   Plain text and PDF (via templates) resumes correctly display the tailored bullets.
*   All agents in the pipeline give a "Green" status.
