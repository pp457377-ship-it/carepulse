from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..events import manager

router = APIRouter()


@router.websocket("/ws/events")
async def events_ws(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keepalive pings from the client
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(ws)
