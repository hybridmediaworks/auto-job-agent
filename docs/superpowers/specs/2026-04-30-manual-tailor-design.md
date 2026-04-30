# Design Spec: Manual Tailor & Community Research Agent

**Status:** Draft
**Date:** 2026-04-30
**Author:** Gemini CLI

## 1. Objective
Implement a "Manual Tailor" tab in the Auto-Job-Agent. This feature allows users to manually input job details (Title, Description, Company) and generate tailored resumes and cover letters using the existing profile and template system. A key enhancement is the inclusion of a "Community Research Agent" that crawls Reddit, Stack Overflow, and Quora to find industry best practices and common technical patterns for the specific role, which are then used to enrich the tailoring process.

## 2. Technical Design

### 2.1 Frontend: `ManualTailor.tsx`
A new page component located in `frontend/src/pages/ManualTailor.tsx`.

*   **Form Components:**
    *   **Job Metadata:** Inputs for `Title`, `Company`, `Location`, and `URL`.
    *   **Description:** A large `textarea` for the Job Description.
    *   **Customization Options:**
        *   `Tone`: Dropdown (Professional, Technical, Enthusiastic).
        *   `Focus Areas`: Checkboxes for Architecture, Leadership, Coding, etc.
        *   `Enable Research`: Toggle to activate the Reddit/SO/Quora research agent.
    *   **Profile Selection:** Dropdown to select an existing `Profile` from the database.
    *   **Template Selection:** A visual card list of available resume templates (reused from `JobDetails.tsx`).
*   **Navigation:** Add a new tab in `frontend/src/components/layout/Layout.tsx`.

### 2.2 Backend: `tailor.py` API Update
Add a new endpoint `POST /api/tailor/manual`.

*   **Logic Flow:**
    1.  **Job Persistence:** Create a new `Job` record in the database with `provider='manual'`, `status='BOOKMARKED'`, and the provided metadata.
    2.  **Research Phase (Conditional):** If `enable_research` is true:
        *   Trigger the `ResearchService` (new) to gather insights.
    3.  **Tailoring Phase:** Call `tailor_service.tailor_for_job` using the newly created `Job` ID and `profile_id`.
    4.  **Cover Letter Phase:** Generate a cover letter specifically for the manual entry.
    5.  **Response:** Return the `TailoredApplication` ID and the created `Job` ID.

### 2.3 Research Service: `research_service.py`
A new service located in `backend/app/services/research_service.py`.

*   **Functionality:**
    *   Uses a search tool (e.g., `google_web_search`) to query Reddit, Quora, and Stack Overflow for the specific job title + "best practices" or "architecture patterns".
    *   Uses Claude-Haiku to summarize search results into a concise "Industry Insight" block (150-200 words).
    *   Focuses on: "What people actually build in this role", "Common tech stack pitfalls", and "Community-recommended solutions".

### 2.4 Prompt Augmentation
Update `backend/app/services/tailor_service.py` to accept an optional `research_context` parameter.

*   Include the research insights in the `Additional Context` section of the `_RESUME_PROMPT`.
*   Pass the "Tone" and "Focus Areas" from the manual form into the prompt instructions.

## 3. Data Flow
`User Input` -> `ManualTailor UI` -> `POST /api/tailor/manual` -> `Job DB` -> `Research Agent` -> `Claude API (Tailoring)` -> `TailoredApplication DB` -> `UI Download/View`.

## 4. Success Criteria
*   Users can generate a high-quality tailored resume for any job title by simply pasting the JD.
*   Manual entries are correctly saved in the "Applications" or "Jobs" history.
*   The tailoring reflects the "Community Research" insights when enabled.
*   The UI remains consistent with the existing theme and layout.
