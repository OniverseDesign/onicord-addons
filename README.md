# Onicord Addons Development Guide & Technical Specification

Welcome to the official developer documentation for Onicord addons, plugins, and Dashboard widgets. This guide details the sandboxing architecture, interaction vectors, Widgets Dashboard specifications, unified permission schemas, and instructions for compiling and packaging addons into `.onimod` bundles.

---

## 1. Architecture & Sandboxing Overview

Onicord plugins operate through a secure, decentralized architecture:

* **V8 Isolated Sandbox**: System scripts and command handlers run within an isolated Node.js `vm` context (`pluginSandboxService.cjs`). They have no direct access to the host file system or main process except via the injected `Onicord` global object.
* **Widgets Dashboard Widgets**: UI widgets run inside sandboxed `iframe` containers with `sandbox="allow-scripts allow-same-origin"`. They are wrapped inside Onicord's standardized `onicord-widget-shell` container layout and receive the secure `window.OnicordWidgetAPI` context bridge.
* **Encrypted P2P Network**: Room communications between peers are transmitted via AES-256-GCM encrypted P2P data channels over Hyperswarm.
* **Permission Gatekeeper**: All API endpoints and data access vectors enforce strict permission checks declared in `manifest.json`.

---

## 2. Plugin Interaction Vectors

Plugins have 9 primary methods to interact with the application, chat, user interface, Widgets Dashboard, and P2P network:

### 2.1 Slash Command Registration (`Onicord.chat.onCommand`)
Allows plugins to register custom chat commands (e.g., `/p`, `/y`, `/g`) that users can execute from the chat input.

```javascript
// Register a slash command inside the V8 Sandbox
Onicord.chat.onCommand('p', (args) => {
  const query = args.join(' ');
  console.log('Command executed with args:', query);
});
```

---

### 2.2 Widgets Dashboard Widgets (`dashboardWidgets`)
Plugins can expose local or collaborative P2P widgets that integrate seamlessly into Onicord's Widgets Dashboard.

```json
"dashboardWidgets": [
  {
    "id": "pomodoro_timer",
    "title": "Temporizador Pomodoro",
    "badgeText": "Local",
    "type": "local",
    "bgVariant": "dark",
    "entryPoint": "widgets/pomodoro.html",
    "defaultGeo": { "x": 1, "y": 1, "w": 2, "h": 2 }
  }
]
```

Inside the widget's HTML entry file, access the injected `window.OnicordWidgetAPI`:

```javascript
window.addEventListener("onicord:widget-ready", async () => {
  // Access permitted APIs
  const user = OnicordWidgetAPI.user.getProfile();
  const saved = await OnicordWidgetAPI.storage.get("saved_key");
});
```

---

### 2.3 Chat Messages & Interactive Cards (`[PLUGIN_EMBED]`)
Plugins can publish chat messages under their official addon identity (`isComplement: true`). To render rich interactive cards (polls, search results, dice rolls), use the `[PLUGIN_EMBED]` payload format.

```javascript
const embedPayload = {
  pluginId: 'onicord-polls',
  type: 'poll',
  data: {
    pollId: 'poll_123456',
    question: 'What are we having for dinner?',
    options: [
      { id: 'opt_0', text: 'Pizza', voters: [] },
      { id: 'opt_1', text: 'Tacos', voters: [] }
    ],
    createdAt: Date.now()
  }
};

Onicord.chat.sendMessage({
  text: `[PLUGIN_EMBED]:${JSON.stringify(embedPayload)}`
});
```

---

### 2.4 Real-Time User Interactions (`[PLUGIN_ACTION]`)
Capture user actions on plugin cards (e.g., clicking a poll option or button) and transmit them to all room participants without polluting the visible chat history.

```javascript
window.electronAPI.sendChatMessage(
  roomCode,
  channelId,
  `[PLUGIN_ACTION]:${JSON.stringify({
    pluginId: 'onicord-polls',
    action: 'VOTE',
    targetId: 'poll_123456',
    data: {
      pollId: 'poll_123456',
      optionId: 'opt_0',
      voter: { id: 'user_1', name: 'Alex', avatar: null }
    }
  })}`
);
```

---

### 2.5 Direct P2P Data Broadcasting (`Onicord.p2p` / `OnicordWidgetAPI.p2p`)
For applications and collaborative widgets requiring direct, low-latency peer-to-peer data exchange (real-time whiteboards, shared dice, turn-based games, synchronized state) without sending visible chat messages. Requires the `p2p.network` permission in `manifest.json`.

#### Automatic Scoping & Packet Isolation
All data transmitted through `p2p.broadcast` is automatically scoped with the addon's `pluginId` and `widgetId`. This guarantees that packets from one addon will never interfere with, or be intercepted by, other addons in the same room.

