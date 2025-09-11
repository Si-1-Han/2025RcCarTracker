from app.bluetooth.state import runner, lap_data, race_status
from app.bluetooth.listener import send_command  # ✅ 새로 추가한 함수만 사용

def set_target_runner(name, laps):
    runner["name"] = name
    runner["total_laps"] = laps
    lap_data.clear()
    race_status["ended"] = False
    race_status["avg_lap_time"] = 0
    race_status["start_time"] = None

    print(f"🎯 Target set: {name}, {laps} laps")
    # 포트는 listener가 이미 열어둠 → 거기로 전송
    send_command(f"START {laps}")

def reset_lap_data():
    lap_data.clear()
    runner["name"] = None
    runner["total_laps"] = 0
    race_status["ended"] = False
    race_status["avg_lap_time"] = 0
    print("🧹 Lap 데이터 초기화 완료")


def get_current_laps():
    name = runner["name"]
    total = runner["total_laps"]

    if not name or name not in lap_data:
        return {
            "lap_times": [],
            "ended": False,
            "avg_lap_time": 0,
            "avg_time": 0,
            "rank": None,
            "start_time": race_status.get("start_time"),
        }

    laps = lap_data[name]
    ended = len(laps) >= total

    avg_ms = 0
    if ended and len(laps) > 1:
        # 각 랩 간격 계산
        durations = [laps[i] - laps[i-1] for i in range(1, len(laps))]
        avg_ms = sum(durations) // len(durations)

    return {
        "lap_times": laps,
        "ended": ended,
        "avg_lap_time": avg_ms,  # ms
        "avg_time": avg_ms,      # 호환 키
        "rank": None,
        "start_time": race_status.get("start_time"),
    }
