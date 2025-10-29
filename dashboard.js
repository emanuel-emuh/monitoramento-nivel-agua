// ===================================================================
//  AQUAMONITOR – DASHBOARD (v3.0.4)
// ===================================================================
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
    authDomain: "aqua-monitor-login.firebaseapp.com",
    databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com",
    projectId: "aqua-monitor-login",
  };

  const MAX_POINTS = 60;

  let auth, db;
  let sensorRef, controlRef, historicoRef;

  let ultimoStatusBomba = "--";
  let modoAtual = "automatico";
  let modoOperacao = "normal";
  let coletaAtiva = true;

  let chart;
  const chartLabels = [];
  const chartData = [];

  const $ = (id) => document.getElementById(id);
  const el = {
    mainValue: $("main-level-value"),
    resValue: $("res-level-value"),
    mainLiters: $("main-level-liters"),
    resLiters: $("res-level-liters"),
    fillMain: $("level-fill-main"),
    fillRes: $("level-fill-res"),
    tankWaterMain: $("client-water-main"),
    tankWaterRes: $("client-water-res"),
    tankPercentMain: $("client-level-percent-main"),
    tankPercentRes: $("client-level-percent-res"),
    pumpStatusValue: $("pump-status-value"),
    pumpStatusText: $("pump-status-text"),
    modeValue: $("mode-value"),
    modeText: $("mode-text"),
    autoSwitch: $("auto-mode-switch"),
    motorBtn: $("motor-button"),
    motorStatus: $("motor-status"),
    feriasBtn: $("btn-ferias"),
    feriasInfo: $("ferias-info"),
    consumptionValue: $("consumption-value"),
    consumptionText: $("consumption-text"),
    chartCanvas: $("levelChart"),
    exportBtn: $("btn-export-csv"),
    exportRange: $("export-range"),
    exportFormat: $("export-format"),
    exportSep: $("export-sep"),
    connLed: $("conn-led"),
    connTxt: $("conn-txt"),
  };

  document.addEventListener("DOMContentLoaded", boot);

  function boot() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.database();

    setControlsEnabled(false);

    auth.onAuthStateChanged((user) => {
      if (user) {
        setControlsEnabled(true);
      } else {
        auth.signInAnonymously().catch((e) => {
          console.error("[auth anon] erro:", e);
          alert("Falha na autenticação (anônima). Verifique a internet e recarregue.");
        });
      }
    });

    sensorRef = db.ref("sensorData");
    controlRef = db.ref("bomba/controle");
    historicoRef = db.ref("historico");

    attachListeners();
    initChart();
    setupConnectionMonitor();
    setupPollingFallback();

    console.log("[Dashboard] iniciado.");
  }

  function attachListeners() {
    sensorRef.on(
      "value",
      (snap) => {
        const d = snap.val() || {};
        const level = toNum(d.level);
        const levelRes = toNum(d.levelReservatorio);
        coletaAtiva = d.coletaAtiva !== false;
        renderLevels(level, levelRes);
        updateConsumption(level, levelRes);
      },
      (err) => console.error("[sensor] erro:", err)
    );

    controlRef.on(
      "value",
      (snap) => {
        const c = snap.val() || {};
        ultimoStatusBomba = c.statusBomba || ultimoStatusBomba || "--";
        modoAtual = c.modo || modoAtual;
        modoOperacao = c.modoOperacao || modoOperacao;
        renderControl();
      },
      (err) => console.error("[controle] erro:", err)
    );

    historicoRef.orderByChild("timestamp").limitToLast(MAX_POINTS).on(
      "child_added",
      (snap) => {
        const v = snap.val() || {};
        if (typeof v.timestamp !== "number") return;
        pushChartPoint(v.timestamp, toNum(v.nivel));
      },
      (err) => console.error("[historico] erro:", err)
    );

    el.autoSwitch &&
      el.autoSwitch.addEventListener("change", (e) => {
        const auto = !!e.target.checked;
        controlRef.update({ modo: auto ? "automatico" : "manual" })
          .catch((err) => alert("Erro ao mudar modo: " + err.message));
      });

    el.motorBtn &&
      el.motorBtn.addEventListener("click", async () => {
        try {
          el.motorBtn.disabled = true;
          if (modoAtual !== "manual") {
            await controlRef.update({ modo: "manual" });
            modoAtual = "manual";
          }
          const cmd = (ultimoStatusBomba === "LIGADA") ? "DESLIGAR" : "LIGAR";
          await controlRef.update({ comandoManual: cmd });
        } catch (err) {
          alert("Falha ao enviar comando: " + err.message);
        } finally {
          el.motorBtn.disabled = false;
        }
      });

    el.feriasBtn &&
      el.feriasBtn.addEventListener("click", async () => {
        try {
          const novo = modoOperacao === "ferias" ? "normal" : "ferias";
          await controlRef.update({ modoOperacao: novo });
          modoOperacao = novo;
          updateFeriasButton();
        } catch (err) {
          alert("Erro ao alterar Modo Férias: " + err.message);
        }
      });

    el.exportBtn &&
      el.exportBtn.addEventListener("click", handleExportCsv);
  }

  function renderLevels(level, levelRes) {
    if (isFinite(level)) {
      el.mainValue && (el.mainValue.textContent = `${Math.round(level)}%`);
      el.tankPercentMain && (el.tankPercentMain.textContent = Math.round(level));
    }
    if (isFinite(levelRes)) {
      el.resValue && (el.resValue.textContent = `${Math.round(levelRes)}%`);
      el.tankPercentRes && (el.tankPercentRes.textContent = Math.round(levelRes));
    }

    if (el.fillMain && isFinite(level)) {
      el.fillMain.style.width = `${clamp(level, 0, 100)}%`;
      setFillClass(el.fillMain, level);
    }
    if (el.fillRes && isFinite(levelRes)) {
      el.fillRes.style.width = `${clamp(levelRes, 0, 100)}%`;
      setFillClass(el.fillRes, levelRes);
    }

    if (el.tankWaterMain && isFinite(level)) {
      el.tankWaterMain.style.height = `${clamp(level, 0, 100)}%`;
    }
    if (el.tankWaterRes && isFinite(levelRes)) {
      el.tankWaterRes.style.height = `${clamp(levelRes, 0, 100)}%`;
    }
  }

  function renderControl() {
    if (el.pumpStatusValue) {
      el.pumpStatusValue.textContent = (ultimoStatusBomba === "LIGADA") ? "ON" : (ultimoStatusBomba === "DESLIGADA" ? "OFF" : "--");
      el.pumpStatusValue.style.color = ultimoStatusBomba === "LIGADA" ? "#2e7d32" : "#d32f2f";
    }
    if (el.pumpStatusText) {
      el.pumpStatusText.textContent =
        ultimoStatusBomba === "LIGADA" ? "A bomba está LIGADA." :
        ultimoStatusBomba === "DESLIGADA" ? "A bomba está DESLIGADA." : "A bomba está --.";
    }

    if (el.modeValue) el.modeValue.textContent = modoAtual === "automatico" ? "AUTO" : "MAN";
    if (el.modeText)
      el.modeText.textContent = "Operando em modo " + (modoAtual === "automatico" ? "automático." : "manual.");

    if (el.autoSwitch) el.autoSwitch.checked = (modoAtual === "automatico");

    updateMotorButton();
    updateFeriasButton();
  }

  function updateMotorButton() {
    if (!el.motorBtn || !el.motorStatus) return;
    const ligada = ultimoStatusBomba === "LIGADA";
    el.motorBtn.className = ligada ? "btn-motor-on" : "btn-motor-off";
    el.motorBtn.textContent = ligada ? "Desligar Bomba" : "Ligar Bomba";
    el.motorStatus.textContent = ligada ? "LIGADA" : "DESLIGADA";
  }

  function updateFeriasButton() {
    if (!el.feriasBtn || !el.feriasInfo) return;
    const ativo = (modoOperacao === "ferias");
    el.feriasBtn.classList.toggle("ferias", ativo);
    el.feriasBtn.classList.toggle("normal", !ativo);
    el.feriasBtn.textContent = ativo ? "Desativar Modo Férias" : "Ativar Modo Férias";
    el.feriasInfo.innerHTML = ativo
      ? "<b>Modo Férias:</b> ativo. Limites 15% (liga) a 50% (desliga)."
      : "<b>Modo Férias:</b> Usa limites de 15% a 50% para economizar.";
  }

  function initChart() {
    if (!el.chartCanvas || !window.Chart) return;
    chart = new Chart(el.chartCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels: chartLabels,
        datasets: [{ label: "Nível Caixa (%)", data: chartData, fill: true, tension: 0.25 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true, max: 100, ticks: { stepSize: 10 } } },
      },
    });
  }

  function pushChartPoint(ts, level) {
    if (!chart || !isFinite(level)) return;
    chartLabels.push(new Date(ts).toLocaleTimeString("pt-BR"));
    chartData.push(Math.round(level));
    if (chartLabels.length > MAX_POINTS) { chartLabels.shift(); chartData.shift(); }
    chart.update();
  }

  function updateConsumption() {
    if (el.consumptionValue) el.consumptionValue.textContent = "-- L/dia";
    if (el.consumptionText) el.consumptionText.textContent = "Estimando pelo histórico...";
  }

  async function handleExportCsv() {
    const days = parseInt(el.exportRange?.value || "7", 10);
    const formato = el.exportFormat ? el.exportFormat.value : "simple";
    const separador = el.exportSep ? el.exportSep.value : ";";

    const oldTxt = el.exportBtn.textContent;
    el.exportBtn.disabled = true;
    el.exportBtn.textContent = "Gerando...";

    try {
      const csv = await exportHistoryCsv(days, { formato, separador });
      if (!csv) {
        alert("Sem dados no período selecionado.");
      } else {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const suffix = (formato === "full") ? "_full" : "_simple";
        a.href = url;
        a.download = `historico_${days}d${suffix}_${y}-${m}-${d}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Erro ao exportar CSV:", e);
      alert("Erro ao exportar CSV.");
    } finally {
      el.exportBtn.disabled = false;
      el.exportBtn.textContent = oldTxt;
    }
  }

  async function exportHistoryCsv(days, { formato = "simple", separador = ";" } = {}) {
    const ref = db.ref("historico");
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    const snap = await ref.orderByChild("timestamp").startAt(cutoff).endAt(now).once("value");
    if (!snap.exists()) return "";

    const rows = [];
    snap.forEach((child) => {
      const v = child.val() || {};
      const ts = Number(v.timestamp) || 0;
      const nivel = toNum(v.nivel ?? v.level);
      const nivelR = toNum(v.nivelReservatorio ?? v.levelReservatorio);
      if (!ts || nivel == null || nivelR == null) return;
      rows.push({ ts, nivel, nivelR });
    });
    if (!rows.length) return "";

    rows.sort((a, b) => a.ts - b.ts);
    const headersSimple = ["data", "hora", "caixa_percent", "reservatorio_percent"];
    const headersFull = ["data", "hora", "timestamp_ms", "caixa_percent", "reservatorio_percent"];
    const headers = (formato === "full") ? headersFull : headersSimple;

    const lines = [headers];
    for (const r of rows) {
      const dt = new Date(r.ts);
      const data = dt.toLocaleDateString("pt-BR");
      const hora = dt.toLocaleTimeString("pt-BR");
      const caixa = String(Math.round(r.nivel)).replace(".", ",");
      const reserv = String(Math.round(r.nivelR)).replace(".", ",");
      if (formato === "full") lines.push([data, hora, String(r.ts), caixa, reserv]);
      else lines.push([data, hora, caixa, reserv]);
    }

    const bom = "\uFEFF";
    return bom + lines.map((l) => l.map((s) => csvEscape(s, separador)).join(separador)).join("\r\n");
  }

  function setupConnectionMonitor() {
    const infoConnectedRef = firebase.database().ref(".info/connected");
    infoConnectedRef.on("value", (snap) => {
      const ok = !!snap.val();
      console.log(ok ? "[RTDB] conectado" : "[RTDB] desconectado");
      if (el.connLed) el.connLed.style.background = ok ? "#22c55e" : "#f43f5e";
      if (el.connTxt) el.connTxt.textContent = ok ? "Online" : "Offline";
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        try { firebase.database().goOnline(); } catch (e) {}
      }
    });
  }

  function setupPollingFallback() {
    setInterval(() => {
      if (document.hidden) return;
      sensorRef.limitToFirst(1).once("value").catch(()=>{});
      controlRef.limitToFirst(1).once("value").catch(()=>{});
    }, 30000);
  }

  // Utils
  function setControlsEnabled(enabled) {
    ["auto-mode-switch", "motor-button", "btn-ferias"].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.disabled = !enabled;
    });
  }
  function setFillClass(elm, level) {
    elm.classList.remove("level-low", "level-medium", "level-high");
    if (level <= 25) elm.classList.add("level-low");
    else if (level <= 60) elm.classList.add("level-medium");
    else elm.classList.add("level-high");
  }
  function toNum(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function csvEscape(val, sep) {
    const s = (val ?? "").toString();
    const precisa = s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(sep);
    return precisa ? `"${s.replace(/"/g, '""')}"` : s;
  }
})();
