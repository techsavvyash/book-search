import os
import base64
import requests
import mimetypes
import csv
import time
from pathlib import Path
from tqdm import tqdm

# Install with: pip install pydub
try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    print("⚠️  pydub not found. Install with: pip install pydub")
    print("   For MP3 support, also install: pip install pydub[mp3]")
    PYDUB_AVAILABLE = False

SARVAM_API_KEY = "----"
GEMINI_API_KEY = "----"

# Pricing constants (in USD)
SARVAM_PRICING = {
    "saarika:v2.5": 0.00075,  # $0.00075 per second OR 30 rupees per hour
}

GEMINI_PRICING = {
    "input_text": 0.3 / 1e6,
    "input_audio": 1 / 1e6,
    "output_text": 2.5 / 1e6,
}

def get_audio_duration(file_path):
    """Get accurate audio duration in seconds using pydub."""
    if not PYDUB_AVAILABLE:
        # Fallback to rough estimation
        try:
            file_size = os.path.getsize(file_path)
            # Very rough approximation: 1MB ≈ 60 seconds for typical audio
            estimated_duration = file_size / (1024 * 1024) * 60
            return max(1, estimated_duration)
        except:
            return 1
    
    try:
        # Use pydub for accurate duration
        audio = AudioSegment.from_file(file_path)
        duration_seconds = len(audio) / 1000.0  # pydub returns milliseconds
        return duration_seconds
    except Exception as e:
        print(f"Warning: Could not get duration for {file_path}: {e}")
        # Fallback to file size estimation
        try:
            file_size = os.path.getsize(file_path)
            estimated_duration = file_size / (1024 * 1024) * 60
            return max(1, estimated_duration)
        except:
            return 1

def estimate_tokens(text):
    """Rough token estimation: ~4 characters per token"""
    return len(text) / 4 if text else 0

def speech_to_text_sarvam(file_path, model="saarika:v2.5", language_code="auto"):
    start_time = time.time()
    
    url = "https://api.sarvam.ai/speech-to-text"
    with open(file_path, "rb") as f:
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"

        files = {
            'file': (os.path.basename(file_path), f, mime_type)
        }

        data = {'model': model, 'with_timestamps': 'false'}
        if language_code != "auto":
            data['language_code'] = language_code

        headers = {'api-subscription-key': SARVAM_API_KEY}
        response = requests.post(url, files=files, data=data, headers=headers)
        
        end_time = time.time()
        latency = end_time - start_time
        
        if response.status_code != 200:
            raise Exception(f"Sarvam API Error: {response.status_code} - {response.text}")
        
        result = response.json()
        transcript = result.get('transcript', 'No transcript available')
        detected_lang = result.get('language_code', 'Unknown')
        
        # Calculate cost based on accurate duration
        audio_duration = get_audio_duration(file_path)
        cost = audio_duration * SARVAM_PRICING.get(model, 0.00002)
        
        return transcript, detected_lang, latency, cost

def translate_with_gemini(text, source_lang):
    start_time = time.time()
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    prompt = f"Translate the following text from {source_lang} to English. Provide only the translation without any additional commentary:\n\n{text}"
    
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 4096
        }
    }
    
    response = requests.post(url, json=payload)
    end_time = time.time()
    latency = end_time - start_time
    
    if response.ok:
        result = response.json()
        translation = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
        
        # Calculate cost
        input_tokens = estimate_tokens(prompt)
        output_tokens = estimate_tokens(translation)
        cost = (input_tokens * GEMINI_PRICING["input_text"] + 
                output_tokens * GEMINI_PRICING["output_text"])
        
        return translation, latency, cost
    else:
        return None, latency, 0

