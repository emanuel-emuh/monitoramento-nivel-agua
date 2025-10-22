// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//   VERSÃO FINAL - Corrigido Log e Adicionado Limpar Logs
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
        saveSettingsButton, clearHistoryButton, logoutButton, clearLogButton; // <- NOVO: clearLogButton

    // --- Referências Firebase ---
    let sensorRef, controlRef, settingsRef, historyRef, logsRef, lastSeenRef;

    let listenersAttached = false;

    // --- Função para obter referências DOM ---
    function getDomReferences() {
        console.log("Attempting to get DOM references...");
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
        clearLogButton = document.getElementById('clear-log-button'); // <- NOVO: Obtém referência

        // Verifica botões
        if (!saveSettingsButton) console.error("!!! saveSettingsButton not found !!!");
        if (!toggleCollectionButton) console.error("!!! toggleCollectionButton not found !!!");
        if (!clearHistoryButton) console.error("!!! clearHistoryButton not found !!!");
        if (!restartEspButton) console.error("!!! restartEspButton not found !!!");
        if (!logoutButton) console.error("!!! logoutButton not found !!!");
        if (!clearLogButton) console.error("!!! clearLogButton not found !!!"); // <- NOVO: Verifica

        console.log("DOM references obtained (or attempted).");
    }

     // --- Função para obter referências Firebase ---
     function getFirebaseReferences() {
         console.log("Getting Firebase references...");
         try {
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
        console.log("Attempting to enable admin controls and attach listeners...");

        if (saveSettingsButton) saveSettingsButton.disabled = false;
        if (toggleCollectionButton) toggleCollectionButton.disabled = false;
        if (clearHistoryButton) clearHistoryButton.disabled = false;
        if (restartEspButton) restartEspButton.disabled = false;
        if (logoutButton) logoutButton.disabled = false;
        if (clearLogButton) clearLogButton.disabled = false; // <- NOVO: Habilita

        // Adiciona listeners
        if (logoutButton) { logoutButton.removeEventListener('click', logoutHandler); logoutButton.addEventListener('click', logoutHandler); }
        if (saveSettingsButton) { saveSettingsButton.removeEventListener('click', saveSettingsHandler); saveSettingsButton.addEventListener('click', saveSettingsHandler); }
        if (toggleCollectionButton) { toggleCollectionButton.removeEventListener('click', toggleCollectionHandler); toggleCollectionButton.addEventListener('click', toggleCollectionHandler); }
        if (clearHistoryButton) { clearHistoryButton.removeEventListener('click', clearHistoryHandler); clearHistoryButton.addEventListener('click', clearHistoryHandler); }
        if (restartEspButton) { restartEspButton.removeEventListener('click', restartEspHandler); restartEspButton.addEventListener('click', restartEspHandler); }
        if (clearLogButton) { clearLogButton.removeEventListener('click', clearLogHandler); clearLogButton.addEventListener('click', clearLogHandler); } // <- NOVO: Adiciona listener

         console.log("Finished enabling controls and attaching listeners.");
    }

    // --- Handlers dos Botões ---
    function logoutHandler(e) { /* ... (inalterado) ... */ }
    function saveSettingsHandler() { /* ... (inalterado) ... */ }
    function toggleCollectionHandler() { /* ... (inalterado) ... */ }
    function clearHistoryHandler() { /* ... (inalterado) ... */ }
    function restartEspHandler() { /* ... (inalterado) ... */ }

    // --- NOVO Handler para Limpar Logs ---
    function clearLogHandler() {
         console.log("--- Clear Log Handler Called ---");
         if (!logsRef) { console.error("!!! logsRef is undefined in handler!"); return; }

         if (confirm('Tem certeza que deseja apagar TODO o Log de Eventos? Esta ação não pode ser desfeita.')) {
             console.log("Attempting Firebase remove for logs...");
             logsRef.remove()
                 .then(() => {
                     console.log("Firebase logs remove successful.");
                     alert('Log de Eventos limpo com sucesso!');
                     // A lista será limpa automaticamente pelo listener 'logsRef.on'
                 })
                 .catch(error => {
                    console.error("!!! Firebase logs remove FAILED:", error);
                    alert('Erro ao limpar o Log de Eventos: ' + error.message);
                 });
         } else {
             console.log("Clear logs cancelled by user.");
         }
     }


    // --- Função para Adicionar Listeners do Firebase ---
    function attachFirebaseListeners() {
        if (!sensorRef || !controlRef || !settingsRef || !historyRef || !logsRef || !lastSeenRef) return;
        console.log("Attaching Firebase listeners...");

        // Sensor Data (Níveis, Coleta)
        sensorRef.on('value', snapshot => { /* ... (código inalterado) ... */ }, error => { /* ... */ });
        // Controle da Bomba (Status)
        controlRef.on('value', snapshot => { /* ... (código inalterado) ... */ }, error => { /* ... */ });
        // Configurações (Limites)
        settingsRef.on('value', snapshot => { /* ... (código inalterado) ... */ }, error => { /* ... */ });
        // Last Seen (Status Conexão)
        lastSeenRef.on('value', snapshot => { /* ... (código inalterado) ... */ }, error => { /* ... */ });

        // Logs *** CORRIGIDO ***
         logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
             console.log("Logs received:", snapshot.exists() ? snapshot.numChildren() + " entries" : "null/empty"); // Melhor log
              if (!logEntriesList) { // Verifica se a lista UL existe no DOM
                  console.error("logEntriesList element not found when trying to display logs.");
                  return;
              }
              logEntriesList.innerHTML = ''; // Limpa a lista antes de preencher

              if (snapshot.exists()) {
                  const logs = [];
                  // Itera sobre cada filho (cada log individual)
                  snapshot.forEach(childSnapshot => {
                      const logData = childSnapshot.val(); // Obtém os dados do log ({message: "...", timestamp: 123...})
                      // Verifica se os dados são minimamente válidos
                      if (logData && typeof logData.timestamp === 'number' && typeof logData.message === 'string') {
                           logs.push(logData);
                      } else {
                           console.warn("Invalid log entry found:", childSnapshot.key, logData);
                      }
                  });

                  // Ordena por timestamp DESCENDENTE (mais recente primeiro)
                  logs.sort((a, b) => b.timestamp - a.timestamp);

                  // Cria os elementos <li> e adiciona à lista
                  logs.forEach(log => {
                      const date = new Date(log.timestamp);
                      // Formatação mais robusta da data/hora
                      const formattedTime = date.toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                      });
                      const listItem = document.createElement('li');
                      listItem.textContent = `[${formattedTime}] ${log.message}`;
                      logEntriesList.appendChild(listItem);
                  });
                   console.log(`Displayed ${logs.length} valid log entries.`);
              } else {
                  logEntriesList.innerHTML = '<li>Nenhum log registrado ainda.</li>';
              }
         }, error => {
              console.error("Error fetching logs:", error);
              if (logEntriesList) logEntriesList.innerHTML = '<li>Erro ao carregar logs.</li>';
         });

         console.log("Firebase listeners attached.");
    }

     // --- Verificação de Admin ---
    console.log("Setting up Auth State Change listener...");
    auth.onAuthStateChanged(user => {
        if (user) {
            database.ref('usuarios/' + user.uid).get().then(snapshot => {
                if (!snapshot.exists() || snapshot.val().role !== 'admin') { /* ... (Redirecionamento) ... */ }
                else {
                    if (!listenersAttached) {
                        getDomReferences();
                        if(getFirebaseReferences()) {
                            enableAdminControls();
                            attachFirebaseListeners();
                            listenersAttached = true;
                        } else { alert("Falha ao obter referências do Firebase."); }
                    }
                }
            }).catch(error => { /* ... (Tratamento de erro) ... */ });
        } else { /* ... (Redirecionamento) ... */ }
    });
     console.log("Auth state listener is set.");

}); // Fim do DOMContentLoaded
console.log("Admin script (DEBUG v9) loaded.");
