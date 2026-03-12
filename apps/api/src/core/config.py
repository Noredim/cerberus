from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://cerberus_user:cerberus_password@db:5432/cerberus"
    SECRET_KEY: str = "supersecretkeycerberus"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

settings = Settings()