def speech_to_text_gemini(file_path, retries=2, delay=30):
    # Track only successful request time, not retry delays
    total_api_time = 0
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    mime_type, _ = mimetypes.guess_type(file_path)
    with open(file_path, "rb") as f:
        b64_data = base64.b64encode(f.read()).decode()

    prompt = ("Please transcribe and translate the following audio into English. "
              "Return only the final English transcription, without any commentary or extra text.")

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type or "audio/mpeg", "data": b64_data}}
            ]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 4096
        }
    }

    for attempt in range(retries + 1):
        start_time = time.time()
        response = requests.post(url, json=payload)
        end_time = time.time()
        
        if response.status_code == 429:
            if attempt < retries:
                wait = delay * (attempt + 1)
                print(f"⚠️ Gemini quota exceeded. Retrying in {wait}s... (Attempt {attempt+1}/{retries})")
                time.sleep(wait)
                continue
            else:
                raise Exception("Gemini API quota exceeded after retries.")
        elif not response.ok:
            raise Exception(f"Gemini API Error {response.status_code}: {response.text}")
        else:
            # Only count successful request time
            total_api_time = end_time - start_time
            break

    # Extract response
    result = response.json()
    try:
        english_transcript = result["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        english_transcript = "ERROR: Could not parse Gemini response"

    # Calculate cost
    audio_duration = get_audio_duration(file_path)
    # Rough estimation: audio tokens ≈ duration in seconds * 50 (very approximate)
    input_audio_tokens = audio_duration * 50
    input_text_tokens = estimate_tokens(prompt)
    output_tokens = estimate_tokens(english_transcript)
    
    cost = (input_text_tokens * GEMINI_PRICING["input_text"] +
            input_audio_tokens * GEMINI_PRICING["input_audio"] +
            output_tokens * GEMINI_PRICING["output_text"])

    return english_transcript, total_api_time, cost

def process_all_audio_files(folder_path, output_csv="output_with_metrics.csv"):
    audio_extensions = {".wav", ".mp3", ".m4a", ".ogg", ".flac"}
    audio_files = [str(p) for p in Path(folder_path).rglob("*") if p.suffix.lower() in audio_extensions]

    results = []
    total_sarvam_cost = 0
    total_gemini_cost = 0
    total_translation_cost = 0
    total_sarvam_time = 0
    total_gemini_time = 0
    total_translation_time = 0
    
    for file_path in tqdm(audio_files, desc="Processing audio files"):
        filename = os.path.relpath(file_path, folder_path)
        try:
            # Sarvam processing
            sarvam_transcript, sarvam_lang, sarvam_latency, sarvam_cost = speech_to_text_sarvam(file_path)
            total_sarvam_time += sarvam_latency
            total_sarvam_cost += sarvam_cost
            
            # Translation if needed (separate tracking)
            translation_latency = 0
            translation_cost = 0
            needs_translation = sarvam_lang not in ['en-IN', 'en']
            
            if needs_translation:
                sarvam_translation, translation_latency, translation_cost = translate_with_gemini(sarvam_transcript, sarvam_lang)
                total_translation_time += translation_latency
                total_translation_cost += translation_cost
                
                if sarvam_translation:
                    sarvam_resp = sarvam_translation
                else:
                    sarvam_resp = sarvam_transcript
            else:
                sarvam_resp = sarvam_transcript

            # Calculate total Sarvam cost (STT + translation)
            sarvam_total_cost = sarvam_cost + translation_cost
            sarvam_total_time = sarvam_latency + translation_latency

            # Gemini processing
            gemini_resp, gemini_latency, gemini_cost = speech_to_text_gemini(file_path)
            total_gemini_time += gemini_latency
            total_gemini_cost += gemini_cost

            # Get accurate duration for reporting
            duration = get_audio_duration(file_path)

            results.append([
                filename,
                f"{duration:.1f}s",
                sarvam_resp,
                f"{sarvam_total_time:.2f}s",  # Combined Sarvam + translation time
                f"${sarvam_total_cost:.6f}",  # Combined Sarvam + translation cost
                "Yes" if needs_translation else "No",
                gemini_resp,
                f"{gemini_latency:.2f}s", 
                f"${gemini_cost:.6f}"
            ])
        
        except Exception as e:
            print(f"Error with file {file_path}: {e}")
            results.append([
                filename,
                "N/A",
                f"ERROR: {e}",
                "N/A",
                "N/A",
                "N/A",
                f"ERROR: {e}",
                "N/A",
                "N/A"
            ])

    # Calculate totals for summary row
    total_combined_sarvam_cost = total_sarvam_cost + total_translation_cost
    total_combined_sarvam_time = total_sarvam_time + total_translation_time
    grand_total_cost = total_combined_sarvam_cost + total_gemini_cost

    # Add totals row
    results.append([
        "TOTALS",
        "",
        "",
        f"{total_combined_sarvam_time:.2f}s",
        f"${total_combined_sarvam_cost:.6f}",
        "",
        "",
        f"{total_gemini_time:.2f}s",
        f"${total_gemini_cost:.6f}"
    ])

    # Save results to CSV
    with open(output_csv, mode="w", newline='', encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "filename", 
            "duration",
            "sarvam_response", 
            "sarvam_total_latency", 
            "sarvam_total_cost",
            "translation_needed",
            "gemini_response", 
            "gemini_latency", 
            "gemini_cost"
        ])
        writer.writerows(results)

    # Print summary
    print(f"\n✅ Processing completed. Results saved to: {output_csv}")
    print(f"\n📊 SUMMARY:")
    print(f"Total files processed: {len(results) - 1}")  # Subtract 1 for totals row
    print(f"Sarvam STT - Total time: {total_sarvam_time:.2f}s, Total cost: ${total_sarvam_cost:.6f}")
    print(f"Gemini Translation - Total time: {total_translation_time:.2f}s, Total cost: ${total_translation_cost:.6f}")
    print(f"Sarvam Combined (STT + Translation) - Total time: {total_combined_sarvam_time:.2f}s, Total cost: ${total_combined_sarvam_cost:.6f}")
    print(f"Gemini STT - Total time: {total_gemini_time:.2f}s, Total cost: ${total_gemini_cost:.6f}")
    print(f"GRAND TOTAL COST: ${grand_total_cost:.6f}")
    print(f"Average latency - Sarvam Combined: {total_combined_sarvam_time/(len(results)-1):.2f}s, Gemini: {total_gemini_time/(len(results)-1):.2f}s")

# Example usage
if __name__ == "__main__":
    import re
    process_all_audio_files("Tagging Exploration")
