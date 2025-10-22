// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//   VERSÃO FINAL REVISADA - Foco em Atualização Segura da UI
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Admin script starting (v11 - UI Update Focus)...");

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
        console.log("Firebase initialized and objects created.");
    } catch (e) {
        console.error("!!! Firebase initialization FAILED:", e);
        alert("Erro crítico ao inicializar a conexão.");
        return;
    }

    // --- Referências DOM --- (Declaradas aqui, preenchidas depois)
    let levelCard, resLevelCard, pumpStatusCard, collectionStatusCard, connectionStatusCard, lastSeenText,
        lowLimitInput, highLimitInput, settingsFeedback, toggleCollectionButton, restartEspButton,
        logEntriesList, adminWaterMain, adminWaterRes, adminLevelPercentMain, adminLevelPercentRes,
        saveSettingsButton, clearHistoryButton, logoutButton, clearLogsButton;

    // --- Referências Firebase --- (Declaradas aqui, preenchidas depois)
    let sensorRef, controlRef, settingsRef, historyRef, logsRef, lastSeenRef;

    let listenersAttached = false; // Controla adição de listeners

    // --- Função para obter referências DOM ---
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
            // Verifica se botões essenciais foram encontrados
            if (!saveSettingsButton || !toggleCollectionButton || !clearHistoryButton || !restartEspButton || !logoutButton || !clearLogsButton) {
                 console.error("!!! One or more essential buttons not found in DOM !!!");
                 return false; // Indica falha
            }
             if (!logEntriesList) { // Verifica se UL dos logs existe
                console.error("!!! Log entries UL element ('log-entries') not found !!!");
                // return false; // Não crítico para habilitar botões
            }
            return true; // Indica sucesso
        } catch(e) {
             console.error("!!! Error getting DOM references:", e);
             return false; // Indica falha
        }
    }

     // --- Função para obter referências Firebase ---
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

    // --- Função para Habilitar Controles e Adicionar Listeners de Clique ---
    function enableAdminControls() {
        console.log("Enabling admin controls and attaching listeners...");
        try {
            // Habilita botões se as referências DOM foram obtidas com sucesso
            if (saveSettingsButton) saveSettingsButton.disabled = false;
            if (toggleCollectionButton) toggleCollectionButton.disabled = true; // Começa desabilitado
            if (clearHistoryButton) clearHistoryButton.disabled = false;
            if (restartEspButton) restartEspButton.disabled = false;
            if (logoutButton) logoutButton.disabled = false;
            if (clearLogsButton) clearLogsButton.disabled = false;

            // Adiciona listeners (com remoção prévia)
            if (logoutButton) { logoutButton.removeEventListener('click', logoutHandler); logoutButton.addEventListener('click', logoutHandler); }
            if (saveSettingsButton) { saveSettingsButton.removeEventListener('click', saveSettingsHandler); saveSettingsButton.addEventListener('click', saveSettingsHandler); }
            if (toggleCollectionButton) { toggleCollectionButton.removeEventListener('click', toggleCollectionHandler); toggleCollectionButton.addEventListener('click', toggleCollectionHandler); }
            if (clearHistoryButton) { clearHistoryButton.removeEventListener('click', clearHistoryHandler); clearHistoryButton.addEventListener('click', clearHistoryHandler); }
            if (restartEspButton) { restartEspButton.removeEventListener('click', restartEspHandler); restartEspButton.addEventListener('click', restartEspHandler); }
            if (clearLogsButton) { clearLogsButton.removeEventListener('click', clearLogsHandler); clearLogsButton.addEventListener('click', clearLogsHandler); }
            console.log("Admin controls enabled and listeners attached.");
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
            .catch(error => { alert('Erro ao alterar: ' + error.message); if (listenersAttached && toggleCollectionButton) toggleCollectionButton.disabled = false; }) // Reabilita se erro
            // O listener Firebase reabilitará em caso de sucesso
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

        // Sensor Data (Níveis, Coleta) - COM VERIFICAÇÃO DE ELEMENTOS
        sensorRef.on('value', snapshot => {
            console.log("Sensor data received:", snapshot.val());
            let levelMain = '--', levelRes = '--', isCollectionActive = false, collectionText = '??', collectionColor = '#6c757d';
            if(snapshot.exists()) {
                const d = snapshot.val();
                levelMain = d.level ?? '--'; levelRes = d.levelReservatorio ?? '--'; isCollectionActive = d.coletaAtiva !== false;
                collectionText = isCollectionActive ? 'ATIVA' : 'PAUSADA'; collectionColor = isCollectionActive ? '#28a745' : '#dc3545';

                // Atualiza botão APENAS se ele existe E listeners já foram anexados
                if (toggleCollectionButton && listenersAttached) {
                    toggleCollectionButton.textContent = isCollectionActive ? 'Pausar Coleta' : 'Retomar Coleta';
                    toggleCollectionButton.className = 'btn-action ' + (isCollectionActive ? 'btn-red' : 'btn-green');
                    toggleCollectionButton.disabled = false; // Habilita aqui
                    console.log("toggleCollectionButton state updated and enabled by listener.");
                }

                // Atualiza visualização (com verificações)
                if (adminWaterMain) adminWaterMain.style.height = `${levelMain !== '--' ? levelMain : 0}%`; else console.warn("adminWaterMain missing");
                if (adminWaterRes) adminWaterRes.style.height = `${levelRes !== '--' ? levelRes : 0}%`; else console.warn("adminWaterRes missing");
                if (adminLevelPercentMain) adminLevelPercentMain.textContent = levelMain; else console.warn("adminLevelPercentMain missing");
                if (adminLevelPercentRes) adminLevelPercentRes.textContent = levelRes; else console.warn("adminLevelPercentRes missing");

            } else {
                 console.warn("Sensor data node does not exist.");
                 if (toggleCollectionButton) { toggleCollectionButton.textContent = 'Aguard...'; toggleCollectionButton.className = 'btn-action'; toggleCollectionButton.disabled = true; }
                 if (adminWaterMain) adminWaterMain.style.height = `0%`; if (adminWaterRes) adminWaterRes.style.height = `0%`;
                 if (adminLevelPercentMain) adminLevelPercentMain.textContent = '--'; if (adminLevelPercentRes) adminLevelPercentRes.textContent = '--';
            }
            // Atualiza cards (com verificações)
            if (levelCard) levelCard.textContent = `${levelMain}%`; else console.warn("levelCard missing");
            if (resLevelCard) resLevelCard.textContent = `${levelRes}%`; else console.warn("resLevelCard missing");
            if (collectionStatusCard) { collectionStatusCard.textContent = collectionText; collectionStatusCard.style.color = collectionColor; } else console.warn("collectionStatusCard missing");

        }, error => {
             console.error("Error fetching sensor data:", error);
             if (toggleCollectionButton) toggleCollectionButton.disabled = true;
        });

        // Controle da Bomba (Status) - COM VERIFICAÇÃO
        controlRef.on('value', snapshot => {
            let pumpStatus = '--', pumpColor = '#6c757d';
            if (snapshot.exists()) { const d = snapshot.val(); pumpStatus = d.statusBomba || '--'; pumpColor = d.statusBomba === 'LIGADA' ? '#28a745' : '#dc3545'; }
            if (pumpStatusCard) { pumpStatusCard.textContent = pumpStatus; pumpStatusCard.style.color = pumpColor; }
            else { console.warn("pumpStatusCard missing"); }
        }, error => {
             console.error("Erro controlRef:", error);
             if (pumpStatusCard) pumpStatusCard.textContent = 'Erro';
        });

        // Configurações (Limites) - COM VERIFICAÇÃO
        settingsRef.on('value', snapshot => {
            if (snapshot.exists()) { const s = snapshot.val(); if (lowLimitInput) lowLimitInput.value = s.limiteInferior || 50; if (highLimitInput) highLimitInput.value = s.limiteSuperior || 95; }
            else { if (lowLimitInput) lowLimitInput.value = 50; if (highLimitInput) highLimitInput.value = 95; }
        }, error => console.error("Erro settingsRef:", error));

        // Last Seen (Status Conexão) - COM VERIFICAÇÃO
        lastSeenRef.on('value', snapshot => {
             if (!connectionStatusCard || !lastSeenText) { console.warn("Connection status elements missing"); return; }
             if (snapshot.exists()) {
                 const ts = snapshot.val();
                 if (typeof ts === 'number' && ts > 0) {
                     const now = Date.now(), diffM = (now - ts) / 6e4, dt = new Date(ts), fmtDate = dt.toLocaleString('pt-BR');
                     connectionStatusCard.textContent = diffM > 5 ? 'OFFLINE' : 'ONLINE';
                     connectionStatusCard.style.color = diffM > 5 ? '#dc3545' : '#28a745';
                     lastSeenText.textContent = `Visto: ${fmtDate}`;
                 } else { connectionStatusCard.textContent = '??'; connectionStatusCard.style.color = '#6c757d'; lastSeenText.textContent = 'Inválido.'; }
             } else { connectionStatusCard.textContent = '??'; connectionStatusCard.style.color = '#6c757d'; lastSeenText.textContent = 'Nenhum sinal.'; }
         }, error => {
             console.error("Erro lastSeenRef:", error);
             if(connectionStatusCard) connectionStatusCard.textContent = 'Erro'; if(lastSeenText) lastSeenText.textContent = 'Falha.';
         });

         // Logs - COM VERIFICAÇÃO
         logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
              if (!logEntriesList) { console.error("logEntriesList element not found."); return; }
              logEntriesList.innerHTML = '';
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
         }, error => { if (logEntriesList) logEntriesList.innerHTML = '<li>Erro logs.</li>'; console.error("Erro logsRef:", error); });

         console.log("Firebase listeners attached.");
    }

     // --- Verificação de Admin e Ponto de Entrada ---
     if (initializeFirebase()) {
         auth.onAuthStateChanged(user => {
            if (user) {
                database.ref('usuarios/' + user.uid).get().then(snapshot => {
                    if (snapshot.exists() && snapshot.val().role === 'admin') {
                        if (!listenersAttached) {
                            if (getDomReferences() && getFirebaseReferences()) { // Tenta obter refs PRIMEIRO
                                if (enableAdminControls()) { // Tenta habilitar/adicionar listeners DEPOIS
                                    attachFirebaseListeners(); // Só adiciona listeners FB se tudo correu bem
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
