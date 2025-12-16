
FROM python:3.11-slim
WORKDIR /app

RUN wget -O best.pt "https://huggingface.co/francm2/image-classification-model/resolve/main/yolov8n-classification-model.pt"
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . .


CMD exec gunicorn --bind 0.0.0.0:${PORT:-8080} app:app
