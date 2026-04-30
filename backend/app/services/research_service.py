import anthropic

_HAIKU_MODEL = "claude-haiku-4-5"

_RESEARCH_SYSTEM = (
    "You are an industry research assistant. Search Reddit, Stack Overflow, and Quora "
    "to find what practitioners in a given role actually build, common tech stack pitfalls, "
    "and community-recommended solutions. Synthesize your findings into a concise "
    "'Industry Insight' block of 150-200 words."
)

_USER_PROMPT = """\
Research community knowledge about the following job role:

**Job Title:** {job_title}

Search Reddit, Stack Overflow, and Quora for:
1. What people actually build day-to-day in a "{job_title}" role
2. Common tech stack pitfalls encountered in this role
3. Community-recommended solutions and best practices

Synthesize your findings into a concise Industry Insight block (150-200 words).\
"""


def research_job_role(job_title: str, anthropic_api_key: str) -> str:
    """
    Fetch community insights for a job role via web search + Claude-Haiku summarization.
    Returns a 150-200 word Industry Insight block, or a fallback string on failure.
    """
    client = anthropic.Anthropic(api_key=anthropic_api_key)

    response = client.messages.create(
        model=_HAIKU_MODEL,
        max_tokens=1024,
        system=_RESEARCH_SYSTEM,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        messages=[{"role": "user", "content": _USER_PROMPT.format(job_title=job_title)}],
    )

    text_parts = [block.text.strip() for block in response.content if block.type == "text"]
    return "\n\n".join(text_parts) if text_parts else "No research insights available."
