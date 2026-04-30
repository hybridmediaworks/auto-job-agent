# Manual Tailor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Manual Tailor" feature that allows users to paste job details, optionally research community best practices (Reddit/SO/Quora), and generate tailored resumes/cover letters.

**Architecture:** 
1.  **Research Service:** New backend service to fetch and summarize external community insights.
2.  **API:** New endpoint `POST /api/tailor/manual` to handle the manual workflow.
3.  **Tailoring Service:** Update existing service to incorporate research context.
4.  **Frontend:** New "Manual Tailor" page with a comprehensive form.

**Tech Stack:** FastAPI, React, TypeScript, Anthropic (Claude), Google Search Tool.

---

### Task 1: Research Service

**Files:**
- Create: `backend/app/services/research_service.py`
- Test: `backend/app/tests/test_research_service.py`

- [ ] **Step 1: Write a test for the research summarization**
- [ ] **Step 2: Implement `research_service.py` using `google_web_search` and Claude-Haiku**
- [ ] **Step 3: Verify the service returns a structured insight block**
- [ ] **Step 4: Commit**

### Task 2: Backend API and Tailoring Logic

**Files:**
- Modify: `backend/app/services/tailor_service.py`
- Modify: `backend/app/routers/tailor.py`
- Test: `backend/app/tests/test_manual_tailor_api.py`

- [ ] **Step 1: Update `tailor_service.py` to accept `research_context`, `tone`, and `focus_areas`**
- [ ] **Step 2: Implement the `POST /api/tailor/manual` endpoint in `tailor.py`**
- [ ] **Step 3: Ensure the manual job is saved to the database correctly**
- [ ] **Step 4: Run integration tests to verify the manual tailoring flow**
- [ ] **Step 5: Commit**

### Task 3: Frontend Layout and Sidebar

**Files:**
- Modify: `frontend/src/components/layout/Layout.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add the "Manual Tailor" link to the sidebar in `Layout.tsx`**
- [ ] **Step 2: Add the route for `/manual-tailor` in `App.tsx`**
- [ ] **Step 3: Commit**

### Task 4: Manual Tailor Page Implementation

**Files:**
- Create: `frontend/src/pages/ManualTailor.tsx`

- [ ] **Step 1: Build the form with inputs for Job Title, Company, Description, Tone, and Focus Areas**
- [ ] **Step 2: Integrate Profile and Template selection (reuse components from `JobDetails.tsx`)**
- [ ] **Step 3: Connect the form to the new `POST /api/tailor/manual` endpoint**
- [ ] **Step 4: Add success/error handling and a redirect to the generated application**
- [ ] **Step 5: Final UI verification**
- [ ] **Step 6: Commit**
