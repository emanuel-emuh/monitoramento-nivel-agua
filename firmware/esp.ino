/**************************************************************
 *  AquaMonitor – ESP8266 + Firebase RTDB
 *  (versão estável SEM Root CA)
 **************************************************************/


#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include <time.h>


// ===== Wi-Fi =====
const char* WIFI_SSID     = "AGUA_MONITOR";
const char* WIFI_PASSWORD = "AGUAMONITOR";

// ===== Pinos/Físico =====
#define TRIG_PIN  D1
#define ECHO_PIN  D2
#define RELAY_PIN D6
const float alturaCaixa = 12.0; // 12 cm


// ===== Intervalos =====
unsigned long sendDataInterval = 10000;
unsigned long previousSensorMillis = 0;
unsigned long controlInterval = 3000;
unsigned long previousControlMillis = 0;
unsigned long lastSeenInterval = 60000;
unsigned long previousLastSeenMillis = 0;


// ===== Firebase objs =====
FirebaseData fbdo;         // principal
FirebaseData fbdo_log;     // logs
FirebaseData fbdo_lastSeen;// lastSeen
FirebaseAuth auth;
FirebaseConfig config;


// ===== Estado =====
String modoAtual = "automatico";
String statusBomba = "DESLIGADA";
String statusBombaAnterior = "DESLIGADA";
int nivelPercentual = 0;
int nivelReservatorio = 0;
int LIMITE_INFERIOR = 50;
int LIMITE_SUPERIOR = 95;
bool coletaAtiva = true;
String modoOperacao = "normal";
const int LIMITE_INFERIOR_FERIAS = 15;
const int LIMITE_SUPERIOR_FERIAS = 50;


// ===== Rede: backoff reconexão =====
unsigned long lastWiFiRetry = 0;
const unsigned long WIFI_RETRY_MS = 7000;


bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  unsigned long now = millis();
  if (now - lastWiFiRetry >= WIFI_RETRY_MS) {
    lastWiFiRetry = now;
    Serial.println("[NET] Wi-Fi caiu. Tentando reconectar...");
    WiFi.reconnect();
    if (WiFi.status() != WL_CONNECTED) WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
  return false;
}


// ===== Protótipos =====
float lerDistancia();
void controlarBomba();
void escutarComandos();
void carregarConfiguracoes();
void registrarHistorico();
void logEvent(String eventMessage);
void updateLastSeen();


// ============================ SETUP ============================
void setup() {
  Serial.begin(115200);


  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // relé desligado (ativo em LOW)


  // Wi-Fi estável
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);


  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) { Serial.print("."); delay(300); }
  Serial.printf("\nWi-Fi OK, IP: %s\n", WiFi.localIP().toString().c_str());


  // NTP – hora certa p/ TLS
  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov", "time.google.com");
  Serial.print("Sincronizando NTP");
  time_t now = time(nullptr);
  while (now < 1700000000) { delay(200); Serial.print("."); now = time(nullptr); }
  Serial.println("\nNTP OK");


  // Firebase – credenciais
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  config.token_status_callback = tokenStatusCallback;


  // Buffers TLS maiores + timeout (reduz SSL write error)
  fbdo.setBSSLBufferSize(1024, 1024);
  fbdo_log.setBSSLBufferSize(1024, 1024);
  fbdo_lastSeen.setBSSLBufferSize(1024, 1024);
  config.timeout.serverResponse = 10000; // 10s


  // Inicia Firebase
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);


  // Aguarda pronto
  while (!Firebase.ready()) { delay(100); }
  Serial.println("Firebase pronto!");


  // Estado inicial
  carregarConfiguracoes();
  Firebase.RTDB.setString(&fbdo, "bomba/controle/modo", "automatico");
  Firebase.RTDB.setString(&fbdo, "bomba/controle/comandoManual", "NENHUM");
  Firebase.RTDB.setString(&fbdo, "bomba/controle/modoOperacao", "normal");
  Firebase.RTDB.setBool(&fbdo,   "bomba/controle/comandoRestart", false);


  logEvent("ESP8266 Iniciado/Reiniciado.");
  updateLastSeen();
}


// ============================= LOOP ============================
void loop() {
  unsigned long currentMillis = millis();


  // Pausa IO quando sem rede / token
  if (!ensureWifi())       { delay(50); return; }
  if (!Firebase.ready())   { delay(50); return; }


  // Controle
  if (currentMillis - previousControlMillis > controlInterval) {
    previousControlMillis = currentMillis;
    carregarConfiguracoes();
    escutarComandos();
    controlarBomba();
  }


  // Sensor + histórico
  if (currentMillis - previousSensorMillis > sendDataInterval) {
    previousSensorMillis = currentMillis;


    if (coletaAtiva) {
      float distancia = lerDistancia();
      nivelPercentual = (int)(((alturaCaixa - distancia) / alturaCaixa) * 100.0);
      nivelPercentual = constrain(nivelPercentual, 0, 100);
      nivelReservatorio = 100 - nivelPercentual;


      Firebase.RTDB.setInt(&fbdo, "sensorData/level", nivelPercentual);
      Firebase.RTDB.setInt(&fbdo, "sensorData/levelReservatorio", nivelReservatorio);
      registrarHistorico();
    }
  }


  // Last seen
  if (currentMillis - previousLastSeenMillis > lastSeenInterval) {
    previousLastSeenMillis = currentMillis;
    updateLastSeen();
  }
}


