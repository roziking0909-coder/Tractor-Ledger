"""
Tractor Ledger - FastAPI Application Entry Point
A mobile backend for tractor owners in rural India to track
work entries, payments, and farmer ledgers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routes.auth import router as auth_router
from routes.farmers import router as farmers_router
from routes.farms import router as farms_router
from routes.work_entries import router as work_entries_router
from routes.payments import router as payments_router
from routes.dashboard import router as dashboard_router
from routes.reports import router as reports_router
from routes.expenses import router as expenses_router
from routes.subscription import router as subscription_router
from routes.admin import router as admin_router
from services.sync import router as sync_router



def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "Backend API for Tractor Ledger — a mobile app for tractor owners "
            "in rural India to manage farmer work entries, payments, and ledgers."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ---- CORS Middleware ----
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---- Register Routers ----
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(farmers_router, prefix="/api/v1")
    app.include_router(farms_router, prefix="/api/v1")
    app.include_router(work_entries_router, prefix="/api/v1")
    app.include_router(payments_router, prefix="/api/v1")
    app.include_router(dashboard_router, prefix="/api/v1")
    app.include_router(reports_router, prefix="/api/v1")
    app.include_router(expenses_router, prefix="/api/v1")
    app.include_router(subscription_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(sync_router, prefix="/api/v1")

    # ---- Health Check ----
    @app.get("/health", tags=["Health"])
    async def health_check():
        return {
            "status": "healthy",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
        }

    @app.get("/", tags=["Health"])
    async def root():
        return {
            "message": f"Welcome to {settings.APP_NAME}",
            "version": settings.APP_VERSION,
            "docs": "/docs",
        }

    return app


# Create the app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
