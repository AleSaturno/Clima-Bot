const { Pool } = require('pg');

// Configura el pool usando la variable DATABASE_URL del .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
    console.error("Error al inicializar la tabla 'subscribers':", err);
  }
}

// Agrega un suscriptor (chat_id) a la base de datos
async function addSubscriber(chatId) {
  try {
    await pool.query(
      'INSERT INTO subscribers (chat_id) VALUES ($1) ON CONFLICT (chat_id) DO NOTHING;',
      [chatId]
    );
  } catch (err) {
    console.error("Error al agregar suscriptor:", err);
  }
}

// Elimina un suscriptor (chat_id) de la base de datos
async function removeSubscriber(chatId) {
  try {
    await pool.query('DELETE FROM subscribers WHERE chat_id = $1;', [chatId]);
  } catch (err) {
    console.error("Error al remover suscriptor:", err);
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
