// ===================================================================
//   AQUAMONITOR - SCRIPT ADMIN (VERSÃO DE DEPURAÇÃO V7.1 - Habilita Todos os Botões)
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("Admin DEBUG v7.1 script starting...");

    // --- Variáveis Globais (Declaradas cedo) ---
    let auth, database;
    let logoutButton, saveSettingsButton, toggleCollectionButton, clearHistoryButton, restartEspButton; // Referências aos botões
    let sensorRef; // Referência Firebase
    let isAdminVerified = false;
    let initComplete = false;

    // --- FUNÇÕES ---

    // Handler de Logout
    function logoutHandler(e) { /* ... (inalterado) ... */ }
    // Handlers (vazios por agora, só para o listener não dar erro)
    function saveSettingsHandler() { console.log("Save Settings clicked (Handler attached)"); }
    function toggleCollectionHandler() { console.log("Toggle Collection clicked (Handler attached)"); }
    function clearHistoryHandler() { console.log("Clear History clicked (Handler attached)"); }
    function restartEspHandler() { console.log("Restart ESP clicked (Handler attached)"); }


    // Tenta Habilitar TODOS os botões e Adicionar Listeners
    function tryEnableControls() {
        console.log("Attempting to get and enable ALL control buttons...");

        logoutButton = document.querySelector('.logout-button');
        saveSettingsButton = document.getElementById('save-settings-button');
        toggleCollectionButton = document.getElementById('toggle-collection-button');
        clearHistoryButton = document.getElementById('clear-history-button');
        restartEspButton = document.getElementById('restart-esp-button');

        // Logout
        if (logoutButton) {
            logoutButton.disabled = false;
            logoutButton.removeEventListener('click', logoutHandler);
            logoutButton.addEventListener('click', logoutHandler);
            console.log("SUCCESS: Logout button enabled and listener attached.");
        } else { console.error("!!! CRITICAL: Logout button NOT FOUND !!!"); }

        // Save Settings
        if (saveSettingsButton) {
            saveSettingsButton.disabled = false;
            saveSettingsButton.removeEventListener('click', saveSettingsHandler);
            saveSettingsButton.addEventListener('click', saveSettingsHandler); // Handler vazio por agora
            console.log("SUCCESS: Save Settings button enabled and listener attached.");
        } else { console.error("!!! CRITICAL: Save Settings button NOT FOUND !!!"); }

        // Toggle Collection (Começa habilitado neste teste)
        if (toggleCollectionButton) {
            toggleCollectionButton.disabled = false; // Força habilitação inicial
            toggleCollectionButton.textContent = 'Coleta (Estado Inicial)'; // Texto inicial
            toggleCollectionButton.removeEventListener('click', toggleCollectionHandler);
            toggleCollectionButton.addEventListener('click', toggleCollectionHandler); // Handler vazio
            console.log("SUCCESS: Toggle Collection button enabled (forced) and listener attached.");
        } else { console.error("!!! CRITICAL: Toggle Collection button NOT FOUND !!!"); }

        // Clear History
        if (clearHistoryButton) {
            clearHistoryButton.disabled = false;
            clearHistoryButton.removeEventListener('click', clearHistoryHandler);
            clearHistoryButton.addEventListener('click', clearHistoryHandler); // Handler vazio
            console.log("SUCCESS: Clear History button enabled and listener attached.");
        } else { console.error("!!! CRITICAL: Clear History button NOT FOUND !!!"); }

        // Restart ESP
        if (restartEspButton) {
            restartEspButton.disabled = false;
            restartEspButton.removeEventListener('click', restartEspHandler);
            restartEspButton.addEventListener('click', restartEspHandler); // Handler vazio
            console.log("SUCCESS: Restart ESP button enabled and listener attached.");
        } else { console.error("!!! CRITICAL: Restart ESP button NOT FOUND !!!"); }
    }

    // Adiciona Listener Firebase Mínimo
    function attachMinimalFirebaseListener() { /* ... (inalterado da resposta anterior) ... */ }

    // --- INICIALIZAÇÃO E VERIFICAÇÃO ---
    console.log("Initializing Firebase...");
    try {
        const firebaseConfig = { /* ... (configuração inalterada) ... */ };
        if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); console.log("Firebase initialized."); }
        else { firebase.app(); console.log("Firebase app retrieved."); }
        auth = firebase.auth();
        database = firebase.database();
        console.log("Firebase auth and database objects created.");
        initComplete = true;
    } catch (e) { /* ... (tratamento de erro inalterado) ... */ }

    // --- VERIFICAÇÃO DE ADMIN ---
    console.log("Setting up Auth State Change listener...");
    if (auth) {
        auth.onAuthStateChanged(user => {
            console.log("Auth state changed. User:", user ? user.uid : 'null');
            if (user) {
                console.log("User detected. Checking admin role for UID:", user.uid);
                if (!database) { console.error("!!! Database object missing during auth check!"); return; }
                database.ref('usuarios/' + user.uid).get().then(snapshot => {
                    if (snapshot.exists() && snapshot.val().role === 'admin') {
                        isAdminVerified = true;
                        console.log("SUCCESS: Admin role verified for user:", user.email);

                        // ** TENTA HABILITAR TODOS OS BOTÕES E ADICIONAR LISTENER MÍNIMO **
                        tryEnableControls(); // Agora habilita todos
                        attachMinimalFirebaseListener();

                    } else { /* ... (redirecionamento inalterado) ... */ }
                }).catch(error => { /* ... (tratamento de erro inalterado) ... */ });
            } else { /* ... (redirecionamento inalterado) ... */ }
        });
        console.log("Auth state listener is set. Waiting for auth state...");
    } else { console.error("!!! Auth object not created after initialization!"); }

}); // Fim do DOMContentLoaded
console.log("Admin script (DEBUG v7.1) loaded.");
