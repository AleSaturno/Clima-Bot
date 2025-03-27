require("dotenv").config();
const axios = require("axios");
const { getFullWeatherMessage, getForecastData, checkAlerts } = require("./index");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
let lastUpdateId = 0;
let cacheMensajes = {};
let cacheAuto = {};
let ubicaciones = {};

async function sendTelegramReply(chatId, text, tipo = "") {
  if (!chatId || !text) return;
  const clave = `${chatId}_${tipo}_${text}`;
  if (cacheMensajes[clave]) return;
  cacheMensajes[clave] = true;

  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "Markdown"
  });
}

setInterval(async () => {
  try {
    const res = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`);
    const updates = res.data.result;

    for (const update of updates) {
      lastUpdateId = update.update_id;
      const msg = update.message;
      if (!msg) continue;

      const chatId = msg.chat.id;
      const texto = msg.text?.toLowerCase();
      const voz = !!msg.voice;
      const location = msg.location;

      // 📍 Guardar ubicación
      if (location) {
        ubicaciones[chatId] = {
          lat: location.latitude,
          lon: location.longitude
        };

        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&appid=${process.env.API_KEY}&units=metric`;
        const r = await axios.get(url);
        const d = r.data;

        const mensaje = `📍 *Clima en ${d.name}*\n🌡️ ${d.main.temp}°C\n💧 Humedad: ${d.main.humidity}%\n💨 Viento: ${d.wind.speed} km/h\n🌥️ Estado: ${d.weather[0].description}`;
        await sendTelegramReply(chatId, mensaje, "ubicacion");
        continue;
      }

      if (!texto && !voz) continue;

      // 📦 Agrupamos respuestas por comandos
      switch (texto) {
        case "/start":
        case "/ahora":
        case "/clima":
        case "hola": {
          const mensaje = await getFullWeatherMessage();
          await sendTelegramReply(chatId, mensaje, "ahora");
          break;
        }

        case "/mas-tarde": {
          const mensaje = await getForecastData("short");
          if (mensaje) await sendTelegramReply(chatId, mensaje, "tarde");
          break;
        }

        case "/mañana": {
          const mensaje = await getForecastData("mañana");
          if (mensaje) await sendTelegramReply(chatId, mensaje, "manana");
          break;
        }

        case "/alertas": {
          const mensaje = await checkAlerts();
          await sendTelegramReply(chatId, mensaje, "alertas");
          break;
        }

        case "/ubicacion": {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: "📍 Tocá el botón para compartir tu ubicación",
            reply_markup: {
              keyboard: [[{ text: "Enviar ubicación 📍", request_location: true }]],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          });
          break;
        }

        case "/donde": {
          const u = ubicaciones[chatId];
          const msg = u
            ? `📍 Tu ubicación es:\nLat: ${u.lat}\nLon: ${u.lon}`
            : "❗ No tengo tu ubicación guardada.";
          await sendTelegramReply(chatId, msg, "ubicacion");
          break;
        }
      }

      // 🎙️ Audio
      if (voz) {
        const mensaje = await getFullWeatherMessage();
        const respuesta = `🎙️ ¡Escuché tu audio!\n\n${mensaje}`;
        await sendTelegramReply(chatId, respuesta, "voz");
        continue;
      }

      // 📬 Texto libre (respuesta automática, solo una por minuto)
      if (!texto.startsWith("/")) {
        const ahora = new Date();
        const clave = `${ahora.getHours()}:${ahora.getMinutes()}`;
        if (cacheAuto[chatId] === clave) continue;
        const mensaje = await getFullWeatherMessage();
        await sendTelegramReply(chatId, mensaje, "auto");
        cacheAuto[chatId] = clave;
      }
    }
  } catch (err) {
    console.error("❌ Error en comandos:", err.message);
  }
}, 3000);
