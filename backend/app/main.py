from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db import init_db
from app.routers.auth import router as auth_router
from app.routers.health import router as health_router
from app.routers.novels import router as novels_router
from app.routers.ai import router as ai_router

app = FastAPI(title="Novel Structure Assistant", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup() -> None:
    init_db()

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(novels_router)
app.include_router(ai_router)

