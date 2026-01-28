require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const cron = require("node-cron");
const weather = require("./weather");
const subscriberService = require("./subscriberService");

const app = express();
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MODO_BOT_PRIVADO = process.env.MODO_BOT_PRIVADO === "true";

if (!TELEGRAM_TOKEN) {
    console.error("❌ FALTA TELEGRAM_TOKEN en .env");
    process.exit(1);
}

const bot = new Telegraf(TELEGRAM_TOKEN);

// --- COMANDOS ---

const helpMessage = `👋 *¡Hola! Soy tu bot del clima.*\n\n` +
    `Podés usar los siguientes comandos:\n` +
    `• /ahora o /a → Clima actual\n` +
    `• /mas-tarde o /mt → Pronóstico próximas horas\n` +
    `• /mañana o /m → Pronóstico del día siguiente\n` +
    `• /alertas o /al → Alertas de clima\n` +
    `• /ubicacion o /ub → Compartir ubicación\n` +
    `• /subscribe → Suscribirte a las alertas automáticas\n` +
    `• /unsubscribe → Darse de baja de las alertas automáticas\n` +
    `• /start → Muestra este mensaje\n\n` +
    `🌤️ ¡Estoy listo para informarte!`;

bot.start((ctx) => ctx.replyWithMarkdown(helpMessage));

bot.command(["ahora", "a"], async (ctx) => {
    const msg = await weather.getFullWeatherMessage();
    ctx.replyWithMarkdown(msg);
});

bot.command(["mas-tarde", "mt"], async (ctx) => {
    const msg = await weather.getForecastData("short");
    ctx.replyWithMarkdown(msg || "No hay datos disponibles.");
});

bot.command(["mañana", "m"], async (ctx) => {
    const msg = await weather.getForecastData("mañana");
    ctx.replyWithMarkdown(msg);
});

bot.command(["alertas", "al"], async (ctx) => {
    const msg = await weather.checkAlerts();
    ctx.replyWithMarkdown(msg);
});

bot.command(["ubicacion", "ubicación", "ub"], (ctx) => {
    ctx.reply("📍 Toca el botón para compartir tu ubicación.", Markup.keyboard([
        Markup.button.locationRequest("Compartir ubicación")
    ]).resize().oneTime());
});

bot.command("subscribe", async (ctx) => {
    const success = await subscriberService.addSubscriber(ctx.chat.id);
    if (success) {
        ctx.reply("✅ Te has suscrito a las alertas automáticas de clima.");
    } else {
        ctx.reply("⚠️ Hubo un error al intentar suscribirte (Error de Base de Datos). Intenta nuevamente más tarde.");
    }
});

bot.command("unsubscribe", async (ctx) => {
    const success = await subscriberService.removeSubscriber(ctx.chat.id);
    if (success) {
        ctx.reply("❌ Te has dado de baja de las alertas automáticas de clima.");
    } else {
        ctx.reply("⚠️ Hubo un error al intentar desuscribirte. Intenta nuevamente más tarde.");
    }
});

bot.on("location", async (ctx) => {
    const { latitude, longitude } = ctx.message.location;
    const msg = await weather.getWeatherByCoordinates(latitude, longitude);
    ctx.replyWithMarkdown(msg);
});

bot.on("voice", async (ctx) => {
    const msg = await weather.getFullWeatherMessage();
    ctx.replyWithMarkdown(`🎙️ *¡Escuché tu audio!*\n\n${msg}`);
});

// --- CRON JOBS ---

// Función para enviar a todos o solo al admin
async function broadcast(message) {
    if (!message) return;

    if (MODO_BOT_PRIVADO) {
        if (TELEGRAM_CHAT_ID) {
            try {
                await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: "Markdown" });
            } catch (e) { console.error("Error enviando al admin:", e.message); }
        }
    } else {
        // Modo Público: enviar a suscriptores
        const subs = await subscriberService.getSubscribers();
        for (const chatId of subs) {
            try {
                await bot.telegram.sendMessage(chatId, message, { parse_mode: "Markdown" });
            } catch (e) {
                console.error(`Error enviando a ${chatId}:`, e.message);
                // Opcional: Si el usuario bloqueó el bot (error 403), borrarlo de la BD
                if (e.response && e.response.error_code === 403) {
                    subscriberService.removeSubscriber(chatId);
                }
            }
        }
    }
}

// Tarea programada: Chequeo de clima cada hora
cron.schedule("0 * * * *", async () => {
    console.log("⏰ Ejecutando cron de clima...");
    const fullMsg = await weather.getFullWeatherMessage();
    // En modo privado enviamos siempre o con lógica de cambio? 
    // Originalmente enviaba si cambiaba el mensaje.
    // Simplificamos: enviamos el reporte horario si es modo privado o público.
    // Pero si es para suscriptores, recibir un mensaje CADA HORA puede ser spam.
    // El original enviaba cada hora.
    await broadcast(fullMsg);

    // Chequeos extra
    const cambioTemp = await weather.checkTemperatureChange();
    if (cambioTemp) await broadcast(cambioTemp);

    const stormAlert = await weather.checkStormForecast();
    if (stormAlert) await broadcast(stormAlert);
});

// --- SERVIDOR EXPRESS ---
// Necesario para que Heroku no mate el proceso (port binding)

app.get("/", (req, res) => {
    res.send("Bot Clima Activo 🌤️");
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// Iniciar Bot
bot.launch().then(() => {
    console.log("🤖 Bot iniciado correctamente");
});

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
