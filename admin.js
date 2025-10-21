// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Admin script starting..."); // DEBUG: Confirma que o script iniciou

    // --- INICIALIZAÇÃO E AUTENTICAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
        authDomain: "aqua-monitor-login.firebaseapp.com",
        projectId: "aqua-monitor-login",
        databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
    };
    try {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase initialized."); // DEBUG
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        alert("Erro crítico ao inicializar a conexão. Verifique a consola.");
        return; // Impede a execução do resto do script
    }
    const auth = firebase.auth();
    const database = firebase.database();

    // --- Verificação de Admin ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : 'null'); // DEBUG
        if (user) {
            database.ref('usuarios/' + user.uid).get().then(snapshot => {
                if (!snapshot.exists() || snapshot.val().role !== 'admin') {
                    console.warn("User is not admin or data missing."); // DEBUG
                    alert('Acesso negado. Você precisa ser administrador.');
                    window.location.href = 'index.html';
                } else {
                    console.log("Admin verified."); // DEBUG
                    // Só adiciona os listeners DEPOIS de verificar que é admin
                    attachListeners();
                }
            }).catch(error => {
                console.error("Erro ao verificar permissão:", error);
                window.location.href = 'login.html';
            });
        } else {
            console.log("No user logged in, redirecting to login."); // DEBUG
            window.location.href = 'login.html';
        }
    });

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

    // --- Função para Adicionar Listeners ---
    // Separamos isto para garantir que só são adicionados após a verificação de admin
    function attachListeners() {
        console.log("Attaching Firebase listeners..."); // DEBUG

        // Sensor Data (Níveis, Coleta)
        sensorRef.on('value', snapshot => {
            console.log("Sensor data received:", snapshot.val()); // DEBUG
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
                toggleCollectionButton.textContent = isCollectionActive ? 'Pausar Coleta' : 'Retomar Coleta';
                toggleCollectionButton.className = 'btn-action ' + (isCollectionActive ? 'btn-red' : 'btn-green');
                toggleCollectionButton.disabled = false;

                adminWaterMain.style.height = `${levelMain}%`;
                adminWaterRes.style.height = `${levelRes}%`;
                adminLevelPercentMain.textContent = levelMain;
                adminLevelPercentRes.textContent = levelRes;

            } else {
                 console.warn("Sensor data node does not exist."); // DEBUG
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

        }, error => { // DEBUG: Adiciona tratamento de erro para o listener
             console.error("Error fetching sensor data:", error);
        });

        // Controle da Bomba (Status)
        controlRef.on('value', snapshot => {
            console.log("Control data received:", snapshot.val()); // DEBUG
            let pumpStatus = '--';
            let pumpColor = '#6c757d';

            if (snapshot.exists()) {
                const currentControlData = snapshot.val();
                pumpStatus = currentControlData.statusBomba || '--';
                pumpColor = currentControlData.statusBomba === 'LIGADA' ? '#28a745' : '#dc3545';
            } else {
                console.warn("Control data node does not exist."); // DEBUG
            }
            pumpStatusCard.textContent = pumpStatus;
            pumpStatusCard.style.color = pumpColor;

        }, error => { // DEBUG
            console.error("Error fetching control data:", error);
        });

        // Configurações (Limites)
        settingsRef.on('value', snapshot => {
            if (snapshot.exists()) {
                const settings = snapshot.val();
                lowLimitInput.value = settings.limiteInferior || 50;
                highLimitInput.value = settings.limiteSuperior || 95;
            } else {
                console.warn("Settings node does not exist, using defaults."); // DEBUG
                lowLimitInput.value = 50; // Default
                highLimitInput.value = 95; // Default
            }
        }, error => { // DEBUG
             console.error("Error fetching settings data:", error);
        });

        // Last Seen (Status Conexão)
         lastSeenRef.on('value', snapshot => {
             console.log("LastSeen data received:", snapshot.val()); // DEBUG
             if (snapshot.exists()) {
                 const lastSeenTimestamp = snapshot.val();
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
                 console.warn("LastSeen node does not exist."); // DEBUG
                 connectionStatusCard.textContent = '??';
                 connectionStatusCard.style.color = '#6c757d';
                 lastSeenText.textContent = 'Nenhum sinal.';
             }
         }, error => { // DEBUG
              console.error("Error fetching lastSeen data:", error);
         });

         // Logs
         logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
             console.log("Logs received:", snapshot.numChildren(), "entries"); // DEBUG
             logEntriesList.innerHTML = '';
             if (snapshot.exists()) {
                 const logs = [];
                 snapshot.forEach(childSnapshot => { logs.push(childSnapshot.val()); });
                 logs.reverse().forEach(log => {
                     // Verifica se timestamp existe e é número
                     const timestamp = (log && typeof log.timestamp === 'number') ? log.timestamp : Date.now(); // Usa agora se faltar
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
         }, error => { // DEBUG
              console.error("Error fetching logs:", error);
         });

        // --- AÇÕES DOS BOTÕES (Admin) ---
        console.log("Attaching button listeners..."); // DEBUG

        logoutButton.addEventListener('click', e => { /* ... código já existente ... */ });

        saveSettingsButton.addEventListener('click', () => {
             console.log("Save Settings clicked"); // DEBUG
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
                 .catch(error => { // DEBUG
                    console.error("Error saving settings:", error);
                    alert('Erro ao salvar configurações: ' + error.message);
                 });
         });

         toggleCollectionButton.addEventListener('click', () => {
             console.log("Toggle Collection clicked"); // DEBUG
             sensorRef.child('coletaAtiva').get().then(snapshot => {
                 const isCurrentlyActive = snapshot.val() !== false;
                 sensorRef.update({ coletaAtiva: !isCurrentlyActive })
                    .catch(error => { // DEBUG
                        console.error("Error toggling collection:", error);
                        alert('Erro ao alterar coleta: ' + error.message);
                    });
             }).catch(error => { // DEBUG
                 console.error("Error getting current collection status:", error);
                 alert('Erro ao ler status da coleta: ' + error.message);
             });
         });

         clearHistoryButton.addEventListener('click', () => {
             console.log("Clear History clicked"); // DEBUG
             if (confirm('Tem certeza que deseja apagar TODO o histórico de leituras?')) {
                 historyRef.remove()
                     .then(() => alert('Histórico limpo com sucesso!'))
                     .catch(error => { // DEBUG
                        console.error("Error clearing history:", error);
                        alert('Erro ao limpar histórico: ' + error.message);
                     });
             }
         });

         restartEspButton.addEventListener('click', () => {
             console.log("Restart ESP clicked"); // DEBUG
             if (confirm('Tem certeza que deseja reiniciar o ESP8266?')) {
                 controlRef.update({ comandoRestart: true })
                     .then(() => alert('Comando enviado.'))
                     .catch(error => { // DEBUG
                        console.error("Error sending restart command:", error);
                        alert('Erro ao enviar comando: ' + error.message);
                     });
             }
         });
         console.log("Button listeners attached."); // DEBUG

    } // Fim da função attachListeners

}); // Fim do DOMContentLoaded
