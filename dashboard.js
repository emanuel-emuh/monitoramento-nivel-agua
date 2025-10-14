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
    });

    document.querySelector('.logout-button').addEventListener('click', e => {
        e.preventDefault();
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    });

    // --- REFERÊNCIAS AOS ELEMENTOS DO DOM (HTML) ---
    const levelFill = document.getElementById('level-fill');
    const levelPercentage = document.getElementById('level-percentage');
    const levelCardValue = document.getElementById('level-card-value');
    const levelCardText = document.getElementById('level-card-text');
    const levelCardIcon = document.getElementById('level-card-icon');
    const autoModeSwitch = document.getElementById('auto-mode-switch');
    const motorButton = document.getElementById('motor-button');
    const motorStatus = document.getElementById('motor-status');
    const pumpStatusIcon = document.getElementById('pump-status-icon');
    const pumpStatusValue = document.getElementById('pump-status-value');
    const pumpStatusText = document.getElementById('pump-status-text');
    const modeIcon = document.getElementById('mode-icon');
    const modeValue = document.getElementById('mode-value');
    const modeText = document.getElementById('mode-text');

    // --- REFERÊNCIAS AOS DADOS NO FIREBASE ---
    const levelRef = database.ref('sensorData/level');
    const controlRef = database.ref('bomba/controle');
    const historyRef = database.ref('historico').orderByChild('timestamp').limitToLast(30);

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

    // Listener para o histórico de nível (alimenta o gráfico)
    historyRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            const labels = [];
            const levels = [];
            for (const key in data) {
                const entry = data[key];
                const date = new Date(entry.timestamp);
                const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                labels.push(timeString);
                levels.push(entry.nivel);
            }
            levelChart.data.labels = labels;
            levelChart.data.datasets[0].data = levels;
            levelChart.update();
        }
    });

    // Listener para o nível atual do sensor
    levelRef.on('value', snapshot => {
        const level = snapshot.val();
        if (level !== null) {
            updateDashboardUI(level);
        }
    });

    // Listener para os dados de controle da bomba
    controlRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            updatePumpControlsUI(data);
        }
    });

    // --- FUNÇÕES DE ATUALIZAÇÃO DA INTERFACE ---

    /**
     * Atualiza todos os elementos visuais relacionados ao nível da água.
     * @param {number} level - O nível atual da água em porcentagem.
     */
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
    }

    /**
     * Atualiza os elementos visuais relacionados ao status e controle da bomba.
     * @param {object} data - O objeto com os dados de controle (statusBomba, modo).
     */
    function updatePumpControlsUI(data) {
        // Card e display de status da bomba
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

        // Card e display de modo de operação
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
    }

    // --- EVENTOS DE CONTROLE DO USUÁRIO ---

    // Evento para a troca de modo (Automático/Manual)
    autoModeSwitch.addEventListener('change', () => {
        const newMode = autoModeSwitch.checked ? 'automatico' : 'manual';
        controlRef.update({ modo: newMode });
    });

    // Evento para o clique no botão de controle manual
    motorButton.addEventListener('click', () => {
        const newCommand = motorButton.textContent.includes('Ligar') ? 'LIGAR' : 'DESLIGAR';
        controlRef.update({ comandoManual: newCommand });
    });
});
