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
            "avg_lap_time": 0,          # ms
            "avg_time": 0,              # 호환키
            "rank": None,
            "start_time": race_status.get("start_time"),
        }

    laps = lap_data[name]
    ended = len(laps) >= total

    # ✅ 표준 평균(ms): (end - start) / total
    avg_ms = 0
    if laps and ended:
        start = laps[0]
        end = laps[-1]
        avg_ms = (end - start) // total

    return {
        "lap_times": laps,
        "ended": ended,
        "avg_lap_time": avg_ms,        # ms (서버/프론트에서 이 키 사용)
        "avg_time": avg_ms,            # 혹시 참조하는 곳 있을까봐 같이 내려줌
        "rank": None,
        "start_time": race_status.get("start_time"),
    }


