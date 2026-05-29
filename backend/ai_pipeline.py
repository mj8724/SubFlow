import subprocess
import os
import math
import requests

def extract_audio(video_path: str, output_path: str):
    """Extract audio from video using ffmpeg."""
    command = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn", "-acodec", "libmp3lame", "-q:a", "2",
        output_path
    ]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return output_path

def format_timestamp(seconds: float):
    hours = math.floor(seconds / 3600)
    seconds -= hours * 3600
    minutes = math.floor(seconds / 60)
    seconds -= minutes * 60
    millis = round((seconds - math.floor(seconds)) * 1000)
    seconds = math.floor(seconds)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

def transcribe_audio_local(audio_path: str):
    """Transcribe audio using faster-whisper locally on CPU."""
    print(f"Transcribing locally with CPU: {audio_path}")
    from faster_whisper import WhisperModel
    model = WhisperModel("tiny", device="cpu", compute_type="int8")
    segments, info = model.transcribe(audio_path, beam_size=5)
    
    result = []
    for segment in segments:
        result.append({"start": segment.start, "end": segment.end, "text": segment.text})
    return result

def transcribe_audio_api(audio_path: str, api_key: str):
    """Transcribe audio using Groq Whisper API."""
    print(f"Transcribing with Groq API: {audio_path}")
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}"}
    with open(audio_path, "rb") as file:
        files = {
            "file": file,
            "model": (None, "whisper-large-v3"),
            "response_format": (None, "verbose_json")
        }
        response = requests.post(url, headers=headers, files=files)
        response.raise_for_status()
        data = response.json()
        
        result = []
        for segment in data.get("segments", []):
             result.append({
                 "start": segment["start"],
                 "end": segment["end"],
                 "text": segment["text"]
             })
        return result

def translate_text_local(text: str):
    """Translate English text to Chinese locally (Placeholder)"""
    print(f"Translating locally: {text}")
    # TODO: Implement local translation (e.g. CTranslate2 Opus-MT)
    return f"【本地翻译】{text}"

def translate_text_api(text: str, api_key: str):
    """Translate English text to Chinese via API (Placeholder for OpenAI-like API)"""
    print(f"Translating with API: {text}")
    # TODO: Implement OpenAI/DeepL API call
    return f"【API翻译】{text}"

def generate_srt(segments, translations, output_path: str):
    with open(output_path, "w", encoding="utf-8") as f:
        for i, (seg, trans) in enumerate(zip(segments, translations)):
            start_time = format_timestamp(seg["start"])
            end_time = format_timestamp(seg["end"])
            
            f.write(f"{i+1}\n")
            f.write(f"{start_time} --> {end_time}\n")
            f.write(f"{trans}\n")
            f.write(f"{seg['text']}\n\n")
