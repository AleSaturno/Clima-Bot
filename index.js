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
let ultimaTormentaNotificada = "";

/**  
 * Función que traduce la descripción del clima al español.  
 * Se mantiene exactamente como la proporcionaste.
 */
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

/** Función auxiliar para capitalizar la primera letra de un texto */
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Genera un saludo basado en la hora del día */
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

function generarSaludo() {
  // Obtenemos la hora local en Buenos Aires (America/Argentina/Buenos_Aires es UTC-3)
  const hora = dayjs().tz("America/Argentina/Buenos_Aires").hour();
  if (hora >= 5 && hora < 12) return "🌅 *Buenos días!*";
  if (hora >= 12 && hora < 20) return "☀️ *Buenas tardes!*";
  return "🌙 *Buenas noches!*";
}
/** Obtiene el clima actual utilizando la ciudad configurada en .env */
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

/** Obtiene el clima actual basándose en las coordenadas (latitud y longitud) */
async function getWeatherByCoordinates(lat, lon) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
      const res = await axios.get(url);
      const data = res.data;
  
      // Si 'data.name' está vacío o es null, usamos 'tu ubicación' como fallback
      const placeName = data.name && data.name.trim() ? data.name : "tu ubicación";
      
      const desc = traducirDescripcion(data.weather[0].description);
      return (
        `🌤️ *Clima actual en ${placeName}*\n` +
        `🌡️ Temperatura: ${data.main.temp}°C\n` +
        `🌥️ Estado: ${desc}\n` +
        `💧 Humedad: ${data.main.humidity}%\n` +
        `💨 Viento: ${data.wind.speed} km/h`
      );
    } catch (error) {
      console.error("❌ Error en getWeatherByCoordinates:", error.message);
      return "❌ No se pudo obtener el clima para tu ubicación.";
    }
  }

/** Obtiene pronóstico; "short" para las próximas horas, "mañana" para el día siguiente */
async function getForecastData(tipo = "mañana") {
  const res = await axios.get(FORECAST_URL);
  const list = res.data.list;

  if (tipo === "short") {
    const horas = list.slice(0, 3).map(item => {
      const fecha = new Date(item.dt * 1000);
      const horaLocal = fecha.toLocaleString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit"
      });
      const desc = traducirDescripcion(item.weather[0].description);
  
      // Obtenemos pop (0..1) y lo pasamos a 0..100
      const popRaw = item.pop ?? 0;
      const popPercent = Math.round(popRaw * 100);
  
      // Línea base
      let linea = `🕒 *${horaLocal}:* ${item.main.temp.toFixed(1)}°C, ${desc}`;
  
      // Si popPercent > 0, añadimos la probabilidad
      if (popPercent > 0) {
        linea += ` (${popPercent}% prob. de lluvia)`;
      }
  
      return linea;
    }).join('\n');
  
    const mensaje = `🔮 *Próximas horas:*\n${horas}`;
    if (mensaje !== ultimoMensajeMasTarde) {
      ultimoMensajeMasTarde = mensaje;
      return mensaje;
    }
    return null;
  } else {
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
    const desc = traducirDescripcion(descripciones[Math.floor(descripciones.length / 2)] || descripciones[0]);

    const mensaje = `📅 *Pronóstico para mañana (${formateada}):*\n` +
                    `🌡️ Mínima: ${min}°C | Máxima: ${max}°C\n` +
                    `🌥️ Estado general: ${desc}`;

    if (mensaje !== ultimoMensajeManana) {
      ultimoMensajeManana = mensaje;
      return mensaje;
    }
    return null;
  }
}

/** Chequea alertas (frío/calor extremo, lluvias o tormentas) */
async function checkAlerts() {
  const clima = await axios.get(API_URL);
  const forecast = await axios.get(FORECAST_URL);
  const list = forecast.data.list;
  const temp = clima.data.main.temp;
  let alertas = [];

  // Alertas de frío/calor extremo
  if (temp <= 0) alertas.push(`🧊 *Frío extremo:* ${temp}°C ❄️`);
  if (temp >= 35) alertas.push(`🥵 *Calor extremo:* ${temp}°C 🔥`);

  // Revisamos próximos 8 intervalos (~24 horas) en busca de lluvia/tormenta
  const proximosEventos = list.slice(0, 8).filter(ev => {
    const main = ev.weather[0].main.toLowerCase();
    return main.includes("rain") || main.includes("thunder");
  });

  if (proximosEventos.length) {
    // Construimos el detalle de lluvia/tormenta
    const detalles = proximosEventos.map(ev => {
      const fecha = new Date(ev.dt * 1000);
      const horaLocal = fecha.toLocaleString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit"
      });
      const desc = traducirDescripcion(ev.weather[0].description);

      // Aquí extraemos la cantidad de lluvia estimada en los últimos 3h, si existe
      const mmRain = ev.rain?.["3h"] ?? 0; 
      // Ajusta si deseas 1h o 3h según devuelva tu API (generalmente "3h")

      // Armamos la línea con descripción + cantidad de lluvia si es mayor a 0
      let linea = `• ${horaLocal}: ${desc}`;
      if (mmRain > 0) {
        linea += ` (${mmRain.toFixed(1)} mm)`;
      }

      return linea;
    }).join('\n');

    alertas.push(`🌧️ *Se esperan lluvias/tormentas*:\n${detalles}`);
  }

  // Si hay alertas, las unimos en un string; si no, decimos que no hay alertas
  return alertas.length
    ? `⚠️ *Alertas activas:*\n` + alertas.join('\n')
    : "✅ No hay alertas activas por ahora.";
}


