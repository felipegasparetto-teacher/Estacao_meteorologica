#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include "time.h"
#include <FirebaseESP32.h>   // Biblioteca Firebase ESP32 (Mobizt) – v4.x ou superior

/* ==================== CONFIGURAÇÃO DO USUÁRIO ==================== */
// IMPORTANTE: Insira as credenciais da sua rede Wi-Fi
const char* ssid     = "NOME_DA_SUA_REDE_WIFI";
const char* password = "SENHA_DA_SUA_REDE_WIFI";

// IMPORTANTE: Substitua pelas credenciais do seu projeto Firebase
#define API_KEY          "SUA_API_KEY_AQUI"
#define FIREBASE_HOST    "URL_DO_SEU_FIREBASE_AQUI"
#define DATABASE_SECRET  "SEU_DATABASE_SECRET_AQUI"

// IMPORTANTE: Insira as coordenadas geográficas da sua estação para a API de Previsão
float latitudeForcada  = -00.000000;  // Insira sua latitude
float longitudeForcada = -00.000000;  // Insira sua longitude

/* ==================== PINOS DOS SENSORES ==================== */
const int REED      = 2;   // Pluviômetro
#define Hall_sensor 4      // Anemômetro
#define DHTPIN      5      // DHT22
#define WDIR_PIN    32     // Direção do vento (Analógico)

/* ==================== VARIÁVEIS GLOBAIS ==================== */
volatile int REEDCOUNT = 0;
volatile unsigned long lastDebounceTime = 0;
int ultimoDia = -1;

// Dados vindos da API Open-Meteo
float  meteoDaylightHoras = 0;
float  meteoSunshineHoras = 0;
float  meteoUVInst        = 0;
float  meteoUVMax         = 0;
int    meteoProbChuva     = 0;

// Anemômetro
const float pi = 3.14159265;
int period = 5000;             // 5 segundos travado medindo vento
int radius = 105;              // Raio em mm
volatile unsigned int counter = 0;
float speedwind = 0;
String direcaoParaEnvio = "";

// DHT22
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// Firebase
FirebaseConfig  config;
FirebaseAuth    auth;
FirebaseData    fbdo;

// Tempo (NTP)
const char* ntpServer     = "pool.ntp.org";
const long  gmtOffset_sec = -10800;   // GMT-3 (Brasil)
const int   daylightOffset_sec = 0;

unsigned long ultimoEnvio = 0;
const unsigned long intervaloEnvio = 10000; // Envia a cada 10 segundos

/* ==================== FUNÇÕES DE INTERRUPÇÃO ==================== */
void IRAM_ATTR addcount() {
  counter++;
}

void IRAM_ATTR rainInterrupt() {
  unsigned long agora = millis();
  if ((agora - lastDebounceTime) > 200) { 
    REEDCOUNT++;
    lastDebounceTime = agora;
  }
}

/* ==================== FUNÇÕES AUXILIARES ==================== */
String obterCategoriaUV(float uv) {
  if (uv < 3.0)  return "BAIXO";
  if (uv < 6.0)  return "MODERADO";
  if (uv < 8.0)  return "ALTO";
  if (uv < 11.0) return "MUITO ALTO";
  return "EXTREMO";
}

unsigned long getTimeStampSec() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return 0;
  }
  return mktime(&timeinfo);
}

int get_wind_direction() {
  long wds = 0;
  for (int i = 0; i < 20; i++) { 
    wds += analogRead(WDIR_PIN); 
    delay(50);
  }
  int ar = wds / 20;
  
  String txt = "";
  if (ar > 2800)       { txt = "N";  }
  else if (ar > 2300)  { txt = "NE"; }
  else if (ar > 1900)  { txt = "L";  }
  else if (ar > 1500)  { txt = "SE"; }
  else if (ar > 1100)  { txt = "S";  }
  else if (ar > 700)   { txt = "SO"; }
  else if (ar > 400)   { txt = "O";  }
  else                 { txt = "NO"; }
  
  direcaoParaEnvio = txt;
  return ar;
}

/* ==================== FUNÇÃO DE ENVIO PARA O FIREBASE ==================== */
void enviarParaFirebase() {
  Serial.println("\n--- Iniciando Ciclo de Leitura e Envio ---");

  // 1. Medição do Vento (Trava por 5 segundos acumulando pulsos)
  counter = 0;
  attachInterrupt(digitalPinToInterrupt(Hall_sensor), addcount, RISING);
  
  unsigned long start = millis();
  while (millis() < start + period) { yield(); } 
  
  detachInterrupt(digitalPinToInterrupt(Hall_sensor));
  
  unsigned int RPM = ((counter) * 60) / (period / 1000);
  float wind_ms = ((4 * pi * radius * RPM) / 60) / 1000;
  speedwind = roundf(wind_ms * 3.6 * 100) / 100.0;

  // Atualiza direção do vento
  get_wind_direction();

  // 2. Leitura do DHT22
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    Serial.println("Falha ao ler DHT22! Enviando valores zerados.");
    t = 0; h = 0;
  }

  // 3. Captura o Timestamp real do NTP
  unsigned long timestamp_atual = getTimeStampSec();

  // 4. Montagem do JSON para o Firebase
  FirebaseJson json;
  json.set("ts", timestamp_atual);
  json.set("t", (int)round(t * 100));            // Temp * 100 para o JS ler correto no WebApp
  json.set("h", (int)round(h * 100));            // Umidade * 100
  json.set("vw", (int)round(speedwind * 10));    // Vento * 10
  json.set("wd", direcaoParaEnvio);              // Texto da direção ("N", "NE"...)
  json.set("pc", meteoProbChuva);                // Probabilidade de chuva da API
  json.set("uvi", (int)round(meteoUVInst * 100));// Índice UV da API
  json.set("rc", REEDCOUNT);                     // Pulsos do Pluviômetro

  // 5. Envio Efetivo
  Serial.printf("Vento: %.2f km/h | Dir: %s | Prob. Chuva: %d%%\n", speedwind, direcaoParaEnvio.c_str(), meteoProbChuva);
  
  if (Firebase.pushJSON(fbdo, "/sensorData", json)) {
    Serial.println("-> Dados enviados ao Firebase com sucesso!");
  } else {
    Serial.println("-> Erro ao enviar ao Firebase: " + fbdo.errorReason());
  }
}

