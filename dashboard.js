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

    // --- VARIÁVEIS GLOBAIS ---
    const totalVolumeLiters = 1.728; // Volume fixo

    // --- REFERÊNCIAS AOS ELEMENTOS DO DOM (HTML) ---
    // Caixa Principal
    const mainLevelValue = document.getElementById('main-level-value');
    const mainLevelLiters = document.getElementById('main-level-liters');
    const levelFillMain = document.getElementById('level-fill-main');
    const levelPercentageMain = document.getElementById('level-percentage-main');
    const clientWaterMain = document.getElementById('client-water-main'); // Novo
    const clientLevelPercentMain = document.getElementById('client-level-percent-main'); // Novo

    // Reservatório
    const resLevelValue = document.getElementById('res-level-value');
    const resLevelLiters = document.getElementById('res-level-liters');
    const levelFillRes = document.getElementById('level-fill-res');
    const levelPercentageRes = document.getElementById('level-percentage-res');
    const clientWaterRes = document.getElementById('client-water-res'); // Novo
    const clientLevelPercentRes = document.getElementById('client-level-percent-res'); // Novo

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
    const levelChart = new Chart(ctx, { /* ... código inalterado ... */ });

    // --- OUVINTES (LISTENERS) DE DADOS DO FIREBASE ---

    historyRef.on('value', snapshot => { /* ... código inalterado ... */ });

    sensorDataRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data && data.level !== undefined && data.levelReservatorio !== undefined) {
            updateDashboardUI(data.level, data.levelReservatorio);
        } else {
             // Limpa a UI se não houver dados
             updateDashboardUI('--', '--');
        }
    });

    controlRef.on('value', snapshot => {
        const data = snapshot.val();
        updatePumpControlsUI(data || {}); // Passa objeto vazio se não houver dados
    });

    // --- LÓGICA DAS NOVAS FUNCIONALIDADES ---

    function calculateAverageConsumption(historyData) { /* ... código inalterado ... */ }

    btnFerias.addEventListener('click', () => { /* ... código inalterado ... */ });

    // --- FUNÇÕES DE ATUALIZAÇÃO DA INTERFACE ---

    function updateDashboardUI(levelMain, levelRes) {
        const isDataValid = levelMain !== '--' && levelRes !== '--';

        // --- Caixa Principal ---
        const currentLitersMain = isDataValid ? (totalVolumeLiters * (levelMain / 100)).toFixed(1) : '--';
        mainLevelValue.textContent = `${levelMain}%`;
        mainLevelLiters.textContent = isDataValid ? `${currentLitersMain} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
        levelFillMain.style.width = isDataValid ? levelMain + '%' : '0%';
        levelPercentageMain.textContent = `${levelMain}%`;
        clientWaterMain.style.height = isDataValid ? levelMain + '%' : '0%'; // Atualiza visualização
        clientLevelPercentMain.textContent = levelMain; // Atualiza label

        if (levelMain <= 50) { levelFillMain.className = 'level-fill level-low'; }
        else if (levelMain < 95) { levelFillMain.className = 'level-fill level-medium'; }
        else { levelFillMain.className = 'level-fill level-high'; }

        // --- Reservatório ---
        const currentLitersRes = isDataValid ? (totalVolumeLiters * (levelRes / 100)).toFixed(1) : '--';
        resLevelValue.textContent = `${levelRes}%`;
        resLevelLiters.textContent = isDataValid ? `${currentLitersRes} L (Total: ${totalVolumeLiters.toFixed(1)} L)` : '-- L';
        levelFillRes.style.width = isDataValid ? levelRes + '%' : '0%';
        levelPercentageRes.textContent = `${levelRes}%`;
        clientWaterRes.style.height = isDataValid ? levelRes + '%' : '0%'; // Atualiza visualização
        clientLevelPercentRes.textContent = levelRes; // Atualiza label

         if (levelRes <= 50) { levelFillRes.className = 'level-fill level-low'; }
         else if (levelRes < 95) { levelFillRes.className = 'level-fill level-medium'; }
         else { levelFillRes.className = 'level-fill level-high'; }

        // Se os dados não forem válidos, limpa alguns textos
        if (!isDataValid) {
            mainLevelValue.textContent = '--%';
            resLevelValue.textContent = '--%';
            levelPercentageMain.textContent = '--%';
            levelPercentageRes.textContent = '--%';
            clientLevelPercentMain.textContent = '--';
            clientLevelPercentRes.textContent = '--';
        }
    }

    function updatePumpControlsUI(data) {
        // Atualiza Cards
        motorStatus.textContent = data.statusBomba || '--';
        pumpStatusValue.textContent = data.statusBomba === 'LIGADA' ? 'ON' : '--';
        pumpStatusText.textContent = data.statusBomba ? `A bomba está ${data.statusBomba}.` : 'Aguardando...';
        pumpStatusIcon.className = 'card-icon ' + (data.statusBomba === 'LIGADA' ? 'icon-green' : 'icon-red');

        modeValue.textContent = data.modo === 'automatico' ? 'AUTO' : (data.modo === 'manual' ? 'MAN' : '--');
        modeText.textContent = data.modo ? `Operando em modo ${data.modo}.` : 'Aguardando...';
        modeIcon.className = 'card-icon ' + (data.modo === 'automatico' ? 'icon-green' : (data.modo === 'manual' ? 'icon-orange' : ''));


        // Atualiza Controles
        if (data.statusBomba === 'LIGADA') {
            motorStatus.className = 'status-indicator-on';
            motorButton.textContent = 'Desligar Bomba';
            motorButton.className = 'btn-motor-on';
        } else {
            motorStatus.className = 'status-indicator-off';
            motorButton.textContent = 'Ligar Bomba';
            motorButton.className = 'btn-motor-off';
        }

        if (data.modo === 'automatico') {
            autoModeSwitch.checked = true;
            motorButton.disabled = true;
        } else {
            autoModeSwitch.checked = false;
            motorButton.disabled = false;
        }

        // Atualiza Modo Férias
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

    autoModeSwitch.addEventListener('change', () => { /* ... código inalterado ... */ });
    motorButton.addEventListener('click', () => { /* ... código inalterado ... */ });
});
