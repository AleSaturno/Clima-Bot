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
const FORECAST_URL = `https://api.openweathermap.org/data/2.5/forecast?q=${CITY}&appid=${API_KEY}&units=metric`;

let lastTemp = null;
let mensajesEnviados = [];
let ultimoMensajeClima = "";
let ultimoMensajeManana = "";
let ultimoMensajeMasTarde = "";

// Para evitar notificar la misma tormenta muchas veces:
let ultimaTormentaNotificada = "";

/** Envía un mensaje a Telegram en modo privado, guardando el ID para luego poder borrarlo si se desea. */
async function sendTelegramNotification(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    const res = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown"
    });
    mensajesEnviados.push(res.data.result.message_id);
  } catch (error) {
    console.error("❌ Error al enviar a Telegram:", error.response?.data || error.message);
  }
}

/** Borra todos los mensajes enviados en el día (almacenados en `mensajesEnviados`). */
async function eliminarMensajesDelDia() {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`;
  for (const id of mensajesEnviados) {
    try {
      await axios.post(url, {
        chat_id: TELEGRAM_CHAT_ID,
        message_id: id
      });
    } catch (err) {
      console.warn("⚠️ No se pudo borrar mensaje:", id);
    }
  }
  mensajesEnviados = [];
  ultimoMensajeClima = "";
  ultimoMensajeManana = "";
  ultimoMensajeMasTarde = "";
  ultimaTormentaNotificada = "";
}

/** Función auxiliar para capitalizar la primera letra */
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Genera un saludo según la hora local */
function generarSaludo() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return "🌅 *Buenos días!*";
  if (hora >= 12 && hora < 19) return "☀️ *Buenas tardes!*";
  return "🌙 *Buenas noches!*";
}

/** Traduce descripciones del inglés al español si existen en el diccionario */
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
    "mist": "Niebla",
    "drizzle": "Llovizna",
    "light drizzle": "Llovizna ligera",
    "heavy drizzle": "Llovizna fuerte",
    "light intensity drizzle": "Llovizna ligera",
    "heavy intensity drizzle": "Llovizna fuerte",
    "shower drizzle": "Llovizna intermitente",
  };
  return traducciones[desc.toLowerCase()] || capitalize(desc);
}

/** Envía el clima actual (si cambió) y chequea frío/calor extremo. */
async function sendWeatherToTelegram(data) {
  const mensaje = await getFullWeatherMessage();
  if (mensaje !== ultimoMensajeClima) {
    await sendTelegramNotification(mensaje);
    ultimoMensajeClima = mensaje;
  } else {
    console.log("⏸️ Clima sin cambios. No se volvió a enviar.");
  }

  const temp = data.main.temp;
  if (temp <= 0) await sendTelegramNotification(`🧊 *Frío extremo:* ${temp}°C ❄️`);
  if (temp >= 35) await sendTelegramNotification(`🥵 *Calor extremo:* ${temp}°C 🔥`);

  // Revisamos si hay tormenta/lluvia próxima en las próximas horas y notificamos
  await checkStormForecast();
}

/**
 * Chequea si en las próximas 3 horas hay pronóstico de lluvia/tormenta.
 * Si lo hay, envía notificación automática (modo privado) evitando repetir la misma.
 */
async function checkStormForecast() {
  try {
    const res = await axios.get(FORECAST_URL);
    const list = res.data.list.slice(0, 3); // Siguientes 3 intervalos (~9 horas en total)

    // Buscamos un item con "rain" o "thunderstorm"
    const itemTormenta = list.find(item => {
      const main = item.weather[0].main.toLowerCase();
      return main.includes("rain") || main.includes("thunder");
    });

    if (itemTormenta) {
      const fecha = new Date(itemTormenta.dt * 1000);
      const horaLocal = fecha.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit"
      });
      const desc = traducirDescripcion(itemTormenta.weather[0].description);

      // Construimos una "firma" de tormenta para no repetir la misma
      const firmaTormenta = `${fecha.toISOString()}-${desc}`;

      if (firmaTormenta !== ultimaTormentaNotificada) {
        const mensaje = `⛈️ Se espera *${desc}* aproximadamente a las *${horaLocal}*.`;
        await sendTelegramNotification(mensaje);
        ultimaTormentaNotificada = firmaTormenta;
      }
    }
  } catch (error) {
    console.error("❌ Error en checkStormForecast:", error.message);
  }
}

/** Retorna un mensaje de clima completo con saludo, estado actual, etc. */
async function getFullWeatherMessage() {
  const res = await axios.get(API_URL);
  const data = res.data;

  const temp = data.main.temp;
  const feelsLike = data.main.feels_like;
  const humidity = data.main.humidity;
  const wind = data.wind.speed;
  const description = traducirDescripcion(data.weather[0].description);
  const saludo = generarSaludo();

  return (
    `${saludo}\n\n` +
    `🌤️ *Clima actual en ${CITY}*\n` +
    `🌡️ *Temperatura:* ${temp}°C\n` +
    `🥵 *Sensación térmica:* ${feelsLike}°C\n` +
    `🌥️ *Estado:* ${description}\n` +
    `💧 *Humedad:* ${humidity}%\n` +
    `💨 *Viento:* ${wind} km/h\n\n` +
    `📆 Si querés saber cómo estará *más tarde*, usá */mas-tarde*\n` +
    `📅 Y si querés saber cómo estará *mañana*, usá */mañana* 😊`
  );
}

/**
 * Retorna pronóstico a corto plazo (/mas-tarde) o para mañana (/mañana).
 * Se añade la fecha/hora específica para mayor detalle.
 */
async function getForecastData(tipo = "mañana") {
  const res = await axios.get(FORECAST_URL);
  const list = res.data.list;

  if (tipo === "short") {
    // Próximas 3 "instancias" (~9 horas)
    const horas = list.slice(0, 3).map(item => {
      const fecha = new Date(item.dt * 1000);
      const horaLocal = fecha.toLocaleString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit"
      });
      const desc = traducirDescripcion(item.weather[0].description);
      return `🕒 *${horaLocal}:* ${item.main.temp.toFixed(1)}°C, ${desc}`;
    }).join('\n');

    const mensaje = `🔮 *Próximas horas:*\n${horas}`;
    if (mensaje !== ultimoMensajeMasTarde) {
      ultimoMensajeMasTarde = mensaje;
      return mensaje;
    } else {
      return null;
    }
  } else {
    // Pronóstico para mañana
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    const mañanaStr = mañana.toISOString().split("T")[0];
    const [yyyy, mm, dd] = mañanaStr.split("-");
    const formateada = `${dd}/${mm}/${yyyy}`;

    const items = list.filter(i => i.dt_txt.startsWith(mañanaStr));
    const temps = items.map(i => i.main.temp);
    const descripciones = items.map(i => i.weather[0].description);

    if (!temps.length) {
      return `No hay datos disponibles para mañana (${formateada}).`;
    }

    const min = Math.min(...temps).toFixed(1);
    const max = Math.max(...temps).toFixed(1);
    const desc = traducirDescripcion(
      descripciones[Math.floor(descripciones.length / 2)] || descripciones[0]
    );

    const mensaje =
      `📅 *Pronóstico para mañana (${formateada}):*\n` +
      `🌡️ Mínima: ${min}°C | Máxima: ${max}°C\n` +
      `🌥️ Estado general: ${desc}`;

    if (mensaje !== ultimoMensajeManana) {
      ultimoMensajeManana = mensaje;
      return mensaje;
    } else {
      return null;
    }
  }
}

/**
 * Verifica alertas: frío/calor extremo, lluvia inminente.  
 * Además, ahora listamos aproximaciones de lluvia/tormenta con fecha/hora.
 */
async function checkAlerts() {
  const clima = await axios.get(API_URL);
  const forecast = await axios.get(FORECAST_URL);
  const list = forecast.data.list;

  const temp = clima.data.main.temp;
  let alertas = [];

  if (temp <= 0) alertas.push(`🧊 *Frío extremo:* ${temp}°C ❄️`);
  if (temp >= 35) alertas.push(`🥵 *Calor extremo:* ${temp}°C 🔥`);

  // Revisamos si hay lluvia o tormenta en los próximos 8 intervalos (~24 horas)
  const proximosEventos = list.slice(0, 8).filter(item => {
    const main = item.weather[0].main.toLowerCase();
    return main.includes("rain") || main.includes("thunder");
  });

  if (proximosEventos.length) {
    const detalles = proximosEventos.map(ev => {
      const fecha = new Date(ev.dt * 1000);
      const horaLocal = fecha.toLocaleString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit"
      });
      const desc = traducirDescripcion(ev.weather[0].description);
      return `• ${horaLocal}: ${desc}`;
    }).join('\n');
    alertas.push(`🌧️ *Se esperan lluvias/tormentas*:\n${detalles}`);
  }

  return alertas.length
    ? `⚠️ *Alertas activas:*\n` + alertas.join('\n')
    : "✅ No hay alertas activas por ahora.";
}

/** Llamada periódica en modo privado: envía clima y chequea cambios bruscos. */
async function checkWeather() {
  const response = await axios.get(API_URL);
  const data = response.data;
  const temp = data.main.temp;

  // Envía el clima actual si hay cambios
  await sendWeatherToTelegram(data);

  // Notifica cambio brusco de temperatura (≥ 5°C)
  if (lastTemp !== null && Math.abs(temp - lastTemp) >= 5) {
    await sendTelegramNotification(
      `⚠️ *Cambio brusco en la temperatura:* ${lastTemp}°C → ${temp}°C`
    );
  }

  lastTemp = temp;
}

/** Programación de tareas con cron si está en modo privado. */
if (MODO_BOT_PRIVADO) {
  cron.schedule("*/30 * * * *", checkWeather);
  cron.schedule("1 0 * * *", eliminarMensajesDelDia);
}

/** Inicia el servidor Express (opcional si quieres tener un endpoint activo). */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
    if (MODO_BOT_PRIVADO) {
      // Primera ejecución inmediata
      checkWeather();
    }
  });
}

/** Exportamos para que comandos.js use estas funciones. */
module.exports = {
  getCurrentWeather: async () => {
    const res = await axios.get(API_URL);
    const data = res.data;
    const desc = traducirDescripcion(data.weather[0].description);
    return (
      `🌤️ *Clima actual en ${CITY}*\n` +
      `🌡️ Temperatura: ${data.main.temp}°C\n` +
      `🌥️ Estado: ${desc}\n` +
      `💧 Humedad: ${data.main.humidity}%\n` +
      `💨 Viento: ${data.wind.speed} km/h`
    );
  },
  getForecastData,
  checkAlerts,
  getFullWeatherMessage
};
