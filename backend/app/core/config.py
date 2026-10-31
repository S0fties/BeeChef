from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    TEST_DATABASE_URL: str | None = None

    # --- SECURITY ---
    SECRET_KEY: str 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int 

    model_config = SettingsConfigDict(
        env_file=(".env"),
        extra="ignore",
    )


settings = Settings()