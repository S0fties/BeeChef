from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.api.routes import auth, media, inventory, items
from app.db.seed import seed_items_catalog
from app.db.session import SessionLocal, get_db

from fastapi.staticfiles import StaticFiles
from app.core.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        seed_items_catalog(db)
    except Exception as exc:
        logger.warning("Skipping automatic catalog seeding on startup: %s", exc)
    finally:
        db.close()
    yield


app = FastAPI(title="BeeChef API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],  # needed for the Authorization header
)
# Mount static uploads directory
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(items.router)
app.include_router(inventory.router)
app.include_router(media.router)

# FastAPI returns 422 by default; the acceptance criteria want 400 for invalid input.
@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400, content={"detail": jsonable_encoder(exc.errors())}
    )

@app.get("/")
def read_root():
    return {"message": "BeeChef Backend API System!"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/health/db")
def health_check_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection error: {str(e)}"
        )
