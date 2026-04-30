import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture(autouse=True)
def reset_research_module():
    """Ensure research_service is re-imported fresh in each test."""
    import sys
    sys.modules.pop("app.services.research_service", None)
    yield
    sys.modules.pop("app.services.research_service", None)


def _make_text_response(text: str):
    block = MagicMock()
    block.type = "text"
    block.text = text
    response = MagicMock()
    response.content = [block]
    response.stop_reason = "end_turn"
    return response


def test_research_job_role_returns_insight_text():
    """Happy path: returns the text content from Claude's response."""
    expected = "Senior Software Engineers typically build distributed systems..."
    mock_response = _make_text_response(expected)

    with patch("app.services.research_service.anthropic.Anthropic") as mock_cls:
        mock_cls.return_value.messages.create.return_value = mock_response
        from app.services.research_service import research_job_role

        result = research_job_role("Senior Software Engineer", "fake-api-key")

    assert result == expected


def test_research_job_role_uses_haiku_model():
    """Service must use Claude-Haiku (not Sonnet) for cost efficiency."""
    mock_response = _make_text_response("insight")

    with patch("app.services.research_service.anthropic.Anthropic") as mock_cls:
        mock_client = mock_cls.return_value
        mock_client.messages.create.return_value = mock_response
        from app.services.research_service import research_job_role, _HAIKU_MODEL

        research_job_role("Data Scientist", "fake-key")

        call_kwargs = mock_client.messages.create.call_args[1]
        assert call_kwargs["model"] == _HAIKU_MODEL


def test_research_job_role_includes_web_search_tool():
    """Service must include the web_search_20250305 built-in tool."""
    mock_response = _make_text_response("insight")

    with patch("app.services.research_service.anthropic.Anthropic") as mock_cls:
        mock_client = mock_cls.return_value
        mock_client.messages.create.return_value = mock_response
        from app.services.research_service import research_job_role

        research_job_role("Backend Engineer", "fake-key")

        call_kwargs = mock_client.messages.create.call_args[1]
        tool_types = [t.get("type") for t in call_kwargs["tools"]]
        assert "web_search_20250305" in tool_types


def test_research_job_role_includes_title_in_prompt():
    """Job title must appear in the user message sent to Claude."""
    mock_response = _make_text_response("insight")

    with patch("app.services.research_service.anthropic.Anthropic") as mock_cls:
        mock_client = mock_cls.return_value
        mock_client.messages.create.return_value = mock_response
        from app.services.research_service import research_job_role

        research_job_role("Machine Learning Engineer", "fake-key")

        call_kwargs = mock_client.messages.create.call_args[1]
        user_content = call_kwargs["messages"][0]["content"]
        assert "Machine Learning Engineer" in user_content


def test_research_job_role_handles_no_text_blocks():
    """Returns fallback string when response contains no text blocks."""
    tool_block = MagicMock()
    tool_block.type = "tool_use"
    mock_response = MagicMock()
    mock_response.content = [tool_block]

    with patch("app.services.research_service.anthropic.Anthropic") as mock_cls:
        mock_cls.return_value.messages.create.return_value = mock_response
        from app.services.research_service import research_job_role

        result = research_job_role("DevOps Engineer", "fake-key")

    assert result == "No research insights available."


def test_research_job_role_concatenates_multiple_text_blocks():
    """Multiple text blocks in the response are joined with newlines."""
    block1 = MagicMock(); block1.type = "text"; block1.text = "Part one."
    block2 = MagicMock(); block2.type = "tool_use"
    block3 = MagicMock(); block3.type = "text"; block3.text = "Part two."
    mock_response = MagicMock()
    mock_response.content = [block1, block2, block3]

    with patch("app.services.research_service.anthropic.Anthropic") as mock_cls:
        mock_cls.return_value.messages.create.return_value = mock_response
        from app.services.research_service import research_job_role

        result = research_job_role("Platform Engineer", "fake-key")

    assert "Part one." in result
    assert "Part two." in result
