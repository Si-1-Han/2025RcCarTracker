# app/events.py
import time
import json
from queue import Queue, Empty
from typing import Dict, Any, Generator

# 내부 버스/캐시
_event_bus: "Queue[Dict[str, Any]]" = Queue()
_latest_lap: Dict[str, Any] = {"id": None, "ms": None}

# 공통 publish
def _publish(event_type: str, payload: Dict[str, Any]) -> None:
    _event_bus.put({"type": event_type, "payload": payload})

# === 공개 API (리스너에서 호출) ==============================================
def publish_race_started(ts_ms: int) -> None:
    _publish("race_started", {"ts": int(ts_ms)})

def publish_lap(seg_ms: int) -> None:
    """기존 코드가 부르는 이름/시그니처 유지 (후방호환)."""
    lap_id = int(time.time() * 1000)
    _latest_lap.update({"id": lap_id, "ms": int(seg_ms)})
    _publish("lap", {"id": lap_id, "ms": int(seg_ms)})

def publish_race_ended(ts_ms: int) -> None:
    _publish("race_ended", {"ts": int(ts_ms)})

def get_latest_lap() -> Dict[str, Any]:
    return dict(_latest_lap)

# === SSE 제너레이터 ===========================================================
def sse_generator() -> Generator[str, None, None]:
    # 초기 keep-alive
    yield "event: ping\ndata: {}\n\n"
    while True:
        try:
            ev = _event_bus.get(timeout=25)
            et = ev.get("type") or "message"
            payload = ev.get("payload") or {}
            yield f"event: {et}\n" + f"data: {json.dumps(payload)}\n\n"
        except Empty:
            yield "event: ping\ndata: {}\n\n"
