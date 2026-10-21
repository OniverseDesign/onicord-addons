// =========================================================================
// Complemento Oficial: Arcade (Launcher de Juegos Web y Emuladores)
// =========================================================================
// Plataforma extensible para catálogo de juegos, multijugador P2P, lobbies y PiP.

// ==========================================
// 1. REGISTRO EXTENSIBLE DE JUEGOS Y HOOKS
// ==========================================
const GAMES_REGISTRY = {
  pes6: {
    id: "pes6",
    title: "Pro Evolution Soccer 6",
    icon: "sports_soccer",
    url: "https://pes6.optijuegos.net/",
    cover: "https://thumbnails.libretro.com/Sony%20-%20PlayStation%202/Named_Boxarts/Pro%20Evolution%20Soccer%206%20(Europe).png",
    shareCapture: {
      triggerSelector: "#roomsShare",
      windowProperty: "_onicordRoomLink",
      queryParam: "sala",
    },
    frameScripts: [
      `
        (() => {
          try {
            window.PES6 = window.PES6 || {};
            if (!window.PES6.Ads) window.PES6.Ads = { load: () => {} };
            window.adsbygoogle = window.adsbygoogle || [];

            if (window.PES6.Core && !window.PES6.Core._onicordHooked) {
              const origCopy = window.PES6.Core.copyText;
              window.PES6.Core.copyText = function(text, button, label) {
                if (typeof text === 'string' && text.includes('sala=')) {
                  window._onicordRoomLink = text.trim();
                }
                return origCopy.apply(this, arguments);
              };
              window.PES6.Core._onicordHooked = true;
            }

            const hookRoomsLink = () => {
              if (window.PES6?.Rooms?.Link?.on && !window.PES6.Rooms._onicordLiveHooked) {
                window.PES6.Rooms._onicordLiveHooked = true;

                window.PES6.Rooms.Link.on('rooms', (msg) => {
                  try {
                    if (msg && msg.game && msg.game.room && msg.game.room !== 'default' && msg.game.room !== 'wait') {
                      const url = new URL(window.location.href);
                      url.searchParams.set('sala', msg.game.room);
                      if (msg.game.invite) url.searchParams.set('invite', msg.game.invite);
                      window._onicordRoomLink = url.href;
                    } else if (msg && msg.game && !msg.game.room) {
                      window._onicordRoomLink = null;
                    }
                  } catch (_) {}
                });

                window.PES6.Rooms.Link.on('room-result', (msg) => {
                  try {
                    if (msg && (msg.action === 'leave' || (msg.action === 'join' && !msg.ok))) {
                      window._onicordRoomLink = null;
                    }
                  } catch (_) {}
                });
              }
            };

            hookRoomsLink();
            if (!window.PES6.Rooms?._onicordLiveHooked) {
              const hookInterval = setInterval(() => {
                hookRoomsLink();
                if (window.PES6.Rooms?._onicordLiveHooked) clearInterval(hookInterval);
              }, 500);
            }

            const applyNick = () => {
              const rawNick = window._onicordUserNick;
              if (!rawNick || rawNick === 'PLAYER') return;
              const nick = String(rawNick).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20);
              if (!nick) return;

              try {
                localStorage.setItem('pes6-player-name', nick);
              } catch (_) {}

              if (window.PES6?.Rooms?.PlayerName) {
                window.PES6.Rooms.PlayerName.ask = () => nick;
              }

              if (window.PES6?.Rooms?.Link) {
                const Link = window.PES6.Rooms.Link;
                if (typeof Link.send === 'function') {
                  try {
                    Link.send({ type: 'room-nick', nick: nick });
                  } catch (_) {}
                }
                if (!Link._onicordNickHooked && typeof Link.on === 'function') {
                  Link._onicordNickHooked = true;
                  Link.on('open', () => {
                    try {
                      Link.send({ type: 'room-nick', nick: nick });
                    } catch (_) {}
                  });
                }
              }
            };

            applyNick();
            const nickInterval = setInterval(applyNick, 1000);
            setTimeout(() => clearInterval(nickInterval), 20000);
          } catch (_) {}
        })()
      `
    ]
  },
  dbzbt3: {
    id: "dbzbt3",
    title: "Dragon Ball Z: Budokai Tenkaichi 3",
    icon: "sports_kabaddi",
    url: "https://dragonballbt3.online/",
    cover: "https://thumbnails.libretro.com/Sony%20-%20PlayStation%202/Named_Boxarts/Dragon%20Ball%20Z%20-%20Budokai%20Tenkaichi%203%20(USA)%20(En,Ja).png",
  },
  nfsu2: {
    id: "nfsu2",
    title: "Need for Speed: Underground 2",
    icon: "sports_motorsports",
    url: "https://nfsunderground2.site/",
    cover: "https://thumbnails.libretro.com/Sony%20-%20PlayStation%202/Named_Boxarts/Need%20for%20Speed%20-%20Underground%202%20(USA).png",
  },
  doom: {
    id: "doom",
    title: "DOOM (Silent Space Marine)",
    icon: "crosshairs",
    url: "https://silentspacemarine.com/",
    cover: "https://thumbnails.libretro.com/DOS/Named_Boxarts/DOOM%20(1993).png",
  },
  tboi: {
    id: "tboi",
    title: "The Binding of Isaac: Repentance",
    icon: "skull",
    url: "https://tboi.online/",
    cover: "https://tboi.online/og.jpg",
  },
  minecraft: {
    id: "minecraft",
    title: "Minecraft (Web Edition)",
    icon: "view_in_ar",
    url: "https://mcraft.fun/",
    cover: "https://mcraft.fun/loading-bg.jpg",
  }
};

