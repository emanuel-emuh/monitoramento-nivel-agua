// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//   VERSÃO FINAL CORRIGIDA (v10.1) - Reconfirmada sem updateUI
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Admin script starting (v10.1)..."); // Versão incrementada

    // --- Variáveis Globais ---
    let auth, database;
    let sensorRef, controlRef, settingsRef, historyRef, logsRef, lastSeenRef;
    let listenersAttached = false;

    // Referências DOM
    let levelCard, resLevelCard, pumpStatusCard, collectionStatusCard, connectionStatusCard, lastSeenText,
        lowLimitInput, highLimitInput, settingsFeedback, toggleCollectionButton, restartEspButton,
        logEntriesList, adminWaterMain, adminWaterRes, adminLevelPercentMain, adminLevelPercentRes,
        saveSettingsButton, clearHistoryButton, logoutButton, clearLogsButton;

    // --- FUNÇÕES ---

    function initializeFirebase() {
        console.log("Initializing Firebase...");
        const firebaseConfig = {
            apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
            authDomain: "aqua-monitor-login.firebaseapp.com",
            projectId: "aqua-monitor-login",
            databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
        };
        try {
            if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); } else { firebase.app(); }
            auth = firebase.auth();
            database = firebase.database();
            console.log("Firebase initialized and objects obtained.");
            return true; // Sucesso
        } catch (e) {
            console.error("!!! Firebase initialization FAILED:", e);
            alert("Erro crítico ao inicializar a conexão.");
            return false; // Falha
        }
    }

    function getDomReferences() {
        console.log("Getting DOM references...");
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
            logoutButton = document.querySelector('.logout-button');
            clearLogsButton = document.getElementById('clear-logs-button');

            console.log("DOM references obtained.");
            // Verifica apenas os botões, pois a ausência de outros elementos não deve parar o script
            if (!saveSettingsButton || !toggleCollectionButton || !clearHistoryButton || !restartEspButton || !logoutButton || !clearLogsButton) {
                 console.warn("!!! One or more essential buttons might be missing in DOM !!!");
                 // Não retorna false aqui para permitir que o script continue
            }
             if (!logEntriesList) { console.warn("!!! Log entries UL element not found !!!"); }
            return true; // Assume sucesso parcial mesmo se alguns não forem encontrados
        } catch(e) {
             console.error("!!! Error getting DOM references:", e);
             return false; // Falha grave
        }
    }

     function getFirebaseReferences() {
         console.log("Getting Firebase references...");
         try {
             if (!database) throw new Error("Database object is not available");
             sensorRef = database.ref('sensorData');
             controlRef = database.ref('bomba/controle');
             settingsRef = database.ref('configuracoes/sistema');
             historyRef = database.ref('historico');
             logsRef = database.ref('logs');
             lastSeenRef = database.ref('sensorData/lastSeen');
             console.log("Firebase references obtained successfully.");
             return true;
         } catch(e) {
             console.error("!!! CRITICAL Error getting Firebase references:", e);
             alert("Erro crítico ao obter referências do Firebase.");
             return false;
         }
     }

    function enableAdminControls() {
        console.log("Enabling admin controls and attaching listeners...");
        try {
            // Usa optional chaining (?.) para segurança ao acessar 'disabled' e adicionar listeners
            saveSettingsButton?.addEventListener('click', saveSettingsHandler);
            if (saveSettingsButton) saveSettingsButton.disabled = false;

            toggleCollectionButton?.addEventListener('click', toggleCollectionHandler);
             if (toggleCollectionButton) { toggleCollectionButton.disabled = true; toggleCollectionButton.textContent = 'Aguard...'; } // Começa desabilitado

            clearHistoryButton?.addEventListener('click', clearHistoryHandler);
             if (clearHistoryButton) clearHistoryButton.disabled = false;

            restartEspButton?.addEventListener('click', restartEspHandler);
             if (restartEspButton) restartEspButton.disabled = false;

            logoutButton?.addEventListener('click', logoutHandler);
            if (logoutButton) logoutButton.disabled = false;

            clearLogsButton?.addEventListener('click', clearLogsHandler);
             if (clearLogsButton) clearLogsButton.disabled = false;

            console.log("Admin controls enabled state set and listeners attached (if elements found).");
            return true;
        } catch(e) {
             console.error("!!! Error enabling controls or attaching listeners:", e);
             return false;
        }
    }

    // --- Handlers dos Botões ---
    function logoutHandler(e) { e?.preventDefault(); auth?.signOut().then(() => { window.location.href = 'login.html'; }).catch(err => console.error("Logout err:", err)); }
    function saveSettingsHandler() {
         const low = parseInt(lowLimitInput?.value); const high = parseInt(highLimitInput?.value);
         if (isNaN(low) || isNaN(high) || low < 0 || high > 100 || low >= high) { alert('Limites inválidos.'); return; }
         settingsRef?.update({ limiteInferior: low, limiteSuperior: high })
             .then(() => { if(settingsFeedback) settingsFeedback.textContent = 'Salvo!'; setTimeout(() => { if(settingsFeedback) settingsFeedback.textContent = ''; }, 3000); })
             .catch(error => alert('Erro ao salvar: ' + error.message));
     }
     function toggleCollectionHandler() {
         if (!toggleCollectionButton || !sensorRef) return;
         toggleCollectionButton.disabled = true;
         sensorRef.child('coletaAtiva').get().then(snap => sensorRef.update({ coletaAtiva: snap.val() === false }))
            .catch(error => { alert('Erro ao alterar: ' + error.message); if (listenersAttached && toggleCollectionButton) toggleCollectionButton.disabled = false; })
     }
     function clearHistoryHandler() {
         if (!historyRef) return;
         if (confirm('Apagar TODO o histórico?')) historyRef.remove().then(() => alert('Histórico limpo!')).catch(error => alert('Erro: ' + error.message));
     }
     function restartEspHandler() {
         if (!controlRef) return;
         if (confirm('Reiniciar o ESP?')) controlRef.update({ comandoRestart: true }).then(() => alert('Comando enviado.')).catch(error => alert('Erro: ' + error.message));
     }
     function clearLogsHandler() {
         if (!logsRef) return;
         if (confirm('Apagar TODO o log de eventos?')) logsRef.remove().then(() => alert('Log limpo!')).catch(error => alert('Erro: ' + error.message));
     }

    // --- Função para Adicionar Listeners do Firebase ---
    function attachFirebaseListeners() {
        if (!sensorRef || !controlRef || !settingsRef || !logsRef || !lastSeenRef) { console.error("Missing Firebase refs for listeners."); return; }
        console.log("Attaching Firebase listeners...");

        // Sensor Data
        sensorRef.on('value', snapshot => {
            console.log("Sensor data received:", snapshot.val()); // Log para ver o que chega
            let levelMain = '--', levelRes = '--', isCollectionActive = false, collectionText = '??', collectionColor = '#6c757d';
            try { // Adiciona try...catch em volta da atualização da UI
                if(snapshot.exists()) {
                    const d = snapshot.val();
                    levelMain = d.level ?? '--'; levelRes = d.levelReservatorio ?? '--'; isCollectionActive = d.coletaAtiva !== false;
                    collectionText = isCollectionActive ? 'ATIVA' : 'PAUSADA'; collectionColor = isCollectionActive ? '#28a745' : '#dc3545';
                    if (toggleCollectionButton && listenersAttached) {
                        toggleCollectionButton.textContent = isCollectionActive ? 'Pausar Coleta' : 'Retomar Coleta';
                        toggleCollectionButton.className = 'btn-action ' + (isCollectionActive ? 'btn-red' : 'btn-green');
                        toggleCollectionButton.disabled = false; // Habilita aqui
                    }
                    if (adminWaterMain) adminWaterMain.style.height = `${levelMain !== '--' ? levelMain : 0}%`;
                    if (adminWaterRes) adminWaterRes.style.height = `${levelRes !== '--' ? levelRes : 0}%`;
                    if (adminLevelPercentMain) adminLevelPercentMain.textContent = levelMain;
                    if (adminLevelPercentRes) adminLevelPercentRes.textContent = levelRes;
                } else {
                    if (toggleCollectionButton) { toggleCollectionButton.textContent = 'Aguard...'; toggleCollectionButton.className = 'btn-action'; toggleCollectionButton.disabled = true; }
                    if (adminWaterMain) adminWaterMain.style.height = `0%`; if (adminWaterRes) adminWaterRes.style.height = `0%`;
                    if (adminLevelPercentMain) adminLevelPercentMain.textContent = '--'; if (adminLevelPercentRes) adminLevelPercentRes.textContent = '--';
                }
                if (levelCard) levelCard.textContent = `${levelMain}%`;
                if (resLevelCard) resLevelCard.textContent = `${levelRes}%`;
                if (collectionStatusCard) { collectionStatusCard.textContent = collectionText; collectionStatusCard.style.color = collectionColor; }
            } catch (uiError) { console.error("!!! Error updating UI in sensorRef listener:", uiError); } // Captura erros na UI
        }, error => console.error("Erro sensorRef:", error));

        // Control Ref
        controlRef.on('value', snapshot => {
            let pumpStatus = '--', pumpColor = '#6c757d';
            try {
                if (snapshot.exists()) { const d = snapshot.val(); pumpStatus = d.statusBomba || '--'; pumpColor = d.statusBomba === 'LIGADA' ? '#28a745' : '#dc3545'; }
                if (pumpStatusCard) { pumpStatusCard.textContent = pumpStatus; pumpStatusCard.style.color = pumpColor; }
            } catch (uiError) { console.error("!!! Error updating UI in controlRef listener:", uiError); }
        }, error => console.error("Erro controlRef:", error));

        // Settings Ref
        settingsRef.on('value', snapshot => {
            try {
                if (snapshot.exists()) { const s = snapshot.val(); if (lowLimitInput) lowLimitInput.value = s.limiteInferior || 50; if (highLimitInput) highLimitInput.value = s.limiteSuperior || 95; }
                else { if (lowLimitInput) lowLimitInput.value = 50; if (highLimitInput) highLimitInput.value = 95; }
            } catch (uiError) { console.error("!!! Error updating UI in settingsRef listener:", uiError); }
        }, error => console.error("Erro settingsRef:", error));

        // Last Seen Ref
        lastSeenRef.on('value', snapshot => {
             if (!connectionStatusCard || !lastSeenText) return;
             try {
                 if (snapshot.exists()) {
                     const ts = snapshot.val();
                     if (typeof ts === 'number' && ts > 0) {
                         const now = Date.now(), diffM = (now - ts) / 6e4, dt = new Date(ts), fmtDate = dt.toLocaleString('pt-BR');
                         connectionStatusCard.textContent = diffM > 5 ? 'OFFLINE' : 'ONLINE';
                         connectionStatusCard.style.color = diffM > 5 ? '#dc3545' : '#28a745';
                         lastSeenText.textContent = `Visto: ${fmtDate}`;
                     } else { connectionStatusCard.textContent = '??'; connectionStatusCard.style.color = '#6c757d'; lastSeenText.textContent = 'Inválido.'; }
                 } else { connectionStatusCard.textContent = '??'; connectionStatusCard.style.color = '#6c757d'; lastSeenText.textContent = 'Nenhum sinal.'; }
             } catch (uiError) { console.error("!!! Error updating UI in lastSeenRef listener:", uiError); }
         }, error => {
             console.error("Erro lastSeenRef:", error);
             if(connectionStatusCard) connectionStatusCard.textContent = 'Erro'; if(lastSeenText) lastSeenText.textContent = 'Falha.';
         });

         // Logs Ref
         logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
              if (!logEntriesList) return;
              logEntriesList.innerHTML = '';
              try {
                  if (snapshot.exists()) {
                      const logs = []; snapshot.forEach(cs => { const d = cs.val(); if(d && typeof d==='object' && typeof d.timestamp==='number' && typeof d.message==='string') logs.push(d); });
                      logs.sort((a, b) => b.timestamp - a.timestamp);
                      if (logs.length > 0) {
                          logs.forEach(log => {
                              const dt = new Date(log.timestamp), fmtTime = dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium'});
                              const li = document.createElement('li'); li.textContent = `[${fmtTime}] ${log.message}`;
                              logEntriesList.appendChild(li);
                          });
                      } else { logEntriesList.innerHTML = '<li>Nenhum log válido.</li>'; }
                  } else { logEntriesList.innerHTML = '<li>Nenhum log registrado.</li>'; }
              } catch (uiError) { console.error("!!! Error updating UI in logsRef listener:", uiError); }
         }, error => { if (logEntriesList) logEntriesList.innerHTML = '<li>Erro logs.</li>'; console.error("Erro logsRef:", error); });

         // History Ref (Dummy)
         historyRef.on('value', snapshot => {}, error => console.error("Erro historyRef:", error));

        console.log("Firebase listeners attached.");
    }

     // --- PONTO DE ENTRADA ---
     if (initializeFirebase()) {
         auth.onAuthStateChanged(user => {
            if (user) {
                database.ref('usuarios/' + user.uid).get().then(snapshot => {
                    if (snapshot.exists() && snapshot.val().role === 'admin') {
                        if (!listenersAttached) {
                            if (getDomReferences() && getFirebaseReferences()) {
                                if (enableAdminControls()) {
                                    attachFirebaseListeners();
                                    listenersAttached = true;
                                } else { alert("Falha ao habilitar controlos."); }
                            } else { alert("Falha ao obter referências DOM ou Firebase."); }
                        }
                    } else { alert('Acesso negado.'); try { window.location.href = 'index.html'; } catch(e) { window.location.href = 'login.html'; } }
                }).catch(error => { console.error("Erro permissão:", error); window.location.href = 'login.html'; });
            } else { window.location.href = 'login.html'; }
        });
     } else { console.error("Execution stopped: Firebase init failed."); }

}); // Fim do DOMContentLoaded
