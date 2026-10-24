from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str

    model_config = SettingsConfigDict(
        env_file=(".env.example", ".env"), 
        extra="ignore"
    )


settings = Settings()