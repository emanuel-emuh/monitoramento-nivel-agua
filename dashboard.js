/* dashboard.js – v12.2 (Correção: Redirecionamento de Segurança + Watchdog 70s) */

const firebaseConfig = {
  apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
  authDomain: "aqua-monitor-login.firebaseapp.com",
  databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com",
  projectId: "aqua-monitor-login"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = () => firebase.database();
const $ = (sel) => document.querySelector(sel);

// --- Elementos ---
const els = {
  connLed: $("#conn-led"),
  connTxt: $("#conn-txt"),
  mainPct: $("#main-level-value"),
  mainLiters: $("#main-level-liters"),
  barMain: $("#level-fill-main"),
  tankMain: $("#client-water-main"),
  tankMainPct: $("#client-level-percent-main"),
  resPct: $("#res-level-value"),
  resLiters: $("#res-level-liters"),
  barRes: $("#level-fill-res"),
  tankRes: $("#client-water-res"),
  tankResPct: $("#client-level-percent-res"),
  pumpPill: $("#pump-status-value"),
  pumpTxt: $("#pump-status-text"),
  modePill: $("#mode-value"),
  modeTxt: $("#mode-text"),
  autoSwitch: $("#auto-mode-switch"),
  motorBtn: $("#motor-button"),
  motorStatus: $("#motor-status"),
  feriasBtn: $("#btn-ferias"),
  consValue: $("#consumption-value"),
  consTxt: $("#consumption-text"),
  exportBtn: $("#btn-export-csv"),
  exportRange: $("#export-range")
};

let authUser = null;
let chart;
let historyBuffer = [];
let watchdogTimer = null;

// --- WATCHDOG (DETEÇÃO DE QUEDA) ---
function resetWatchdog() {
  // 1. Marca como Online
  if (els.connLed) {
    els.connLed.style.backgroundColor = "#22c55e"; // Verde
    els.connLed.classList.add("on");
  }
  if (els.connTxt) els.connTxt.textContent = "Online";

  // 2. Limpa timer anterior
  if (watchdogTimer) clearTimeout(watchdogTimer);

  // 3. Inicia contagem da morte (70 segundos)
  watchdogTimer = setTimeout(() => {
    console.warn("Watchdog: Sem dados há 70s. Marcando OFFLINE.");
    if (els.connLed) {
      els.connLed.style.backgroundColor = "#dc3545"; // Vermelho
      els.connLed.classList.remove("on");
    }
    if (els.connTxt) els.connTxt.textContent = "Sem Sinal (Offline)";
  }, 70000); 
}

function fmtPct(n) { return Number.isFinite(n) ? `${Math.round(n)}%` : "--%"; }
function safe(n, def = 0) { const num = parseFloat(n); return Number.isNaN(num) ? def : num; }

function litersFromPercent(pct) {
  const capacidadeTotal = 1000;
  if (!Number.isFinite(pct)) return "-- L";
  const litros = (pct / 100) * capacidadeTotal;
  return `${Math.round(litros)} L`;
}

// --- SESSÃO E SEGURANÇA ---
async function ensureSession() {
  return new Promise((resolve) => {
    firebase.auth().onAuthStateChanged((user) => {
      // SE NÃO TIVER LOGADO, MANDA PARA O LOGIN IMEDIATAMENTE
      if (!user) {
        window.location.href = "login.html"; 
        return;
      }

      authUser = user;
      const enabled = true; // Se chegou aqui, está logado e habilitado
      
      if (els.autoSwitch) els.autoSwitch.disabled = !enabled;
      if (els.motorBtn) els.motorBtn.disabled = !enabled;
      if (els.feriasBtn) els.feriasBtn.disabled = !enabled;
      
      resolve(user);
    });
  });
}

// 1. SENSOR
function listenSensorData() {
  // O .on() vai falhar se não estiver logado, mas o ensureSession garante o login
  db().ref("sensorData").on("value", (snap) => {
    resetWatchdog(); // SINAL DE VIDA RECEBIDO!

    const data = snap.val() || {};
    const rawLevel = (data.nivel !== undefined) ? data.nivel : data.level;
    const nivelCaixa = safe(rawLevel, 0);
    const nivelRes = 100 - nivelCaixa;

    // Atualiza UI
    if (els.mainPct) els.mainPct.textContent = fmtPct(nivelCaixa);
    if (els.mainLiters) els.mainLiters.textContent = litersFromPercent(nivelCaixa);
    if (els.barMain) els.barMain.style.width = `${nivelCaixa}%`;
    if (els.tankMain) els.tankMain.style.height = `${nivelCaixa}%`;
    if (els.tankMainPct) els.tankMainPct.textContent = Math.round(nivelCaixa);

    if (els.resPct) els.resPct.textContent = fmtPct(nivelRes);
    if (els.resLiters) els.resLiters.textContent = litersFromPercent(nivelRes);
    if (els.barRes) els.barRes.style.width = `${nivelRes}%`;
    if (els.tankRes) els.tankRes.style.height = `${nivelRes}%`;
    if (els.tankResPct) els.tankResPct.textContent = Math.round(nivelRes);

    // Status da Bomba (Leitura Real)
    if (data.statusBomba || data.status_bomba) {
       updatePumpStatus(data.statusBomba || data.status_bomba);
    }
  }, (error) => {
    // Se der erro de permissão, avisa no console
    console.error("Erro ao ler dados (Permissão negada?):", error);
  });
}

// 2. CONTROLE
function listenSystemControl() {
  db().ref("bomba/controle").on("value", (snap) => {
    const data = snap.val() || {};

    updatePumpStatus(data.statusBomba || "DESLIGADA");

    const isAuto = (data.modo === "automatico");
    if (els.modePill) {
      els.modePill.textContent = isAuto ? "AUTO" : "MAN";
      els.modePill.className = `pill ${isAuto ? 'auto' : 'man'}`;
    }
    if (els.modeTxt) els.modeTxt.textContent = `Modo ${isAuto ? "automático" : "manual"}.`;
    
    if (els.autoSwitch && els.autoSwitch.checked !== isAuto) {
         els.autoSwitch.checked = isAuto;
    }

    const isFerias = (data.modoOperacao === "ferias");
    if (els.feriasBtn) {
      els.feriasBtn.textContent = isFerias ? "Desativar Modo Férias" : "Ativar Modo Férias";
      if (isFerias) els.feriasBtn.classList.add("btn-warning");
      else els.feriasBtn.classList.remove("btn-warning");
    }
  });
}

function updatePumpStatus(statusRaw) {
    const st = String(statusRaw || "DESLIGADA").toUpperCase();
    const isOn = st.includes("LIGA") || st === "ON";

    if (els.pumpPill) {
      els.pumpPill.textContent = isOn ? "ON" : "OFF";
      els.pumpPill.className = `pill ${isOn ? 'on' : 'off'}`;
    }
    if (els.pumpTxt) els.pumpTxt.textContent = `A bomba está ${isOn ? "LIGADA" : "DESLIGADA"}.`;
    if (els.motorStatus) els.motorStatus.textContent = isOn ? "LIGADA" : "DESLIGADA";

    if (els.motorBtn) {
       if (isOn) {
          els.motorBtn.textContent = "DESLIGAR BOMBA";
          els.motorBtn.className = "btn btn-danger";
          els.motorBtn.style.backgroundColor = ""; 
       } else {
          els.motorBtn.textContent = "LIGAR BOMBA";
          els.motorBtn.className = "btn btn-success";
          els.motorBtn.style.backgroundColor = ""; 
       }
    }
}

// 3. HISTÓRICO
function listenHistorico() {
  db().ref("historico").limitToLast(50).on("value", snap => {
    const data = snap.val();
    if (!data) {
        if(els.consTxt) els.consTxt.textContent = "Aguardando novos dados...";
        return;
    }
    const arr = [];
    Object.values(data).forEach(item => {
      const lvl = (item.nivel !== undefined) ? item.nivel : item.level;
      if (lvl !== undefined) {
        arr.push({ ts: item.timestamp || Date.now(), nivel: Number(lvl) });
      }
    });
    arr.sort((a, b) => a.ts - b.ts);
    historyBuffer = arr;
    renderChart(arr);
    calcConsumption(arr);
  });
}

function calcConsumption(points) {
  if (points.length < 2) return;
  let totalDrop = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i - 1].nivel - points[i].nivel;
    if (diff > 0) totalDrop += diff;
  }
  const litros = totalDrop * 10; 
  if (els.consValue) els.consValue.textContent = `~${Math.round(litros)} L`;
  if (els.consTxt) els.consTxt.textContent = "Estimado no período.";
}