```javascript
// 1. Broadcast any JavaScript object/data to all room peers
window.OnicordWidgetAPI.p2p.broadcast({
  type: 'DICE_ROLL_START',
  authorName: 'Alex',
  rolls: [4, 6],
  total: 10,
  timestamp: Date.now()
});

// 2. Listen for incoming P2P packets from peers in the room
const unsubscribe = window.OnicordWidgetAPI.p2p.onMessage((data, senderPeerId) => {
  if (data?.type === 'DICE_ROLL_START') {
    renderRollAnimation(data.rolls, data.authorName);
  }
});
```

#### The Decentralized Initial State Handshake Pattern
Because `storage` is isolated per user and per profile on their local devices, a peer who opens a room or widget for the first time starts with an empty local store. To achieve immediate real-time synchronization with active room members, all collaborative widgets should implement the standard **Request-Response Handshake Pattern**:

```javascript
// A. When widget initializes, request the current room state
function requestRoomState() {
  window.OnicordWidgetAPI?.p2p?.broadcast({
    type: 'ROOM_STATE_REQUEST'
  });
}

// B. In the onMessage listener:
window.OnicordWidgetAPI.p2p.onMessage((data, senderPeerId) => {
  if (data.type === 'ROOM_STATE_REQUEST') {
    // If we have active configured state, respond to the room
    if (state.configured) {
      window.OnicordWidgetAPI.p2p.broadcast({
        type: 'ROOM_STATE_RESPONSE',
        state: state
      });
    }
  } else if (data.type === 'ROOM_STATE_RESPONSE') {
    // Merge or adopt remote state into local widget
    applyRemoteState(data.state);
  }
});

// Request state immediately on startup and retry after 1s if still waiting
requestRoomState();
setTimeout(requestRoomState, 1000);
```

---

### 2.6 Plugin Island Widgets (`Onicord.ui.registerPluginIslandWidget`)
The **Plugin Island** is Onicord's dedicated sidebar area situated on the right side of room channels (above the members list). It provides a persistent, interactive canvas for collaborative widgets, tools, and mini-games.

#### Registering an Island Widget in `index.js`:
```javascript
if (typeof Onicord !== "undefined" && Onicord.ui?.registerPluginIslandWidget) {
  Onicord.ui.registerPluginIslandWidget({
    id: "dice-island-widget",              // Unique widget identifier
    title: "Dados",                        // Human-readable title
    entryPoint: "widgets/dice_island.html",// HTML entry point inside addon directory
    height: 275                            // Target height in pixels (default 255-280px)
  });
}
```

#### Native Island Shell Features:
- **Sandboxed Execution**: Runs in an isolated `iframe` with `sandbox="allow-scripts allow-same-origin"`.
- **Dynamic Capsule Mode (56px Pill)**:
  - **Initial Collapsed State**: Upon entering any room or server, the Island initiates in compact 56px Capsule Mode by default to preserve maximum vertical space for the room members list.
  - **Auto-Contraction Timer**: When expanded, it automatically contracts back to the 56px capsule banner after **2 minutes of inactivity**.
  - **Capsule Layout**: Features the addon's circular avatar on the left, the addon name with Onicord's official `smart_toy` addon icon (matching chat and room commands) and timestamp on the top line, and a live text summary of the latest room update on the bottom line (e.g. `Oniverse lanzó d6 -> 6`).
  - **Zero Emojis**: Official and third-party addons must strictly avoid emojis in status text or summaries, using clean typography and Material Icons instead.
