// 개선된 app.js - SSE 안정성 및 에러 처리 강화
class RaceTimerApp {
  constructor() {
    this.BASE_URL = "";
    this.timerInterval = null;
    this.raceStartTime = null;
    this.lapCount = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventSource = null;
    this.config = null;
    this.raceState = 'idle'; // idle, running, finished
    this.lapTimes = [];
    this.sseReconnectTimeout = null;
    
    this.initializeElements();
    this.bindEvents();
    this.init();
  }
  
  initializeElements() {
    // DOM 요소 캐싱
    this.elements = {
      mainTimer: document.getElementById("mainTimer"),
      lapList: document.getElementById("lapList"),
      resultBox: document.getElementById("resultBox"),
      rcName: document.getElementById("rcName"),
      rcAvg: document.getElementById("rcAvg"),
      rcRank: document.getElementById("rcRank"),
      statusLine: document.getElementById("statusLine"),
      leaderboardBody: document.getElementById("leaderboardBody"),
      leaderboardEmpty: document.getElementById("leaderboardEmpty"),
      driverName: document.getElementById("driverName"),
      totalLaps: document.getElementById("totalLaps"),
      btnStart: document.getElementById("btnStart"),
      btnReset: document.getElementById("btnReset"),
      toastHost: document.getElementById("toastHost")
    };
  }
  
