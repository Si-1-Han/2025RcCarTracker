// 개선된 app.js
class RaceTimerApp {
  constructor() {
    this.BASE_URL = "";
    this.timerInterval = null;
    this.startTsSensor = null;
    this.startWallClock = null;
    this.lapCount = 0;
    this.cumulativeMs = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventSource = null;
    this.config = null; // 서버 설정 정보
    
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
      if (e.key === 'Enter') this.startRace();
    };
    this.elements.totalLaps.onkeypress = (e) => {
      if (e.key === 'Enter') this.startRace();
    };
    
    // 페이지 언로드 시 정리
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }
  
  // 유틸리티 함수들
  pad(n, w) {
    return String(n).padStart(w, '0');
  }
  
  formatTime(ms) {
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
      // 서버 설정 기반 검증
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
  
  renderLapRow(idx, segMs, totalMs) {
    const rows = this.ensureLapTable();
    const row = document.createElement("div");
    row.className = "lap-row";
    row.innerHTML = `
      <span>Lap ${idx}</span>
      <span>${this.formatTime(segMs)}</span>
      <span>${this.formatTime(totalMs)}</span>
    `;
    rows.appendChild(row);
    this.elements.lapList.scrollTop = this.elements.lapList.scrollHeight;
  }
  
  startUiTimer(sensorStartTs) {
    this.startTsSensor = sensorStartTs;
    this.startWallClock = Date.now();
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.startWallClock;
      this.elements.mainTimer.textContent = this.formatTime(elapsed);
    }, 50);
  }
  
  stopUiTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  
  async fetchConfig() {
    try {
      this.config = await this.makeRequest("/api/config");
      
      // 설정 기반 UI 업데이트
      if (this.config.default_laps) {
        this.elements.totalLaps.value = this.config.default_laps;
      }
      
      // 상태 표시에 설정 정보 추가
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
    const validation = this.validateInputs();
    
    if (!validation.valid) {
      validation.errors.forEach(error => {
        this.showToast(error, "warning");
      });
      return;
    }
    
    try {
      this.elements.btnStart.disabled = true;
      this.elements.statusLine.textContent = "레이스 시작 중...";
      
      const result = await this.makeRequest("/start", {
        method: "POST",
        body: JSON.stringify({
          name: validation.name,
          laps: validation.laps
        })
      });
      
      this.showToast(`${result.driver}님의 ${result.laps}랩 레이스가 시작되었습니다`, "success");
      this.elements.statusLine.textContent = "레이스 시작됨 (센서 대기 중...)";
      
      // UI 리셋
      this.lapCount = 0;
      this.cumulativeMs = 0;
      const rows = this.ensureLapTable();
      rows.innerHTML = "";
      this.elements.resultBox.style.display = "none";
      
    } catch (error) {
      console.error("Failed to start race:", error);
      this.showToast(`레이스 시작 실패: ${error.message}`, "error");
      this.elements.statusLine.textContent = "레이스 시작 실패";
    } finally {
      this.elements.btnStart.disabled = false;
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
      
      this.stopUiTimer();
      this.elements.mainTimer.textContent = "00:00.000";
      this.lapCount = 0;
      this.cumulativeMs = 0;
      
      const rows = this.ensureLapTable();
      rows.innerHTML = "";
      this.elements.resultBox.style.display = "none";
      
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
  
  initSSE() {
    if (this.eventSource) {
      this.eventSource.close();
    }
    
    this.eventSource = new EventSource(this.BASE_URL + "/events");
    
    this.eventSource.addEventListener("race_started", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        this.startUiTimer(data.ts);
        this.lapCount = 0;
        this.cumulativeMs = 0;
        
        const rows = this.ensureLapTable();
        rows.innerHTML = "";
        
        this.elements.statusLine.textContent = "레이스 진행 중";
        this.showToast("레이스가 시작되었습니다!", "success");
      } catch (error) {
        console.error("Error handling race_started event:", error);
      }
    });
    
    this.eventSource.addEventListener("lap", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        this.lapCount += 1;
        this.cumulativeMs += data.ms;
        this.renderLapRow(this.lapCount, data.ms, this.cumulativeMs);
      } catch (error) {
        console.error("Error handling lap event:", error);
      }
    });
    
    this.eventSource.addEventListener("race_ended", async (ev) => {
      try {
        this.stopUiTimer();
        this.elements.statusLine.textContent = "레이스 완료";
        this.showToast("레이스가 완료되었습니다!", "success");
        
        // 결과 정보 가져오기
        const result = await this.makeRequest("/laps");
        
        this.elements.rcName.textContent = result.name || "-";
        this.elements.rcAvg.textContent = result.avg_lap_time > 0 
          ? (result.avg_lap_time / 1000).toFixed(2) 
          : "-";
        this.elements.rcRank.textContent = typeof result.rank === "number" 
          ? `${result.rank}위` 
          : "N/A";
        
        this.elements.resultBox.style.display = "block";
        
        await this.fetchLeaderboard();
        
      } catch (error) {
        console.error("Error handling race_ended event:", error);
        this.showToast("결과 처리 중 오류가 발생했습니다", "error");
      }
    });
    
    this.eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.elements.statusLine.textContent = `연결 재시도 중... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
        
        setTimeout(() => {
          this.initSSE();
        }, 2000 * this.reconnectAttempts);
      } else {
        this.elements.statusLine.textContent = "서버 연결 실패 (페이지 새로고침 필요)";
        this.showToast("서버와의 연결이 끊어졌습니다", "error");
      }
    };
    
    this.eventSource.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      if (this.elements.statusLine.textContent.includes("연결")) {
        this.elements.statusLine.textContent = "준비 완료";
      }
    });
  }
  
  cleanup() {
    this.stopUiTimer();
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
  
  async init() {
    try {
      await this.fetchConfig();
      await this.fetchLeaderboard();
      this.ensureLapTable();
      this.initSSE();
      this.elements.statusLine.textContent = "준비 완료";
    } catch (error) {
      console.error("Initialization error:", error);
      this.elements.statusLine.textContent = "초기화 오류";
      this.showToast("애플리케이션 초기화에 실패했습니다", "error");
    }
  }
}

// 애플리케이션 시작
document.addEventListener("DOMContentLoaded", () => {
  window.raceApp = new RaceTimerApp();
});
