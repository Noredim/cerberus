from pydantic_settings import BaseSettings
import re
from urllib.parse import quote_plus

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://cerberus_user:cerberus_password@db:5432/cerberus"
    SECRET_KEY: str = "supersecretkeycerberus"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    EMAIL_ENCRYPTION_KEY: str = ""

    def __init__(self, **values):
        super().__init__(**values)
        
        # Derive stable email encryption key if not configured in env
        if not self.EMAIL_ENCRYPTION_KEY:
            import base64
            import hashlib
            key_hash = hashlib.sha256(self.SECRET_KEY.encode()).digest()
            self.EMAIL_ENCRYPTION_KEY = base64.urlsafe_b64encode(key_hash).decode()

        # Sanitize Database URL
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
