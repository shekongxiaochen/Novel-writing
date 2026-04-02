import time

from fastapi import APIRouter, HTTPException

from app.db import ping_db

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "time": int(time.time())}


@router.get("/health/db")
def health_db() -> dict:
    try:
        ping_db()
        return {"status": "db_connected"}
    except Exception as e:
        # 让前端/部署更容易判断是否 DB 配置正确
        raise HTTPException(status_code=503, detail=str(e))

