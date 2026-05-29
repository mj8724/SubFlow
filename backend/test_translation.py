import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_pipeline import translate_texts_local

texts = [
    "I'm fine.",
    "He shot him.",
    "This is a test of the offline Opus-MT translation system."
]

print("Starting test...")
results = translate_texts_local(texts)
for orig, res in zip(texts, results):
    print(f"Original: {orig}\nTranslated: {res}\n")
print("Test completed.")
