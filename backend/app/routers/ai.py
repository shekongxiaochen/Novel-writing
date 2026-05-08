from __future__ import annotations

import json

import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.schemas import OutlineAiExpandIn, OutlineAiExpandOut

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/outline-expand", response_model=OutlineAiExpandOut)
async def outline_expand(payload: OutlineAiExpandIn) -> OutlineAiExpandOut:
    if not settings.dashscope_api_key.strip():
        raise HTTPException(status_code=400, detail="未配置 DASHSCOPE_API_KEY")

    mode_hint = {
        "full": "补全冲突、转折、悬念",
        "conflict": "只补全冲突",
        "twist": "只补全转折",
        "suspense": "只补全悬念",
    }.get(payload.mode, "补全冲突、转折、悬念")

    prompt = (
        "你是中文小说策划编辑。请根据给定情节点补全内容，要求短句、可直接落地写作。"
        "输出必须是 JSON 对象，键仅包含 conflict, twist, suspense。\n\n"
        f"任务：{mode_hint}\n"
        f"标题：{payload.title}\n"
        f"摘要：{payload.summary}\n"
        f"目标：{payload.goal}\n"
        f"已有冲突：{payload.conflict}\n"
        f"已有转折：{payload.twist}\n"
        f"已有悬念：{payload.suspense}\n"
        f"已有结果：{payload.result}\n"
    )

    req_body = {
        "model": settings.dashscope_model,
        "temperature": 0.7,
        "messages": [
            {"role": "system", "content": "你只输出合法 JSON，不要输出解释文本。"},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                settings.dashscope_base_url,
                headers={
                    "Authorization": f"Bearer {settings.dashscope_api_key}",
                    "Content-Type": "application/json",
                },
                json=req_body,
            )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content) if isinstance(content, str) else content
        return OutlineAiExpandOut(
            conflict=str(parsed.get("conflict", "")).strip(),
            twist=str(parsed.get("twist", "")).strip(),
            suspense=str(parsed.get("suspense", "")).strip(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI 调用失败：{exc}") from exc
