#!/usr/bin/env python3
"""
시리얼 포트 확인 및 테스트 도구
RC Tracker 프로젝트용 시리얼 포트 진단 유틸리티
"""

import serial
import serial.tools.list_ports
import time
import sys
import platform
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class SerialPortInfo:
    """시리얼 포트 정보를 담는 데이터 클래스"""
    device: str
    description: str
    hwid: str
    vid: Optional[int] = None
    pid: Optional[int] = None
    manufacturer: Optional[str] = None
    product: Optional[str] = None
    accessible: bool = False
    error_message: str = ""


class SerialPortChecker:
    """시리얼 포트 확인 및 테스트 클래스"""

    def __init__(self):
        self.ports: List[SerialPortInfo] = []

    def scan_ports(self) -> List[SerialPortInfo]:
        """모든 시리얼 포트를 스캔하고 정보를 수집"""
        print("🔍 시리얼 포트 스캔 중...")
        self.ports.clear()

        try:
            raw_ports = serial.tools.list_ports.comports()

            for port in raw_ports:
                port_info = SerialPortInfo(
                    device=port.device,
                    description=port.description,
                    hwid=port.hwid,
                    vid=port.vid,
                    pid=port.pid,
                    manufacturer=port.manufacturer,
                    product=port.product
                )

                # 포트 접근 가능성 테스트
                port_info.accessible, port_info.error_message = self._test_port_access(port.device)
                self.ports.append(port_info)

        except Exception as e:
            print(f"❌ 포트 스캔 중 오류 발생: {e}")

        return self.ports

    def _test_port_access(self, port: str) -> tuple[bool, str]:
        """특정 포트의 접근 가능성을 테스트"""
        try:
            with serial.Serial(port, 9600, timeout=0.5):
                return True, ""
        except PermissionError:
            return False, "권한 없음 (Permission denied)"
        except serial.SerialException as e:
            if "permission" in str(e).lower():
                return False, "권한 없음"
            elif "access" in str(e).lower():
                return False, "접근 거부"
            elif "busy" in str(e).lower():
                return False, "포트 사용 중"
            else:
                return False, f"시리얼 오류: {str(e)}"
        except Exception as e:
            return False, f"알 수 없는 오류: {str(e)}"

    def display_ports(self):
        """포트 정보를 보기 좋게 출력"""
        if not self.ports:
            print("❌ 사용 가능한 시리얼 포트를 찾을 수 없습니다.")
            return

        print(f"\n📋 총 {len(self.ports)}개의 시리얼 포트를 발견했습니다:")
        print("=" * 80)

        for i, port in enumerate(self.ports, 1):
            status = "✅ 접근 가능" if port.accessible else f"❌ {port.error_message}"

            print(f"\n[{i}] {port.device}")
            print(f"    설명: {port.description}")
            print(f"    하드웨어 ID: {port.hwid}")
            print(f"    상태: {status}")

            if port.vid and port.pid:
                print(f"    VID:PID: {port.vid:04X}:{port.pid:04X}")
            if port.manufacturer:
                print(f"    제조사: {port.manufacturer}")
            if port.product:
                print(f"    제품명: {port.product}")

    def get_arduino_ports(self) -> List[SerialPortInfo]:
        """아두이노 관련 포트만 필터링"""
        arduino_keywords = [
            "arduino", "ch340", "ch341", "cp210", "ftdi", "usb serial",
            "usb-serial", "silicon labs", "prolific"
        ]

        arduino_ports = []
        for port in self.ports:
            desc_lower = port.description.lower()
            hwid_lower = port.hwid.lower()

            # 아두이노 관련 키워드 검색
            if any(keyword in desc_lower or keyword in hwid_lower
                   for keyword in arduino_keywords):
                arduino_ports.append(port)

            # 일반적인 아두이노 VID 확인
            if port.vid in [0x2341, 0x1A86, 0x10C4, 0x0403]:  # Arduino, CH340, CP210x, FTDI
                arduino_ports.append(port)

        # 중복 제거
        seen = set()
        unique_ports = []
        for port in arduino_ports:
            if port.device not in seen:
                seen.add(port.device)
                unique_ports.append(port)

        return unique_ports

    def test_communication(self, port: str, baudrate: int = 9600, timeout: float = 2.0):
        """특정 포트에서 통신 테스트"""
        print(f"\n🔧 {port} 포트 통신 테스트 중...")
        print(f"   보드레이트: {baudrate}, 타임아웃: {timeout}초")

        try:
            with serial.Serial(port, baudrate, timeout=timeout) as ser:
                print("✅ 포트 연결 성공!")

                # 짧은 시간 대기
                time.sleep(0.5)

                # 버퍼에 데이터가 있는지 확인
                if ser.in_waiting > 0:
                    try:
                        data = ser.read(ser.in_waiting)
                        print(f"📨 수신된 데이터: {data}")
                        try:
                            decoded = data.decode('utf-8', errors='ignore')
                            if decoded.strip():
                                print(f"📝 디코딩된 텍스트: '{decoded.strip()}'")
                        except:
                            pass
                    except Exception as e:
                        print(f"⚠️  데이터 읽기 오류: {e}")
                else:
                    print("📭 수신된 데이터 없음")

                # 간단한 테스트 명령 전송 (선택적)
                try:
                    test_commands = [b'?\r\n', b'AT\r\n', b'INFO\r\n']
                    for cmd in test_commands:
                        ser.write(cmd)
                        time.sleep(0.1)
                        if ser.in_waiting > 0:
                            response = ser.read(ser.in_waiting)
                            print(f"📤 명령: {cmd} → 📥 응답: {response}")
                            break
                    else:
                        print("📤 테스트 명령 전송했으나 응답 없음")
                except Exception as e:
                    print(f"⚠️  명령 전송 오류: {e}")

        except Exception as e:
            print(f"❌ 포트 테스트 실패: {e}")

    def check_permissions(self):
        """권한 상태 확인"""
        print("\n🔐 권한 상태 확인:")

        os_name = platform.system()

        if os_name == "Linux" or os_name == "Darwin":  # macOS
            import os
            import grp

            try:
                groups = [grp.getgrgid(gid).gr_name for gid in os.getgroups()]
                print(f"현재 사용자 그룹: {', '.join(groups)}")

                if 'dialout' in groups:
                    print("✅ dialout 그룹에 포함됨 - 시리얼 포트 접근 권한 있음")
                else:
                    print("❌ dialout 그룹에 포함되지 않음")
                    print("💡 해결방법: sudo usermod -a -G dialout $USER")
                    print("   그 후 로그아웃 후 재로그인 필요")
            except Exception as e:
                print(f"그룹 정보 확인 실패: {e}")

        elif os_name == "Windows":
            print("Windows 환경 - 관리자 권한 확인")
            try:
                import ctypes
                is_admin = ctypes.windll.shell32.IsUserAnAdmin()
                if is_admin:
                    print("✅ 관리자 권한으로 실행 중")
                else:
                    print("⚠️  일반 사용자 권한으로 실행 중")
                    print("💡 일부 포트 접근에 관리자 권한이 필요할 수 있음")
            except Exception as e:
                print(f"권한 확인 실패: {e}")

    def suggest_solutions(self):
        """권한 문제 해결 방안 제시"""
        print("\n💡 권한 문제 해결 방안:")

        os_name = platform.system()

        if os_name == "Linux":
            print("Linux 환경:")
            print("1. sudo usermod -a -G dialout $USER")
            print("2. 로그아웃 후 재로그인")
            print("3. 임시방편: sudo chmod 666 /dev/ttyUSB0 (또는 해당 포트)")

        elif os_name == "Darwin":  # macOS
            print("macOS 환경:")
            print("1. sudo dscl . append /Groups/wheel GroupMembership $(whoami)")
            print("2. 또는 sudo chmod 666 /dev/tty.usbserial-* (해당 포트)")

        elif os_name == "Windows":
            print("Windows 환경:")
            print("1. PowerShell을 관리자 권한으로 실행")
            print("2. 또는 Command Prompt를 관리자 권한으로 실행")
            print("3. 장치 관리자에서 드라이버 상태 확인")


