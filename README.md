
# 🌤️ Estação Meteorológica IoT & Dashboard Web
![Status](https://img.shields.io/badge/Status-Ativo-success)
![Hardware](https://img.shields.io/badge/Hardware-ESP32-blue)
![Frontend](https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JS-orange)
![Database](https://img.shields.io/badge/Database-Firebase-yellow)
![License](https://img.shields.io/badge/License-MIT-green)

Um projeto completo de código aberto (Hardware + Software) para construir sua própria **Estação Meteorológica Automática** com telemetria via Wi-Fi. O sistema coleta dados climáticos locais através de um microcontrolador ESP32 equipado com sensores atmosféricos, integra com a API *Open-Meteo* para previsões do tempo e envia tudo em tempo real para o Firebase.

Os dados são visualizados em um Dashboard Web elegante e responsivo, ideal para ser exibido em monitores ou TVs (Modo Kiosk).

---

## ✨ Funcionalidades

* **Monitoramento em Tempo Real:** Temperatura, Umidade (DHT22), Direção do Vento (Cata-vento analógico), Velocidade do Vento (Anemômetro) e Índice Pluviométrico (Pluviômetro).
* **Cálculos Automáticos:** Ponto de Orvalho e Sensação Térmica efetuados diretamente no ecossistema de dados.
* **Integração de Previsão:** Busca probabilidade de chuva, índices UV e previsão para os próximos dias via [Open-Meteo API](https://open-meteo.com/).
* **Dashboard Kiosk-Ready:** Interface otimizada para monitores de TV com letreiro digital (ticker) animado, gráficos históricos dinâmicos (Chart.js) e mapa (Leaflet).
* **Banco de Dados Cloud:** Armazenamento seguro e em tempo real utilizando o Firebase Realtime Database.

---

## 🛠️ Arquitetura e Estrutura de Arquivos

Ao clonar este repositório, você encontrará 4 arquivos essenciais que compõem o ecossistema da estação:

1. 📄 `estacao_meteorologica.ino` $\rightarrow$ Código em C++ para gravação no microcontrolador ESP32.
2. 📄 `index.html` $\rightarrow$ Estrutura principal do painel Web (Dashboard).
3. 📄 `style.css` $\rightarrow$ Estilização do painel (Otimizado com Zoom de 75% para visualização em TVs).
4. 📄 `script.js` $\rightarrow$ Lógica do frontend: comunicação com o Firebase, renderização de gráficos e atualização de dados.

---

## 🔌 Hardware e Esquema de Ligação (Pinout)

Para montar a estação física, você precisará de uma placa **ESP32** e dos sensores listados abaixo. Conecte-os seguindo a tabela de pinagem:

| Componente / Sensor | Pino no ESP32 | Tipo de Sinal | Observação de Ligação |
| --- | --- | --- | --- |
| **Pluviômetro** (Reed Switch) | `GPIO 2` | Digital (Interrupção) | Usa resistor de Pull-Up interno (`INPUT_PULLUP`). Ligar entre o Pino 2 e o GND. |
| **Anemômetro** (Sensor Hall) | `GPIO 4` | Digital (Interrupção) | Usa resistor de Pull-Up interno (`INPUT_PULLUP`). Ligar entre o Pino 4 e o GND. |
| **Sensor Temp/Umid** (DHT22) | `GPIO 5` | Digital (Dados) | Requer resistor pull-up externo de 10kΩ entre o VCC (3.3V) e o pino de DATA. |
| **Cata-vento** (Direção do Vento) | `GPIO 32` | Analógico | O sensor varia a resistência. Monte um divisor de tensão e ligue no ADC (Pino 32). |

---

## 🚀 Guia Passo a Passo: Como montar a sua

### Passo 1: Configurar o Firebase (Banco de Dados Cloud)

O Firebase atuará como a ponte (backend) entre sua placa ESP32 e seu Dashboard web.

1. Acesse o [Firebase Console](https://console.firebase.google.com/) e crie um novo projeto.
2. No menu lateral, acesse **Realtime Database** e clique em "Criar banco de dados".
3. Inicie no **Modo de Teste** (isso configura as regras de leitura/escrita para `true` temporariamente, facilitando os testes iniciais).
4. Registre uma aplicação Web (clique no ícone `</>` na visão geral do projeto) para gerar suas credenciais. Guarde o objeto `firebaseConfig` gerado.
5. Para o ESP32: Vá em **Configurações do Projeto** (ícone de engrenagem) $\rightarrow$ **Contas de Serviço** $\rightarrow$ **Segredos do banco de dados**. Clique em mostrar e copie o seu `DATABASE_SECRET`.

### Passo 2: Configurar o ESP32 (Firmware)

1. Abra o arquivo `estacao_meteorologica.ino` na **Arduino IDE**.
2. Instale as dependências através do Gerenciador de Bibliotecas da IDE (`Ctrl + Shift + I`):
* `DHT sensor library` (por Adafruit)
* `ArduinoJson` (por Benoit Blanchon)
* `Firebase ESP32 Client` (por Mobizt - versão 4.x ou superior)


3. Modifique as linhas no cabeçalho do código com suas credenciais de rede e chaves do banco de dados:

```cpp
const char* ssid     = "NOME_DA_SUA_REDE_WIFI";
const char* password = "SENHA_DA_SUA_REDE_WIFI";

#define API_KEY          "SUA_API_KEY_DO_FIREBASE"
#define FIREBASE_HOST    "SEU_PROJETO-default-rtdb.firebaseio.com" // Remova o https:// e a / no final
#define DATABASE_SECRET  "SEU_DATABASE_SECRET_COPIADO_NO_PASSO_1"

// Coordenadas geográficas para a API de previsão Open-Meteo
float latitudeForcada  = -23.550520;  // Exemplo: São Paulo (Modifique para sua região)
float longitudeForcada = -46.633308;

```

4. Conecte o ESP32 ao computador via cabo USB, selecione a porta COM correspondente e a sua placa (ex: DOIT ESP32 DEVKIT V1) e clique em Carregar. Abra o Monitor Serial (ajustado para 115200 baud) para verificar as mensagens de depuração de Wi-Fi e Firebase.

### Passo 3: Configurar o Dashboard Web e a Estrutura de Dados (script.js)

Agora precisamos configurar o arquivo javascript responsável pelo frontend para escutar os dados em tempo real que o ESP32 está publicando no banco. Além disso, é fundamental entender o que e como o ESP32 deve enviar os dados para que o dashboard os interprete corretamente.

1. Abra o arquivo `script.js` em um editor de código (como VS Code ou Notepad++).
2. Localize a constante `firebaseConfig` posicionada exatamente no topo do arquivo. Substitua as strings de exemplo com os dados que você gerou no passo 1.4 dentro do console do Firebase:

```javascript
// ---------- CONFIGURAÇÃO DO FIREBASE ----------
// IMPORTANTE: Substitua os valores abaixo pelas credenciais do seu projeto Firebase!
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_PROJETO.firebasestorage.app",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

```

3. No mesmo arquivo `script.js`, atualize as constantes globais de geolocalização (`LAT` e `LNG`) com as coordenadas exatas da sua estação. Isso garantirá que o mapa renderize sua posição corretamente e que a API de previsão busque o clima exato da sua região.

#### Entendendo o Payload de Dados (O que o ESP32 envia)

Para que os gráficos históricos e os cards em tempo real do dashboard funcionem, o código em C++ do ESP32 envia periodicamente um objeto JSON estruturado para o nó `/sensorData` do seu Firebase Realtime Database.

Uma técnica avançada de otimização utilizada no firmware (`estacao_meteorologica.ino`) é a eliminação do envio de variáveis de ponto flutuante (*floats*). O ESP32 multiplica os valores decimais para enviá-los como números inteiros, economizando largura de banda, reduzindo o tamanho do banco de dados e evitando problemas de precisão no JSON. O frontend (`script.js`) se encarrega de dividir esses valores novamente para a exibição.

A estrutura exata do JSON que o ESP32 monta e que o painel Web obrigatoriamente espera receber é a seguinte:

| Chave JSON | Descrição do Dado | Formato de Envio (ESP32) | Tratamento no Dashboard (JS) |
| --- | --- | --- | --- |
| **ts** | Timestamp atual (NTP) | É enviado o segundo atual (Ex: 1718000000) | Usado no eixo X dos gráficos (Chart.js) |
| **t** | Temperatura (DHT22) | Multiplicado por 100 | Dividido por 100 para voltar a decimal |
| **h** | Umidade (DHT22) | Multiplicado por 100 | Dividido por 100 para voltar a decimal |
| **vw** | Velocidade do Vento | Multiplicado por 10 | Dividido por 10 para voltar a decimal |
| **wd** | Direção do Vento | String de texto curta (Ex: "N", "NE", "SO") | Exibido diretamente no card do vento |
| **pc** | Prob. de Chuva (API) | Número inteiro (0 a 100) | Define a animação dinâmica do ícone do clima |
| **uvi** | Índice UV (API) | Multiplicado por 100 | Dividido por 100 e classificado por risco |
| **rc** | Pulsos do Pluviômetro | Número de pulsos lidos (Reed Switch) | Multiplicado por 0.25mm para calcular o acumulado |

> 💡 **Dica de Arquitetura:** Se você decidir customizar ou adicionar novos sensores físicos no arquivo `estacao_meteorologica.ino`, lembre-se de manter o padrão de utilizar chaves curtas (ex: criar um "press" ao invés de "pressao_atmosferica_absoluta") no JSON para não sobrecarregar o tráfego MQTT/HTTP com strings muito longas a cada 10 segundos.

### Passo 4: Executar e Exibir o Dashboard

O frontend deste projeto foi desenvolvido com uma arquitetura *Stateless Serverless*, ou seja, não precisa de um servidor local complexo ou interpretador de backend (Node.js, PHP, Python) para rodar, funcionando direto no navegador.

* **Execução Local:** Basta realizar um duplo clique direto sobre o arquivo `index.html` para abri-lo de forma instantânea em seu navegador web (Google Chrome, Edge, Firefox). Caso prefira o fluxo de desenvolvimento contínuo, utilize a extensão "Live Server" no VS Code.
* **Hospedagem em Produção (Opcional):** Para que você ou outras pessoas consigam monitorar a estação de qualquer lugar do mundo externamente, você pode realizar o deploy gratuito e estático dos arquivos web (`index.html`, `style.css`, `script.js`) no GitHub Pages, Vercel, Netlify ou no próprio Firebase Hosting.
* **Modo Kiosk (TVs/Monitores):** Caso monte um painel fixo de monitoramento com uma TV dedicada, abra a URL do painel no navegador, mude o zoom para que fique adequado e tecle `F11` para ativar o modo Tela Cheia. As folhas de estilo contidas no `style.css` já aplicam um recuo de layout por zoom: 0.75 para mitigar barras de rolagem desnecessárias e otimizar a leitura à distância.

---

## 🤝 Contribuições

Sinta-se à vontade para realizar um *Fork* do projeto, criar *branches* com novas implementações de hardware (como inclusão de sensores de pressão barométrica BMP280, sensores de gás/qualidade do ar MQ-135) ou customizações de UI nos gráficos e submeter um *Pull Request*. Toda melhoria de engenharia é muito bem-vinda!

---

Desenvolvido para amantes do IoT e da Engenharia Meteorológica ⛈️🚀
