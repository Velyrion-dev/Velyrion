FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (caching)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy policies (needed by policy engine)
COPY policies/ /app/policies/

# Seed database with demo data
RUN python seed.py

EXPOSE ${PORT:-8000}

# Use shell form so $PORT is expanded at runtime
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
