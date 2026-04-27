FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (caching)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy policies (needed by policy engine)
COPY policies/ /app/policies/

# NOTE: seed.py runs at runtime via start command, not build time,
# because DATABASE_URL is only available at runtime

# Shell form — /bin/sh -c expands $PORT at runtime
CMD python seed.py && python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