// ==========================================
// 2. APERTURA DEL CATÁLOGO LAUNCHER
// ==========================================
function openArcadeLauncher() {
  const user = Onicord.user?.getProfile?.() || {};
  const nick = user.nickname || user.username || "Jugador";

  const stageDef = {
    pluginId: "onicord-arcade",
    title: "Arcade",
    icon: "sports_esports",
    entryPoint: "widgets/launcher.html",
    authorName: nick,
    userNick: nick,
    activity: {
      name: "Arcade",
      details: "Catálogo de Juegos",
      state: null,
      cover: null,
      type: "launcher",
      isCatalog: true,
      startTime: Date.now(),
    },
  };

  if (Onicord.ui?.openStageView) {
    Onicord.ui.openStageView(stageDef);
  }

  if (Onicord.gaming?.setActivity) {
    Onicord.gaming.setActivity(stageDef.activity);
  }
}

// ==========================================
// 3. MOTOR GENÉRICO DE LANZAMIENTO DE JUEGOS
// ==========================================
function launchGame(gameConfig = {}, overrides = {}) {
  const user = Onicord.user?.getProfile?.() || {};
  const nick = overrides.userNick || user.nickname || user.username || "Jugador";
  const roomCode = overrides.roomCode || null;

  const stageDef = {
    pluginId: "onicord-arcade",
    title: gameConfig.title || "Juego Arcade",
    icon: gameConfig.icon || "sports_esports",
    url: overrides.url || gameConfig.url,
    authorName: nick,
    userNick: nick,
    shareCapture: gameConfig.shareCapture || null,
    frameScripts: gameConfig.frameScripts || [],
    activity: {
      name: gameConfig.title || "Juego Arcade",
      details: "Arcade",
      state: roomCode ? `En sala #${roomCode}` : (gameConfig.state || "Jugando"),
      cover: gameConfig.cover || null,
      party: roomCode ? (gameConfig.party || { size: 1, max: 2 }) : null,
      type: "game",
      isCatalog: false,
      startTime: Date.now(),
    },
    ...overrides,
  };

  if (Onicord.ui?.openStageView) {
    Onicord.ui.openStageView(stageDef);
  }

  if (Onicord.gaming?.setActivity) {
    Onicord.gaming.setActivity(stageDef.activity);
  }
}

// ==========================================
// 4. COMPARTIR SALAS EN EL CHAT (TARJETA INTERACTIVA)
// ==========================================
async function shareGameLobby(gameKey, roomCode, context = null) {
  const game = GAMES_REGISTRY[gameKey] || {
    id: gameKey,
    title: gameKey.toUpperCase(),
    icon: "sports_esports",
    url: ""
  };
  const user = context?.author || Onicord.user?.getProfile?.() || { nickname: "Jugador" };
  const nick = user.nickname || user.username || "Jugador";
  const finalRoomCode = roomCode || String(Math.floor(100 + Math.random() * 900));

  let joinUrl = game.url;
  if (game.url && finalRoomCode) {
    try {
      const u = new URL(game.url);
      u.searchParams.set(game.shareCapture?.queryParam || "sala", finalRoomCode);
      joinUrl = u.href;
    } catch (_) {
      joinUrl = `${game.url}?sala=${finalRoomCode}`;
    }
  }

  const embedPayload = {
    pluginId: "onicord-arcade",
    type: "game_lobby",
    data: {
      gameTitle: game.title,
      gameIcon: game.icon || "sports_esports",
      coverUrl: game.cover || null,
      roomCode: finalRoomCode,
      authorName: nick,
      userNick: nick,
      joinUrl: joinUrl,
      activity: {
        name: game.title,
        details: "Arcade",
        state: `En sala #${finalRoomCode}`,
        cover: game.cover || null,
        party: { size: 1, max: 2 },
      },
      shareCapture: game.shareCapture || null,
    },
  };

  await Onicord.chat.sendMessage({
    text: `[PLUGIN_EMBED]:${JSON.stringify(embedPayload)}`,
  });
}

// ==========================================
// 5. REGISTRO DE CONTROLES E INTERFAZ
// ==========================================

// Botón de la barra de controles de voz (Icono de Joystick abre el Catálogo)
if (typeof Onicord !== "undefined" && Onicord.ui?.registerVoiceControlButton) {
  Onicord.ui.registerVoiceControlButton({
    id: "arcade_joystick",
    icon: "sports_esports",
    tooltip: "Arcade (Catálogo de Juegos)",
    action: "TOGGLE_ARCADE_STAGE",
    onClick: () => {
      openArcadeLauncher();
    },
  });
}

// ==========================================
// 6. COMANDOS DE CHAT
// ==========================================
if (typeof Onicord !== "undefined" && Onicord.chat?.onCommand) {
  // Comando para abrir el catálogo general
  Onicord.chat.onCommand("arcade", async () => {
    openArcadeLauncher();
  });
}
