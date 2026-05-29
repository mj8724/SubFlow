from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from database import SessionLocal, engine
import models
from pydantic import BaseModel
from tasks import process_video_task

models.Base.metadata.create_all(bind=engine)
router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class JobResponse(BaseModel):
    id: int
    file_path: str
    status: str
    progress: float

class JobConfig(BaseModel):
    stt_mode: str = "local"
    stt_api_key: str = ""
    trans_mode: str = "local"
    trans_api_key: str = ""

class JobRequest(BaseModel):
    file_path: str
    config: Optional[JobConfig] = None

@router.get("/browse")
def browse_directory(path: str = "/"):
    """Returns a list of files and directories in the given path."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Path not found")
    items = []
    try:
        for entry in os.scandir(path):
            items.append({"name": entry.name, "path": entry.path, "is_dir": entry.is_dir()})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return {"path": path, "items": items}

@router.post("/jobs", response_model=JobResponse)
def create_job(request: JobRequest, db: Session = Depends(get_db)):
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    job = models.TranslationJob(file_path=request.file_path)
    db.add(job)
    db.commit()
    db.refresh(job)
    
    config_dict = request.config.model_dump() if request.config else {}
    process_video_task.delay(job.id, job.file_path, config_dict)
    
    return job

@router.get("/jobs", response_model=List[JobResponse])
def get_jobs(db: Session = Depends(get_db)):
    jobs = db.query(models.TranslationJob).order_by(models.TranslationJob.created_at.desc()).all()
    return jobs

@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.TranslationJob).filter(models.TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
