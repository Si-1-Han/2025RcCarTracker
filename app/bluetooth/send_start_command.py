import serial
import time


def send_start_command(port="COM6", baudrate=9600, laps=3):
    try:
        with serial.Serial(port, baudrate, timeout=2) as ser:
            # 명령 구성
            command = f"START {laps}\n"
            print(f"📤 Sending command: {command.strip()} to {port}")

            ser.write(command.encode())
            time.sleep(1)  # 잠시 대기

            # 응답 확인 (optional)
            if ser.in_waiting:
                response = ser.readline().decode().strip()
                print(f"📥 Response: {response}")
            else:
                print("⚠️ No response received.")

    except serial.SerialException as e:
        print(f"❌ Serial error: {e}")


if __name__ == "__main__":
    send_start_command()
