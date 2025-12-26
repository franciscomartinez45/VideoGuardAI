
FROM python:3.11-slim
WORKDIR /app


RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    wget \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*
RUN wget -O yolo11m.pt "https://huggingface.co/Ultralytics/YOLO11/resolve/main/yolo11m.pt"
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . .


CMD exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 8 --timeout 120 app:app
