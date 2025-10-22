// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//   VERSÃO FINAL CORRIGIDA - Ordem de execução
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Admin script starting (v10 - Scope Fix)...");

    // --- Variáveis Globais (Acessíveis dentro do DOMContentLoaded) ---
    let auth, database;
    let sensorRef, controlRef, settingsRef, historyRef, logsRef, lastSeenRef;
    let listenersAttached = false;

    // Referências DOM
    let levelCard, resLevelCard, pumpStatusCard, collectionStatusCard, connectionStatusCard, lastSeenText,
        lowLimitInput, highLimitInput, settingsFeedback, toggleCollectionButton, restartEspButton,
        logEntriesList, adminWaterMain, adminWaterRes, adminLevelPercentMain, adminLevelPercentRes,
        saveSettingsButton, clearHistoryButton, logoutButton, clearLogsButton;

    // --- FUNÇÕES (Definidas dentro do DOMContentLoaded) ---

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
            return true; // Indica sucesso
        } catch (e) {
            console.error("!!! Firebase initialization FAILED:", e);
            alert("Erro crítico ao inicializar a conexão.");
            return false; // Indica falha
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
            // Verifica se botões essenciais foram encontrados
            if (!saveSettingsButton || !toggleCollectionButton || !clearHistoryButton || !restartEspButton || !logoutButton || !clearLogsButton) {
                 console.error("!!! One or more essential buttons not found in DOM !!!");
                 return false;
            }
            return true;
        } catch(e) {
             console.error("!!! Error getting DOM references:", e);
             return false;
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
    function logoutHandler(e) { /* ... (inalterado) ... */ }
    function saveSettingsHandler() { /* ... (inalterado) ... */ }
    function toggleCollectionHandler() { /* ... (inalterado) ... */ }
    function clearHistoryHandler() { /* ... (inalterado) ... */ }
    function restartEspHandler() { /* ... (inalterado) ... */ }
    function clearLogsHandler() { /* ... (inalterado) ... */ }

    // --- Função para Adicionar Listeners do Firebase ---
    function attachFirebaseListeners() {
        if (!sensorRef || !controlRef || !settingsRef || !logsRef || !lastSeenRef || !historyRef) { console.error("Missing Firebase refs for listeners."); return; }
        console.log("Attaching Firebase listeners...");

        sensorRef.on('value', snapshot => { /* ... (inalterado - código para atualizar UI) ... */ }, error => console.error("Erro sensorRef:", error));
        controlRef.on('value', snapshot => { /* ... (inalterado - código para atualizar UI) ... */ }, error => console.error("Erro controlRef:", error));
        settingsRef.on('value', snapshot => { /* ... (inalterado - código para atualizar UI) ... */ }, error => console.error("Erro settingsRef:", error));
        lastSeenRef.on('value', snapshot => { /* ... (inalterado - código para atualizar UI) ... */ }, error => console.error("Erro lastSeenRef:", error));
        logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => { /* ... (inalterado - código para atualizar UI logs) ... */ }, error => { if (logEntriesList) logEntriesList.innerHTML = '<li>Erro logs.</li>'; console.error("Erro logsRef:", error); });
        historyRef.on('value', snapshot => { /* Dummy listener só para garantir que ref está ok */}, error => console.error("Erro historyRef:", error));

        console.log("Firebase listeners attached.");
    }

     // --- PONTO DE ENTRADA PRINCIPAL --- (Agora DENTRO do DOMContentLoaded)
     if (initializeFirebase()) { // Só continua se Firebase inicializar
         console.log("Setting up Auth State Change listener...");
         auth.onAuthStateChanged(user => { // Listener de autenticação
            console.log("Auth state changed. User:", user ? user.uid : 'null');
            if (user) { // Se houver um utilizador logado
                // Verifica se é admin no Realtime Database
                database.ref('usuarios/' + user.uid).get().then(snapshot => {
                    if (snapshot.exists() && snapshot.val().role === 'admin') {
                        console.log("Admin role verified.");
                        // Executa as funções APENAS se for admin e se ainda não foram executadas
                        if (!listenersAttached) {
                            if (getDomReferences() && getFirebaseReferences()) { // Obtém referências
                                if (enableAdminControls()) { // Habilita botões e listeners de clique
                                    attachFirebaseListeners(); // Adiciona listeners Firebase
                                    listenersAttached = true; // Marca como concluído
                                } else { alert("Falha ao habilitar controlos."); }
                            } else { alert("Falha ao obter referências DOM ou Firebase."); }
                        } else { console.log("Listeners already attached."); }
                    } else { // Se não for admin
                        console.warn("User is not admin or role data missing. Redirecting...");
                        alert('Acesso negado.');
                        try { window.location.href = 'index.html'; } catch(e) { window.location.href = 'login.html'; }
                    }
                }).catch(error => { // Se houver erro a verificar permissão
                    console.error("Erro ao verificar permissão:", error);
                    window.location.href = 'login.html';
                });
            } else { // Se não houver utilizador logado
                console.log("No user logged in, redirecting to login.");
                window.location.href = 'login.html';
            }
        });
        console.log("Auth state listener is set. Waiting for auth state...");
     } else {
        console.error("Execution stopped due to Firebase initialization failure.");
     }

}); // Fim do DOMContentLoaded
console.log("Admin script loaded.");
