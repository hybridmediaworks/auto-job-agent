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
    # Mocking profile_data for the test
    profile_data = {"personal": {"first_name": "Test", "last_name": "User"}}
    text = _resume_to_plain_text(data, profile_data=profile_data)
    assert "XYZ Bullet" in text
