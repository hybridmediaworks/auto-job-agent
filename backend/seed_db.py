"""
backend/seed_db.py

Database seeding script for initial setup.

Creates:
- Default admin user (username: admin, password from ADMIN_PASSWORD env var or auto-generated)

Run this after first database initialization:
    python backend/seed_db.py
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.utils.auth import get_password_hash


def seed_admin_user(db):
    """Create default admin user if not exists"""
    existing_admin = db.query(User).filter(User.username == "admin").first()

    if existing_admin:
        print("[OK] Admin user already exists")
        return

    import os, secrets
    admin_pw = os.environ.get("ADMIN_PASSWORD") or secrets.token_urlsafe(16)
    if not os.environ.get("ADMIN_PASSWORD"):
        print(f"  [INFO] Auto-generated admin password: {admin_pw}")
        print("  [INFO] Set ADMIN_PASSWORD in .env to use a fixed password.")

    admin = User(
        username="admin",
        email="admin@localhost",
        password_hash=get_password_hash(admin_pw),
        is_active=True,
        email_verified=True,
    )

    db.add(admin)
    db.commit()
    print("[OK] Created admin user (username: admin)")


def main():
    """Main seeding function"""
    print("=" * 60)
    print("Auto Job Agent - Database Seeding")
    print("=" * 60)

    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    print("[OK] Database tables ready\n")

    # Create database session
    db = SessionLocal()

    try:
        # Seed admin user
        print("Seeding admin user...")
        seed_admin_user(db)
        print()

        print("=" * 60)
        print("[OK] Database seeding completed successfully!")
        print("=" * 60)
        print("\nYou can now:")
        print("1. Start the backend: uvicorn app.main:app --reload")
        print("2. Login with: username=admin, password=<printed above or ADMIN_PASSWORD env>")
        print("3. Access API docs: http://localhost:8000/docs")
        print()

    except Exception as e:
        print(f"\n[ERROR] Error during seeding: {e}")
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
