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
    // Caixa Principal
    const mainLevelValue = document.getElementById('main-level-value');
    const mainLevelLiters = document.getElementById('main-level-liters');
    const levelFillMain = document.getElementById('level-fill-main');
    const levelPercentageMain = document.getElementById('level-percentage-main');
    const clientWaterMain = document.getElementById('client-water-main'); // Visualização
    const clientLevelPercentMain = document.getElementById('client-level-percent-main'); // Label Visualização

    // Reservatório
    const resLevelValue = document.getElementById('res-level-value');
    const resLevelLiters = document.getElementById('res-level-liters');
    const levelFillRes = document.getElementById('level-fill-res');
    const levelPercentageRes = document.getElementById('level-percentage-res');
    const clientWaterRes = document.getElementById('client-water-res'); // Visualização
    const clientLevelPercentRes = document.getElementById('client-level-percent-res'); // Label Visualização

    // Outros
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

    // Modo Férias
    const btnFerias = document.getElementById('btn-ferias');
    const feriasInfo = document.getElementById('ferias-info');


    // --- REFERÊNCIAS AOS DADOS NO FIREBASE ---
    const sensorDataRef = database.ref('sensorData');
    const controlRef = database.ref('bomba/controle');
    const historyRef = database.ref('historico').orderByChild('timestamp').limitToLast(100);

    // --- CONFIGURAÇÃO E INICIALIZAÇÃO DO GRÁFICO ---
    const ctx = document.getElementById('levelChart').getContext('2d');
    const levelChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Nível Caixa Principal (%)',
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
        console.log("Dashboard history data received:", snapshot.val()); // DEBUG
        const data = snapshot.val();
        const labels = [];
        const levels = [];

        if (data) {
            const sortedEntries = Object.values(data)
                                    .filter(entry => typeof entry === 'object' && entry !== null && typeof entry.timestamp === 'number' && typeof entry.nivel === 'number')
                                    .sort((a, b) => a.timestamp - b.timestamp);

            console.log("Sorted history entries:", sortedEntries.length); // DEBUG

            sortedEntries.forEach(entry => {
                const date = new Date(entry.timestamp);
                const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                labels.push(timeString);
                levels.push(entry.nivel);
            });

            calculateAverageConsumption(data);

        } else {
             console.warn("History data is null or empty."); // DEBUG
             consumptionValue.textContent = '--';
             consumptionText.textContent = 'Sem histórico.';
        }

        levelChart.data.labels = labels;
        levelChart.data.datasets[0].data = levels;
        try {
            levelChart.update();
            console.log("Chart updated successfully."); // DEBUG
        } catch (e) {
            console.error("Error updating chart:", e); // DEBUG
        }

    }, error => { // DEBUG: Tratamento de erro
        console.error("Error fetching history data:", error);
        levelChart.data.labels = [];
        levelChart.data.datasets[0].data = [];
        levelChart.update();
        consumptionValue.textContent = 'Erro';
        consumptionText.textContent = 'Falha ao carregar histórico.';
    });


    sensorDataRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data && data.level !== undefined && data.levelReservatorio !== undefined) {
            updateDashboardUI(data.level, data.levelReservatorio);
        } else {
             updateDashboardUI('--', '--');
        }
    }, error => { // DEBUG
        console.error("Error fetching sensor data:", error);
        updateDashboardUI('--', '--'); // Limpa UI em caso de erro
    });


    controlRef.on('value', snapshot => {
        const data = snapshot.val();
        updatePumpControlsUI(data || {});
    }, error => { // DEBUG
         console.error("Error fetching control data:", error);
         updatePumpControlsUI({}); // Limpa UI em caso de erro
    });


    // --- LÓGICA DAS NOVAS FUNCIONALIDADES ---

    function calculateAverageConsumption(historyData) {
        if (!historyData) {
            consumptionValue.textContent = '--';
            consumptionText.textContent = 'Calculando...';
            return;
        }
        const entries = Object.values(historyData)
                        .filter(entry => typeof entry === 'object' && entry !== null && typeof entry.timestamp === 'number' && typeof entry.nivel === 'number')
                        .sort((a, b) => a.timestamp - b.timestamp);
        if (entries.length < 2) {
             consumptionValue.textContent = '0 L/dia';
             consumptionText.textContent = 'Dados insuficientes.';
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
            consumptionValue.textContent = '0 L/dia';
            consumptionText.textContent = 'Sem consumo registado.';
            return;
        }

        const totalPercentageDropped = dailyConsumptions.reduce((sum, val) => sum + val, 0);
        const averagePercentageDropped = totalPercentageDropped / dailyConsumptions.length;
        const averageLitersConsumed = (totalVolumeLiters * (averagePercentageDropped / 100)).toFixed(1);

        consumptionValue.textContent = `${averageLitersConsumed} L/dia`;
        consumptionText.textContent = `Méd. últimos ${dailyConsumptions.length} dias.`;
    }


    btnFerias.addEventListener('click', () => {
        console.log("Botão Férias clicado"); // DEBUG
        const isFerias = btnFerias.classList.contains('ferias');
        const newMode = isFerias ? 'normal' : 'ferias';
        controlRef.update({ modoOperacao: newMode })
            .catch(error => { // DEBUG: Adiciona tratamento de erro
                console.error("Erro ao atualizar modo férias:", error);
                alert("Erro ao tentar mudar o modo Férias.");
            });
    });


    // --- FUNÇÕES DE ATUALIZAÇÃO DA INTERFACE ---

    function updateDashboardUI(levelMain, levelRes) {
        const isDataValid = typeof levelMain === 'number' && typeof levelRes === 'number'; // Verifica se são números

        // --- Caixa Principal ---
        const currentLitersMain = isDataValid ? (totalVolumeLiters * (levelMain / 100)).toFixed(1) : '--';
        mainLevelValue.textContent = `${levelMain}%`;
        mainLevelLiters.textContent = isDataValid ? `${currentLitersMain} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
        levelFillMain.style.width = isDataValid ? levelMain + '%' : '0%';
        levelPercentageMain.textContent = `${levelMain}%`;
        clientWaterMain.style.height = isDataValid ? levelMain + '%' : '0%';
        clientLevelPercentMain.textContent = levelMain;

        if (!isDataValid) {
            levelFillMain.className = 'level-fill'; // Cor padrão se inválido
            mainLevelValue.textContent = '--%';
            levelPercentageMain.textContent = '--%';
            clientLevelPercentMain.textContent = '--';
        } else if (levelMain <= 50) {
            levelFillMain.className = 'level-fill level-low';
        } else if (levelMain < 95) {
            levelFillMain.className = 'level-fill level-medium';
        } else {
            levelFillMain.className = 'level-fill level-high';
        }


        // --- Reservatório ---
        const currentLitersRes = isDataValid ? (totalVolumeLiters * (levelRes / 100)).toFixed(1) : '--';
        resLevelValue.textContent = `${levelRes}%`;
        resLevelLiters.textContent = isDataValid ? `${currentLitersRes} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
        levelFillRes.style.width = isDataValid ? levelRes + '%' : '0%';
        levelPercentageRes.textContent = `${levelRes}%`;
        clientWaterRes.style.height = isDataValid ? levelRes + '%' : '0%';
        clientLevelPercentRes.textContent = levelRes;

        if (!isDataValid) {
            levelFillRes.className = 'level-fill';
             resLevelValue.textContent = '--%';
             levelPercentageRes.textContent = '--%';
             clientLevelPercentRes.textContent = '--';
        } else if (levelRes <= 50) {
             levelFillRes.className = 'level-fill level-low';
        } else if (levelRes < 95) {
             levelFillRes.className = 'level-fill level-medium';
        } else {
             levelFillRes.className = 'level-fill level-high';
        }
    }


    function updatePumpControlsUI(data) {
        // Atualiza Cards
        motorStatus.textContent = data.statusBomba || '--';
        pumpStatusValue.textContent = data.statusBomba === 'LIGADA' ? 'ON' : (data.statusBomba === 'DESLIGADA' ? 'OFF' : '--');
        pumpStatusText.textContent = data.statusBomba ? `A bomba está ${data.statusBomba}.` : 'Aguardando...';
        pumpStatusIcon.className = 'card-icon ' + (data.statusBomba === 'LIGADA' ? 'icon-green' : 'icon-red');

        modeValue.textContent = data.modo === 'automatico' ? 'AUTO' : (data.modo === 'manual' ? 'MAN' : '--');
        modeText.textContent = data.modo ? `Operando em modo ${data.modo}.` : 'Aguardando...';
        modeIcon.className = 'card-icon ' + (data.modo === 'automatico' ? 'icon-green' : (data.modo === 'manual' ? 'icon-orange' : ''));


        // Atualiza Controles (botão manual, switch automático)
        if (data.statusBomba === 'LIGADA') {
            motorStatus.className = 'status-indicator-on';
            motorButton.textContent = 'Desligar Bomba';
            motorButton.className = 'btn-motor-on';
        } else {
            motorStatus.className = 'status-indicator-off';
            motorButton.textContent = 'Ligar Bomba';
            motorButton.className = 'btn-motor-off';
        }

        // --- Correção Lógica Botão Manual ---
        // O botão manual SÓ deve estar ativo se o modo for 'manual'
        if (data.modo === 'manual') {
             autoModeSwitch.checked = false;
             motorButton.disabled = false; // Habilita o botão
        } else {
            // Se modo for 'automatico' OU indefinido, desabilita o botão manual
             autoModeSwitch.checked = (data.modo === 'automatico'); // Marca se for auto
             motorButton.disabled = true; // Desabilita o botão
        }

        // Atualiza Botão Modo Férias
        if (data.modoOperacao === 'ferias') {
            btnFerias.textContent = 'Desativar Modo Férias';
            btnFerias.className = 'ferias';
            feriasInfo.innerHTML = '<b>Modo Férias ATIVADO:</b> Limites econômicos em uso.';
        } else {
            btnFerias.textContent = 'Ativar Modo Férias';
            btnFerias.className = 'normal';
            feriasInfo.innerHTML = '<b>Modo Férias:</b> Usa limites de 15% a 50% para economizar.';
        }
    }


    // Event listener para o switch de modo Automático/Manual
    autoModeSwitch.addEventListener('change', () => {
        console.log("Switch Auto/Manual mudou:", autoModeSwitch.checked); // DEBUG
        const newMode = autoModeSwitch.checked ? 'automatico' : 'manual';
        controlRef.update({ modo: newMode })
         .catch(error => { // DEBUG
            console.error("Erro ao atualizar modo:", error);
            alert("Erro ao tentar mudar o modo.");
            // Reverte o switch visualmente em caso de erro
            autoModeSwitch.checked = !autoModeSwitch.checked;
         });
    });

    // Event listener para o botão de controle Manual
    motorButton.addEventListener('click', () => {
        // Verifica se o botão não está desabilitado antes de enviar
        if(motorButton.disabled) {
            console.warn("Botão manual clicado enquanto desabilitado."); // DEBUG
            return;
        }
        console.log("Botão Manual clicado. Comando:", motorButton.textContent); // DEBUG
        const newCommand = motorButton.textContent.includes('Ligar') ? 'LIGAR' : 'DESLIGAR';
        controlRef.update({ comandoManual: newCommand })
         .catch(error => { // DEBUG
            console.error("Erro ao enviar comando manual:", error);
            alert("Erro ao enviar comando para a bomba.");
         });
    });

}); // Fim do DOMContentLoaded
