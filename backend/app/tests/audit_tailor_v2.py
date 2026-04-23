import json
from app.services.tailor_service import _build_tailored_resume_data, _resume_to_plain_text

def run_audit_v2():
    print("--- Auditor Agent: Starting Integration Audit V2 (Tech-Anchoring) ---")
    
    # Original resume with generic bullets but Ruby in skills
    original_resume = {
        "name": "John Doe",
        "experience": [
            {
                "company": "Tech Corp",
                "title": "Software Engineer",
                "start_date": "2020",
                "end_date": "Present",
                "bullets": ["Built a web application for internal users."]
            }
        ],
        "skills": {"languages": ["Ruby", "JavaScript"], "frameworks": ["Rails", "Sinatra"]}
    }
    
    # Mocked Claude result showing the "Anchor Rule" in action
    claude_result = {
        "summary": "Expert Ruby developer.",
        "role_title": "Senior Ruby Engineer",
        "role_description": "Will lead Ruby development.",
        "skills_bullets": ["Ruby, Sinatra, RSpec"],
        "tailored_experience": [
            {
                "company": "Tech Corp",
                "title": "Software Engineer",
                "tailored_bullets": [
                    "Accomplished building a high-performance web application using Ruby, Sinatra, and RSpec, resulting in a 30% reduction in response time."
                ]
            }
        ]
    }
    
    print("Step 1: Verging Data with Anchored Technologies...")
    tailored_data = _build_tailored_resume_data(original_resume, claude_result)
    
    # Verify tech anchoring
    bullet = tailored_data["experience"][0]["bullets"][0]
    required_tech = ["Ruby", "Sinatra", "RSpec"]
    missing = [tech for tech in required_tech if tech not in bullet]
    
    if not missing:
        print(f"[Audit] PASS: Experience bullet successfully anchored technologies: {required_tech}")
    else:
        print(f"[Audit] FAIL: Missing technologies in bullet: {missing}")
        return

    print("Step 2: Checking Plain Text Formatting...")
    plain_text = _resume_to_plain_text(tailored_data, profile_data={"personal": {"first_name": "John", "last_name": "Doe"}})
    if "Ruby, Sinatra, and RSpec" in plain_text:
        print("[Audit] PASS: Plain text output correctly displays anchored tech.")
    else:
        print("[Audit] FAIL: Plain text missing anchored tech.")
        return
        
    print("--- Auditor Agent: Audit V2 Complete. Status: GREEN ---")

if __name__ == "__main__":
    run_audit_v2()
