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

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
