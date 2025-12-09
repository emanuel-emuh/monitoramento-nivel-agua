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

// [NOVO] Variável para controlar o tempo da última resposta do ESP
let lastHeartbeat = 0; 
let connectionInterval = null;

// --- Auxiliares ---
function setOnline(on) {
  if (els.connLed) {
    // [MODIFICADO] Cores mais evidentes para o status
    els.connLed.style.backgroundColor = on ? "#22c55e" : "#ef4444"; // Verde ou Vermelho
    els.connLed.classList.toggle("on", on);
  }
  if (els.connTxt) {
    els.connTxt.textContent = on ? "Online" : "Offline (Desconectado)";
    els.connTxt.style.color = on ? "#2e7d32" : "#dc2626";
  }

  // [NOVO] Desabilita controles se estiver offline para evitar confusão
  const disabledState = !on || !authUser;
  if (els.motorBtn) els.motorBtn.disabled = disabledState;
  if (els.autoSwitch) els.autoSwitch.disabled = disabledState;
  if (els.feriasBtn) els.feriasBtn.disabled = disabledState;
}

// [NOVO] Função Watchdog: Verifica se o ESP parou de falar
function startConnectionWatchdog() {
  if (connectionInterval) clearInterval(connectionInterval);
  
  connectionInterval = setInterval(() => {
    const now = Date.now();
    // Se não receber dados há mais de 20 segundos, considera OFFLINE
    const timeSinceLastData = now - lastHeartbeat;
    const isConnected = timeSinceLastData < 20000; 

    setOnline(isConnected);
  }, 5000); // Roda a verificação a cada 5 segundos
}

function fmtPct(n) { return Number.isFinite(n) ? `${Math.round(n)}%` : "--%"; }
function safe(n, def = 0) { const num = parseFloat(n); return Number.isNaN(num) ? def : num; }

function litersFromPercent(pct) {
  const capacidadeTotal = 1000; 
  if (!Number.isFinite(pct)) return "-- L";
  const litros = (pct / 100) * capacidadeTotal;
  return `${Math.round(litros)} L`;
}

async function ensureSession() {
  return new Promise((resolve) => {
    firebase.auth().onAuthStateChanged((user) => {
      authUser = user;
      // O estado dos botões agora também depende da conexão (ver setOnline)
      resolve(user);
    });
  });
}

// =========================================================
// 1. LEITURA SENSOR (sensorData)
// =========================================================
function listenSensorData() {
  db().ref("sensorData").on("value", (snap) => {
    // [MODIFICADO] Atualiza o heartbeat toda vez que chega dado
    lastHeartbeat = Date.now();
    
    // Chamamos setOnline(true) aqui para resposta imediata, 
    // mas o Watchdog cuidará de colocar false se parar.
    setOnline(true); 

    const data = snap.val() || {};

    // 1. NÍVEL
    const rawLevel = (data.nivel !== undefined) ? data.nivel : data.level;
    const nivelCaixa = safe(rawLevel, 0);
    const nivelRes = 100 - nivelCaixa;

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

    // 2. STATUS DA BOMBA
    const statusRaw = String(data.statusBomba || data.status_bomba || "DESLIGADA").toUpperCase();
    const isOn = statusRaw.includes("LIGA") || statusRaw === "ON";

    if (els.pumpPill) {
      els.pumpPill.textContent = isOn ? "ON" : "OFF";
      els.pumpPill.className = `pill ${isOn ? 'on' : 'off'}`;
    }
    if (els.pumpTxt) els.pumpTxt.textContent = `A bomba está ${isOn ? "LIGADA" : "DESLIGADA"}.`;
    if (els.motorStatus) els.motorStatus.textContent = isOn ? "LIGADA" : "DESLIGADA";

    // Atualiza Botão Manual
    if (els.motorBtn) {
      if (isOn) {
        els.motorBtn.textContent = "DESLIGAR BOMBA";
        els.motorBtn.className = "btn btn-danger";
        els.motorBtn.style.backgroundColor = "#dc3545"; 
      } else {
        els.motorBtn.textContent = "LIGAR BOMBA";
        els.motorBtn.className = "btn btn-success"; 
        els.motorBtn.style.backgroundColor = "#2e7d32"; 
      }
    }

  }, (err) => {
    console.error("Erro leitura:", err);
    // [NOVO] Se der erro de permissão ou rede, marca offline imediatamente
    lastHeartbeat = 0; 
    setOnline(false);
  });
}

