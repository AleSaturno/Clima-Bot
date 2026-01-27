const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Inicializa la tabla de suscriptores si no existe
async function init() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        chat_id BIGINT PRIMARY KEY
      );
    `);
    console.log("Tabla 'subscribers' verificada o creada.");
  } catch (err) {
    console.warn("⚠️ No se pudo conectar a la Base de Datos. El bot funcionará SIN persistencia de suscriptores.");
    console.warn("Error detalle:", err.message);
  }
}

// Agrega un suscriptor (chat_id) a la base de datos
async function addSubscriber(chatId) {
  try {
    await pool.query(
      'INSERT INTO subscribers (chat_id) VALUES ($1) ON CONFLICT (chat_id) DO NOTHING;',
      [chatId]
    );
    return true;
  } catch (err) {
    console.error("Error al agregar suscriptor:", err);
    return false;
  }
}

// Elimina un suscriptor (chat_id) de la base de datos
async function removeSubscriber(chatId) {
  try {
    await pool.query('DELETE FROM subscribers WHERE chat_id = $1;', [chatId]);
    return true;
  } catch (err) {
    console.error("Error al remover suscriptor:", err);
    return false;
  }
}

// Obtiene la lista de suscriptores (chat_id) almacenados en la base de datos
async function getSubscribers() {
  try {
    const res = await pool.query('SELECT chat_id FROM subscribers;');
    return res.rows.map(row => row.chat_id);
  } catch (err) {
    console.error("Error al obtener suscriptores:", err);
    return [];
  }
}

init();

module.exports = {
  addSubscriber,
  removeSubscriber,
  getSubscribers
};
