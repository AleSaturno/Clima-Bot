# 🤖 Bot del Clima para Telegram

Un bot de Telegram que consulta el clima actual, pronóstico para más tarde o el día siguiente, y responde a comandos o mensajes de voz. ¡Ideal para no salir sin paraguas! ☔

## 🚀 Funcionalidades

- Consulta el clima actual con `/ahora`
- Pronóstico de próximas horas con `/mas-tarde`
- Pronóstico del día siguiente con `/mañana`
- Alertas por calor, frío extremo o lluvia con `/alertas`
- Responde si escribís o hablás (mensaje de voz)
- Limpieza automática del historial del bot todos los días

## 📦 Requisitos

- Node.js v18 o superior
- Una cuenta de Telegram y un Bot creado con [BotFather](https://t.me/BotFather)
- Clave de API de [OpenWeatherMap](https://openweathermap.org/api)

## 📁 Instalación

```bash
git clone https://github.com/tu-usuario/bot-clima.git
cd bot-clima
npm install
```
📄 Configurá tu .env
Crea un archivo .env en la raíz del proyecto basado en .env.example:
```
API_KEY=TU_API_KEY_DE_OPENWEATHER
CITY=Cordoba
TELEGRAM_TOKEN=TU_BOT_TOKEN
TELEGRAM_CHAT_ID=123456789
```
▶️ Ejecutar localmente
```
node index.js
node comandos.js
```
El bot empieza a escuchar y responder a comandos o mensajes de voz desde Telegram.


