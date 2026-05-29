from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Body
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
    stt_model: str = "tiny"
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

@router.get("/select_folder")
def select_folder():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        folder_path = filedialog.askdirectory()
        root.destroy()
        return {"path": folder_path}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Native folder selection is not supported in this environment.")

@router.post("/jobs", response_model=JobResponse)
def create_job(request: JobRequest, db: Session = Depends(get_db)):
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    job = models.TranslationJob(file_path=request.file_path)
    db.add(job)
    db.commit()
    db.refresh(job)
    
    config_dict = request.config.model_dump() if request.config else {}
    task = process_video_task.delay(job.id, job.file_path, config_dict)
    
    # Save celery task id for cancellation
    job.celery_task_id = task.id
    db.commit()
    
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

@router.delete("/jobs")
def clear_jobs(db: Session = Depends(get_db)):
    try:
        from celery.app.control import Control
        from tasks import celery_app
        control = Control(celery_app)
        
        # Revoke all running/pending celery tasks
        jobs = db.query(models.TranslationJob).all()
        for job in jobs:
            if job.celery_task_id and job.status in ('pending', 'processing', 'downloading_model'):
                control.revoke(job.celery_task_id, terminate=True)
        
        # Also purge any queued tasks
        celery_app.control.purge()
        
        db.query(models.TranslationJob).delete()
        db.commit()
        return {"status": "success", "message": "All jobs cleared and tasks cancelled"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}/logs")
def get_job_logs(job_id: int):
    log_path = os.path.join("logs", f"job_{job_id}.log")
    if not os.path.exists(log_path):
        return {"logs": "Waiting for logs..."}
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"logs": content}
    except Exception as e:
        return {"logs": f"Error reading logs: {str(e)}"}

def get_huggingface_cache_dir():
    try:
        from huggingface_hub.constants import HUGGINGFACE_HUB_CACHE
        return HUGGINGFACE_HUB_CACHE
    except ImportError:
        return os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub")

@router.get("/models")
def list_models():
    cache_dir = get_huggingface_cache_dir()
    downloaded = []
    if os.path.exists(cache_dir):
        for d in os.listdir(cache_dir):
            if d.startswith("models--Systran--faster-whisper-"):
                model_name = d.replace("models--Systran--faster-whisper-", "")
                snapshots_dir = os.path.join(cache_dir, d, "snapshots")
                
                if os.path.exists(snapshots_dir):
                    is_complete = False
                    for snapshot_hash in os.listdir(snapshots_dir):
                        snap_path = os.path.join(snapshots_dir, snapshot_hash)
                        if os.path.isdir(snap_path):
                            files = os.listdir(snap_path)
                            if "model.bin" in files or "model.safetensors" in files:
                                is_complete = True
                                break
                    if is_complete:
                        downloaded.append(model_name)
    return downloaded

@router.delete("/models/{model_name}")
def delete_model(model_name: str):
    import shutil
    import stat
    import time

    def remove_readonly(func, path, excinfo):
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass

    cache_dir = get_huggingface_cache_dir()
    target_dir = os.path.join(cache_dir, f"models--Systran--faster-whisper-{model_name}")
    
    if os.path.exists(target_dir):
        try:
            shutil.rmtree(target_dir, onerror=remove_readonly)
        except Exception:
            # Fallback for Windows
            try:
                import subprocess
                subprocess.run(['cmd', '/c', 'rmdir', '/s', '/q', target_dir], capture_output=True)
            except Exception:
                pass
            
        if model_name in download_progress:
            del download_progress[model_name]
            
        return {"status": "deleted"}
    return {"status": "not_found"}

download_progress = {}

import time
import tqdm.auto
_orig_tqdm = tqdm.auto.tqdm

class APIDownloadTrackingTqdm(_orig_tqdm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._last_time = time.time()
        self._last_n = getattr(self, 'n', 0)

    def update(self, n=1):
        if n is None:
            n = 1
        super().update(n)
        if getattr(self, 'disable', False):
            self.n += n
            
        now = time.time()
        if now - self._last_time > 0.5:
            api_cb = getattr(tqdm, 'api_progress_callback', None)
            total = getattr(self, 'total', None)
            if api_cb and total:
                pct = self.n / total
                speed = (self.n - self._last_n) / (now - self._last_time)
                speed_mb = speed / (1024 * 1024)
                api_cb(pct * 100, f"{speed_mb:.1f} MB/s")
            self._last_time = now
            self._last_n = self.n

tqdm.auto.tqdm = APIDownloadTrackingTqdm
tqdm.tqdm = APIDownloadTrackingTqdm

try:
    import huggingface_hub.utils._tqdm as hf_tqdm
    hf_tqdm.tqdm = APIDownloadTrackingTqdm
except ImportError:
    pass

try:
    import huggingface_hub.file_download as hf_download
    hf_download.tqdm = APIDownloadTrackingTqdm
except ImportError:
    pass

def download_task(model_name: str):
    from faster_whisper import download_model
    
    def progress_cb(pct, speed):
        download_progress[model_name] = {
            "speed": speed,
            "pct": pct,
            "error": None
        }
    
    tqdm.api_progress_callback = progress_cb
    
    try:
        download_model(model_name)
        # Download completed successfully, clean up progress
        if model_name in download_progress:
            del download_progress[model_name]
    except Exception as e:
        print(f"Error downloading model {model_name}: {e}")
        download_progress[model_name] = {
            "speed": "0 MB/s",
            "pct": 0,
            "error": str(e)
        }
    finally:
        tqdm.api_progress_callback = None

@router.post("/models/download")
def trigger_download(background_tasks: BackgroundTasks, model_name: str = Body(..., embed=True)):
    # If the model is not fully downloaded according to our strict check, delete its corrupted cache first
    downloaded_models = list_models()
    if model_name not in downloaded_models:
        try:
            delete_model(model_name)
        except Exception:
            pass
            
    # Clear any previous error for this model
    if model_name in download_progress:
        del download_progress[model_name]
    
    # Initialize state so UI sees downloading immediately
    download_progress[model_name] = {"speed": "0 MB/s", "pct": 0, "error": None}
    background_tasks.add_task(download_task, model_name)
    return {"status": "downloading"}

@router.get("/models/download_status")
def get_download_status():
    return download_progress

