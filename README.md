# 🤖 Bot del Clima para Telegram

Un bot de Telegram que consulta el clima actual, pronóstico para más tarde o el día siguiente, y responde a comandos, mensajes escritos y de voz. Ideal para no salir sin paraguas ☔

---

## 🚀 Funcionalidades

- 🌡️ Consulta el clima actual con `/ahora`
- 🔮 Pronóstico de próximas horas con `/mas-tarde`
- 📅 Pronóstico del día siguiente con `/mañana`
- ⚠️ Alertas por calor, frío extremo o lluvia con `/alertas`
- 💬 Responde si escribís o hablás (mensaje de voz)
- 🧹 Limpieza automática del historial cada medianoche (opcional)
- ✅ Modo privado: el bot responde solo a quien lo usa, sin compartir alertas entre chats

---

## 📦 Requisitos

- Node.js v18 o superior
- Una cuenta de Telegram y un Bot creado con [@BotFather](https://t.me/BotFather)
- Clave de API de [OpenWeatherMap](https://openweathermap.org/api)

---

## 🛠 Instalación

```bash
git clone https://github.com/tu-usuario/bot-clima.git
cd bot-clima
npm install
```
⚙️ Configuración del .env
Creá un archivo .env en la raíz del proyecto basado en .env.example:
```
API_KEY=TU_API_KEY_DE_OPENWEATHER
CITY=Buenos Aires
TELEGRAM_TOKEN=TU_BOT_TOKEN
TELEGRAM_CHAT_ID=123456789
MODO_BOT_PRIVADO=true
```
🔐 ¿Qué es MODO_BOT_PRIVADO?

Si MODO_BOT_PRIVADO=true: el bot enviará alertas automáticas cada 30 minutos solo al chat indicado en TELEGRAM_CHAT_ID
Si lo dejás en false o lo eliminás: el bot solo responderá a comandos. No enviará mensajes automáticos.

Ideal para mantener privacidad por usuario o chat.

▶️ Ejecutar localmente
```
node index.js
node comandos.js
```
🧪 Comandos disponibles
```
/start → Muestra ayuda

/ahora → Clima actual

/mas-tarde → Pronóstico de las próximas horas

/mañana → Pronóstico del día siguiente

/alertas → Riesgos por frío, calor o lluvia

Cualquier texto o voz → Responde con clima completo actual
```
📄 Licencia
MIT © Alejandro Saturno
```

---

📌 Este `README.md` está optimizado para que cualquier persona (o vos en unos meses 😄) pueda clonar el proyecto y correrlo sin complicaciones.

¿Querés que lo prepare para subir automáticamente a tu GitHub con commit inicial y push?
```

