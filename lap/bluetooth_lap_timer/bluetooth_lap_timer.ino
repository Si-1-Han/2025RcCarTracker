// 기존 핀 설정 유지
#define TRIG_PIN 8
#define ECHO_PIN 9

// 쿨다운 설정 추가
#define COOLDOWN_TIME 3000  // 3초 쿨다운 (밀리초)

// 기존 변수들
bool isWaiting = false;
bool isRacing = false;
int lapCount = 0;
int totalLaps = 0;
unsigned long lapStartTime = 0;

// 쿨다운 관련 변수 추가
unsigned long lastDetectionTime = 0;  // 마지막 감지 시간
bool isObjectDetected = false;        // 현재 객체 감지 상태

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.begin(9600);  // HC-06 과 직접 통신
}

long getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH);
  return duration * 0.034 / 2;
}

bool canDetectNewLap(unsigned long currentTime) {
  // 쿨다운 시간 체크
  return (currentTime - lastDetectionTime) >= COOLDOWN_TIME;
}

void loop() {
  unsigned long currentTime = millis();
  long distance = getDistance();
  
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    if (cmd.startsWith("START")) {
      totalLaps = cmd.substring(6).toInt();
      lapCount = 0;
      isWaiting = true;
      isRacing = false;
      // 쿨다운 상태 리셋
      lastDetectionTime = 0;
      isObjectDetected = false;
      Serial.println("WAITING_FOR_TRIGGER");
    }
  }

  // 대기 상태에서 첫 번째 감지 (쿨다운 적용)
  if (isWaiting && distance < 15) {
    if (!isObjectDetected && canDetectNewLap(currentTime)) {
      lapStartTime = millis();
      isWaiting = false;
      isRacing = true;
      lastDetectionTime = currentTime;
      Serial.println("RACE_STARTED");
    }
    isObjectDetected = true;
  } else if (isWaiting && distance >= 15) {
    isObjectDetected = false;
  }

  // 레이스 중 랩 감지 (쿨다운 적용)
  if (isRacing && distance < 15) {
    if (!isObjectDetected && canDetectNewLap(currentTime)) {
      unsigned long currentLap = millis() - lapStartTime;
      lapCount++;
      lastDetectionTime = currentTime;
      
      Serial.print("LAP:");
      Serial.println(currentLap);

      if (lapCount >= totalLaps) {
        isRacing = false;
        Serial.println("RACE_ENDED");
      }
    }
    isObjectDetected = true;
  } else if (isRacing && distance >= 15) {
    isObjectDetected = false;
  }
  
  delay(50);  // 센서 읽기 간격 (기존 delay(500) 대신)
}