// ===== 설정 =====
const DAILY_TARGET = 2000;
const WEEKLY_TARGET = DAILY_TARGET * 7;
const KCAL_PER_KG = 7700; // "예상" 계산용

// ===== 로컬 저장 구조 =====
// localStorage["cc_entries"] = { "YYYY-MM-DD": [ {id, name, kcal, ts} ... ] }
const KEY = "cc_entries";

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; }
  catch { return {}; }
}
function saveAll(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}
function uuid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function parseYMD(s) {
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d);
}
function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = (x.getDay()+6)%7; // Mon=0..Sun=6
  x.setDate(x.getDate() - day);
  x.setHours(0,0,0,0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate()+n);
  return x;
}
function sumDay(entries) {
  return entries.reduce((a, e) => a + (Number(e.kcal)||0), 0);
}

// ===== UI 엘리먼트 =====
const elCal = document.getElementById("cal");
const elMonthLabel = document.getElementById("monthLabel");
const elSelDateLabel = document.getElementById("selDateLabel");
const elDayTotalLabel = document.getElementById("dayTotalLabel");
const elList = document.getElementById("list");
const foodName = document.getElementById("foodName");
const foodKcal = document.getElementById("foodKcal");

const weekSumEl = document.getElementById("weekSum");
const weekDiffEl = document.getElementById("weekDiff");
const weekRateEl = document.getElementById("weekRate");
const weekKgEl = document.getElementById("weekKg");

let state = {
  view: new Date(),        // 현재 달 표시 기준
  selected: ymd(new Date()) // 선택 날짜
};

// ===== 렌더링 =====
function render() {
  const all = loadAll();
  renderMonth(all);
  renderDayPanel(all);
  renderWeekSummary(all);
}

function renderMonth(all) {
  const v = new Date(state.view.getFullYear(), state.view.getMonth(), 1);
  const year = v.getFullYear();
  const month = v.getMonth(); // 0-based

  elMonthLabel.textContent = `${year}년 ${month+1}월`;

  // 달력 시작: 월요일 기준으로 앞쪽 채우기
  const firstDay = new Date(year, month, 1);
  const firstDow = (firstDay.getDay()+6)%7; // Mon=0
  const start = addDays(firstDay, -firstDow);

  elCal.innerHTML = "";
  for (let i=0; i<42; i++) {
    const d = addDays(start, i);
    const key = ymd(d);
    const inMonth = d.getMonth() === month;
    const entries = all[key] ?? [];
    const total = sumDay(entries);

    const cell = document.createElement("div");
    cell.className = "day" + (inMonth ? "" : " muted") + (key === state.selected ? " selected" : "");
    cell.dataset.date = key;

    const top = document.createElement("div");
    top.className = "d";
    top.innerHTML = `<span>${d.getDate()}</span><span>${total ? total : ""}</span>`;

    const k = document.createElement("div");
    const cls = total > DAILY_TARGET ? "over" : total >= DAILY_TARGET*0.9 ? "ok" : "bad";
    k.className = `k ${total?cls:""}`;
    k.textContent = total ? `${total} kcal` : "";

    const sm = document.createElement("div");
    sm.className = "small";
    sm.textContent = total ? `${DAILY_TARGET-total >= 0 ? "남음 " + (DAILY_TARGET-total) : "초과 " + (total-DAILY_TARGET)}` : "";

    cell.appendChild(top);
    cell.appendChild(k);
    cell.appendChild(sm);

    cell.addEventListener("click", () => {
      state.selected = key;
      render();
    });

    elCal.appendChild(cell);
  }
}

