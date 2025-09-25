# 2025 RC Car Tracker

RC 카 랩타임 트래킹 시스템

## 시스템 요구사항

### 기본 설정
- **COM 포트**: COM5 (아래에서 변경 예정)
- **블루투스 모듈**: HC-06 (비밀번호: 1234)

### 필요 프로그램
- Git
- Python 3.12 이상
- PyCharm (권장)

## 설치 및 실행 방법

### 1. 프로젝트 클론

프로젝트 폴더에서 마우스 우클릭 → `Open Git Bash Here` 클릭 후 다음 명령어 실행:

```bash
git clone https://github.com/Si-1-Han/2025RcCarTracker.git
```

### 2. Python 가상환경 설정

프로젝트 루트 디렉토리에서 다음 명령어들을 순서대로 실행:

```bash
# 가상환경 생성
python -m venv venv

# 가상환경 활성화 (Windows)
venv\Scripts\activate.bat

# 의존성 설치
pip install -r requirements.txt
```

### 3. 개발환경 설정

PyCharm을 열고 `Ctrl + O`를 눌러 해당 프로젝트 폴더를 지정합니다.

#### Python 인터프리터 설정

1. PyCharm에서 Python 인터프리터 구성을 클릭
2. 가상환경 구성하기 때문에, 해당 환경을 사용할 것입니다
3. 새 인터프리터 추가 → 로컬 인터프리터 추가로 진입
4. `2025RcCarTracker\venv\Scripts\python.exe`에 있는 `python.exe`를 찾고 확인 - 확인을 누릅니다

#### 실행 구성 설정

1. 상단의 시작 버튼 좌측의 실행 / 디버그 구성 간을 '현재 파일'로 맞춤
2. 우측의 화살표를 누르면 팝업이 뜨는데, 여기서 해당 프로젝트를 찾은 뒤
3. `2025RcCarTracker\venv\Scripts\python.exe`에 있는 python.exe를 찾고 확인 - 확인을 누릅니다

마지막으로, 작업 파일들 중 `main.py`를 더블클릭 한 뒤 상단의 시작 버튼 좌측의 실행 / 디버그 구성 간을 '현재 파일'로 맞춤 놓고 우측의 화살표를 누르면 팝업이 뜹니다.

### 4. 블루투스 및 장치 연결

#### 장치 추가
장치 추가 → Bluetooth → 모든 장치 표시 → HC-06 → 1234 입력 후 확인

#### 시리얼 포트 확인
`serial_port_checker.py` 실행

테스트할 포트를 선택하세요: 아래에 나온 포트 (COM5, COM6 등) 을 config.py에 기입합니다.

#### config.py 설정

```python
@dataclass
class SerialConfig:
    """시리얼 통신 설정"""
    port: str = "COM5"
    baudrate: int = 9600
    timeout: float = 1.0
    auto_detect: bool = False  # 기존 동작 유지를 위해 False로 시작
```

해당 COM5 부분을 프로그램이 추천한 포트로 바꿔가며 `main.py`를 실행하며 테스트합니다.

### 5. 실행

테스트 시 정상적으로 인식하면 준비가 완료된 것입니다.

## 프로젝트 구조

```
2025RcCarTracker/
├── app/
│   ├── config.py              # 설정 관리
│   ├── bluetooth/            # 블루투스 통신 모듈
│   ├── events.py             # SSE 이벤트 처리
│   ├── server.py             # Flask 웹 서버
│   └── ...
├── frontend/
│   ├── index.html            # 메인 웹 페이지
│   ├── app.js               # 프론트엔드 JavaScript
│   └── style.css            # 스타일시트
├── data/
│   └── leaderboard.json     # 리더보드 데이터
├── requirements.txt         # Python 의존성
└── main.py                 # 메인 실행 파일
```

## 사용 방법

1. `main.py` 실행
2. 웹 브라우저에서 `http://localhost:5000` 접속
3. 참가자 이름과 랩 수 입력
4. "경주 시작하기" 버튼 클릭
5. RC 카가 센서를 통과하면 자동으로 랩타임 기록
6. 레이스 완료 후 결과 확인 및 리더보드에 저장

## 기술 스택

- **백엔드**: Python, Flask
- **프론트엔드**: HTML, CSS, JavaScript
- **통신**: Serial (Bluetooth), Server-Sent Events (SSE)
- **하드웨어**: Arduino, HC-06 블루투스 모듈, 초음파 센서
