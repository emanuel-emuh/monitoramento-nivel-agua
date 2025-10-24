// ===================================================================
//  AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//  Versão estruturada (v11) – robusto e sem alertas de debug
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log("Admin script starting (v11)...");

  // --- Estado Firebase/refs
  let auth, database;
  let sensorRef, controlRef, settingsRef, historyRef, logsRef, lastSeenRef;
  let listenersAttached = false;

  // --- Referências DOM
  let levelCard, resLevelCard, pumpStatusCard, collectionStatusCard, connectionStatusCard, lastSeenText;
  let lowLimitInput, highLimitInput, settingsFeedback, toggleCollectionButton, restartEspButton;
  let logEntriesList, adminWaterMain, adminWaterRes, adminLevelPercentMain, adminLevelPercentRes;
  let saveSettingsButton, clearHistoryButton, logoutButton, clearLogsButton;

  // 1) Inicializa Firebase
  function initializeFirebase() {
    const firebaseConfig = {
      apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
      authDomain: "aqua-monitor-login.firebaseapp.com",
      projectId: "aqua-monitor-login",
      databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
    };
    try {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      database = firebase.database();
      console.log("[OK] Firebase inicializado.");
      return true;
    } catch (e) {
      console.error("[ERRO] Firebase init:", e);
      alert("Erro crítico ao inicializar a conexão.");
      return false;
    }
  }

  // 2) DOM
  function getDomReferences() {
    try {
      levelCard = document.getElementById('admin-level-card');
      resLevelCard = document.getElementById('admin-res-level-card');
      pumpStatusCard = document.getElementById('admin-pump-status-card');
      collectionStatusCard = document.getElementById('admin-collection-status-card');
      connectionStatusCard = document.getElementById('admin-connection-status');
      lastSeenText = document.getElementById('admin-last-seen');

      lowLimitInput = document.getElementById('low-limit-input');
      highLimitInput = document.getElementById('high-limit-input');
      settingsFeedback = document.getElementById('settings-feedback');

      toggleCollectionButton = document.getElementById('toggle-collection-button');
      restartEspButton = document.getElementById('restart-esp-button');

      logEntriesList = document.getElementById('log-entries');

      adminWaterMain = document.getElementById('admin-water-main');
      adminWaterRes = document.getElementById('admin-water-res');
      adminLevelPercentMain = document.getElementById('admin-level-percent-main');
      adminLevelPercentRes = document.getElementById('admin-level-percent-res');

      saveSettingsButton = document.getElementById('save-settings-button');
      clearHistoryButton = document.getElementById('clear-history-button');
      clearLogsButton = document.getElementById('clear-logs-button');
      logoutButton = document.querySelector('.logout-button');

      return true;
    } catch (e) {
      console.error("[ERRO] getDomReferences:", e);
      return false;
    }
  }

  // 3) Refs do RTDB
  function getFirebaseReferences() {
    try {
      sensorRef = database.ref('sensorData');
      controlRef = database.ref('bomba/controle');
      settingsRef = database.ref('configuracoes/sistema');
      historyRef = database.ref('historico');
      logsRef = database.ref('logs');
      lastSeenRef = database.ref('sensorData/lastSeen');
      return true;
    } catch (e) {
      console.error("[ERRO] getFirebaseReferences:", e);
      alert("Erro ao obter referências do Firebase.");
      return false;
    }
  }

  // 4) Habilita controles
  function enableAdminControls() {
    try {
      saveSettingsButton?.addEventListener('click', saveSettingsHandler);
      toggleCollectionButton?.addEventListener('click', toggleCollectionHandler);
      clearHistoryButton?.addEventListener('click', clearHistoryHandler);
      clearLogsButton?.addEventListener('click', clearLogsHandler);
      restartEspButton?.addEventListener('click', restartEspHandler);
      logoutButton?.addEventListener('click', logoutHandler);

      // estado inicial dos botões
      if (toggleCollectionButton) { toggleCollectionButton.disabled = true; toggleCollectionButton.textContent = 'Aguard...'; }
      return true;
    } catch (e) {
      console.error("[ERRO] enableAdminControls:", e);
      return false;
    }
  }

  // 5) Handlers
  function logoutHandler(ev) {
    ev?.preventDefault();
    auth?.signOut().then(() => (window.location.href = 'login.html'));
  }

  function saveSettingsHandler() {
    const low = parseInt(lowLimitInput?.value);
    const high = parseInt(highLimitInput?.value);
    if (isNaN(low) || isNaN(high) || low < 0 || high > 100 || low >= high) {
      alert('Limites inválidos.'); return;
    }
    settingsRef?.update({ limiteInferior: low, limiteSuperior: high })
      .then(() => {
        if (settingsFeedback) settingsFeedback.textContent = 'Salvo!';
        setTimeout(() => { if (settingsFeedback) settingsFeedback.textContent = ''; }, 2500);
      })
      .catch(err => alert('Erro ao salvar: ' + err.message));
  }

  function toggleCollectionHandler() {
    if (!toggleCollectionButton || !sensorRef) return;
    toggleCollectionButton.disabled = true;
    sensorRef.child('coletaAtiva').get()
      .then(snap => sensorRef.update({ coletaAtiva: snap.val() === false }))
      .catch(err => alert('Erro ao alterar: ' + err.message));
  }

  function clearHistoryHandler() {
    if (!historyRef) return;
    if (confirm('Apagar TODO o histórico?')) {
      historyRef.remove().then(() => alert('Histórico limpo!'))
        .catch(err => alert('Erro: ' + err.message));
    }
  }

  function clearLogsHandler() {
    if (!logsRef) return;
    if (confirm('Apagar TODO o log de eventos?')) {
      logsRef.remove().then(() => alert('Log limpo!'))
        .catch(err => alert('Erro: ' + err.message));
    }
  }

  function restartEspHandler() {
    if (!controlRef) return;
    if (confirm('Reiniciar o ESP?')) {
      controlRef.update({ comandoRestart: true })
        .then(() => alert('Comando enviado.'))
        .catch(err => alert('Erro: ' + err.message));
    }
  }

  // 6) Listeners RTDB
  function attachFirebaseListeners() {
    if (!sensorRef || !controlRef || !settingsRef || !logsRef || !lastSeenRef) {
      console.error("[ERRO] Faltam referências para listeners.");
      return;
    }

    // Sensor
    sensorRef.on('value', snap => {
      const d = snap.val() || {};
      const levelMain = d.level ?? '--';
      const levelRes  = d.levelReservatorio ?? '--';
      const active    = d.coletaAtiva !== false;

      // UI tank
      if (adminWaterMain) adminWaterMain.style.height = `${levelMain !== '--' ? levelMain : 0}%`;
      if (adminWaterRes)  adminWaterRes.style.height  = `${levelRes  !== '--' ? levelRes  : 0}%`;
      if (adminLevelPercentMain) adminLevelPercentMain.textContent = levelMain;
      if (adminLevelPercentRes)  adminLevelPercentRes.textContent  = levelRes;

      if (levelCard)     levelCard.textContent     = `${levelMain}%`;
      if (resLevelCard)  resLevelCard.textContent  = `${levelRes}%`;

      if (collectionStatusCard) {
        collectionStatusCard.textContent = active ? 'ATIVA' : 'PAUSADA';
        collectionStatusCard.style.color = active ? '#2e7d32' : '#d32f2f';
      }
      if (toggleCollectionButton) {
        toggleCollectionButton.textContent = active ? 'Pausar Coleta' : 'Retomar Coleta';
        toggleCollectionButton.className = `btn btn-action ${active ? 'btn-red' : 'btn-green'}`;
        toggleCollectionButton.disabled = false;
      }
    }, err => console.error("sensorRef err:", err));

    // Controle
    controlRef.on('value', snap => {
      const d = snap.val() || {};
      const st = d.statusBomba || '--';
      if (pumpStatusCard) {
        pumpStatusCard.textContent = st;
        pumpStatusCard.style.color = (st === 'LIGADA') ? '#2e7d32' : '#d32f2f';
      }
    }, err => console.error("controlRef err:", err));

    // Settings
    settingsRef.on('value', snap => {
      const s = snap.val() || {};
      if (lowLimitInput)  lowLimitInput.value  = s.limiteInferior ?? 50;
      if (highLimitInput) highLimitInput.value = s.limiteSuperior ?? 95;
    }, err => console.error("settingsRef err:", err));

    // Last Seen
    lastSeenRef.on('value', snap => {
      if (!connectionStatusCard || !lastSeenText) return;
      if (!snap.exists()) {
        connectionStatusCard.textContent = '??';
        connectionStatusCard.style.color = '#6c757d';
        lastSeenText.textContent = 'Nenhum sinal.';
        return;
      }
      const ts = snap.val();
      if (typeof ts !== 'number' || ts <= 0) {
        connectionStatusCard.textContent = '??';
        connectionStatusCard.style.color = '#6c757d';
        lastSeenText.textContent = 'Inválido.';
        return;
      }
      const diffM = (Date.now() - ts) / 60000;
      connectionStatusCard.textContent = diffM > 5 ? 'OFFLINE' : 'ONLINE';
      connectionStatusCard.style.color = diffM > 5 ? '#d32f2f' : '#2e7d32';
      lastSeenText.textContent = `Visto: ${new Date(ts).toLocaleString('pt-BR')}`;
    }, err => console.error("lastSeenRef err:", err));

    // Logs (últimos 50)
    logsRef.orderByChild('timestamp').limitToLast(50).on('value', snap => {
      if (!logEntriesList) return;
      logEntriesList.innerHTML = '';
      if (!snap.exists()) {
        logEntriesList.innerHTML = '<li>Nenhum log registrado.</li>';
        return;
      }
      const arr = [];
      snap.forEach(cs => {
        const d = cs.val();
        if (d && typeof d.timestamp === 'number' && typeof d.message === 'string') arr.push(d);
      });
      arr.sort((a,b) => b.timestamp - a.timestamp);
      if (!arr.length) {
        logEntriesList.innerHTML = '<li>Nenhum log válido.</li>';
        return;
      }
      arr.forEach(l => {
        const dt = new Date(l.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
        const li = document.createElement('li');
        li.textContent = `[${dt}] ${l.message}`;
        logEntriesList.appendChild(li);
      });
    }, err => {
      if (logEntriesList) logEntriesList.innerHTML = '<li>Erro ao ler logs.</li>';
      console.error("logsRef err:", err);
    });

    console.log("[OK] Listeners conectados.");
  }

  // 7) Boot com proteção por auth & role
  if (initializeFirebase()) {
    auth.onAuthStateChanged(user => {
      if (!user) { window.location.href = 'login.html'; return; }
      database.ref('usuarios/' + user.uid).get()
        .then(snap => {
          if (snap.exists() && snap.val().role === 'admin') {
            if (!listenersAttached) {
              if (getDomReferences() && getFirebaseReferences() && enableAdminControls()) {
                attachFirebaseListeners();
                listenersAttached = true;
              } else {
                alert("Falha ao iniciar painel.");
              }
            }
          } else {
            alert('Acesso negado.');
            try { window.location.href = 'index.html'; } catch { window.location.href = 'login.html'; }
          }
        })
        .catch(err => { console.error("Permissão err:", err); window.location.href = 'login.html'; });
    });
  }
});
