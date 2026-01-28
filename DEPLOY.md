# 🚀 Despliegue del Bot de Clima

Este bot está construido con **Node.js** y utiliza **PostgreSQL** para gestionar suscripciones. A continuación se detallan los pasos recomendados para desplegarlo en la nube y permitir que otros usuarios lo utilicen.

## Opción Recomendada: Railway (Fácil y Rápido)

Railway es excelente porque configura automáticamente Node.js y la base de datos PostgreSQL.

### Pasos:

1.  **Sube tu código a GitHub** (si no lo has hecho aún):
    ```bash
    git add .
    git commit -m "Listo para deploy"
    git push origin master
    ```

2.  **Crea una cuenta en [Railway.app](https://railway.app/)**.

3.  **Nuevo Proyecto**:
    *   Haz clic en "New Project" > "Deploy from GitHub repo".
    *   Selecciona tu repositorio `bot-clima`.

4.  **Agrega Base de Datos**:
    *   Una vez creado el proyecto, haz clic derecho en el panel o "New" > "Database" > "PostgreSQL".
    *   Esto creará una base de datos vinculada a tu proyecto.

5.  **Configura Variables de Entorno**:
    *   Ve a la pestaña **Variables** de tu servicio del bot (no de la DB).
    *   Agrega las siguientes variables:
        *   `TELEGRAM_TOKEN`: (Tu token de BotFather)
        *   `API_KEY`: (Tu API Key de OpenWeatherMap)
        *   `CITY`: (Tu ciudad, ej: `Cordoba`)
        *   `MODO_BOT_PRIVADO`: `false` (IMPORTANTE: ponlo en `false` para que los usuarios puedan recibir alertas).
        *   `TZ`: `America/Argentina/Buenos_Aires` (Para que la hora del servidor sea la correcta).
    *   **DATABASE_URL**: Railway inyecta esta variable automáticamente si añadiste PostgreSQL en el mismo proyecto. Si no, cópiala de la pestaña "Connect" de la base de datos.

6.  **Despliegue**:
    *   Railway detectará el `package.json` y el `Procfile` y desplegará automáticamente.
    *   ¡Listo! Tu bot estará activo 24/7.

---

## Opción Alternativa: Render.com

Render también tiene un plan gratuito para servicios web y bases de datos (limitado).

1.  Crea un **Web Service** conectado a tu repo.
2.  Build Command: `npm install`
3.  Start Command: `node bot.js`
4.  Agrega una **PostgreSQL** database desde el dashboard de Render.
5.  Copia la `Internal Database URL` de la base de datos y pégala como variable de entorno `DATABASE_URL` en tu Web Service.
6.  Configura el resto de las variables (`TELEGRAM_TOKEN`, etc.).

---

## ⚙️ Configuración Importante para Producción

Para que "otros usuarios puedan probarlo sin problemas", asegúrate de:

*   **MODO_BOT_PRIVADO = false**: Si está en `true`, el bot solo enviará alertas automáticas al ID definido en `TELEGRAM_CHAT_ID`. Al ponerlo en `false`, enviará alertas a todos los que usen `/subscribe`.
*   **Base de Datos**: Es fundamental que la base de datos esté activa. Si la conexión falla, el comando `/subscribe` avisará al usuario con un error.

## 📝 Comandos para Usuarios

Una vez desplegado, comparte tu bot (**@Tormentonbot**) y diles que usen:
*   `/start` - Para iniciar.
*   `/subscribe` - Para recibir alertas cada hora.
*   `/alertas` - Para ver si hay tormentas próximas.
