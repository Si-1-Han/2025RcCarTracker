// app.js
const BASE_URL = "";

let timerInterval = null;
let startTsSensor = null;   // 센서 기준 시작 timestamp(ms)
let startWallClock = null;  // 브라우저 벽시계 기준 시작 시각(ms)
let lapCount = 0;
let cumulativeMs = 0;       // 누적 총 시간(ms)

const mainTimer = document.getElementById("mainTimer");
const lapList = document.getElementById("lapList");
const resultBox = document.getElementById("resultBox");
const avgTimeSec = document.getElementById("avgTimeSec");
const rankBadge = document.getElementById("rankBadge");
const statusLine = document.getElementById("statusLine");
const leaderboardBody = document.getElementById("leaderboardBody");
const leaderboardEmpty = document.getElementById("leaderboardEmpty");

function pad(n, w){ return String(n).padStart(w,'0'); }
function fmt(ms){
  const m = Math.floor(ms/60000);
  const s = Math.floor((ms%60000)/1000);
  const x = ms%1000;
  return `${pad(m,2)}:${pad(s,2)}.${pad(x,3)}`;
}

/** 랩 리스트에 헤더(LAP|소요시간|총 시간)와 행 컨테이너(#lapRows)를 보장 */
function ensureLapTable() {
  let rows = document.getElementById("lapRows");
  if (!rows) {
    lapList.innerHTML = `
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

/** 한 줄 렌더링: Lap n | seg | total */
function renderLapRow(idx, segMs, totalMs){
  const rows = ensureLapTable();
  const row = document.createElement("div");
  row.className = "lap-row";
  row.innerHTML = `
    <span>Lap ${idx}</span>
    <span>${fmt(segMs)}</span>
    <span>${fmt(totalMs)}</span>
  `;
  rows.appendChild(row);
  lapList.scrollTop = lapList.scrollHeight;
}

function startUiTimer(sensorStartTs){
  // 센서 ts와 현재 벽시계 사이의 오프셋으로 '흐르는' 타이머를 만든다.
  startTsSensor = sensorStartTs;
  startWallClock = Date.now();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    const elapsed = Date.now() - startWallClock; // 브라우저 기준 경과
    mainTimer.textContent = fmt(elapsed);
  }, 50);
}

function stopUiTimer(){
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

async function fetchLeaderboard(){
  try{
    const r = await fetch(BASE_URL + "/result");
    const data = await r.json();
    leaderboardBody.innerHTML = "";
    if(!data || !data.length){
      leaderboardEmpty.style.display = "block";
      return;
    }
    leaderboardEmpty.style.display = "none";
    data.forEach((e,i)=>{
      const tr = document.createElement("tr");
      // /result는 초 단위(avg_lap_time)로 내려오도록 서버에서 이미 처리됨
      tr.innerHTML = `<td>${i+1}</td><td>${e.name}</td><td>${e.laps}</td><td>${e.avg_lap_time}</td>`;
      leaderboardBody.appendChild(tr);
    });
  }catch(e){ console.error(e); }
}

// --- Controls (start/reset) ---
const driverName = document.getElementById("driverName");
const totalLaps = document.getElementById("totalLaps");

document.getElementById("btnStart").onclick = async ()=>{
  const name = driverName.value.trim();
  const laps = parseInt(totalLaps.value);
  if(!name || !laps || laps < 1){ statusLine.textContent = "Please enter name/laps"; return; }
  await fetch(BASE_URL + "/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, laps })
  });
  statusLine.textContent = "Race started (waiting sensor...)";
  // 타이머는 센서가 start를 알려줄 때 시작한다 (race_started 이벤트)
  lapCount = 0;
  cumulativeMs = 0; // ★ 누적 초기화
  const rows = ensureLapTable();
  rows.innerHTML = ""; // 표만 초기화(헤더 보존)
  resultBox.style.display = "none";
};

document.getElementById("btnReset").onclick = async ()=>{
  await fetch(BASE_URL + "/reset", { method: "POST" });
  stopUiTimer();
  mainTimer.textContent = "00:00.000";
  lapCount = 0;
  cumulativeMs = 0;
  const rows = ensureLapTable();
  rows.innerHTML = "";
  resultBox.style.display = "none";
  statusLine.textContent = "Reset done";
  fetchLeaderboard();
};

// --- SSE ---
function initSSE(){
  const es = new EventSource(BASE_URL + "/events");

  es.addEventListener("race_started", (ev)=>{
    const data = JSON.parse(ev.data); // { ts }
    // data.ts: 센서 기준 시작 timestamp(ms)
    startUiTimer(data.ts);
    lapCount = 0;
    cumulativeMs = 0; // ★ race 시작 시 누적 초기화
    const rows = ensureLapTable();
    rows.innerHTML = "";
    statusLine.textContent = "Race started (sensor)";
  });

  es.addEventListener("lap", (ev)=>{
    const data = JSON.parse(ev.data); // { id, ms }
    // data.ms: 해당 랩의 '구간' 시간(ms)
    lapCount += 1;
    cumulativeMs += data.ms;          // ★ 누적 합산
    renderLapRow(lapCount, data.ms, cumulativeMs);
  });

  es.addEventListener("race_ended", async (ev)=>{
    stopUiTimer();
    statusLine.textContent = "Race completed";
    // ✅ 평균은 표시/계산하지 않고, 백엔드에서 받은 '등수'만 반영
    try{
      const r = await fetch(BASE_URL + "/laps");
      const d = await r.json();

      resultBox.style.display = "block";
      avgTimeSec.textContent = "-";  // ★ 평균 비표시 정책
      rankBadge.textContent = (typeof d.rank === "number") ? d.rank : "N/A";
      fetchLeaderboard();
    }catch(e){ console.error(e); }
  });

  es.onerror = (e)=>{
    console.error("SSE error", e);
    statusLine.textContent = "SSE disconnected (fallback polling)";
    // 필요 시 폴링 로직 추가 가능
  };
}

// --- Init ---
document.addEventListener("DOMContentLoaded", ()=>{
  fetchLeaderboard();
  ensureLapTable(); // 헤더/컨테이너 보장
  initSSE();
});
