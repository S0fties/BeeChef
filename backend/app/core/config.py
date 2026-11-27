from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str
    TEST_DATABASE_URL: str | None = None

    # --- SECURITY ---
    SECRET_KEY: str 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int 

     # --- STORAGE & UPLOAD ---
    UPLOAD_DIR: Path = Path(__file__).resolve().parent.parent.parent / "uploads"
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png", "image/webp"]

    # --- RECEIPT SCANNING (UC-13) ---
    GEMINI_API_KEY: str | None = None
    # Free-tier Gemini model. Use "gemini-3.8-flash" for better accuracy (lower daily quota).
    RECEIPT_MODEL: str = "gemini-3.5-flash-lite"
    RECEIPT_MAX_CANDIDATES: int = 60
    # Receipt photos live in uploads/receipts/<household_id>/ only while a scan is in progress;
    # they are deleted when the flow ends, or after RECEIPT_TTL_MINUTES if it is abandoned.
    RECEIPT_TTL_MINUTES: int = 60

    @property
    def RECEIPT_DIR(self) -> Path:
        return self.UPLOAD_DIR / "receipts"

    model_config = SettingsConfigDict(
        env_file=(".env"),
        extra="ignore",
    )


settings = Settings()