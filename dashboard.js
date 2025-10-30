/* dashboard.js – AquaMonitor (cliente)
 * Compatível com index.html (scripts compat v9.6.1)
 */

/* =========================
 * 1) CONFIG FIREBASE
 * ========================= */
(function () {
  // Se já existir um app, não inicializa de novo
  if (!firebase.apps.length) {
    const firebaseConfig = {
      apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
      authDomain: "aqua-monitor-login.firebaseapp.com",
      databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com",
      projectId: "aqua-monitor-login",
      storageBucket: "aqua-monitor-login.appspot.com",
      messagingSenderId: "000000000000", // opcional (não usado aqui)
      appId: "1:000000000000:web:xxxxxxxxxxxxxxxx" // opcional (não usado aqui)
    };
    firebase.initializeApp(firebaseConfig);
  }
})();

/* =========================
 * 2) UTILIDADES & UI
 * ========================= */
const $ = (sel) => document.querySelector(sel);

const els = {
  // header / status conexão
  connLed: $("#conn-led"),
  connTxt: $("#conn-txt"),

  // KPIs – caixa
  mainPct: $("#main-level-value"),
  mainLiters: $("#main-level-liters"),
  barMain: $("#level-fill-main"),
  tankMain: $("#client-water-main"),
  tankMainPct: $("#client-level-percent-main"),

  // KPIs – reservatório
  resPct: $("#res-level-value"),
  resLiters: $("#res-level-liters"),
  barRes: $("#level-fill-res"),
  tankRes: $("#client-water-res"),
  tankResPct: $("#client-level-percent-res"),

  // status / modo
  pumpPill: $("#pump-status-value"),
  pumpTxt: $("#pump-status-text"),
  modePill: $("#mode-value"),
  modeTxt: $("#mode-text"),

  // controles
  autoSwitch: $("#auto-mode-switch"),
  motorBtn: $("#motor-button"),
  motorStatus: $("#motor-status"),
  feriasBtn: $("#btn-ferias"),

  // consumo / export
  consValue: $("#consumption-value"),
  consTxt: $("#consumption-text"),
  exportRange: $("#export-range"),
  exportFormat: $("#export-format"),
  exportSep: $("#export-sep"),
  exportBtn: $("#btn-export-csv"),
};

function setOnline(on) {
  if (!els.connLed || !els.connTxt) return;
  els.connLed.classList.toggle("on", !!on);
  els.connTxt.textContent = on ? "Online" : "Conectando...";
}

function litersFromPercent(pct) {
  // Ajuste se tiver volume real da caixa/reservatório
  // Ex: 100% = 1000 L → multiplique por 10
  // Por ora, só mostra "-- L"
  return "-- L";
}

function fmtPct(n) {
  if (Number.isFinite(n)) return `${Math.round(n)}%`;
  return "--%";
}

function safe(n, def = 0) {
  return Number.isFinite(n) ? n : def;
}

function enableControls(enabled) {
  if (els.autoSwitch) els.autoSwitch.disabled = !enabled;
  if (els.motorBtn) els.motorBtn.disabled = !enabled;
  if (els.feriasBtn) els.feriasBtn.disabled = !enabled;
}

/* =========================
 * 3) ESTADO GLOBAL
 * ========================= */
const db = () => firebase.database();

let authUser = null;
let userRole = "anon"; // 'admin' | 'cliente' | 'anon'
let unsubscribes = [];

let chart; // Chart.js
let historyBuffer = []; // últimos N pontos {ts, nivel, nivelReservatorio}

/* =========================
 * 4) AUTH FLUXO
 * ========================= */
async function ensureSession() {
  return new Promise((resolve) => {
    firebase.auth().onAuthStateChanged(async (user) => {
      authUser = user || null;

      if (!authUser) {
        // Sem sessão → entra anônimo (apenas leitura)
        try {
          const res = await firebase.auth().signInAnonymously();
          authUser = res.user;
          userRole = "anon";
        } catch (e) {
          console.error("[auth] erro anônimo:", e);
        }
      } else {
        // Tem sessão: tenta ler papel (usuarios/{uid}/role)
        try {
          const snap = await db().ref(`usuarios/${authUser.uid}/role`).get();
          userRole = snap.exists() ? String(snap.val()) : "anon";
        } catch {
          userRole = "anon";
        }
      }

      // Habilita/desabilita controles
      const canControl = userRole === "admin" || userRole === "cliente";
      enableControls(canControl);

      resolve(authUser);
    });
  });
}

/* =========================
 * 5) LISTENERS EM TEMPO REAL
 * ========================= */
