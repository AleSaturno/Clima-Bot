require("dotenv").config();
const axios = require("axios");
const {
  getCurrentWeather,
  getForecastData,
  checkAlerts,
  getFullWeatherMessage,
  getWeatherByCoordinates
} = require("./index");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
let lastUpdateId = 0;

/**
 * Envía una respuesta de texto simple a un chat.
 */
async function sendTelegramReply(chatId, text) {
  if (!text || !chatId) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text,
    parse_mode: "Markdown"
  });
}

/**
 * Envía un mensaje con un teclado personalizado.
 * En este caso, el teclado incluye un botón para compartir ubicación.
 */
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

function mensajeDeAyuda() {
  return (
    `👋 *¡Hola! Soy tu bot del clima.*\n\n` +
    `Podés usar los siguientes comandos:\n` +
    `• /ahora → Ver clima actual\n` +
    `• /mas-tarde → Pronóstico próximas horas\n` +
    `• /mañana → Pronóstico del día siguiente\n` +
    `• /alertas → Ver alertas activas\n` +
    `• /ubicacion → Comparte tu ubicación para ver el clima en tu zona\n\n` +
    `🌤️ ¡Estoy listo para informarte!`
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
      console.log(
        "📥 Mensaje recibido:",
        msgTexto || (esVoz && "[voz]") || (location && "[ubicación]"),
        "de",
        chatId
      );
      if (!chatId) continue;
      if (location) {
        // Si se envía la ubicación, obtenemos el clima para esa coordenada.
        const { latitude, longitude } = location;
        const info = await getWeatherByCoordinates(latitude, longitude);
        await sendTelegramReply(chatId, info);
      } else if (msgTexto === "/ahora") {
        const info = await getCurrentWeather();
        await sendTelegramReply(chatId, info);
      } else if (msgTexto === "/mas-tarde") {
        const info = await getForecastData("short");
        await sendTelegramReply(chatId, info || "⏸️ Sin cambios desde la última vez.");
      } else if (msgTexto === "/mañana") {
        const info = await getForecastData("mañana");
        await sendTelegramReply(chatId, info || "⏸️ El pronóstico de mañana no ha cambiado.");
      } else if (msgTexto === "/alertas") {
        const info = await checkAlerts();
        await sendTelegramReply(chatId, info);
      } else if (msgTexto === "/ubicacion" || msgTexto === "/ubicación") {
        // Envia un mensaje con teclado para que el usuario comparta su ubicación
        const keyboard = {
          keyboard: [
            [
              { text: "Compartir ubicación", request_location: true }
            ]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        };
        await sendTelegramKeyboard(
          chatId,
          "📍 Para ver el clima en tu zona, toca el botón de abajo y comparte tu ubicación.",
          keyboard
        );
      } else if (msgTexto === "/start") {
        await sendTelegramReply(chatId, mensajeDeAyuda());
      } else if (esVoz) {
        const clima = await getFullWeatherMessage();
        const mensaje = `🎙️ *¡Escuché tu audio!*\n\n${clima}`;
        await sendTelegramReply(chatId, mensaje);
      } else if (msgTexto) {
        const clima = await getFullWeatherMessage();
        await sendTelegramReply(chatId, clima);
      }
    }
    lastUpdateId = updates[updates.length - 1].update_id;
  } catch (error) {
    console.error("❌ Error al procesar comandos:", error.message);
  }
}, 5000);
