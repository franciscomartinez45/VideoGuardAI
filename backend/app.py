import json
import os
import re
import logging
import uuid
import shutil
from urllib.parse import urlparse
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import cv2
import time
import subprocess
import numpy as np
import yt_dlp  # type: ignore
from dotenv import load_dotenv
from flask import Flask, request, jsonify  # type: ignore
from flask_cors import CORS  # type: ignore
from flask_limiter import Limiter  # type: ignore
from flask_limiter.util import get_remote_address  # type: ignore
from ultralytics import YOLO # type: ignore

# Import anomaly detection modules
from models.object_tracker import MultiObjectTracker
from models.feature_extractor import FeatureExtractor
from models.anomaly_detector import LSTMAutoencoder
from utils.anomaly_metrics import detect_all_anomalies, combine_scores, generate_user_friendly_summary
from utils.llm_analyzer import analyze_anomaly_report, OllamaConnectionError, ReplicateConnectionError


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)


allowed_origins = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:8081,http://127.0.0.1:8081,http://localhost:8080,http://localhost:3000').split(',')
CORS(app, origins=allowed_origins)


limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per hour"],
    storage_uri="memory://"
)

logger.info("Loading YOLO model for object detection...")
yolo_model = YOLO("yolo11m.pt")
logger.info("YOLO model loaded successfully")
logger.info("Loading EfficientNet feature extractor...")
feature_extractor = FeatureExtractor()
logger.info("Feature extractor loaded successfully")
logger.info("Loading LSTM anomaly detector...")
anomaly_detector = LSTMAutoencoder()
logger.info("Anomaly detector loaded successfully")
@app.route('/', methods=['GET'])
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

def is_valid_url(url):
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False


def compute_fft(frame):
    if len(frame.shape) == 3:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    else:
        gray = frame
    f_transform = np.fft.fft2(gray)
    f_shift = np.fft.fftshift(f_transform) 
    magnitude_spectrum = np.abs(f_shift)
    magnitude_spectrum = np.log1p(magnitude_spectrum)
    magnitude_spectrum = cv2.normalize(magnitude_spectrum, None, 0, 255, cv2.NORM_MINMAX) # type: ignore
    magnitude_spectrum = magnitude_spectrum.astype(np.uint8)

    return magnitude_spectrum


def apply_deblocking_filter(input_path, output_path):
    try:
        logger.info("Applying deblocking filter to video...")
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-vf', 'hqdn3d=4:3:6:4.5',  
            '-c:v', 'libx264',  
            '-pix_fmt', 'yuv420p', 
            '-preset', 'medium',  
            '-crf', '18', 
            '-c:a', 'copy',  
            '-y',  
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=False, timeout=300)

        if result.returncode != 0:
            logger.error(f"FFmpeg deblocking failed: {result.stderr}")
            logger.warning("Continuing without deblocking filter")
            return input_path

        logger.info("Deblocking filter applied successfully")
        return output_path
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg deblocking timed out")
        logger.warning("Continuing without deblocking filter")
        return input_path
    except Exception as e:
        logger.error(f"Error applying deblocking filter: {e}")
        logger.warning("Continuing without deblocking filter")
        return input_path


