// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//   VERSÃO COMPLETA E CORRIGIDA - Foco em habilitar botões
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Admin script starting (v4)..."); // Versão incrementada para debug

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

    // --- Referências DOM --- (Declaradas aqui, preenchidas depois)
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

        // Verifica se os botões foram encontrados
        if (!saveSettingsButton) console.error("!!! saveSettingsButton not found !!!");
        if (!toggleCollectionButton) console.error("!!! toggleCollectionButton not found !!!");
        if (!clearHistoryButton) console.error("!!! clearHistoryButton not found !!!");
        if (!restartEspButton) console.error("!!! restartEspButton not found !!!");
        if (!logoutButton) console.error("!!! logoutButton not found !!!");

        console.log("DOM references obtained (or attempted).");
    }

    // --- Função para Habilitar Controles e Adicionar Listeners de Clique ---
    function enableAdminControls() {
        console.log("Attempting to enable admin controls and attach listeners...");

        // Logout Button
        if (logoutButton) {
            logoutButton.disabled = false;
            logoutButton.removeEventListener('click', logoutHandler);
            logoutButton.addEventListener('click', logoutHandler);
            console.log("logoutButton enabled and listener attached.");
        } else { console.error("logoutButton reference is missing."); }

        // Save Settings Button
        if (saveSettingsButton) {
            saveSettingsButton.disabled = false;
            saveSettingsButton.removeEventListener('click', saveSettingsHandler);
            saveSettingsButton.addEventListener('click', saveSettingsHandler);
             console.log("saveSettingsButton enabled and listener attached.");
        } else { console.error("saveSettingsButton reference is missing."); }

        // Toggle Collection Button (será habilitado/desabilitado pelo listener Firebase)
        if (toggleCollectionButton) {
             console.log("Attaching listener to toggleCollectionButton");
             toggleCollectionButton.removeEventListener('click', toggleCollectionHandler);
             toggleCollectionButton.addEventListener('click', toggleCollectionHandler);
             // Estado inicial pode ser 'disabled' até receber dados do Firebase
             toggleCollectionButton.disabled = true; // Começa desabilitado
             toggleCollectionButton.textContent = 'Aguardando...';
        } else { console.error("toggleCollectionButton reference is missing."); }

        // Clear History Button
        if (clearHistoryButton) {
            clearHistoryButton.disabled = false;
             clearHistoryButton.removeEventListener('click', clearHistoryHandler);
             clearHistoryButton.addEventListener('click', clearHistoryHandler);
             console.log("clearHistoryButton enabled and listener attached.");
        } else { console.error("clearHistoryButton reference is missing."); }

        // Restart ESP Button
        if (restartEspButton) {
            restartEspButton.disabled = false;
            restartEspButton.removeEventListener('click', restartEspHandler);
            restartEspButton.addEventListener('click', restartEspHandler);
            console.log("restartEspButton enabled and listener attached.");
        } else { console.error("restartEspButton reference is missing."); }

         console.log("Finished enabling controls and attaching listeners.");
    }

    // --- Handlers dos Botões (separados) ---
    function logoutHandler(e) {
        e.preventDefault();
        console.log("Logout action initiated.");
        auth.signOut().then(() => { window.location.href = 'login.html'; });
    }

    function saveSettingsHandler() {
         console.log("Save Settings clicked");
         const newLow = parseInt(lowLimitInput.value);
         const newHigh = parseInt(highLimitInput.value);
         if (isNaN(newLow) || isNaN(newHigh) || newLow < 0 || newHigh > 100 || newLow >= newHigh) {
             alert('Valores inválidos para os limites.');
             return;
         }
         settingsRef.update({ limiteInferior: newLow, limiteSuperior: newHigh })
             .then(() => {
                 settingsFeedback.textContent = 'Configurações salvas!';
                 setTimeout(() => { settingsFeedback.textContent = ''; }, 3000);
             })
             .catch(error => {
                console.error("Error saving settings:", error);
                alert('Erro ao salvar configurações: ' + error.message);
             });
     }

     function toggleCollectionHandler() {
         console.log("Toggle Collection clicked");
         if (!toggleCollectionButton) return; // Segurança
         toggleCollectionButton.disabled = true; // Desabilita temporariamente
         sensorRef.child('coletaAtiva').get().then(snapshot => {
             const isCurrentlyActive = snapshot.val() !== false;
             console.log(`Current collection status: ${isCurrentlyActive}, toggling to ${!isCurrentlyActive}`); //DEBUG
             sensorRef.update({ coletaAtiva: !isCurrentlyActive })
                .catch(error => {
                    console.error("Error toggling collection:", error);
                    alert('Erro ao alterar coleta: ' + error.message);
                })
                .finally(() => {
                    // Reabilita APÓS a operação (mesmo com erro no update)
                    // O listener 'sensorRef.on' vai atualizar o texto/cor e garantir que fica habilitado
                    // Apenas removemos o disable aqui por segurança caso o listener falhe
                     if (listenersAttached) toggleCollectionButton.disabled = false;
                });
         }).catch(error => {
             console.error("Error getting current collection status:", error);
             alert('Erro ao ler status da coleta: ' + error.message);
             if (listenersAttached) toggleCollectionButton.disabled = false; // Reabilita se erro na leitura
         });
     }

     function clearHistoryHandler() {
         console.log("Clear History clicked");
         if (confirm('Tem certeza que deseja apagar TODO o histórico de leituras?')) {
             historyRef.remove()
                 .then(() => alert('Histórico limpo com sucesso!'))
                 .catch(error => {
                    console.error("Error clearing history:", error);
                    alert('Erro ao limpar histórico: ' + error.message);
                 });
         }
     }

     function restartEspHandler() {
         console.log("Restart ESP clicked");
         if (confirm('Tem certeza que deseja reiniciar o ESP8266?')) {
             controlRef.update({ comandoRestart: true })
                 .then(() => alert('Comando enviado.'))
                 .catch(error => {
                    console.error("Error sending restart command:", error);
                    alert('Erro ao enviar comando: ' + error.message);
                 });
         }
     }


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
                isCollectionActive = currentData.coletaAtiva !== false; // Assume true se não existir
                collectionText = isCollectionActive ? 'ATIVA' : 'PAUSADA';
                collectionColor = isCollectionActive ? '#28a745' : '#dc3545';

                // Atualiza botão APENAS se ele existe e os listeners já foram anexados
                if (toggleCollectionButton && listenersAttached) {
                    toggleCollectionButton.textContent = isCollectionActive ? 'Pausar Coleta' : 'Retomar Coleta';
                    toggleCollectionButton.className = 'btn-action ' + (isCollectionActive ? 'btn-red' : 'btn-green');
                    // Garante habilitação ao receber dados
                    toggleCollectionButton.disabled = false;
                    console.log("toggleCollectionButton state updated and enabled."); //DEBUG
                } else if (!toggleCollectionButton) {
                     console.error("toggleCollectionButton missing when trying to update state."); //DEBUG
                }

                // Atualiza visualização (com verificações)
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
        }, error => {
             console.error("Error fetching sensor data:", error);
             if (toggleCollectionButton) toggleCollectionButton.disabled = true; // Desabilita em caso de erro
        });

        // Controle da Bomba (Status)
        controlRef.on('value', snapshot => {
            console.log("Control data received:", snapshot.val());
            let pumpStatus = '--';
            let pumpColor = '#6c757d';

            if (snapshot.exists()) {
                const currentControlData = snapshot.val();
                pumpStatus = currentControlData.statusBomba || '--';
                pumpColor = currentControlData.statusBomba === 'LIGADA' ? '#28a745' : '#dc3545';
            } else {
                console.warn("Control data node does not exist.");
            }
            if (pumpStatusCard) {
                pumpStatusCard.textContent = pumpStatus;
                pumpStatusCard.style.color = pumpColor;
            } else { console.error("pumpStatusCard element not found."); }

        }, error => {
            console.error("Error fetching control data:", error);
            if (pumpStatusCard) pumpStatusCard.textContent = 'Erro';
        });

        // Configurações (Limites)
        settingsRef.on('value', snapshot => {
             console.log("Settings data received:", snapshot.val());
            if (snapshot.exists()) {
                const settings = snapshot.val();
                if (lowLimitInput) lowLimitInput.value = settings.limiteInferior || 50;
                else console.error("lowLimitInput element not found.");
                if (highLimitInput) highLimitInput.value = settings.limiteSuperior || 95;
                 else console.error("highLimitInput element not found.");
            } else {
                console.warn("Settings node does not exist, using defaults.");
                if (lowLimitInput) lowLimitInput.value = 50;
                if (highLimitInput) highLimitInput.value = 95;
            }
        }, error => {
             console.error("Error fetching settings data:", error);
             alert("Erro ao carregar configurações de limites.");
        });

        // Last Seen (Status Conexão)
         lastSeenRef.on('value', snapshot => {
             console.log("LastSeen data received:", snapshot.val());
              if (!connectionStatusCard || !lastSeenText) { // Verifica se elementos existem
                   console.error("Connection status elements not found.");
                   return;
              }
             if (snapshot.exists()) {
                 const lastSeenTimestamp = snapshot.val();
                 if (typeof lastSeenTimestamp === 'number' && lastSeenTimestamp > 0) {
                     const now = Date.now();
                     const diffMinutes = (now - lastSeenTimestamp) / (1000 * 60);
                     const lastSeenDate = new Date(lastSeenTimestamp);
                     const formattedDate = lastSeenDate.toLocaleString('pt-BR');

                     if (diffMinutes > 5) {
                         connectionStatusCard.textContent = 'OFFLINE';
                         connectionStatusCard.style.color = '#dc3545';
                     } else {
                         connectionStatusCard.textContent = 'ONLINE';
                         connectionStatusCard.style.color = '#28a745';
                     }
                     lastSeenText.textContent = `Visto: ${formattedDate}`;

                 } else {
                      console.warn("LastSeen timestamp is invalid:", lastSeenTimestamp);
                      connectionStatusCard.textContent = '??';
                      connectionStatusCard.style.color = '#6c757d';
                      lastSeenText.textContent = 'Timestamp inválido.';
                 }
             } else {
                 console.warn("LastSeen node does not exist.");
                 connectionStatusCard.textContent = '??';
                 connectionStatusCard.style.color = '#6c757d';
                 lastSeenText.textContent = 'Nenhum sinal.';
             }
         }, error => {
              console.error("Error fetching lastSeen data:", error);
               if (connectionStatusCard) connectionStatusCard.textContent = 'Erro';
               if (lastSeenText) lastSeenText.textContent = 'Falha ao carregar.';
         });

         // Logs
         logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
             console.log("Logs received:", snapshot.numChildren(), "entries");
              if (logEntriesList) {
                 logEntriesList.innerHTML = '';
                 if (snapshot.exists()) {
                     const logs = [];
                     snapshot.forEach(childSnapshot => { logs.push(childSnapshot.val()); });
                     logs.reverse().forEach(log => {
                         const timestamp = (log && typeof log.timestamp === 'number') ? log.timestamp : Date.now();
                         const message = (log && log.message) ? log.message : "Log inválido";
                         const date = new Date(timestamp);
                         const formattedTime = date.toLocaleString('pt-BR');
                         const listItem = document.createElement('li');
                         listItem.textContent = `[${formattedTime}] ${message}`;
                         logEntriesList.appendChild(listItem);
                     });
                 } else {
                     logEntriesList.innerHTML = '<li>Nenhum log registrado ainda.</li>';
                 }
             } else { console.error("logEntriesList element not found."); }
         }, error => {
              console.error("Error fetching logs:", error);
              if (logEntriesList) logEntriesList.innerHTML = '<li>Erro ao carregar logs.</li>';
         });

         console.log("Firebase listeners attached.");
    }

}); // Fim do DOMContentLoaded