function listenSensorData() {
  const ref = db().ref("sensorData");
  const onVal = ref.on("value", (snap) => {
    setOnline(true);
    const v = snap.val() || {};
    const main = safe(v.level, NaN);
    const res = safe(v.levelReservatorio, NaN);

    // KPIs Caixa
    if (els.mainPct) els.mainPct.textContent = fmtPct(main);
    if (els.mainLiters) els.mainLiters.textContent = litersFromPercent(main);
    if (els.barMain) els.barMain.style.width = `${safe(main, 0)}%`;
    if (els.tankMain) els.tankMain.style.height = `${safe(main, 0)}%`;
    if (els.tankMainPct) els.tankMainPct.textContent = String(safe(main, 0));

    // KPIs Reservatório
    if (els.resPct) els.resPct.textContent = fmtPct(res);
    if (els.resLiters) els.resLiters.textContent = litersFromPercent(res);
    if (els.barRes) els.barRes.style.width = `${safe(res, 0)}%`;
    if (els.tankRes) els.tankRes.style.height = `${safe(res, 0)}%`;
    if (els.tankResPct) els.tankResPct.textContent = String(safe(res, 0));
  }, (err) => {
    console.warn("[sensorData] erro:", err?.message || err);
    setOnline(false);
  });

  unsubscribes.push(() => ref.off("value", onVal));
}

function listenControle() {
  const ref = db().ref("bomba/controle");
  const onVal = ref.on("value", (snap) => {
    setOnline(true);
    const v = snap.val() || {};

    // status da bomba (campo atualizado pelo ESP)
    const status = String(v.statusBomba || "--");
    if (els.pumpPill) {
      els.pumpPill.textContent = status === "LIGADA" ? "ON" : status === "DESLIGADA" ? "OFF" : "--";
      els.pumpPill.classList.toggle("on", status === "LIGADA");
      els.pumpPill.classList.toggle("off", status === "DESLIGADA");
    }
    if (els.pumpTxt) els.pumpTxt.textContent = `A bomba está ${status === "LIGADA" ? "LIGADA" : status === "DESLIGADA" ? "DESLIGADA" : "--"}.`;
    if (els.motorStatus) els.motorStatus.textContent = status;

    // modo (auto/manual)
    const modo = String(v.modo || "automatico");
    if (els.modePill) {
      els.modePill.textContent = modo === "automatico" ? "AUTO" : modo === "manual" ? "MAN" : "--";
      els.modePill.classList.toggle("auto", modo === "automatico");
      els.modePill.classList.toggle("man", modo === "manual");
    }
    if (els.modeTxt) els.modeTxt.textContent = `Operando em modo ${modo === "automatico" ? "automático" : modo === "manual" ? "manual" : "--"}.`;
    if (els.autoSwitch) els.autoSwitch.checked = (modo === "automatico");

    // modoOperacao (normal/ferias) → só para legenda do botão
    const op = String(v.modoOperacao || "normal");
    if (els.feriasBtn) els.feriasBtn.textContent = (op === "ferias") ? "Desativar Modo Férias" : "Ativar Modo Férias";
  }, (err) => {
    console.warn("[controle] erro:", err?.message || err);
    setOnline(false);
  });

  unsubscribes.push(() => ref.off("value", onVal));
}

function listenHistorico() {
  // Trás os últimos ~200 pontos para gráfico
  const ref = db().ref("historico").limitToLast(200);
  const onVal = ref.on("value", (snap) => {
    setOnline(true);
    const data = snap.val() || {};
    const arr = Object.entries(data).map(([k, v]) => ({
      ts: Number(v.timestamp || 0),
      nivel: Number(v.nivel || 0),
      nivelReservatorio: Number(v.nivelReservatorio || 0),
    })).filter(p => Number.isFinite(p.ts)).sort((a, b) => a.ts - b.ts);

    historyBuffer = arr;
    renderChart(arr);
    calcConsumption(arr);
  }, (err) => {
    console.warn("[historico] erro:", err?.message || err);
    setOnline(false);
  });

  unsubscribes.push(() => ref.off("value", onVal));
}

/* =========================
 * 6) GRÁFICO & CONSUMO
 * ========================= */
function renderChart(points) {
  const ctx = document.getElementById("levelChart");
  if (!ctx) return;

  const labels = points.map(p => new Date(p.ts).toLocaleString());
  const data = points.map(p => p.nivel);

  if (!chart) {
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Nível Caixa (%)",
          data,
          borderWidth: 2,
          fill: true,
          tension: 0.25
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { min: 0, max: 100 }
        }
      }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  }
}

