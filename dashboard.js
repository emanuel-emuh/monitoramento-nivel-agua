// ===================================================================
//   AQUAMONITOR - SCRIPT DO DASHBOARD DO CLIENTE (dashboard.js)
// ===================================================================

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

    // --- VERIFICAÇÃO DE AUTENTICAÇÃO E LOGOUT ---
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'login.html';
        } 
        // Não precisamos mais carregar as configurações do usuário
    });

    document.querySelector('.logout-button').addEventListener('click', e => {
        e.preventDefault();
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    });

    // --- VARIÁVEIS GLOBAIS ---
    // ATUALIZADO: Volume fixo para o protótipo (12x12x12 cm = 1.728 Litros)
    const totalVolumeLiters = 1.728;

    // --- REFERÊNCIAS AOS ELEMENTOS DO DOM (HTML) ---
    // Dashboard
    const levelFill = document.getElementById('level-fill');
    const levelPercentage = document.getElementById('level-percentage');
    const levelCardValue = document.getElementById('level-card-value');
    const levelCardText = document.getElementById('level-card-text');
    const levelCardIcon = document.getElementById('level-card-icon');
    const volumeLitersValue = document.getElementById('volume-liters-value');
    const volumeLitersText = document.getElementById('volume-liters-text');
    const consumptionValue = document.getElementById('consumption-value');
    const consumptionText = document.getElementById('consumption-text');

    // Controles da Bomba
    const autoModeSwitch = document.getElementById('auto-mode-switch');
    const motorButton = document.getElementById('motor-button');
    const motorStatus = document.getElementById('motor-status');
    const pumpStatusIcon = document.getElementById('pump-status-icon');
    const pumpStatusValue = document.getElementById('pump-status-value');
    const pumpStatusText = document.getElementById('pump-status-text');
    const modeIcon = document.getElementById('mode-icon');
    const modeValue = document.getElementById('mode-value');
    const modeText = document.getElementById('mode-text');

    // Configurações da Caixa (REMOVIDAS)

    // Modo Férias
    const btnFerias = document.getElementById('btn-ferias');
    const feriasInfo = document.getElementById('ferias-info');


    // --- REFERÊNCIAS AOS DADOS NO FIREBASE ---
    const levelRef = database.ref('sensorData/level');
    const controlRef = database.ref('bomba/controle');
    const historyRef = database.ref('historico').orderByChild('timestamp').limitToLast(100);

    // --- CONFIGURAÇÃO E INICIALIZAÇÃO DO GRÁFICO ---
    const ctx = document.getElementById('levelChart').getContext('2d');
    const levelChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Nível da Água (%)',
                data: [],
                borderColor: '#2e7d32',
                backgroundColor: 'rgba(46, 125, 50, 0.1)',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });

    // --- OUVINTES (LISTENERS) DE DADOS DO FIREBASE ---

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

            levelChart.data.labels = labels;
            levelChart.data.datasets[0].data = levels;
            levelChart.update();
            
            calculateAverageConsumption(data);
        }
    });

    levelRef.on('value', snapshot => {
        const level = snapshot.val();
        if (level !== null) {
            updateDashboardUI(level);
        }
    });

    controlRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            updatePumpControlsUI(data);
        }
    });

    // --- LÓGICA DAS NOVAS FUNCIONALIDADES ---

    // FUNÇÕES DE CONFIGURAÇÃO DE CAIXA (REMOVIDAS)
    // - loadTankSettings
    // - saveTankSettingsButton.addEventListener
    // - toggleDimensionFields
    // - updateTankSettingsForm
    // - calculateTotalVolume

    // Calcula o consumo médio diário em litros
    function calculateAverageConsumption(historyData) {
        // ATUALIZADO: O volume total é fixo, já não precisamos de verificar se é 0
        if (!historyData) {
            consumptionValue.textContent = '--';
            consumptionText.textContent = 'Calculando...';
            return;
        }

        const entries = Object.values(historyData).sort((a, b) => a.timestamp - b.timestamp);
        if (entries.length < 2) return;
        
        const consumptionByDay = {};

        for (let i = 1; i < entries.length; i++) {
            const prev = entries[i-1];
            const curr = entries[i];
            
            if (curr.nivel > prev.nivel) continue;

            const date = new Date(curr.timestamp).toLocaleDateString('pt-BR');
            if (!consumptionByDay[date]) {
                consumptionByDay[date] = 0;
            }
            consumptionByDay[date] += (prev.nivel - curr.nivel);
        }

        const dailyConsumptions = Object.values(consumptionByDay);
        if (dailyConsumptions.length === 0) {
            consumptionValue.textContent = '0 L/dia';
            consumptionText.textContent = 'Sem consumo registado.';
            return;
        }

        const totalPercentageDropped = dailyConsumptions.reduce((sum, val) => sum + val, 0);
        const averagePercentageDropped = totalPercentageDropped / dailyConsumptions.length;
        const averageLitersConsumed = (totalVolumeLiters * (averagePercentageDropped / 100)).toFixed(1);
        
        consumptionValue.textContent = `${averageLitersConsumed} L/dia`;
        consumptionText.textContent = `Com base nos últimos dias.`;
    }

    // Lógica do botão Modo Férias
    btnFerias.addEventListener('click', () => {
        const isFerias = btnFerias.classList.contains('ferias');
        const newMode = isFerias ? 'normal' : 'ferias';
        controlRef.update({ modoOperacao: newMode });
    });

    // --- FUNÇÕES DE ATUALIZAÇÃO DA INTERFACE ---

    function updateDashboardUI(level) {
        levelFill.style.width = level + '%';
        levelPercentage.textContent = level + '%';
        levelCardValue.textContent = level + '%';
        
        if (level <= 50) {
            levelFill.className = 'level-fill level-low';
            levelCardIcon.className = 'card-icon icon-red';
            levelCardText.textContent = 'Nível baixo. Bomba pode ligar.';
        } else if (level < 95) {
            levelFill.className = 'level-fill level-medium';
            levelCardIcon.className = 'card-icon icon-orange';
            levelCardText.textContent = 'Nível moderado.';
        } else {
            levelFill.className = 'level-fill level-high';
            levelCardIcon.className = 'card-icon icon-green';
            levelCardText.textContent = 'Nível adequado.';
        }

        // ATUALIZADO: Mostra o volume com base no valor fixo
        const currentLiters = (totalVolumeLiters * (level / 100)).toFixed(1);
        volumeLitersValue.textContent = `${currentLiters} L`;
        volumeLitersText.textContent = `De um total de ${totalVolumeLiters.toFixed(1)} L`;
    }
    
    function updatePumpControlsUI(data) {
        motorStatus.textContent = data.statusBomba;
        pumpStatusValue.textContent = data.statusBomba === 'LIGADA' ? 'ON' : 'OFF';
        pumpStatusText.textContent = `A bomba está ${data.statusBomba}.`;

        if (data.statusBomba === 'LIGADA') {
            motorStatus.className = 'status-indicator-on';
            pumpStatusIcon.className = 'card-icon icon-green';
            motorButton.textContent = 'Desligar Bomba';
            motorButton.className = 'btn-motor-on';
        } else {
            motorStatus.className = 'status-indicator-off';
            pumpStatusIcon.className = 'card-icon icon-red';
            motorButton.textContent = 'Ligar Bomba';
            motorButton.className = 'btn-motor-off';
        }

        modeValue.textContent = data.modo === 'automatico' ? 'AUTO' : 'MAN';
        modeText.textContent = `Operando em modo ${data.modo}.`;

        if (data.modo === 'automatico') {
            autoModeSwitch.checked = true;
            motorButton.disabled = true;
            modeIcon.className = 'card-icon icon-green';
        } else {
            autoModeSwitch.checked = false;
            motorButton.disabled = false;
            modeIcon.className = 'card-icon icon-orange';
        }
        
        if (data.modoOperacao === 'ferias') {
            btnFerias.textContent = 'Desativar Modo Férias';
            btnFerias.className = 'ferias';
            feriasInfo.innerHTML = '<b>Modo Férias ATIVADO:</b> Limites de economia de energia em uso.';
        } else {
            btnFerias.textContent = 'Ativar Modo Férias';
            btnFerias.className = 'normal';
            feriasInfo.innerHTML = '<b>Modo Férias:</b> Usa limites de 15% a 50% para economizar energia durante a sua ausência.';
        }
    }
    
    autoModeSwitch.addEventListener('change', () => {
        const newMode = autoModeSwitch.checked ? 'automatico' : 'manual';
        controlRef.update({ modo: newMode });
    });

    motorButton.addEventListener('click', () => {
        const newCommand = motorButton.textContent.includes('Ligar') ? 'LIGAR' : 'DESLIGAR';
        controlRef.update({ comandoManual: newCommand });
    });
});
