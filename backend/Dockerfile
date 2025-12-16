
FROM python:3.11
WORKDIR /app


COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . .


CMD exec gunicorn --bind 0.0.0.0:${PORT:-8080} app:app
