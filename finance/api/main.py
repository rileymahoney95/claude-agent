"""Finance API - FastAPI backend wrapping CLI modules."""

import logging
import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add CLI path to sys.path for imports
cli_path = Path(__file__).parent.parent / "cli"
sys.path.insert(0, str(cli_path))

from config import USE_DATABASE
from database import check_db_connection, get_table_counts

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("finance-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    if USE_DATABASE:
        logger.info("Database mode enabled (FINANCE_USE_DATABASE=true)")
        status = check_db_connection()
        if status["connected"]:
            logger.info(f"✓ Database connected: {status['version']}")
            logger.info(f"  Tables: {', '.join(status['tables']) or 'none'}")
            try:
                counts = get_table_counts()
                logger.info(f"  Records: {counts}")
            except Exception:
                logger.info("  Records: (tables not initialized)")
        else:
            logger.warning(f"✗ Database connection failed: {status.get('error', 'unknown')}")
            logger.warning("  API will fall back to JSON file storage")
    else:
        logger.info("Database mode disabled (using JSON file storage)")
    
    yield


app = FastAPI(
    title="Finance API",
    description="REST API for personal finance management",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from routes import portfolio, holdings, profile, advice, statements

app.include_router(portfolio.router, prefix="/api/v1")
app.include_router(holdings.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(advice.router, prefix="/api/v1")
app.include_router(statements.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    response = {"status": "ok", "database_mode": USE_DATABASE}
    if USE_DATABASE:
        db_status = check_db_connection()
        response["database"] = {
            "connected": db_status["connected"],
            "version": db_status.get("version"),
        }
        if not db_status["connected"]:
            response["status"] = "degraded"
    return response
