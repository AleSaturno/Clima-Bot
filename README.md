# 🤖 Bot del Clima para Telegram

Un bot de Telegram que consulta el clima actual, pronóstico para más tarde o el día siguiente, y responde a comandos de texto, ubicación y mensajes de voz. Ideal para no salir sin paraguas ☔.

---

## 🚀 Funcionalidades

- **Clima actual**: `/ahora`
- **Pronóstico de próximas horas**: `/mas-tarde`
- **Pronóstico del día siguiente**: `/mañana`
- **Alertas**: `/alertas` (calor, frío extremo, lluvia o tormenta)
- **Compartir ubicación**: `/ubicacion` → El bot pide tu ubicación y te muestra el clima de tus coordenadas
- **Mensajes de voz**: El bot responde con un mensaje de clima; puedes integrar un servicio de voz (como Google Cloud Speech-to-Text) si quieres que reconozca órdenes habladas
- **Modo privado (opcional)**: El bot envía notificaciones automáticas cada 30 minutos a un chat específico
- **Limpieza automática** de mensajes a medianoche, si usas modo privado

---

## 📦 Requisitos

- **Node.js** v18 o superior
- **Cuenta de Telegram** y un Bot creado con [@BotFather](https://t.me/BotFather)
- **API Key** de [OpenWeatherMap](https://openweathermap.org/api)

---

## 🛠 Instalación

1. **Clona** el repositorio:

   ```bash
   git clone https://github.com/tu-usuario/bot-clima.git
   cd bot-clima
   npm install
```
2-Configura el archivo .env en la raíz del proyecto (puedes basarte en un .env.example). Ejemplo:
```
API_KEY=TU_API_KEY_DE_OPENWEATHER
CITY=Cordoba
TELEGRAM_TOKEN=TU_BOT_TOKEN
TELEGRAM_CHAT_ID=123456789
MODO_BOT_PRIVADO=true
PORT=3000
```
API_KEY: Tu clave de OpenWeatherMap

CITY: Ciudad por defecto (por ejemplo, “Buenos Aires”)

TELEGRAM_TOKEN: El token del bot que te dio BotFather

TELEGRAM_CHAT_ID: ID de tu chat si usas modo privado

MODO_BOT_PRIVADO=true: Activa las notificaciones automáticas

PORT=3000: Puerto para el servidor (por defecto 3000)
```
3-Ejecuta el bot
```
# 1) Inicia el servidor (cron y notificaciones, si estás en modo privado)
node index.js

# 2) En otra terminal, inicia el script de comandos (polling)
node comandos.js
```
El primer archivo (index.js) se encarga de:

Iniciar un servidor Express en http://localhost:3000

Programar tareas cron (por ejemplo, alertas cada 30 min) en modo privado

Proveer funciones para obtener el clima

El segundo archivo (comandos.js) hace polling a la API de Telegram cada 5 segundos y responde a los comandos que envíen los usuarios.
```
```

🏃 Uso
/start → Muestra la lista de comandos disponibles

/ahora → Muestra el clima actual en la ciudad configurada en .env (CITY)

/mas-tarde → Muestra el pronóstico de las próximas horas

/mañana → Muestra el pronóstico del día siguiente

/alertas → Muestra riesgos de calor, frío extremo o lluvia

/ubicacion → El bot pide tu ubicación; al enviarla, te muestra el clima según tus coordenadas

Mensajes de voz → El bot responde con el clima. (Si deseas un reconocimiento real de voz, integra Google Cloud Speech-to-Text u otro servicio.)

Además, cualquier texto que no coincida con los comandos anteriores hará que el bot responda con el clima completo actual.

🔧 Personalización
En index.js, la función traducirDescripcion incluye un diccionario con casos de lluvia, llovizna (drizzle), nubes, etc. Si OpenWeatherMap devuelve descripciones no contempladas, puedes ampliarlo.

Si quieres notificaciones a todos los usuarios en lugar de un chat fijo, deberás adaptar la lógica para gestionar múltiples chat_id.

Para integrar reconocimiento de voz real, necesitarías un servicio externo. En la implementación actual, el bot responde con un mensaje genérico a cualquier nota de voz.

🤝 Contribuciones
¡Son bienvenidas! Haz un fork del repositorio, crea tu rama y envía un pull request.

📄 Licencia
MIT © 2023 - Alejandro Saturno

Este proyecto está bajo la licencia MIT, por lo que puedes usarlo libremente y adaptarlo a tus necesidades.

```
---

### Notas

1. **Mantuvimos la sección de “Requisitos”, “Instalación” y “Uso”**, pero agregamos los detalles de la nueva función `/ubicacion`, la respuesta a la ubicación y las traducciones adicionales.  
2. **Incluimos la sección de “Mensajes de voz”** indicando la posibilidad de integrar reconocimiento de voz.  
3. **Resaltamos el Modo Privado** y las notificaciones automáticas.  

Si deseas, ajusta los créditos finales (tu nombre o usuario de GitHub) y cualquier otro detalle. ¡Listo! Con este `README.md` tu repositorio quedará documentado con todas las funciones nuevas.
```
