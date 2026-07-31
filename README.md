# Official Onicord Addons Repository & Developer Guide

Welcome to the official addon and plugin registry for **Onicord**.  
This repository contains official addons, community modules, build tools, and the central registry catalog (`index.json`).

---

## Addon Architecture & How Plugins Work in Onicord

Onicord introduces a **decentralized P2P Workshop model** for extensibility inspired by Steam Workshop, V8 sandboxing, and generic P2P data channels.

### 1. Key Principles
* **Server-Suggested, User-Optional**: Room owners can suggest plugins for a room. Users can join rooms **immediately without mandatory downloads**. An unobtrusive banner allows users to install suggested addons in 1-click or skip them.
* **Isolated V8 Sandbox**: Every addon runs in an isolated Node.js V8 sandbox (`pluginSandboxService.cjs`) with strict permission enforcement to ensure host system security.
* **P2P Data Messaging**: Addons communicate across room peers over AES-256-GCM encrypted P2P data channels via `Onicord.p2p.broadcast()` and `Onicord.p2p.onMessage()`.

---

## UI Injection Slots

Addons can inject custom interfaces into 5 secure, isolated UI slots:

1. **Plugin Island Widget (Right Panel Slot)**:
   - Positioned between the Rich Presence Island and the Member List on the right sidebar.
   - Allows active plugins to render compact, card-style widgets (e.g., active polls, jukebox control bars, server counters, climate widgets).
2. **Rich Cards in Chat**:
   - Render interactive card embeds directly inside the chat feed (e.g., polls with click-to-vote buttons, dice rolls, interactive minigames).
3. **Extended Side Panels & Modals**:
   - Slide-out panels or modals for complex tools (e.g., shared whiteboard, music queue manager).
4. **Quick Action Toolbar Icons**:
   - Custom buttons added to channel header toolbars (e.g., soundboard trigger next to microphone controls).
5. **Voice Channel Overlays (PiP)**:
   - Picture-in-Picture widgets for voice channels.

---

## Generic Interactive Embeds & Actions Protocol (`[PLUGIN_EMBED]` and `[PLUGIN_ACTION]`)

To allow **any plugin** to render rich cards and handle user interactions without modifying Onicord's core source code, the application provides a generic payload protocol:

### 1. Publishing Interactive Cards (`[PLUGIN_EMBED]`)
When a plugin command is executed (e.g., `/p` for polls or `/roll` for dice), the plugin sends a chat payload starting with `[PLUGIN_EMBED]`:

```json
[PLUGIN_EMBED]:{
  "pluginId": "onicord-polls",
  "type": "poll",
  "data": {
    "pollId": "poll_1784741234_abc12",
    "question": "¿Qué cenamos hoy?",
    "options": [
      { "id": "opt_0", "text": "Pizza", "voters": [] },
      { "id": "opt_1", "text": "Tacos", "voters": [] }
    ],
    "createdAt": 1784741234
  }
}
```

* **Native Styling**: The app renders the card using Onicord's CSS theme tokens (`bg-onicord-mantle`, `border-white/10`, `text-onicord-text`, `bg-onicord-accent`), guaranteeing visual consistency across all color themes.

### 2. Transmitting User Interactions (`[PLUGIN_ACTION]`)
When a user clicks a card option (e.g., voting on a poll option), the client broadcasts a P2P action payload starting with `[PLUGIN_ACTION]`:

```json
[PLUGIN_ACTION]:{
  "pluginId": "onicord-polls",
  "action": "VOTE",
  "targetId": "poll_1784741234_abc12",
  "data": {
    "pollId": "poll_1784741234_abc12",
    "optionId": "opt_0",
    "voter": {
      "id": "usr_99812",
      "name": "UserP2P",
      "avatar": "https://..."
    }
  }
}
```

### 3. Automatic History Reconciliation
When loading room history, Onicord reconciles `[PLUGIN_ACTION]` packets onto target `[PLUGIN_EMBED]` cards via `processHistoryWithReactions`, updating vote counts, progress bars, and voter avatars in real time and across app restarts.

---

## Granular Permissions System (`manifest.json`)

Addons must explicitly declare required permissions in `manifest.json`. Users can review and approve permissions before enabling an addon:

| Permission | Description | Risk Level |
| :--- | :--- | :--- |
| `chat.read` | Read incoming chat messages | 🟡 Medium |
| `chat.send` | Send messages and interactive embeds to chat | 🟢 Low |
| `p2p.network` | Broadcast and receive P2P data packets with other room peers | 🟢 Low |
| `ui.plugin_island` | Render compact widgets in the right panel Plugin Island slot | 🟢 Low |
| `ui.custom_widget` | Render custom buttons or UI panels | 🟢 Low |
| `audio.play_sound` | Play audio streams in WebRTC voice channels | 🟡 Medium |
| `storage.local` | Store key-value data in local client storage | 🟢 Low |
| `network.outbound` | Perform HTTP requests to external domains (requires domain whitelist) | 🔴 High |

---

## How to Create, Build, and Package an Addon (`.onimod`)

### 1. Addon Directory Structure
Create a directory inside `addons/` containing your addon source code:

```text
my-addon/
├── manifest.json
├── index.js
└── assets/
    └── icon.png
```

### 2. Example `manifest.json`
```json
{
  "id": "my-addon-id",
  "name": "My Custom Addon",
  "version": "1.0.0",
  "author": "Author Name",
  "description": "Interactive addon for Onicord.",
  "main": "index.js",
  "commands": [
    {
      "command": "/cmd",
      "description": "Executes my custom command"
    }
  ],
  "permissions": [
    "chat.read",
    "chat.send",
    "p2p.network"
  ]
}
```

### 3. Example `index.js`
```javascript
// Register command handler
Onicord.chat.onCommand('cmd', (args) => {
  const input = args.join(' ');

  // 1. Broadcast an interactive embed card
  Onicord.chat.sendMessage({
    pluginId: 'my-addon-id',
    type: 'card',
    data: {
      title: 'Interactive Card',
      content: input
    }
  });

  // 2. Broadcast P2P event to peers
  Onicord.p2p.broadcast({
    action: 'EVENT_TRIGGERED',
    payload: { input }
  });
});
```

### 4. Compiling the Addon (`.onimod`)
To compile your addon into a `.onimod` bundle and register it in `index.json`, run the build script from the root or `addons/` directory:

```bash
node build.js
```
*(or `npm run build` / `npm run pack`)*

The compiler will automatically:
1. Validate `manifest.json` and `index.js`.
2. Bundle the files into `plugins/<addon-id>/package.onimod`.
3. Register the compiled addon in `index.json`.

---

## Repository Structure

- `index.json`: Central catalog registry listing compiled addons.
- `build.js`: Addon compiler script that packages addons into `.onimod` bundles.
- `plugins/`: Compiled `.onimod` distribution packages categorized by addon ID.
- `onicord-polls/`: Source directory for the official Polls addon (`/p`).
- `youtube-search/`: Source directory for the YouTube search addon (`/y`).
- `google-search/`: Source directory for the Google search addon (`/g`).
