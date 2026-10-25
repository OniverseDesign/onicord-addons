# 🔌 Repositorio Oficial de Complementos de Onicord

Este repositorio alberga el catálogo y los paquetes de distribución de complementos (addons) oficiales y comunitarios para **Onicord**.

---

## 📁 Estructura del Repositorio

- **`index.json`**: Catálogo oficial de complementos indexado para la tienda/gestor de Onicord.
- **`plugins/`**: Paquetes de distribución compilados en formato `.onipkg` (Gzip comprimido), organizados por el ID de cada complemento.
- **`build.js`**: Script de empaquetado automático que comprime los addons en `plugins/<id>/package.onipkg` y actualiza `index.json`.
- **`<addon-folder>/`**: Código fuente de cada complemento (`manifest.json`, `index.js`, `assets/`, `widgets/`, etc.).

---

## 🚀 Cómo agregar o actualizar un complemento

1. Crea o modifica la carpeta de tu complemento con su estructura estándar:
   ```
   onicord-mi-addon/
   ├── manifest.json
   ├── index.js
   ├── assets/
   │   └── icon.png
   └── widgets/
       └── island.html
   ```
2. Define en `manifest.json` la versión, metadatos, permisos y rutas.
3. Ejecuta el script de empaquetado:
   ```bash
   node build.js
   ```
4. Haz `git add`, `git commit` y `git push` a la rama principal de GitHub.

---

## 🛠️ Especificaciones de API y Novedades del Runtime

Onicord expone a los widgets iframe una API global en `window.OnicordWidgetAPI` y eventos en tiempo real mediante `window.postMessage`. A continuación se detallan las capacidades del entorno:

### 1. Estado y Canales de Voz (`window.OnicordWidgetAPI.voice`)
Los complementos pueden consultar y reaccionar reactivamente al estado de conexión de voz del usuario:

* **Métodos síncronos:**
  * `window.OnicordWidgetAPI.voice.isInVoice()`: Devuelve `boolean` indicando si el usuario está actualmente conectado a un canal de voz.
  * `window.OnicordWidgetAPI.voice.getChannelId()`: Devuelve el ID único del canal de voz activo (`string | null`), ideal para acotar transmisiones colaborativas (como soundboards o juegos) únicamente a los miembros de la misma llamada.
  * `window.OnicordWidgetAPI.voice.getChannelName()`: Devuelve el nombre visible del canal de voz actual (`string | null`).

* **Evento reactivo por `postMessage` (`ONICORD_VOICE_STATE`):**
  Se emite automáticamente al iframe cada vez que el usuario se conecta, desconecta o cambia de canal de voz:
  ```javascript
  window.addEventListener("message", (event) => {
    if (event.data?.type === "ONICORD_VOICE_STATE") {
      const { inVoice, channelId } = event.data;
      console.log("Estado de voz actualizado:", inVoice, channelId);
    }
  });
  ```

---

### 2. Atenuación Automática de Audio por Voz (Auto-Ducking)
Cuando alguien habla en el canal de voz, Onicord notifica a los widgets activos para que atenúen el volumen de su contenido multimedia automáticamente:

```javascript
window.addEventListener("message", (event) => {
  if (event.data?.type === "VOICE_DUCKING") {
    // duckMultiplier varía entre 0.3 (atenuado al hablar) y 1.0 (volumen normal en reposo)
    const multiplier = event.data.duckMultiplier ?? 1.0;
    miElementoDeAudio.volume = volumenConfigurado * multiplier;
  }
});
```

---

### 3. Resumen Dinámico en la Cápsula de la Isla (`island.setSummary`)
Para complementos registrados con permiso `ui.plugin_island`, permite actualizar el texto descriptivo de la Dynamic Island cuando se encuentra contraída en modo cápsula:

```javascript
if (window.OnicordWidgetAPI?.island?.setSummary) {
  window.OnicordWidgetAPI.island.setSummary("4 sonidos");
}
```

---

### 4. Red P2P y Colaboración en Tiempo Real (`p2p`)
Permite la comunicación entre pares dentro de la misma sala o servidor sin requerir servidores centrales:

* **Transmitir datos:**
  ```javascript
  window.OnicordWidgetAPI.p2p.broadcast({
    type: "MI_EVENTO",
    payload: { valor: 42 }
  });
  ```
* **Escuchar eventos remotos:**
  ```javascript
  window.OnicordWidgetAPI.p2p.onMessage((data, senderPeerId) => {
    if (data?.type === "MI_EVENTO") {
      console.log("Recibido de", senderPeerId, data.payload);
    }
  });
  ```

---

### 5. Almacenamiento Persistente (`storage`)
Permite guardar configuraciones o catálogos locales en el almacenamiento seguro de Onicord:

```javascript
// Guardar datos
await window.OnicordWidgetAPI.storage.set("mi_clave", JSON.stringify(misDatos));

// Leer datos
const raw = await window.OnicordWidgetAPI.storage.get("mi_clave");
const misDatos = raw ? JSON.parse(raw) : null;
```

---

### 6. Soporte Multimedia y Política de Seguridad CSP
La directiva `media-src` de Onicord permite la reproducción directa tanto de URLs generadas vía Blob (`URL.createObjectURL(blob)`) como de recursos codificados en `data:` (Base64 como `data:audio/ogg;base64,...`), garantizando compatibilidad con archivos locales subidos por el usuario sin infringir la política de seguridad de Electron.

---

## 📦 Complementos Oficiales en este Repositorio

| ID | Nombre | Tipo | Versión | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `onicord-soundboard` | **Soundboard** | `hybrid` | `0.1.0` | Soundboard colaborativo P2P acotado al canal de voz con subida de audios, renombrado y marquesina. |
| `onicord-dice` | **Dices** | `server` | `0.1.0` | Lanzador de dados virtual y colaborativo en tiempo real para la sala. |
| `onicord-arcade` | **Arcade** | `hybrid` | `0.2.0` | Biblioteca de juegos web clásicos con multijugador y sincronización cooperativa. |
| `onicord-polls` | **Quick Polls** | `server` | `0.1.0` | Encuestas interactivas en tiempo real vía `/p`. |
| `onicord-google-search` | **Google Search** | `server` | `0.1.0` | Búsqueda web e IA integrada en el chat mediante `/g`. |
| `onicord-youtube-search` | **YouTube Search** | `server` | `0.1.0` | Búsqueda y previsualización de videos en YouTube mediante `/y`. |
| `com.oniverse.demo_dashboard_addon` | **Demo Widgets** | `hybrid` | `0.1.0` | Demostración de widgets extensibles para el Panel de Widgets. |
