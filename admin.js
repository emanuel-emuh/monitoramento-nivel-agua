// ===================================================================
//   AQUAMONITOR - SCRIPT DO PAINEL DE ADMINISTRADOR (admin.js)
// ===================================================================

// Volume fixo do protótipo (usado na Visão Cliente)
const totalVolumeLiters = 1.728;

document.addEventListener('DOMContentLoaded', function () {
    // --- INICIALIZAÇÃO E AUTENTICAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
        authDomain: "aqua-monitor-login.firebaseapp.com",
        projectId: "aqua-monitor-login",
        databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const database = firebase.database();

    // --- Verificação de Admin ---
    auth.onAuthStateChanged(user => {
        if (user) {
            database.ref('usuarios/' + user.uid).get().then(snapshot => {
                if (!snapshot.exists() || snapshot.val().role !== 'admin') {
                    alert('Acesso negado. Você precisa ser administrador.');
                    window.location.href = 'index.html';
                }
                // Se for admin, o resto do script continua a carregar os dados
            }).catch(error => {
                console.error("Erro ao verificar permissão:", error);
                window.location.href = 'login.html';
            });
        } else {
            window.location.href = 'login.html';
        }
    });

    // --- Botão de Logout ---
    document.querySelector('.logout-button').addEventListener('click', e => {
        e.preventDefault();
        auth.signOut().then(() => { window.location.href = 'login.html'; });
    });

    // --- Referências DOM (Admin Geral) ---
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

    // --- Referências DOM (Visão Cliente) ---
    const cvMainLevelValue = document.getElementById('cv-main-level-value');
    const cvMainLevelLiters = document.getElementById('cv-main-level-liters');
    const cvResLevelValue = document.getElementById('cv-res-level-value');
    const cvResLevelLiters = document.getElementById('cv-res-level-liters');
    const cvPumpStatusIcon = document.getElementById('cv-pump-status-icon');
    const cvPumpStatusValue = document.getElementById('cv-pump-status-value');
    const cvPumpStatusText = document.getElementById('cv-pump-status-text');
    const cvModeIcon = document.getElementById('cv-mode-icon');
    const cvModeValue = document.getElementById('cv-mode-value');
    const cvModeText = document.getElementById('cv-mode-text');
    const cvConsumptionValue = document.getElementById('cv-consumption-value');
    const cvConsumptionText = document.getElementById('cv-consumption-text');
    const cvLevelFillMain = document.getElementById('cv-level-fill-main');
    const cvLevelPercentageMain = document.getElementById('cv-level-percentage-main');
    const cvLevelFillRes = document.getElementById('cv-level-fill-res');
    const cvLevelPercentageRes = document.getElementById('cv-level-percentage-res');
    const cvMotorStatus = document.getElementById('cv-motor-status');
    const cvAutoModeStatus = document.getElementById('cv-auto-mode-status');
    const cvFeriasStatus = document.getElementById('cv-ferias-status');
    const cvCtx = document.getElementById('cv-levelChart').getContext('2d');


    // --- Referências Firebase ---
    const sensorRef = database.ref('sensorData');
    const controlRef = database.ref('bomba/controle');
    const settingsRef = database.ref('configuracoes/sistema');
    const historyRef = database.ref('historico');
    const logsRef = database.ref('logs');
    const lastSeenRef = database.ref('sensorData/lastSeen');

    // --- Inicialização do Gráfico (Visão Cliente) ---
    const cvLevelChart = new Chart(cvCtx, {
        type: 'line', data: { labels: [], datasets: [{ label: 'Nível Caixa Principal (%)', data: [], borderColor: '#2e7d32', backgroundColor: 'rgba(46, 125, 50, 0.1)', fill: true, tension: 0.2 }] },
        options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });

    // --- OUVINTES DE DADOS (LISTENERS) ---

    // Sensor Data (Níveis, Coleta, LastSeen indiretamente)
    sensorRef.on('value', snapshot => {
        let levelMain = '--';
        let levelRes = '--';
        let isCollectionActive = false;
        let collectionText = '??';
        let collectionColor = '#6c757d';
        let currentData = {};

        if(snapshot.exists()) {
            currentData = snapshot.val();
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

        updateClientViewUI(currentData);
    });

    // Controle da Bomba (Status, Modo, Modo Operação)
    controlRef.on('value', snapshot => {
        let pumpStatus = '--';
        let pumpColor = '#6c757d';
        let currentControlData = {};

        if (snapshot.exists()) {
            currentControlData = snapshot.val();
            pumpStatus = currentControlData.statusBomba || '--';
            pumpColor = currentControlData.statusBomba === 'LIGADA' ? '#28a745' : '#dc3545';
        }
        pumpStatusCard.textContent = pumpStatus;
        pumpStatusCard.style.color = pumpColor;

         updateClientViewPumpControls(currentControlData);
    });

    // Configurações (Limites)
    settingsRef.on('value', snapshot => {
        if (snapshot.exists()) {
            const settings = snapshot.val();
            lowLimitInput.value = settings.limiteInferior || 50;
            highLimitInput.value = settings.limiteSuperior || 95;
        }
     });

    // Last Seen (Status Conexão)
     lastSeenRef.on('value', snapshot => {
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
             connectionStatusCard.textContent = '??';
             connectionStatusCard.style.color = '#6c757d';
             lastSeenText.textContent = 'Nenhum sinal.';
         }
     });

     // Logs
     logsRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
         logEntriesList.innerHTML = '';
         if (snapshot.exists()) {
             const logs = [];
             snapshot.forEach(childSnapshot => { logs.push(childSnapshot.val()); });
             logs.reverse().forEach(log => {
                 const date = new Date(log.timestamp);
                 const formattedTime = date.toLocaleString('pt-BR');
                 const listItem = document.createElement('li');
                 listItem.textContent = `[${formattedTime}] ${log.message}`;
                 logEntriesList.appendChild(listItem);
             });
         } else {
             logEntriesList.innerHTML = '<li>Nenhum log registrado ainda.</li>';
         }
     });

    // Histórico (para gráfico da visão cliente e cálculo de consumo)
    historyRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            const labels = [];
            const levels = [];
            const sortedEntries = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);

            sortedEntries.forEach(entry => {
                const date = new Date(entry.timestamp);
                const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                labels.push(timeString);
                levels.push(entry.nivel);
            });

            cvLevelChart.data.labels = labels;
            cvLevelChart.data.datasets[0].data = levels;
            cvLevelChart.update();

            calculateAverageConsumption(data);
        } else {
             cvLevelChart.data.labels = [];
             cvLevelChart.data.datasets[0].data = [];
             cvLevelChart.update();
             cvConsumptionValue.textContent = '--';
             cvConsumptionText.textContent = 'Sem histórico.';
        }
    });


    // --- AÇÕES DOS BOTÕES (Admin) ---
     document.getElementById('save-settings-button').addEventListener('click', () => {
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
             });
     });

     toggleCollectionButton.addEventListener('click', () => {
         sensorRef.child('coletaAtiva').get().then(snapshot => {
             const isCurrentlyActive = snapshot.val() !== false;
             sensorRef.update({ coletaAtiva: !isCurrentlyActive });
         });
     });

     document.getElementById('clear-history-button').addEventListener('click', () => {
         if (confirm('Tem certeza que deseja apagar TODO o histórico de leituras?')) {
             historyRef.remove()
                 .then(() => alert('Histórico limpo com sucesso!'))
                 .catch(error => alert('Erro: ' + error.message));
         }
     });

     restartEspButton.addEventListener('click', () => {
         if (confirm('Tem certeza que deseja reiniciar o ESP8266?')) {
             controlRef.update({ comandoRestart: true })
                 .then(() => alert('Comando enviado.'))
                 .catch(error => alert('Erro: ' + error.message));
         }
     });

    // --- FUNÇÕES DE ATUALIZAÇÃO DA VISÃO CLIENTE ---
    function updateClientViewUI(sensorData) {
        const levelMain = sensorData.level !== undefined ? sensorData.level : '--';
        const levelRes = sensorData.levelReservatorio !== undefined ? sensorData.levelReservatorio : '--';
        const isDataValid = levelMain !== '--' && levelRes !== '--';

        const currentLitersMain = isDataValid ? (totalVolumeLiters * (levelMain / 100)).toFixed(1) : '--';
        cvMainLevelValue.textContent = `${levelMain}%`;
        cvMainLevelLiters.textContent = isDataValid ? `${currentLitersMain} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
        cvLevelFillMain.style.width = isDataValid ? levelMain + '%' : '0%';
        cvLevelPercentageMain.textContent = `${levelMain}%`;

        if (levelMain <= 50) { cvLevelFillMain.className = 'level-fill level-low'; }
        else if (levelMain < 95) { cvLevelFillMain.className = 'level-fill level-medium'; }
        else { cvLevelFillMain.className = 'level-fill level-high'; }

        const currentLitersRes = isDataValid ? (totalVolumeLiters * (levelRes / 100)).toFixed(1) : '--';
        cvResLevelValue.textContent = `${levelRes}%`;
        cvResLevelLiters.textContent = isDataValid ? `${currentLitersRes} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
        cvLevelFillRes.style.width = isDataValid ? levelRes + '%' : '0%';
        cvLevelPercentageRes.textContent = `${levelRes}%`;

        if (levelRes <= 50) { cvLevelFillRes.className = 'level-fill level-low'; }
         else if (levelRes < 95) { cvLevelFillRes.className = 'level-fill level-medium'; }
         else { cvLevelFillRes.className = 'level-fill level-high'; }

         if (!isDataValid) {
            cvMainLevelValue.textContent = '--%';
            cvResLevelValue.textContent = '--%';
            cvLevelPercentageMain.textContent = '--%';
            cvLevelPercentageRes.textContent = '--%';
         }
    }

    function updateClientViewPumpControls(controlData) {
        cvMotorStatus.textContent = controlData.statusBomba || '--';
        cvPumpStatusValue.textContent = controlData.statusBomba === 'LIGADA' ? 'ON' : 'OFF';
         cvPumpStatusText.textContent = controlData.statusBomba ? `A bomba está ${controlData.statusBomba}.` : 'Aguardando...';
        cvPumpStatusIcon.className = 'card-icon ' + (controlData.statusBomba === 'LIGADA' ? 'icon-green' : 'icon-red');

        cvModeValue.textContent = controlData.modo === 'automatico' ? 'AUTO' : (controlData.modo === 'manual' ? 'MAN' : '--');
        cvModeText.textContent = controlData.modo ? `Operando em modo ${controlData.modo}.` : 'Aguardando...';
         cvModeIcon.className = 'card-icon ' + (controlData.modo === 'automatico' ? 'icon-green' : (controlData.modo === 'manual' ? 'icon-orange' : ''));

        cvAutoModeStatus.textContent = controlData.modo === 'automatico' ? 'ATIVADO' : 'DESATIVADO';
        cvFeriasStatus.textContent = controlData.modoOperacao === 'ferias' ? 'ATIVADO' : 'DESATIVADO';

         if (controlData.statusBomba === 'LIGADA') {
             cvMotorStatus.className = 'status-indicator-on';
         } else {
             cvMotorStatus.className = 'status-indicator-off';
         }
    }

    // Função para calcular consumo médio (copiada e adaptada)
    function calculateAverageConsumption(historyData) {
        if (!historyData) {
            cvConsumptionValue.textContent = '--';
            cvConsumptionText.textContent = 'Calculando...';
            return;
        }
        const entries = Object.values(historyData).sort((a, b) => a.timestamp - b.timestamp);
        if (entries.length < 2) {
             cvConsumptionValue.textContent = '0 L/dia';
             cvConsumptionText.textContent = 'Dados insuficientes.';
            return;
        }
        const consumptionByDay = {};
        for (let i = 1; i < entries.length; i++) {
            const prev = entries[i-1];
            const curr = entries[i];
            if (curr.nivel > prev.nivel) continue;
            const date = new Date(curr.timestamp).toLocaleDateString('pt-BR');
            consumptionByDay[date] = (consumptionByDay[date] || 0) + (prev.nivel - curr.nivel);
        }
        const dailyConsumptions = Object.values(consumptionByDay);
        if (dailyConsumptions.length === 0) {
            cvConsumptionValue.textContent = '0 L/dia';
            cvConsumptionText.textContent = 'Sem consumo.';
            return;
        }
        const totalPercentageDropped = dailyConsumptions.reduce((sum, val) => sum + val, 0);
        const averagePercentageDropped = totalPercentageDropped / dailyConsumptions.length;
        const averageLitersConsumed = (totalVolumeLiters * (averagePercentageDropped / 100)).toFixed(1);
        cvConsumptionValue.textContent = `${averageLitersConsumed} L/dia`;
        cvConsumptionText.textContent = `Méd. últimos ${dailyConsumptions.length} dias.`;
    }

}); // Fim do DOMContentLoaded

// Funções de Gerenciar Usuário REMOVIDAS