function renderDayPanel(all) {
  const sel = state.selected;
  elSelDateLabel.textContent = sel;

  const entries = all[sel] ?? [];
  const total = sumDay(entries);
  const diff = DAILY_TARGET - total;

  elDayTotalLabel.textContent =
    `합계 ${total}kcal / 목표 ${DAILY_TARGET}kcal ( ` +
    (diff >= 0 ? `${diff}kcal 남음` : `${-diff}kcal 초과`) + ` )`;

  elList.innerHTML = "";
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "small";
    empty.textContent = "기록 없음. 위에서 음식명/kcal 입력 후 추가.";
    elList.appendChild(empty);
    return;
  }

  entries
    .slice()
    .sort((a,b)=>a.ts-b.ts)
    .forEach((e) => {
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div>
          <b>${escapeHtml(e.name)}</b>
          <div class="meta">${e.kcal} kcal</div>
        </div>
        <button class="del">삭제</button>
      `;
      row.querySelector("button").addEventListener("click", () => {
        const cur = loadAll();
        cur[sel] = (cur[sel] ?? []).filter(x => x.id !== e.id);
        if (cur[sel].length === 0) delete cur[sel];
        saveAll(cur);
        render();
      });
      elList.appendChild(row);
    });
}

function renderWeekSummary(all) {
  const selDate = parseYMD(state.selected);
  const start = startOfWeekMonday(selDate);
  let sum = 0;

  for (let i=0; i<7; i++) {
    const d = addDays(start, i);
    sum += sumDay(all[ymd(d)] ?? []);
  }

  const diff = WEEKLY_TARGET - sum; // +면 목표보다 덜 먹음(적자), -면 초과
  const rate = WEEKLY_TARGET > 0 ? (sum / WEEKLY_TARGET) * 100 : 0;
  const expectedKg = diff / KCAL_PER_KG; // 적자면 +값 => 감량(표시는 -로 해도 되는데, 여기선 "목표 대비 적자"의 kg)

  weekSumEl.textContent = String(sum);
  weekDiffEl.textContent = (diff >= 0 ? `-${diff}` : `+${-diff}`); // 목표 대비: 덜 먹으면 -, 더 먹으면 +
  weekRateEl.textContent = rate.toFixed(1);
  weekKgEl.textContent = (diff >= 0 ? `-${expectedKg.toFixed(2)}` : `+${(-expectedKg).toFixed(2)}`);
}

// ===== 이벤트 =====
document.getElementById("prevMonth").addEventListener("click", () => {
  state.view = new Date(state.view.getFullYear(), state.view.getMonth()-1, 1);
  render();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  state.view = new Date(state.view.getFullYear(), state.view.getMonth()+1, 1);
  render();
});
document.getElementById("today").addEventListener("click", () => {
  const t = new Date();
  state.view = new Date(t.getFullYear(), t.getMonth(), 1);
  state.selected = ymd(t);
  render();
});

document.getElementById("add").addEventListener("click", addEntry);
foodName.addEventListener("keydown", (e)=>{ if(e.key==="Enter") addEntry(); });
foodKcal.addEventListener("keydown", (e)=>{ if(e.key==="Enter") addEntry(); });

function addEntry() {
  const name = (foodName.value || "").trim();
  const kcal = Number(foodKcal.value);
  if (!name) return alert("음식명을 입력하세요.");
  if (!Number.isFinite(kcal) || kcal <= 0) return alert("kcal를 숫자로 입력하세요.");

  const all = loadAll();
  const sel = state.selected;
  all[sel] = all[sel] ?? [];
  all[sel].push({ id: uuid(), name, kcal: Math.round(kcal), ts: Date.now() });
  saveAll(all);

  foodName.value = "";
  foodKcal.value = "";
  render();
}

// 빠른 입력
document.getElementById("quickLunch").addEventListener("click", () => quickAdd("회사 점심", 850));
document.getElementById("quickProtein").addEventListener("click", () => quickAdd("프로틴(물)", 120));
document.getElementById("quickDinner").addEventListener("click", () => quickAdd("닭200g+고구마250g+샐러드", 800));
function quickAdd(name, kcal) {
  const all = loadAll();
  const sel = state.selected;
  all[sel] = all[sel] ?? [];
  all[sel].push({ id: uuid(), name, kcal, ts: Date.now() });
  saveAll(all);
  render();
}

// 내보내기(백업)
document.getElementById("export").addEventListener("click", () => {
  const data = localStorage.getItem(KEY) ?? "{}";
  const blob = new Blob([data], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `calorie-calendar-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("exportCsv").addEventListener("click", () => {
  const all = loadAll();
  const rows = [];
  rows.push(["date","name","kcal","time"]);

  const dates = Object.keys(all).sort();
  for (const d of dates) {
    const entries = all[d] ?? [];
    entries.slice().sort((a,b)=>a.ts-b.ts).forEach(e => {
      const t = new Date(e.ts);
      const hh = String(t.getHours()).padStart(2,"0");
      const mm = String(t.getMinutes()).padStart(2,"0");
      rows.push([d, e.name, String(e.kcal), `${hh}:${mm}`]);
    });
  }

  const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    // iOS/PWA에서 download가 실패하는 경우가 많아서 새 탭으로 열기
    window.open(url, "_blank");
    // 열린 화면에서 공유 버튼 → “파일에 저장” 또는 “다운로드”
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    alert("새 탭이 열리면 공유 버튼으로 '파일에 저장' 하세요.");
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = `calorie-calendar-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

// 전체 삭제
document.getElementById("wipe").addEventListener("click", () => {
  if (!confirm("정말 전체 데이터를 삭제할까요?")) return;
  localStorage.removeItem(KEY);
  render();
});

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

// 초기

render();

