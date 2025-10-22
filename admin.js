// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//   VERSÃO FINAL - Com Limpar Logs e Correção Exibição Logs
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Admin script starting (v9 - Log Fix)...");

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

    // --- Referências DOM ---
    let levelCard, resLevelCard, pumpStatusCard, collectionStatusCard, connectionStatusCard, lastSeenText,
        lowLimitInput, highLimitInput, settingsFeedback, toggleCollectionButton, restartEspButton,
        logEntriesList, adminWaterMain, adminWaterRes, adminLevelPercentMain, adminLevelPercentRes,
        saveSettingsButton, clearHistoryButton, logoutButton, clearLogsButton; // Adicionado clearLogsButton

    // --- Referências Firebase ---
    let sensorRef, controlRef, settingsRef, historyRef, logsRef, lastSeenRef;

    let listenersAttached = false; // Controla adição de listeners

    // --- Função para obter referências DOM ---
    function getDomReferences() {
        console.log("Attempting to get DOM references...");
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
            clearLogsButton = document.getElementById('clear-logs-button'); // Obtém referência do novo botão

            console.log("DOM references obtained.");
            // Verifica botões
            if (!saveSettingsButton || !toggleCollectionButton || !clearHistoryButton || !restartEspButton || !logoutButton || !clearLogsButton) { // Inclui novo botão
                 console.error("!!! One or more essential buttons not found in DOM !!!");
                 return false;
            }
            return true;
        } catch(e) {
             console.error("!!! Error getting DOM references:", e);
             return false;
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
             logsRef = database.ref('logs'); // Referência para logs já existe
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
            if (saveSettingsButton) { saveSettingsButton.disabled = false; saveSettingsButton.removeEventListener('click', saveSettingsHandler); saveSettingsButton.addEventListener('click', saveSettingsHandler); }
            if (toggleCollectionButton) { toggleCollectionButton.disabled = true; toggleCollectionButton.textContent = 'Aguard...'; toggleCollectionButton.removeEventListener('click', toggleCollectionHandler); toggleCollectionButton.addEventListener('click', toggleCollectionHandler); } // Começa desabilitado
            if (clearHistoryButton) { clearHistoryButton.disabled = false; clearHistoryButton.removeEventListener('click', clearHistoryHandler); clearHistoryButton.addEventListener('click', clearHistoryHandler); }
            if (restartEspButton) { restartEspButton.disabled = false; restartEspButton.removeEventListener('click', restartEspHandler); restartEspButton.addEventListener('click', restartEspHandler); }
            if (logoutButton) { logoutButton.disabled = false; logoutButton.removeEventListener('click', logoutHandler); logoutButton.addEventListener('click', logoutHandler); }
            if (clearLogsButton) { clearLogsButton.disabled = false; clearLogsButton.removeEventListener('click', clearLogsHandler); clearLogsButton.addEventListener('click', clearLogsHandler); } // Habilita e adiciona listener
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
         sensorRef.child('coletaAtiva').get().then(snap => sensorRef.update({ coletaAtiva: snap.val() === false })) // Alterna o valor
            .catch(error => alert('Erro ao alterar: ' + error.message))
            .finally(() => { /* O listener Firebase reabilitará o botão */ });
     }
     function clearHistoryHandler() {
         if (!historyRef) return;
         if (confirm('Apagar TODO o histórico?')) historyRef.remove().then(() => alert('Histórico limpo!')).catch(error => alert('Erro: ' + error.message));
     }
     function restartEspHandler() {
         if (!controlRef) return;
         if (confirm('Reiniciar o ESP?')) controlRef.update({ comandoRestart: true }).then(() => alert('Comando enviado.')).catch(error => alert('Erro: ' + error.message));
     }
    // NOVO Handler para Limpar Logs
    function clearLogsHandler() {
         console.log("--- Clear Logs Handler Called ---");
         if (!logsRef) { console.error("!!! logsRef is undefined in handler!"); return; }

         if (confirm('Tem certeza que deseja apagar TODO o log de eventos? Esta ação é irreversível.')) {
             console.log("Attempting Firebase remove for logs...");
             logsRef.remove()
                 .then(() => {
                     console.log("Firebase logs remove successful.");
                     alert('Log de eventos limpo com sucesso!');
                     // A UI será atualizada pelo listener 'logsRef.on'
                 })
                 .catch(error => {
                    console.error("!!! Firebase logs remove FAILED:", error);
                    alert('Erro ao limpar log de eventos: ' + error.message);
                 });
         } else {
             console.log("Clear logs cancelled by user.");
         }
     }


    // --- Função para Adicionar Listeners do Firebase ---
    function attachFirebaseListeners() {
        if (!sensorRef || !controlRef || !settingsRef || !logsRef || !lastSeenRef || !historyRef) {
             console.error("Missing Firebase refs for listeners.");
             return;
        }
        console.log("Attaching Firebase listeners...");

        // Sensor Data (Níveis, Coleta)
        sensorRef.on('value', snapshot => {
            let levelMain = '--', levelRes = '--', isCollectionActive = false, collectionText = '??', collectionColor = '#6c757d';
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
            } else { if (toggleCollectionButton) { toggleCollectionButton.textContent = 'Aguard...'; toggleCollectionButton.className = 'btn-action'; toggleCollectionButton.disabled = true; } }
            if (levelCard) levelCard.textContent = `${levelMain}%`;
            if (resLevelCard) resLevelCard.textContent = `${levelRes}%`;
            if (collectionStatusCard) { collectionStatusCard.textContent = collectionText; collectionStatusCard.style.color = collectionColor; }
        }, error => console.error("Erro sensorRef:", error));

        // Controle da Bomba (Status)
        controlRef.on('value', snapshot => { /* ... (inalterado) ... */ }, error => console.error("Erro controlRef:", error));
        // Configurações (Limites)
        settingsRef.on('value', snapshot => { /* ... (inalterado) ... */ }, error => console.error("Erro settingsRef:", error));
        // Last Seen (Status Conexão)
        lastSeenRef.on('value', snapshot => { /* ... (inalterado) ... */ }, error => console.error("Erro lastSeenRef:", error));
        // History (Apenas para garantir que não dá erro se for acedido)
        historyRef.on('value', snapshot => { /* Não faz nada com history no admin */}, error => console.error("Erro historyRef:", error));

        // Logs (Listener CORRIGIDO/REVISADO)
         logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
              console.log("Logs received:", snapshot.exists() ? snapshot.numChildren() : 0, "entries");
              if (!logEntriesList) { console.error("logEntriesList element not found when trying to display logs."); return; }
              logEntriesList.innerHTML = ''; // Limpa a lista existente

              if (snapshot.exists()) {
                  const logs = [];
                  snapshot.forEach(childSnapshot => {
                      const logData = childSnapshot.val();
                      // Validação mais robusta dos dados do log
                      if(logData && typeof logData === 'object' && typeof logData.timestamp === 'number' && typeof logData.message === 'string') {
                         logs.push(logData);
                      } else { console.warn("Invalid log entry skipped:", childSnapshot.key, logData); }
                  });

                  // Ordena por timestamp descendente (mais recente primeiro)
                  logs.sort((a, b) => b.timestamp - a.timestamp);

                  // Cria e adiciona os elementos LI à lista UL
                  if (logs.length > 0) {
                      logs.forEach(log => {
                          const date = new Date(log.timestamp);
                          const formattedTime = date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium'});
                          const listItem = document.createElement('li');
                          listItem.textContent = `[${formattedTime}] ${log.message}`;
                          logEntriesList.appendChild(listItem); // Adiciona o item à lista
                      });
                      console.log(`Displayed ${logs.length} valid log entries.`);
                  } else {
                       logEntriesList.innerHTML = '<li>Nenhum log válido encontrado.</li>';
                  }
              } else {
                  console.log("No log entries found in snapshot.");
                  logEntriesList.innerHTML = '<li>Nenhum log registrado ainda.</li>';
              }
         }, error => {
              console.error("Error fetching logs:", error);
              if (logEntriesList) logEntriesList.innerHTML = '<li>Erro ao carregar logs.</li>';
         });

         console.log("Firebase listeners attached.");
    }

     // --- Verificação de Admin ---
     if (initializeFirebase()) {
         auth.onAuthStateChanged(user => {
            if (user) {
                database.ref('usuarios/' + user.uid).get().then(snapshot => {
                    if (snapshot.exists() && snapshot.val().role === 'admin') {
                        if (!listenersAttached) {
                            getDomReferences();
                            if(getFirebaseReferences()) {
                                if (enableAdminControls()) {
                                    attachFirebaseListeners();
                                    listenersAttached = true;
                                } else { alert("Falha ao habilitar controlos."); }
                            } else { alert("Falha ao obter referências do Firebase."); }
                        }
                    } else { alert('Acesso negado.'); try { window.location.href = 'index.html'; } catch(e) { window.location.href = 'login.html'; } }
                }).catch(error => { console.error("Erro permissão:", error); window.location.href = 'login.html'; });
            } else { window.location.href = 'login.html'; }
        });
     }

}); // Fim do DOMContentLoaded
