require("dotenv").config();
const axios = require("axios");
const {
    getCurrentWeather,
    getForecastData,
    checkAlerts,
    getFullWeatherMessage
} = require("./index");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let lastUpdateId = 0;

async function sendTelegramReply(text) {
    if (!text) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await axios.post(url, {
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown"
    });
}

function mensajeDeAyuda() {
    return `👋 *¡Hola! Soy tu bot del clima.*\n\n` +
           `Podés usar los siguientes comandos:\n` +
           `• /ahora → Ver clima actual\n` +
           `• /mas-tarde → Pronóstico próximas horas\n` +
           `• /mañana → Pronóstico del día siguiente\n` +
           `• /alertas → Ver alertas activas\n\n` +
           `🌤️ ¡Estoy listo para informarte!`;
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

            console.log("📥 Mensaje recibido:", msgTexto || (esVoz && "[voz]"));

            if (msgTexto === "/ahora") {
                const info = await getCurrentWeather();
                await sendTelegramReply(info);
            } else if (msgTexto === "/mas-tarde") {
                const info = await getForecastData("short");
                await sendTelegramReply(info || "⏸️ Sin cambios desde la última vez.");
            } else if (msgTexto === "/mañana") {
                const info = await getForecastData("mañana");
                await sendTelegramReply(info || "⏸️ El pronóstico de mañana no ha cambiado.");
            } else if (msgTexto === "/alertas") {
                const info = await checkAlerts();
                await sendTelegramReply(info);
            } else if (msgTexto === "/start") {
                await sendTelegramReply(mensajeDeAyuda());
            } else if (esVoz) {
                const clima = await getFullWeatherMessage();
                const mensaje = `🎙️ *¡Escuché tu audio!*\n\n${clima}`;
                await sendTelegramReply(mensaje);
            } else if (msgTexto) {
                const clima = await getFullWeatherMessage();
                await sendTelegramReply(clima);
            }
        }

        lastUpdateId = updates[updates.length - 1].update_id;
    } catch (error) {
        console.error("❌ Error al procesar comandos:", error.message);
    }
}, 5000);
