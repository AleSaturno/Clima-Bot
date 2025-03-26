require("dotenv").config();
const axios = require("axios");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTestMessage() {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("❌ Falta TELEGRAM_TOKEN o TELEGRAM_CHAT_ID en el .env");
        return;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    try {
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: "🚀 Este es tu bot del clima.",
        });
        console.log("✅ Mensaje enviado:", response.data);
    } catch (error) {
        console.error("❌ Error al enviar el mensaje:", error.response?.data || error.message);
    }
}

sendTestMessage();
