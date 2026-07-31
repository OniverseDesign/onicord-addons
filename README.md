# Onicord Addons Development Guide & Technical Specification

Welcome to the official developer documentation for **Onicord** addons and plugins. This guide details the sandboxing architecture, all interaction vectors with the app, permission schemas, and instructions for compiling and packaging addons into `.onimod` bundles.

---

## 1. Architecture & Sandboxing Overview

Onicord plugins operate through a secure, decentralized architecture:

* **V8 Isolated Sandbox**: Every plugin runs within an isolated Node.js `vm` context (`pluginSandboxService.cjs`). It has no direct access to the host file system or main process except via the injected `Onicord` global object.
* **Encrypted P2P Network**: Room communications between peers are transmitted via AES-256-GCM encrypted P2P data channels.
* **Optional User Activation**: Users can join any room immediately without mandatory downloads, with the option to enable or disable suggested addons in one click.

---

## 2. Plugin Interaction Vectors

Plugins have 8 primary methods to interact with the application, chat, user interface, and P2P network:

### 2.1 Slash Command Registration (`Onicord.chat.onCommand`)
Allows plugins to register custom chat commands (e.g., `/p`, `/y`, `/g`) that users can execute from the chat input.

```javascript
// Register a slash command inside the V8 Sandbox
Onicord.chat.onCommand('p', (args) => {
  // args contains the parameters entered by the user
  const query = args.join(' ');
  console.log('Command executed with args:', query);
});
```

---

### 2.2 Chat Messages & Interactive Cards (`[PLUGIN_EMBED]`)
Plugins can publish chat messages under their official addon identity (`isComplement: true`). To render rich interactive cards (polls, search results, dice rolls, widgets), use the `[PLUGIN_EMBED]` payload format.

```javascript
// Broadcast an interactive embed card to the room chat
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

### 2.3 Real-Time User Interactions (`[PLUGIN_ACTION]`)
Capture user actions on plugin cards (e.g., clicking a poll option or button) and transmit them to all room participants without polluting the visible chat history.

```javascript
// Emit an interactive action payload from the client UI
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

### 2.4 Direct P2P Data Broadcasting (`Onicord.p2p`)
For applications requiring direct peer-to-peer data exchange (real-time minigames, shared whiteboards, state synchronization) without sending chat messages.

```javascript
// Broadcast raw P2P data packet to all connected room peers
Onicord.p2p.broadcast({
  type: 'GAME_MOVE',
  x: 10,
  y: 25
});

// Listen for incoming P2P data packets from other peers
Onicord.p2p.onMessage(({ pluginId, data }) => {
  console.log('P2P data received:', data);
});
```

---

### 2.5 Plugin Island Sidebar Widgets (`Onicord.ui.registerPluginIslandWidget`)
Inject compact status cards or control panels into the application right panel (Plugin Island).

```javascript
// Register a compact widget in the right panel sidebar
Onicord.ui.registerPluginIslandWidget({
  id: 'poll-active-status',
  title: 'Active Poll',
  component: 'ActivePollWidget'
});
```

---

### 2.6 Interface Toast Notifications (`Onicord.ui.showToast`)
Display temporary toast notifications inside Onicord's UI to inform the user of errors or important events.

```javascript
// Show toast notification in the application UI
Onicord.ui.showToast('⚠️ Usage: /p Question -Option 1 -Option 2');
```

---

### 2.7 External Network Requests (`fetch`)
Perform HTTP requests to external REST APIs. Requires the `network.outbound` permission in `manifest.json`.

```javascript
// Fetch external API data (requires network.outbound permission)
fetch('https://api.example.com/data')
  .then((res) => res.json())
  .then((data) => {
    console.log('API Response received:', data);
  })
  .catch((err) => console.error('Network error:', err));
```

---

### 2.8 Purging Plugin Messages (`Onicord.chat.clearPluginMessages`)
Allows a plugin to programmatically purge or clear its previously sent messages in the current room.

```javascript
// Purge previously sent messages by this plugin
Onicord.chat.clearPluginMessages();
```

---

## 3. Granular Permission System (`manifest.json`)

Every plugin must explicitly declare its required permissions in `manifest.json`. Users can review and approve these permissions before enabling a plugin.

