// ===================================================================
//  AQUAMONITOR - DASHBOARD DO CLIENTE (dashboard.js)
//  Estruturado e robusto, com garantias para comando manual.
// ===================================================================

(function () {
  'use strict';

  // -----------------------------
  // 1) INITIALIZAÇÃO DO FIREBASE
  // -----------------------------
  const firebaseConfig = {
    apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
    authDomain: "aqua-monitor-login.firebaseapp.com",
    projectId: "aqua-monitor-login",
    databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
  };

  let auth, database;

  function initFirebase() {
    try {
      if (!window.firebase) throw new Error("Firebase SDK não encontrado.");
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      database = firebase.database();
      console.log("[OK] Firebase inicializado.");
    } catch (e) {
      console.error("[ERRO] Falha ao inicializar Firebase:", e);
      alert("Erro crítico ao inicializar a conexão. Recarregue a página.");
      throw e;
    }
  }

  // --------------------------------
  // 2) CAPTURA DOS ELEMENTOS DE DOM
  // --------------------------------
  const DOM = {};
  function getDomRefs() {
    // navegação / sessão
    DOM.logoutButton = document.querySelector('.logout-button');

    // cards topo (níveis, status)
    DOM.mainLevelValue       = document.getElementById('main-level-value');
    DOM.mainLevelLiters      = document.getElementById('main-level-liters');
    DOM.levelFillMain        = document.getElementById('level-fill-main');
    DOM.levelPercentageMain  = document.getElementById('level-percentage-main');
    DOM.clientWaterMain      = document.getElementById('client-water-main');
    DOM.clientLevelPercentMain = document.getElementById('client-level-percent-main');

    DOM.resLevelValue        = document.getElementById('res-level-value');
    DOM.resLevelLiters       = document.getElementById('res-level-liters');
    DOM.levelFillRes         = document.getElementById('level-fill-res');
    DOM.levelPercentageRes   = document.getElementById('level-percentage-res');
    DOM.clientWaterRes       = document.getElementById('client-water-res');
    DOM.clientLevelPercentRes  = document.getElementById('client-level-percent-res');

    // consumo (cálculo pela série)
    DOM.consumptionValue     = document.getElementById('consumption-value');
    DOM.consumptionText      = document.getElementById('consumption-text');

    // controles
    DOM.autoModeSwitch       = document.getElementById('auto-mode-switch');
    DOM.motorButton          = document.getElementById('motor-button');
    DOM.motorStatus          = document.getElementById('motor-status');

    DOM.pumpStatusIcon       = document.getElementById('pump-status-icon');
    DOM.pumpStatusValue      = document.getElementById('pump-status-value');
    DOM.pumpStatusText       = document.getElementById('pump-status-text');

    DOM.modeIcon             = document.getElementById('mode-icon');
    DOM.modeValue            = document.getElementById('mode-value');
    DOM.modeText             = document.getElementById('mode-text');

    // férias
    DOM.btnFerias            = document.getElementById('btn-ferias');
    DOM.feriasInfo           = document.getElementById('ferias-info');

    // gráfico
    DOM.levelChartCtx        = document.getElementById('levelChart')?.getContext('2d');

    console.log("[OK] DOM capturado.");
  }

  // ----------------------
  // 3) VARS E REFERÊNCIAS
  // ----------------------
  const totalVolumeLiters = 1.728; // 12cm x 12cm x 12cm = 1,728 L (exemplo)
  let levelChart = null;
  let listenersAttached = false;

  // RTDB refs
  let sensorRef, controlRef, historyRef, settingsRef;

  function getDbRefs() {
    sensorRef   = database.ref('sensorData');
    controlRef  = database.ref('bomba/controle');
    historyRef  = database.ref('historico');
    settingsRef = database.ref('configuracoes/sistema');
    console.log("[OK] Referências do RTDB obtidas.");
  }

  // --------------------------------
  // 4) FUNÇÕES DE ATUALIZAÇÃO DE UI
  // --------------------------------
  function updateDashboardUI(levelMain, levelRes) {
    const {
      mainLevelValue, mainLevelLiters, levelFillMain, levelPercentageMain,
      clientWaterMain, clientLevelPercentMain,
      resLevelValue, resLevelLiters, levelFillRes, levelPercentageRes,
      clientWaterRes, clientLevelPercentRes
    } = DOM;

    const isDataValid = typeof levelMain === 'number' && typeof levelRes === 'number';

    const currentLitersMain = isDataValid ? (totalVolumeLiters * (levelMain / 100)).toFixed(1) : '--';
    if (mainLevelValue)      mainLevelValue.textContent      = isDataValid ? `${levelMain}%` : '--%';
    if (mainLevelLiters)     mainLevelLiters.textContent     = isDataValid ? `${currentLitersMain} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
    if (levelFillMain)       levelFillMain.style.width       = isDataValid ? levelMain + '%' : '0%';
    if (levelPercentageMain) levelPercentageMain.textContent = isDataValid ? `${levelMain}%` : '--%';
    if (clientWaterMain)     clientWaterMain.style.height    = isDataValid ? levelMain + '%' : '0%';
    if (clientLevelPercentMain) clientLevelPercentMain.textContent = isDataValid ? levelMain : '--';

    if (levelFillMain) {
      if (!isDataValid) levelFillMain.className = 'level-fill';
      else if (levelMain <= 50) levelFillMain.className = 'level-fill level-low';
      else if (levelMain < 95)  levelFillMain.className = 'level-fill level-medium';
      else                      levelFillMain.className = 'level-fill level-high';
    }

    const currentLitersRes = isDataValid ? (totalVolumeLiters * (levelRes / 100)).toFixed(1) : '--';
    if (resLevelValue)      resLevelValue.textContent      = isDataValid ? `${levelRes}%` : '--%';
    if (resLevelLiters)     resLevelLiters.textContent     = isDataValid ? `${currentLitersRes} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
    if (levelFillRes)       levelFillRes.style.width       = isDataValid ? levelRes + '%' : '0%';
    if (levelPercentageRes) levelPercentageRes.textContent = isDataValid ? `${levelRes}%` : '--%';
    if (clientWaterRes)     clientWaterRes.style.height    = isDataValid ? levelRes + '%' : '0%';
    if (clientLevelPercentRes) clientLevelPercentRes.textContent = isDataValid ? levelRes : '--';

    if (levelFillRes) {
      if (!isDataValid) levelFillRes.className = 'level-fill';
      else if (levelRes <= 50) levelFillRes.className = 'level-fill level-low';
      else if (levelRes < 95)  levelFillRes.className = 'level-fill level-medium';
      else                     levelFillRes.className = 'level-fill level-high';
    }
  }

  function updatePumpControlsUI(data) {
    const {
      motorStatus, pumpStatusValue, pumpStatusText, pumpStatusIcon,
      modeValue, modeText, modeIcon, motorButton, autoModeSwitch,
      btnFerias, feriasInfo
    } = DOM;

    const statusBomba = data.statusBomba || '--';
    const modo        = data.modo || '--';
    const modoOp      = data.modoOperacao || 'normal';

    if (motorStatus)      motorStatus.textContent = statusBomba;
    if (pumpStatusValue)  pumpStatusValue.textContent = statusBomba === 'LIGADA' ? 'ON' : (statusBomba === 'DESLIGADA' ? 'OFF' : '--');
    if (pumpStatusText)   pumpStatusText.textContent  = statusBomba !== '--' ? `A bomba está ${statusBomba}.` : 'Aguardando...';
    if (pumpStatusIcon)   pumpStatusIcon.className = 'card-icon ' + (statusBomba === 'LIGADA' ? 'icon-green' : 'icon-red');

    if (modeValue) modeValue.textContent = modo === 'automatico' ? 'AUTO' : (modo === 'manual' ? 'MAN' : '--');
    if (modeText)  modeText.textContent  = modo !== '--' ? `Operando em modo ${modo}.` : 'Aguardando...';
    if (modeIcon)  modeIcon.className    = 'card-icon ' + (modo === 'automatico' ? 'icon-green' : (modo === 'manual' ? 'icon-orange' : ''));

    if (motorButton) {
      const ligada = statusBomba === 'LIGADA';
      motorButton.textContent = ligada ? 'Desligar Bomba' : 'Ligar Bomba';
      motorButton.className   = ligada ? 'btn-motor-on' : 'btn-motor-off';
    }

    if (autoModeSwitch) {
      autoModeSwitch.checked = (modo === 'automatico');
      // política: em modo automático, botão manual desabilitado
      if (motorButton) motorButton.disabled = (modo === 'automatico');
    }

    if (btnFerias && feriasInfo) {
      if (modoOp === 'ferias') {
        btnFerias.textContent = 'Desativar Modo Férias';
        btnFerias.className   = 'ferias';
        feriasInfo.innerHTML  = '<b>Modo Férias ATIVADO:</b> Limites econômicos em uso.';
      } else {
        btnFerias.textContent = 'Ativar Modo Férias';
        btnFerias.className   = 'normal';
        feriasInfo.innerHTML  = '<b>Modo Férias:</b> Usa limites de 15% a 50% para economizar.';
      }
      btnFerias.disabled = false;
    }
  }

  // consumo médio (litros/dia) a partir do histórico
  function updateConsumptionFromHistory(historyData) {
    const { consumptionValue, consumptionText } = DOM;
    if (!consumptionValue || !consumptionText) return;

    if (!historyData || typeof historyData !== 'object') {
      consumptionValue.textContent = '--';
      consumptionText.textContent = 'Calculando...';
      return;
    }

    const entries = Object.values(historyData)
      .filter(e => e && typeof e === 'object' && typeof e.timestamp === 'number' && typeof e.nivel === 'number')
      .sort((a, b) => a.timestamp - b.timestamp);

    if (entries.length < 2) {
      consumptionValue.textContent = '0 L/dia';
      consumptionText.textContent  = 'Dados insuficientes.';
      return;
    }

    const byDay = {};
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const curr = entries[i];
      if (curr.nivel > prev.nivel) continue; // descarta enchimento
      const d = new Date(curr.timestamp).toLocaleDateString('pt-BR');
      byDay[d] = (byDay[d] || 0) + (prev.nivel - curr.nivel);
    }

    const drops = Object.values(byDay);
    if (drops.length === 0) {
      consumptionValue.textContent = '0 L/dia';
      consumptionText.textContent  = 'Sem consumo registrado.';
      return;
    }

    const totalPercent = drops.reduce((s, v) => s + v, 0);
    const avgPercent   = totalPercent / drops.length;
    const avgLiters    = (totalVolumeLiters * (avgPercent / 100)).toFixed(1);

    consumptionValue.textContent = `${avgLiters} L/dia`;
    consumptionText.textContent  = `Méd. últimos ${drops.length} dias.`;
  }

  // -------------------------
  // 5) GRÁFICO (se disponível)
  // -------------------------
  function ensureChart(historyData) {
    if (!DOM.levelChartCtx || !window.Chart) return;

    const points = [];
    const labels = [];

    const entries = Object.values(historyData || {})
      .filter(e => e && typeof e === 'object' && typeof e.timestamp === 'number' && typeof e.nivel === 'number')
      .sort((a, b) => a.timestamp - b.timestamp);

    entries.forEach(e => {
      labels.push(new Date(e.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      points.push(e.nivel);
    });

    if (!levelChart) {
      levelChart = new Chart(DOM.levelChartCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Nível Caixa Principal (%)',
            data: points,
            fill: true,
          }]
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100 } }
        }
      });
    } else {
      levelChart.data.labels = labels;
      levelChart.data.datasets[0].data = points;
      levelChart.update('none');
    }
  }

  // ------------------------------
  // 6) LISTENERS (tempo real RTDB)
  // ------------------------------
  function attachListeners() {
    if (listenersAttached) return;

    // sensor (níveis)
    sensorRef.on('value', snap => {
      const d = snap.val() || {};
      const levelMain = typeof d.level === 'number' ? d.level : undefined;
      const levelRes  = typeof d.levelReservatorio === 'number' ? d.levelReservatorio : undefined;
      updateDashboardUI(levelMain, levelRes);
    }, err => console.error("sensorRef error:", err));

    // controle (status bomba, modo, férias)
    controlRef.on('value', snap => {
      updatePumpControlsUI(snap.val() || {});
    }, err => console.error("controlRef error:", err));

    // histórico (consumo + gráfico)
    historyRef.limitToLast(200).on('value', snap => {
      const data = snap.val() || {};
      updateConsumptionFromHistory(data);
      ensureChart(data);
    }, err => console.error("historyRef error:", err));

    // configurações (se quiser espelhar algo)
    settingsRef.on('value', snap => {
      // placeholder – hoje não há UI aqui no dashboard do cliente
      // (limites são mostrados no Admin).
    }, err => console.error("settingsRef error:", err));

    listenersAttached = true;
    console.log("[OK] Listeners RTDB conectados.");
  }

  // -------------------------
  // 7) HANDLERS DE CONTROLES
  // -------------------------
  function wireControls() {
    const {
      logoutButton, autoModeSwitch, motorButton,
      btnFerias
    } = DOM;

    // logout
    logoutButton?.addEventListener('click', (e) => {
      e.preventDefault();
      auth?.signOut().then(() => { window.location.href = 'login.html'; });
    });

    // alterna modo automático/man
    autoModeSwitch?.addEventListener('change', async (ev) => {
      const on = !!ev.target.checked;
      try {
        await controlRef.update({ modo: on ? 'automatico' : 'manual' });
        if (motorButton) motorButton.disabled = on; // em auto desabilita
        console.log("[OK] Modo setado para:", on ? 'automatico' : 'manual');
      } catch (e) {
        console.error("Falha ao atualizar modo:", e);
      }
    });

    // botão manual: GARANTE 'manual' antes do comando
    if (motorButton) {
      motorButton.onclick = async () => {
        if (motorButton.disabled) return;
        try {
          motorButton.disabled = true;

          // 1) garante modo manual (firmware só aceita comandoManual no manual)
          await controlRef.update({ modo: 'manual' });
          if (autoModeSwitch) autoModeSwitch.checked = false;

          // 2) decide comando (pelo texto do botão)
          const newCommand = motorButton.textContent.includes('Ligar') ? 'LIGAR' : 'DESLIGAR';

          // 3) envia
          await controlRef.update({ comandoManual: newCommand });

          // 4) feedback imediato; ESP confirmará em statusBomba
          if (newCommand === 'LIGAR') {
            motorButton.textContent = 'Desligar Bomba';
            motorButton.className = 'btn-motor-on';
          } else {
            motorButton.textContent = 'Ligar Bomba';
            motorButton.className = 'btn-motor-off';
          }

          // reabilita após curto intervalo
          setTimeout(() => (motorButton.disabled = false), 800);
        } catch (err) {
          console.error('Erro ao acionar comando manual:', err);
          motorButton.disabled = false;
          alert('Falha ao enviar comando. Tente novamente.');
        }
      };
    }

    // botão modo férias: alterna modoOperacao
    btnFerias?.addEventListener('click', async () => {
      try {
        btnFerias.disabled = true;

        // lê valor atual e alterna
        const snap = await controlRef.child('modoOperacao').get();
        const curr = (snap.exists() ? String(snap.val()) : 'normal').toLowerCase();
        const next = (curr === 'ferias') ? 'normal' : 'ferias';

        await controlRef.update({ modoOperacao: next });

        // feedback imediato; UI completa virá com listener
        if (next === 'ferias') {
          btnFerias.textContent = 'Desativar Modo Férias';
          btnFerias.className = 'ferias';
        } else {
          btnFerias.textContent = 'Ativar Modo Férias';
          btnFerias.className = 'normal';
        }
      } catch (e) {
        console.error("Falha ao alternar modoOperacao:", e);
      } finally {
        btnFerias.disabled = false;
      }
    });
  }

  // ------------------------
  // 8) BOOT DO DASHBOARD
  // ------------------------
  document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard script starting...");
    initFirebase();
    getDomRefs();
    getDbRefs();
    wireControls();
    attachListeners();
  });

  // =======================================================