function exportCSV() {
  if (!historyBuffer || historyBuffer.length === 0) return alert("Sem dados.");
  let csvContent = "data:text/csv;charset=utf-8,Data,Hora,Nivel (%),Volume (L)\n";
  historyBuffer.forEach(row => {
    const d = new Date(row.ts);
    const dataStr = d.toLocaleDateString('pt-BR');
    const horaStr = d.toLocaleTimeString('pt-BR');
    const litros = Math.round((row.nivel / 100) * 1000); 
    csvContent += `${dataStr},${horaStr},${row.nivel},${litros}\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "historico_agua.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- AÇÕES DO USUÁRIO ---
async function toggleMotor() {
  try {
    const currentText = els.motorStatus.textContent;
    const novoComando = currentText.includes("LIGA") ? "DESLIGAR" : "LIGAR";
    console.log("Enviando comando atómico:", novoComando);
    const updates = {};
    updates["bomba/controle/modo"] = "manual";
    updates["bomba/controle/comandoManual"] = novoComando;
    await db().ref().update(updates);
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

async function handleAutoSwitch(e) {
  const novoModo = e.target.checked ? "automatico" : "manual";
  try {
    await db().ref("bomba/controle/modo").set(novoModo);
  } catch (err) {
    alert("Erro: " + err.message);
    e.target.checked = !e.target.checked;
  }
}

async function toggleFerias() {
  try {
    const snap = await db().ref("bomba/controle/modoOperacao").get();
    const atual = snap.val();
    const novo = (atual === "ferias") ? "normal" : "ferias";
    await db().ref("bomba/controle/modoOperacao").set(novo);
  } catch (err) { alert("Erro: " + err.message); }
}

function renderChart(points) {
  const ctx = document.getElementById("levelChart");
  if (!ctx) return;
  const labels = points.map(p => new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const data = points.map(p => p.nivel);
  if (!chart) {
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Nível (%)", data: data,
          borderColor: "#2e7d32", backgroundColor: "rgba(46, 125, 50, 0.1)",
          fill: true, tension: 0.3
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Dashboard V12.2 Iniciado");
  await ensureSession(); // AGORA OBRIGA O LOGIN
  listenSensorData();
  listenSystemControl();
  listenHistorico();

  if (els.autoSwitch) els.autoSwitch.addEventListener("change", handleAutoSwitch);
  if (els.motorBtn) els.motorBtn.addEventListener("click", toggleMotor);
  if (els.feriasBtn) els.feriasBtn.addEventListener("click", toggleFerias);
  if (els.exportBtn) els.exportBtn.addEventListener("click", exportCSV);
});