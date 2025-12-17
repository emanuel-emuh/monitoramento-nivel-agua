/* admin.js – v15.0 (Correção Status Offline e Hora Real) */

document.addEventListener('DOMContentLoaded', () => {
  console.log("Admin System: Iniciando módulo de segurança e monitoramento...");

  let auth, database;
  let sensorRef, paramsRef, controlRef, historyRef, eventsRef;
  
  // Variável para o monitor de conexão (Watchdog)
  let watchdogTimer = null; 

  // Capacidade total da caixa (12x12x12 = 1.728 Litros)
  const CAPACIDADE_TOTAL_LITROS = 1.728;

  // Elementos da Interface
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

  // Configuração do Firebase
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

  function calcLitros(porcentagem) {
      if (typeof porcentagem !== 'number') return "-- L";
      const litros = (porcentagem / 100) * CAPACIDADE_TOTAL_LITROS;
      return `${litros.toFixed(2)} L`; 
  }

  // --- SISTEMA DE MONITORAMENTO DE CONEXÃO (CORRIGIDO) ---
  
  function setSystemOffline() {
      if (els.connStatus) {
          els.connStatus.textContent = "OFFLINE (Sem sinal)";
          els.connStatus.style.color = "#d32f2f"; // Vermelho
          els.connStatus.style.fontWeight = "bold";
      }
      // Não mudamos o texto do "Último sinal" aqui para manter o registro de quando caiu
  }

  function setSystemOnline(timestamp) {
      if (els.connStatus) {
          els.connStatus.textContent = "ONLINE (Operacional)";
          els.connStatus.style.color = "#2e7d32"; // Verde
          els.connStatus.style.fontWeight = "bold";
      }
      
      // Mostra a hora REAL que veio do ESP, e não a hora do navegador
      if (timestamp && els.lastSeen) {
          const dateObj = new Date(timestamp);
          const horaFormatada = dateObj.toLocaleTimeString('pt-BR');
          els.lastSeen.textContent = `Último sinal recebido: ${horaFormatada}`;
      }

      // Reinicia contagem
      if (watchdogTimer) clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(setSystemOffline, 75000); 
  }

  // Lógica inteligente que compara o tempo
  function checkLastSeen(timestamp) {
      if (!timestamp) {
          setSystemOffline();
          if(els.lastSeen) els.lastSeen.textContent = "Último sinal: Nunca/Desconhecido";
          return;
      }

      const now = Date.now();
      const diff = now - timestamp;

      // Se o dado for mais velho que 75 segundos, é OFFLINE
      if (diff > 75000) {
          setSystemOffline();
          // Ainda assim, mostramos quando foi o último sinal
          const dateObj = new Date(timestamp);
          els.lastSeen.textContent = `Visto por último em: ${dateObj.toLocaleTimeString('pt-BR')} (${dateObj.toLocaleDateString('pt-BR')})`;
      } else {
          setSystemOnline(timestamp);
      }
  }

  // --- LISTENERS ---
  function attachFirebaseListeners() {
    console.log("Permissão de Admin confirmada. Conectando aos dados...");

    // 1. SENSOR E CONEXÃO
    sensorRef.on('value', (snap) => {
      const d = snap.val();
      
      if (d) {
          // --- CORREÇÃO AQUI: Verifica Timestamp ---
          checkLastSeen(d.lastSeen);

          // Atualização Nível Principal
          const rawLevel = (d.nivel !== undefined) ? d.nivel : d.level;
          const levelMain = (rawLevel !== undefined) ? Number(rawLevel) : 0;
          
          if(els.waterMain) els.waterMain.style.height = `${levelMain}%`;
          if(els.cardMain) els.cardMain.textContent = `${levelMain}%`; 
          if(els.pctMain) els.pctMain.textContent = calcLitros(levelMain);

          // Atualização Reservatório
          const levelRes = (d.nivelReservatorio !== undefined) ? d.nivelReservatorio : (100 - levelMain);
          
          if(els.waterRes) els.waterRes.style.height = `${levelRes}%`;
          if(els.cardRes) els.cardRes.textContent = `${levelRes}%`; 
          if(els.pctRes) els.pctRes.textContent = calcLitros(levelRes);
          
          // Status Coleta
          const active = d.coletaAtiva !== false;
          if(els.collStatus) {
            els.collStatus.textContent = active ? "ATIVA" : "PAUSADA";
            els.collStatus.style.color = active ? "#2e7d32" : "#d32f2f";
          }
          if(els.btnToggleColl) {
            els.btnToggleColl.textContent = active ? "PAUSAR COLETA" : "RETOMAR COLETA";
            els.btnToggleColl.className = active ? "btn btn-secondary" : "btn btn-success";
            els.btnToggleColl.disabled = false;
          }
      }
    }, (error) => {
        console.error("Erro ao ler Sensores:", error);
        alert("Erro de permissão: Você foi desconectado ou não tem acesso.");
    });

    // 2. CONTROLE DA BOMBA
    controlRef.on('value', (snap) => {
      const d = snap.val() || {};
      const st = String(d.statusBomba || "--").toUpperCase().trim();
      
      const isOn = (st === "LIGADA" || st === "ON" || st === "LIGADO");
      
      if(els.pumpStatus) {
         els.pumpStatus.textContent = isOn ? "LIGADA" : "DESLIGADA";
         els.pumpStatus.style.color = isOn ? "#2e7d32" : "#d32f2f"; 
         els.pumpStatus.style.fontWeight = "bold";
      }
    });

    // 3. PARÂMETROS
    paramsRef.on('value', (snap) => {
      const p = snap.val() || {};
      if(document.activeElement !== els.inLow && els.inLow) els.inLow.value = p.limiteInferior ?? 50;
      if(document.activeElement !== els.inHigh && els.inHigh) els.inHigh.value = p.limiteSuperior ?? 95;
    });

    // 4. LOGS
    eventsRef.limitToLast(20).on('value', (snap) => {
      if(!els.logsList) return;
      els.logsList.innerHTML = "";
      const data = snap.val();
      
      if(!data) { 
          els.logsList.innerHTML = "<li style='padding:10px; color:#666;'>Nenhum registro encontrado.</li>"; 
          return; 
      }
      
      const arr = Object.values(data).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      arr.forEach(l => {
        const msg = l.message || l.mensagem || "Evento desconhecido";
        const li = document.createElement('li');
        let dataFormatada = "";
        
        if (l.timestamp) {
            const dt = new Date(l.timestamp);
            dataFormatada = `[${dt.toLocaleTimeString('pt-BR')}] `;
        }
        
        li.textContent = dataFormatada + msg;
        li.style.borderBottom = "1px solid #eee";
        li.style.padding = "5px 0";
        els.logsList.appendChild(li);
      });
    });
  }

  // --- CONTROLES E BOTÕES ---
  els.btnSave?.addEventListener('click', () => {
    const min = parseInt(els.inLow.value);
    const max = parseInt(els.inHigh.value);

    if(min >= max) {
        alert("Erro: O limite inferior deve ser menor que o superior.");
        return;
    }

    els.btnSave.disabled = true;
    els.btnSave.textContent = "Salvando...";

    paramsRef.update({ limiteInferior: min, limiteSuperior: max })
      .then(() => {
          els.msgSave.textContent = "Configurações salvas com sucesso!";
          els.msgSave.style.color = "green";
          setTimeout(()=> els.msgSave.textContent="", 3000);
      })
      .catch(e => {
          alert("Erro ao salvar: " + e.message);
      })
      .finally(() => {
          els.btnSave.disabled = false;
          els.btnSave.textContent = "Salvar Alterações";
      });
  });

  els.btnToggleColl?.addEventListener('click', async () => {
     try {
         const snap = await sensorRef.child('coletaAtiva').get();
         const novoEstado = (snap.val() === false); 
         await sensorRef.update({ coletaAtiva: novoEstado });
     } catch(e) {
         console.error(e);
         alert("Erro ao alterar estado da coleta.");
     }
  });

  els.btnRestart?.addEventListener('click', () => {
    if(confirm("Tem certeza que deseja reiniciar o dispositivo ESP8266 remotamente?")) {
        controlRef.update({ comandoRestart: true })
            .then(() => alert("Comando de reinicialização enviado."))
            .catch(e => alert(e.message));
    }
  });

  els.btnCleanLogs?.addEventListener('click', () => {
     if(confirm("Isso apagará todos os logs de eventos. Continuar?")) eventsRef.remove();
  });
  
  els.btnCleanHist?.addEventListener('click', () => {
     if(confirm("ATENÇÃO: Isso apagará TODO o histórico de níveis. Continuar?")) historyRef.remove();
  });

  // --- AUTENTICAÇÃO E INICIALIZAÇÃO ---
  auth.onAuthStateChanged(user => {
    if(user) {
       database.ref('usuarios/' + user.uid).once('value').then(s => {
          const dados = s.val();
          if(dados && dados.role === 'admin') {
              attachFirebaseListeners();
          } else {
              alert("Acesso Negado: Sua conta não tem privilégios de Administrador.");
              window.location.href = 'index.html';
          }
       }).catch(err => {
           console.error("Erro ao verificar perfil:", err);
           window.location.href = 'login.html';
       });
    } else {
       window.location.href = 'login.html';
    }
  });

  document.querySelector('.logout-button')?.addEventListener('click', (e) => {
      e.preventDefault();
      auth.signOut();
  });
});