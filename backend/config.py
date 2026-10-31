import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "WasteTrace AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "sqlite:///./wastetrace.db"
    
    # Storage
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    
    # External APIs
    GEMINI_API_KEY: Optional[str] = None
    
    # Recurrence & Proximity defaults
    DEFAULT_RECURRENCE_RADIUS_METERS: float = 50.0
    DEFAULT_RECURRENCE_WINDOW_DAYS: int = 14
    DEFAULT_FOLLOW_UP_WINDOW_DAYS: int = 30
    MIN_INCIDENTS_FOR_RECURRENCE: int = 2
    
    # Priority Scoring Weights
    WEIGHT_SEVERITY: float = 0.40
    WEIGHT_RECURRENCE: float = 0.30
    WEIGHT_DURATION: float = 0.20
    WEIGHT_EVIDENCE: float = 0.10
    
    # Environment
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