/* ==================== SETUP ==================== */
void setup() {
  Serial.begin(115200);
  delay(500);
  dht.begin();

  pinMode(REED, INPUT_PULLUP);
  pinMode(Hall_sensor, INPUT_PULLUP);
  
  // Interrupção fixa do Pluviômetro (roda direto em background)
  attachInterrupt(digitalPinToInterrupt(REED), rainInterrupt, FALLING);

  // Conexão WiFi
  WiFi.begin(ssid, password);
  Serial.print("Conectando ao WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nWiFi conectado!");

  // Sincronização de Tempo NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.print("Aguardando sincronização NTP...");
  while (!time(nullptr)) {
    delay(500); Serial.print(".");
  }
  Serial.println(" OK");

  // Configuração do Firebase
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = DATABASE_SECRET;
  config.api_key = API_KEY;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("Firebase inicializado com sucesso!");
}

/* ==================== LOOP PRINCIPAL ==================== */
void loop() {
  unsigned long agora = millis();
  
  // ---------- 1. Atualização da API Open-Meteo (A cada 15 min) ----------
  static unsigned long ultimaLeituraMeteo = 0;
  const unsigned long intervaloMeteo = 900000; // 15 minutos
  
  if (agora - ultimaLeituraMeteo >= intervaloMeteo || ultimaLeituraMeteo == 0) {
    ultimaLeituraMeteo = agora;
    Serial.println("\n[API] Buscando dados novos no Open-Meteo...");
    
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      
      // Pedimos o UV instantâneo em 'current' e o resumo do dia em 'daily'
      String url = "https://api.open-meteo.com/v1/forecast?latitude="
                   + String(latitudeForcada,6) + "&longitude="
                   + String(longitudeForcada,6)
                   + "&current=uv_index&daily=uv_index_max,daylight_duration,sunshine_duration,precipitation_probability_max&timezone=America%2FSao_Paulo";
      
      http.begin(url);
      int httpCode = http.GET();
      if (httpCode == 200) { // Sucesso HTTP
        String payload = http.getString();
        
        // JSON formatado para caber em 1500 bytes de memória de parse
        DynamicJsonDocument doc(1500);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error) {
          JsonObject current = doc["current"];
          JsonObject daily = doc["daily"];
          
          if (!current.isNull() && !daily.isNull()) {
            // Duração do dia e sol direto da API (Convertendo segundos para horas decimais)
            meteoDaylightHoras = (float)daily["daylight_duration"][0] / 3600.0;
            meteoSunshineHoras = (float)daily["sunshine_duration"][0] / 3600.0;
            
            // UV Instantâneo (obtido do exato momento atual)
            meteoUVInst        = (float)current["uv_index"];
            
            // UV Máximo previsto para o dia de hoje
            meteoUVMax         = (float)daily["uv_index_max"][0];
            
            // Probabilidade MÁXIMA de chuva para o dia de hoje
            meteoProbChuva     = (int)daily["precipitation_probability_max"][0];
            
            Serial.println("[API] Dados da API atualizados com sucesso!");
          } else {
            Serial.println("[API] Erro: Estrutura 'current' ou 'daily' ausente no JSON.");
          }
        } else {
          Serial.print("[API] Falha ao fazer parse JSON: ");
          Serial.println(error.c_str());
        }
      } else {
        Serial.printf("[API] Erro Open-Meteo HTTP: %d\n", httpCode);
      }
      http.end();
    } else {
      Serial.println("[API] Sem Wi-Fi, pulando atualização da Open-Meteo.");
    }

    Serial.println("--- Valores da API Open-Meteo ---");
    Serial.printf("Horas de luz do dia: %.2f h\n", meteoDaylightHoras);
    Serial.printf("Horas de sol direto: %.2f h\n", meteoSunshineHoras);
    Serial.printf("UV instantaneo: %.2f - Categoria: %s\n", meteoUVInst, obterCategoriaUV(meteoUVInst).c_str());
    Serial.printf("UV Maximo do dia: %.2f\n", meteoUVMax);
    Serial.printf("Probabilidade de Chuva Hoje: %d%%\n", meteoProbChuva);
    Serial.println("---------------------------------");
  }

  // ---------- 2. Envio Periódico para o Firebase ----------
  if (agora - ultimoEnvio >= intervaloEnvio || ultimoEnvio == 0) {
    ultimoEnvio = agora;
    if (WiFi.status() == WL_CONNECTED) {
      enviarParaFirebase();
    } else {
      Serial.println("Sem WiFi para enviar ao Firebase.");
    }
  }

  delay(10); // Estabilidade do sistema e watchdog
}