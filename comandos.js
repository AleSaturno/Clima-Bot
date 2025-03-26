require("dotenv").config();
const axios = require("axios");
const {
  getCurrentWeather,
  getForecastData,
  checkAlerts,
  getFullWeatherMessage
} = require("./index");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
let lastUpdateId = 0;
const ubicacionesPorChat = {}; // Memoria temporal por sesión

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
  return (
    `👋 *¡Hola! Soy tu bot del clima.*\n\n` +
    `Podés usar los siguientes comandos:\n` +
    `• /ahora → Ver clima actual\n` +
    `• /mas-tarde → Próximas horas\n` +
    `• /mañana → Día siguiente\n` +
    `• /alertas → Ver alertas activas\n` +
    `• /donde → Mostrar ubicación guardada\n` +
    `• /ubicacion → Enviar tu ubicación fácilmente\n\n` +
    `📍 También podés enviarme tu ubicación tocando el clip 📎.`
  );
}

setInterval(async () => {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`;
    const res = await axios.get(url);
    const updates = res.data.result;

    if (!updates.length) return;

    for (const update of updates) {
      const msgTexto = update.message?.text?.toLowerCase();
      const esVoz = !!update.message?.voice;
      const location = update.message?.location;
      const chatId = update.message?.chat?.id;

      if (!chatId) continue;

      // 📍 Si el usuario envía ubicación
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

      // 🧭 /ahora
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

      // ⏰ /mas-tarde o /mañana
      else if (msgTexto === "/mas-tarde" || msgTexto === "/mañana") {
        const tipo = msgTexto.includes("mañana") ? "mañana" : "short";

        if (ubicacionesPorChat[chatId]) {
          const { lat, lon } = ubicacionesPorChat[chatId];
          const res = await axios.get(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${process.env.API_KEY}&units=metric`
          );
          const list = res.data.list;

          if (tipo === "short") {
            const horas = list.slice(0, 3).map(item => {
              const hora = new Date(item.dt * 1000).toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit'
              });
              const desc = item.weather[0].description;
              return `🕒 *${hora}:* ${item.main.temp.toFixed(1)}°C, ${desc}`;
            }).join('\n');
            await sendTelegramReply(chatId, `🔮 *Próximas horas:*\n${horas}`);
          } else {
            const mañana = new Date();
            mañana.setDate(mañana.getDate() + 1);
            const fecha = mañana.toISOString().split("T")[0];
            const items = list.filter(i => i.dt_txt.startsWith(fecha));
            const temps = items.map(i => i.main.temp);
            const descs = items.map(i => i.weather[0].description);
            const min = Math.min(...temps).toFixed(1);
            const max = Math.max(...temps).toFixed(1);
            const desc = descs[Math.floor(descs.length / 2)] || descs[0];
            await sendTelegramReply(chatId, `📅 *Clima mañana*\n🌡️ Min: ${min}°C | Max: ${max}°C\n🌥️ Estado: ${desc}`);
          }
        } else {
          const info = await getForecastData(tipo);
          await sendTelegramReply(chatId, info || "⏸️ Sin cambios desde la última vez.");
        }
      }

      // ⚠️ /alertas
      else if (msgTexto === "/alertas") {
        const info = await checkAlerts();
        await sendTelegramReply(chatId, info);
      }

      // 📍 /donde
      else if (msgTexto === "/donde") {
        if (ubicacionesPorChat[chatId]) {
          const { lat, lon } = ubicacionesPorChat[chatId];
          const mensaje = `📍 *Tu ubicación guardada:*\nLatitud: ${lat}\nLongitud: ${lon}`;
          await sendTelegramReply(chatId, mensaje);
        } else {
          await sendTelegramReply(chatId, "❗ No tengo tu ubicación. Podés enviármela desde el clip 📎 o usando /ubicacion.");
        }
      }

      // 🗺️ /ubicacion con botón
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

      // 📘 /start
      else if (msgTexto === "/start") {
        await sendTelegramReply(chatId, mensajeDeAyuda());
      }

      // 🎙️ Voz
      else if (esVoz) {
        const clima = await getFullWeatherMessage();
        const mensaje = `🎙️ *¡Escuché tu audio!*\n\n${clima}`;
        await sendTelegramReply(chatId, mensaje);
      }

      // 📝 Cualquier texto
      else if (msgTexto) {
        const clima = await getFullWeatherMessage();
        await sendTelegramReply(chatId, clima);
      }
    }

    // ✅ Actualizar correctamente el último update procesado
    lastUpdateId = updates[updates.length - 1].update_id;
    console.log("✅ Último update procesado:", lastUpdateId);
  } catch (error) {
    console.error("❌ Error al procesar comandos:", error.message);
  }
}, 5000);
