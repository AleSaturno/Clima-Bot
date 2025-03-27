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

/** Envía una respuesta de texto a un chat específico usando la API de Telegram */
async function sendTelegramReply(chatId, text) {
  if (!text || !chatId) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text,
    parse_mode: "Markdown"
  });
}

/** Mensaje de ayuda para /start */
function mensajeDeAyuda() {
  return (
    `👋 *¡Hola! Soy tu bot del clima.*\n\n` +
    `Podés usar los siguientes comandos:\n` +
    `• /ahora → Ver clima actual\n` +
    `• /mas-tarde → Pronóstico próximas horas\n` +
    `• /mañana → Pronóstico del día siguiente\n` +
    `• /alertas → Ver alertas activas\n\n` +
    `🌤️ ¡Estoy listo para informarte!`
  );
}

/**
 * Cada 5 segundos, llama a getUpdates para ver si hay nuevos mensajes.
 * Responde según el comando recibido.
 */
setInterval(async () => {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`;
    const res = await axios.get(url);
    const updates = res.data.result;

    if (!updates.length) return;

    for (const update of updates) {
      const msgTexto = update.message?.text?.toLowerCase();
      const esVoz = !!update.message?.voice;
      const chatId = update.message?.chat?.id;

      console.log("📥 Mensaje recibido:", msgTexto || (esVoz && "[voz]"), "de", chatId);

      if (!chatId) continue;

      if (msgTexto === "/ahora") {
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
      } else if (msgTexto === "/start") {
        await sendTelegramReply(chatId, mensajeDeAyuda());
      } else if (esVoz) {
        const clima = await getFullWeatherMessage();
        const mensaje = `🎙️ *¡Escuché tu audio!*\n\n${clima}`;
        await sendTelegramReply(chatId, mensaje);
      } else if (msgTexto) {
        // Cualquier otro texto => Enviamos el clima completo
        const clima = await getFullWeatherMessage();
        await sendTelegramReply(chatId, clima);
      }
    }

    // Actualizamos para no procesar dos veces el mismo mensaje
    lastUpdateId = updates[updates.length - 1].update_id;
  } catch (error) {
    console.error("❌ Error al procesar comandos:", error.message);
  }
}, 5000);
