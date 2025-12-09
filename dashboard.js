/* dashboard.js – v7.0 (Correção Final) */

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
  if(els.connLed) {
    // Força a cor verde diretamente se estiver online
    els.connLed.style.backgroundColor = on ? "#22c55e" : "#bbb";
  }
  if(els.connTxt) els.connTxt.textContent = on ? "Online" : "Conectando...";
}

function fmtPct(n) { return Number.isFinite(n) ? `${Math.round(n)}%` : "--%"; }
function safe(n, def = 0) { const num = parseFloat(n); return Number.isNaN(num) ? def : num; }

// --- CÁLCULO DE LITROS ---
function litersFromPercent(pct) {
  const capacidadeTotal = 1000; // 1000 Litros
  if (!Number.isFinite(pct)) return "-- L";
  const litros = (pct / 100) * capacidadeTotal;
  return `${Math.round(litros)} L`;
}

// --- VARIÁVEIS GLOBAIS ---
let authUser = null;
let chart; 
let historyBuffer = []; // Guarda dados para o CSV

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

// 1. LEITURA SENSOR
function listenSensorData() {
  const ref = db().ref("sensorData");
  
  ref.on("value", (snap) => {
    setOnline(true);
    const data = snap.val() || {};
    
    // Ler nível (compatível com level ou nivel)
    const rawLevel = (data.level !== undefined) ? data.level : data.nivel;
    const nivelCaixa = safe(rawLevel, 0);
    const nivelRes = 100 - nivelCaixa; 

    // Atualiza Caixa
    if (els.mainPct) els.mainPct.textContent = fmtPct(nivelCaixa);
    if (els.mainLiters) els.mainLiters.textContent = litersFromPercent(nivelCaixa);
    if (els.barMain) els.barMain.style.width = `${nivelCaixa}%`;
    if (els.tankMain) els.tankMain.style.height = `${nivelCaixa}%`;
    if (els.tankMainPct) els.tankMainPct.textContent = Math.round(nivelCaixa);

    // Atualiza Reservatório
    if (els.resPct) els.resPct.textContent = fmtPct(nivelRes);
    if (els.resLiters) els.resLiters.textContent = litersFromPercent(nivelRes);
    if (els.barRes) els.barRes.style.width = `${nivelRes}%`;
    if (els.tankRes) els.tankRes.style.height = `${nivelRes}%`;
    if (els.tankResPct) els.tankResPct.textContent = Math.round(nivelRes);

  }, (err) => setOnline(false));
}

// 2. LEITURA CONTROLE
function listenSystemControl() {
  const ref = db().ref("bomba/controle");

  ref.on("value", (snap) => {
    const data = snap.val() || {};
    
    // Status Bomba
    const statusRaw = String(data.statusBomba || "DESLIGADA").toUpperCase();
    const isOn = statusRaw.includes("LIGA") || statusRaw === "ON";
    
    if (els.pumpPill) {
      els.pumpPill.textContent = isOn ? "ON" : "OFF";
      // Classes do main.css
      els.pumpPill.className = `pill ${isOn ? 'on' : 'off'}`;
    }
    if (els.pumpTxt) els.pumpTxt.textContent = `A bomba está ${isOn ? "LIGADA" : "DESLIGADA"}.`;
    if (els.motorStatus) els.motorStatus.textContent = isOn ? "LIGADA" : "DESLIGADA";

    // Botão de Ação
    if (els.motorBtn) {
       els.motorBtn.textContent = isOn ? "DESLIGAR BOMBA" : "LIGAR BOMBA";
       els.motorBtn.className = isOn ? "btn btn-danger" : "btn btn-success"; 
       // Força cor verde se a classe não pegar
       if (!isOn) els.motorBtn.style.backgroundColor = "#2e7d32";
       else els.motorBtn.style.backgroundColor = "#dc3545";
    }

    // Modo Automático
    const isAuto = (data.modo === "automatico");
    
    if (els.modePill) {
      els.modePill.textContent = isAuto ? "AUTO" : "MAN";
      els.modePill.className = `pill ${isAuto ? 'auto' : 'man'}`;
    }
    if (els.modeTxt) els.modeTxt.textContent = `Modo ${isAuto ? "automático" : "manual"}.`;
    
    // Atualiza Switch (evita loop)
    if (els.autoSwitch && els.autoSwitch.checked !== isAuto) {
         els.autoSwitch.checked = isAuto;
    }
    
    // Férias
    const isFerias = (data.modoOperacao === "ferias");
    if (els.feriasBtn) {
      els.feriasBtn.textContent = isFerias ? "Desativar Modo Férias" : "Ativar Modo Férias";
      if(isFerias) els.feriasBtn.style.border = "2px solid #ff9800"; 
      else els.feriasBtn.style.border = "none";
    }
  });
}

