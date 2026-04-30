"""
backend/app/main.py

FastAPI application entry point for Auto Job Agent Web UI.

Provides REST API for:
  - Multi-provider job fetching (Indeed, Glassdoor, ZipRecruiter)
  - Job management and filtering
  - Resume and profile management
  - Configuration management
  - Authentication
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.database import init_db
from app.routers import auth, jobs, providers, stats
from app.routers import settings as settings_router
from app.routers import profiles as profiles_router
from app.routers import tailor as tailor_router
from app.routers.tailor import applications_router, manual_router
from app.routers import saved_searches as saved_searches_router
from app.routers import admin as admin_router
from app.services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handle application lifespan events (startup and shutdown).
    """
    # Startup logic
    init_db()
    start_scheduler()
    yield
    # Shutdown logic
    stop_scheduler()


# Rate limiter — keyed by client IP, in-memory storage (no Redis required)
# Limits are applied per-endpoint via @limiter.limit() decorator in routers
limiter = Limiter(key_func=get_remote_address)

# Initialize FastAPI application
app = FastAPI(
    title="Auto Job Agent API",
    description="REST API for automated job application management",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Attach limiter to app state so routers can access it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(providers.router)
app.include_router(stats.router)
app.include_router(settings_router.router)
app.include_router(profiles_router.router)
app.include_router(tailor_router.router)
app.include_router(manual_router)
app.include_router(applications_router)
app.include_router(saved_searches_router.router)
app.include_router(admin_router.router)


@app.get("/")
async def root():
    """Root endpoint - API health check"""
    return {
        "message": "Auto Job Agent API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
