# 🌤️ Estação Meteorológica IoT & Dashboard Web

Estação meterológica para interessados em fazer o upload no firebase ou similar

![Status](https://img.shields.io/badge/Status-Ativo-success)
![Hardware](https://img.shields.io/badge/Hardware-ESP32-blue)
![Frontend](https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JS-orange)
![Database](https://img.shields.io/badge/Database-Firebase-yellow)
![License](https://img.shields.io/badge/License-MIT-green)

Um projeto completo de código aberto (Hardware + Software) para construir sua própria **Estação Meteorológica Automática** com telemetria via Wi-Fi. O sistema coleta dados climáticos locais através de um microcontrolador ESP32, integra com a API *Open-Meteo* para previsões do tempo e envia tudo em tempo real para o Firebase. Os dados são visualizados em um Dashboard Web elegante e responsivo, ideal para ser exibido em monitores ou TVs (Modo Kiosk).

---

## ✨ Funcionalidades
- **Monitoramento em Tempo Real:** Temperatura, Umidade, Direção e Velocidade do Vento, e Índice Pluviométrico.
- **Cálculos Automáticos:** Ponto de Orvalho e Sensação Térmica.
- **Integração de Previsão:** Busca probabilidade de chuva, índices UV e previsão para os próximos 3 dias via [Open-Meteo API](https://open-meteo.com/).
- **Dashboard Kiosk-Ready:** Interface otimizada para monitores de TV com letreiro digital (ticker) animado, gráficos históricos dinâmicos (Chart.js) e mapa (Leaflet).
- **Banco de Dados Cloud:** Armazenamento seguro e rápido usando o Firebase Realtime Database.

---

## 🛠️ Arquitetura e Estrutura de Arquivos

Ao clonar este repositório, você encontrará 4 arquivos essenciais:

1. 📄 `estacao_meteorologica.ino` $\rightarrow$ Código em C++ para gravar no ESP32.
2. 📄 `index.html` $\rightarrow$ Estrutura principal do painel Web.
3. 📄 `style.css` $\rightarrow$ Estilização do painel (Otimizado com Zoom de 75% para TVs).
4. 📄 `script.js` $\rightarrow$ Lógica de comunicação com o Firebase, geração de gráficos e alertas.

---

## 🔌 Hardware e Esquema de Ligação (Pinout)

Para montar a estação, você precisará de um **ESP32** e os seguintes sensores. Conecte-os seguindo a tabela abaixo:

| Componente / Sensor | Pino no ESP32 | Tipo de Sinal | Observação no Código |
| :--- | :---: | :---: | :--- |
| **Pluviômetro** (Reed Switch) | `GPIO 2` | Digital (Interrupção) | Usa resistor de Pull-Up interno (`INPUT_PULLUP`). Liga no Pino 2 e GND. |
| **Anemômetro** (Sensor Hall) | `GPIO 4` | Digital (Interrupção) | Usa resistor de Pull-Up interno (`INPUT_PULLUP`). Liga no Pino 4 e GND. |
| **Sensor Temp/Umid** (DHT22) | `GPIO 5` | Digital (Dados) | Requer resistor pull-up externo de 10k entre VCC e DATA. |
| **Cata-vento** (Direção do Vento) | `GPIO 32` | Analógico | O sensor varia a resistência. Forme um divisor de tensão e ligue no ADC (Pino 32). |

---

## 🚀 Guia Passo a Passo: Como montar a sua

### Passo 1: Configurar o Firebase (Banco de Dados)
1. Acesse o [Firebase Console](https://console.firebase.google.com/) e crie um novo projeto.
2. Adicione um **Realtime Database** e inicie no modo de teste (ou configure as regras de leitura/escrita para `true`).
3. Nas configurações do projeto (Engrenagem $\rightarrow$ Configurações do Projeto), adicione um aplicativo Web e guarde as chaves de configuração (`apiKey`, `databaseURL`, etc).
4. Vá em **Contas de Serviço** $\rightarrow$ **Segredos do banco de dados** e copie o seu `DATABASE_SECRET` (necessário para o ESP32).

### Passo 2: Configurar o ESP32 (Firmware)
1. Abra o arquivo `estacao_meteorologica.ino` na **Arduino IDE**.
2. Instale as bibliotecas necessárias pelo Gerenciador de Bibliotecas:
   - `DHT sensor library` (por Adafruit)
   - `ArduinoJson` (por Benoit Blanchon)
   - `Firebase ESP32 Client` (por Mobizt)
3. Modifique as seguintes linhas no topo do código com as suas credenciais:
   ```cpp
   const char* ssid     = "NOME_DA_SUA_REDE_WIFI";
   const char* password = "SENHA_DA_SUA_REDE_WIFI";

   #define API_KEY          "SUA_API_KEY_AQUI"
   #define FIREBASE_HOST    "URL_DO_SEU_FIREBASE_AQUI" (Sem o https://)
   #define DATABASE_SECRET  "SEU_DATABASE_SECRET_AQUI"
   
   // Coordenadas geográficas para a API Open-Meteo (Use o Google Maps para achar)
   float latitudeForcada  = -00.000000;  
   float longitudeForcada = -00.000000;
