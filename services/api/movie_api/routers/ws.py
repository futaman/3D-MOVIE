"""ジョブ進捗 WebSocket。Redis Pub/Sub の `jobs` チャンネルをそのままクライアントへ中継する。"""
from __future__ import annotations

import asyncio

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..config import get_settings
from ..events import CHANNEL

router = APIRouter(tags=["ws"])


@router.websocket("/ws/jobs")
async def ws_jobs(ws: WebSocket) -> None:
    await ws.accept()
    client = aioredis.from_url(get_settings().redis_url, decode_responses=True)
    pubsub = client.pubsub()
    try:
        await pubsub.subscribe(CHANNEL)
    except Exception:
        await ws.send_json({"type": "error", "message": "redis unavailable"})
        await ws.close()
        return

    async def pump() -> None:
        async for msg in pubsub.listen():
            if msg.get("type") == "message":
                await ws.send_text(msg["data"])

    task = asyncio.create_task(pump())
    try:
        while True:
            await ws.receive_text()  # ping 用。クライアントからの内容は無視
    except WebSocketDisconnect:
        pass
    finally:
        task.cancel()
        await pubsub.unsubscribe(CHANNEL)
        await client.aclose()
