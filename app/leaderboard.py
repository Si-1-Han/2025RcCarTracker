# leaderboard.py
import json
from pathlib import Path
from app.config import CONFIG

# ✅ CONFIG에서 경로 가져오기
LEADERBOARD_FILE = Path(CONFIG.data.leaderboard_path)

def load_leaderboard():
    # 데이터 디렉토리가 없으면 생성
    LEADERBOARD_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    if LEADERBOARD_FILE.exists():
        with open(LEADERBOARD_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_leaderboard(data):
    # 데이터 디렉토리가 없으면 생성
    LEADERBOARD_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    with open(LEADERBOARD_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def insert_result(name, laps, avg_lap_time):
    board = load_leaderboard()
    board.append({
        "name": name,
        "laps": laps,
        "avg_lap_time": avg_lap_time,  # ms 단위
        "avg_lap_time_sec": round(avg_lap_time / 1000, 2)  # 초 단위 추가
    })
    board.sort(key=lambda x: x["avg_lap_time"])
    # ✅ CONFIG에서 최대 항목 수 가져오기
    board = board[:CONFIG.race.max_leaderboard_entries]

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
