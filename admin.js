// ===================================================================
//   AQUAMONITOR - SCRIPT DO DASHBOARD DO CLIENTE (dashboard.js)
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Dashboard script starting..."); // DEBUG

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

    // --- VERIFICAÇÃO DE AUTENTICAÇÃO E LOGOUT ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : 'null'); // DEBUG
        if (!user) {
            console.log("No user logged in, redirecting to login."); // DEBUG
            window.location.href = 'login.html';
        }
        // Não precisamos carregar settings do usuário aqui
    });

    // --- Referências DOM --- (Obtidas cedo)
    const logoutButton = document.querySelector('.logout-button');
    // Caixa Principal
    const mainLevelValue = document.getElementById('main-level-value');
    const mainLevelLiters = document.getElementById('main-level-liters');
    const levelFillMain = document.getElementById('level-fill-main');
    const levelPercentageMain = document.getElementById('level-percentage-main');
    const clientWaterMain = document.getElementById('client-water-main');
    const clientLevelPercentMain = document.getElementById('client-level-percent-main');
    // Reservatório
    const resLevelValue = document.getElementById('res-level-value');
    const resLevelLiters = document.getElementById('res-level-liters');
    const levelFillRes = document.getElementById('level-fill-res');
    const levelPercentageRes = document.getElementById('level-percentage-res');
    const clientWaterRes = document.getElementById('client-water-res');
    const clientLevelPercentRes = document.getElementById('client-level-percent-res');
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
    // Gráfico
    const ctx = document.getElementById('levelChart').getContext('2d');


    // --- VARIÁVEIS GLOBAIS ---
    const totalVolumeLiters = 1.728; // Volume fixo

    // --- REFERÊNCIAS AOS DADOS NO FIREBASE ---
    const sensorDataRef = database.ref('sensorData');
    const controlRef = database.ref('bomba/controle');
    const historyRef = database.ref('historico').orderByChild('timestamp').limitToLast(100);

    // --- CONFIGURAÇÃO E INICIALIZAÇÃO DO GRÁFICO ---
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
            },
            animation: { // Desativa animação para evitar problemas visuais iniciais
                duration: 0
            }
        }
     });

    // --- OUVINTES (LISTENERS) DE DADOS DO FIREBASE ---
    console.log("Attaching Firebase listeners..."); //DEBUG

    historyRef.on('value', snapshot => {
        console.log("Dashboard history data received:", snapshot.val() ? snapshot.numChildren() + " entries" : "null"); // DEBUG
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

        // Atualiza os dados do gráfico SEMPRE
        levelChart.data.labels = labels;
        levelChart.data.datasets[0].data = levels;
        try {
            levelChart.update();
            console.log("Chart updated successfully."); // DEBUG
        } catch (e) {
            console.error("Error updating chart:", e); // DEBUG
        }

    }, error => {
        console.error("Error fetching history data:", error);
        levelChart.data.labels = [];
        levelChart.data.datasets[0].data = [];
        levelChart.update();
        consumptionValue.textContent = 'Erro';
        consumptionText.textContent = 'Falha ao carregar histórico.';
    });


    sensorDataRef.on('value', snapshot => {
        console.log("Sensor data received:", snapshot.val()); // DEBUG
        const data = snapshot.val();
        if (data && data.level !== undefined && data.levelReservatorio !== undefined) {
            updateDashboardUI(data.level, data.levelReservatorio);
        } else {
             console.warn("Sensor data incomplete or missing."); // DEBUG
             updateDashboardUI('--', '--');
        }
    }, error => {
        console.error("Error fetching sensor data:", error);
        updateDashboardUI('--', '--');
    });


    controlRef.on('value', snapshot => {
         console.log("Control data received:", snapshot.val()); // DEBUG
        const data = snapshot.val();
        updatePumpControlsUI(data || {});
    }, error => {
         console.error("Error fetching control data:", error);
         updatePumpControlsUI({});
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


    // --- AÇÕES DOS BOTÕES ---
    console.log("Attaching button listeners..."); // DEBUG

    logoutButton.addEventListener('click', e => {
        e.preventDefault();
        auth.signOut().then(() => { window.location.href = 'login.html'; });
    });

    btnFerias.addEventListener('click', () => {
        console.log("Botão Férias clicado");
        const isFerias = btnFerias.classList.contains('ferias');
        const newMode = isFerias ? 'normal' : 'ferias';
        controlRef.update({ modoOperacao: newMode })
            .catch(error => {
                console.error("Erro ao atualizar modo férias:", error);
                alert("Erro ao tentar mudar o modo Férias.");
            });
    });

    autoModeSwitch.addEventListener('change', () => {
        console.log("Switch Auto/Manual mudou:", autoModeSwitch.checked);
        const newMode = autoModeSwitch.checked ? 'automatico' : 'manual';
        controlRef.update({ modo: newMode })
         .catch(error => {
            console.error("Erro ao atualizar modo:", error);
            alert("Erro ao tentar mudar o modo.");
            autoModeSwitch.checked = !autoModeSwitch.checked;
         });
    });

    motorButton.addEventListener('click', () => {
        if(motorButton.disabled) {
            console.warn("Botão manual clicado enquanto desabilitado.");
            return;
        }
        console.log("Botão Manual clicado. Comando:", motorButton.textContent);
        const newCommand = motorButton.textContent.includes('Ligar') ? 'LIGAR' : 'DESLIGAR';
        controlRef.update({ comandoManual: newCommand })
         .catch(error => {
            console.error("Erro ao enviar comando manual:", error);
            alert("Erro ao enviar comando para a bomba.");
         });
    });
    console.log("Button listeners attached."); // DEBUG


    // --- FUNÇÕES DE ATUALIZAÇÃO DA INTERFACE ---

    function updateDashboardUI(levelMain, levelRes) {
        const isDataValid = typeof levelMain === 'number' && typeof levelRes === 'number';

        // --- Caixa Principal ---
        const currentLitersMain = isDataValid ? (totalVolumeLiters * (levelMain / 100)).toFixed(1) : '--';
        mainLevelValue.textContent = isDataValid ? `${levelMain}%` : '--%';
        mainLevelLiters.textContent = isDataValid ? `${currentLitersMain} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
        levelFillMain.style.width = isDataValid ? levelMain + '%' : '0%';
        levelPercentageMain.textContent = isDataValid ? `${levelMain}%` : '--%';
        clientWaterMain.style.height = isDataValid ? levelMain + '%' : '0%';
        clientLevelPercentMain.textContent = isDataValid ? levelMain : '--';

        if (!isDataValid) {
            levelFillMain.className = 'level-fill';
        } else if (levelMain <= 50) {
            levelFillMain.className = 'level-fill level-low';
        } else if (levelMain < 95) {
            levelFillMain.className = 'level-fill level-medium';
        } else {
            levelFillMain.className = 'level-fill level-high';
        }

        // --- Reservatório ---
        const currentLitersRes = isDataValid ? (totalVolumeLiters * (levelRes / 100)).toFixed(1) : '--';
        resLevelValue.textContent = isDataValid ? `${levelRes}%` : '--%';
        resLevelLiters.textContent = isDataValid ? `${currentLitersRes} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
        levelFillRes.style.width = isDataValid ? levelRes + '%' : '0%';
        levelPercentageRes.textContent = isDataValid ? `${levelRes}%` : '--%';
        clientWaterRes.style.height = isDataValid ? levelRes + '%' : '0%';
        clientLevelPercentRes.textContent = isDataValid ? levelRes : '--';

        if (!isDataValid) {
            levelFillRes.className = 'level-fill';
        } else if (levelRes <= 50) {
             levelFillRes.className = 'level-fill level-low';
        } else if (levelRes < 95) {
             levelFillRes.className = 'level-fill level-medium';
        } else {
             levelFillRes.className = 'level-fill level-high';
        }
    }


    function updatePumpControlsUI(data) {
        // Assume defaults seguros se data for vazio ou incompleto
        const statusBomba = data.statusBomba || '--';
        const modo = data.modo || '--';
        const modoOp = data.modoOperacao || 'normal';

        // Atualiza Cards
        motorStatus.textContent = statusBomba;
        pumpStatusValue.textContent = statusBomba === 'LIGADA' ? 'ON' : (statusBomba === 'DESLIGADA' ? 'OFF' : '--');
        pumpStatusText.textContent = statusBomba !== '--' ? `A bomba está ${statusBomba}.` : 'Aguardando...';
        pumpStatusIcon.className = 'card-icon ' + (statusBomba === 'LIGADA' ? 'icon-green' : 'icon-red');

        modeValue.textContent = modo === 'automatico' ? 'AUTO' : (modo === 'manual' ? 'MAN' : '--');
        modeText.textContent = modo !== '--' ? `Operando em modo ${modo}.` : 'Aguardando...';
        modeIcon.className = 'card-icon ' + (modo === 'automatico' ? 'icon-green' : (modo === 'manual' ? 'icon-orange' : ''));

        // Atualiza Controles
        if (statusBomba === 'LIGADA') {
            motorStatus.className = 'status-indicator-on';
            motorButton.textContent = 'Desligar Bomba';
            motorButton.className = 'btn-motor-on';
        } else {
            motorStatus.className = 'status-indicator-off';
            motorButton.textContent = 'Ligar Bomba';
            motorButton.className = 'btn-motor-off';
        }

        // Habilita/Desabilita botão manual e ajusta switch
        if (modo === 'automatico') {
            autoModeSwitch.checked = true;
            motorButton.disabled = true;
            console.log("Modo Automático: Botão manual DESABILITADO."); // DEBUG
        } else {
            autoModeSwitch.checked = false; // Desmarcado se manual ou indefinido
            motorButton.disabled = false; // Habilita se manual ou indefinido
             console.log(`Modo ${modo}: Botão manual HABILITADO.`); // DEBUG
        }

        // Atualiza Botão Modo Férias (sempre habilitado)
        if (modoOp === 'ferias') {
            btnFerias.textContent = 'Desativar Modo Férias';
            btnFerias.className = 'ferias';
            feriasInfo.innerHTML = '<b>Modo Férias ATIVADO:</b> Limites econômicos em uso.';
        } else {
            btnFerias.textContent = 'Ativar Modo Férias';
            btnFerias.className = 'normal';
            feriasInfo.innerHTML = '<b>Modo Férias:</b> Usa limites de 15% a 50% para economizar.';
        }
         btnFerias.disabled = false; // Garante que nunca fica desabilitado
    }

}); // Fim do DOMContentLoaded