@app.route('/analyze', methods=['POST'])
@limiter.limit("10 per minute")
def analyze_video():
    data = request.json
    if data is None:
        return jsonify({"error": "No JSON data"}), 400
    if 'url' not in data:
        return jsonify({"error": "No 'url' provided"}), 400

    video_url = data['url']

  
    if not is_valid_url(video_url):
        return jsonify({"error": "Invalid URL format"}), 400


    unique_id = str(uuid.uuid4())
    downloaded_filename = ""
    filtered_filename = ""

    try:
        logger.info(f"Downloading video from: {video_url}")
        ydl_opts = {
            'outtmpl': f'temp_video_{unique_id}.%(ext)s',
            'format': 'best[ext=mp4]/best',
            'quiet': True,
            'socket_timeout': 30,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl: # type: ignore
            info = ydl.extract_info(video_url, download=True)
            downloaded_filename = ydl.prepare_filename(info)

        logger.info(f"Video downloaded: {downloaded_filename}")
        filtered_output = f"filtered_video_{unique_id}.mp4"
        filtered_filename = apply_deblocking_filter(downloaded_filename, filtered_output)
        results_folder = "detection_results"
        os.makedirs(results_folder, exist_ok=True)
        logger.info(f"Saving detection results to: {results_folder}")
        logger.info("Stage 1: Running object detection to filter frames...")
        cap = cv2.VideoCapture(filtered_filename)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval = int(fps * 0.5)
        frame_count = 0
        processed_count = 0
        logger.info(f"Video FPS: {fps}, processing every {frame_interval} frames (0.5 second intervals)")
        tracker = MultiObjectTracker()
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_count % frame_interval == 0:
                timestamp = frame_count / fps
                detections_result = yolo_model(frame, verbose=False)[0]
                detections = []
                class_names = []
                bboxes = []
                if detections_result.boxes is not None and len(detections_result.boxes) > 0:
                    for box in detections_result.boxes:
                        bbox = box.xyxy[0].cpu().numpy() 
                        conf = float(box.conf[0])
                        class_id = int(box.cls[0])
                        class_name = detections_result.names[class_id]

                        detection = np.array([bbox[0], bbox[1], bbox[2], bbox[3], conf, class_id])
                        detections.append(detection)
                        class_names.append(class_name)
                        bboxes.append(bbox)
                features = []
                if len(bboxes) > 0:
                    features = feature_extractor.extract_batch(frame, bboxes)
                tracker.update(detections, class_names, features, frame_count, timestamp)

                logger.info(f"Frame {processed_count}: Detected {len(detections)} objects, {tracker.get_track_count()} active tracks")
                processed_count += 1

            frame_count += 1

        cap.release()
        logger.info(f"Processing complete. Analyzed {processed_count} frames with {tracker.get_track_count()} total tracks")
        logger.info("Analyzing tracks for movement anomalies...")
        anomaly_results = []
        for track_id, track in tracker.tracks.items():
            if len(track.frames) >= 3: 
                logger.debug(f"Analyzing track {track_id} ({track.class_name}) with {len(track.frames)} frames")
                geometric_scores = detect_all_anomalies(track)
                if len(track.frames) >= 10:
                    lstm_score = anomaly_detector.get_reconstruction_error(track)
                else:
                    lstm_score = 0.0
                track.anomaly_scores = combine_scores(geometric_scores, lstm_score)
                max_score = max(track.anomaly_scores.values())
                if max_score > 0.5:
                    severity = "high" if max_score > 0.75 else "medium"
                    anomaly_results.append({
                        "track_id": track_id,
                        "class": track.class_name,
                        "scores": track.anomaly_scores,
                        "frames": track.frames,
                        "severity": severity,
                        "max_score": float(max_score)
                    })
                    logger.info(f"Anomaly detected: Track {track_id} ({track.class_name}) - {severity} severity ({max_score:.2f})")
                
        user_friendly = generate_user_friendly_summary(
            anomaly_results,
            tracker.get_track_count()
        )

        result_json = {
            "user_friendly_summary": user_friendly,
        }

        logger.info(f"Anomaly analysis complete. Found {len(anomaly_results)} anomalous tracks")

        # Generate LLM analysis immediately (combined into one call)
        try:
            logger.info("Starting LLM analysis...")
            llm_analysis, metadata = analyze_anomaly_report(result_json)
            logger.info("LLM analysis completed successfully")

            # Return complete analysis with LLM insights
            return jsonify({
                "report_id": unique_id,
                "llm_analysis": llm_analysis,
                "metadata": metadata
            }), 200

        except (OllamaConnectionError, ReplicateConnectionError) as e:
            logger.error(f"LLM service error: {e}")
            # Return basic analysis without LLM if service unavailable
            return jsonify({
                "report_id": unique_id,
                "error": "LLM analysis unavailable",
                "details": str(e),
                "user_friendly_summary": user_friendly
            }), 200

        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            # Return basic analysis without LLM if analysis fails
            return jsonify({
                "report_id": unique_id,
                "error": "LLM analysis failed",
                "details": str(e),
                "user_friendly_summary": user_friendly
            }), 200 




    except FileNotFoundError as e:
        logger.error(f"Model file error: {e}")
        return jsonify({"error": "Server configuration error: model not found"}), 500
    except Exception as e:
        logger.error(f"An error occurred: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        if downloaded_filename and os.path.exists(downloaded_filename):
            os.remove(downloaded_filename)
            logger.info(f"Removed temp file: {downloaded_filename}")  
        if filtered_filename and os.path.exists(filtered_filename) and filtered_filename != downloaded_filename:
            os.remove(filtered_filename)
            logger.info(f"Removed filtered file: {filtered_filename}")
        # results_folder = "detection_results"
         # if os.path.exists(results_folder):
         #     shutil.rmtree(results_folder)


@app.route('/analyze-report', methods=['POST'])
@limiter.limit("20 per minute")
def analyze_report_with_llm():
    """
    Analyze an anomaly report using LLM to generate natural language insights.

    Accepts either a report_id (UUID) to load from disk, or a full report JSON.
    Returns LLM-generated analysis with summary, authenticity assessment, and insights.
    """
    data = request.json
    if data is None:
        return jsonify({"error": "No JSON data"}), 400

    report_data = None
    report_id = None

    # Option 1: Load report from disk using report_id
    if 'report_id' in data:
        report_id = data['report_id']

        # Validate UUID format (basic check)
        if not report_id or len(report_id) < 10:
            return jsonify({"error": "Invalid report_id format"}), 400

        # Construct file path
        results_folder = "detection_results"
        report_path = os.path.join(results_folder, f"{report_id}_anomaly_report.json")

        # Check if file exists
        if not os.path.exists(report_path):
            return jsonify({"error": f"Report not found: {report_id}"}), 404

        # Load report
        try:
            with open(report_path, 'r') as f:
                report_data = json.load(f)
            logger.info(f"Loaded report from disk: {report_id}")
        except Exception as e:
            logger.error(f"Failed to load report {report_id}: {e}")
            return jsonify({"error": f"Failed to load report: {str(e)}"}), 500

    # Option 2: Use provided report JSON directly
    elif 'report' in data:
        report_data = data['report']
        report_id = "inline"
        logger.info("Analyzing inline report")

    else:
        return jsonify({"error": "Either 'report_id' or 'report' field is required"}), 400

    # Validate report structure
    if not report_data or 'user_friendly_summary' not in report_data:
        return jsonify({"error": "Invalid report structure: missing 'user_friendly_summary'"}), 400

    # Get optional model parameter
    model = data.get('model', None)  # None will use default from env

    # Analyze with LLM
    try:
        logger.info(f"Starting LLM analysis for report: {report_id}")

        analysis, metadata = analyze_anomaly_report(report_data, model=model)

        logger.info(f"LLM analysis completed successfully for report: {report_id}")

        # Construct response
        response = {
            "report_id": report_id,
            "llm_analysis": analysis,
            "metadata": metadata
        }

        # Delete the report file after successful analysis (only if loaded from disk)
        if 'report_id' in data and report_id != "inline":
            try:
                if os.path.exists(report_path):
                    os.remove(report_path)
                    logger.info(f"Deleted report file: {report_path}")
            except Exception as e:
                logger.warning(f"Failed to delete report file {report_path}: {e}")
                # Don't fail the request if file deletion fails

        return jsonify(response), 200

    except OllamaConnectionError as e:
        logger.error(f"Ollama connection error: {e}")
        return jsonify({
            "error": "LLM service unavailable",
            "details": str(e),
            "suggestion": "Please ensure Ollama is running with: ollama serve"
        }), 503

    except ReplicateConnectionError as e:
        logger.error(f"Replicate connection error: {e}")
        return jsonify({
            "error": "LLM service unavailable",
            "details": str(e),
            "suggestion": "Please check your REPLICATE_API_TOKEN and internet connection"
        }), 503

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return jsonify({"error": str(e)}), 400

    except Exception as e:
        logger.error(f"LLM analysis failed: {e}")
        return jsonify({
            "error": "LLM analysis failed",
            "details": str(e)
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)