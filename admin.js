// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//   VERSÃO CORRIGIDA - Foco em habilitar botões corretamente
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Admin script starting...");

    // --- INICIALIZAÇÃO E AUTENTICAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
        authDomain: "aqua-monitor-login.firebaseapp.com",
        projectId: "aqua-monitor-login",
        databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
    };
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        } else {
            firebase.app();
        }
        console.log("Firebase initialized or retrieved.");
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        alert("Erro crítico ao inicializar a conexão. Verifique a consola.");
        return;
    }
    const auth = firebase.auth();
    const database = firebase.database();

    // --- Referências DOM --- (Declaradas aqui, mas usadas após verificação)
    let levelCard, resLevelCard, pumpStatusCard, collectionStatusCard, connectionStatusCard, lastSeenText,
        lowLimitInput, highLimitInput, settingsFeedback, toggleCollectionButton, restartEspButton,
        logEntriesList, adminWaterMain, adminWaterRes, adminLevelPercentMain, adminLevelPercentRes,
        saveSettingsButton, clearHistoryButton, logoutButton;

    // --- Referências Firebase ---
    const sensorRef = database.ref('sensorData');
    const controlRef = database.ref('bomba/controle');
    const settingsRef = database.ref('configuracoes/sistema');
    const historyRef = database.ref('historico');
    const logsRef = database.ref('logs');
    const lastSeenRef = database.ref('sensorData/lastSeen');

    let listenersAttached = false;

    // --- Verificação de Admin ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : 'null');
        if (user) {
            database.ref('usuarios/' + user.uid).get().then(snapshot => {
                if (!snapshot.exists() || snapshot.val().role !== 'admin') {
                    console.warn("User is not admin or data missing.");
                    alert('Acesso negado. Você precisa ser administrador.');
                    try { window.location.href = 'index.html'; } catch(e) { window.location.href = 'login.html'; }
                } else {
                    console.log("Admin verified.");
                    if (!listenersAttached) {
                        console.log("Getting DOM references...");
                        // Obtém referências DOM AQUI, após verificar admin e DOM estar pronto
                        getDomReferences();
                        console.log("Attaching listeners and enabling controls...");
                        enableAdminControls();      // Habilita botões e adiciona listeners de clique
                        attachFirebaseListeners();  // Adiciona listeners do Firebase
                        listenersAttached = true;
                    }
                }
            }).catch(error => {
                console.error("Erro ao verificar permissão:", error);
                window.location.href = 'login.html';
            });
        } else {
            console.log("No user logged in, redirecting to login.");
            window.location.href = 'login.html';
        }
    });

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
        console.log("DOM references obtained.");
    }


    // --- Função para Habilitar Controles e Adicionar Listeners de Clique ---
    function enableAdminControls() {
        // Habilita os botões (verifica se a referência foi obtida)
        if (saveSettingsButton) saveSettingsButton.disabled = false;
        else console.warn("saveSettingsButton not found");

        if (toggleCollectionButton) toggleCollectionButton.disabled = false; // Estado inicial, será ajustado
        else console.warn("toggleCollectionButton not found");

        if (clearHistoryButton) clearHistoryButton.disabled = false;
        else console.warn("clearHistoryButton not found");

        if (restartEspButton) restartEspButton.disabled = false;
        else console.warn("restartEspButton not found");

        if (logoutButton) logoutButton.disabled = false;
        else console.warn("logoutButton not found");

        console.log("Admin control buttons potentially enabled.");

        // Adiciona listeners usando addEventListener
        if (logoutButton) {
            logoutButton.removeEventListener('click', logoutHandler);
            logoutButton.addEventListener('click', logoutHandler);
        }
        if (saveSettingsButton) {
             saveSettingsButton.removeEventListener('click', saveSettingsHandler);
             saveSettingsButton.addEventListener('click', saveSettingsHandler);
        }
        if (toggleCollectionButton) {
            toggleCollectionButton.removeEventListener('click', toggleCollectionHandler);
            toggleCollectionButton.addEventListener('click', toggleCollectionHandler);
        }
        if (clearHistoryButton) {
             clearHistoryButton.removeEventListener('click', clearHistoryHandler);
             clearHistoryButton.addEventListener('click', clearHistoryHandler);
        }
        if (restartEspButton) {
            restartEspButton.removeEventListener('click', restartEspHandler);
            restartEspButton.addEventListener('click', restartEspHandler);
        }
         console.log("Admin button click handlers attached.");
    }

    // --- Handlers dos Botões (separados) ---
    function logoutHandler(e) { /* ... (inalterado) ... */ }
    function saveSettingsHandler() { /* ... (inalterado) ... */ }
    function toggleCollectionHandler() { /* ... (inalterado) ... */ }
    function clearHistoryHandler() { /* ... (inalterado) ... */ }
    function restartEspHandler() { /* ... (inalterado) ... */ }

    // --- Função para Adicionar Listeners do Firebase ---
    function attachFirebaseListeners() {
        console.log("Attaching Firebase listeners...");

        // Sensor Data (Níveis, Coleta)
        sensorRef.on('value', snapshot => {
            console.log("Sensor data received:", snapshot.val());
            let levelMain = '--';
            let levelRes = '--';
            let isCollectionActive = false;
            let collectionText = '??';
            let collectionColor = '#6c757d';

            if(snapshot.exists()) {
                const currentData = snapshot.val();
                levelMain = currentData.level !== undefined ? currentData.level : '--';
                levelRes = currentData.levelReservatorio !== undefined ? currentData.levelReservatorio : '--';
                isCollectionActive = currentData.coletaAtiva !== false;
                collectionText = isCollectionActive ? 'ATIVA' : 'PAUSADA';
                collectionColor = isCollectionActive ? '#28a745' : '#dc3545';

                if (toggleCollectionButton && listenersAttached) { // Só atualiza se admin verificado
                    toggleCollectionButton.textContent = isCollectionActive ? 'Pausar Coleta' : 'Retomar Coleta';
                    toggleCollectionButton.className = 'btn-action ' + (isCollectionActive ? 'btn-red' : 'btn-green');
                    // Garante habilitação SE listeners já foram anexados (implica admin verificado)
                    toggleCollectionButton.disabled = false;
                }
                if (adminWaterMain) adminWaterMain.style.height = (levelMain !== '--' ? levelMain : 0) + '%';
                if (adminWaterRes) adminWaterRes.style.height = (levelRes !== '--' ? levelRes : 0) + '%';
                if (adminLevelPercentMain) adminLevelPercentMain.textContent = levelMain;
                if (adminLevelPercentRes) adminLevelPercentRes.textContent = levelRes;
            } else {
                 console.warn("Sensor data node does not exist.");
                 if (toggleCollectionButton) {
                     toggleCollectionButton.textContent = 'Aguardando...';
                     toggleCollectionButton.className = 'btn-action';
                     toggleCollectionButton.disabled = true; // Desabilita se não há dados
                 }
                 // Zera visualização se não há dados
                 if (adminWaterMain) adminWaterMain.style.height = `0%`;
                 if (adminWaterRes) adminWaterRes.style.height = `0%`;
                 if (adminLevelPercentMain) adminLevelPercentMain.textContent = '--';
                 if (adminLevelPercentRes) adminLevelPercentRes.textContent = '--';
            }
            if (levelCard) levelCard.textContent = `${levelMain}%`;
            if (resLevelCard) resLevelCard.textContent = `${levelRes}%`;
            if (collectionStatusCard) {
                collectionStatusCard.textContent = collectionText;
                collectionStatusCard.style.color = collectionColor;
            }
        }, error => { /* ... (inalterado) ... */ });

        // Controle da Bomba (Status)
        controlRef.on('value', snapshot => { /* ... (inalterado) ... */ }, error => { /* ... (inalterado) ... */ });
        // Configurações (Limites)
        settingsRef.on('value', snapshot => { /* ... (inalterado) ... */ }, error => { /* ... (inalterado) ... */ });
        // Last Seen (Status Conexão)
        lastSeenRef.on('value', snapshot => { /* ... (inalterado) ... */ }, error => { /* ... (inalterado) ... */ });
        // Logs
        logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => { /* ... (inalterado) ... */ }, error => { /* ... (inalterado) ... */ });

        console.log("Firebase listeners attached.");
    }

}); // Fim do DOMContentLoaded
