// ---------- CONFIGURAÇÃO DO FIREBASE ----------
// IMPORTANTE: Substitua os valores abaixo pelas credenciais do seu projeto Firebase!
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_PROJETO.firebasestorage.app",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID",
  measurementId: "SEU_MEASUREMENT_ID"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------- VARIÁVEIS GLOBAIS ----------
// IMPORTANTE: Insira as coordenadas geográficas da sua estação (Latitude e Longitude)
const LAT = -00.000000;   // Substitua pela sua latitude 
const LNG = -00.000000;   // Substitua pela sua longitude

// Variáveis dos Gráficos e do Letreiro
let tempChart, humChart, windChart;
const historyLen = 9000;   
const dataBuffer = { ts: [], t: [], h: [], vw: [] }; 
let previsaoTextoGlobal = "Carregando previsões..."; 

// ---------- FÓRMULAS MATEMÁTICAS ----------
function calcularPontoOrvalho(T, RH) {
    if (T === null || RH === null) return null;
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * T) / (b + T)) + Math.log(RH / 100.0);
    const dewPoint = (b * alpha) / (a - alpha);
    return dewPoint;
}

function calcularSensacaoTermica(T, RH, W_kmh) {
    if (T === null || RH === null || W_kmh === null) return null;
    let sensacao = T;
    
    if (T >= 27 && RH >= 40) {
        const c1 = -8.78469475556, c2 = 1.61139411, c3 = 2.33854883889, c4 = -0.14611605;
        const c5 = -0.012308094, c6 = -0.0164248277778, c7 = 0.002211732, c8 = 0.00072546, c9 = -0.000003582;
        sensacao = c1 + (c2*T) + (c3*RH) + (c4*T*RH) + (c5*T*T) + (c6*RH*RH) + (c7*T*T*RH) + (c8*T*RH*RH) + (c9*T*T*RH*RH);
    } else if (T <= 10 && W_kmh > 4.8) {
        sensacao = 13.12 + 0.6215*T - 11.37*Math.pow(W_kmh, 0.16) + 0.3965*T*Math.pow(W_kmh, 0.16);
    }
    return sensacao;
}

