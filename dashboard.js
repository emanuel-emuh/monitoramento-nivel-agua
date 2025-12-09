/* dashboard.js – AquaMonitor (Cliente) - v5.0 (TCC Corrigido) */

/* =========================
 * 1) CONFIGURAÇÃO
 * ========================= */
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
  
  // KPIs
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

  // Status & Controles
  pumpPill: $("#pump-status-value"),
  pumpTxt: $("#pump-status-text"),
  modePill: $("#mode-value"),
  modeTxt: $("#mode-text"),
  
  autoSwitch: $("#auto-mode-switch"),
  motorBtn: $("#motor-button"),
  motorStatus: $("#motor-status"),
  feriasBtn: $("#btn-ferias"),

  // Export
  consValue: $("#consumption-value"),
  consTxt: $("#consumption-text"),
  exportBtn: $("#btn-export-csv"),
  exportRange: $("#export-range")
};

function setOnline(on) {
  if(els.connLed) els.connLed.className = `pill ${on ? 'online' : 'offline'}`; // Usa classes do main.css
  if(els.connTxt) els.connTxt.textContent = on ? "Online" : "Conectando...";
}

function fmtPct(n) { return Number.isFinite(n) ? `${Math.round(n)}%` : "--%"; }
function safe(n, def = 0) { const num = parseFloat(n); return Number.isNaN(num) ? def : num; }

/* =========================
 * 2) LÓGICA DE DADOS
 * ========================= */
let authUser = null;
let chart; 

async function ensureSession() {
  return new Promise((resolve) => {
    firebase.auth().onAuthStateChanged((user) => {
      authUser = user;
      // Habilita controles se houver usuário
      const enabled = !!user;
      if(els.autoSwitch) els.autoSwitch.disabled = !enabled;
      if(els.motorBtn) els.motorBtn.disabled = !enabled;
      if(els.feriasBtn) els.feriasBtn.disabled = !enabled;
      resolve(user);
    });
  });
}

// --- LEITURA DO SENSOR (ESP -> SITE) ---
function listenSensorData() {
  // Caminho exato do TCC
  const ref = db().ref("dados_sensores/reservatorio_principal");
  
  ref.on("value", (snap) => {
    setOnline(true);
    const data = snap.val() || {};
    
    // 1. Níveis
    const nivelCaixa = safe(data.nivel, 0);
    const nivelRes = 100 - nivelCaixa; // Lógica inversa

    // UI Caixa
    if (els.mainPct) els.mainPct.textContent = fmtPct(nivelCaixa);
    if (els.barMain) els.barMain.style.width = `${nivelCaixa}%`;
    if (els.tankMain) els.tankMain.style.height = `${nivelCaixa}%`;
    if (els.tankMainPct) els.tankMainPct.textContent = Math.round(nivelCaixa);

    // UI Reservatório
    if (els.resPct) els.resPct.textContent = fmtPct(nivelRes);
    if (els.barRes) els.barRes.style.width = `${nivelRes}%`;
    if (els.tankRes) els.tankRes.style.height = `${nivelRes}%`;
    if (els.tankResPct) els.tankResPct.textContent = Math.round(nivelRes);

    // 2. Bomba
    const statusRaw = String(data.status_bomba || "DESLIGADA").toUpperCase();
    const isOn = statusRaw.includes("LIGA");
    
    if (els.pumpPill) {
      els.pumpPill.textContent = isOn ? "ON" : "OFF";
      els.pumpPill.className = `pill ${isOn ? 'on' : 'off'}`;
    }
    if (els.pumpTxt) els.pumpTxt.textContent = `A bomba está ${isOn ? "LIGADA" : "DESLIGADA"}.`;
    if (els.motorStatus) els.motorStatus.textContent = isOn ? "LIGADA" : "DESLIGADA";

    // Atualiza botão de ação
    if (els.motorBtn) {
       els.motorBtn.textContent = isOn ? "DESLIGAR BOMBA" : "LIGAR BOMBA";
       els.motorBtn.className = isOn ? "btn btn-danger" : "btn btn-success"; // btn-success requer CSS ou use btn-primary
       if (!isOn) els.motorBtn.style.backgroundColor = "#2e7d32"; // Força verde se btn-success nao existir
       else els.motorBtn.style.backgroundColor = "";
    }

  }, (err) => setOnline(false));
}

