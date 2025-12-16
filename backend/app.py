import json
import os
import re
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import cv2
import matplotlib
matplotlib.use('Agg')
import google.generativeai as genai # type: ignore
import time
import yt_dlp  # type: ignore
from dotenv import load_dotenv 
from flask import Flask, request, jsonify  # type: ignore
from flask_cors import CORS  # type: ignore
from ultralytics import YOLO # type: ignore
load_dotenv()
app = Flask(__name__)
CORS(app)
classifier_model = YOLO('https://huggingface.co/francm2/image-classification-model/resolve/main/yolov8n-classification-model.pt') 




ANALYSIS_PROMPT = """
You are an expert AI video analysis system. Your goal is to detect
AI-generated content (deepfakes, generative video).
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

def gemini_analysis():
    frame_path = "suspicious_frame.jpg" 
    try:
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    except KeyError:
        print("Error: GEMINI_API_KEY not found.")
        return {"error": "Server configuration error"}, 500

    print(f"Uploading {frame_path} to Gemini...")
    frame_file = genai.upload_file(path=frame_path)
    while frame_file.state.name == "PROCESSING":
        time.sleep(1) 
        frame_file = genai.get_file(frame_file.name)

    if frame_file.state.name == "FAILED":
        return {"error": "Google failed to process the image."}, 500

    print(f"File uploaded: {frame_file.name}") 

    try:

        print("Analyzing with Gemini...")
        response = gemini_model.generate_content([ANALYSIS_PROMPT, frame_file])
        print(f"Raw JSON response: {response.text}")
        try:
            result_data = json.loads(response.text)
        except json.JSONDecodeError:
            print("Response not clean, attempting extraction...")
            clean_json = response.text.replace('```json', '').replace('```', '').strip()
            result_data = json.loads(clean_json)

        return result_data 

    except Exception as e:
        print(f"Analysis failed: {e}")
        return {"error": str(e)}

    finally:
        if frame_file:
            print(f"Deleting cloud file: {frame_file.name}")
            genai.delete_file(frame_file.name)


@app.route('/analyze', methods=['POST'])
def analyze_video():
    data = request.json
    if data is None:
        return jsonify({"error": "No JSON data"}), 400
    if 'url' not in data:
        return jsonify({"error": "No 'url' provided"}), 400

    video_url = data['url']
    downloaded_filename = ""

    try:
        print(f"Downloading video from: {video_url}")
        ydl_opts = {
            'outtmpl': 'temp_video.%(ext)s',
            'format': 'best[ext=mp4]/best',
            'quiet': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl: # type: ignore
            info = ydl.extract_info(video_url, download=True)
            downloaded_filename = ydl.prepare_filename(info)
        
        print(f"Video downloaded: {downloaded_filename}")
        results = classifier_model(downloaded_filename, stream=True)
        ai_score_sum = 0
        frame_count = 0
        max_ai_score = -1.0
        best_frame_img = None
        for r in results:
            ai_prob = float(r.probs.data[1]) 
            ai_score_sum += ai_prob
            frame_count += 1
            if(ai_prob>max_ai_score):
                max_ai_score = ai_prob
                best_frame_img = r.orig_img.copy()

        avg_score = ai_score_sum / frame_count if frame_count >0 else 0

        result = {}
        result["url"] = video_url
        result["timestamp"] = int(time.time()*1000)
        print(f"Found suspicious frame with AI Score: {round(max_ai_score, 2)}")
        if best_frame_img is not None and max_ai_score>0.1:
            print(f"Found suspicious frame with AI Score: {round(max_ai_score, 2)}")
            cv2.imwrite("suspicious_frame.jpg",best_frame_img)
            print("Sending to Gemini")
            result = gemini_analysis()
            if result.get("isAI") is False :
                result["explanation"] = "Our propietary detection system did not identify any frames that can potentially be deemed as AI generated."
        
            return jsonify(result), 200
        else:
            print("No frames sent for extra detection")
            result["isAI"] = "false"
            result["explanation"] = "Our propietary detection system did not identify any frames that can potentially be deemed as AI generated."
            result["confidence"] = 100-round(avg_score*100,2)
            return jsonify(result), 200
        

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": str(e)}), 500
    
    finally:
        if downloaded_filename and os.path.exists(downloaded_filename):
            os.remove(downloaded_filename)
            print(f"Removed temp file: {downloaded_filename}")
        if os.path.exists("suspicious_frame.jpg"):
            os.remove("suspicious_frame.jpg")
            
            print(f"Removed file")

if __name__ == "__main__":

    app.run(host='0.0.0.0', port=5002, debug=True, use_reloader=False)