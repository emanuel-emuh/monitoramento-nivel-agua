// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//   VERSÃO CORRIGIDA FINAL - Ordem de execução corrigida
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Admin script starting (v10 - Scope Fix)..."); // Nova versão para log

    // --- Variáveis Globais (Acessíveis dentro do DOMContentLoaded) ---
    let auth, database;
    let sensorRef, controlRef, settingsRef, historyRef, logsRef, lastSeenRef;
    let listenersAttached = false;

    // Referências DOM (serão preenchidas depois)
    let levelCard, resLevelCard, pumpStatusCard, collectionStatusCard, connectionStatusCard, lastSeenText,
        lowLimitInput, highLimitInput, settingsFeedback, toggleCollectionButton, restartEspButton,
        logEntriesList, adminWaterMain, adminWaterRes, adminLevelPercentMain, adminLevelPercentRes,
        saveSettingsButton, clearHistoryButton, logoutButton, clearLogsButton;

    // --- FUNÇÕES (Definidas aqui dentro) ---

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
            if (!saveSettingsButton || !toggleCollectionButton || !clearHistoryButton || !restartEspButton || !logoutButton || !clearLogsButton) {
                 console.error("!!! One or more essential buttons not found in DOM !!!");
                 return false;
            }
            if (!logEntriesList) { console.error("!!! Log entries UL element not found !!!"); return false;}
            return true; // Sucesso
        } catch(e) {
             console.error("!!! Error getting DOM references:", e);
             return false; // Falha
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
            if (saveSettingsButton) { saveSettingsButton.disabled = false; saveSettingsButton.removeEventListener('click', saveSettingsHandler); saveSettingsButton.addEventListener('click', saveSettingsHandler); }
            if (toggleCollectionButton) { toggleCollectionButton.disabled = true; toggleCollectionButton.textContent = 'Aguard...'; toggleCollectionButton.removeEventListener('click', toggleCollectionHandler); toggleCollectionButton.addEventListener('click', toggleCollectionHandler); }
            if (clearHistoryButton) { clearHistoryButton.disabled = false; clearHistoryButton.removeEventListener('click', clearHistoryHandler); clearHistoryButton.addEventListener('click', clearHistoryHandler); }
            if (restartEspButton) { restartEspButton.disabled = false; restartEspButton.removeEventListener('click', restartEspHandler); restartEspButton.addEventListener('click', restartEspHandler); }
            if (logoutButton) { logoutButton.disabled = false; logoutButton.removeEventListener('click', logoutHandler); logoutButton.addEventListener('click', logoutHandler); }
            if (clearLogsButton) { clearLogsButton.disabled = false; clearLogsButton.removeEventListener('click', clearLogsHandler); clearLogsButton.addEventListener('click', clearLogsHandler); }
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
            .catch(error => alert('Erro ao alterar: ' + error.message))
            .finally(() => { /* Listener reabilita */ });
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
        if (!sensorRef || !controlRef || !settingsRef || !logsRef || !lastSeenRef || !historyRef) { console.error("Missing Firebase refs for listeners."); return; }
        console.log("Attaching Firebase listeners...");

        sensorRef.on('value', snapshot => { /* ... (inalterado - código para atualizar UI) ... */ }, error => console.error("Erro sensorRef:", error));
        controlRef.on('value', snapshot => { /* ... (inalterado - código para atualizar UI) ... */ }, error => console.error("Erro controlRef:", error));
        settingsRef.on('value', snapshot => { /* ... (inalterado - código para atualizar UI) ... */ }, error => console.error("Erro settingsRef:", error));
        lastSeenRef.on('value', snapshot => { /* ... (inalterado - código para atualizar UI) ... */ }, error => console.error("Erro lastSeenRef:", error));
        logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => { /* ... (inalterado - código para atualizar UI logs) ... */ }, error => { if (logEntriesList) logEntriesList.innerHTML = '<li>Erro logs.</li>'; console.error("Erro logsRef:", error); });
        historyRef.on('value', snapshot => { /* Dummy */ }, error => console.error("Erro historyRef:", error));

        console.log("Firebase listeners attached.");
    }

     // --- PONTO DE ENTRADA PRINCIPAL --- (Agora DENTRO do DOMContentLoaded)
     if (initializeFirebase()) { // Chama a inicialização PRIMEIRO
         console.log("Setting up Auth State Change listener...");
         // Configura o listener de autenticação DEPOIS da inicialização
         auth.onAuthStateChanged(user => {
            console.log("Auth state changed. User:", user ? user.uid : 'null');
            if (user) {
                database.ref('usuarios/' + user.uid).get().then(snapshot => {
                    if (snapshot.exists() && snapshot.val().role === 'admin') {
                        console.log("Admin role verified.");
                        if (!listenersAttached) {
                            if (getDomReferences() && getFirebaseReferences()) { // Tenta obter refs
                                if (enableAdminControls()) { // Tenta habilitar controles
                                    attachFirebaseListeners(); // Tenta adicionar listeners Firebase
                                    listenersAttached = true;
                                } else { console.error("Failed to enable admin controls."); alert("Falha ao habilitar controlos."); }
                            } else { console.error("Failed to get DOM or Firebase references."); alert("Falha ao obter referências DOM ou Firebase."); }
                        } else { console.log("Listeners already attached."); }
                    } else {
                        console.warn("User is not admin. Redirecting...");
                        alert('Acesso negado.');
                        try { window.location.href = 'index.html'; } catch(e) { window.location.href = 'login.html'; }
                    }
                }).catch(error => { console.error("Erro permissão:", error); window.location.href = 'login.html'; });
            } else {
                console.log("No user logged in, redirecting to login.");
                window.location.href = 'login.html';
            }
        });
        console.log("Auth state listener is set. Waiting for auth state...");
     } else {
        console.error("Execution stopped due to Firebase initialization failure.");
     }

}); // Fim do DOMContentLoaded
console.log("Admin script (v10) loaded.");