  bindEvents() {
    this.elements.btnStart.onclick = () => this.startRace();
    this.elements.btnReset.onclick = () => this.resetRace();
    
    // 엔터키로 레이스 시작
    this.elements.driverName.onkeypress = (e) => {
      if (e.key === 'Enter' && this.raceState === 'idle') this.startRace();
    };
    this.elements.totalLaps.onkeypress = (e) => {
      if (e.key === 'Enter' && this.raceState === 'idle') this.startRace();
    };
    
    // 페이지 언로드 시 정리
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
    
    // 페이지 포커스/블러 이벤트 처리
    window.addEventListener('focus', () => {
      if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
        console.log("🔄 페이지 포커스로 인한 SSE 재연결");
        this.connectToSSE();
      }
    });
  }
  
  // 유틸리티 함수들
  pad(n, w) {
    return String(n).padStart(w, '0');
  }
  
  formatTime(ms) {
    if (!ms || ms < 0) return "00:00.000";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const x = ms % 1000;
    return `${this.pad(m, 2)}:${this.pad(s, 2)}.${this.pad(x, 3)}`;
  }
  
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    
    const colors = {
      info: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444'
    };
    
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      background-color: ${colors[type] || colors.info};
      color: white;
      font-weight: 500;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 400px;
      word-wrap: break-word;
    `;
    
    this.elements.toastHost.appendChild(toast);
    
    // 애니메이션
    setTimeout(() => toast.style.opacity = '1', 10);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }
  
  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(this.BASE_URL + url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`Request failed: ${url}`, error);
      throw error;
    }
  }
  
  validateInputs() {
    const name = this.elements.driverName.value.trim();
    const laps = parseInt(this.elements.totalLaps.value);
    
    const errors = [];
    
    if (!name) {
      errors.push("참가자 이름을 입력해주세요");
    } else if (name.length > 20) {
      errors.push("참가자 이름은 20자 이내로 입력해주세요");
    } else if (!/^[가-힣a-zA-Z0-9\s]+$/.test(name)) {
      errors.push("참가자 이름에 특수문자는 사용할 수 없습니다");
    }
    
    if (!laps || isNaN(laps)) {
      errors.push("유효한 랩 수를 입력해주세요");
    } else if (this.config) {
      if (laps < this.config.min_laps) {
        errors.push(`최소 ${this.config.min_laps}랩 이상 설정해주세요`);
      } else if (laps > this.config.max_laps) {
        errors.push(`최대 ${this.config.max_laps}랩까지 설정 가능합니다`);
      }
    }
    
    return { valid: errors.length === 0, errors, name, laps };
  }
  
  ensureLapTable() {
    let rows = document.getElementById("lapRows");
    if (!rows) {
      this.elements.lapList.innerHTML = `
        <div class="lap-header">
          <span>LAP</span>
          <span>소요시간</span>
          <span>총 시간</span>
        </div>
        <div id="lapRows"></div>
      `;
      rows = document.getElementById("lapRows");
    }
    return rows;
  }
  
  renderLapRow(lapNumber, segmentTime, totalTime) {
    const rows = this.ensureLapTable();
    const row = document.createElement("div");
    row.className = "lap-row";
    row.innerHTML = `
      <span>Lap ${lapNumber}</span>
      <span>${this.formatTime(segmentTime)}</span>
      <span>${this.formatTime(totalTime)}</span>
    `;
    rows.appendChild(row);
    
    // 스크롤 최하단으로
    this.elements.lapList.scrollTop = this.elements.lapList.scrollHeight;
    
    console.log(`랩 ${lapNumber}: 구간시간 ${segmentTime}ms, 총 시간 ${totalTime}ms`);
  }
  
  startUiTimer(startTimestamp) {
    console.log("타이머 시작:", new Date(startTimestamp));
    
    this.raceStartTime = startTimestamp;
    
    // 기존 타이머 정리 (레이스 상태는 변경하지 않음)
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    // 🔥 raceState를 running으로 설정 (순서 중요!)
    this.raceState = 'running';
    
    // 새 타이머 시작
    this.timerInterval = setInterval(() => {
      if (this.raceStartTime && this.raceState === 'running') {
        const elapsed = Date.now() - this.raceStartTime;
        this.elements.mainTimer.textContent = this.formatTime(elapsed);
      }
    }, 50);
    
    // UI 상태 업데이트
    this.elements.btnStart.disabled = true;
    this.elements.btnStart.textContent = "레이스 진행 중";
    this.elements.statusLine.textContent = "레이스 진행 중";
  }
  
  stopUiTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    this.raceState = 'finished';
    console.log("타이머 정지");
  }
  
  resetRaceUI() {
    this.stopUiTimer();
    this.raceStartTime = null;
    this.lapCount = 0;
    this.lapTimes = [];
    this.raceState = 'idle';
    
    // UI 초기화
    this.elements.mainTimer.textContent = "00:00.000";
    this.elements.btnStart.disabled = false;
    this.elements.btnStart.textContent = "경주 시작하기";
    this.elements.statusLine.textContent = "준비 완료";
    
    const rows = this.ensureLapTable();
    rows.innerHTML = "";
    this.elements.resultBox.style.display = "none";
    
    console.log("레이스 UI 초기화 완료");
  }
  
  async fetchConfig() {
    try {
      this.config = await this.makeRequest("/api/config");
      
      if (this.config.default_laps) {
        this.elements.totalLaps.value = this.config.default_laps;
      }
      
      const configInfo = `포트: ${this.config.serial_port} | 최대 랩: ${this.config.max_laps}`;
      this.elements.statusLine.title = configInfo;
      
    } catch (error) {
      console.error("Failed to fetch config:", error);
    }
  }
  
  async fetchLeaderboard() {
    try {
      const data = await this.makeRequest("/result");
      
      this.elements.leaderboardBody.innerHTML = "";
      
      if (!data || !data.length) {
        this.elements.leaderboardEmpty.style.display = "block";
        return;
      }
      
      this.elements.leaderboardEmpty.style.display = "none";
      
      data.forEach((entry, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${entry.rank || (i + 1)}</td>
          <td>${entry.name}</td>
          <td>${entry.laps}</td>
          <td>${entry.avg_lap_time}</td>
        `;
        this.elements.leaderboardBody.appendChild(tr);
      });
      
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
      this.showToast("리더보드를 불러오는데 실패했습니다", "error");
    }
  }
  
  async startRace() {
    if (this.raceState !== 'idle') {
      console.log("레이스가 이미 진행 중입니다");
      return;
    }
    
    const validation = this.validateInputs();
    
    if (!validation.valid) {
      validation.errors.forEach(error => {
        this.showToast(error, "warning");
      });
      return;
    }
    
    try {
      // 🔥 즐시 UI 초기화 (버튼 클릭과 동시에)
      this.elements.btnStart.disabled = true;
      this.elements.btnStart.textContent = "레이스 시작 중...";
      this.elements.statusLine.textContent = "레이스 시작 중...";
      
      // UI 요소 즉시 초기화
      this.lapCount = 0;
      this.lapTimes = [];
      const rows = this.ensureLapTable();
      rows.innerHTML = "";
      this.elements.resultBox.style.display = "none";
      this.elements.mainTimer.textContent = "00:00.000";
      
      // 레이스 상태 설정
      this.raceState = 'waiting'; // idle -> waiting -> running
      
      const result = await this.makeRequest("/start", {
        method: "POST",
        body: JSON.stringify({
          name: validation.name,
          laps: validation.laps
        })
      });
      
      this.showToast(`${validation.name}님의 ${validation.laps}랩 레이스가 시작되었습니다!`, "success");
      this.elements.statusLine.textContent = "센서 감지 대기 중...";
      
      console.log("레이스 시작 요청 완료:", result);
      
    } catch (error) {
      console.error("Failed to start race:", error);
      this.showToast(`레이스 시작 실패: ${error.message}`, "error");
      this.elements.statusLine.textContent = "레이스 시작 실패";
      // 에러 시에만 완전 초기화
      this.resetRaceUI();
    }
  }
  
  async resetRace() {
    if (!confirm("정말로 모든 데이터를 초기화하시겠습니까?")) {
      return;
    }
    
    try {
      this.elements.btnReset.disabled = true;
      this.elements.statusLine.textContent = "초기화 중...";
      
      await this.makeRequest("/reset", { method: "POST" });
      
      this.resetRaceUI();
      this.showToast("초기화가 완료되었습니다", "success");
      this.elements.statusLine.textContent = "초기화 완료";
      
      await this.fetchLeaderboard();
      
    } catch (error) {
      console.error("Failed to reset race:", error);
      this.showToast(`초기화 실패: ${error.message}`, "error");
      this.elements.statusLine.textContent = "초기화 실패";
    } finally {
      this.elements.btnReset.disabled = false;
    }
  }
  
  // 🔥 개선된 SSE 연결 관리
  connectToSSE() {
    console.log("🔄 SSE 연결 시도...");
    
    // 기존 연결 정리
    if (this.eventSource) {
      console.log("🧹 기존 SSE 연결 정리");
      this.eventSource.close();
      this.eventSource = null;
    }
    
    // 재연결 타이머 정리
    if (this.sseReconnectTimeout) {
      clearTimeout(this.sseReconnectTimeout);
      this.sseReconnectTimeout = null;
    }
    
    try {
      // 새로운 EventSource 생성
      this.eventSource = new EventSource(this.BASE_URL + "/events");
      
      this.setupEventListeners();
      
    } catch (error) {
      console.error("❌ SSE 연결 생성 실패:", error);
      this.handleSSEError();
    }
  }
  
  setupEventListeners() {
    if (!this.eventSource) return;
    
    console.log("🎯 SSE 이벤트 리스너 설정...");
    
    // 연결 성공
    this.eventSource.onopen = () => {
      console.log("✅ SSE connection established");
      this.reconnectAttempts = 0;
      if (this.elements.statusLine.textContent.includes("연결")) {
        this.elements.statusLine.textContent = "준비 완료";
      }
    };
    
    // 에러 처리
    this.eventSource.onerror = (error) => {
      console.error("🚨 SSE connection error:", error);
      this.handleSSEError();
    };
    
    // 일반 메시지 (디버깅용)
    this.eventSource.onmessage = (event) => {
      console.log("📨 일반 SSE 메시지:", event.data);
    };
    
    // race_started 이벤트
    this.eventSource.addEventListener("race_started", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        console.log("🚦 Race started event received:", data);
        
        // 🔥 타이머 시작 (가장 중요!)
        this.startUiTimer(data.ts);
        
        this.elements.statusLine.textContent = "레이스 진행 중";
        this.showToast("레이스가 시작되었습니다!", "success");
        this.elements.btnStart.disabled = true;
        this.elements.btnStart.textContent = "레이스 진행 중";
        this.elements.btnReset.disabled = false;
        
        console.log("🎯 타이머 시작 완료, 상태:", this.raceState);
        
      } catch (error) {
        console.error("❌ race_started 처리 오류:", error);
      }
    });
    
    // lap 이벤트
    this.eventSource.addEventListener("lap", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        console.log("🏁 Lap event received:", data);
        
        this.lapCount += 1;
        const segmentTime = data.ms;
        
        // 누적 시간 계산
        const cumulativeMs = this.raceStartTime ? data.id - this.raceStartTime : 
                            this.lapTimes.reduce((sum, time) => sum + time, 0) + segmentTime;
        
        this.lapTimes.push(segmentTime);
        this.renderLapRow(this.lapCount, segmentTime, cumulativeMs);
        
        // 사운드 피드백 (옵션)
        if (this.config?.enable_sound && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(`랩 ${this.lapCount}`);
          utterance.rate = 1.5;
          utterance.volume = 0.5;
          window.speechSynthesis.speak(utterance);
        }
        
      } catch (error) {
        console.error("❌ lap 처리 오류:", error);
      }
    });
    
    // race_ended 이벤트
    this.eventSource.addEventListener("race_ended", async (ev) => {
      try {
        console.log("🏁 Race ended event received");
        
        this.stopUiTimer();
        this.elements.statusLine.textContent = "레이스 완료";
        this.showToast("레이스가 완료되었습니다!", "success");
        
        // 잠시 대기 후 결과 처리
        setTimeout(async () => {
          try {
            const result = await this.makeRequest("/laps");
            
            this.elements.rcName.textContent = result.name || "-";
            this.elements.rcAvg.textContent = result.avg_lap_time > 0 
                ? (result.avg_lap_time / 1000).toFixed(2) + "s"
                : "-";
            this.elements.rcRank.textContent = typeof result.rank === "number" 
                ? `${result.rank}위` 
                : "N/A";
            
            this.elements.resultBox.style.display = "block";
            await this.fetchLeaderboard();
            
            // 🔥 중요: UI 상태를 idle로 복구 및 버튼 활성화
            this.raceState = 'idle';
            this.elements.btnStart.disabled = false;
            this.elements.btnStart.textContent = "경주 시작하기";
            this.elements.statusLine.textContent = "준비 완료";
            
            console.log("✅ race_ended 처리 완료 - 다음 레이스 준비됨");
            
          } catch (error) {
            console.error("❌ 결과 처리 오류:", error);
            this.showToast("결과 처리 중 오류가 발생했습니다", "error");
          }
        }, 500);
        
      } catch (error) {
        console.error("❌ race_ended 처리 오류:", error);
        this.showToast("레이스 종료 처리 중 오류가 발생했습니다", "error");
      }
    });
    
    console.log("✅ SSE 이벤트 리스너 설정 완료");
  }
  
  handleSSEError() {
    if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
      console.log("🔄 SSE 연결이 끊어졌습니다. 재연결 시도...");
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(2000 * this.reconnectAttempts, 10000); // 최대 10초
        
        this.elements.statusLine.textContent = `연결 재시도 중... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
        
        this.sseReconnectTimeout = setTimeout(() => {
          this.connectToSSE();
        }, delay);
        
      } else {
        this.elements.statusLine.textContent = "서버 연결 실패 (페이지 새로고침 필요)";
        this.showToast("서버와의 연결이 끊어졌습니다. 페이지를 새로고침해주세요.", "error", 10000);
      }
    }
  }
  
  // SSE 상태 확인 (디버깅용)
  getSSEStatus() {
    if (!this.eventSource) return "연결 없음";
    
    const states = {
      0: "연결 중",
      1: "연결됨", 
      2: "연결 종료"
    };
    
    return states[this.eventSource.readyState] || "알 수 없음";
  }
  
  cleanup() {
    console.log("🧹 앱 정리 중...");
    
    this.stopUiTimer();
    
    if (this.sseReconnectTimeout) {
      clearTimeout(this.sseReconnectTimeout);
      this.sseReconnectTimeout = null;
    }
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log("🔌 SSE 연결 종료");
    }
  }
  
  async init() {
    try {
      console.log("🚀 Loading Race Timer App...");
      
      await this.fetchConfig();
      await this.fetchLeaderboard();
      this.ensureLapTable();
      this.connectToSSE(); // 개선된 연결 함수 사용
      
      this.elements.statusLine.textContent = "준비 완료";
      console.log("✅ Race Timer App initialized successfully");
      
      // 전역 디버깅 함수 등록
      window.fixSSE = () => {
        console.log("🔧 SSE 수동 복구 실행");
        this.connectToSSE();
      };
      
      window.getSSEStatus = () => {
        console.log("📊 SSE 상태:", this.getSSEStatus());
        return this.getSSEStatus();
      };
      
    } catch (error) {
      console.error("❌ 초기화 오류:", error);
      this.elements.statusLine.textContent = "초기화 오류";
      this.showToast("애플리케이션 초기화에 실패했습니다", "error");
    }
  }
}

// 애플리케이션 시작
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Loading Race Timer App...");
  window.raceApp = new RaceTimerApp();
});

// 🔧 긴급 복구 함수들 (전역 스코프)
window.emergencySSEFix = function() {
  console.log("🚨 긴급 SSE 복구 실행");
  if (window.raceApp) {
    window.raceApp.connectToSSE();
    console.log("✅ SSE 재연결 완료");
  }
};

window.debugSSE = function() {
  if (!window.raceApp) {
    console.log("❌ RaceApp이 로드되지 않았습니다");
    return;
  }
  
  console.log("=== SSE 디버깅 정보 ===");
  console.log("SSE 상태:", window.raceApp.getSSEStatus());
  console.log("재연결 시도 횟수:", window.raceApp.reconnectAttempts);
  console.log("레이스 상태:", window.raceApp.raceState);
  console.log("EventSource URL:", window.raceApp.eventSource?.url || "없음");
};