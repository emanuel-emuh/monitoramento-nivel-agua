// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
//   VERSÃO CORRIGIDA - Sem NENHUMA referência à Visão Cliente
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
        // Evita reinicializar Firebase app se já existir (boa prática)
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        } else {
            firebase.app(); // Obtém a app já inicializada
        }
        console.log("Firebase initialized or retrieved.");
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        alert("Erro crítico ao inicializar a conexão. Verifique a consola.");
        return; // Impede a execução do resto do script
    }
    const auth = firebase.auth();
    const database = firebase.database();

    // --- Referências DOM (Admin Geral) ---
    // É importante obter as referências *depois* do DOM estar carregado
    const levelCard = document.getElementById('admin-level-card');
    const resLevelCard = document.getElementById('admin-res-level-card');
    const pumpStatusCard = document.getElementById('admin-pump-status-card');
    const collectionStatusCard = document.getElementById('admin-collection-status-card');
    const connectionStatusCard = document.getElementById('admin-connection-status');
    const lastSeenText = document.getElementById('admin-last-seen');
    const lowLimitInput = document.getElementById('low-limit-input');
    const highLimitInput = document.getElementById('high-limit-input');
    const settingsFeedback = document.getElementById('settings-feedback');
    const toggleCollectionButton = document.getElementById('toggle-collection-button');
    const restartEspButton = document.getElementById('restart-esp-button');
    const logEntriesList = document.getElementById('log-entries');
    const adminWaterMain = document.getElementById('admin-water-main');
    const adminWaterRes = document.getElementById('admin-water-res');
    const adminLevelPercentMain = document.getElementById('admin-level-percent-main');
    const adminLevelPercentRes = document.getElementById('admin-level-percent-res');
    const saveSettingsButton = document.getElementById('save-settings-button');
    const clearHistoryButton = document.getElementById('clear-history-button');
    const logoutButton = document.querySelector('.logout-button');

    // --- Referências Firebase ---
    const sensorRef = database.ref('sensorData');
    const controlRef = database.ref('bomba/controle');
    const settingsRef = database.ref('configuracoes/sistema');
    const historyRef = database.ref('historico');
    const logsRef = database.ref('logs');
    const lastSeenRef = database.ref('sensorData/lastSeen');

    // --- Variável de estado para evitar adicionar listeners múltiplos ---
     let listenersAttached = false;

    // --- Verificação de Admin ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : 'null');
        if (user) {
            database.ref('usuarios/' + user.uid).get().then(snapshot => {
                if (!snapshot.exists() || snapshot.val().role !== 'admin') {
                    console.warn("User is not admin or data missing.");
                    alert('Acesso negado. Você precisa ser administrador.');
                    // Tenta redirecionar para index.html, se falhar (ex: ciclo), vai para login
                    try { window.location.href = 'index.html'; } catch(e) { window.location.href = 'login.html'; }
                } else {
                    console.log("Admin verified.");
                    if (!listenersAttached) {
                        console.log("Attaching listeners and enabling controls...");
                        enableAdminControls();      // Habilita botões e adiciona listeners de clique PRIMEIRO
                        attachFirebaseListeners();  // Adiciona listeners do Firebase DEPOIS
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

    // --- Função para Habilitar Controles e Adicionar Listeners de Clique ---
    function enableAdminControls() {
        // Garante que os elementos existem antes de tentar usá-los
        if (saveSettingsButton) saveSettingsButton.disabled = false;
        if (toggleCollectionButton) toggleCollectionButton.disabled = false; // Estado inicial habilitado, será ajustado pelo listener
        if (clearHistoryButton) clearHistoryButton.disabled = false;
        if (restartEspButton) restartEspButton.disabled = false;
        if (logoutButton) logoutButton.disabled = false;

        console.log("Admin control buttons potentially enabled.");

        // Adiciona listeners usando addEventListener para evitar sobrescrever acidentalmente
        if (logoutButton) {
            logoutButton.removeEventListener('click', logoutHandler); // Remove listener anterior se existir
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

    // --- Handlers dos Botões (separados para clareza) ---
    function logoutHandler(e) {
        e.preventDefault();
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
         if (toggleCollectionButton) toggleCollectionButton.disabled = true; // Desabilita temporariamente
         sensorRef.child('coletaAtiva').get().then(snapshot => {
             const isCurrentlyActive = snapshot.val() !== false;
             sensorRef.update({ coletaAtiva: !isCurrentlyActive })
                .catch(error => {
                    console.error("Error toggling collection:", error);
                    alert('Erro ao alterar coleta: ' + error.message);
                })
                .finally(() => {
                    // Reabilita APÓS a operação (mesmo com erro no update)
                     if (toggleCollectionButton && listenersAttached) toggleCollectionButton.disabled = false;
                });
         }).catch(error => {
             console.error("Error getting current collection status:", error);
             alert('Erro ao ler status da coleta: ' + error.message);
             if (toggleCollectionButton && listenersAttached) toggleCollectionButton.disabled = false; // Reabilita se erro na leitura
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

                isCollectionActive = currentData.coletaAtiva !== false;
                collectionText = isCollectionActive ? 'ATIVA' : 'PAUSADA';
                collectionColor = isCollectionActive ? '#28a745' : '#dc3545';

                // Atualiza botão APENAS se ele existe e os listeners já foram anexados
                if (toggleCollectionButton && listenersAttached) {
                    toggleCollectionButton.textContent = isCollectionActive ? 'Pausar Coleta' : 'Retomar Coleta';
                    toggleCollectionButton.className = 'btn-action ' + (isCollectionActive ? 'btn-red' : 'btn-green');
                    toggleCollectionButton.disabled = false; // Habilita o botão aqui
                }

                // Atualiza visualização (verifica se elementos existem)
                if (adminWaterMain) adminWaterMain.style.height = (levelMain !== '--' ? levelMain : 0) + '%'; // Usa 0 se inválido
                if (adminWaterRes) adminWaterRes.style.height = (levelRes !== '--' ? levelRes : 0) + '%'; // Usa 0 se inválido
                if (adminLevelPercentMain) adminLevelPercentMain.textContent = levelMain;
                if (adminLevelPercentRes) adminLevelPercentRes.textContent = levelRes;

            } else {
                 console.warn("Sensor data node does not exist.");
                 if (toggleCollectionButton) {
                     toggleCollectionButton.textContent = 'Aguardando...';
                     toggleCollectionButton.className = 'btn-action';
                     toggleCollectionButton.disabled = true;
                 }
                 if (adminWaterMain) adminWaterMain.style.height = `0%`;
                 if (adminWaterRes) adminWaterRes.style.height = `0%`;
                 if (adminLevelPercentMain) adminLevelPercentMain.textContent = '--';
                if (adminLevelPercentRes) adminLevelPercentRes.textContent = '--';
            }

            // Atualiza cards (verifica se elementos existem)
            if (levelCard) levelCard.textContent = `${levelMain}%`;
            if (resLevelCard) resLevelCard.textContent = `${levelRes}%`;
            if (collectionStatusCard) {
                collectionStatusCard.textContent = collectionText;
                collectionStatusCard.style.color = collectionColor;
            }

        }, error => {
             console.error("Error fetching sensor data:", error);
             if (toggleCollectionButton) toggleCollectionButton.disabled = true;
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
            if (pumpStatusCard) { // Verifica se elemento existe
                pumpStatusCard.textContent = pumpStatus;
                pumpStatusCard.style.color = pumpColor;
            }

        }, error => {
            console.error("Error fetching control data:", error);
            if (pumpStatusCard) pumpStatusCard.textContent = 'Erro'; // Indica erro na UI
        });

        // Configurações (Limites)
        settingsRef.on('value', snapshot => {
            if (snapshot.exists()) {
                const settings = snapshot.val();
                if (lowLimitInput) lowLimitInput.value = settings.limiteInferior || 50;
                if (highLimitInput) highLimitInput.value = settings.limiteSuperior || 95;
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
             if (snapshot.exists()) {
                 const lastSeenTimestamp = snapshot.val();
                 if (typeof lastSeenTimestamp === 'number' && lastSeenTimestamp > 0) {
                     const now = Date.now();
                     const diffMinutes = (now - lastSeenTimestamp) / (1000 * 60);
                     const lastSeenDate = new Date(lastSeenTimestamp);
                     const formattedDate = lastSeenDate.toLocaleString('pt-BR');

                     if (connectionStatusCard) {
                         if (diffMinutes > 5) {
                             connectionStatusCard.textContent = 'OFFLINE';
                             connectionStatusCard.style.color = '#dc3545';
                         } else {
                             connectionStatusCard.textContent = 'ONLINE';
                             connectionStatusCard.style.color = '#28a745';
                         }
                     }
                     if (lastSeenText) lastSeenText.textContent = `Visto: ${formattedDate}`;

                 } else {
                      console.warn("LastSeen timestamp is invalid:", lastSeenTimestamp);
                      if (connectionStatusCard) {
                          connectionStatusCard.textContent = '??';
                          connectionStatusCard.style.color = '#6c757d';
                      }
                      if (lastSeenText) lastSeenText.textContent = 'Timestamp inválido.';
                 }
             } else {
                 console.warn("LastSeen node does not exist.");
                 if (connectionStatusCard) {
                     connectionStatusCard.textContent = '??';
                     connectionStatusCard.style.color = '#6c757d';
                 }
                 if (lastSeenText) lastSeenText.textContent = 'Nenhum sinal.';
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
             }
         }, error => {
              console.error("Error fetching logs:", error);
              if (logEntriesList) logEntriesList.innerHTML = '<li>Erro ao carregar logs.</li>';
         });

         console.log("Firebase listeners attached.");
    }

}); // Fim do DOMContentLoaded
