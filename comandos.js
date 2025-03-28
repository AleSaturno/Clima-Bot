require("dotenv").config();
const axios = require("axios");
const {
  getCurrentWeather,
  getForecastData,
  checkAlerts,
  getFullWeatherMessage,
  getWeatherByCoordinates
} = require("./index");

// Importamos el módulo de suscriptores
const { addSubscriber, removeSubscriber } = require("./subscriberService");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
let lastUpdateId = 0;

function mensajeDeAyuda() {
  return (
    `👋 *¡Hola! Soy tu bot del clima.*\n\n` +
    `Podés usar los siguientes comandos:\n` +
    `• /ahora o /a → Clima actual\n` +
    `• /mas-tarde o /mt → Pronóstico próximas horas\n` +
    `• /mañana o /m → Pronóstico del día siguiente\n` +
    `• /alertas o /al → Alertas de clima\n` +
    `• /ubicacion o /ub → Compartir ubicación\n` +
    `• /subscribe → Suscribirte a las alertas automáticas\n` +
    `• /unsubscribe → Darse de baja de las alertas automáticas\n` +
    `• /start → Muestra este mensaje de ayuda\n\n` +
    `🌤️ ¡Estoy listo para informarte!`
  );
}

async function sendTelegramReply(chatId, text) {
  if (!text || !chatId) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text,
    parse_mode: "Markdown"
  });
}

async function sendTelegramKeyboard(chatId, text, keyboard) {
  if (!text || !chatId) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
}

// Mapeo de comandos y sus alias
const comandos = {
  "/ahora": getCurrentWeather,
  "/a": getCurrentWeather,
  "/mas-tarde": () => getForecastData("short"),
  "/mt": () => getForecastData("short"),
  "/mañana": () => getForecastData("mañana"),
  "/m": () => getForecastData("mañana"),
  "/alertas": checkAlerts,
  "/al": checkAlerts,
  "/start": () => Promise.resolve(mensajeDeAyuda())
};

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

      console.log(
        "📥 Mensaje recibido:",
        msgTexto || (esVoz && "[voz]") || (location && "[ubicación]"),
        "de", chatId
      );
      if (!chatId) continue;

      // Si se envía una ubicación (mensaje que ya contiene coordenadas)
      if (location) {
        const { latitude, longitude } = location;
        const info = await getWeatherByCoordinates(latitude, longitude);
        await sendTelegramReply(chatId, info);
      }
      // Si el usuario envía el comando para compartir ubicación, se envía teclado
      else if (msgTexto === "/ubicacion" || msgTexto === "/ubicación" || msgTexto === "/ub") {
        const keyboard = {
          keyboard: [
            [{ text: "Compartir ubicación", request_location: true }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        };
        await sendTelegramKeyboard(
          chatId,
          "📍 Toca el botón para compartir tu ubicación.",
          keyboard
        );
      }
      // Comando para suscribirse a alertas
      else if (msgTexto === "/subscribe") {
        addSubscriber(chatId);
        await sendTelegramReply(chatId, "✅ Te has suscrito a las alertas automáticas de clima.");
      }
      // Comando para darse de baja de alertas
      else if (msgTexto === "/unsubscribe") {
        removeSubscriber(chatId);
        await sendTelegramReply(chatId, "❌ Te has dado de baja de las alertas automáticas de clima.");
      }
      // Si el mensaje coincide con algún comando del mapeo
      else if (comandos[msgTexto]) {
        const result = await comandos[msgTexto]();
        await sendTelegramReply(chatId, result || "⏸️ Sin cambios desde la última vez.");
      }
      // Si se recibe un mensaje de voz
      else if (esVoz) {
        const clima = await getFullWeatherMessage();
        const mensaje = `🎙️ *¡Escuché tu audio!*\n\n${clima}`;
        await sendTelegramReply(chatId, mensaje);
      }
      // Cualquier otro mensaje de texto
      else if (msgTexto) {
        const clima = await getFullWeatherMessage();
        await sendTelegramReply(chatId, clima);
      }
    }

    lastUpdateId = updates[updates.length - 1].update_id;
  } catch (error) {
    console.error("❌ Error al procesar comandos:", error.message);
  }
}, 5000);
