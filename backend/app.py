import os
from flask import Flask, request, jsonify
import yt_dlp
from transformers import pipeline
import torch


app = Flask(__name__)


print("Loading AI model... This might take a moment.")
classifier = pipeline(
    "video-classification", 
    model="shylhy/videomae-large-finetuned-deepfake-subset"
)
print("Model loaded successfully.")


@app.route('/analyze', methods=['POST'])
def analyze_video():

    data = request.json
    if data is None:
        return jsonify({
            "error": "No JSON data. Did you forget 'Content-Type: application/json'?"
        }), 400


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
          
            if info is None:
                raise ValueError("Failed to extract video information")
            downloaded_filename = ydl.prepare_filename(info)
        print(f"Video downloaded to: {downloaded_filename}")

 
        print("Analyzing video...")
        results = classifier(downloaded_filename)
        print(f"Analysis complete: {results}")

        return jsonify(results)

    except Exception as e:
        # Error Handling
        print(f"An error occurred: {e}")
        return jsonify({"error": str(e)}), 500
    
    finally:
        
        if os.path.exists(downloaded_filename):
            os.remove(downloaded_filename)
            print(f"Removed temp file: {downloaded_filename}")


if __name__ == '__main__':

    app.run(host='0.0.0.0', port=5001, debug=True)