| Permission | Description | Risk Level |
| :--- | :--- | :--- |
| `chat.read` | Read incoming chat messages | 🟡 Medium |
| `chat.send` | Send messages and interactive cards to chat | 🟢 Low |
| `p2p.network` | Broadcast and receive raw P2P data packets | 🟢 Low |
| `ui.plugin_island` | Render widgets in the Plugin Island sidebar | 🟢 Low |
| `ui.custom_widget` | Render custom UI buttons or panels | 🟢 Low |
| `audio.play_sound` | Stream audio into WebRTC voice channels | 🟡 Medium |
| `storage.local` | Store key-value data in local storage | 🟢 Low |
| `network.outbound` | Perform HTTP requests to external domains (`fetch`) | 🔴 High |

---

## 4. Addon Creation, Structure & Compilation (`.onimod`)

### 4.1 Directory Structure
Create a directory inside `addons/` matching your plugin ID:

```text
my-addon/
├── manifest.json
├── index.js
└── assets/
    └── icon.png
```

### 4.2 Complete `manifest.json` Example

```json
{
  "id": "onicord-polls",
  "name": "Quick Polls",
  "version": "1.0.0",
  "author": "Oniverse Team",
  "description": "Create real-time interactive polls with /p",
  "locales": {
    "es": {
      "name": "Encuestas Rápidas",
      "description": "Crea encuestas interactivas en tiempo real con /p"
    }
  },
  "main": "index.js",
  "icon": "smart_toy",
  "commands": [
    {
      "command": "/p",
      "description": "Creates a poll. Usage: /p Question -Option 1 -Option 2"
    }
  ],
  "permissions": [
    "chat.read",
    "chat.send",
    "p2p.network"
  ]
}
```

### 4.3 Complete `index.js` Example

```javascript
// Polls addon implementation in Javascript

function parsePollInput(rawInput) {
  if (!rawInput || typeof rawInput !== "string") return null;

  let text = rawInput.trim();
  if (text.toLowerCase().startsWith("/p")) {
    text = text.substring(2).trim();
  }
  if (!text) return null;

  const dashIndex = text.search(/(?<=\s|^)-(?=[^\s])/);
  if (dashIndex === -1) return null;

  let question = text.substring(0, dashIndex).trim();
  if (question.startsWith('"') && question.endsWith('"') && question.length > 1) {
    question = question.slice(1, -1).trim();
  }

  const optionsRaw = text.substring(dashIndex);
  const rawParts = optionsRaw
    .split(/(?<=\s|^)-(?=[^\s])/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const options = [];
  for (let part of rawParts) {
    let optText = part;
    if (optText.startsWith("-")) optText = optText.substring(1).trim();
    if (optText.startsWith('"') && optText.endsWith('"') && optText.length > 1) {
      optText = optText.slice(1, -1).trim();
    }
    if (optText) options.push(optText);
  }

  if (!question || options.length < 2) return null;

  return {
    question,
    options: options.map((textStr, idx) => ({
      id: `opt_${idx}`,
      text: textStr,
      voters: [],
    })),
  };
}

// Register the /p command handler inside the V8 Sandbox
if (typeof Onicord !== "undefined" && Onicord.chat?.onCommand) {
  Onicord.chat.onCommand("p", (args) => {
    const rawInput = args.join(" ");
    const parsed = parsePollInput(rawInput.startsWith("/p") ? rawInput : `/p ${rawInput}`);

    if (!parsed) {
      if (Onicord.ui?.showToast) {
        Onicord.ui.showToast("⚠️ Usage: /p What are we having for dinner? -Pizza -Tacos");
      }
      return;
    }

    const embedPayload = {
      pluginId: "onicord-polls",
      type: "poll",
      data: {
        pollId: `poll_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        question: parsed.question,
        options: parsed.options,
        createdAt: Date.now(),
      },
    };

    // Publish message under the official plugin identity
    Onicord.chat.sendMessage({
      text: `[PLUGIN_EMBED]:${JSON.stringify(embedPayload)}`,
    });
  });
}
```

### 4.4 Package Compiler (`node build.js`)
To validate, package, and update the central catalog (`index.json`), run the compiler script inside the `addons/` directory:

```bash
node build.js
```

The compiler will automatically:
1. Validate manifest syntax and source code integrity.
2. Generate binary bundles inside `plugins/<plugin-id>/package.onimod`.
3. Update versioning and catalog entries in `index.json`.

---

## 5. Addon Repository Structure

- `index.json`: Central catalog registry listing available downloadable addons.
- `build.js`: Official compiler script that packages source directories into `.onimod` bundles.
- `plugins/`: Directory containing compiled binary packages (`.onimod`) categorized by plugin ID.
- `onicord-polls/`: Source code for the official Quick Polls addon (`/p`).
- `youtube-search/`: Source code for the official YouTube Search addon (`/y`).
- `google-search/`: Source code for the official Google Search addon (`/g`).
