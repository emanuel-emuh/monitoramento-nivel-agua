// ===================================================================
//   AQUAMONITOR - SCRIPT ADMIN (VERSÃO DE DEPURAÇÃO V7 - Simplificada)
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Admin DEBUG v7 script starting...");

    // --- Variáveis Globais (Declaradas cedo) ---
    let auth, database;
    let logoutButton;
    let sensorRef;
    let isAdminVerified = false;
    let initComplete = false; // Flag para garantir inicialização única

    // --- FUNÇÕES ---

    // Handler de Logout
    function logoutHandler(e) {
        if (e) e.preventDefault();
        console.log("Logout action initiated.");
        if (auth) {
            auth.signOut().then(() => {
                console.log("Sign out successful. Redirecting to login.");
                window.location.href = 'login.html';
            }).catch(error => {
                console.error("Sign out error:", error);
                alert("Erro ao fazer logout.");
            });
        } else {
             console.error("Logout failed: auth object not available.");
        }
    }

    // Tenta Habilitar Logout e Adicionar Listener
    function tryEnableLogout() {
        console.log("Attempting to get and enable logout button...");
        logoutButton = document.querySelector('.logout-button');
        if (logoutButton) {
            try {
                logoutButton.disabled = false;
                // Usa onclick para garantir substituição e simplicidade no debug
                logoutButton.onclick = logoutHandler;
                console.log("SUCCESS: Logout button FOUND, enabled, and listener attached.");
            } catch (err) {
                console.error("!!! Error enabling/attaching listener to logout button:", err);
            }
        } else {
            console.error("!!! CRITICAL: Logout button NOT FOUND in DOM !!!");
        }
    }

    // Adiciona Listener Firebase Mínimo
    function attachMinimalFirebaseListener() {
        console.log("Attempting to get Firebase sensorRef...");
        if (!database) {
            console.error("!!! Cannot attach listener: database object not available.");
            return;
        }
        sensorRef = database.ref('sensorData');
        console.log("Attempting to attach sensorRef listener...");
        try {
            sensorRef.on('value', snapshot => {
                console.log(">>> Sensor data received:", snapshot.val());
                // (Não faz update da UI nesta versão de debug)
            }, error => {
                console.error("!!! Error on sensorRef listener:", error);
            });
            console.log("SUCCESS: sensorRef listener attached.");
        } catch (err) {
            console.error("!!! Error attaching sensorRef listener:", err);
        }
    }

    // --- INICIALIZAÇÃO E VERIFICAÇÃO ---
    console.log("Initializing Firebase...");
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyBOBbMzkTO2MvIxExVO8vlCOUgpeZp0rSY",
            authDomain: "aqua-monitor-login.firebaseapp.com",
            projectId: "aqua-monitor-login",
            databaseURL: "https://aqua-monitor-login-default-rtdb.firebaseio.com"
        };
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("Firebase initialized.");
        } else {
            firebase.app();
            console.log("Firebase app retrieved.");
        }
        auth = firebase.auth();
        database = firebase.database();
        console.log("Firebase auth and database objects created.");
        initComplete = true; // Marca inicialização como completa

    } catch (e) {
        console.error("!!! Firebase initialization FAILED:", e);
        alert("Erro crítico na inicialização do Firebase. Verifique a consola.");
        initComplete = false;
        return; // PARAR AQUI se falhar
    }

    // --- VERIFICAÇÃO DE ADMIN ---
    console.log("Setting up Auth State Change listener...");
    if (auth) {
        auth.onAuthStateChanged(user => {
            console.log("Auth state changed. User:", user ? user.uid : 'null');
            if (user) {
                console.log("User detected. Checking admin role for UID:", user.uid);
                if (!database) { // Segurança extra
                     console.error("!!! Database object missing during auth check!");
                     return;
                }
                database.ref('usuarios/' + user.uid).get().then(snapshot => {
                    if (snapshot.exists() && snapshot.val().role === 'admin') {
                        isAdminVerified = true;
                        console.log("SUCCESS: Admin role verified for user:", user.email);

                        // ** SÓ TENTA HABILITAR O LOGOUT E ADICIONAR LISTENER SE FOR ADMIN **
                        tryEnableLogout();
                        attachMinimalFirebaseListener();

                    } else {
                        isAdminVerified = false;
                        console.warn("User is NOT admin or role data missing. Redirecting...");
                        alert('Acesso negado.');
                        try { window.location.href = 'index.html'; } catch(e) { window.location.href = 'login.html'; }
                    }
                }).catch(error => {
                    isAdminVerified = false;
                    console.error("!!! Error checking admin role in database:", error);
                    alert("Erro ao verificar as suas permissões. Tente fazer login novamente.");
                    window.location.href = 'login.html';
                });
            } else {
                isAdminVerified = false;
                console.log("No user logged in, redirecting to login.");
                window.location.href = 'login.html';
            }
        });
        console.log("Auth state listener is set. Waiting for auth state...");
    } else {
        console.error("!!! Auth object not created after initialization!");
    }

}); // Fim do DOMContentLoaded

console.log("Admin script (DEBUG v7) loaded."); // DEBUG final
