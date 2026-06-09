"""
Database configuration and session management.

Integrates with existing SQLite database from the CLI application.
"""

import os
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine, event, text
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
    connect_args={"check_same_thread": False, "timeout": 30},  # Needed for SQLite
    echo=settings.DEBUG  # Log SQL queries in debug mode
)

# SQLite does NOT enforce foreign keys unless PRAGMA foreign_keys=ON is issued on
# EVERY connection. Without it, the ON DELETE CASCADE / SET NULL clauses on our
# tables never fire and deletes silently orphan child rows (e.g. tailored_applications
# left behind after a job is deleted). Register a connect-time listener so the pragma
# is applied to every pooled connection (including APScheduler's job store).
if engine.dialect.name == "sqlite":
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# Enable WAL mode for better concurrent read/write performance on live
with engine.connect() as conn:
    conn.execute(text("PRAGMA journal_mode=WAL"))
    conn.execute(text("PRAGMA synchronous=NORMAL"))
    conn.commit()

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

    # De-duplicate tailored_applications, then enforce one row per (job_id, profile_id).
    # The table historically had no unique constraint, so duplicate generations could
    # accumulate. Keep the most recent row (highest id) for each pair, then add a unique
    # index — the SQLite-friendly way to apply uniqueness to an existing table.
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "DELETE FROM tailored_applications WHERE id NOT IN "
                "(SELECT MAX(id) FROM tailored_applications GROUP BY job_id, profile_id)"
            ))
            # Only add the unique index if the pair isn't already enforced. A fresh DB
            # built from the model already has an auto-index for the UniqueConstraint,
            # so creating another would be redundant (doubled write cost). The live DB
            # has none, so this creates exactly one.
            already_unique = False
            for idx in conn.execute(text("PRAGMA index_list('tailored_applications')")).fetchall():
                if idx[2] != 1:  # column 2 = "unique" flag
                    continue
                cols = [r[2] for r in conn.execute(text(f"PRAGMA index_info('{idx[1]}')")).fetchall()]
                if cols == ["job_id", "profile_id"]:
                    already_unique = True
                    break
            if not already_unique:
                conn.execute(text(
                    "CREATE UNIQUE INDEX uq_tailored_job_profile "
                    "ON tailored_applications (job_id, profile_id)"
                ))
            conn.commit()
        except Exception as e:
            print(f"[db migration] WARNING: tailored_applications dedup/unique index failed: {e}")

    # Reset stuck distributed-lock flags from any previous crash
    with engine.connect() as conn:
        try:
            conn.execute(text("UPDATE saved_searches SET is_running=0 WHERE is_running=1"))
            conn.commit()
        except Exception:
            pass

    # Always ensure the admin user has is_admin=True
    with engine.connect() as conn:
        try:
            conn.execute(text("UPDATE users SET is_admin=1 WHERE username='admin'"))
            conn.commit()
        except Exception:
            pass

    # Assign all existing unowned data to the admin user (id=1) so nothing is lost
    with engine.connect() as conn:
        for table in ("jobs", "profiles", "saved_searches"):
            try:
                # Resolve admin id dynamically if id=1 is taken by someone else
                admin_id = conn.execute(text("SELECT id FROM users WHERE username='admin'")).scalar() or 1
                conn.execute(text(f"UPDATE {table} SET user_id = :uid WHERE user_id IS NULL"), {"uid": admin_id})
                conn.commit()
            except Exception:
                pass

    # Auto-seed default users if users table is empty
    db = SessionLocal()
    try:
        if not db.query(UserModel).filter(UserModel.username == "admin").first():
            from app.utils.auth import get_password_hash
            db.add_all([
                UserModel(
                    username="admin",
                    email="admin@auto-job-agent.com",
                    password_hash=get_password_hash("admin123"),
                    is_active=True,
                    email_verified=True,
                    is_admin=True,
                    can_fetch_jobs=True,
                    can_run_saved_search=True,
                    can_create_resume=True,
                ),
            ])
            db.commit()
    finally:
        db.close()
