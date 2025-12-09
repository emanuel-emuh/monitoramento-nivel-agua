/* admin.js – v6.0 (Revertido para ESP Original) */

document.addEventListener('DOMContentLoaded', () => {
  console.log("Admin script starting (Revertido)...");

  let auth, database;
  let sensorRef, paramsRef, controlRef, historyRef, eventsRef;
  
  // ELEMENTOS DOM
  const els = {
    waterMain: document.getElementById('admin-water-main'),
    pctMain: document.getElementById('admin-level-percent-main'),
    cardMain: document.getElementById('admin-level-card'),
    waterRes: document.getElementById('admin-water-res'),
    pctRes: document.getElementById('admin-level-percent-res'),
    cardRes: document.getElementById('admin-res-level-card'),
    pumpStatus: document.getElementById('admin-pump-status-card'),
    collStatus: document.getElementById('admin-collection-status-card'),
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

  // INIT
  const firebaseConfig = {
      apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
      authDomain: "aqua-monitor-login.firebaseapp.com",
      projectId: "aqua-monitor-login",
      databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
  };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  database = firebase.database();

  // REFS ANTIGAS
  sensorRef = database.ref('sensorData');          // ANTES: dados_sensores...
  paramsRef = database.ref('configuracoes/sistema'); // ANTES: parametros...
  controlRef = database.ref('bomba/controle');     // ANTES: controle_sistema
  historyRef = database.ref('historico');
  eventsRef = database.ref('logs');                // ANTES: eventos

  // LISTENERS
  function attachFirebaseListeners() {
    // SENSOR
    sensorRef.on('value', snap => {
      const d = snap.val() || {};
      
      // CAMINHO ANTIGO: level
      const levelMain = (d.level !== undefined) ? Number(d.level) : '--';
      const levelRes = (levelMain !== '--') ? (100 - levelMain) : '--';
      
      // UI
      if(els.waterMain) els.waterMain.style.height = `${levelMain !== '--' ? levelMain : 0}%`;
      if(els.pctMain) els.pctMain.textContent = levelMain;
      if(els.cardMain) els.cardMain.textContent = `${levelMain}%`;
      if(els.waterRes) els.waterRes.style.height = `${levelRes !== '--' ? levelRes : 0}%`;
      if(els.pctRes) els.pctRes.textContent = levelRes;
      if(els.cardRes) els.cardRes.textContent = `${levelRes}%`;
      
      // COLETA (estava em sensorData no antigo)
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

    // CONTROLE / BOMBA
    controlRef.on('value', snap => {
      const d = snap.val() || {};
      // NOME ANTIGO: statusBomba
      const st = String(d.statusBomba || "--").toUpperCase();
      if(els.pumpStatus) {
         els.pumpStatus.textContent = st;
         els.pumpStatus.style.color = st.includes("LIGA") ? "var(--success)" : "var(--danger)";
      }
    });

    // PARAMETROS
    paramsRef.on('value', snap => {
      const p = snap.val() || {};
      // NOMES ANTIGOS: limiteInferior, limiteSuperior
      if(els.inLow) els.inLow.value = p.limiteInferior ?? 50;
      if(els.inHigh) els.inHigh.value = p.limiteSuperior ?? 95;
    });

    // LOGS
    eventsRef.limitToLast(20).on('value', snap => {
      if(!els.logsList) return;
      els.logsList.innerHTML = "";
      const data = snap.val();
      if(!data) { els.logsList.innerHTML = "<li>Vazio</li>"; return; }
      const arr = Object.values(data).reverse();
      arr.forEach(l => {
        // NOME ANTIGO: message
        const msg = l.message || JSON.stringify(l);
        const li = document.createElement('li');
        li.textContent = `> ${msg}`;
        els.logsList.appendChild(li);
      });
    });
  }

  // BOTOES
  els.btnSave?.addEventListener('click', () => {
    const min = parseInt(els.inLow.value);
    const max = parseInt(els.inHigh.value);
    // CAMINHO ANTIGO
    paramsRef.update({ limiteInferior: min, limiteSuperior: max })
      .then(() => alert("Salvo!"))
      .catch(e => alert(e.message));
  });

  els.btnToggleColl?.addEventListener('click', async () => {
     // A coletaAtiva ficava em sensorData no antigo
     const snap = await sensorRef.child('coletaAtiva').get();
     const atual = snap.val();
     sensorRef.update({ coletaAtiva: (atual === false) }); 
  });

  els.btnRestart?.addEventListener('click', () => {
    if(confirm("Reiniciar ESP?")) {
       // CAMINHO ANTIGO: comandoRestart
       controlRef.update({ comandoRestart: true });
    }
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
       // Verifica Admin
       database.ref('usuarios/' + user.uid).get().then(s => {
          if(s.val().role === 'admin') attachFirebaseListeners();
          else window.location.href = 'index.html';
       });
    } else {
       window.location.href = 'login.html';
    }
  });
  document.querySelector('.logout-button')?.addEventListener('click', () => auth.signOut());
});