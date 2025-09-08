# leaderboard.py
import json
from pathlib import Path

LEADERBOARD_FILE = Path("data/leaderboard.json")

def load_leaderboard():
    if LEADERBOARD_FILE.exists():
        with open(LEADERBOARD_FILE, "r") as f:
            return json.load(f)
    return []

def save_leaderboard(data):
    with open(LEADERBOARD_FILE, "w") as f:
        json.dump(data, f, indent=2)

def insert_result(name, laps, avg_lap_time):
    board = load_leaderboard()
    board.append({
        "name": name,
        "laps": laps,
        "avg_lap_time": avg_lap_time,  # ms 단위
        "avg_lap_time_sec": round(avg_lap_time / 1000, 2)  # 초 단위 추가
    })
    board.sort(key=lambda x: x["avg_lap_time"])
    board = board[:10]

    for i, entry in enumerate(board):
        entry["rank"] = i + 1

    save_leaderboard(board)
    return board


def get_rank(avg_lap_time):
    board = load_leaderboard()
    sorted_board = sorted(board, key=lambda x: x["avg_lap_time"])
    for index, entry in enumerate(sorted_board):
        if avg_lap_time <= entry["avg_lap_time"]:
            return index + 1
    return None  # 상위 10위 밖일 경우