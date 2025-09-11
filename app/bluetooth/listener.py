# app/bluetooth/listener.py

import threading
import serial
from time import time
from app.bluetooth.state import runner, lap_data, race_status
from app.leaderboard import insert_result
from app.bluetooth.port_scanner import find_first_usable_port
from app.events import (
    publish_race_started,
    publish_lap,
    publish_race_ended,
)

BAUDRATE = 9600
LISTENING_PORT = "COM5"

# ✅ 전역 시리얼 핸들
SER_HANDLE = None

def send_command(cmd: str) -> bool:
    """
    하드웨어로 텍스트 명령을 전송.
    예: send_command("START"), send_command("RESET")
    """
    global SER_HANDLE
    try:
        if SER_HANDLE and SER_HANDLE.is_open:
            payload = (cmd.strip() + "\n").encode("utf-8", errors="ignore")
            SER_HANDLE.write(payload)
            SER_HANDLE.flush()
            print(f"[TX] {cmd}")
            return True
        else:
            print("[TX] 실패: 시리얼 포트가 열려있지 않습니다.")
            return False
    except Exception as e:
        print(f"[TX] 예외: {e}")
        return False


def start_listener(insert_result_callback):
    def listen():
        global SER_HANDLE
        try:
            with serial.Serial(LISTENING_PORT, BAUDRATE, timeout=1) as ser:
                SER_HANDLE = ser  # ✅ 전역 핸들 보관
                print(f"📡 Listening on {LISTENING_PORT}...")
                while True:
                    if ser.in_waiting:
                        raw = ser.readline()
                        decoded = raw.decode(errors="ignore").strip()
                        if decoded:
                            handle_message(decoded, insert_result_callback)
        except Exception as e:
            print(f"❌ Serial Error: {e}")

    thread = threading.Thread(target=listen)
    thread.daemon = True
    thread.start()


def handle_message(line, insert_result_callback):
    print(f"📥 수신 데이터: {line}")

    if line == "RACE_STARTED":
        race_status["ended"] = False
        race_status["start_time"] = int(time() * 1000)
        publish_race_started(race_status["start_time"])
        print("🚦 경주 시작됨")

    elif line.startswith("LAP:"):
        try:
            lap_time = int(line[4:])
            name = runner["name"]
            total = runner["total_laps"]

            if not name or total == 0:
                print("⚠️ 유효하지 않은 상태, 무시됨.")
                return

            lap_data[name].append(lap_time)
            print(f"⏱️ {name} - Lap {len(lap_data[name])}: {lap_time} ms")

            # 구간 시간(seg) 계산
            if len(lap_data[name]) == 1:
                seg = lap_time
            else:
                seg = lap_time - lap_data[name][-2]

            publish_lap(seg)

            # 마지막 랩까지 도달했을 때 처리
            if len(lap_data[name]) >= total:
                laps = lap_data[name]
                durations = [laps[i] - laps[i - 1] for i in range(1, len(laps))]
                avg = sum(durations) // len(durations)

                race_status["ended"] = True
                race_status["avg_time"] = avg
                race_status["start_time"] = laps[0]

                insert_result_callback(name, total, avg)
                print(f"✅ {name} 완료! 평균: {avg}ms")



        except ValueError:
            print("⚠️ LAP 값 파싱 실패")

    elif line == "RACE_ENDED":
        race_status["ended"] = True
        publish_race_ended(int(time() * 1000))
        print("🏁 경주 종료")
