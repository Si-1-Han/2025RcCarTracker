import serial
import time

PORT = 'COM6'  # 아두이노가 연결된 포트를 여기에 입력
BAUDRATE = 9600

try:
    with serial.Serial(PORT, BAUDRATE, timeout=1) as ser:
        print(f"📡 연결됨: {PORT} (baudrate={BAUDRATE})")
        time.sleep(2)  # 아두이노 리셋 대기

        while True:
            if ser.in_waiting > 0:
                raw = ser.readline()
                decoded = raw.decode('utf-8', errors='ignore').strip()
                print(f"📨 수신: {decoded}")
except serial.SerialException as e:
    print(f"❌ 시리얼 연결 실패: {e}")
except KeyboardInterrupt:
    print("⛔ 종료됨")