// ---------- PREVISÃO DO TEMPO 3 DIAS E LETREIRO (TICKER) ----------
async function carregarPrevisao3Dias() {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=America%2FSao_Paulo&days=4`);
        const data = await res.json();
        
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        let txtPrevisao = "";
        
        for(let i = 1; i <= 3; i++) {
            const dataObj = new Date(data.daily.time[i] + 'T12:00:00'); 
            const nomeDia = diasSemana[dataObj.getDay()];
            const tempMax = Math.round(data.daily.temperature_2m_max[i]);
            const tempMin = Math.round(data.daily.temperature_2m_min[i]);
            const code = data.daily.weathercode[i];
            
            let icon = 'Céu Limpo ☀️'; 
            if (code >= 1 && code <= 3) icon = 'Nublado ⛅'; 
            if (code >= 45 && code <= 48) icon = 'Neblina 🌫️'; 
            if (code >= 51 && code <= 67) icon = 'Chuva 🌧️'; 
            if (code >= 80 && code <= 82) icon = 'Pancadas ⛈️'; 
            if (code >= 95) icon = 'Tempestade ⚡'; 

            let label = i === 1 ? "AMANHÃ" : nomeDia.toUpperCase();
            txtPrevisao += `  •  ( ${label} ) : Mín. ${tempMin}°C | Máx. ${tempMax}°C - ${icon} `;
        }
        
        previsaoTextoGlobal = txtPrevisao;
        atualizarLetreiroAnimado();
        
    } catch(err) {
        console.error("Erro ao puxar previsão Open-Meteo: ", err);
        previsaoTextoGlobal = " Não foi possível carregar a previsão. ";
    }
}

function atualizarLetreiroAnimado() {
    const tickerEl = document.getElementById('weather-ticker-text');
    if (!tickerEl) return;

    const tempAtual = document.getElementById('temp-value')?.innerText || '--';
    const humAtual = document.getElementById('hum-value')?.innerText || '--';
    const windAtual = document.getElementById('wind-value')?.innerText || '--';
    const chuvaAtual = document.getElementById('rain-value')?.innerText || '--';

    // Monta o letreiro contínuo (Texto Genérico para o GitHub)
    let textoCompleto = `[ PREVISÃO ] ${previsaoTextoGlobal}   •   ESTAÇÃO METEOROLÓGICA IOT OPEN-SOURCE   `;

    // Duplica o texto para o efeito visual de loop infinito
    tickerEl.innerHTML = textoCompleto + textoCompleto;
}

// ---------- ATUALIZAÇÃO E ALERTAS DA UI ----------
function atualizarCard(idValor, idLabel, valor, unidade, textoLabel='') {
    const el = document.getElementById(idValor);
    if (el) el.innerHTML = valor !== null ? `${valor.toFixed(1)} <span class="fs-6">${unidade}</span>` : '--';
    if (idLabel && textoLabel) document.getElementById(idLabel).textContent = textoLabel;
}

function processarAlertas(temp, wind) {
    const alertBar = document.getElementById('alert-bar');
    const alertMsg = document.getElementById('alert-msg');
    const cardTemp = document.getElementById('card-temp');
    const cardWind = document.getElementById('card-wind');
    
    let mensagens = [];
    
    cardTemp.classList.remove('alert-flash');
    cardWind.classList.remove('alert-flash');

    if (temp >= 35) {
        mensagens.push(`Temperatura Crítica: ${temp.toFixed(1)}°C`);
        cardTemp.classList.add('alert-flash'); 
    }
    
    if (wind >= 80) {
        mensagens.push(`Ventos Fortes: ${wind.toFixed(1)} km/h`);
        cardWind.classList.add('alert-flash'); 
    }
    
    if (mensagens.length > 0) {
        alertMsg.innerText = mensagens.join('  |  ');
        alertBar.classList.remove('d-none'); 
    } else {
        alertBar.classList.add('d-none'); 
    }
}

function atualizarDadosTodos(snap) {
    if (!snap.exists()) return;

    dataBuffer.ts = [];
    dataBuffer.t = [];
    dataBuffer.h = [];
    dataBuffer.vw = [];

    const hojeInic = new Date();
    hojeInic.setHours(0,0,0,0);
    const limiteComecoDoDia = Math.floor(hojeInic.getTime() / 1000);

    let latest = null;

    snap.forEach(childSnap => {
        const data = childSnap.val();
        latest = data;
        
        if (data.ts && data.ts >= limiteComecoDoDia) {
            dataBuffer.ts.push(data.ts);
            dataBuffer.t.push((data.t !== undefined) ? data.t / 100 : null);
            dataBuffer.h.push((data.h !== undefined) ? data.h / 100 : null);
            dataBuffer.vw.push((data.vw !== undefined) ? data.vw / 10 : null);
        }
    });

    if (latest) {
        const temp = (latest.t !== undefined) ? latest.t / 100 : null;
        const hum  = (latest.h !== undefined) ? latest.h / 100 : null;
        const wind = (latest.vw !== undefined) ? latest.vw / 10 : null;
        const dir  = latest.wd || '--';
        const uv   = (latest.uvi !== undefined) ? latest.uvi / 100 : null;
        const pc   = (latest.pc !== undefined) ? latest.pc : null;
        const rain = (latest.rc !== undefined) ? (latest.rc * 0.25) : null; 
        
        const dew = calcularPontoOrvalho(temp, hum);
        const feels = calcularSensacaoTermica(temp, hum, wind);
        
        processarAlertas(temp, wind);

        atualizarCard('temp-value', 'temp-label', temp, '°C', 'Atual');
        atualizarCard('hum-value', 'hum-label', hum, '%', 'Relativa');
        atualizarCard('wind-value', 'wind-dir', wind, 'km/h', `Direção: ${dir}`);
        atualizarCard('rain-value', 'rain-label', rain, 'mm', 'Acumulado diário');
        atualizarCard('uv-value', 'uv-label', uv, '', uv !== null ? `Categoria: ${getUVCat(uv)}` : '');
        atualizarCard('prob-value', 'prob-label', pc, '%', 'Previsão Aberta');
        
        atualizarCard('dew-value', 'dew-label', dew, '°C', 'Calculado');
        atualizarCard('feels-value', 'feels-label', feels, '°C', 'Calculado');
        
        atualizarIconeClima(pc);
        desenharGraficos();
        atualizarLetreiroAnimado(); 
    }
}

function atualizarIconeClima(probValue) {
    const animContainer = document.getElementById('weather-anim-container');
    if (probValue >= 80) {
        animContainer.innerHTML = `<div class="weather-icon-wrapper"><div class="css-cloud dark-cloud"></div><div class="rain-drop" style="left: 15px; animation-delay: 0s;"></div><div class="rain-drop" style="left: 30px; animation-delay: 0.3s;"></div><div class="rain-drop" style="left: 45px; animation-delay: 0.6s;"></div></div>`;
    } else if (probValue >= 30) {
        animContainer.innerHTML = `<div class="weather-icon-wrapper"><div class="sun-behind"></div><div class="css-cloud"></div></div>`;
    } else {
        animContainer.innerHTML = `<div class="weather-icon-wrapper"><div class="glowing-sun"></div></div>`;
    }
}

// ---------- GRÁFICOS (Chart.js) ----------
function desenharGraficos() {
    const dadosTemp = dataBuffer.ts.map((ts, i) => ({ x: ts * 1000, y: dataBuffer.t[i] }));
    const dadosHum  = dataBuffer.ts.map((ts, i) => ({ x: ts * 1000, y: dataBuffer.h[i] }));
    const dadosWind = dataBuffer.ts.map((ts, i) => ({ x: ts * 1000, y: dataBuffer.vw[i] }));

    if (tempChart) {
        tempChart.data.datasets[0].data = dadosTemp;
        tempChart.update('none'); 
    }
    if (humChart) {
        humChart.data.datasets[0].data = dadosHum;
        humChart.update('none');
    }
    if (windChart) {
        windChart.data.datasets[0].data = dadosWind;
        windChart.update('none');
    }
}

function getUVCat(uv) {
    if (uv < 3) return 'BAIXO';
    if (uv < 6) return 'MODERADO';
    if (uv < 8) return 'ALTO';
    if (uv < 11) return 'MUITO ALTO';
    return 'EXTREMO';
}

// ---------- INICIALIZAÇÃO E MAPA ----------
function initMap() {
    const map = L.map('map').setView([LAT, LNG], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    // Marcador genérico do mapa
    L.marker([LAT, LNG]).addTo(map).bindPopup('<b>Estação Meteorológica</b><br>Sua Localização').openPopup();
}

function initCharts() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const dia = hoje.getDate();

    const gerarHora = (h) => new Date(ano, mes, dia, h, 0, 0, 0).getTime();

    const marcosDoDia = [
        gerarHora(0), 
        gerarHora(3), 
        gerarHora(6), 
        gerarHora(9), 
        gerarHora(12), 
        gerarHora(15), 
        gerarHora(18), 
        gerarHora(21)
    ];

    const optLine = { 
        responsive: true, 
        maintainAspectRatio: false,
        scales: {
            x: {
                type: 'linear',
                min: gerarHora(0), 
                max: new Date(ano, mes, dia, 23, 59, 59, 999).getTime(), 
                ticks: {
                    autoSkip: false,
                    maxRotation: 0,
                    callback: function(value) {
                        const d = new Date(value);
                        const h = String(d.getHours()).padStart(2, '0');
                        const m = String(d.getMinutes()).padStart(2, '0');
                        return `${h}:${m}`;
                    }
                },
                afterBuildTicks: function(scale) {
                    scale.ticks = marcosDoDia.map(h => ({ value: h }));
                }
            }
        }
    };
    
    const ctxT = document.getElementById('tempChart').getContext('2d');
    tempChart = new Chart(ctxT, {
        type: 'line',
        data: { datasets: [{ label: 'Temperatura (°C)', data: [], borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)', tension: 0.3, fill: true, pointRadius: 0 }] },
        options: optLine
    });

    const ctxH = document.getElementById('humChart').getContext('2d');
    humChart = new Chart(ctxH, {
        type: 'line',
        data: { datasets: [{ label: 'Umidade (%)', data: [], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', tension: 0.3, fill: true, pointRadius: 0 }] },
        options: optLine
    });

    const ctxW = document.getElementById('windChart').getContext('2d');
    windChart = new Chart(ctxW, {
        type: 'line',
        data: { datasets: [{ label: 'Vento (km/h)', data: [], borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.1)', tension: 0.3, fill: true, pointRadius: 0 }] },
        options: optLine
    });
}

function startListening() {
    const ref = db.ref('sensorData').orderByKey().limitToLast(historyLen);
    ref.on('value', snap => {
        atualizarDadosTodos(snap);
    });
}

function limparDadosAntigos(limiteDisparo = 10000, limiteDesejado = 5000) {
    const ref = db.ref('sensorData');
    ref.once('value').then(snap => {
        const totalRegistros = snap.numChildren();
        if (totalRegistros > limiteDisparo) {
            const quantidade = totalRegistros - limiteDesejado;
            ref.orderByKey().limitToFirst(quantidade).once('value').then(velhosSnap => {
                const updates = {};
                velhosSnap.forEach(child => { updates[child.key] = null; });
                ref.update(updates);
            });
        }
    });
}

function iniciarAutoRefresh(horas) {
    const milissegundos = horas * 60 * 60 * 1000; 
    setTimeout(() => { window.location.reload(true); }, milissegundos);
}

// ---------- INICIALIZAÇÃO GERAL ----------
window.addEventListener('load', () => {
    initMap();
    initCharts();
    carregarPrevisao3Dias(); 
    startListening();
    
    limparDadosAntigos(10000, 5000); 
    iniciarAutoRefresh(5); 
});