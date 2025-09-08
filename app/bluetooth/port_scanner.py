import serial.tools.list_ports

def find_first_usable_port(exclude_ports=None):
    exclude_ports = exclude_ports or []
    ports = serial.tools.list_ports.comports()
    candidates = [p.device for p in ports if p.device not in exclude_ports]

    print(f"✅ 연결 가능한 포트 후보: {candidates}")

    for port in candidates:
        try:
            with serial.Serial(port, 9600, timeout=1) as ser:
                return port
        except Exception:
            continue
    return None
