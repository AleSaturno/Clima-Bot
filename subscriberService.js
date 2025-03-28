const fs = require('fs');
const path = require('path');

const subscribersFilePath = path.join(__dirname, 'subscribers.json');
let subscribers = new Set();

// Carga las suscripciones desde el archivo JSON (si existe)
function loadSubscribers() {
  try {
    if (fs.existsSync(subscribersFilePath)) {
      const data = fs.readFileSync(subscribersFilePath, 'utf8');
      const parsed = JSON.parse(data);
      subscribers = new Set(parsed);
      console.log("Suscriptores cargados:", Array.from(subscribers));
    } else {
      console.log("No existe archivo de suscriptores. Se creará uno nuevo.");
    }
  } catch (err) {
    console.error("Error al cargar los suscriptores:", err);
  }
}

// Guarda las suscripciones en el archivo JSON
function saveSubscribers() {
  try {
    const data = JSON.stringify(Array.from(subscribers), null, 2);
    fs.writeFileSync(subscribersFilePath, data, 'utf8');
  } catch (err) {
    console.error("Error al guardar los suscriptores:", err);
  }
}

function addSubscriber(chatId) {
  subscribers.add(chatId);
  saveSubscribers();
}

function removeSubscriber(chatId) {
  subscribers.delete(chatId);
  saveSubscribers();
}

function getSubscribers() {
  return Array.from(subscribers);
}

loadSubscribers();

module.exports = {
  addSubscriber,
  removeSubscriber,
  getSubscribers
};
