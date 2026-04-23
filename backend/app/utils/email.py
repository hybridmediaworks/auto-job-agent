"""
backend/app/utils/email.py

SMTP email sender for transactional emails (verification, welcome, etc.)

Uses Python's stdlib smtplib via asyncio.run_in_executor so it doesn't
block the FastAPI event loop. Supports Gmail SMTP (port 587 / STARTTLS)
and any compatible SMTP server (Brevo, Mailjet, etc.).

Required env vars:
    SMTP_HOST       e.g. smtp.gmail.com
    SMTP_PORT       e.g. 587
    SMTP_USER       your login email
    SMTP_PASSWORD   Gmail App Password (not account password)
    FROM_EMAIL      sender address (defaults to SMTP_USER)
    FROM_NAME       display name in From header
    FRONTEND_URL    base URL for links in emails
"""

import asyncio
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def _send_smtp_sync(to_email: str, subject: str, html_body: str) -> None:
    """
    Synchronous SMTP send — runs in a thread pool so it doesn't block the event loop.
    Raises on failure so the caller can handle the error.
    """
    from_addr = settings.FROM_EMAIL or settings.SMTP_USER
    if not from_addr or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping email to %s", to_email)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.FROM_NAME} <{from_addr}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(from_addr, to_email, msg.as_string())

    logger.info("Email sent to %s — subject: %s", to_email, subject)


async def send_email(to_email: str, subject: str, html_body: str) -> None:
    """Async wrapper — offloads blocking SMTP call to thread pool."""
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_smtp_sync, to_email, subject, html_body)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)


async def send_verification_email(to_email: str, username: str, token: str) -> None:
    """Send the email-verification link to a newly registered user."""
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #0f1117; color: #e2e8f0; margin: 0; padding: 40px;">
      <div style="max-width: 480px; margin: 0 auto; background: #1a1d2e; border-radius: 16px; padding: 40px; border: 1px solid rgba(125,194,66,0.2);">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #7DC242, #4CAF50); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center;">
            <span style="color: white; font-weight: 900; font-size: 20px;">H</span>
          </div>
          <h1 style="color: white; margin: 12px 0 4px; font-size: 22px;">HYBRID</h1>
          <p style="color: #7DC242; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; margin: 0;">Job Agent</p>
        </div>

        <h2 style="color: white; font-size: 18px; margin-bottom: 8px;">Verify your email address</h2>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          Hi <strong style="color: #e2e8f0;">{username}</strong>, welcome to Hybrid Job Agent!<br>
          Click the button below to verify your email and activate your account.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{verify_url}"
             style="background: linear-gradient(135deg, #7DC242, #4CAF50); color: white; text-decoration: none;
                    padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block;">
            Verify Email Address
          </a>
        </div>

        <p style="color: #64748b; font-size: 12px; line-height: 1.6;">
          This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color: #475569; font-size: 11px; margin-top: 24px; word-break: break-all;">
          Or copy this URL: {verify_url}
        </p>
      </div>
    </body>
    </html>
    """

    await send_email(to_email, "Verify your Hybrid Job Agent account", html)


async def send_password_reset_email(to_email: str, username: str, token: str) -> None:
    """Send a password reset link. Token expires in 1 hour."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #0f1117; color: #e2e8f0; margin: 0; padding: 40px;">
      <div style="max-width: 480px; margin: 0 auto; background: #1a1d2e; border-radius: 16px; padding: 40px; border: 1px solid rgba(125,194,66,0.2);">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #7DC242, #4CAF50); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center;">
            <span style="color: white; font-weight: 900; font-size: 20px;">H</span>
          </div>
          <h1 style="color: white; margin: 12px 0 4px; font-size: 22px;">HYBRID</h1>
          <p style="color: #7DC242; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; margin: 0;">Job Agent</p>
        </div>

        <h2 style="color: white; font-size: 18px; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          Hi <strong style="color: #e2e8f0;">{username}</strong>,<br>
          We received a request to reset your password. Click the button below to choose a new one.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{reset_url}"
             style="background: linear-gradient(135deg, #7DC242, #4CAF50); color: white; text-decoration: none;
                    padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block;">
            Reset Password
          </a>
        </div>

        <p style="color: #64748b; font-size: 12px; line-height: 1.6;">
          This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will not change.
        </p>
        <p style="color: #475569; font-size: 11px; margin-top: 24px; word-break: break-all;">
          Or copy this URL: {reset_url}
        </p>
      </div>
    </body>
    </html>
    """

    await send_email(to_email, "Reset your Hybrid Job Agent password", html)
