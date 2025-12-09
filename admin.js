// ===================================================================
//  AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//  Versão TCC (Corrigida) – Compatível com ESP8266 e Documentação
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log("Admin script starting (TCC Fixed)...");

  // --- Estado Firebase/refs
  let auth, database;
  let sensorRef, paramsRef, controlRef, historyRef, eventsRef;
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

  // 3) Refs do RTDB (CORRIGIDO PARA O TCC)
  function getFirebaseReferences() {
    try {
      // Onde o ESP escreve o nível e status da bomba
      sensorRef = database.ref('dados_sensores/reservatorio_principal');
      
      // Onde salvamos os limites (min/max)
      paramsRef = database.ref('parametros/reservatorio_principal');
      
      // Onde enviamos comandos (reiniciar, pausar)
      controlRef = database.ref('controle_sistema');
      
      // Histórico e Eventos (Logs)
      historyRef = database.ref('historico');
      eventsRef = database.ref('eventos');
      
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

      if (toggleCollectionButton) { 
          toggleCollectionButton.disabled = true; 
          toggleCollectionButton.textContent = 'Aguardando...'; 
      }
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
      alert('Limites inválidos (Min deve ser menor que Max).'); return;
    }
    
    // TCC: parametros/reservatorio_principal -> limite_minimo, limite_maximo
    paramsRef?.update({ limite_minimo: low, limite_maximo: high })
      .then(() => {
        if (settingsFeedback) settingsFeedback.textContent = 'Salvo com sucesso!';
        setTimeout(() => { if (settingsFeedback) settingsFeedback.textContent = ''; }, 2500);
      })
      .catch(err => alert('Erro ao salvar: ' + err.message));
  }

  function toggleCollectionHandler() {
    if (!toggleCollectionButton || !controlRef) return;
    toggleCollectionButton.disabled = true;
    
    // TCC: controle_sistema -> coleta_pausada
    controlRef.child('coleta_pausada').get()
      .then(snap => {
          const isPaused = snap.val() === true;
          controlRef.update({ coleta_pausada: !isPaused });
      })
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
    if (!eventsRef) return;
    if (confirm('Apagar TODO o log de eventos?')) {
      eventsRef.remove().then(() => alert('Log limpo!'))
        .catch(err => alert('Erro: ' + err.message));
    }
  }

  function restartEspHandler() {
    if (!controlRef) return;
    if (confirm('Reiniciar o hardware remoto (ESP8266)?')) {
      // TCC: controle_sistema -> comando_reiniciar
      controlRef.update({ comando_reiniciar: true })
        .then(() => alert('Comando de reinício enviado.'))
        .catch(err => alert('Erro: ' + err.message));
    }
  }

  // 6) Listeners RTDB
  function attachFirebaseListeners() {
    // Leitura dos Sensores (Nível e Status Bomba)
    sensorRef.on('value', snap => {
      const d = snap.val() || {};
      
      // TCC: nivel (não level)
      const levelMain = (d.nivel !== undefined) ? Number(d.nivel) : '--';
      
      // Lógica Reservatório: 100 - NivelCaixa
      let levelRes = '--';
      if (levelMain !== '--') {
          levelRes = 100 - levelMain;
      }

      // TCC: status_bomba
      const pumpStatus = d.status_bomba || '--';

      // Atualiza UI Tanques
      if (adminWaterMain) adminWaterMain.style.height = `${levelMain !== '--' ? levelMain : 0}%`;
      if (adminWaterRes)  adminWaterRes.style.height  = `${levelRes  !== '--' ? levelRes  : 0}%`;
      
      if (adminLevelPercentMain) adminLevelPercentMain.textContent = levelMain;
      if (adminLevelPercentRes)  adminLevelPercentRes.textContent  = levelRes;

      if (levelCard)     levelCard.textContent     = `${levelMain}%`;
      if (resLevelCard)  resLevelCard.textContent  = `${levelRes}%`;

      // Atualiza UI Bomba
      if (pumpStatusCard) {
        const st = String(pumpStatus).toUpperCase();
        pumpStatusCard.textContent = st;
        pumpStatusCard.style.color = (st.includes('LIGA')) ? '#2e7d32' : '#d32f2f';
      }

    }, err => console.error("sensorRef err:", err));

    // Leitura de Controle (Status Coleta e Pausa)
    controlRef.on('value', snap => {
      const c = snap.val() || {};
      // TCC: coleta_pausada
      const isPaused = c.coleta_pausada === true;

      if (collectionStatusCard) {
        collectionStatusCard.textContent = isPaused ? 'PAUSADA' : 'ATIVA';
        collectionStatusCard.style.color = isPaused ? '#d32f2f' : '#2e7d32';
      }
      if (toggleCollectionButton) {
        toggleCollectionButton.textContent = isPaused ? 'Retomar Coleta' : 'Pausar Coleta';
        toggleCollectionButton.className = `btn btn-action ${isPaused ? 'btn-green' : 'btn-red'}`;
        toggleCollectionButton.disabled = false;
      }
    }, err => console.error("controlRef err:", err));

    // Leitura de Parâmetros (Limites Atuais)
    paramsRef.on('value', snap => {
      const p = snap.val() || {};
      // TCC: limite_minimo, limite_maximo
      if (lowLimitInput)  lowLimitInput.value  = p.limite_minimo ?? 50;
      if (highLimitInput) highLimitInput.value = p.limite_maximo ?? 95;
    }, err => console.error("paramsRef err:", err));

    // Connection Status (Last Seen - Estimativa)
    // O TCC não especifica "lastSeen", então vamos assumir que o sistema está online se recebermos dados recentes
    // ou podemos manter a lógica antiga se o ESP estiver enviando timestamp
    /* NOTA: Se o seu ESP não envia "lastSeen", este bloco ficará sempre "OFFLINE".
       Para corrigir, você pode verificar o timestamp do último dado recebido no sensorRef.
    */
    
    // Logs (Eventos) - TCC: eventos
    eventsRef.limitToLast(50).on('value', snap => {
      if (!logEntriesList) return;
      logEntriesList.innerHTML = '';
      
      const data = snap.val();
      if (!data) {
        logEntriesList.innerHTML = '<li>Nenhum evento registrado.</li>';
        return;
      }
      
      // Converte objeto em array e inverte (mais recente primeiro)
      const arr = Object.values(data).reverse(); 
      
      arr.forEach(l => {
        // Tenta achar timestamp, ou usa hora atual se não tiver
        const ts = l.timestamp || Date.now(); 
        const dt = new Date(ts).toLocaleString('pt-BR');
        // TCC: mensagem ou evento
        const msg = l.mensagem || l.evento || JSON.stringify(l);
        
        const li = document.createElement('li');
        li.textContent = `[${dt}] ${msg}`;
        logEntriesList.appendChild(li);
      });
    }, err => {
      if (logEntriesList) logEntriesList.innerHTML = '<li>Erro ao ler logs.</li>';
      console.error("logsRef err:", err);
    });

    console.log("[OK] Listeners conectados.");
  }

  // 7) Boot com proteção
  if (initializeFirebase()) {
    auth.onAuthStateChanged(user => {
      if (!user) { window.location.href = 'login.html'; return; }
      
      // Verifica Role
      database.ref('usuarios/' + user.uid).get()
        .then(snap => {
          const role = snap.exists() ? snap.val().role : '';
          if (role === 'admin') {
            if (!listenersAttached) {
              if (getDomReferences() && getFirebaseReferences() && enableAdminControls()) {
                attachFirebaseListeners();
                listenersAttached = true;
              } else {
                alert("Falha ao iniciar painel.");
              }
            }
          } else {
            alert('Acesso negado (Requer Admin).');
            window.location.href = 'index.html';
          }
        })
        .catch(err => { 
            console.error("Auth err:", err); 
            window.location.href = 'login.html'; 
        });
    });
  }
});