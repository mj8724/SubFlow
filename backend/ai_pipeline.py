import subprocess
import os
import math
import requests

def extract_audio(video_path: str, output_path: str, output_format: str = "mp3"):
    """Extract audio from video using ffmpeg. Supports mp3, wav, flac, aac formats."""
    format_codecs = {
        "mp3": ["-acodec", "libmp3lame", "-q:a", "2"],
        "wav": ["-acodec", "pcm_s16le"],
        "flac": ["-acodec", "flac"],
        "aac": ["-acodec", "aac", "-b:a", "192k"],
    }
    if output_format not in format_codecs:
        raise ValueError(f"Unsupported audio format: {output_format}. Supported: {', '.join(format_codecs.keys())}")

    codec_args = format_codecs[output_format]
    command = ["ffmpeg", "-y", "-i", video_path, "-vn"] + codec_args + [output_path]
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

def transcribe_audio_local(audio_path: str, model_name: str = "tiny"):
    """Transcribe audio using faster-whisper locally on CPU."""
    print(f"Transcribing locally with CPU ({model_name}): {audio_path}")
    print(f"Loading model '{model_name}'...")
    from faster_whisper import WhisperModel
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    print(f"Model loaded. Starting transcription...")
    segments, info = model.transcribe(audio_path, beam_size=5)
    
    duration = info.duration
    print(f"Audio duration: {duration:.1f}s | Language: {info.language} (prob: {info.language_probability:.2f})")
    
    result = []
    for segment in segments:
        result.append({"start": segment.start, "end": segment.end, "text": segment.text})
        pct = (segment.end / duration * 100) if duration > 0 else 0
        print(f"[STT {pct:5.1f}%] {format_timestamp(segment.start)} --> {format_timestamp(segment.end)} | {segment.text.strip()}")
    
    print(f"Transcription complete: {len(result)} segments extracted.")
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

# Singleton for translation model
_marian_model = None
_marian_tokenizer = None

def _get_marian_model():
    global _marian_model, _marian_tokenizer
    if _marian_model is None or _marian_tokenizer is None:
        from transformers import MarianMTModel, MarianTokenizer
        print("Loading Opus-MT model (this may take a while the first time to download)...")
        model_name = "Helsinki-NLP/opus-mt-en-zh"
        _marian_tokenizer = MarianTokenizer.from_pretrained(model_name)
        _marian_model = MarianMTModel.from_pretrained(model_name)
        _marian_model.to("cpu")
        print("Opus-MT model loaded.")
    return _marian_model, _marian_tokenizer

def translate_texts_local(texts, dest='zh-CN', src='en'):
    """
    Local batch translation using huggingface transformers pipeline (Opus-MT).
    Processes in small chunks to prevent OOM.
    """
    if not texts:
        return []
        
    try:
        print(f"Batch translating {len(texts)} segments with Opus-MT...")
        model, tokenizer = _get_marian_model()
        
        translated_texts = []
        batch_size = 32
        
        for i in range(0, len(texts), batch_size):
            chunk = texts[i:i + batch_size]
            # Tokenize and generate
            inputs = tokenizer(chunk, return_tensors="pt", padding=True, truncation=True, max_length=512)
            inputs = {k: v.to("cpu") for k, v in inputs.items()}
            
            translated_tokens = model.generate(**inputs)
            chunk_translated_texts = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)
            translated_texts.extend(chunk_translated_texts)
            
            # Print progress for debugging
            print(f"Translated chunk {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}")
            
        return translated_texts
        
    except Exception as e:
        print(f"Translation failed: {e}")
        return texts # fallback to original

def translate_text_local(text: str):
    """Translate English text to Chinese locally"""
    if not text.strip():
        return text
    return translate_texts_local([text])[0]


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
            f.write(f"{trans}\n\n")
