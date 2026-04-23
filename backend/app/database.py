"""
Database configuration and session management.

Integrates with existing SQLite database from the CLI application.
"""

import os
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings
from app.models.base import Base


def _resolve_database_url(url: str) -> str:
    """Resolve relative SQLite paths to the project root (one level above backend/)."""
    if url.startswith("sqlite:///./") or url.startswith("sqlite:///database"):
        # Extract the relative path after sqlite:///
        rel_path = url.replace("sqlite:///", "")
        # Resolve relative to project root (parent of backend/)
        project_root = Path(__file__).resolve().parent.parent.parent
        abs_path = project_root / rel_path
        # Ensure the parent directory exists
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{abs_path}"
    return url


# Create SQLAlchemy engine
engine = create_engine(
    _resolve_database_url(settings.DATABASE_URL),
    connect_args={"check_same_thread": False},  # Needed for SQLite
    echo=settings.DEBUG  # Log SQL queries in debug mode
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency for getting database session.

    Usage in FastAPI routes:
        @router.get("/items")
        def get_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Initialize database tables.

    Creates all tables defined in models.
    Should be called on application startup.
    """
    # Import all models here to ensure they are registered with Base.metadata
    from app.models import user, job, setting, profile, tailoring, saved_search, saved_search_run  # noqa: F401
    from app.models.user import User as UserModel

    Base.metadata.create_all(bind=engine)

    # Safe column migrations for existing databases (create_all won't add new columns)
    _safe_migrations = [
        "ALTER TABLE tailored_applications ADD COLUMN template_id INTEGER",
        "ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(64)",
        "ALTER TABLE users ADD COLUMN email_verification_expires DATETIME",
        # User isolation — each table now has an owner
        "ALTER TABLE jobs ADD COLUMN user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE profiles ADD COLUMN user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE saved_searches ADD COLUMN user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE saved_searches ADD COLUMN is_running BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE saved_searches ADD COLUMN last_error TEXT",
        "ALTER TABLE jobs ADD COLUMN saved_search_id INTEGER REFERENCES saved_searches(id)",
        "ALTER TABLE saved_searches ADD COLUMN max_age_days INTEGER",
        # Password reset — token-based flow, 1-hour expiry
        "ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(64)",
        "ALTER TABLE users ADD COLUMN password_reset_expires DATETIME",
        # Role & permissions
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN can_fetch_jobs BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN can_run_saved_search BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN can_create_resume BOOLEAN NOT NULL DEFAULT 0",
    ]
    with engine.connect() as conn:
        for migration in _safe_migrations:
            try:
                conn.execute(text(migration))
                conn.commit()
            except Exception as e:
                msg = str(e).lower()
                # "duplicate column name" is expected for already-applied migrations — safe to ignore.
                # Anything else is a real problem and should be visible in logs.
                if "duplicate column" not in msg and "already exists" not in msg:
                    print(f"[db migration] WARNING: migration failed — {migration}: {e}")

    # Reset stuck distributed-lock flags from any previous crash
    with engine.connect() as conn:
        try:
            conn.execute(text("UPDATE saved_searches SET is_running=0 WHERE is_running=1"))
            conn.commit()
        except Exception:
            pass

    # Grant full permissions to all pre-existing users — runs ONCE only.
    # Guarded by a flag in app_settings so that admins revoking permissions
    # via the UI don't get their changes overwritten on the next server restart.
    with engine.connect() as conn:
        try:
            already_done = conn.execute(
                text("SELECT value FROM app_settings WHERE key='permissions_migration_done'")
            ).fetchone()
            if not already_done:
                conn.execute(text(
                    "UPDATE users SET can_fetch_jobs=1, can_run_saved_search=1, can_create_resume=1 "
                    "WHERE email_verified=1 AND can_fetch_jobs=0 AND can_run_saved_search=0 AND can_create_resume=0"
                ))
                conn.execute(text(
                    "INSERT INTO app_settings (key, value, description) VALUES "
                    "('permissions_migration_done', '1', 'One-time flag: existing users granted full permissions')"
                ))
            # Always ensure the admin user has is_admin=True
            conn.execute(text("UPDATE users SET is_admin=1 WHERE username='administrator'"))
            conn.commit()
        except Exception:
            pass

    # Assign all existing unowned data to the admin user (id=1) so nothing is lost
    with engine.connect() as conn:
        for table in ("jobs", "profiles", "saved_searches"):
            try:
                conn.execute(text(f"UPDATE {table} SET user_id = 1 WHERE user_id IS NULL"))
                conn.commit()
            except Exception:
                pass

    # Auto-seed default users if users table is empty
    db = SessionLocal()
    try:
        if db.query(UserModel).count() == 0:
            from app.utils.auth import get_password_hash
            db.add_all([
                UserModel(
                    username="administrator",
                    email="admin@auto-job-agent.com",
                    password_hash=get_password_hash("systemadmin123!"),
                    is_active=True,
                    email_verified=True,
                    is_admin=True,
                    can_fetch_jobs=True,
                    can_run_saved_search=True,
                    can_create_resume=True,
                ),
                UserModel(
                    username="Mirza Waleed",
                    email="mirzawaleed@auto-job-agent.com",
                    password_hash=get_password_hash("Mirzawaleed123"),
                    is_active=True,
                    email_verified=True,
                    is_admin=False,
                    can_fetch_jobs=True,
                    can_run_saved_search=True,
                    can_create_resume=True,
                ),
            ])
            db.commit()
        else:
            # Mark pre-existing users as email_verified so they aren't locked out after migration
            db.execute(
                text("UPDATE users SET email_verified = 1 WHERE email_verified = 0 AND email_verification_token IS NULL")
            )
            db.commit()
    finally:
        db.close()
