from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from database import Base

class TranslationJob(Base):
    __tablename__ = "translation_jobs"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, index=True)
    status = Column(String, default="pending") # pending, processing, completed, failed
    progress = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    error_message = Column(String, nullable=True)
