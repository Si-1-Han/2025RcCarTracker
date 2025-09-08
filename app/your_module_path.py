import serial.tools.list_ports

def find_bluetooth_port(keyword="HC-06"):
    ports = serial.tools.list_ports.comports()
    for port in ports:
        if keyword.lower() in port.description.lower() or keyword.lower() in port.device.lower():
            print(f"🔍 Found {keyword} on {port.device}")
            return port.device
    print(f"❌ No Bluetooth device with keyword '{keyword}' found.")
    return None

# 사용 예시
if __name__ == "__main__":
    bt_port = find_bluetooth_port("HC-06")
    if bt_port:
        try:
            ser = serial.Serial(bt_port, 9600, timeout=1)
            print(f"✅ 연결 성공: {bt_port}")
            ser.close()
        except Exception as e:
            print(f"⚠️ 포트 열기 실패: {e}")
