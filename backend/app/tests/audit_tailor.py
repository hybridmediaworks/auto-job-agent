import json
import os
from typing import Optional
from app.services.tailor_service import _build_tailored_resume_data, _resume_to_plain_text

def run_audit():
    print("--- Auditor Agent: Starting Integration Audit ---")
    
    # Sample original resume data
    original_resume = {
        "name": "John Doe",
        "experience": [
            {
                "company": "Tech Corp",
                "title": "Software Engineer",
                "start_date": "2020",
                "end_date": "Present",
                "bullets": ["Wrote code for a web app."]
            }
        ],
        "education": [{"degree": "CS", "institution": "Uni", "graduation": "2020"}]
    }
    
    # Mocked Claude result (matching the new prompt format)
    claude_result = {
        "summary": "Tailored summary.",
        "role_title": "Senior Dev",
        "role_description": "Will lead teams.",
        "skills_bullets": ["Python, React"],
        "tailored_experience": [
            {
                "company": "Tech Corp",
                "title": "Software Engineer",
                "tailored_bullets": ["Accomplished leading a team as measured by 20% speed increase, by doing XYZ rewrite."]
            }
        ]
    }
    
    print("Step 1: Merging Tailored Data...")
    tailored_data = _build_tailored_resume_data(original_resume, claude_result)
    
    # Verify merge
    if tailored_data["experience"][0]["bullets"][0].startswith("Accomplished"):
        print("[Audit] PASS: Experience bullets were successfully replaced with XYZ format.")
    else:
        print("[Audit] FAIL: Experience bullets were not replaced.")
        return
        
    print("Step 2: Generating Plain Text Resume...")
    plain_text = _resume_to_plain_text(tailored_data, profile_data={"personal": {"first_name": "John", "last_name": "Doe"}})
    
    # Verify plain text
    if "Accomplished leading a team" in plain_text:
        print("[Audit] PASS: Plain text output contains the tailored XYZ bullets.")
    else:
        print("[Audit] FAIL: Plain text output does not contain the tailored bullets.")
        return
        
    print("--- Auditor Agent: Final Audit Complete. Status: GREEN ---")

if __name__ == "__main__":
    run_audit()