/** Envía notificaciones a modo privado */
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
// Función auxiliar para enviar notificaciones a un chat específico
async function sendTelegramNotificationToChat(chatId, message) {
  if (!chatId || !message) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown"
    });
  } catch (error) {
    console.error(`❌ Error al enviar notificación a ${chatId}:`, error.response?.data || error.message);
  }
}


/** Chequea si en las próximas horas hay pronóstico de lluvia o tormenta y notifica */
async function checkStormForecast() {
  try {
    const res = await axios.get(FORECAST_URL);
    const list = res.data.list.slice(0, 3);

    // Buscamos si hay lluvia/tormenta
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

      // Extraemos pop (prob. de precipitación, de 0 a 1)
      const popRaw = itemTormenta.pop ?? 0; 
      const popPercent = Math.round(popRaw * 100); // lo convertimos a 0..100

      const firmaTormenta = `${fecha.toISOString()}-${desc}`;

      if (firmaTormenta !== ultimaTormentaNotificada) {
        // Armamos el mensaje base
        let mensaje = `⛈️ Se espera *${desc}* aproximadamente a las *${horaLocal}*.`;
        
        // Si pop > 0, agregamos el porcentaje
        if (popPercent > 0) {
          mensaje += ` (${popPercent}% de prob.)`;
        }

        await sendTelegramNotification(mensaje);
        ultimaTormentaNotificada = firmaTormenta;
      }
    }
  } catch (error) {
    console.error("❌ Error en checkStormForecast:", error.message);
  }
}


/** Verifica el clima y envía notificaciones si hay cambios significativos */
async function checkWeather() {
  const response = await axios.get(API_URL);
  const data = response.data;
  const temp = data.main.temp;

  await sendWeatherToTelegram(data);

  if (lastTemp !== null && Math.abs(temp - lastTemp) >= 5) {
    await sendTelegramNotification(`⚠️ *Cambio brusco en la temperatura:* ${lastTemp}°C → ${temp}°C`);
  }
  lastTemp = temp;
}

/** Envía el mensaje de clima actual a modo privado y chequea alertas */
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

  await checkStormForecast();
}

if (MODO_BOT_PRIVADO) {
  cron.schedule("*0 * * * *", checkWeather);
  cron.schedule("1 0 * * *", async () => {
    // Eliminamos mensajes antiguos del día
    for (const id of mensajesEnviados) {
      const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`;
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
  });
} else {
  // Modo público: Envia alertas a todos los suscriptores
  const { getSubscribers } = require("./subscriberService");
  cron.schedule("*0 * * * *", async () => {
    const subs = getSubscribers();
    if (subs.length === 0) {
      console.log("No hay suscriptores para enviar alertas.");
      return;
    }
    try {
      const response = await axios.get(API_URL);
      const data = response.data;
      const temp = data.main.temp;
      const mensaje = await getFullWeatherMessage();
      
      for (const chatId of subs) {
        await sendTelegramNotificationToChat(chatId, mensaje);
        if (lastTemp !== null && Math.abs(temp - lastTemp) >= 5) {
          await sendTelegramNotificationToChat(chatId, `⚠️ *Cambio brusco en la temperatura:* ${lastTemp}°C → ${temp}°C`);
        }
      }
      lastTemp = temp;
    } catch (error) {
      console.error("❌ Error en alerta para suscriptores:", error.message);
    }
  });
}


module.exports = {
  getCurrentWeather: async () => {
    const res = await axios.get(API_URL);
    const data = res.data;
    const desc = traducirDescripcion(data.weather[0].description);
    return `🌤️ *Clima actual en ${CITY}*\n` +
           `🌡️ Temperatura: ${data.main.temp}°C\n` +
           `🌥️ Estado: ${desc}\n` +
           `💧 Humedad: ${data.main.humidity}%\n` +
           `💨 Viento: ${data.wind.speed} km/h`;
  },
  getForecastData,
  checkAlerts,
  getFullWeatherMessage,
  getWeatherByCoordinates
};
