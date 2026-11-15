import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from database import db
from routers import admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB indexes and ensure default superadmin
    db.init_database()
    yield


app = FastAPI(
    title="Cafe Fekr Dedicated Admin Backend",
    version="2.0.0",
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers (both /admin and /api/admin for maximum compatibility)
app.include_router(admin_router.router)
app.include_router(admin_router.router, prefix="/api")


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "kafehfekr-admin-backend",
        "port": int(os.getenv("PORT", 5002)),
        "database": "KafehFekrDB",
    }


# Mount compiled web admin frontend static assets if available
static_candidates = [
    os.path.join(current_dir, "static"),
    os.path.join(current_dir, "..", "frontend", "dist"),
]

for static_dir in static_candidates:
    if os.path.exists(static_dir) and os.path.isfile(os.path.join(static_dir, "index.html")):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
        print(f"[AdminBackend] Serving frontend static assets from: {static_dir}")
        break


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5002))
    print(f"[AdminBackend] Starting server on http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=False)
