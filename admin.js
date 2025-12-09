/* admin.js – v10.0 (Correção Watchdog e Visualização Offline) */

document.addEventListener('DOMContentLoaded', () => {
  console.log("Admin script V10 starting...");

  let auth, database;
  let sensorRef, paramsRef, controlRef, historyRef, eventsRef;
  
  const els = {
    waterMain: document.getElementById('admin-water-main'),
    pctMain: document.getElementById('admin-level-percent-main'),
    cardMain: document.getElementById('admin-level-card'),
    waterRes: document.getElementById('admin-water-res'),
    pctRes: document.getElementById('admin-level-percent-res'),
    cardRes: document.getElementById('admin-res-level-card'),
    pumpStatus: document.getElementById('admin-pump-status-card'),
    collStatus: document.getElementById('admin-collection-status-card'),
    connStatus: document.getElementById('admin-connection-status'), 
    lastSeen: document.getElementById('admin-last-seen'),
    inLow: document.getElementById('low-limit-input'),
    inHigh: document.getElementById('high-limit-input'),
    btnSave: document.getElementById('save-settings-button'),
    msgSave: document.getElementById('settings-feedback'),
    btnToggleColl: document.getElementById('toggle-collection-button'),
    btnRestart: document.getElementById('restart-esp-button'),
    btnCleanHist: document.getElementById('clear-history-button'),
    btnCleanLogs: document.getElementById('clear-logs-button'),
    logsList: document.getElementById('log-entries')
  };

  const firebaseConfig = {
      apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
      authDomain: "aqua-monitor-login.firebaseapp.com",
      projectId: "aqua-monitor-login",
      databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
  };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  database = firebase.database();

  sensorRef = database.ref('sensorData');
  paramsRef = database.ref('configuracoes/sistema');
  controlRef = database.ref('bomba/controle');
  historyRef = database.ref('historico');
  eventsRef = database.ref('logs');

  // [NOVO] Watchdog Admin
  let lastDataTime = 0;
  
  function updateConnectionStatus() {
    if(!els.connStatus) return;
    const now = Date.now();
    const diff = now - lastDataTime;
    
    // Se o último dado chegou há menos de 20s, está Online
    if (lastDataTime > 0 && diff < 20000) {
        els.connStatus.textContent = "ONLINE";
        els.connStatus.style.color = "#2e7d32"; 
        
        // Formata tempo (ex: "há 5s")
        const seg = Math.floor(diff / 1000);
        els.lastSeen.textContent = `Visto: há ${seg} segundos`;
        els.lastSeen.style.color = "#64748b";
    } else {
        els.connStatus.textContent = "OFFLINE";
        els.connStatus.style.color = "#dc2626"; // Vermelho
        
        if (lastDataTime === 0) {
            els.lastSeen.textContent = "Visto: Nunca (nesta sessão)";
        } else {
            const dateStr = new Date(lastDataTime).toLocaleTimeString('pt-BR');
            els.lastSeen.textContent = `Visto pela última vez: ${dateStr}`;
        }
        els.lastSeen.style.color = "#dc2626";
    }
  }

  // Inicia o timer para checar status a cada 2 segundos
  setInterval(updateConnectionStatus, 2000);

  function attachFirebaseListeners() {
    // SENSOR
    sensorRef.on('value', snap => {
      // [NOVO] Atualiza timestamp do watchdog
      lastDataTime = Date.now();
      updateConnectionStatus(); // Atualiza visual na hora

      const d = snap.val() || {};
      
      // Nível
      const rawLevel = (d.nivel !== undefined) ? d.nivel : d.level;
      const levelMain = (rawLevel !== undefined) ? Number(rawLevel) : '--';
      const levelRes = (levelMain !== '--') ? (100 - levelMain) : '--';
      
      if(els.waterMain) els.waterMain.style.height = `${levelMain !== '--' ? levelMain : 0}%`;
      if(els.pctMain) els.pctMain.textContent = levelMain;
      if(els.cardMain) els.cardMain.textContent = `${levelMain}%`;
      if(els.waterRes) els.waterRes.style.height = `${levelRes !== '--' ? levelRes : 0}%`;
      if(els.pctRes) els.pctRes.textContent = levelRes;
      if(els.cardRes) els.cardRes.textContent = `${levelRes}%`;
      
      // STATUS BOMBA
      const st = String(d.statusBomba || d.status_bomba || "--").toUpperCase();
      const isOn = st.includes("LIGA") || st === "ON";
      if(els.pumpStatus && st !== "--") {
         els.pumpStatus.textContent = isOn ? "LIGADA" : "DESLIGADA";
         els.pumpStatus.style.color = isOn ? "#2e7d32" : "#d32f2f";
      }
      
      // Coleta
      const active = d.coletaAtiva !== false;
      if(els.collStatus) {
         els.collStatus.textContent = active ? "ATIVA" : "PAUSADA";
         els.collStatus.style.color = active ? "#2e7d32" : "#d32f2f";
      }
      if(els.btnToggleColl) {
         els.btnToggleColl.textContent = active ? "Pausar Coleta" : "Retomar Coleta";
         els.btnToggleColl.disabled = false;
      }
    });

    // PARAMETROS
    paramsRef.on('value', snap => {
      const p = snap.val() || {};
      if(els.inLow) els.inLow.value = p.limiteInferior ?? 50;
      if(els.inHigh) els.inHigh.value = p.limiteSuperior ?? 95;
    });

    // LOGS
    eventsRef.limitToLast(20).on('value', snap => {
      if(!els.logsList) return;
      els.logsList.innerHTML = "";
      const data = snap.val();
      if(!data) { els.logsList.innerHTML = "<li>Nenhum registro.</li>"; return; }
      
      const arr = Object.values(data).reverse();
      arr.forEach(l => {
        const msg = l.message || l.mensagem || JSON.stringify(l);
        const li = document.createElement('li');
        let prefixo = "> ";
        if (l.timestamp) {
            prefixo = `[${new Date(l.timestamp).toLocaleTimeString('pt-BR')}] `;
        }
        li.textContent = prefixo + msg;
        els.logsList.appendChild(li);
      });
    });
  }

  // BOTÕES
  els.btnSave?.addEventListener('click', () => {
    const min = parseInt(els.inLow.value);
    const max = parseInt(els.inHigh.value);
    paramsRef.update({ limiteInferior: min, limiteSuperior: max })
      .then(() => {
          els.msgSave.textContent = "Salvo!";
          setTimeout(()=> els.msgSave.textContent="", 2000);
      })
      .catch(e => alert(e.message));
  });

  els.btnToggleColl?.addEventListener('click', async () => {
     const snap = await sensorRef.child('coletaAtiva').get();
     sensorRef.update({ coletaAtiva: (snap.val() === false) }); 
  });

  els.btnRestart?.addEventListener('click', () => {
    if(confirm("Reiniciar ESP?")) controlRef.update({ comandoRestart: true });
  });

  els.btnCleanLogs?.addEventListener('click', () => {
     if(confirm("Limpar logs?")) eventsRef.remove();
  });
  
  els.btnCleanHist?.addEventListener('click', () => {
     if(confirm("Limpar historico?")) historyRef.remove();
  });

  // BOOT
  auth.onAuthStateChanged(user => {
    if(user) {
       database.ref('usuarios/' + user.uid).get().then(s => {
          if(s.val() && s.val().role === 'admin') attachFirebaseListeners();
          else window.location.href = 'index.html';
       });
    } else {
       window.location.href = 'login.html';
    }
  });
  document.querySelector('.logout-button')?.addEventListener('click', () => auth.signOut());
});
