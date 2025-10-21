// ===================================================================
//   AQUAMONITOR - SCRIPT DO DASHBOARD DO CLIENTE (dashboard.js)
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Dashboard script starting...");

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
    const logoutButton = document.querySelector('.logout-button');
    const mainLevelValue = document.getElementById('main-level-value');
    const mainLevelLiters = document.getElementById('main-level-liters');
    const levelFillMain = document.getElementById('level-fill-main');
    const levelPercentageMain = document.getElementById('level-percentage-main');
    const clientWaterMain = document.getElementById('client-water-main');
    const clientLevelPercentMain = document.getElementById('client-level-percent-main');
    const resLevelValue = document.getElementById('res-level-value');
    const resLevelLiters = document.getElementById('res-level-liters');
    const levelFillRes = document.getElementById('level-fill-res');
    const levelPercentageRes = document.getElementById('level-percentage-res');
    const clientWaterRes = document.getElementById('client-water-res');
    const clientLevelPercentRes = document.getElementById('client-level-percent-res');
    const consumptionValue = document.getElementById('consumption-value');
    const consumptionText = document.getElementById('consumption-text');
    const autoModeSwitch = document.getElementById('auto-mode-switch');
    const motorButton = document.getElementById('motor-button');
    const motorStatus = document.getElementById('motor-status');
    const pumpStatusIcon = document.getElementById('pump-status-icon');
    const pumpStatusValue = document.getElementById('pump-status-value');
    const pumpStatusText = document.getElementById('pump-status-text');
    const modeIcon = document.getElementById('mode-icon');
    const modeValue = document.getElementById('mode-value');
    const modeText = document.getElementById('mode-text');
    const btnFerias = document.getElementById('btn-ferias');
    const feriasInfo = document.getElementById('ferias-info');
    const ctx = document.getElementById('levelChart').getContext('2d');

    // --- VARIÁVEIS GLOBAIS ---
    const totalVolumeLiters = 1.728;
    let listenersAttached = false; // Para garantir que listeners são adicionados só uma vez

    // --- REFERÊNCIAS AOS DADOS NO FIREBASE ---
    const sensorDataRef = database.ref('sensorData');
    const controlRef = database.ref('bomba/controle');
    const historyRef = database.ref('historico').orderByChild('timestamp').limitToLast(100);

    // --- CONFIGURAÇÃO E INICIALIZAÇÃO DO GRÁFICO ---
    const levelChart = new Chart(ctx, {
        type: 'line', data: { labels: [], datasets: [{ label: 'Nível Caixa Principal (%)', data: [], borderColor: '#2e7d32', backgroundColor: 'rgba(46, 125, 50, 0.1)', fill: true, tension: 0.2 }] },
        options: { scales: { y: { beginAtZero: true, max: 100 } }, animation: { duration: 0 } }
     });

    // --- VERIFICAÇÃO DE AUTENTICAÇÃO ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : 'null');
        if (user) {
             // Só adiciona listeners Firebase se o utilizador estiver autenticado e se ainda não foram adicionados
             if (!listenersAttached) {
                 console.log("User authenticated, attaching listeners...");
                 attachFirebaseListeners(); // Adiciona listeners do Firebase
                 attachButtonListeners();   // Adiciona listeners dos botões do cliente
                 listenersAttached = true;
             }
        } else {
            console.log("No user logged in, redirecting to login.");
            window.location.href = 'login.html';
        }
    });


    // --- Função para Adicionar Listeners do Firebase ---
    function attachFirebaseListeners() {
        console.log("Attaching Firebase listeners...");

        historyRef.on('value', snapshot => {
            console.log("Dashboard history data received:", snapshot.val() ? snapshot.numChildren() + " entries" : "null");
            const data = snapshot.val();
            const labels = [];
            const levels = [];

            if (data) {
                const sortedEntries = Object.values(data)
                                        .filter(entry => typeof entry === 'object' && entry !== null && typeof entry.timestamp === 'number' && typeof entry.nivel === 'number')
                                        .sort((a, b) => a.timestamp - b.timestamp);

                console.log("Sorted history entries:", sortedEntries.length);

                sortedEntries.forEach(entry => {
                    const date = new Date(entry.timestamp);
                    const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    labels.push(timeString);
                    levels.push(entry.nivel);
                });

                calculateAverageConsumption(data);

            } else {
                 console.warn("History data is null or empty.");
                 consumptionValue.textContent = '--';
                 consumptionText.textContent = 'Sem histórico.';
            }

            levelChart.data.labels = labels;
            levelChart.data.datasets[0].data = levels;
            try {
                levelChart.update();
                console.log("Chart updated successfully.");
            } catch (e) {
                console.error("Error updating chart:", e);
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
            console.log("Sensor data received:", snapshot.val());
            const data = snapshot.val();
            if (data && data.level !== undefined && data.levelReservatorio !== undefined) {
                updateDashboardUI(data.level, data.levelReservatorio);
            } else {
                 console.warn("Sensor data incomplete or missing.");
                 updateDashboardUI('--', '--');
            }
        }, error => {
            console.error("Error fetching sensor data:", error);
            updateDashboardUI('--', '--');
        });


        controlRef.on('value', snapshot => {
             console.log("Control data received:", snapshot.val());
            const data = snapshot.val();
            updatePumpControlsUI(data || {});
        }, error => {
             console.error("Error fetching control data:", error);
             updatePumpControlsUI({});
        });

        console.log("Firebase listeners attached.");
    }


    // --- Função para Adicionar Listeners dos Botões do Cliente ---
    function attachButtonListeners() {
        console.log("Attaching client button listeners...");

        logoutButton.onclick = (e) => {
            e.preventDefault();
            auth.signOut().then(() => { window.location.href = 'login.html'; });
        };

        btnFerias.onclick = () => {
            console.log("Botão Férias clicado");
            const isFerias = btnFerias.classList.contains('ferias');
            const newMode = isFerias ? 'normal' : 'ferias';
            controlRef.update({ modoOperacao: newMode })
                .catch(error => {
                    console.error("Erro ao atualizar modo férias:", error);
                    alert("Erro ao tentar mudar o modo Férias.");
                });
        };

        autoModeSwitch.onchange = () => {
            console.log("Switch Auto/Manual mudou:", autoModeSwitch.checked);
            const newMode = autoModeSwitch.checked ? 'automatico' : 'manual';
            controlRef.update({ modo: newMode })
             .catch(error => {
                console.error("Erro ao atualizar modo:", error);
                alert("Erro ao tentar mudar o modo.");
                autoModeSwitch.checked = !autoModeSwitch.checked; // Reverte
             });
        };

        motorButton.onclick = () => {
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
        };
        console.log("Client button listeners attached.");
    }

    // --- LÓGICA DAS NOVAS FUNCIONALIDADES ---
    function calculateAverageConsumption(historyData) { /* ... (código inalterado da resposta anterior) ... */ }

    // --- FUNÇÕES DE ATUALIZAÇÃO DA INTERFACE ---
    function updateDashboardUI(levelMain, levelRes) { /* ... (código inalterado da resposta anterior) ... */ }
    function updatePumpControlsUI(data) { /* ... (código inalterado e CORRIGIDO da resposta anterior) ... */ }

}); // Fim do DOMContentLoaded
