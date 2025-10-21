// ===================================================================
//   AQUAMONITOR - SCRIPT DO DASHBOARD DO CLIENTE (dashboard.js)
//   VERSÃO CORRIGIDA - Lógica de botões e gráfico
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
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        } else {
            firebase.app();
        }
        console.log("Firebase initialized or retrieved.");
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        alert("Erro crítico ao inicializar a conexão. Verifique a consola.");
        return;
    }
    const auth = firebase.auth();
    const database = firebase.database();

     // --- Referências DOM ---
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
    const ctx = document.getElementById('levelChart')?.getContext('2d'); // Adiciona '?' para segurança

    // --- VARIÁVEIS GLOBAIS ---
    const totalVolumeLiters = 1.728;
    let listenersAttached = false;
    let levelChart = null; // Inicializa como null

     // --- Inicialização do Gráfico (se o canvas existir) ---
     if (ctx) {
         console.log("Canvas context found, initializing chart...");
         levelChart = new Chart(ctx, {
            type: 'line', data: { labels: [], datasets: [{ label: 'Nível Caixa Principal (%)', data: [], borderColor: '#2e7d32', backgroundColor: 'rgba(46, 125, 50, 0.1)', fill: true, tension: 0.2 }] },
            options: { scales: { y: { beginAtZero: true, max: 100 } }, animation: { duration: 0 } }
         });
     } else {
         console.error("Canvas element 'levelChart' not found or context failed.");
     }


    // --- REFERÊNCIAS AOS DADOS NO FIREBASE ---
    const sensorDataRef = database.ref('sensorData');
    const controlRef = database.ref('bomba/controle');
    const historyRef = database.ref('historico').orderByChild('timestamp').limitToLast(100);

    // --- VERIFICAÇÃO DE AUTENTICAÇÃO ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : 'null');
        if (user) {
             if (!listenersAttached) {
                 console.log("User authenticated, attaching listeners...");
                 attachFirebaseListeners();
                 attachButtonListeners();
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

                console.log("Sorted history entries for chart:", sortedEntries.length);

                sortedEntries.forEach(entry => {
                    const date = new Date(entry.timestamp);
                    const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    labels.push(timeString);
                    levels.push(entry.nivel);
                });

                calculateAverageConsumption(data);

            } else {
                 console.warn("History data is null or empty.");
                 if(consumptionValue) consumptionValue.textContent = '--';
                 if(consumptionText) consumptionText.textContent = 'Sem histórico.';
            }

            // Atualiza o gráfico APENAS se ele foi inicializado
            if (levelChart) {
                levelChart.data.labels = labels;
                levelChart.data.datasets[0].data = levels;
                try {
                    levelChart.update();
                    console.log("Chart updated successfully with", levels.length, "points.");
                } catch (e) {
                    console.error("Error updating chart:", e);
                }
            } else {
                 console.warn("Chart object not available for update.");
            }

        }, error => {
            console.error("Error fetching history data:", error);
            if (levelChart) {
                levelChart.data.labels = [];
                levelChart.data.datasets[0].data = [];
                levelChart.update();
            }
             if(consumptionValue) consumptionValue.textContent = 'Erro';
             if(consumptionText) consumptionText.textContent = 'Falha ao carregar histórico.';
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

        // Garante que os elementos existem antes de adicionar listeners
        if (logoutButton) {
            logoutButton.onclick = (e) => {
                e.preventDefault();
                auth.signOut().then(() => { window.location.href = 'login.html'; });
            };
        }

        if (btnFerias) {
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
        }

        if (autoModeSwitch) {
            autoModeSwitch.onchange = () => {
                console.log("Switch Auto/Manual mudou:", autoModeSwitch.checked);
                const newMode = autoModeSwitch.checked ? 'automatico' : 'manual';
                controlRef.update({ modo: newMode })
                 .catch(error => {
                    console.error("Erro ao atualizar modo:", error);
                    alert("Erro ao tentar mudar o modo.");
                    autoModeSwitch.checked = !autoModeSwitch.checked;
                 });
            };
        }

        if (motorButton) {
            motorButton.onclick = () => {
                // Verifica explicitamente se está desabilitado ANTES de enviar
                if(motorButton.disabled) {
                    console.warn("Botão manual clicado enquanto desabilitado.");
                    return; // Não faz nada se estiver desabilitado
                }
                console.log("Botão Manual clicado. Comando:", motorButton.textContent);
                const newCommand = motorButton.textContent.includes('Ligar') ? 'LIGAR' : 'DESLIGAR';
                controlRef.update({ comandoManual: newCommand })
                 .catch(error => {
                    console.error("Erro ao enviar comando manual:", error);
                    alert("Erro ao enviar comando para a bomba.");
                 });
            };
        }
        console.log("Client button listeners attached.");
    }


    // --- LÓGICA DAS NOVAS FUNCIONALIDADES ---
    function calculateAverageConsumption(historyData) {
        // Verifica se elementos existem antes de atualizar
        if (!consumptionValue || !consumptionText) return;

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


    // --- FUNÇÕES DE ATUALIZAÇÃO DA INTERFACE ---
    function updateDashboardUI(levelMain, levelRes) {
         // Verifica se todos os elementos necessários existem
         if (!mainLevelValue || !mainLevelLiters || !levelFillMain || !levelPercentageMain || !clientWaterMain || !clientLevelPercentMain ||
             !resLevelValue || !resLevelLiters || !levelFillRes || !levelPercentageRes || !clientWaterRes || !clientLevelPercentRes) {
             console.error("Um ou mais elementos da UI não foram encontrados para updateDashboardUI.");
             return;
         }

        const isDataValid = typeof levelMain === 'number' && typeof levelRes === 'number';

        const currentLitersMain = isDataValid ? (totalVolumeLiters * (levelMain / 100)).toFixed(1) : '--';
        mainLevelValue.textContent = isDataValid ? `${levelMain}%` : '--%';
        mainLevelLiters.textContent = isDataValid ? `${currentLitersMain} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
        levelFillMain.style.width = isDataValid ? levelMain + '%' : '0%';
        levelPercentageMain.textContent = isDataValid ? `${levelMain}%` : '--%';
        clientWaterMain.style.height = isDataValid ? levelMain + '%' : '0%';
        clientLevelPercentMain.textContent = isDataValid ? levelMain : '--';

        if (!isDataValid) { levelFillMain.className = 'level-fill'; }
        else if (levelMain <= 50) { levelFillMain.className = 'level-fill level-low'; }
        else if (levelMain < 95) { levelFillMain.className = 'level-fill level-medium'; }
        else { levelFillMain.className = 'level-fill level-high'; }

        const currentLitersRes = isDataValid ? (totalVolumeLiters * (levelRes / 100)).toFixed(1) : '--';
        resLevelValue.textContent = isDataValid ? `${levelRes}%` : '--%';
        resLevelLiters.textContent = isDataValid ? `${currentLitersRes} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
        levelFillRes.style.width = isDataValid ? levelRes + '%' : '0%';
        levelPercentageRes.textContent = isDataValid ? `${levelRes}%` : '--%';
        clientWaterRes.style.height = isDataValid ? levelRes + '%' : '0%';
        clientLevelPercentRes.textContent = isDataValid ? levelRes : '--';

        if (!isDataValid) { levelFillRes.className = 'level-fill'; }
        else if (levelRes <= 50) { levelFillRes.className = 'level-fill level-low'; }
        else if (levelRes < 95) { levelFillRes.className = 'level-fill level-medium'; }
        else { levelFillRes.className = 'level-fill level-high'; }
    }


    function updatePumpControlsUI(data) {
        // Verifica se todos os elementos necessários existem
        if (!motorStatus || !pumpStatusValue || !pumpStatusText || !pumpStatusIcon || !modeValue || !modeText || !modeIcon ||
            !motorButton || !autoModeSwitch || !btnFerias || !feriasInfo) {
             console.error("Um ou mais elementos da UI não foram encontrados para updatePumpControlsUI.");
            return;
        }

        const statusBomba = data.statusBomba || '--';
        const modo = data.modo || '--';
        const modoOp = data.modoOperacao || 'normal';

        motorStatus.textContent = statusBomba;
        pumpStatusValue.textContent = statusBomba === 'LIGADA' ? 'ON' : (statusBomba === 'DESLIGADA' ? 'OFF' : '--');
        pumpStatusText.textContent = statusBomba !== '--' ? `A bomba está ${statusBomba}.` : 'Aguardando...';
        pumpStatusIcon.className = 'card-icon ' + (statusBomba === 'LIGADA' ? 'icon-green' : 'icon-red');

        modeValue.textContent = modo === 'automatico' ? 'AUTO' : (modo === 'manual' ? 'MAN' : '--');
        modeText.textContent = modo !== '--' ? `Operando em modo ${modo}.` : 'Aguardando...';
        modeIcon.className = 'card-icon ' + (modo === 'automatico' ? 'icon-green' : (modo === 'manual' ? 'icon-orange' : ''));

        if (statusBomba === 'LIGADA') {
            motorStatus.className = 'status-indicator-on';
            motorButton.textContent = 'Desligar Bomba';
            motorButton.className = 'btn-motor-on';
        } else {
            motorStatus.className = 'status-indicator-off';
            motorButton.textContent = 'Ligar Bomba';
            motorButton.className = 'btn-motor-off';
        }

        // Correção Lógica Botão Manual e Switch
        if (modo === 'automatico') {
            autoModeSwitch.checked = true;
            motorButton.disabled = true;
            console.log("Modo Automático: Botão manual DESABILITADO.");
        } else {
            autoModeSwitch.checked = false;
            motorButton.disabled = false;
            console.log(`Modo ${modo}: Botão manual HABILITADO.`);
        }

        // Botão Modo Férias
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
