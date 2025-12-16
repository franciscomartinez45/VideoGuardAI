import json
import os
import re
import logging
import uuid
from urllib.parse import urlparse
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import cv2
import google.generativeai as genai # type: ignore
import time
import yt_dlp  # type: ignore
from dotenv import load_dotenv
from flask import Flask, request, jsonify  # type: ignore
from flask_cors import CORS  # type: ignore
from flask_limiter import Limiter  # type: ignore
from flask_limiter.util import get_remote_address  # type: ignore
from ultralytics import YOLO # type: ignore


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()


try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    logger.info("Gemini API configured successfully")
except KeyError:
    logger.error("GEMINI_API_KEY not found in environment variables")
    raise

app = Flask(__name__)


allowed_origins = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:8081,http://127.0.0.1:8081,http://localhost:8080,http://localhost:3000').split(',')
CORS(app, origins=allowed_origins)


limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per hour"],
    storage_uri="memory://"
)

classifier_model = None  

@app.route('/', methods=['GET'])
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

def get_classifier_model():
    global classifier_model
    if classifier_model is None:
        model_path = 'best.pt'
        if not os.path.exists(model_path):
            logger.error(f"Model file not found: {model_path}")
            raise FileNotFoundError(f"Model file '{model_path}' does not exist")
        logger.info(f"Loading YOLO model from {model_path}")
        classifier_model = YOLO(model_path)
    return classifier_model



ANALYSIS_PROMPT = """
You are an expert AI image analysis system. Your goal is to detect
AI-generated content (deepfakes, generative images).
Analyze the provided image and return *only* a valid JSON object
in the following format:
{
  "isAI": boolean,
  "confidence": number (0-100),
  "visualArtifacts": number (0-100),
  "faceAnalysis": number (0-100),
  "explanation": "Your detailed, one-paragraph analysis. Explain *why*
  you made this decision. Be specific about what you see."
}
"""
generation_config = {
    "response_mime_type": "application/json",
}

gemini_model = genai.GenerativeModel(
    'models/gemini-flash-latest',
    generation_config=generation_config
)
def extract_json_from_text(text):
    """
    Fallback function to find JSON in a string.
    """
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        return match.group(0)
    return None

def gemini_analysis(frame_path):
    """
    Analyze a frame using Gemini AI.
    Returns a dictionary with analysis results or error information.
    """
    frame_file = None
    try:
        logger.info(f"Uploading {frame_path} to Gemini...")
        frame_file = genai.upload_file(path=frame_path)

     
        max_wait_time = 30  
        start_time = time.time()
        while frame_file.state.name == "PROCESSING":
            if time.time() - start_time > max_wait_time:
                logger.error("Gemini processing timeout")
                return {"error": "Image processing timeout"}
            time.sleep(1)
            frame_file = genai.get_file(frame_file.name)

        if frame_file.state.name == "FAILED":
            logger.error("Gemini failed to process the image")
            return {"error": "Google failed to process the image."}

        logger.info(f"File uploaded: {frame_file.name}")

        logger.info("Analyzing with Gemini...")
        response = gemini_model.generate_content([ANALYSIS_PROMPT, frame_file])
        logger.info(f"Raw JSON response: {response.text}")

        try:
            result_data = json.loads(response.text)
        except json.JSONDecodeError:
            logger.warning("Response not clean JSON, attempting extraction...")
            clean_json = response.text.replace('```json', '').replace('```', '').strip()
            result_data = json.loads(clean_json)

        return result_data

    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return {"error": str(e)}

    finally:
        if frame_file:
            try:
                logger.info(f"Deleting cloud file: {frame_file.name}")
                genai.delete_file(frame_file.name)
            except Exception as e:
                logger.warning(f"Failed to delete cloud file: {e}")


def is_valid_url(url):
    """Validate if the provided string is a valid URL"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False


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
    suspicious_frame_path = f"suspicious_frame_{unique_id}.jpg"

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
        model = get_classifier_model()
        results = model(downloaded_filename, stream=True)
        ai_score_sum = 0
        frame_count = 0
        max_ai_score = -1.0
        best_frame_img = None

        for r in results:
            ai_prob = float(r.probs.data[1])
            ai_score_sum += ai_prob
            frame_count += 1
            if ai_prob > max_ai_score:
                max_ai_score = ai_prob
                best_frame_img = r.orig_img.copy()

        avg_score = ai_score_sum / frame_count if frame_count > 0 else 0

        result = {
            "url": video_url,
            "timestamp": int(time.time() * 1000)
        }

      
        SUSPICIOUS_THRESHOLD = 0.1

        if best_frame_img is not None and max_ai_score > SUSPICIOUS_THRESHOLD:
            logger.info(f"Found suspicious frame with AI Score: {round(max_ai_score, 2)}")
            cv2.imwrite(suspicious_frame_path, best_frame_img)
            logger.info("Sending to Gemini for analysis")

            gemini_result = gemini_analysis(suspicious_frame_path)

         
            if "error" in gemini_result:
                logger.error(f"Gemini analysis error: {gemini_result['error']}")
                return jsonify({"error": f"Analysis failed: {gemini_result['error']}"}), 500

           
            result.update(gemini_result)

        
            if result.get("isAI") is False:
                result["explanation"] = "Our proprietary detection system did not identify any frames that can potentially be deemed as AI generated."

            return jsonify(result), 200
        else:
            logger.info("No suspicious frames detected")
            result["isAI"] = False  
            result["explanation"] = "Our proprietary detection system did not identify any frames that can potentially be deemed as AI generated."
            result["confidence"] = 100 - round(avg_score * 100, 2)
            result["visualArtifacts"] = 0
            result["faceAnalysis"] = 0
            return jsonify(result), 200

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
        if os.path.exists(suspicious_frame_path):
            os.remove(suspicious_frame_path)
            logger.info(f"Removed suspicious frame file: {suspicious_frame_path}")

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)