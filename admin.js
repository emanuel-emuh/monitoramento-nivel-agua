// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
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
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase initialized.");
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        alert("Erro crítico ao inicializar a conexão. Verifique a consola.");
        return;
    }
    const auth = firebase.auth();
    const database = firebase.database();

    // --- Referências DOM --- (Obtidas cedo)
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
                    window.location.href = 'index.html';
                } else {
                    console.log("Admin verified.");
                    // Garante que os listeners só são adicionados uma vez
                    if (!listenersAttached) {
                        console.log("Attaching listeners and enabling controls...");
                        enableAdminControls(); // Habilita botões e adiciona listeners de clique
                        attachFirebaseListeners(); // Adiciona listeners do Firebase
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
        // Remove o atributo 'disabled' se existir
        saveSettingsButton.disabled = false;
        // toggleCollectionButton será habilitado/desabilitado pelo listener
        clearHistoryButton.disabled = false;
        restartEspButton.disabled = false;
        logoutButton.disabled = false; // Botão de logout

        console.log("Admin control buttons potentially enabled.");

        // Adiciona listeners aos botões (se já não existirem - idealmente usar .removeEventListener antes, mas isto simplifica)
        // Usar .onclick garante que substitui listeners anteriores, se houver
        logoutButton.onclick = (e) => {
             e.preventDefault();
             auth.signOut().then(() => { window.location.href = 'login.html'; });
        };

        saveSettingsButton.onclick = () => {
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
         };

         toggleCollectionButton.onclick = () => {
             console.log("Toggle Collection clicked");
             // Desabilita temporariamente para evitar cliques duplos
             toggleCollectionButton.disabled = true;
             sensorRef.child('coletaAtiva').get().then(snapshot => {
                 const isCurrentlyActive = snapshot.val() !== false;
                 sensorRef.update({ coletaAtiva: !isCurrentlyActive })
                    .catch(error => {
                        console.error("Error toggling collection:", error);
                        alert('Erro ao alterar coleta: ' + error.message);
                    })
                    .finally(() => {
                        // Reabilita o botão após a operação, independentemente do resultado
                         toggleCollectionButton.disabled = false;
                    });
             }).catch(error => {
                 console.error("Error getting current collection status:", error);
                 alert('Erro ao ler status da coleta: ' + error.message);
                 toggleCollectionButton.disabled = false; // Reabilita em caso de erro na leitura
             });
         };

         clearHistoryButton.onclick = () => {
             console.log("Clear History clicked");
             if (confirm('Tem certeza que deseja apagar TODO o histórico de leituras?')) {
                 historyRef.remove()
                     .then(() => alert('Histórico limpo com sucesso!'))
                     .catch(error => {
                        console.error("Error clearing history:", error);
                        alert('Erro ao limpar histórico: ' + error.message);
                     });
             }
         };

         restartEspButton.onclick = () => {
             console.log("Restart ESP clicked");
             if (confirm('Tem certeza que deseja reiniciar o ESP8266?')) {
                 controlRef.update({ comandoRestart: true })
                     .then(() => alert('Comando enviado.'))
                     .catch(error => {
                        console.error("Error sending restart command:", error);
                        alert('Erro ao enviar comando: ' + error.message);
                     });
             }
         };
         console.log("Admin button click handlers attached.");
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
                // Atualiza o estado visual do botão de coleta
                toggleCollectionButton.textContent = isCollectionActive ? 'Pausar Coleta' : 'Retomar Coleta';
                toggleCollectionButton.className = 'btn-action ' + (isCollectionActive ? 'btn-red' : 'btn-green');
                 // Habilita o botão se houver dados
                 if (listenersAttached) toggleCollectionButton.disabled = false;


                adminWaterMain.style.height = (levelMain !== '--' ? levelMain : 0) + '%'; // Usa 0 se inválido
                adminWaterRes.style.height = (levelRes !== '--' ? levelRes : 0) + '%'; // Usa 0 se inválido
                adminLevelPercentMain.textContent = levelMain;
                adminLevelPercentRes.textContent = levelRes;

            } else {
                 console.warn("Sensor data node does not exist.");
                 // Mantém o botão desabilitado se não houver dados
                 toggleCollectionButton.textContent = 'Aguardando...';
                 toggleCollectionButton.className = 'btn-action';
                 toggleCollectionButton.disabled = true;
                 adminWaterMain.style.height = `0%`;
                 adminWaterRes.style.height = `0%`;
                 adminLevelPercentMain.textContent = '--';
                adminLevelPercentRes.textContent = '--';
            }

            levelCard.textContent = `${levelMain}%`;
            resLevelCard.textContent = `${levelRes}%`;
            collectionStatusCard.textContent = collectionText;
            collectionStatusCard.style.color = collectionColor;

        }, error => {
             console.error("Error fetching sensor data:", error);
             toggleCollectionButton.disabled = true; // Desabilita em caso de erro
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
            pumpStatusCard.textContent = pumpStatus;
            pumpStatusCard.style.color = pumpColor;

        }, error => {
            console.error("Error fetching control data:", error);
            pumpStatusCard.textContent = 'Erro'; // Indica erro na UI
        });

        // Configurações (Limites)
        settingsRef.on('value', snapshot => {
            if (snapshot.exists()) {
                const settings = snapshot.val();
                lowLimitInput.value = settings.limiteInferior || 50;
                highLimitInput.value = settings.limiteSuperior || 95;
            } else {
                console.warn("Settings node does not exist, using defaults.");
                lowLimitInput.value = 50;
                highLimitInput.value = 95;
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
                  // Verifica se é um número válido antes de usar
                 if (typeof lastSeenTimestamp === 'number' && lastSeenTimestamp > 0) {
                     const now = Date.now();
                     const diffMinutes = (now - lastSeenTimestamp) / (1000 * 60);
                     const lastSeenDate = new Date(lastSeenTimestamp);
                     const formattedDate = lastSeenDate.toLocaleString('pt-BR');

                     if (diffMinutes > 5) {
                         connectionStatusCard.textContent = 'OFFLINE';
                         connectionStatusCard.style.color = '#dc3545';
                         lastSeenText.textContent = `Visto: ${formattedDate}`;
                     } else {
                         connectionStatusCard.textContent = 'ONLINE';
                         connectionStatusCard.style.color = '#28a745';
                         lastSeenText.textContent = `Sinal: ${formattedDate}`;
                     }
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
              connectionStatusCard.textContent = 'Erro';
              lastSeenText.textContent = 'Falha ao carregar.';
         });

         // Logs
         logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
             console.log("Logs received:", snapshot.numChildren(), "entries");
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
         }, error => {
              console.error("Error fetching logs:", error);
              logEntriesList.innerHTML = '<li>Erro ao carregar logs.</li>';
         });

         console.log("Firebase listeners attached.");
    }

}); // Fim do DOMContentLoaded