// =========================================================
// 2. LEITURA CONTROLE
// =========================================================
function listenSystemControl() {
  db().ref("bomba/controle").on("value", (snap) => {
    const data = snap.val() || {};
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
      if (isFerias) els.feriasBtn.style.border = "2px solid #ff9800";
      else els.feriasBtn.style.border = "none";
    }
  });
}

// =========================================================
// 3. HISTÓRICO & CSV
// =========================================================
function listenHistorico() {
  db().ref("historico").limitToLast(50).on("value", snap => {
    const data = snap.val();
    if (!data) return;

    const arr = [];
    Object.values(data).forEach(item => {
      const lvl = (item.nivel !== undefined) ? item.nivel : item.level;
      if (lvl !== undefined) {
        arr.push({
          ts: item.timestamp || Date.now(),
          nivel: Number(lvl)
        });
      }
    });

    arr.sort((a, b) => a.ts - b.ts);
    historyBuffer = arr;
    renderChart(arr);
    calcConsumption(arr);
  });
}

function calcConsumption(points) {
  if (points.length < 2) {
    if (els.consTxt) els.consTxt.textContent = "Aguardando mais dados...";
    return;
  }
  let totalDrop = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i - 1].nivel - points[i].nivel;
    if (diff > 0) totalDrop += diff;
  }
  const litros = totalDrop * 10;
  if (els.consValue) els.consValue.textContent = `~${Math.round(litros)} L`;
  if (els.consTxt) els.consTxt.textContent = "Consumo estimado recente.";
}

function exportCSV() {
  if (!historyBuffer || historyBuffer.length === 0) return alert("Sem dados para exportar.");
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
  link.setAttribute("download", `Relatorio_Agua_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================================================
// 4. AÇÕES (BOTÕES) - [MODIFICADO]
// =========================================================
async function handleAutoSwitch(e) {
  const novoModo = e.target.checked ? "automatico" : "manual";
  try {
    await db().ref("bomba/controle/modo").set(novoModo);
  } catch (err) {
    alert("Erro: " + err.message);
    e.target.checked = !e.target.checked;
  }
}

async function toggleMotor() {
  try {
    const currentText = els.motorStatus.textContent;
    // Lógica invertida: se está LIGADA, queremos DESLIGAR
    const novoComando = currentText.includes("LIGA") ? "DESLIGAR" : "LIGAR";

    // [MODIFICADO] Feedback visual imediato no botão para o usuário saber que clicou
    els.motorBtn.disabled = true;
    els.motorBtn.textContent = "Enviando...";

    // 1. GARANTIR MODO MANUAL: 
    // Mesmo se o switch estiver visualmente ok, forçamos 'manual' no DB
    // para garantir que o ESP aceite o comandoManual.
    await db().ref("bomba/controle/modo").set("manual");

    // 2. ENVIAR COMANDO
    await db().ref("bomba/controle/comandoManual").set(novoComando);

    // [NOVO] Aguarda um pouco e reabilita (ou deixa o listener reabilitar)
    setTimeout(() => {
        if(els.connTxt.textContent.includes("Online")) els.motorBtn.disabled = false;
    }, 1000);

  } catch (err) {
    alert("Erro ao enviar comando: " + err.message);
    els.motorBtn.disabled = false;
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

// =========================================================
// 5. GRÁFICO
// =========================================================
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
          label: "Nível (%)",
          data: data,
          borderColor: "#2e7d32",
          backgroundColor: "rgba(46, 125, 50, 0.1)",
          fill: true,
          tension: 0.3
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
  console.log("Dashboard V10 (Watchdog Ativo)");
  await ensureSession();
  listenSensorData();
  listenSystemControl();
  listenHistorico();
  startConnectionWatchdog(); // [NOVO] Inicia o monitoramento de conexão

  if (els.autoSwitch) els.autoSwitch.addEventListener("change", handleAutoSwitch);
  if (els.motorBtn) els.motorBtn.addEventListener("click", toggleMotor);
  if (els.feriasBtn) els.feriasBtn.addEventListener("click", toggleFerias);
  if (els.exportBtn) els.exportBtn.addEventListener("click", exportCSV);
});
