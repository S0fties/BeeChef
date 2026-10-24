from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import get_db

app = FastAPI(title="BeeChef API")

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