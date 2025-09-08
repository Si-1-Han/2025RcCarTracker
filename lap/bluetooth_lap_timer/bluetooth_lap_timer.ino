// 삭제: SoftwareSerial BTSerial(10, 11);
#define TRIG_PIN 8
#define ECHO_PIN 9

bool isWaiting = false;
bool isRacing = false;
int lapCount = 0;
int totalLaps = 0;
unsigned long lapStartTime = 0;

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

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    if (cmd.startsWith("START")) {
      totalLaps = cmd.substring(6).toInt();
      lapCount = 0;
      isWaiting = true;
      isRacing = false;
      Serial.println("WAITING_FOR_TRIGGER");
    }
  }

  if (isWaiting && getDistance() < 15) {
    lapStartTime = millis();
    isWaiting = false;
    isRacing = true;
    Serial.println("RACE_STARTED");
    delay(500);
  }

  if (isRacing && getDistance() < 15) {
    unsigned long currentLap = millis() - lapStartTime;
    lapCount++;
    Serial.print("LAP:");
    Serial.println(currentLap);
    delay(500);

    if (lapCount >= totalLaps) {
      isRacing = false;
      Serial.println("RACE_ENDED");
    }
  }
}
