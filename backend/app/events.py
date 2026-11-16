import asyncio

from fastapi import WebSocket


class ConnectionManager:
    """In-process WebSocket broadcast hub for live dashboard updates."""

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, ws: WebSocket) -> None:
        self.loop = asyncio.get_running_loop()
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def broadcast(self, event: str, data: dict) -> None:
        async with self._lock:
            clients = list(self._clients)
        dead = []
        for ws in clients:
            try:
                await ws.send_json({"event": event, "data": data})
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._clients.discard(ws)

    def broadcast_threadsafe(self, event: str, data: dict) -> None:
        """Schedule a broadcast from sync (threadpool) route handlers onto the server loop."""
        loop = self.loop
        if loop is None or loop.is_closed() or not self._clients:
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is loop:
            loop.create_task(self.broadcast(event, data))
        else:
            asyncio.run_coroutine_threadsafe(self.broadcast(event, data), loop)


manager = ConnectionManager()
