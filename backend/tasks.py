from celery import Celery
import os
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

@celery_app.task
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
            segments = ai_pipeline.transcribe_audio_local(audio_path)
        update_job_status(job_id, "processing", 0.6)

        # 3. Translate
        translations = []
        for seg in segments:
            if config.get("trans_mode") == "api":
                trans = ai_pipeline.translate_text_api(seg["text"], config.get("trans_api_key", ""))
            else:
                trans = ai_pipeline.translate_text_local(seg["text"])
            translations.append(trans)
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
