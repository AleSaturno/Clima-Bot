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
let cachePronostico = {};

// Leer lastUpdateId desde archivo
function cargarUltimoUpdate() {
  try {
    const data = fs.readFileSync(LAST_UPDATE_FILE, "utf-8");
    return JSON.parse(data).lastUpdateId || 0;
  } catch {
    return 0;
  }
}

// Guardar lastUpdateId en archivo
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
    `• /mas-tarde → Próximas horas\n` +
    `• /mañana → Día siguiente (con cache)\n` +
    `• /alertas → Ver alertas activas\n` +
    `• /donde → Mostrar ubicación guardada\n` +
    `• /ubicacion → Enviar tu ubicación fácilmente\n\n` +
    `📍 También podés enviarme tu ubicación tocando el clip 📎.`;
}

setInterval(async () => {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`;
    const res = await axios.get(url);
    const updates = res.data.result;

    if (!updates.length) return;

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
        if (ubicacionesPorChat[chatId]) {
          const { lat, lon } = ubicacionesPorChat[chatId];
          const res = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.API_KEY}&units=metric`
          );
          const data = res.data;
          const mensaje = `🌍 *Clima en ${data.name}*\n🌡️ ${data.main.temp}°C\n🌥️ Estado: ${data.weather[0].description}`;
          await sendTelegramReply(chatId, mensaje);
        } else {
          const info = await getCurrentWeather();
          await sendTelegramReply(chatId, info);
        }
      }

      else if (msgTexto === "/mas-tarde") {
        const info = await getForecastData("short");
        await sendTelegramReply(chatId, info || "⏸️ Sin cambios recientes en el pronóstico.");
      }

      else if (msgTexto === "/mañana") {
        const mensaje = await getForecastData("mañana");

        if (!mensaje) {
          await sendTelegramReply(chatId, "⏸️ Sin novedades en el pronóstico de mañana.");
        } else if (cachePronostico[chatId] === mensaje) {
          console.log("⏸️ Pronóstico igual, no se reenvía.");
        } else {
          cachePronostico[chatId] = mensaje;
          await sendTelegramReply(chatId, mensaje);
        }
      }

      else if (msgTexto === "/alertas") {
        const info = await checkAlerts();
        await sendTelegramReply(chatId, info);
      }

      else if (msgTexto === "/donde") {
        if (ubicacionesPorChat[chatId]) {
          const { lat, lon } = ubicacionesPorChat[chatId];
          const mensaje = `📍 *Tu ubicación guardada:*\nLatitud: ${lat}\nLongitud: ${lon}`;
          await sendTelegramReply(chatId, mensaje);
        } else {
          await sendTelegramReply(chatId, "❗ No tengo tu ubicación. Podés enviármela desde el clip 📎 o usando /ubicacion.");
        }
      }

      else if (msgTexto === "/ubicacion") {
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
        await axios.post(url, {
          chat_id: chatId,
          text: "📍 Enviame tu ubicación tocando el botón de abajo:",
          reply_markup: {
            keyboard: [[{
              text: "📍 Enviar ubicación",
              request_location: true
            }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      }

      else if (msgTexto === "/start") {
        await sendTelegramReply(chatId, mensajeDeAyuda());
      }

      else if (esVoz) {
        const clima = await getFullWeatherMessage();
        const mensaje = `🎙️ *¡Escuché tu audio!*\n\n${clima}`;
        await sendTelegramReply(chatId, mensaje);
      }

      else if (msgTexto) {
        const clima = await getFullWeatherMessage();
        await sendTelegramReply(chatId, clima);
      }

      // Actualizar último update procesado
      lastUpdateId = update.update_id;
      guardarUltimoUpdate(lastUpdateId);
    }
  } catch (error) {
    console.error("❌ Error al procesar comandos:", error.message);
  }
}, 5000);
