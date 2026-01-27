require("dotenv").config();
const axios = require("axios");
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const API_KEY = process.env.API_KEY?.trim();
const CITY = process.env.CITY;
const API_URL = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric`;
const FORECAST_URL = `https://api.openweathermap.org/data/2.5/forecast?q=${CITY}&appid=${API_KEY}&units=metric`;

// Variables de estado para evitar spam
let lastTemp = null;
let ultimoMensajeManana = "";
let ultimoMensajeMasTarde = "";
let ultimaTormentaNotificada = "";

// --- Helpers ---

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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

function generarSaludo() {
  const hora = dayjs().tz("America/Argentina/Buenos_Aires").hour();
  if (hora >= 5 && hora < 12) return "🌅 *Buenos días!*";
  if (hora >= 12 && hora < 20) return "☀️ *Buenas tardes!*";
  return "🌙 *Buenas noches!*";
}

// --- Weather Functions ---

async function getFullWeatherMessage() {
  try {
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
  } catch (error) {
    console.error("Error obteniendo clima actual:", error.message);
    return "❌ Error al obtener el clima actual.";
  }
}

async function getWeatherByCoordinates(lat, lon) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
    const res = await axios.get(url);
    const data = res.data;
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
    console.error("Error en getWeatherByCoordinates:", error.message);
    return "❌ No se pudo obtener el clima para tu ubicación.";
  }
}

async function getForecastData(tipo = "mañana") {
  try {
    const res = await axios.get(FORECAST_URL);
    const list = res.data.list;

    if (tipo === "short") {
      const horas = list.slice(0, 3).map(item => {
        const fecha = new Date(item.dt * 1000);
        const horaLocal = fecha.toLocaleString("es-AR", {
          hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires"
        });
        const desc = traducirDescripcion(item.weather[0].description);
        const popPercent = Math.round((item.pop ?? 0) * 100);

        let linea = `🕒 *${horaLocal}:* ${item.main.temp.toFixed(1)}°C, ${desc}`;
        if (popPercent > 0) linea += ` (${popPercent}% prob. de lluvia)`;
        return linea;
      }).join('\n');

      const mensaje = `🔮 *Próximas horas:*\n${horas}`;
      if (mensaje !== ultimoMensajeMasTarde) {
        ultimoMensajeMasTarde = mensaje;
        return mensaje;
      }
      return mensaje; // Modificado: Devuelve siempre el mensaje, el bot decide si enviar o no, pero para comandos forzados es mejor devolverlo.
    } else {
      // Forecast para mañana
      const mañana = new Date();
      mañana.setDate(mañana.getDate() + 1);
      const mañanaStr = mañana.toISOString().split("T")[0];
      const formateada = `${mañana.getDate().toString().padStart(2, '0')}/${(mañana.getMonth() + 1).toString().padStart(2, '0')}/${mañana.getFullYear()}`;

      const items = list.filter(i => i.dt_txt.startsWith(mañanaStr));
      if (!items.length) return `No hay datos disponibles para mañana (${formateada}).`;

      const temps = items.map(i => i.main.temp);
      const descripciones = items.map(i => i.weather[0].description);
      const min = Math.min(...temps).toFixed(1);
      const max = Math.max(...temps).toFixed(1);
      const desc = traducirDescripcion(descripciones[Math.floor(descripciones.length / 2)] || descripciones[0]);

      const mensaje = `📅 *Pronóstico para mañana (${formateada}):*\n` +
        `🌡️ Mínima: ${min}°C | Máxima: ${max}°C\n` +
        `🌥️ Estado general: ${desc}`;

      ultimoMensajeManana = mensaje;
      return mensaje;
    }
  } catch (error) {
    console.error("Error obteniendo pronóstico:", error.message);
    return "❌ Error al obtener el pronóstico.";
  }
}

async function checkAlerts() {
  try {
    const clima = await axios.get(API_URL);
    const forecast = await axios.get(FORECAST_URL);
    const list = forecast.data.list;
    const temp = clima.data.main.temp;
    let alertas = [];

    if (temp <= 0) alertas.push(`🧊 *Frío extremo:* ${temp}°C ❄️`);
    if (temp >= 35) alertas.push(`🥵 *Calor extremo:* ${temp}°C 🔥`);

    const proximosEventos = list.slice(0, 8).filter(ev => {
      const main = ev.weather[0].main.toLowerCase();
      return main.includes("rain") || main.includes("thunder");
    });

    if (proximosEventos.length) {
      const detalles = proximosEventos.map(ev => {
        const fecha = new Date(ev.dt * 1000);
        const horaLocal = fecha.toLocaleString("es-AR", {
          hour: "2-digit", minute: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires"
        });
        const desc = traducirDescripcion(ev.weather[0].description);
        const mmRain = ev.rain?.["3h"] ?? 0;
        let linea = `• ${horaLocal}: ${desc}`;
        if (mmRain > 0) linea += ` (${mmRain.toFixed(1)} mm)`;
        return linea;
      }).join('\n');
      alertas.push(`🌧️ *Se esperan lluvias/tormentas* próximas 24h:\n${detalles}`);
    }

    return alertas.length ? `⚠️ *Alertas activas:*\n` + alertas.join('\n') : "✅ No hay alertas activas por ahora.";
  } catch (error) {
    return "❌ Error al chequear alertas.";
  }
}

// Devuelve mensaje si hay tormenta, null si no hay o si ya se notificó
async function checkStormForecast() {
  try {
    const res = await axios.get(FORECAST_URL);
    const list = res.data.list.slice(0, 3);
    const itemTormenta = list.find(item => {
      const main = item.weather[0].main.toLowerCase();
      return main.includes("rain") || main.includes("thunder");
    });

    if (itemTormenta) {
      const fecha = new Date(itemTormenta.dt * 1000);
      const horaLocal = fecha.toLocaleTimeString("es-AR", {
        hour: "2-digit", minute: "2-digit",
        timeZone: "America/Argentina/Buenos_Aires"
      });
      const desc = traducirDescripcion(itemTormenta.weather[0].description);
      const popPercent = Math.round((itemTormenta.pop ?? 0) * 100);
      const firmaTormenta = `${fecha.toISOString()}-${desc}`;

      if (firmaTormenta !== ultimaTormentaNotificada) {
        let mensaje = `⛈️ Se espera *${desc}* aproximadamente a las *${horaLocal}*.`;
        if (popPercent > 0) mensaje += ` (${popPercent}% de prob.)`;

        ultimaTormentaNotificada = firmaTormenta;
        return mensaje;
      }
    }
    return null;
  } catch (error) {
    console.error("Error checkStormForecast:", error.message);
    return null;
  }
}

// Devuelve objeto { tempBrusca: string|null, alertas: string[] }
async function checkTemperatureChange() {
  try {
    const response = await axios.get(API_URL);
    const data = response.data;
    const temp = data.main.temp;
    let mensaje = null;

    if (lastTemp !== null && Math.abs(temp - lastTemp) >= 5) {
      mensaje = `⚠️ *Cambio brusco en la temperatura:* ${lastTemp}°C → ${temp}°C`;
    }
    lastTemp = temp;
    return mensaje;
  } catch (e) {
    return null;
  }
}

async function getTemp() {
  const res = await axios.get(API_URL);
  return res.data.main.temp;
}

module.exports = {
  getFullWeatherMessage,
  getWeatherByCoordinates,
  getForecastData,
  checkAlerts,
  checkStormForecast,
  checkTemperatureChange,
  getTemp
};
