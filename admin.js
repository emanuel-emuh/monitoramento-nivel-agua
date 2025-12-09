/* admin.js – v7.0 (Correção Connection Status) */

document.addEventListener('DOMContentLoaded', () => {
  console.log("Admin script V7 starting...");

  let auth, database;
  let sensorRef, paramsRef, controlRef, historyRef, eventsRef;
  
  // Elementos
  const els = {
    waterMain: document.getElementById('admin-water-main'),
    pctMain: document.getElementById('admin-level-percent-main'),
    cardMain: document.getElementById('admin-level-card'),
    waterRes: document.getElementById('admin-water-res'),
    pctRes: document.getElementById('admin-level-percent-res'),
    cardRes: document.getElementById('admin-res-level-card'),
    pumpStatus: document.getElementById('admin-pump-status-card'),
    collStatus: document.getElementById('admin-collection-status-card'),
    connStatus: document.getElementById('admin-connection-status'), // Elemento de conexão
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

  // Firebase Init
  const firebaseConfig = {
      apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
      authDomain: "aqua-monitor-login.firebaseapp.com",
      projectId: "aqua-monitor-login",
      databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
  };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  database = firebase.database();

  // REFERÊNCIAS ANTIGAS (Compatíveis com seu Hardware)
  sensorRef = database.ref('sensorData');
  paramsRef = database.ref('configuracoes/sistema');
  controlRef = database.ref('bomba/controle');
  historyRef = database.ref('historico');
  eventsRef = database.ref('logs');

  function attachFirebaseListeners() {
    // SENSOR
    sensorRef.on('value', snap => {
      const d = snap.val() || {};
      
      // 1. ATUALIZA CONEXÃO (Truque: se recebeu dados, está online)
      if (els.connStatus) {
          els.connStatus.textContent = "ONLINE";
          els.connStatus.style.color = "var(--success)"; // Verde
      }
      if (els.lastSeen) {
          const agora = new Date().toLocaleTimeString();
          els.lastSeen.textContent = `Atualizado às: ${agora}`;
      }

      // Nível
      const rawLevel = (d.level !== undefined) ? d.level : d.nivel;
      const levelMain = (rawLevel !== undefined) ? Number(rawLevel) : '--';
      const levelRes = (levelMain !== '--') ? (100 - levelMain) : '--';
      
      if(els.waterMain) els.waterMain.style.height = `${levelMain !== '--' ? levelMain : 0}%`;
      if(els.pctMain) els.pctMain.textContent = levelMain;
      if(els.cardMain) els.cardMain.textContent = `${levelMain}%`;
      if(els.waterRes) els.waterRes.style.height = `${levelRes !== '--' ? levelRes : 0}%`;
      if(els.pctRes) els.pctRes.textContent = levelRes;
      if(els.cardRes) els.cardRes.textContent = `${levelRes}%`;
      
      // Coleta
      const active = d.coletaAtiva !== false;
      if(els.collStatus) {
         els.collStatus.textContent = active ? "ATIVA" : "PAUSADA";
         els.collStatus.style.color = active ? "var(--success)" : "var(--danger)";
      }
      if(els.btnToggleColl) {
         els.btnToggleColl.textContent = active ? "Pausar Coleta" : "Retomar Coleta";
         els.btnToggleColl.disabled = false;
      }
    });

    // CONTROLE
    controlRef.on('value', snap => {
      const d = snap.val() || {};
      const st = String(d.statusBomba || "--").toUpperCase();
      
      // CORRIGIDO: Aceita "ON", "LIGADA", etc.
      const isOn = st.includes("LIGA") || st === "ON";
      
      if(els.pumpStatus) {
         els.pumpStatus.textContent = isOn ? "LIGADA" : "DESLIGADA";
         els.pumpStatus.style.color = isOn ? "var(--success)" : "var(--danger)";
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
        const msg = l.message || JSON.stringify(l);
        const li = document.createElement('li');
        li.textContent = `> ${msg}`;
        els.logsList.appendChild(li);
      });
    });
  }

  // EVENTOS DE BOTÕES
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