// 3. LEITURA HISTÓRICO E CÁLCULO
function listenHistorico() {
  db().ref("historico").limitToLast(100).on("value", snap => {
    const data = snap.val();
    if (!data) {
        if(els.consValue) els.consValue.textContent = "-- L/dia";
        return;
    }
    
    const arr = [];
    Object.values(data).forEach(item => {
      // Aceita 'nivel' ou 'level'
      const lvl = item.nivel !== undefined ? item.nivel : item.level;
      if (lvl !== undefined) {
        arr.push({
            ts: item.timestamp || Date.now(),
            nivel: Number(lvl)
        });
      }
    });
    
    // Ordena por tempo
    arr.sort((a,b) => a.ts - b.ts);
    historyBuffer = arr; // Guarda para o CSV

    renderChart(arr);
    calcConsumption(arr);
  });
}

function calcConsumption(points) {
    if (points.length < 2) {
        els.consTxt.textContent = "Dados insuficientes...";
        return;
    }
    // Lógica simples: Se o nível desceu, somamos a descida
    let totalDropPercent = 0;
    for (let i = 1; i < points.length; i++) {
        const diff = points[i-1].nivel - points[i].nivel;
        if (diff > 0) { // Só conta se desceu (consumo)
            totalDropPercent += diff;
        }
    }
    
    // Média por dia (estimativa básica)
    // 1000L totais. 1% = 10L
    const litrosConsumidos = totalDropPercent * 10; // 10L por %
    // Se o histórico cobrir frações de dia, extrapolar é perigoso, mostramos o total do período
    els.consValue.textContent = `~${Math.round(litrosConsumidos)} L`;
    els.consTxt.textContent = "No período visível.";
}

function exportCSV() {
    if(!historyBuffer || historyBuffer.length === 0) return alert("Sem dados para exportar.");
    
    let csvContent = "data:text/csv;charset=utf-8,Data/Hora,Nivel(%)\n";
    historyBuffer.forEach(row => {
        const date = new Date(row.ts).toLocaleString();
        csvContent += `${date},${row.nivel}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "historico_agua.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 4. AÇÕES
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
    const novoComando = currentText.includes("LIGA") ? "DESLIGAR" : "LIGAR"; 
    
    // IMPORTANTE: Ao clicar manualmente, OBRIGATORIAMENTE sai do modo automático
    // Senão o ESP volta a ligar/desligar sozinho.
    if (els.autoSwitch.checked) {
        await db().ref("bomba/controle/modo").set("manual");
    }
    
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

// 5. CHART
function renderChart(points) {
  const ctx = document.getElementById("levelChart");
  if (!ctx) return;
  
  const labels = points.map(p => new Date(p.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
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
      options: { responsive: true, scales: { y: { min: 0, max: 100 } } }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Dashboard V7 Iniciado");
  await ensureSession();
  listenSensorData();
  listenSystemControl();
  listenHistorico(); // Inicia leitura do histórico para CSV e Gráfico
  
  if (els.autoSwitch) els.autoSwitch.addEventListener("change", handleAutoSwitch);
  if (els.motorBtn) els.motorBtn.addEventListener("click", toggleMotor);
  if (els.feriasBtn) els.feriasBtn.addEventListener("click", toggleFerias);
  if (els.exportBtn) els.exportBtn.addEventListener("click", exportCSV);
});