- **Hover to Peek**: Hovering over the capsule temporarily expands it to full height (`275px`) for quick inspection. Moving the mouse away without clicking collapses it back down smoothly.
- **Click to Pin (2-minute timer)**: Clicking anywhere on the capsule pins it in full expanded mode. Every user interaction or dice roll resets the 2-minute countdown timer.
- **Event-Driven Auto-Expansion & Smart Addon Switching**: Whenever any room peer broadcasts an event or updates state on an addon:
  - If multiple addons are installed and an update belongs to an inactive addon (e.g., Addon #2 while currently viewing Addon #1), the Island automatically switches to that addon in the carousel.
  - The capsule immediately updates its icon, title, timestamp, and summary.
  - The Island springs open to full size so all members witness the action in real-time, restarting the 2-minute timer.
- **Persistent Multi-Addon State**: All active island addons remain mounted in the background (using CSS visibility switching), preserving their internal state, timers, and P2P network listeners without reloading when switching between carousel items.
- **Automatic Carousel Navigation**: If a user has multiple island addons active, the Onicord host container automatically renders smooth pagination controls (chevron arrows and dot indicators) at the bottom.

#### Communicating Updates to the Island Capsule:
Addons can update the status text displayed in the 56px capsule and trigger the Island to automatically spring open using two generic mechanisms:

1. **Direct Bridge Call (`window.OnicordWidgetAPI.island.setSummary`)**:
   ```javascript
   // Set or update the status description shown in the capsule (strictly zero emojis)
   window.OnicordWidgetAPI.island.setSummary("Alex tiró una carta especial");
   ```

2. **P2P Broadcast Field (`data.summary` or `data.description`)**:
   When broadcasting room events via `window.OnicordWidgetAPI.p2p.broadcast`, include a `summary` or `description` property:
   ```javascript
   window.OnicordWidgetAPI.p2p.broadcast({
     type: "GAME_ACTION",
     summary: "Alex avanzó 3 casillas", // Intercepted automatically by Onicord Island
     timestamp: Date.now()
   });
   ```
   Whenever the `PluginIsland` container intercepts a P2P packet with a `summary` or `description` property (locally or from a remote peer), it automatically:
   - Updates the capsule's bottom status line text.
   - Updates the timestamp in the capsule header.
   - Automatically expands and pins the island for **2 minutes** so all room participants see the activity live.

- **Visual Design Guidelines**:
  - Use `background: transparent;` on the `body` so the island container theme shines through.
  - Do not use background containers darker than Onicord's island surface (`--bg-island` / `#16161c`).
  - Use system typography (`font-family: "Roboto", system-ui, sans-serif;`).
  - Rounded squircle buttons/containers (`border-radius: 16px - 20px;`) and smooth micro-animations.

---

### 2.7 Persistent Local Storage (`Onicord.storage` / `OnicordWidgetAPI.storage`)
Store and retrieve persistent key-value JSON data scoped to the plugin. Requires the `storage` permission in `manifest.json`.

```javascript
// Save data to plugin storage
await OnicordWidgetAPI.storage.set("settings_key", { theme: "dark" });

// Load data from plugin storage
const data = await OnicordWidgetAPI.storage.get("settings_key");
```

---

### 2.8 External Network Requests (`fetch`)
Perform HTTP requests to external REST APIs. Requires the `network.outbound` permission in `manifest.json`.

```javascript
fetch('https://api.example.com/data')
  .then((res) => res.json())
  .then((data) => {
    console.log('API Response received:', data);
  })
  .catch((err) => console.error('Network error:', err));
```

---

### 2.9 Purging Plugin Messages (`Onicord.chat.clearPluginMessages`)
Allows a plugin to programmatically purge or clear its previously sent messages in the current room.

```javascript
Onicord.chat.clearPluginMessages();
```

---

## 3. Widgets Dashboard Specification

Dashboard widgets extend Onicord's main grid layout. All dashboard widgets are automatically formatted within Onicord's standardized design system.

### 3.1 Layout & Visual Container Standard (`onicord-widget-shell`)
Every plugin widget is rendered inside the official shell container:

* **Container Query Units**: Root element uses `containerType: "inline-size"`. Font sizing uses `clamp(0.6rem, 3.5cqi, 0.8rem)` to dynamically scale with card resizing.
* **Standard Header**: Displays the widget title and dynamic category badge (`onicord-widget-badge-dynamic`).
* **Color Variants (`bgVariant`)**: Supports official palette themes (`dark`, `sapphire`, `sky`, `teal`, `lavender`, `mauve`, `pink`, `peach`, `yellow`, `success`, `danger`).
* **Dynamic Blurred Image Backgrounds (`ui.setBackground`)**: Widgets can set cover art or background images that leverage Onicord's `backdrop-blur-md` rendering engine.

```javascript
// Apply dynamic blurred image background (e.g. music cover or game background)
OnicordWidgetAPI.ui.setBackground({
  type: "image",
  value: "https://example.com/cover.jpg"
});
```

---

## 4. Unified Granular Permission System (`manifest.json`)

Every plugin and widget must explicitly declare its required permissions in `manifest.json`. The application gatekeeper blocks any API call for ungranted permissions.

| Permission | Description | Data / Access Vector |
| :--- | :--- | :--- |
| `user.profile` | Access local user profile | User nickname, avatar base64, ID |
| `server.info` | Access active room information | Room code, server name, member count |
| `audio.state` | Access voice channel status | Connection state, mute/deaf, voice peers |
| `gaming.activity` | Access Rich Presence game activity | Active game name, start time, cover art |
| `chat.read` | Read incoming chat messages | Messages and slash command triggers |
| `chat.send` | Send and purge chat messages | Addon messages and interactive embeds |
| `p2p.network` | Real-time P2P data channel | Direct data packet broadcasting |
| `storage` | Persistent storage | Local JSON storage per addon |
| `ui.plugin_island` | Sidebar widgets | Plugin Island right-panel cards |
| `ui.custom_widget` | Custom UI controls | Custom buttons and panels |
| `network.outbound` | Outbound HTTP requests | External `fetch()` calls to web APIs |

---

## 5. Addon Creation, Structure & Compilation (`.onimod`)

### 5.1 Directory Structure
Create a directory inside `addons/` matching your plugin ID:

```text
my-addon/
├── manifest.json
├── index.js
├── widgets/
│   ├── pomodoro.html
│   └── p2p_notes.html
└── assets/
    └── icon.png
```

### 5.2 Complete `manifest.json` Example

```json
{
  "id": "com.oniverse.demo_addon",
  "name": "Demo Addon & Widgets",
  "version": "1.0.0",
  "author": "Oniverse Team",
  "description": "Custom dashboard widgets and slash commands",
  "main": "index.js",
  "icon": "extension",
  "permissions": [
    "user.profile",
    "server.info",
    "audio.state",
    "gaming.activity",
    "storage",
    "p2p.network",
    "chat.read",
    "chat.send"
  ],
  "dashboardWidgets": [
    {
      "id": "pomodoro_timer",
      "title": "Temporizador Pomodoro",
      "badgeText": "Local",
      "type": "local",
      "bgVariant": "dark",
      "entryPoint": "widgets/pomodoro.html",
      "defaultGeo": { "x": 1, "y": 1, "w": 2, "h": 2 }
    },
    {
      "id": "squad_notes",
      "title": "Notas de la Sala P2P",
      "badgeText": "P2P Live",
      "type": "collaborative",
      "bgVariant": "sapphire",
      "entryPoint": "widgets/p2p_notes.html",
      "defaultGeo": { "x": 3, "y": 1, "w": 2, "h": 2 }
    }
  ]
}
```

---

### 5.3 Complete Widget HTML Example (`widgets/pomodoro.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      background: transparent;
      color: #cdd6f4;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      height: 100vh;
    }
    .timer-display {
      font-size: 32px;
      font-weight: 800;
      font-family: monospace;
      color: #89b4fa;
      margin: 10px 0;
    }
    .btn {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div id="userInfo" style="font-size: 11px; opacity: 0.8;">Focus Time</div>
  <div class="timer-display" id="display">25:00</div>
  <button class="btn" id="toggleBtn">Iniciar</button>

  <script>
    let time = 1500;
    let timerId = null;

    window.addEventListener("onicord:widget-ready", async () => {
      // Access user profile (requires user.profile permission)
      const user = OnicordWidgetAPI.user.getProfile();
      if (user && user.nickname) {
        document.getElementById("userInfo").textContent = `Focus for ${user.nickname}`;
      }

      // Access storage (requires storage permission)
      const savedTime = await OnicordWidgetAPI.storage.get("pomodoro_time");
      if (savedTime) {
        time = parseInt(savedTime, 10);
        updateDisplay();
      }
    });

    function updateDisplay() {
      const m = String(Math.floor(time / 60)).padStart(2, "0");
      const s = String(time % 60).padStart(2, "0");
      document.getElementById("display").textContent = `${m}:${s}`;
    }

    document.getElementById("toggleBtn").onclick = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
        document.getElementById("toggleBtn").textContent = "Reanudar";
      } else {
        document.getElementById("toggleBtn").textContent = "Pausar";
        timerId = setInterval(() => {
          if (time > 0) {
            time--;
            updateDisplay();
            OnicordWidgetAPI.storage.set("pomodoro_time", time);
          } else {
            clearInterval(timerId);
            timerId = null;
          }
        }, 1000);
      }
    };
  </script>
</body>
</html>
```

---

### 5.4 Package Compiler (`node build.js`)
To validate, package, and update the central catalog (`index.json`), run the compiler script inside the `addons/` directory:

```bash
node build.js
```

The compiler will automatically:
1. Validate manifest syntax and source code integrity.
2. Generate binary bundles inside `plugins/<plugin-id>/package.onimod`.
3. Update versioning and catalog entries in `index.json`.

---

## 6. Addon Repository Structure

- `index.json`: Central catalog registry listing available downloadable addons.
- `build.js`: Official compiler script that packages source directories into `.onimod` bundles.
- `plugins/`: Directory containing compiled binary packages (`.onimod`) categorized by plugin ID.
- `demo_dashboard_addon/`: Official demo source code for local and P2P collaborative Widgets Dashboard widgets.
- `onicord-polls/`: Source code for the official Quick Polls addon (`/p`).
- `onicord-dice/`: Source code for the official collaborative dice roller addon for the Addon Island with real-time P2P synchronization and `/roll` chat command.
- `youtube-search/`: Source code for the official YouTube Search addon (`/y`).
- `google-search/`: Source code for the official Google Search addon (`/g`).