function calcConsumption(points) {
  // Estimativa simples: média da variação negativa (queda) por dia
  if (!points || points.length < 2) {
    if (els.consValue) els.consValue.textContent = "-- L/dia";
    if (els.consTxt) els.consTxt.textContent = "Estimando pelo histórico...";
    return;
  }

  // Agrupa por dia (UTC) e calcula queda média
  const byDay = new Map(); // dayKey -> [pct...]
  for (const p of points) {
    const d = new Date(p.ts);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(p.nivel);
  }

  let totalDrop = 0;
  let countDays = 0;

  for (const [, arr] of byDay) {
    if (arr.length < 2) continue;
    const drop = Math.max(0, arr[0] - arr[arr.length - 1]); // queda no dia
    totalDrop += drop;
    countDays++;
  }

  const avgDropPct = countDays ? totalDrop / countDays : 0;

  // Sem volume real mapeado, mostramos "-- L/dia"
  if (els.consValue) els.consValue.textContent = "-- L/dia";
  if (els.consTxt) els.consTxt.textContent = countDays
    ? `Baseado em ${countDays} dia(s) de histórico.`
    : "Estimando pelo histórico...";
}

/* =========================
 * 7) EXPORT CSV
 * ========================= */
function exportCSV(points, rangeDays, fmt, sep) {
  const now = Date.now();
  const start = now - rangeDays * 24 * 3600 * 1000;

  const rows = [];
  if (fmt === "simple") {
    rows.push(["data_hora", "nivel_caixa_percent", "nivel_reservatorio_percent"]);
  } else {
    rows.push(["data_hora", "timestamp_ms", "nivel_caixa_percent", "nivel_reservatorio_percent"]);
  }

  for (const p of points) {
    if (p.ts < start) continue;
    const dt = new Date(p.ts);
    const dataHora = dt.toLocaleDateString() + " " + dt.toLocaleTimeString();
    if (fmt === "simple") {
      rows.push([dataHora, Math.round(p.nivel), Math.round(p.nivelReservatorio)]);
    } else {
      rows.push([dataHora, p.ts, Math.round(p.nivel), Math.round(p.nivelReservatorio)]);
    }
  }

  const delimiter = sep === "," ? "," : ";";
  const csv = rows.map(r =>
    r.map(v => (String(v).includes(delimiter) ? `"${String(v).replace(/"/g, '""')}"` : v))
     .join(delimiter)
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historico_${rangeDays}d_${fmt}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================
 * 8) HANDLERS DE CONTROLE
 * ========================= */
function canWrite() {
  return userRole === "admin" || userRole === "cliente";
}

async function setModoAutomatico(ativo) {
  if (!canWrite()) return alert("Sem permissão para alterar o modo.");
  try {
    await db().ref("bomba/controle/modo").set(ativo ? "automatico" : "manual");
  } catch (e) {
    alert("Erro ao mudar modo: " + (e?.message || e));
  }
}

async function toggleMotor() {
  if (!canWrite()) return alert("Sem permissão para controlar a bomba.");
  try {
    // Lê status atual (renderizado) para decidir o comando
    const status = (els.motorStatus?.textContent || "").toUpperCase();
    const cmd = (status === "LIGADA") ? "DESLIGAR" : "LIGAR";
    // Para garantir execução em modo manual:
    await db().ref("bomba/controle/modo").set("manual");
    await db().ref("bomba/controle/comandoManual").set(cmd);
  } catch (e) {
    alert("Erro ao enviar comando: " + (e?.message || e));
  }
}

async function toggleFerias() {
  if (!canWrite()) return alert("Sem permissão para alterar o modo.");
  try {
    const snap = await db().ref("bomba/controle/modoOperacao").get();
    const cur = snap.exists() ? String(snap.val()) : "normal";
    await db().ref("bomba/controle/modoOperacao").set(cur === "ferias" ? "normal" : "ferias");
  } catch (e) {
    alert("Erro ao alternar Modo Férias: " + (e?.message || e));
  }
}

/* =========================
 * 9) BOOTSTRAP
 * ========================= */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[dashboard] iniciado.");
  setOnline(false);

  await ensureSession();

  // Listeners principais
  listenSensorData();
  listenControle();
  listenHistorico();

  // Controles UI
  if (els.autoSwitch) {
    els.autoSwitch.addEventListener("change", (ev) => setModoAutomatico(ev.target.checked));
  }
  if (els.motorBtn) {
    els.motorBtn.addEventListener("click", toggleMotor);
  }
  if (els.feriasBtn) {
    els.feriasBtn.addEventListener("click", toggleFerias);
  }

  // Export CSV
  if (els.exportBtn) {
    els.exportBtn.addEventListener("click", () => {
      const range = parseInt(els.exportRange?.value || "7", 10);
      const fmt = els.exportFormat?.value || "simple";
      const sep = els.exportSep?.value || ";";
      exportCSV(historyBuffer, range, fmt, sep);
    });
  }

  // Limpeza (se navegar/fechar)
  window.addEventListener("beforeunload", () => {
    unsubscribes.forEach((fn) => {
      try { fn(); } catch {}
    });
  });
});
