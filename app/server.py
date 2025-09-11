import os
import json
from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context
from flask_cors import CORS
from threading import Thread

from app.bluetooth.listener import start_listener
from app.bluetooth.communication import set_target_runner, reset_lap_data, get_current_laps
from app.leaderboard import load_leaderboard, save_leaderboard, insert_result
from app.bluetooth.state import runner
from app.events import sse_generator   # ✅ events.py의 SSE 제너레이터 사용

# ── 프로젝트 경로 설정 ───────────────────────────────────
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

# ✅ frontend 전체를 정적 root로
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)

# ── SSE 라우트 (events.sse_generator 사용) ─────────────────
@app.route('/events')
def sse_events():
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return Response(stream_with_context(sse_generator()), headers=headers)

# ── 정적 페이지 라우트 ───────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/status")
def status():
    return send_from_directory(FRONTEND_DIR, "status.html")

@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory(FRONTEND_DIR, filename)

# ── API 엔드포인트 ──────────────────────────────────────
@app.post("/start")
def start_race():
    data = request.get_json() or {}
    name = data.get("name")
    laps = data.get("laps")

    if not name or not laps:
        return jsonify({"error": "Missing name or laps"}), 400

    try:
        set_target_runner(name, int(laps))
        return jsonify({"message": "Race started"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/reset")
def reset():
    save_leaderboard([])
    reset_lap_data()
    return jsonify({"message": "리더보드 초기화 완료"})

@app.get("/result")
def get_leaderboard():
    data = load_leaderboard()
    return jsonify([
        {
            "rank": item.get("rank", idx + 1),
            "name": item["name"],
            "laps": item["laps"],
            "avg_lap_time": item.get("avg_lap_time_sec", round(item["avg_lap_time"] / 1000, 2))
        }
        for idx, item in enumerate(data)
    ])

@app.get("/laps")
def laps():
    status = get_current_laps() or {}

    # rank 계산 (네가 쓰던 방식 유지)
    rank = None
    if status.get("ended"):
        data = load_leaderboard()
        for entry in data:
            if entry.get("name") == runner.get("name"):
                rank = entry.get("rank")
                break

    return jsonify({
        "laps": status.get("lap_times", []),
        "status": "ENDED" if status.get("ended") else "RACING",
        "avg_lap_time": status.get("avg_lap_time"),   # ms
        "rank": rank if rank is not None else "N/A",
        "start_time": status.get("start_time"),
        "name": runner.get("name"),                   # ✅ 추가
        "total_laps": runner.get("total_laps"),
    })


# ── 실행 ────────────────────────────────────────────────
def run():
    Thread(target=start_listener, args=(insert_result,), daemon=True).start()
    app.run(debug=False)
