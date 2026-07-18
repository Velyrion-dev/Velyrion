FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Copy policies if they exist
# NOTE: policies are mounted via docker-compose volume

# NOTE: seed.py runs at runtime via start command, not build time,
# because DATABASE_URL is only available at runtime

# Shell form — /bin/sh -c expands $PORT at runtime
CMD python seed.py && python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
