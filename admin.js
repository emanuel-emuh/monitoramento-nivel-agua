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

    // --- Referências DOM (Obtidas cedo para garantir que existem) ---
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
                    console.log("Admin verified. Attaching listeners and enabling buttons...");
                    // Habilita botões e adiciona listeners DEPOIS de verificar que é admin
                    enableAdminControls();
                    attachFirebaseListeners();
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

    // --- Função para Habilitar Controles e Adicionar Listeners de Botões ---
    function enableAdminControls() {
        // Habilita os botões explicitamente
        saveSettingsButton.disabled = false;
        toggleCollectionButton.disabled = false; // Será atualizado pelo listener
        clearHistoryButton.disabled = false;
        restartEspButton.disabled = false;
        logoutButton.disabled = false; // Botão de logout

        console.log("Buttons potentially enabled.");

        // Adiciona listeners aos botões
        logoutButton.addEventListener('click', e => {
             e.preventDefault();
             auth.signOut().then(() => { window.location.href = 'login.html'; });
        });

        saveSettingsButton.addEventListener('click', () => {
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
         });

         toggleCollectionButton.addEventListener('click', () => {
             console.log("Toggle Collection clicked");
             sensorRef.child('coletaAtiva').get().then(snapshot => {
                 const isCurrentlyActive = snapshot.val() !== false;
                 sensorRef.update({ coletaAtiva: !isCurrentlyActive })
                    .catch(error => {
                        console.error("Error toggling collection:", error);
                        alert('Erro ao alterar coleta: ' + error.message);
                    });
             }).catch(error => {
                 console.error("Error getting current collection status:", error);
                 alert('Erro ao ler status da coleta: ' + error.message);
             });
         });

         clearHistoryButton.addEventListener('click', () => {
             console.log("Clear History clicked");
             if (confirm('Tem certeza que deseja apagar TODO o histórico de leituras?')) {
                 historyRef.remove()
                     .then(() => alert('Histórico limpo com sucesso!'))
                     .catch(error => {
                        console.error("Error clearing history:", error);
                        alert('Erro ao limpar histórico: ' + error.message);
                     });
             }
         });

         restartEspButton.addEventListener('click', () => {
             console.log("Restart ESP clicked");
             if (confirm('Tem certeza que deseja reiniciar o ESP8266?')) {
                 controlRef.update({ comandoRestart: true })
                     .then(() => alert('Comando enviado.'))
                     .catch(error => {
                        console.error("Error sending restart command:", error);
                        alert('Erro ao enviar comando: ' + error.message);
                     });
             }
         });
         console.log("Admin button listeners attached.");
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
                // Garante que o botão esteja habilitado se houver dados
                toggleCollectionButton.disabled = false;

                adminWaterMain.style.height = `${levelMain}%`;
                adminWaterRes.style.height = `${levelRes}%`;
                adminLevelPercentMain.textContent = levelMain;
                adminLevelPercentRes.textContent = levelRes;

            } else {
                 console.warn("Sensor data node does not exist.");
                 // Mantém o botão desabilitado se não houver dados iniciais
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
             // Desabilita botão em caso de erro
             toggleCollectionButton.disabled = true;
        });

        // Controle da Bomba (Status)
        controlRef.on('value', snapshot => { /* ... (código inalterado) ... */ }, error => { /* ... (código inalterado) ... */ });

        // Configurações (Limites)
        settingsRef.on('value', snapshot => { /* ... (código inalterado) ... */ }, error => { /* ... (código inalterado) ... */ });

        // Last Seen (Status Conexão)
         lastSeenRef.on('value', snapshot => { /* ... (código inalterado) ... */ }, error => { /* ... (código inalterado) ... */ });

         // Logs
         logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => { /* ... (código inalterado) ... */ }, error => { /* ... (código inalterado) ... */ });

         console.log("Firebase listeners attached.");
    }

}); // Fim do DOMContentLoaded
