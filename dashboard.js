/* dashboard.js – v6.0 (Revertido para ESP Original) */

const firebaseConfig = {
  apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
  authDomain: "aqua-monitor-login.firebaseapp.com",
  databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com",
  projectId: "aqua-monitor-login"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = () => firebase.database();
const $ = (sel) => document.querySelector(sel);

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

function setOnline(on) {
  if(els.connLed) els.connLed.className = `pill ${on ? 'online' : 'offline'}`;
  if(els.connTxt) els.connTxt.textContent = on ? "Online" : "Conectando...";
}

function fmtPct(n) { return Number.isFinite(n) ? `${Math.round(n)}%` : "--%"; }
function safe(n, def = 0) { const num = parseFloat(n); return Number.isNaN(num) ? def : num; }

// CÁLCULO DE LITROS
function litersFromPercent(pct) {
  const capacidadeTotal = 1000; // Ajuste conforme sua caixa
  if (!Number.isFinite(pct)) return "-- L";
  const litros = (pct / 100) * capacidadeTotal;
  return `${Math.round(litros)} L`;
}

// --- DADOS ---
let authUser = null;
let chart; 

async function ensureSession() {
  return new Promise((resolve) => {
    firebase.auth().onAuthStateChanged((user) => {
      authUser = user;
      const enabled = !!user;
      if(els.autoSwitch) els.autoSwitch.disabled = !enabled;
      if(els.motorBtn) els.motorBtn.disabled = !enabled;
      if(els.feriasBtn) els.feriasBtn.disabled = !enabled;
      resolve(user);
    });
  });
}

// 1. LEITURA SENSOR (sensorData)
function listenSensorData() {
  // CAMINHO ANTIGO
  const ref = db().ref("sensorData");
  
  ref.on("value", (snap) => {
    setOnline(true);
    const data = snap.val() || {};
    
    // NOME ANTIGO: level
    const nivelCaixa = safe(data.level, 0);
    const nivelRes = 100 - nivelCaixa; 

    // UI
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
  }, (err) => setOnline(false));
}

// 2. LEITURA CONTROLE (bomba/controle)
function listenSystemControl() {
  // CAMINHO ANTIGO
  const ref = db().ref("bomba/controle");

  ref.on("value", (snap) => {
    setOnline(true);
    const data = snap.val() || {};
    
    // STATUS BOMBA (NOME ANTIGO: statusBomba)
    const statusRaw = String(data.statusBomba || "DESLIGADA").toUpperCase();
    const isOn = statusRaw.includes("LIGA");
    
    if (els.pumpPill) {
      els.pumpPill.textContent = isOn ? "ON" : "OFF";
      els.pumpPill.className = `pill ${isOn ? 'on' : 'off'}`;
    }
    if (els.pumpTxt) els.pumpTxt.textContent = `A bomba está ${isOn ? "LIGADA" : "DESLIGADA"}.`;
    if (els.motorStatus) els.motorStatus.textContent = isOn ? "LIGADA" : "DESLIGADA";

    if (els.motorBtn) {
       els.motorBtn.textContent = isOn ? "DESLIGAR BOMBA" : "LIGAR BOMBA";
       els.motorBtn.className = isOn ? "btn btn-danger" : "btn btn-success"; 
       if (!isOn) els.motorBtn.style.backgroundColor = "#2e7d32";
       else els.motorBtn.style.backgroundColor = "";
    }

    // MODO (NOME ANTIGO: modo)
    const isAuto = (data.modo === "automatico");
    
    if (els.modePill) {
      els.modePill.textContent = isAuto ? "AUTO" : "MAN";
      els.modePill.className = `pill ${isAuto ? 'auto' : 'man'}`;
    }
    if (els.modeTxt) els.modeTxt.textContent = `Modo ${isAuto ? "automático" : "manual"}.`;
    
    if (els.autoSwitch && els.autoSwitch.checked !== isAuto) {
         els.autoSwitch.checked = isAuto;
    }
    
    // FERIAS (NOME ANTIGO: modoOperacao)
    const isFerias = (data.modoOperacao === "ferias");
    if (els.feriasBtn) {
      els.feriasBtn.textContent = isFerias ? "Desativar Modo Férias" : "Ativar Modo Férias";
      if(isFerias) els.feriasBtn.style.border = "2px solid #ff9800"; 
      else els.feriasBtn.style.border = "none";
    }
  });
}

// 3. AÇÕES
async function handleAutoSwitch(e) {
  const novoModo = e.target.checked ? "automatico" : "manual";
  try {
    // CAMINHO ANTIGO
    await db().ref("bomba/controle/modo").set(novoModo);
  } catch (err) {
    alert("Erro: " + err.message);
    e.target.checked = !e.target.checked;
  }
}

async function toggleMotor() {
  try {
    const currentText = els.motorStatus.textContent; 
    const novoComando = currentText.includes("LIGA") ? "DESLIGAR" : "LIGAR"; 
    
    // 1. Força MANUAL (Caminho Antigo)
    await db().ref("bomba/controle/modo").set("manual");
    
    // 2. Envia Comando (Caminho Antigo)
    await db().ref("bomba/controle/comandoManual").set(novoComando);
    
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

async function toggleFerias() {
  try {
    const snap = await db().ref("bomba/controle/modoOperacao").get();
    const atual = snap.val();
    const novo = (atual === "ferias") ? "normal" : "ferias";
    await db().ref("bomba/controle/modoOperacao").set(novo);
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

// 4. GRÁFICO
function initChart() {
  const ctx = document.getElementById("levelChart");
  if (!ctx) return;
  
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Nível (%)",
        data: [],
        borderColor: "#2e7d32",
        backgroundColor: "rgba(46, 125, 50, 0.1)",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100 } }
    }
  });

  db().ref("historico").limitToLast(20).on("value", snap => {
    const data = snap.val();
    if (!data) return;
    const labels = [];
    const points = [];
    Object.values(data).forEach(item => {
      // NOME ANTIGO: nivel
      if (item.nivel !== undefined) {
        const date = new Date(item.timestamp || Date.now());
        labels.push(date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
        points.push(item.nivel);
      }
    });
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = points;
      chart.update();
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Dashboard Iniciado (Revertido)");
  await ensureSession();
  listenSensorData();
  listenSystemControl();
  initChart();
  if (els.autoSwitch) els.autoSwitch.addEventListener("change", handleAutoSwitch);
  if (els.motorBtn) els.motorBtn.addEventListener("click", toggleMotor);
  if (els.feriasBtn) els.feriasBtn.addEventListener("click", toggleFerias);
});