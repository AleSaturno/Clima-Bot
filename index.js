require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.API_KEY?.trim();
const CITY = process.env.CITY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MODO_BOT_PRIVADO = process.env.MODO_BOT_PRIVADO === "true";
const DEBUG = process.env.DEBUG === "true";

const API_URL = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric`;
const FORECAST_URL = `https://api.openweathermap.org/data/2.5/forecast?q=${CITY}&appid=${API_KEY}&units=metric`;

let lastTemp = null;
let mensajesEnviados = [];
let ultimoMensajeClima = "";
let ultimoMensajeManana = "";
let ultimoMensajeMasTarde = "";

function logDebug(...args) {
    if (DEBUG) console.log(...args);
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function generarSaludo() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "🌅 *Buenos días!*";
    if (hora >= 12 && hora < 19) return "☀️ *Buenas tardes!*";
    return "🌙 *Buenas noches!*";
}

function traducirDescripcion(desc) {
    const traducciones = {
        "clear sky": "Cielo despejado",
        "few clouds": "Pocas nubes",
        "scattered clouds": "Nubes dispersas",
        "broken clouds": "Nubes rotas",
        "overcast clouds": "Nublado",
        "light rain": "Lluvia ligera",
        "moderate rain": "Lluvia moderada",
        "heavy intensity rain": "Lluvia fuerte",
        "thunderstorm": "Tormenta eléctrica",
        "snow": "Nieve",
        "mist": "Niebla"
    };
    return traducciones[desc.toLowerCase()] || capitalize(desc);
}

async function sendTelegramNotification(message) {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        const res = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        });
        mensajesEnviados.push(res.data.result.message_id);
        logDebug("📤 Mensaje enviado a Telegram:", message);
    } catch (error) {
        logDebug("❌ Error al enviar a Telegram:", error.response?.data || error.message);
    }
}