//  EXPORTAÇÃO CSV DO HISTÓRICO (últimos 7/30 dias)
//  - Lê /historico por timestamp e gera um .csv (UTF-8 com BOM)
//  - Colunas: data_hora, timestamp_ms, nivel_caixa_percent, nivel_reservatorio_percent
// =======================================================

(function setupCsvExport() {
  // garante DOM disponível
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  function wire() {
    const btn = document.getElementById('btn-export-csv');
    const sel = document.getElementById('export-range');
    if (!btn || !sel || !firebase?.database) return;

    btn.addEventListener('click', async () => {
      const days = parseInt(sel.value, 10) || 7;
      const oldTxt = btn.textContent;
      btn.disabled = true; btn.textContent = 'Gerando...';

      try {
        const csv = await exportHistoryCsv(days);
        if (!csv) {
          alert('Sem dados no período selecionado.');
        } else {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const today = new Date();
          const y = today.getFullYear();
          const m = String(today.getMonth()+1).padStart(2, '0');
          const d = String(today.getDate()).padStart(2, '0');
          a.href = url;
          a.download = `historico_${days}d_${y}-${m}-${d}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (e) {
        console.error('Erro ao exportar CSV:', e);
        alert('Erro ao exportar CSV. Veja o console para detalhes.');
      } finally {
        btn.disabled = false; btn.textContent = oldTxt;
      }
    });
  }

  async function exportHistoryCsv(days) {
    const db = firebase.database();
    const ref = db.ref('historico');

    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    const snap = await ref
      .orderByChild('timestamp')
      .startAt(cutoff)
      .endAt(now)
      .once('value');

    if (!snap.exists()) return '';

    // Cabeçalho
    const rows = [['data_hora', 'timestamp_ms', 'nivel_caixa_percent', 'nivel_reservatorio_percent']];

    snap.forEach(child => {
      const v = child.val() || {};
      const ts = Number(v.timestamp) || 0;
      const nivel = (v.nivel ?? v.level ?? null);
      const nivelRes = (v.nivelReservatorio ?? v.levelReservatorio ?? null);
      if (!ts || nivel === null || nivelRes === null) return;
      rows.push([
        new Date(ts).toLocaleString('pt-BR'),
        String(ts),
        String(nivel),
        String(nivelRes)
      ]);
    });

    if (rows.length <= 1) return '';

    // CSV com BOM (excel-friendly)
    const bom = '\uFEFF';
    const csv = bom + rows.map(r => r.map(csvEscape).join(',')).join('\n');
    return csv;
  }

  function csvEscape(val) {
    const s = (val ?? '').toString();
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
})();


})();
