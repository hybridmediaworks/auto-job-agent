"""
backend/app/services/slack_service.py

Slack webhook notification sender.
Uses SLACK_WEBHOOK_URL stored in AppSettings (Settings page).
"""

import httpx


async def send_slack_notification(webhook_url: str, saved_search_name: str, new_jobs: list) -> bool:
    """
    Send a Slack notification with new jobs found.

    Args:
        webhook_url:        Slack incoming webhook URL
        saved_search_name:  Name of the saved search that ran
        new_jobs:           List of Job ORM objects that were newly added

    Returns:
        True if notification sent successfully, False otherwise.
    """
    if not webhook_url or not new_jobs:
        return False

    count = len(new_jobs)
    header = f"*{count} new job{'s' if count != 1 else ''} found* for search: _{saved_search_name}_"

    job_lines = []
    for job in new_jobs[:10]:   # cap at 10 entries in notification
        title   = job.title or "Unknown Title"
        company = job.company or "Unknown Company"
        url     = job.url or ""
        if url:
            job_lines.append(f"• <{url}|{title}> — {company}")
        else:
            job_lines.append(f"• {title} — {company}")

    if count > 10:
        job_lines.append(f"_...and {count - 10} more_")

    body = "\n".join(job_lines)

    payload = {
        "text": header,
        "blocks": [
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": header},
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": body},
            },
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            return resp.status_code == 200
    except Exception as exc:
        print(f"[slack] Failed to send notification: {exc}")
        return False