def main():
    """메인 실행 함수"""
    print("🚗 RC Tracker 시리얼 포트 진단 도구")
    print("=" * 50)

    checker = SerialPortChecker()

    # 1. 포트 스캔
    ports = checker.scan_ports()
    checker.display_ports()

    # 2. 아두이노 관련 포트 표시
    arduino_ports = checker.get_arduino_ports()
    if arduino_ports:
        print(f"\n🔌 아두이노/마이크로컨트롤러 관련 포트 ({len(arduino_ports)}개):")
        for port in arduino_ports:
            status = "✅" if port.accessible else "❌"
            print(f"  {status} {port.device} - {port.description}")

    # 3. 권한 상태 확인
    checker.check_permissions()

    # 4. 접근 가능한 포트가 있다면 테스트 제안
    accessible_ports = [p for p in ports if p.accessible]
    if accessible_ports:
        print(f"\n🧪 통신 테스트 가능한 포트: {len(accessible_ports)}개")

        if len(accessible_ports) == 1:
            # 포트가 하나면 자동으로 테스트
            port = accessible_ports[0]
            print(f"자동으로 {port.device} 테스트를 진행합니다...")
            checker.test_communication(port.device)
        else:
            # 여러 포트가 있으면 선택 옵션 제공
            print("테스트할 포트를 선택하세요:")
            for i, port in enumerate(accessible_ports, 1):
                print(f"  {i}. {port.device} - {port.description}")

            try:
                choice = input("\n포트 번호를 입력하세요 (Enter: 건너뛰기): ").strip()
                if choice.isdigit():
                    idx = int(choice) - 1
                    if 0 <= idx < len(accessible_ports):
                        selected_port = accessible_ports[idx]
                        checker.test_communication(selected_port.device)
            except (ValueError, KeyboardInterrupt):
                print("테스트를 건너뜁니다.")

    # 5. 권한 문제가 있다면 해결 방안 제시
    permission_issues = [p for p in ports if not p.accessible and "권한" in p.error_message]
    if permission_issues:
        checker.suggest_solutions()

    # 6. RC Tracker 설정 권장사항
    print("\n⚙️  RC Tracker 설정 권장사항:")
    if accessible_ports:
        recommended = accessible_ports[0]
        print(f"추천 포트: {recommended.device}")
        print(f".env 파일 설정:")
        print(f"SERIAL_PORT={recommended.device}")
        print("SERIAL_BAUDRATE=9600")
        print("SERIAL_TIMEOUT=1")
    else:
        print("접근 가능한 포트가 없습니다.")
        print("목업 모드 사용을 권장합니다:")
        print("SERIAL_PORT=MOCK")

    print("\n✅ 진단 완료!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 사용자가 중단했습니다.")
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류 발생: {e}")
        import traceback

        traceback.print_exc()