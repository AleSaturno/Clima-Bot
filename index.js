require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.API_KEY?.trim();
const CITY = process.env.CITY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MODO_BOT_PRIVADO = process.env.MODO_BOT_PRIVADO === "true";

const API_URL = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric`;

let lastTemp = null;
let ultimoMensajeEnviado = "";

function traducirDescripcion(desc) {
  const traducciones = {
    "clear sky": "Cielo despejado",
    "few clouds": "Pocas nubes",
    "scattered clouds": "Nubes dispersas",
    "broken clouds": "Nubes rotas",
    "overcast clouds": "Nublado",
    "light rain": "Lluvia ligera",
    "moderate rain": "Lluvia moderada",
    "heavy intensity rain": "Lluvia fuerte",
    "thunderstorm": "Tormenta eléctrica",
    "snow": "Nieve",
    "mist": "Niebla"
  };
  return traducciones[desc.toLowerCase()] || desc;
}

function generarSaludo() {
  const hora = new Date().getHours();
  if (hora < 12) return "🌅 *Buenos días!*";
  if (hora < 19) return "☀️ *Buenas tardes!*";
  return "🌙 *Buenas noches!*";
}

async function getFullWeatherMessage() {
  const res = await axios.get(API_URL);
  const data = res.data;

  const temp = data.main.temp;
  const feelsLike = data.main.feels_like;
  const humidity = data.main.humidity;
  const wind = data.wind.speed;
  const description = traducirDescripcion(data.weather[0].description);
  const saludo = generarSaludo();

  return `${saludo}\n\n🌤️ *Clima actual en ${CITY}*\n🌡️ *Temperatura:* ${temp}°C\n🥵 *Sensación térmica:* ${feelsLike}°C\n🌥️ *Estado:* ${description}\n💧 *Humedad:* ${humidity}%\n💨 *Viento:* ${wind} km/h\n\n📆 Si querés saber cómo estará *más tarde*, usá */mas-tarde*\n📅 Y si querés saber cómo estará *mañana*, usá */mañana* 😊`;
}

async function sendTelegramMessage(text) {
  if (!text || text === ultimoMensajeEnviado) return;
  ultimoMensajeEnviado = text;
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "Markdown"
  });
}

async function checkWeather() {
  try {
    const res = await axios.get(API_URL);
    const data = res.data;
    const temp = data.main.temp;

    const mensaje = await getFullWeatherMessage();
    if (mensaje !== ultimoMensajeEnviado) {
      await sendTelegramMessage(mensaje);
    }

    if (lastTemp !== null && Math.abs(temp - lastTemp) >= 5) {
      await sendTelegramMessage(`⚠️ *Cambio brusco:* de ${lastTemp}°C a ${temp}°C`);
    }

    if (temp <= 0) await sendTelegramMessage(`🧊 *Frío extremo:* ${temp}°C ❄️`);
    if (temp >= 35) await sendTelegramMessage(`🥵 *Calor extremo:* ${temp}°C 🔥`);

    lastTemp = temp;
  } catch (e) {
    console.error("Error al verificar clima:", e.message);
  }
}

if (MODO_BOT_PRIVADO) {
  cron.schedule("*/30 * * * *", checkWeather);
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🌐 Servidor iniciado en http://localhost:${PORT}`);
    if (MODO_BOT_PRIVADO) checkWeather();
  });
}

module.exports = {
  getFullWeatherMessage
};
