/* dashboard.js – v13.3 (Exportação CSV Avançada com Logs e Modelo Personalizado) */

const firebaseConfig = {
  apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
  authDomain: "aqua-monitor-login.firebaseapp.com",
  databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com",
  projectId: "aqua-monitor-login"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = () => firebase.database();
const $ = (sel) => document.querySelector(sel);

// --- CAPACIDADE (12x12x12 cm = 1.728 Litros) ---
const CAPACIDADE_TOTAL = 1.728; 

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
let currentPumpState = false; 

// --- FORMATADORES ---
function fmtPct(n) { return Number.isFinite(n) ? `${Math.round(n)}%` : "--%"; }
function safe(n, def = 0) { const num = parseFloat(n); return Number.isNaN(num) ? def : num; }

function litersFromPercent(pct) {
  if (!Number.isFinite(pct)) return "-- L";
  const litros = (pct / 100) * CAPACIDADE_TOTAL;
  return `${litros.toFixed(2)} L`;
}

// --- WATCHDOG ---
function resetWatchdog() {
  if (els.connLed) {
    els.connLed.style.backgroundColor = "#22c55e"; 
    els.connLed.classList.add("on");
  }
  if (els.connTxt) els.connTxt.textContent = "Online";

  if (watchdogTimer) clearTimeout(watchdogTimer);
  watchdogTimer = setTimeout(() => {
    console.warn("Watchdog: Offline.");
    if (els.connLed) {
      els.connLed.style.backgroundColor = "#dc3545"; 
      els.connLed.classList.remove("on");
    }
    if (els.connTxt) els.connTxt.textContent = "Sem Sinal (Offline)";
  }, 75000); 
}

// --- SESSÃO ---
async function ensureSession() {
  return new Promise((resolve) => {
    firebase.auth().onAuthStateChanged((user) => {
      if (!user) { window.location.href = "login.html"; return; }
      authUser = user;
      const enabled = true;
      if (els.autoSwitch) els.autoSwitch.disabled = !enabled;
      if (els.motorBtn) els.motorBtn.disabled = !enabled;
      if (els.feriasBtn) els.feriasBtn.disabled = !enabled;
      resolve(user);
    });
  });
}

// 1. SENSOR
function listenSensorData() {
  db().ref("sensorData").on("value", (snap) => {
    resetWatchdog();
    const data = snap.val() || {};
    const nivelCaixa = safe(data.nivel || data.level, 0);
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

    if (data.statusBomba || data.status_bomba) updatePumpStatus(data.statusBomba || data.status_bomba);
  });
}

// 2. CONTROLE
function listenSystemControl() {
  db().ref("bomba/controle").on("value", (snap) => {
    const data = snap.val() || {};
    if(data.statusBomba) updatePumpStatus(data.statusBomba);

    const isAuto = (data.modo === "automatico");
    if (els.modePill) {
      els.modePill.textContent = isAuto ? "AUTO" : "MAN";
      els.modePill.className = `pill ${isAuto ? 'auto' : 'man'}`;
    }
    if (els.modeTxt) els.modeTxt.textContent = `Modo ${isAuto ? "automático" : "manual"}.`;
    if (els.autoSwitch && els.autoSwitch.checked !== isAuto) els.autoSwitch.checked = isAuto;

    const isFerias = (data.modoOperacao === "ferias");
    if (els.feriasBtn) {
      els.feriasBtn.textContent = isFerias ? "Desativar Modo Férias" : "Ativar Modo Férias";
      if (isFerias) els.feriasBtn.classList.add("btn-warning");
      else els.feriasBtn.classList.remove("btn-warning");
    }
  });
}

function updatePumpStatus(statusRaw) {
    const st = String(statusRaw || "DESLIGADA").toUpperCase().trim();
    const isOn = (st === "LIGADA" || st === "ON" || st === "LIGADO");
    currentPumpState = isOn;

    if (els.pumpPill) {
      els.pumpPill.textContent = isOn ? "ON" : "OFF";
      els.pumpPill.className = `pill ${isOn ? 'on' : 'off'}`;
    }
    if (els.pumpTxt) els.pumpTxt.textContent = `A bomba está ${isOn ? "LIGADA" : "DESLIGADA"}.`;
    if (els.motorStatus) els.motorStatus.textContent = isOn ? "LIGADA" : "DESLIGADA";
    if (els.motorStatus) els.motorStatus.style.color = isOn ? "#2e7d32" : "#d32f2f";

    if (els.motorBtn) {
       if (isOn) {
          els.motorBtn.textContent = "DESLIGAR BOMBA";
          els.motorBtn.className = "btn btn-danger"; 
       } else {
          els.motorBtn.textContent = "LIGAR BOMBA";
          els.motorBtn.className = "btn btn-success"; 
       }
    }
}

// 3. HISTÓRICO
function listenHistorico() {
  db().ref("historico").limitToLast(100).on("value", snap => {
    const data = snap.val();
    if (!data) { if(els.consTxt) els.consTxt.textContent = "Aguardando novos dados..."; return; }
    
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
  const fatorLitros = CAPACIDADE_TOTAL / 100; // ~0.01728
  let totalDrop = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i - 1].nivel - points[i].nivel;
    if (diff > 0) totalDrop += diff;
  }
  const litros = totalDrop * fatorLitros; 
  if (els.consValue) els.consValue.textContent = `~${litros.toFixed(2)} L`;
}

// --- EXPORTAÇÃO CSV AVANÇADA (MODELO PLANILHA) ---
async function exportCSV() {
  if (!historyBuffer || historyBuffer.length === 0) return alert("Sem dados históricos para exportar.");
  
  els.exportBtn.textContent = "Gerando...";
  els.exportBtn.disabled = true;

  try {
    // 1. Buscar Logs/Eventos do Firebase (para mesclar)
    const logsSnap = await db().ref("logs").get();
    const logsData = logsSnap.val() || {};
    
    // 2. Criar lista unificada de eventos (Dados + Logs)
    let timeline = [];

    // Adiciona histórico de nível
    historyBuffer.forEach(h => {
      timeline.push({ 
        ts: h.ts, 
        type: 'data', 
        nivel: h.nivel 
      });
    });

    // Adiciona Logs de eventos
    Object.values(logsData).forEach(l => {
      if(l.timestamp) {
        timeline.push({
          ts: l.timestamp,
          type: 'log',
          msg: l.message || l.mensagem
        });
      }
    });

    // Ordenar cronologicamente
    timeline.sort((a, b) => a.ts - b.ts);

    // 3. Gerar CSV com Separador Ponto-e-Vírgula (Ideal para Excel Brasil)
    let csvContent = "data:text/csv;charset=utf-8,";
    // Cabeçalho conforme solicitado
    csvContent += "Data e Hora;Nivel da Agua (L);Nivel da Agua Reservatorio (L);Porcentagem da agua;Porcentagem da agua reservatorio;Logs/Eventos\n";

    const fator = CAPACIDADE_TOTAL / 100;

    timeline.forEach(row => {
      const d = new Date(row.ts);
      // Formato: dd/mm/aaaa | HH:MM:SS
      const dataStr = d.toLocaleDateString('pt-BR');
      const horaStr = d.toLocaleTimeString('pt-BR');
      const dataHora = `${dataStr} | ${horaStr}`;

      if (row.type === 'data') {
        // Linha de DADOS DE NÍVEL
        const pctMain = row.nivel;
        const pctRes = 100 - row.nivel;
        
        const litMain = (pctMain * fator).toFixed(2).replace('.', ','); // Troca ponto por vírgula para Excel PT-BR
        const litRes  = (pctRes * fator).toFixed(2).replace('.', ',');

        // Colunas: Data; LitMain; LitRes; %Main; %Res; (Vazio Log)
        csvContent += `${dataHora};${litMain} L;${litRes} L;${pctMain}%;${pctRes}%;\n`;
      
      } else if (row.type === 'log') {
        // Linha de LOG/EVENTO
        // Colunas: Data; (Vazio); (Vazio); (Vazio); (Vazio); Mensagem
        csvContent += `${dataHora};;;;;${row.msg}\n`;
      }
    });

    // 4. Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_completo_agua.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error(err);
    alert("Erro ao exportar: " + err.message);
  } finally {
    els.exportBtn.textContent = "Baixar CSV";
    els.exportBtn.disabled = false;
  }
}

// --- AÇÕES DO USUÁRIO ---
async function toggleMotor() {
  try {
    const novoComando = currentPumpState ? "DESLIGAR" : "LIGAR";
    els.motorBtn.textContent = "Processando...";
    els.motorBtn.disabled = true;
    await db().ref().update({
      "bomba/controle/modo": "manual",
      "bomba/controle/comandoManual": novoComando
    });
    setTimeout(() => { els.motorBtn.disabled = false; }, 500);
  } catch (err) {
    alert("Erro: " + err.message);
    els.motorBtn.disabled = false;
  }
}

async function handleAutoSwitch(e) {
  const novoModo = e.target.checked ? "automatico" : "manual";
  try { await db().ref("bomba/controle/modo").set(novoModo); } 
  catch (err) { alert("Erro: " + err.message); e.target.checked = !e.target.checked; }
}

async function toggleFerias() {
  try {
    const snap = await db().ref("bomba/controle/modoOperacao").get();
    const novo = (snap.val() === "ferias") ? "normal" : "ferias";
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
  console.log("Dashboard V13.3 Iniciado");
  await ensureSession();
  listenSensorData();
  listenSystemControl();
  listenHistorico();

  if (els.autoSwitch) els.autoSwitch.addEventListener("change", handleAutoSwitch);
  if (els.motorBtn) els.motorBtn.addEventListener("click", toggleMotor);
  if (els.feriasBtn) els.feriasBtn.addEventListener("click", toggleFerias);
  if (els.exportBtn) els.exportBtn.addEventListener("click", exportCSV);
});