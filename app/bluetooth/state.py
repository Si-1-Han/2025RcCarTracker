# app/bluetooth/state.py
from collections import defaultdict

runner = {
    "name": None,
    "total_laps": 0
}

lap_data = defaultdict(list)

race_status = {
    "ended": False,
    "avg_time": 0,
    "start_time": None
}

def reset_state():
    runner["name"] = None
    runner["total_laps"] = 0
    lap_data.clear()
    race_status["ended"] = False
    race_status["avg_time"] = 0

def get_status():
    name = runner["name"]
    total = runner["total_laps"]

    if not name or name not in lap_data:
        return {
            "lap_times": [],
            "ended": False,
            "avg_time": 0,
            "rank": None
        }

    laps = lap_data[name]
    ended = len(laps) >= total
    avg = sum(laps) // total if ended else 0

    return {
        "lap_times": laps,
        "ended": ended,
        "avg_time": avg,
        "rank": None
    }
