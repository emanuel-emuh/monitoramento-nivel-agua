// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//   VERSÃO FINAL - Limpa e Funcional
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {

    // --- INICIALIZAÇÃO E AUTENTICAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
        authDomain: "aqua-monitor-login.firebaseapp.com",
        projectId: "aqua-monitor-login",
        databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
    };
    let auth, database;
    try {
        if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); } else { firebase.app(); }
        auth = firebase.auth();
        database = firebase.database();
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        alert("Erro crítico ao inicializar a conexão.");
        return;
    }

    // --- Referências DOM ---
    let levelCard, resLevelCard, pumpStatusCard, collectionStatusCard, connectionStatusCard, lastSeenText,
        lowLimitInput, highLimitInput, settingsFeedback, toggleCollectionButton, restartEspButton,
        logEntriesList, adminWaterMain, adminWaterRes, adminLevelPercentMain, adminLevelPercentRes,
        saveSettingsButton, clearHistoryButton, logoutButton;

    // --- Referências Firebase ---
    let sensorRef, controlRef, settingsRef, historyRef, logsRef, lastSeenRef;

    let listenersAttached = false; // Controla adição de listeners

    // --- Função para obter referências DOM ---
    function getDomReferences() {
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
        logoutButton = document.querySelector('.logout-button');
    }

     // --- Função para obter referências Firebase ---
     function getFirebaseReferences() {
         try {
             sensorRef = database.ref('sensorData');
             controlRef = database.ref('bomba/controle');
             settingsRef = database.ref('configuracoes/sistema');
             historyRef = database.ref('historico');
             logsRef = database.ref('logs');
             lastSeenRef = database.ref('sensorData/lastSeen');
             return true;
         } catch(e) {
             console.error("Error getting Firebase references:", e);
             return false;
         }
     }

    // --- Função para Habilitar Controles e Adicionar Listeners de Clique ---
    function enableAdminControls() {
        // Habilita botões se existirem
        if (saveSettingsButton) saveSettingsButton.disabled = false;
        if (toggleCollectionButton) toggleCollectionButton.disabled = false; // Será ajustado pelo listener
        if (clearHistoryButton) clearHistoryButton.disabled = false;
        if (restartEspButton) restartEspButton.disabled = false;
        if (logoutButton) logoutButton.disabled = false;

        // Adiciona listeners (com remoção prévia para segurança)
        if (logoutButton) { logoutButton.removeEventListener('click', logoutHandler); logoutButton.addEventListener('click', logoutHandler); }
        if (saveSettingsButton) { saveSettingsButton.removeEventListener('click', saveSettingsHandler); saveSettingsButton.addEventListener('click', saveSettingsHandler); }
        if (toggleCollectionButton) { toggleCollectionButton.removeEventListener('click', toggleCollectionHandler); toggleCollectionButton.addEventListener('click', toggleCollectionHandler); }
        if (clearHistoryButton) { clearHistoryButton.removeEventListener('click', clearHistoryHandler); clearHistoryButton.addEventListener('click', clearHistoryHandler); }
        if (restartEspButton) { restartEspButton.removeEventListener('click', restartEspHandler); restartEspButton.addEventListener('click', restartEspHandler); }
    }

    // --- Handlers dos Botões ---
    function logoutHandler(e) {
        e.preventDefault();
        auth.signOut().then(() => { window.location.href = 'login.html'; });
    }

    function saveSettingsHandler() {
         const newLow = parseInt(lowLimitInput?.value); // Usa optional chaining '?'
         const newHigh = parseInt(highLimitInput?.value);
         if (isNaN(newLow) || isNaN(newHigh) || newLow < 0 || newHigh > 100 || newLow >= newHigh) {
             alert('Valores inválidos para os limites.'); return;
         }
         settingsRef?.update({ limiteInferior: newLow, limiteSuperior: newHigh }) // Usa '?'
             .then(() => {
                 if(settingsFeedback) settingsFeedback.textContent = 'Configurações salvas!';
                 setTimeout(() => { if(settingsFeedback) settingsFeedback.textContent = ''; }, 3000);
             })
             .catch(error => alert('Erro ao salvar: ' + error.message));
     }

     function toggleCollectionHandler() {
         if (!toggleCollectionButton || !sensorRef) return;
         toggleCollectionButton.disabled = true;
         sensorRef.child('coletaAtiva').get().then(snapshot => {
             const isCurrentlyActive = snapshot.val() !== false;
             sensorRef.update({ coletaAtiva: !isCurrentlyActive })
                .catch(error => alert('Erro ao alterar coleta: ' + error.message))
                .finally(() => { if (listenersAttached && toggleCollectionButton) toggleCollectionButton.disabled = false; });
         }).catch(error => {
             alert('Erro ao ler status da coleta: ' + error.message);
             if (listenersAttached && toggleCollectionButton) toggleCollectionButton.disabled = false;
         });
     }

     function clearHistoryHandler() {
         if (!historyRef) return;
         if (confirm('Tem certeza que deseja apagar TODO o histórico?')) {
             historyRef.remove()
                 .then(() => alert('Histórico limpo!'))
                 .catch(error => alert('Erro ao limpar: ' + error.message));
         }
     }

     function restartEspHandler() {
         if (!controlRef) return;
         if (confirm('Tem certeza que deseja reiniciar o ESP?')) {
             controlRef.update({ comandoRestart: true })
                 .then(() => alert('Comando enviado.'))
                 .catch(error => alert('Erro ao enviar: ' + error.message));
         }
     }

    // --- Função para Adicionar Listeners do Firebase ---
    function attachFirebaseListeners() {
        if (!sensorRef || !controlRef || !settingsRef || !historyRef || !logsRef || !lastSeenRef) return;

        sensorRef.on('value', snapshot => {
            let levelMain = '--', levelRes = '--', isCollectionActive = false, collectionText = '??', collectionColor = '#6c757d';
            if(snapshot.exists()) {
                const d = snapshot.val();
                levelMain = d.level ?? '--';
                levelRes = d.levelReservatorio ?? '--';
                isCollectionActive = d.coletaAtiva !== false;
                collectionText = isCollectionActive ? 'ATIVA' : 'PAUSADA';
                collectionColor = isCollectionActive ? '#28a745' : '#dc3545';
                if (toggleCollectionButton && listenersAttached) {
                    toggleCollectionButton.textContent = isCollectionActive ? 'Pausar Coleta' : 'Retomar Coleta';
                    toggleCollectionButton.className = 'btn-action ' + (isCollectionActive ? 'btn-red' : 'btn-green');
                    toggleCollectionButton.disabled = false;
                }
                if (adminWaterMain) adminWaterMain.style.height = `${levelMain !== '--' ? levelMain : 0}%`;
                if (adminWaterRes) adminWaterRes.style.height = `${levelRes !== '--' ? levelRes : 0}%`;
                if (adminLevelPercentMain) adminLevelPercentMain.textContent = levelMain;
                if (adminLevelPercentRes) adminLevelPercentRes.textContent = levelRes;
            } else { if (toggleCollectionButton) { toggleCollectionButton.textContent = 'Aguard...'; toggleCollectionButton.className = 'btn-action'; toggleCollectionButton.disabled = true; } }
            if (levelCard) levelCard.textContent = `${levelMain}%`;
            if (resLevelCard) resLevelCard.textContent = `${levelRes}%`;
            if (collectionStatusCard) { collectionStatusCard.textContent = collectionText; collectionStatusCard.style.color = collectionColor; }
        }, error => console.error("Erro sensorRef:", error));

        controlRef.on('value', snapshot => {
            let pumpStatus = '--', pumpColor = '#6c757d';
            if (snapshot.exists()) { const d = snapshot.val(); pumpStatus = d.statusBomba || '--'; pumpColor = d.statusBomba === 'LIGADA' ? '#28a745' : '#dc3545'; }
            if (pumpStatusCard) { pumpStatusCard.textContent = pumpStatus; pumpStatusCard.style.color = pumpColor; }
        }, error => console.error("Erro controlRef:", error));

        settingsRef.on('value', snapshot => {
            if (snapshot.exists()) { const s = snapshot.val(); if (lowLimitInput) lowLimitInput.value = s.limiteInferior || 50; if (highLimitInput) highLimitInput.value = s.limiteSuperior || 95; }
            else { if (lowLimitInput) lowLimitInput.value = 50; if (highLimitInput) highLimitInput.value = 95; }
        }, error => console.error("Erro settingsRef:", error));

        lastSeenRef.on('value', snapshot => {
             if (!connectionStatusCard || !lastSeenText) return;
             if (snapshot.exists()) {
                 const ts = snapshot.val();
                 if (typeof ts === 'number' && ts > 0) {
                     const now = Date.now(), diffM = (now - ts) / 6e4, dt = new Date(ts);
                     const fmtDate = dt.toLocaleString('pt-BR');
                     connectionStatusCard.textContent = diffM > 5 ? 'OFFLINE' : 'ONLINE';
                     connectionStatusCard.style.color = diffM > 5 ? '#dc3545' : '#28a745';
                     lastSeenText.textContent = `Visto: ${fmtDate}`;
                 } else { connectionStatusCard.textContent = '??'; connectionStatusCard.style.color = '#6c757d'; lastSeenText.textContent = 'Timestamp inválido.'; }
             } else { connectionStatusCard.textContent = '??'; connectionStatusCard.style.color = '#6c757d'; lastSeenText.textContent = 'Nenhum sinal.'; }
         }, error => console.error("Erro lastSeenRef:", error));

         logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
              if (!logEntriesList) return;
              logEntriesList.innerHTML = '';
              if (snapshot.exists()) {
                  const logs = []; snapshot.forEach(cs => logs.push(cs.val()));
                  logs.reverse().forEach(log => {
                      const ts = (log && typeof log.timestamp === 'number') ? log.timestamp : Date.now();
                      const msg = (log && log.message) ? log.message : "Log inválido";
                      const dt = new Date(ts), fmtTime = dt.toLocaleString('pt-BR');
                      const li = document.createElement('li'); li.textContent = `[${fmtTime}] ${msg}`;
                      logEntriesList.appendChild(li);
                  });
              } else { logEntriesList.innerHTML = '<li>Nenhum log registrado.</li>'; }
         }, error => { if (logEntriesList) logEntriesList.innerHTML = '<li>Erro ao carregar logs.</li>'; console.error("Erro logsRef:", error); });
    }

     // --- Verificação de Admin ---
    auth.onAuthStateChanged(user => {
        if (user) {
            database.ref('usuarios/' + user.uid).get().then(snapshot => {
                if (!snapshot.exists() || snapshot.val().role !== 'admin') {
                    alert('Acesso negado.');
                    try { window.location.href = 'index.html'; } catch(e) { window.location.href = 'login.html'; }
                } else {
                    if (!listenersAttached) {
                        getDomReferences();
                        if(getFirebaseReferences()) {
                            enableAdminControls();
                            attachFirebaseListeners();
                            listenersAttached = true;
                        } else { alert("Falha ao obter referências do Firebase."); }
                    }
                }
            }).catch(error => { console.error("Erro permissão:", error); window.location.href = 'login.html'; });
        } else { window.location.href = 'login.html'; }
    });

}); // Fim do DOMContentLoaded
