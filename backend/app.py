import os
import json
import time
import re 
from flask import Flask, request, jsonify # pyright: ignore[reportMissingImports]
import yt_dlp # pyright: ignore[reportMissingModuleSource]
import google.generativeai as genai  # pyright: ignore[reportMissingImports]
from dotenv import load_dotenv # pyright: ignore[reportMissingImports]


load_dotenv()
app = Flask(__name__)

try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
except KeyError:
    print("Error: GEMINI_API_KEY not found. Make sure it's set in your .env file.")
    exit()


ANALYSIS_PROMPT = """
You are an expert AI video analysis system. Your goal is to detect
AI-generated content (deepfakes, generative video).
Analyze the provided video and return *only* a valid JSON object
in the following format:
{
  "isAI": boolean,
  "confidence": number (0-100),
  "details": {
    "visualArtifacts": number (0-100),
    "audioAnomalies": number (0-100),
    "motionPatterns": number (0-100),
    "faceAnalysis": number (0-100)
  },
  "explanation": "Your detailed, one-paragraph analysis. Explain *why*
  you made this decision. Be specific about what you see or hear."
}
"""


generation_config = {
    "response_mime_type": "application/json",
}


model = genai.GenerativeModel(
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


@app.route('/analyze', methods=['POST'])
def analyze_video():
    data = request.json
    if data is None:
        return jsonify({"error": "No JSON data. Did you forget 'Content-Type: application/json'?"}), 400
    if 'url' not in data:
        return jsonify({"error": "No 'url' provided in JSON"}), 400

    video_url = data['url']
    downloaded_filename = ""

    try:
      
        print(f"Downloading video from: {video_url}")
        ydl_opts = {
            'outtmpl': 'temp_video.%(ext)s',
            'format': 'best[ext=mp4]/best',
            'quiet': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl: # pyright: ignore[reportArgumentType]
            info = ydl.extract_info(video_url, download=True)
            downloaded_filename = ydl.prepare_filename(info)

        print(f"Video downloaded: {downloaded_filename}")

    
        print("Uploading file to Gemini...")
        video_file = genai.upload_file(path=downloaded_filename)
        
        while video_file.state.name == "PROCESSING":
            print("Waiting for Google to process the video...")
            time.sleep(5)
            video_file = genai.get_file(video_file.name)
        
        if video_file.state.name == "FAILED":
            return jsonify({"error": "Google failed to process the video file."}), 500

        print(f"File uploaded successfully: {video_file.name}")

     
        print("Analyzing video with Gemini...")
        response = model.generate_content([ANALYSIS_PROMPT, video_file])
        genai.delete_file(video_file.name)
        print("Removed file from Google's servers.")

    
        print(f"Raw JSON response: {response.text}")
        
        try:
            result_json = json.loads(response.text)
        except json.JSONDecodeError:
            print("Response was not clean JSON, trying to extract...")
            json_string = extract_json_from_text(response.text)
            if not json_string:
                return jsonify({"error": "Failed to parse AI response. Check backend logs."}), 500
            result_json = json.loads(json_string)

        result_json["url"] = video_url
        result_json["timestamp"] = time.time()
        
        print(f"Analysis complete: {result_json['isAI']} ({result_json['confidence']}%)")
        return jsonify(result_json)

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": str(e)}), 500
    
    finally:
   
        if os.path.exists(downloaded_filename):
            os.remove(downloaded_filename)
            print(f"Removed temp file: {downloaded_filename}")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)