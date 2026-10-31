from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.api.routes import auth
from app.db.session import get_db

app = FastAPI(title="BeeChef API")

app.include_router(auth.router)

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