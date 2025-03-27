require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const {
  getCurrentWeather,
  getForecastData,
  checkAlerts,
  getFullWeatherMessage
} = require("./index");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const LAST_UPDATE_FILE = path.join(__dirname, ".data", "lastUpdate.json");
const dataDir = path.join(__dirname, ".data");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

let lastUpdateId = cargarUltimoUpdate();
let ubicacionesPorChat = {};
let cacheMensajes = {};
let cacheAutoRespuesta = {};
let procesados = new Set();
let isProcessing = false;

function cargarUltimoUpdate() {
  try {
    if (!fs.existsSync(LAST_UPDATE_FILE)) {
      fs.writeFileSync(LAST_UPDATE_FILE, JSON.stringify({ lastUpdateId: 0 }));
    }
    const data = fs.readFileSync(LAST_UPDATE_FILE, "utf-8");
    return JSON.parse(data).lastUpdateId || 0;
  } catch {
    return 0;
  }
}

function guardarUltimoUpdate(id) {
  fs.writeFileSync(LAST_UPDATE_FILE, JSON.stringify({ lastUpdateId: id }), "utf-8");
}

async function sendTelegramReply(chatId, text) {
  if (!text || !chatId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "Markdown"
    });
  } catch (e) {
    console.error("❌ Error al enviar mensaje:", e.message);
  }
}

function mensajeDeAyuda() {
  return `👋 *¡Hola! Soy tu bot del clima.*\n\n` +
    `Podés usar los siguientes comandos:\n` +
    `• /ahora → Ver clima actual\n` +
    `• /mas-tarde → Pronóstico para las próximas horas\n` +
    `• /mañana → Pronóstico para mañana\n` +
    `• /alertas → Ver alertas activas\n` +
    `• /ubicacion → Compartí tu ubicación\n` +
    `• /donde → Ver ubicación guardada\n\n` +
    `También podés escribirme un mensaje o nota de voz y te contesto 😉`;
}

function yaRespondio(chatId, tipo, mensaje) {
  const clave = `${chatId}_${tipo}`;
  if (cacheMensajes[clave] === mensaje) return true;
  cacheMensajes[clave] = mensaje;
  return false;
}

setInterval(async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const res = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`);
    const updates = res.data.result;

    for (const update of updates) {
      if (!update.message) continue;
      const id = update.update_id;
      if (id <= lastUpdateId || procesados.has(id)) continue;
      procesados.add(id);

      const chatId = update.message.chat.id;
      const msgTexto = update.message.text?.toLowerCase();
      const esVoz = !!update.message.voice;
      const location = update.message.location;

      if (!chatId) continue;

      // 📍 Ubicación
      if (location) {
        ubicacionesPorChat[chatId] = { lat: location.latitude, lon: location.longitude };
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&appid=${process.env.API_KEY}&units=metric`;
        const res = await axios.get(url);
        const data = res.data;
        const mensaje = `📍 *Clima en ${data.name}*\n` +
          `🌡️ ${data.main.temp}°C\n🥵 Sensación térmica: ${data.main.feels_like}°C\n` +
          `💧 Humedad: ${data.main.humidity}%\n💨 Viento: ${data.wind.speed} km/h\n` +
          `🌥️ Estado: ${data.weather[0].description}`;
        if (!yaRespondio(chatId, "ubicacion", mensaje)) await sendTelegramReply(chatId, mensaje);
      }

      // 🌡️ Clima actual
      else if (msgTexto === "/ahora") {
        const mensaje = await getCurrentWeather();
        if (!yaRespondio(chatId, "ahora", mensaje)) await sendTelegramReply(chatId, mensaje);
      }

      // ⏳ Más tarde
      else if (msgTexto === "/mas-tarde") {
        const mensaje = await getForecastData("short");
        if (mensaje && !yaRespondio(chatId, "mas-tarde", mensaje)) await sendTelegramReply(chatId, mensaje);
      }

      // 📅 Mañana
      else if (msgTexto === "/mañana") {
        const mensaje = await getForecastData("mañana");
        if (mensaje && !yaRespondio(chatId, "mañana", mensaje)) await sendTelegramReply(chatId, mensaje);
      }

      // ⚠️ Alertas
      else if (msgTexto === "/alertas") {
        const mensaje = await checkAlerts();
        if (!yaRespondio(chatId, "alertas", mensaje)) await sendTelegramReply(chatId, mensaje);
      }

      // 📍 Pedir ubicación
      else if (msgTexto === "/ubicacion") {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "📍 Tocá el botón para compartir tu ubicación",
          reply_markup: {
            keyboard: [[{ text: "Enviar ubicación 📍", request_location: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      }

      // 📌 Mostrar ubicación
      else if (msgTexto === "/donde") {
        const u = ubicacionesPorChat[chatId];
        const mensaje = u
          ? `📍 Tu ubicación es:\nLat: ${u.lat}\nLon: ${u.lon}`
          : "❗ No tengo tu ubicación guardada.";
        await sendTelegramReply(chatId, mensaje);
      }

      // 🚀 Start
      else if (msgTexto === "/start") {
        await sendTelegramReply(chatId, mensajeDeAyuda());
      }

      // 🎙️ Audio
      else if (esVoz) {
        const mensaje = await getFullWeatherMessage();
        const respuesta = `🎙️ ¡Escuché tu audio!\n\n${mensaje}`;
        if (!yaRespondio(chatId, "voz", respuesta)) await sendTelegramReply(chatId, respuesta);
      }

      // 🧠 Texto libre
      else if (msgTexto) {
        const ahora = new Date();
        const clave = `${chatId}_${ahora.getHours()}:${ahora.getMinutes()}`;
        if (cacheAutoRespuesta[chatId] === clave) {
          console.log("⏸️ Ya se respondió automáticamente.");
        } else {
          const mensaje = await getFullWeatherMessage();
          if (!yaRespondio(chatId, "auto", mensaje)) {
            await sendTelegramReply(chatId, mensaje);
            cacheAutoRespuesta[chatId] = clave;
          }
        }
      }

      lastUpdateId = id;
      guardarUltimoUpdate(lastUpdateId);
    }
  } catch (err) {
    console.error("❌ Error en comandos:", err.message);
  }

  isProcessing = false;
}, 4000);
