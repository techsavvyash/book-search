"""
API routes for the book search web application.
"""

import io
import os
import tempfile
from dataclasses import asdict
from typing import Any, Dict, List

from flask import Blueprint, Response, current_app, jsonify, request
from werkzeug.utils import secure_filename
from pydub import AudioSegment

from library import translate_and_refine, translate_to_english, get_font

bp = Blueprint("api", __name__)


@bp.route("/health", methods=["GET"])
def health_check() -> Response:
    """Health check endpoint returning system status."""
    stats = current_app.config["SEARCH_ENGINE"].get_stats()
    return jsonify(
        {
            "status": "healthy",
            "pinecone_connected": stats["pinecone_connected"],
            "stories_loaded": stats["total_stories"],
            "embedding_provider": stats["embedding_provider"],
            "embedding_dimension": stats["embedding_dimension"],
        }
    )


@bp.route("/search", methods=["POST"])
def search_stories() -> Response:
    """Search for stories using hybrid semantic and lexical search."""
    data = request.get_json() or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"error": "Query is required"}), 400
    top_k = int(data.get("top_k", 20))

    cleaned_query = translate_and_refine(query)
    engine = current_app.config["SEARCH_ENGINE"]
    results = engine.search(cleaned_query, top_k)

    payload: List[Dict[str, Any]] = []
    for result in results:
        payload.append(
            {
                "story": asdict(result.story),
                "score": float(result.score),
                "matched_fields": {k: float(v) for k, v in result.matched_fields.items()},
            }
        )
    return jsonify({"query": cleaned_query, "results": payload, "total_found": len(payload)})


@bp.route("/upload", methods=["POST"])
def upload_data() -> Response:
    """Upload CSV data to populate the search index."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    if file.filename == "" or not file.filename.endswith(".csv"):
        return jsonify({"error": "File must be a CSV"}), 400
    csv_content = file.read().decode("utf-8")
    current_app.config["SEARCH_ENGINE"].load_data(csv_data=csv_content)
    return jsonify({"message": "Data uploaded successfully", "stories_loaded": len(current_app.config["SEARCH_ENGINE"].stories)})


@bp.route("/submit-feedback", methods=["POST"])
def submit_feedback() -> Response:
    """Submit user feedback for a search result."""
    data = request.get_json() or {}
    if not {"query", "story_id", "feedback"}.issubset(data):
        return jsonify({"error": "Missing required fields"}), 400
    if current_app.config.get("FEEDBACK_DB") is None:
        return jsonify({"error": "Feedback service unavailable"}), 503
    ok = current_app.config["FEEDBACK_DB"].save_feedback(
        query=data["query"], story_id=data["story_id"], feedback_text=data["feedback"], user_ip=request.remote_addr
    )
    if not ok:
        return jsonify({"error": "Failed to submit feedback"}), 500
    return jsonify({"message": "Feedback submitted successfully"})


@bp.route("/voice-search", methods=["POST"])
def voice_search() -> Response:
    """Search using voice input (speech-to-text)."""
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    if audio_file.filename == "":
        return jsonify({"error": "No audio file selected"}), 400

    filename = secure_filename(audio_file.filename)
    raw_path = f"temp_raw_{filename}"
    audio_file.save(raw_path)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
        sound = AudioSegment.from_file(raw_path)
        sound = sound.set_channels(1).set_frame_rate(16000).set_sample_width(2)
        sound.export(tmp_wav.name, format="wav")
        converted_path = tmp_wav.name

    try:
        vh = current_app.config.get("VOICE_HANDLER")
        if vh is None:
            return jsonify({"error": "Voice service unavailable"}), 503
        voice_query = vh.speech_to_text(converted_path)
        enhanced_query = voice_query
        f_query = get_font(enhanced_query)  # logged as in original
        cleaned_query = translate_to_english(enhanced_query)
        results = current_app.config["SEARCH_ENGINE"].search(cleaned_query, 20)

        payload: List[Dict[str, Any]] = []
        for result in results:
            payload.append(
                {
                    "story": asdict(result.story),
                    "score": float(result.score),
                    "matched_fields": {k: float(v) for k, v in result.matched_fields.items()},
                }
            )

        return jsonify(
            {
                "original_query": voice_query,
                "enhanced_query": enhanced_query,
                "results": payload,
                "total_found": len(payload),
            }
        )
    finally:
        if os.path.exists(raw_path):
            os.remove(raw_path)
        if os.path.exists(converted_path):
            os.remove(converted_path)


@bp.route("/sync", methods=["POST"])
def sync_from_pinecone() -> Response:
    """Sync stories from Pinecone vector database."""
    engine = current_app.config["SEARCH_ENGINE"]
    if not engine.index:
        return jsonify({"error": "Pinecone not connected"}), 400
    before = len(engine.stories)
    engine._sync_from_pinecone()
    after = len(engine.stories)
    return jsonify({"message": "Sync completed successfully", "stories_synced": after - before, "total_stories": after})


@bp.route("/delete-stories", methods=["POST"])
def delete_stories() -> Response:
    """Delete stories from the search index."""
    engine = current_app.config["SEARCH_ENGINE"]
    if not engine.index:
        return jsonify({"error": "Pinecone not connected"}), 400
    data = request.get_json() or {}
    story_ids = data.get("story_ids", [])
    if not story_ids:
        return jsonify({"error": "No story IDs provided"}), 400

    vectors_to_delete: List[str] = []
    for sid in story_ids:
        for field in engine.semantic_fields:
            vectors_to_delete.append(f"{sid}_{field}")
    if vectors_to_delete:
        engine.index.delete(ids=vectors_to_delete)

    deleted_count = 0
    for sid in story_ids:
        if sid in engine.stories:
            del engine.stories[sid]
            deleted_count += 1

    return jsonify({
        "message": f"Successfully deleted {deleted_count} stories",
        "deleted_count": deleted_count,
        "remaining_stories": len(engine.stories),
    })


@bp.route("/list-stories", methods=["GET"])
def list_stories() -> Response:
    """List all available stories."""
    engine = current_app.config["SEARCH_ENGINE"]
    stories = [
        {"id": sid, "filename": story.filename, "title": story.filename.replace(".txt", "").replace("-", " ").title()}
        for sid, story in engine.stories.items()
    ]
    return jsonify({"stories": stories, "total_count": len(stories)})


@bp.route("/get-feedback", methods=["GET"])
def get_feedback() -> Response:
    """Get all feedback records."""
    if current_app.config.get("FEEDBACK_DB") is None:
        return jsonify({"feedback": []})
    feedback_records = current_app.config["FEEDBACK_DB"].get_all_feedback()
    formatted = [
        {
            "id": rec.get("id"),
            "query": rec.get("query", ""),
            "story_id": rec.get("story_id", ""),
            "feedback_text": rec.get("feedback_text", ""),
            "timestamp": rec.get("timestamp", ""),
            "user_ip": rec.get("user_ip", ""),
        }
        for rec in feedback_records
    ]
    return jsonify({"feedback": formatted})
