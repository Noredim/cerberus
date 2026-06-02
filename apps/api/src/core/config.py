from pydantic_settings import BaseSettings
import re
from urllib.parse import quote_plus

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://cerberus_user:cerberus_password@db:5432/cerberus"
    SECRET_KEY: str = "supersecretkeycerberus"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    def __init__(self, **values):
        super().__init__(**values)
        url = self.DATABASE_URL
        if url and url.startswith("postgres"):
            scheme = ""
            if "://" in url:
                scheme, rest = url.split("://", 1)
            else:
                scheme, rest = "postgresql", url

            if "@" in rest:
                parts = rest.rsplit("@", 1)
                user_pass = parts[0]
                host_db = parts[1]
                if ":" in user_pass:
                    user, pwd = user_pass.split(":", 1)
                    if "%" not in pwd or not re.match(r'%[0-9a-fA-F]{2}', pwd):
                        pwd = quote_plus(pwd)
                    self.DATABASE_URL = f"{scheme}://{user}:{pwd}@{host_db}"

settings = Settings()