// ===================== FUNÇÕES DE NEGÓCIO ======================
void carregarConfiguracoes() {
  if (Firebase.RTDB.getInt(&fbdo, "configuracoes/sistema/limiteInferior")) {
    LIMITE_INFERIOR = fbdo.to<int>();
  }
  if (Firebase.RTDB.getInt(&fbdo, "configuracoes/sistema/limiteSuperior")) {
    LIMITE_SUPERIOR = fbdo.to<int>();
  }
  if (Firebase.RTDB.getBool(&fbdo, "sensorData/coletaAtiva")) {
    if (fbdo.dataTypeEnum() == fb_esp_rtdb_data_type_boolean) {
      coletaAtiva = fbdo.to<bool>();
    }
  }
}


void escutarComandos() {
  if (Firebase.RTDB.get(&fbdo, "bomba/controle")) {
    if (fbdo.dataTypeEnum() == fb_esp_rtdb_data_type_json) {
      FirebaseJson *json = fbdo.to<FirebaseJson *>();
      FirebaseJsonData result;


      if (json->get(result, "modo")) {
        if (result.success) modoAtual = result.to<String>();
      }
      if (json->get(result, "modoOperacao")) {
        if (result.success) modoOperacao = result.to<String>();
      }
      if (json->get(result, "comandoManual")) {
        if (result.success) {
          String comandoManual = result.to<String>();
          if (modoAtual == "manual" && comandoManual != "NENHUM") {
            if (comandoManual == "LIGAR") {
              digitalWrite(RELAY_PIN, LOW);
              logEvent("Bomba LIGADA manualmente.");
            } else if (comandoManual == "DESLIGAR") {
              digitalWrite(RELAY_PIN, HIGH);
              logEvent("Bomba DESLIGADA manualmente.");
            }
            Firebase.RTDB.setString(&fbdo, "bomba/controle/comandoManual", "NENHUM");
          }
        }
      }
      if (json->get(result, "comandoRestart")) {
        if (result.success && result.to<bool>() == true) {
          logEvent("Comando de reinicialização recebido.");
          Firebase.RTDB.setBool(&fbdo, "bomba/controle/comandoRestart", false);
          delay(1000);
          ESP.restart();
        }
      }
    }
  } else {
    Serial.println("Falha ao ler /bomba/controle: " + fbdo.errorReason());
  }
}


void controlarBomba() {
  int limiteInf = LIMITE_INFERIOR;
  int limiteSup = LIMITE_SUPERIOR;


  if (modoOperacao == "ferias") {
    limiteInf = LIMITE_INFERIOR_FERIAS;
    limiteSup = LIMITE_SUPERIOR_FERIAS;
  }


  statusBombaAnterior = statusBomba;


  if (modoAtual == "automatico") {
    if (nivelPercentual <= limiteInf)       digitalWrite(RELAY_PIN, LOW);
    else if (nivelPercentual >= limiteSup)  digitalWrite(RELAY_PIN, HIGH);
  }


  statusBomba = (digitalRead(RELAY_PIN) == LOW) ? "LIGADA" : "DESLIGADA";
  Firebase.RTDB.setString(&fbdo, "bomba/controle/statusBomba", statusBomba);


  if (statusBomba != statusBombaAnterior) {
    logEvent("Bomba " + statusBomba + " (Automático). Nivel: " + String(nivelPercentual) + "%");
  }
}


float lerDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duracao = pulseIn(ECHO_PIN, HIGH, 30000);
  float distancia = duracao * 0.034f / 2.0f;
  if (duracao == 0) {
    Serial.println("Timeout na leitura do sensor!");
    return alturaCaixa;
  }
  return (distancia > alturaCaixa) ? alturaCaixa : distancia;
}


void registrarHistorico() {
  if (!Firebase.ready()) return;
  String timestampKey = String(millis());
  String path = "/historico/" + timestampKey;


  if (!Firebase.RTDB.setInt(&fbdo, path + "/nivel", nivelPercentual)) {
    Serial.println("Falha ao registrar histórico (nivel): " + fbdo.errorReason());
    return;
  }
  if (!Firebase.RTDB.setInt(&fbdo, path + "/nivelReservatorio", nivelReservatorio)) {
    Serial.println("Falha ao registrar histórico (nivelReservatorio): " + fbdo.errorReason());
    return;
  }
  if (!Firebase.RTDB.setTimestamp(&fbdo, path + "/timestamp")) {
    Serial.println("Falha ao registrar histórico (timestamp): " + fbdo.errorReason());
  }
}


void logEvent(String eventMessage) {
  if (!Firebase.ready()) return;
  String timestampKey = String(millis());
  String path = "/logs/" + timestampKey;


  if (!Firebase.RTDB.setString(&fbdo_log, path + "/message", eventMessage)) {
    Serial.println("Falha ao registrar log (message): " + fbdo_log.errorReason());
    return;
  }
  if (!Firebase.RTDB.setTimestamp(&fbdo_log, path + "/timestamp")) {
    Serial.println("Falha ao registrar log (timestamp): " + fbdo_log.errorReason());
  } else {
    Serial.println("Log: " + eventMessage);
  }
}


void updateLastSeen() {
  if (!Firebase.ready()) return;
  if (!Firebase.RTDB.setTimestamp(&fbdo_lastSeen, "/sensorData/lastSeen")) {
    Serial.println("Falha ao atualizar lastSeen: " + fbdo_lastSeen.errorReason());
  }
}
