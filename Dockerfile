# ==========================================
# Stage 1: Build Frontend (React + Vite SPA)
# ==========================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Backend Runtime (Python FastAPI)
# ==========================================
FROM python:3.12-slim AS runtime

WORKDIR /app

# Prevent Python from writing .pyc files & enable unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5002 \
    HOST=0.0.0.0 \
    MONGO_URI=mongodb://mongo:27017/ \
    BACKUP_DIR=/app/Backups/ \
    BACKEND_INTERNAL_URL=http://backend:5000 \
    SERVER_INTERNAL_URL=http://server:5001

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Create persistent backup directory
RUN mkdir -p /app/Backups

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend assets into backend/static
COPY --from=frontend-builder /app/frontend/dist ./backend/static

EXPOSE 5002

WORKDIR /app/backend

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5002/health || exit 1

CMD ["python", "main.py"]
