from celery import Celery
import os
import time
import tqdm

import ai_pipeline
from database import SessionLocal
import models

celery_app = Celery(
    "tasks",
    broker=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
)

def update_job_status(job_id, status, progress, error=None):
    db = SessionLocal()
    job = db.query(models.TranslationJob).filter(models.TranslationJob.id == job_id).first()
    if job:
        job.status = status
        job.progress = progress
        if error:
            job.error_message = error
        db.commit()
    db.close()

# 2. Monkey-patch tqdm to capture download progress and speed
import tqdm.auto
_orig_tqdm = tqdm.auto.tqdm

class DownloadTrackingTqdm(_orig_tqdm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._last_db_time = time.time()
        self._last_n = 0

    def update(self, n=1):
        super().update(n)
        now = time.time()
        if now - self._last_db_time > 0.5:
            # check if we have a current_job_id in celery task
            job_id = getattr(tqdm, 'current_job_id', None)
            if job_id and hasattr(self, 'total') and self.total:
                pct = self.n / self.total
                speed = (self.n - self._last_n) / (now - self._last_db_time)
                speed_mb = speed / (1024 * 1024)
                status_text = f"downloading_model|{pct*100:.1f}%|{speed_mb:.1f} MB/s"
                update_job_status(job_id, status_text, 0.3 + (pct * 0.1))
                
            api_cb = getattr(tqdm, 'api_progress_callback', None)
            if api_cb and hasattr(self, 'total') and self.total:
                pct = self.n / self.total
                speed = (self.n - self._last_n) / (now - self._last_db_time)
                speed_mb = speed / (1024 * 1024)
                api_cb(pct * 100, f"{speed_mb:.1f} MB/s")
                
            self._last_db_time = now
            self._last_n = self.n

tqdm.auto.tqdm = DownloadTrackingTqdm
tqdm.tqdm = DownloadTrackingTqdm

import sys
import contextlib
import functools

def task_logger(func):
    @functools.wraps(func)
    def wrapper(job_id, *args, **kwargs):
        log_dir = "logs"
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, f"job_{job_id}.log")
        
        class DualWriter:
            def __init__(self, orig_stream, file_obj):
                self.orig_stream = orig_stream
                self.file_obj = file_obj
                
            def write(self, msg):
                self.orig_stream.write(msg)
                self.file_obj.write(msg)
                self.file_obj.flush()
                
            def flush(self):
                self.orig_stream.flush()
                self.file_obj.flush()
                
        with open(log_path, 'w', encoding='utf-8') as f:
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            sys.stdout = DualWriter(sys.stdout, f)
            sys.stderr = DualWriter(sys.stderr, f)
            try:
                return func(job_id, *args, **kwargs)
            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr
    return wrapper

@celery_app.task
@task_logger
def process_video_task(job_id: int, file_path: str, config: dict):
    try:
        update_job_status(job_id, "processing", 0.1)
        base_path = os.path.splitext(file_path)[0]
        audio_path = base_path + ".mp3"
        srt_path = base_path + ".srt"

        # 1. Extract Audio
        print(f"Extracting audio for {file_path}")
        ai_pipeline.extract_audio(file_path, audio_path)
        update_job_status(job_id, "processing", 0.3)

        # 2. STT
        if config.get("stt_mode") == "api":
            segments = ai_pipeline.transcribe_audio_api(audio_path, config.get("stt_api_key", ""))
        else:
            model_name = config.get("stt_model", "tiny")
            import tqdm
            tqdm.current_job_id = job_id
            from faster_whisper import download_model
            download_model(model_name)
            tqdm.current_job_id = None
            update_job_status(job_id, "processing", 0.4)
            segments = ai_pipeline.transcribe_audio_local(audio_path, model_name)
        update_job_status(job_id, "processing", 0.6)

        # 3. Translate
        if config.get("trans_mode") == "api":
            translations = []
            for seg in segments:
                trans = ai_pipeline.translate_text_api(seg["text"], config.get("trans_api_key", ""))
                translations.append(trans)
        else:
            texts = [seg["text"] for seg in segments]
            import tqdm
            tqdm.current_job_id = job_id
            translations = ai_pipeline.translate_texts_local(texts)
            tqdm.current_job_id = None
            
        update_job_status(job_id, "processing", 0.9)

        # 4. SRT
        ai_pipeline.generate_srt(segments, translations, srt_path)
        update_job_status(job_id, "completed", 1.0)
        
        # Cleanup audio
        if os.path.exists(audio_path):
            os.remove(audio_path)

        return {"status": "completed", "job_id": job_id, "srt_path": srt_path}
    except Exception as e:
        print(f"Error processing job {job_id}: {e}")
        update_job_status(job_id, "failed", 0.0, str(e))
        return {"status": "failed", "job_id": job_id, "error": str(e)}