async function eliminarMensajesDelDia() {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`;
    for (const id of mensajesEnviados) {
        try {
            await axios.post(url, {
                chat_id: TELEGRAM_CHAT_ID,
                message_id: id
            });
        } catch {
            logDebug("⚠️ No se pudo borrar mensaje:", id);
        }
    }
    mensajesEnviados = [];
    ultimoMensajeClima = "";
    ultimoMensajeManana = "";
    ultimoMensajeMasTarde = "";
    logDebug("🧹 Historial de mensajes limpiado");
}

async function sendWeatherToTelegram(data) {
    const mensaje = await getFullWeatherMessage();
    if (mensaje !== ultimoMensajeClima) {
        await sendTelegramNotification(mensaje);
        ultimoMensajeClima = mensaje;
    } else {
        logDebug("⏸️ Clima sin cambios. No se volvió a enviar.");
    }

    const temp = data.main.temp;
    if (temp <= 0) await sendTelegramNotification(`🧊 *Frío extremo:* ${temp}°C ❄️`);
    if (temp >= 35) await sendTelegramNotification(`🥵 *Calor extremo:* ${temp}°C 🔥`);
}

async function getFullWeatherMessage() {
    const res = await axios.get(API_URL);
    const data = res.data;

    const temp = data.main.temp;
    const feelsLike = data.main.feels_like;
    const humidity = data.main.humidity;
    const wind = data.wind.speed;
    const description = traducirDescripcion(data.weather[0].description);
    const saludo = generarSaludo();

    return `${saludo}\n\n` +
        `🌤️ *Clima actual en ${CITY}*\n` +
        `🌡️ *Temperatura:* ${temp}°C\n` +
        `🥵 *Sensación térmica:* ${feelsLike}°C\n` +
        `🌥️ *Estado:* ${description}\n` +
        `💧 *Humedad:* ${humidity}%\n` +
        `💨 *Viento:* ${wind} km/h\n\n` +
        `📆 Si querés saber cómo estará *más tarde*, usá */mas-tarde*\n` +
        `📅 Y si querés saber cómo estará *mañana*, usá */mañana* 😊`;
}

async function getForecastData(tipo = "mañana") {
    const res = await axios.get(FORECAST_URL);
    const list = res.data.list;

    if (tipo === "short") {
        const horas = list.slice(0, 3).map(item => {
            const hora = new Date(item.dt * 1000).toLocaleTimeString('es-AR', {
                hour: '2-digit', minute: '2-digit'
            });
            const desc = traducirDescripcion(item.weather[0].description);
            return `🕒 *${hora}:* ${item.main.temp.toFixed(1)}°C, ${desc}`;
        }).join('\n');
        const mensaje = `🔮 *Próximas horas:*\n${horas}`;
        if (mensaje !== ultimoMensajeMasTarde) {
            ultimoMensajeMasTarde = mensaje;
            return mensaje;
        } else {
            return null;
        }
    } else {
        const mañana = new Date();
        mañana.setDate(mañana.getDate() + 1);
        const mañanaStr = mañana.toISOString().split("T")[0];
        const [yyyy, mm, dd] = mañanaStr.split("-");
        const formateada = `${dd}/${mm}/${yyyy}`;

        const items = list.filter(i => i.dt_txt.startsWith(mañanaStr));
        const temps = items.map(i => i.main.temp);
        const descripciones = items.map(i => i.weather[0].description);

        const min = Math.min(...temps).toFixed(1);
        const max = Math.max(...temps).toFixed(1);
        const desc = traducirDescripcion(descripciones[Math.floor(descripciones.length / 2)] || descripciones[0]);

        const mensaje = `📅 *Pronóstico para mañana (${formateada}):*\n` +
            `🌡️ Mínima: ${min}°C | Máxima: ${max}°C\n` +
            `🌥️ Estado general: ${desc}`;

        if (mensaje !== ultimoMensajeManana) {
            ultimoMensajeManana = mensaje;
            return mensaje;
        } else {
            return null;
        }
    }
}

async function checkAlerts() {
    const clima = await axios.get(API_URL);
    const forecast = await axios.get(FORECAST_URL);
    const list = forecast.data.list;

    const temp = clima.data.main.temp;
    let alertas = [];

    if (temp <= 0) alertas.push(`🧊 *Frío extremo:* ${temp}°C ❄️`);
    if (temp >= 35) alertas.push(`🥵 *Calor extremo:* ${temp}°C 🔥`);

    const lluvia = list.slice(0, 3).some(item =>
        item.weather[0].main.toLowerCase().includes("rain") ||
        item.weather[0].description.toLowerCase().includes("lluvia")
    );
    if (lluvia) alertas.push("🌧️ *Lluvia inminente en las próximas horas*");

    return alertas.length
        ? `⚠️ *Alertas activas:*\n` + alertas.join('\n')
        : "✅ No hay alertas activas por ahora.";
}

async function checkWeather() {
    logDebug(`⏰ [${new Date().toLocaleTimeString()}] Ejecutando checkWeather()`);

    try {
        const response = await axios.get(API_URL);
        const data = response.data;
        const temp = data.main.temp;

        await sendWeatherToTelegram(data);

        if (lastTemp !== null && Math.abs(temp - lastTemp) >= 5) {
            await sendTelegramNotification(`⚠️ *Cambio brusco en la temperatura:* ${lastTemp}°C → ${temp}°C`);
        }

        lastTemp = temp;
    } catch (error) {
        logDebug("❌ Error en checkWeather():", error.message);
    }
}

// ⏰ Cron programado
if (MODO_BOT_PRIVADO) {
    cron.schedule("*/30 * * * *", checkWeather);
    cron.schedule("1 0 * * *", eliminarMensajesDelDia);
}

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor en http://localhost:${PORT}`);
        if (MODO_BOT_PRIVADO) checkWeather();
    });
}

// Exportaciones para comandos.js
module.exports = {
    getCurrentWeather: async () => {
        const res = await axios.get(API_URL);
        const data = res.data;
        const desc = traducirDescripcion(data.weather[0].description);
        return `🌤️ *Clima actual en ${CITY}*\n` +
            `🌡️ Temperatura: ${data.main.temp}°C\n` +
            `🌥️ Estado: ${desc}\n` +
            `💧 Humedad: ${data.main.humidity}%\n` +
            `💨 Viento: ${data.wind.speed} km/h`;
    },
    getForecastData,
    checkAlerts,
    getFullWeatherMessage
};
