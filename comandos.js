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

let ubicacionesPorChat = {};
let cacheMensajes = {};
let cacheAutoRespuesta = {};
let isProcessing = false;

function cargarUltimoUpdate() {
  try {
    const data = fs.readFileSync(LAST_UPDATE_FILE, "utf-8");
    return JSON.parse(data).lastUpdateId || 0;
  } catch {
    return 0;
  }
}

function guardarUltimoUpdate(id) {
  fs.writeFileSync(LAST_UPDATE_FILE, JSON.stringify({ lastUpdateId: id }), "utf-8");
}

let lastUpdateId = cargarUltimoUpdate();

async function sendTelegramReply(chatId, text) {
  if (!text || !chatId) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text,
    parse_mode: "Markdown"
  });
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

setInterval(async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`;
    const res = await axios.get(url);
    const updates = res.data.result;

    if (!updates.length) {
      isProcessing = false;
      return;
    }

    for (const update of updates) {
      if (update.update_id <= lastUpdateId) continue;

      const msgTexto = update.message?.text?.toLowerCase();
      const esVoz = !!update.message?.voice;
      const location = update.message?.location;
      const chatId = update.message?.chat?.id;

      if (!chatId) continue;

      if (location) {
        ubicacionesPorChat[chatId] = {
          lat: location.latitude,
          lon: location.longitude
        };

        const res = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&appid=${process.env.API_KEY}&units=metric`
        );
        const data = res.data;
        const mensaje = `📍 *Clima en ${data.name}*\n` +
          `🌡️ ${data.main.temp}°C\n🥵 Sensación térmica: ${data.main.feels_like}°C\n` +
          `💧 Humedad: ${data.main.humidity}%\n💨 Viento: ${data.wind.speed} km/h\n` +
          `🌥️ Estado: ${data.weather[0].description}`;
        await sendTelegramReply(chatId, mensaje);
      }

      else if (msgTexto === "/ahora") {
        const mensaje = await getCurrentWeather();
        if (cacheMensajes[chatId] !== mensaje) {
          cacheMensajes[chatId] = mensaje;
          await sendTelegramReply(chatId, mensaje);
        }
      }

      else if (msgTexto === "/mas-tarde") {
        const mensaje = await getForecastData("short");
        if (cacheMensajes[chatId + "_tarde"] !== mensaje) {
          cacheMensajes[chatId + "_tarde"] = mensaje;
          await sendTelegramReply(chatId, mensaje);
        }
      }

      else if (msgTexto === "/mañana") {
        const mensaje = await getForecastData("mañana");
        if (cacheMensajes[chatId + "_mañana"] !== mensaje) {
          cacheMensajes[chatId + "_mañana"] = mensaje;
          await sendTelegramReply(chatId, mensaje);
        }
      }

      else if (msgTexto === "/alertas") {
        const mensaje = await checkAlerts();
        await sendTelegramReply(chatId, mensaje);
      }

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

      else if (msgTexto === "/donde") {
        if (ubicacionesPorChat[chatId]) {
          const { lat, lon } = ubicacionesPorChat[chatId];
          await sendTelegramReply(chatId, `📍 Tu ubicación actual es:\nLat: ${lat}\nLon: ${lon}`);
        } else {
          await sendTelegramReply(chatId, "❗ No tengo tu ubicación guardada.");
        }
      }

      else if (msgTexto === "/start") {
        await sendTelegramReply(chatId, mensajeDeAyuda());
      }

      else if (esVoz) {
        const mensaje = await getFullWeatherMessage();
        await sendTelegramReply(chatId, `🎙️ ¡Escuché tu audio!\n\n${mensaje}`);
      }

      else if (msgTexto) {
        const ahora = new Date();
        const claveMinuto = `${ahora.getHours()}:${ahora.getMinutes()}`;

        if (cacheAutoRespuesta[chatId] === claveMinuto) {
          console.log("⏸️ Respuesta automática ya enviada este minuto.");
        } else {
          const mensaje = await getFullWeatherMessage();
          if (cacheMensajes[chatId + "_auto"] !== mensaje) {
            cacheMensajes[chatId + "_auto"] = mensaje;
            cacheAutoRespuesta[chatId] = claveMinuto;
            await sendTelegramReply(chatId, mensaje);
          }
        }
      }

      lastUpdateId = update.update_id;
      guardarUltimoUpdate(lastUpdateId);
    }
  } catch (error) {
    console.error("❌ Error en comandos:", error.message);
  }

  isProcessing = false;
}, 4000);