// --- LEITURA DO CONTROLE (SITE <-> ESP) ---
function listenSystemControl() {
  // Caminho exato do TCC
  const ref = db().ref("controle_sistema");

  ref.on("value", (snap) => {
    const data = snap.val() || {};
    
    // Modo Automático
    const isAuto = data.modo_automatico_usuario === true;
    
    if (els.modePill) {
      els.modePill.textContent = isAuto ? "AUTO" : "MAN";
      els.modePill.className = `pill ${isAuto ? 'auto' : 'man'}`;
    }
    if (els.modeTxt) els.modeTxt.textContent = `Operando em modo ${isAuto ? "automático" : "manual"}.`;
    
    // Atualiza o Switch (sem disparar evento de loop)
    if (els.autoSwitch && els.autoSwitch.checked !== isAuto) {
         els.autoSwitch.checked = isAuto;
    }
    
    // Modo Férias
    const isFerias = data.modo_economico === true;
    if (els.feriasBtn) {
      els.feriasBtn.textContent = isFerias ? "Desativar Modo Férias" : "Ativar Modo Férias";
      // Adiciona classe visual se ativo
      if(isFerias) els.feriasBtn.style.border = "2px solid #ff9800"; 
      else els.feriasBtn.style.border = "none";
    }
  });
}

/* =========================
 * 3) AÇÕES DE CONTROLE
 * ========================= */

// Mudar Modo Auto/Manual
async function handleAutoSwitch(e) {
  const novoEstado = e.target.checked; 
  try {
    await db().ref("controle_sistema/modo_automatico_usuario").set(novoEstado);
  } catch (err) {
    alert("Erro: " + err.message);
    e.target.checked = !novoEstado; // Reverte visualmente
  }
}

// Ligar/Desligar Manual
async function toggleMotor() {
  try {
    const currentText = els.motorStatus.textContent; // "LIGADA" ou "DESLIGADA"
    // Se está LIGADA, quero DESLIGAR. Se DESLIGADA, quero LIGAR.
    const novoComando = currentText.includes("LIGA") ? "desligar" : "ligar"; // minúsculo conforme padrão comum, ou "LIGAR" se o ESP esperar maiúsculo. O TCC diz "comando manual (e.g., ...)" mas vamos usar minúsculo por segurança ou maiúsculo se o ESP exigir. Vamos assumir "ligar"/"desligar".
    
    // 1. DESATIVA Automático primeiro (para o ESP não sobrescrever)
    await db().ref("controle_sistema/modo_automatico_usuario").set(false);
    
    // 2. Envia Comando
    await db().ref("controle_sistema/comando_manual").set(novoComando);
    
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

// Modo Férias
async function toggleFerias() {
  try {
    const snap = await db().ref("controle_sistema/modo_economico").get();
    const atual = snap.val() === true;
    await db().ref("controle_sistema/modo_economico").set(!atual);
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

/* =========================
 * 4) GRÁFICO (Chart.js)
 * ========================= */
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

  // Lê histórico (ajuste 'historico' se o nome no banco for diferente)
  db().ref("historico").limitToLast(20).on("value", snap => {
    const data = snap.val();
    if (!data) return;
    
    const labels = [];
    const points = [];
    
    Object.values(data).forEach(item => {
      // Estrutura esperada: { timestamp: 12345, nivel: 50 }
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

// Inicialização
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Dashboard Iniciado (TCC v5)");
  await ensureSession();
  
  listenSensorData();
  listenSystemControl();
  initChart();
  
  if (els.autoSwitch) els.autoSwitch.addEventListener("change", handleAutoSwitch);
  if (els.motorBtn) els.motorBtn.addEventListener("click", toggleMotor);
  if (els.feriasBtn) els.feriasBtn.addEventListener("click", toggleFerias);
});