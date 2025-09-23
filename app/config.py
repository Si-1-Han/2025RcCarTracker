import os
from dataclasses import dataclass
from typing import List

@dataclass
class SerialConfig:
    """시리얼 통신 설정"""
    port: str = "COM5"
    baudrate: int = 9600
    timeout: float = 1.0
    auto_detect: bool = False  # 기존 동작 유지를 위해 False로 시작

@dataclass
class ServerConfig:
    """웹 서버 설정"""
    host: str = "0.0.0.0"  # Docker 컨테이너에서 외부 접근을 위해 0.0.0.0 사용
    port: int = 5000
    debug: bool = False

@dataclass
class DataConfig:
    """데이터 관리 설정"""
    data_dir: str = "data"
    leaderboard_file: str = "leaderboard.json"
    
    @property
    def leaderboard_path(self) -> str:
        return os.path.join(self.data_dir, self.leaderboard_file)

@dataclass
class RaceConfig:
    """레이스 규칙 설정"""
    min_laps: int = 1
    max_laps: int = 20
    default_laps: int = 5
    max_leaderboard_entries: int = 10

@dataclass
class AppConfig:
    """애플리케이션 전체 설정"""
    serial: SerialConfig = SerialConfig()
    server: ServerConfig = ServerConfig()
    data: DataConfig = DataConfig()
    race: RaceConfig = RaceConfig()

def load_config() -> AppConfig:
    """환경변수에서 설정을 로드"""
    config = AppConfig()
    
    # 서버 설정
    if os.getenv("DEBUG"):
        config.server.debug = os.getenv("DEBUG").lower() == "true"
    
    if os.getenv("SERVER_HOST"):
        config.server.host = os.getenv("SERVER_HOST")
    
    if os.getenv("SERVER_PORT"):
        try:
            config.server.port = int(os.getenv("SERVER_PORT"))
        except ValueError:
            pass
    
    # 시리얼 설정
    if os.getenv("SERIAL_PORT"):
        config.serial.port = os.getenv("SERIAL_PORT")
    
    if os.getenv("SERIAL_BAUDRATE"):
        try:
            config.serial.baudrate = int(os.getenv("SERIAL_BAUDRATE"))
        except ValueError:
            pass
    
    if os.getenv("SERIAL_AUTO_DETECT"):
        config.serial.auto_detect = os.getenv("SERIAL_AUTO_DETECT").lower() == "true"
    
    # 데이터 설정
    if os.getenv("DATA_DIR"):
        config.data.data_dir = os.getenv("DATA_DIR")
    
    # 레이스 설정
    if os.getenv("MAX_LAPS"):
        try:
            config.race.max_laps = int(os.getenv("MAX_LAPS"))
        except ValueError:
            pass
    
    if os.getenv("DEFAULT_LAPS"):
        try:
            config.race.default_laps = int(os.getenv("DEFAULT_LAPS"))
        except ValueError:
            pass
    
    return config

# 글로벌 설정 인스턴스
CONFIG = load_config()
