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

            const getNick = () => {
              const raw = window._onicordUserNick;
              if (!raw || raw === 'PLAYER' || raw === 'Jugador') return '';
              return String(raw).replace(/[\\u0000-\\u001f\\u007f]/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 20);
            };

            const targetNick = getNick();

            // 1. Interceptar prompt de JS por si el motor o player_name.js pregunta el nombre
            if (targetNick) {
              const origPrompt = window.prompt;
              window.prompt = function(msg, def) {
                if (msg && typeof msg === 'string' && msg.toLowerCase().includes('player name')) {
                  return targetNick;
                }
                return origPrompt ? origPrompt.apply(this, arguments) : (targetNick || def);
              };
            }

            // 2. Interceptar copiado de enlaces para capturar la sala activa
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

            if (navigator.clipboard && !navigator.clipboard._onicordHooked) {
              const origWrite = navigator.clipboard.writeText;
              navigator.clipboard.writeText = function(text) {
                if (typeof text === 'string' && text.includes('sala=')) {
                  window._onicordRoomLink = text.trim();
                }
                return origWrite.apply(this, arguments);
              };
              navigator.clipboard._onicordHooked = true;
            }

            // 3. Hook al socket de salas PES6.Rooms.Link
            const hookRoomsLink = () => {
              if (window.PES6?.Rooms?.Link && !window.PES6.Rooms._onicordLiveHooked) {
                window.PES6.Rooms._onicordLiveHooked = true;

                const updateFromGame = (game) => {
                  if (game && game.room && game.room !== 'default' && game.room !== 'wait') {
                    const base = (window.PES6?.Config?.roomShareBase) || window.location.href;
                    const url = new URL(base, window.location.href);
                    url.searchParams.set('sala', game.room);
                    if (game.invite) url.searchParams.set('invite', game.invite);
                    window._onicordRoomLink = url.href;
                  } else if (game && !game.room) {
                    window._onicordRoomLink = null;
                  }
                };

                window.PES6.Rooms.Link.on('rooms', (msg) => {
                  try {
                    if (msg && msg.game) {
                      updateFromGame(msg.game);
                    }
                  } catch (_) {}
                });

                window.PES6.Rooms.Link.on('room-result', (msg) => {
                  try {
                    if (msg && msg.ok && (msg.action === 'create' || msg.action === 'join') && msg.room) {
                      const base = (window.PES6?.Config?.roomShareBase) || window.location.href;
                      const url = new URL(base, window.location.href);
                      url.searchParams.set('sala', msg.room);
                      if (msg.invite) url.searchParams.set('invite', msg.invite);
                      window._onicordRoomLink = url.href;
                    } else if (msg && (msg.action === 'leave' || (msg.action === 'join' && !msg.ok))) {
                      window._onicordRoomLink = null;
                    }
                  } catch (_) {}
                });

                window.PES6.Rooms.Link.on('open', () => {
                  const n = getNick();
                  if (n) {
                    try { window.PES6.Rooms.Link.send({ type: 'room-nick', nick: n }); } catch (_) {}
                  }
                });
              }
            };

            hookRoomsLink();
            setInterval(hookRoomsLink, 1000);

            // 4. Aplicar apodo en localStorage, inputs del DOM y PES6.Rooms.PlayerName
            const applyNick = () => {
              const nick = getNick();
              if (!nick) return;

              try {
                localStorage.setItem('pes6-player-name', nick);
                localStorage.setItem('player-name', nick);
              } catch (_) {}

              if (window.PES6?.Rooms?.PlayerName) {
                window.PES6.Rooms.PlayerName.ask = () => nick;
              }

              try {
                const nameInputs = document.querySelectorAll('input#player-name, input#playerName, input[name="player"], input#nick');
                nameInputs.forEach((inp) => {
                  if (inp && inp.value !== nick) {
                    inp.value = nick;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                });
              } catch (_) {}

              if (window.PES6?.Rooms?.Link) {
                const Link = window.PES6.Rooms.Link;
                if (typeof Link.send === 'function' && typeof Link.isOpen === 'function' && Link.isOpen()) {
                  try {
                    Link.send({ type: 'room-nick', nick: nick });
                  } catch (_) {}
                }
              }
            };

            applyNick();
            const nickInterval = setInterval(applyNick, 1000);
            setTimeout(() => clearInterval(nickInterval), 45000);

            // 5. Helper ejecutable para forzar lectura o refresco de sala
            window._onicordGetActiveRoomLink = function() {
              if (window._onicordRoomLink && window._onicordRoomLink.includes('sala=')) {
                return window._onicordRoomLink;
              }
              const shareBtn = document.getElementById('roomsShare');
              if (shareBtn && typeof shareBtn.onclick === 'function') {
                try {
                  shareBtn.onclick();
                  if (window._onicordRoomLink && window._onicordRoomLink.includes('sala=')) {
                    return window._onicordRoomLink;
                  }
                } catch (_) {}
              }
              if (window.PES6?.Rooms?.Link?.isOpen && window.PES6.Rooms.Link.isOpen()) {
                try { window.PES6.Rooms.Link.send({ type: 'room-list' }); } catch (_) {}
              }
              return window._onicordRoomLink || null;
            };
          } catch (e) {
            console.error('[PES6 Hook Error]', e);
          }
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
  },
  garticphone: {
    id: "garticphone",
    title: "Gartic Phone",
    icon: "draw",
    url: "https://garticphone.com/es/",
    cover: "https://garticphone.com/images/thumb.png",
    shareCapture: {
      triggerSelector: "button, [role=\"button\"]",
      windowProperty: "_onicordRoomLink",
      queryParam: "c="
    },
    frameScripts: [
      `
        (() => {
          try {
            const getNick = () => {
              const raw = window._onicordUserNick;
              if (!raw || raw === 'PLAYER' || raw === 'Jugador') return '';
              return String(raw).replace(/[\\u0000-\\u001f\\u007f]/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 20);
            };

            const targetNick = getNick();

            // 1. Interceptar copiado de enlaces para capturar la sala activa
            if (navigator.clipboard && !navigator.clipboard._onicordHooked) {
              const origWrite = navigator.clipboard.writeText;
              navigator.clipboard.writeText = function(text) {
                if (typeof text === 'string' && (text.includes('c=') || text.includes('garticphone.com'))) {
                  window._onicordRoomLink = text.trim();
                }
                return origWrite.apply(this, arguments);
              };
              navigator.clipboard._onicordHooked = true;
            }

            if (!document._onicordCopyHooked) {
              document.addEventListener('copy', () => {
                try {
                  const active = document.activeElement;
                  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                    const val = active.value;
                    if (val && (val.includes('c=') || val.includes('garticphone.com'))) {
                      window._onicordRoomLink = val.trim();
                    }
                  }
                } catch (_) {}
              }, true);
              document._onicordCopyHooked = true;
            }

            // 2. Monitoreo pasivo de la URL para capturar código de sala
            const checkUrl = () => {
              try {
                if (window.location && window.location.search && window.location.search.includes('c=')) {
                  window._onicordRoomLink = window.location.href;
                }
              } catch (_) {}
            };
            checkUrl();
            setInterval(checkUrl, 1000);

            // 3. Sincronización robusta del apodo con componentes React/Next.js
            const setReactInputValue = (input, val) => {
              try {
                const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
                if (descriptor && descriptor.set) {
                  descriptor.set.call(input, val);
                } else {
                  input.value = val;
                }
                input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
              } catch (_) {}
            };

            const applyNick = () => {
              const nick = getNick();
              if (!nick) return;

              try {
                localStorage.setItem('name', nick);
                localStorage.setItem('nick', nick);
                localStorage.setItem('nickname', nick);
                localStorage.setItem('user', JSON.stringify({ name: nick }));
                sessionStorage.setItem('nick', nick);
                sessionStorage.setItem('name', nick);
              } catch (_) {}

              try {
                const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));
                inputs.forEach((inp) => {
                  if (!inp.type || inp.type === 'text') {
                    if (inp.value !== nick) {
                      setReactInputValue(inp, nick);
                    }
                  }
                });
              } catch (_) {}
            };

            applyNick();
            const nickInterval = setInterval(applyNick, 600);
            setTimeout(() => clearInterval(nickInterval), 45000);

            // 4. Neutralización de motores de publicidad (AdinPlay, Google Ads, GPT)
            try {
              window.aiptag = window.aiptag || {};
              window.aiptag.cmd = window.aiptag.cmd || [];
              window.aiptag.cmd.display = [];
              window.aiptag.cmd.player = [];
              window.aiptag.display = () => {};
              window.aiptag.player = () => {};
              window.aiptag.showDisplay = () => {};
              window.aiptag.showPlayer = (opts) => {
                if (opts && typeof opts.onComplete === 'function') opts.onComplete();
              };

              window.adsbygoogle = window.adsbygoogle || [];
              window.adsbygoogle.push = function() {};

              window.googletag = window.googletag || {
                cmd: [],
                display: () => {},
                enableServices: () => {},
                pubads: () => ({
                  setTargeting: () => {},
                  clearTargeting: () => {},
                  enableSingleRequest: () => {},
                  collapseEmptyDivs: () => {},
                  refresh: () => {}
                })
              };
            } catch (_) {}

            // 5. Inyección de reglas CSS globales para eliminar al 100% todos los contenedores de anuncios
            try {
              const styleId = "onicord-clean-ads-style";
              if (!document.getElementById(styleId)) {
                const style = document.createElement("style");
                style.id = styleId;
                style.textContent = [
                  'ins.adsbygoogle,',
                  '.adsbygoogle,',
                  '[id*="google_ads"],',
                  '[id^="ad-"],',
                  '[id*="ad-"],',
                  '[id*="adinplay"],',
                  '[id*="nitropay"],',
                  '[id*="playwire"],',
                  '[id*="banner"],',
                  '.ad-banner,',
                  '.publi,',
                  '.anuncio,',
                  '.advertisement,',
                  '.ad-container,',
                  '.ad-wrapper,',
                  '.lateralAd,',
                  '.ad,',
                  '.ads,',
                  'aside[class*="ad"],',
                  'iframe[src*="adinplay"],',
                  'iframe[src*="doubleclick"],',
                  'iframe[src*="google"],',
                  'iframe[id*="ad"],',
                  'div[class*="publi"],',
                  'div[class*="bannerAd"] {',
                  '  display: none !important;',
                  '  visibility: hidden !important;',
                  '  height: 0 !important;',
                  '  width: 0 !important;',
                  '  min-height: 0 !important;',
                  '  min-width: 0 !important;',
                  '  opacity: 0 !important;',
                  '  pointer-events: none !important;',
                  '}'
                ].join('\\n');
                (document.head || document.documentElement).appendChild(style);
              }
            } catch (_) {}

            const hideAds = () => {
              try {
                const ads = document.querySelectorAll(
                  'ins.adsbygoogle, [id*="google_ads"], .ad-banner, .adsbygoogle, #ad-top, #ad-bottom, .publi, [id*="adinplay"], iframe[src*="adinplay"], iframe[id*="ad"]'
                );
                ads.forEach(ad => {
                  ad.style.setProperty('display', 'none', 'important');
                  if (ad.parentElement && (ad.parentElement.tagName === 'ASIDE' || ad.parentElement.className.includes('lateral'))) {
                    ad.parentElement.style.setProperty('display', 'none', 'important');
                  }
                });
              } catch (_) {}
            };
            hideAds();
            setInterval(hideAds, 1000);

            window._onicordGetActiveRoomLink = function() {
              if (window._onicordRoomLink && (window._onicordRoomLink.includes('c=') || window._onicordRoomLink.includes('garticphone.com'))) {
                return window._onicordRoomLink;
              }
              if (window.location && window.location.search && window.location.search.includes('c=')) {
                window._onicordRoomLink = window.location.href;
                return window._onicordRoomLink;
              }

              // Buscar en inputs o elementos que muestren el link de invitación
              try {
                const linkEl = Array.from(document.querySelectorAll('input, a')).find(el => {
                  const val = el.value || el.href || '';
                  return typeof val === 'string' && val.includes('c=');
                });
                if (linkEl) {
                  const found = (linkEl.value || linkEl.href).trim();
                  if (found.startsWith('http')) {
                    window._onicordRoomLink = found;
                    return found;
                  }
                }
              } catch (_) {}

              // Pulsar el botón de invitar del lobby para disparar el copiado
              const candidates = Array.from(document.querySelectorAll('button, [role="button"], a, input[type="button"]'));
              const invBtn = candidates.find(b => {
                const txt = (b.textContent || '').trim().toLowerCase();
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                const title = (b.getAttribute('title') || '').toLowerCase();
                const cls = (b.className || '').toString().toLowerCase();
                return txt.includes('invit') || txt.includes('share') || txt.includes('copiar') ||
                       aria.includes('invit') || aria.includes('share') || aria.includes('copiar') ||
                       cls.includes('invite') || cls.includes('share');
              });
              if (invBtn && typeof invBtn.click === 'function') {
                try { invBtn.click(); } catch (_) {}
              }
              return window._onicordRoomLink || (window.location.href.includes('c=') ? window.location.href : null);
            };
          } catch (e) {
            console.error('[Gartic Phone Hook Error]', e);
          }
        })()
      `
    ]
  },
  skribbl: {
    id: "skribbl",
    title: "Skribbl.io",
    icon: "palette",
    url: "https://skribbl.io/",
    cover: "https://skribbl.io/img/thumbnail.png",
    shareCapture: {
      triggerSelector: "#copy-invite, .copy-invite, #button-lobby-create",
      windowProperty: "_onicordRoomLink",
      queryParam: "skribbl.io/?"
    },
    frameScripts: [
      `
        (() => {
          try {
            const getNick = () => {
              const raw = window._onicordUserNick;
              if (!raw || raw === 'PLAYER') return '';
              return String(raw).replace(/[\\u0000-\\u001f\\u007f]/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 20);
            };

            const targetNick = getNick();

            if (navigator.clipboard && !navigator.clipboard._onicordHooked) {
              const origWrite = navigator.clipboard.writeText;
              navigator.clipboard.writeText = function(text) {
                if (typeof text === 'string' && text.includes('skribbl.io/?')) {
                  window._onicordRoomLink = text.trim();
                }
                return origWrite.apply(this, arguments);
              };
              navigator.clipboard._onicordHooked = true;
            }

            const checkRoom = () => {
              try {
                const inviteInput = document.querySelector('#input-invite');
                if (inviteInput && inviteInput.value && inviteInput.value.includes('skribbl.io/?')) {
                  window._onicordRoomLink = inviteInput.value.trim();
                } else if (window.location && window.location.search && window.location.search.length > 2 && window.location.href.includes('skribbl.io/?')) {
                  window._onicordRoomLink = window.location.href;
                }
              } catch (_) {}
            };
            checkRoom();
            setInterval(checkRoom, 1000);

            const applyNick = () => {
              const nick = getNick();
              if (!nick) return;
              try {
                localStorage.setItem('name', nick);
                localStorage.setItem('player-name', nick);
              } catch (_) {}

              try {
                const inputs = document.querySelectorAll('#input-name, input[name="name"], .input-name, input[placeholder*="Name" i], input[placeholder*="nombre" i]');
                inputs.forEach((inp) => {
                  if (inp && inp.value !== nick) {
                    inp.value = nick;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                });
              } catch (_) {}
            };

            applyNick();
            const nickInterval = setInterval(applyNick, 1000);
            setTimeout(() => clearInterval(nickInterval), 45000);

            // 4. Neutralización de motores de publicidad (AdinPlay, Google Ads, GPT)
            try {
              window.aiptag = window.aiptag || {};
              window.aiptag.cmd = window.aiptag.cmd || [];
              window.aiptag.cmd.display = [];
              window.aiptag.cmd.player = [];
              window.aiptag.display = () => {};
              window.aiptag.player = () => {};
              window.aiptag.showDisplay = () => {};
              window.aiptag.showPlayer = (opts) => {
                if (opts && typeof opts.onComplete === 'function') opts.onComplete();
              };

              window.adsbygoogle = window.adsbygoogle || [];
              window.adsbygoogle.push = function() {};

              window.googletag = window.googletag || {
                cmd: [],
                display: () => {},
                enableServices: () => {},
                pubads: () => ({
                  setTargeting: () => {},
                  clearTargeting: () => {},
                  enableSingleRequest: () => {},
                  collapseEmptyDivs: () => {},
                  refresh: () => {}
                })
              };
            } catch (_) {}

            // 5. Inyección de reglas CSS para eliminar contenedores y banners en Skribbl
            try {
              const styleId = "onicord-skribbl-ads-style";
              if (!document.getElementById(styleId)) {
                const style = document.createElement("style");
                style.id = styleId;
                style.textContent = [
                  '.ad-2,',
                  'ins.adsbygoogle,',
                  '.adsbygoogle,',
                  '[id*="ad-"],',
                  '[id^="ad-"],',
                  '[id*="adinplay"],',
                  '#banner-left,',
                  '#banner-right,',
                  'iframe[src*="adinplay"],',
                  'iframe[src*="doubleclick"] {',
                  '  display: none !important;',
                  '  visibility: hidden !important;',
                  '  height: 0 !important;',
                  '  width: 0 !important;',
                  '  opacity: 0 !important;',
                  '  pointer-events: none !important;',
                  '}'
                ].join('\\n');
                (document.head || document.documentElement).appendChild(style);
              }
            } catch (_) {}

            const hideAds = () => {
              try {
                const ads = document.querySelectorAll(
                  '.ad-2, ins.adsbygoogle, [id*="ad-"], .adsbygoogle, #banner-left, #banner-right, [id*="adinplay"], iframe[src*="adinplay"]'
                );
                ads.forEach(ad => ad.style.setProperty('display', 'none', 'important'));
              } catch (_) {}
            };
            hideAds();
            setInterval(hideAds, 1000);

            window._onicordGetActiveRoomLink = function() {
              const inviteInput = document.querySelector('#input-invite');
              if (inviteInput && inviteInput.value && inviteInput.value.includes('skribbl.io/?')) {
                return inviteInput.value.trim();
              }
              if (window._onicordRoomLink && window._onicordRoomLink.includes('skribbl.io/?')) {
                return window._onicordRoomLink;
              }
              if (window.location && window.location.search && window.location.search.length > 2 && window.location.href.includes('skribbl.io/?')) {
                return window.location.href;
              }
              const copyBtn = document.querySelector('#copy-invite, .copy-invite');
              if (copyBtn && typeof copyBtn.click === 'function') {
                try { copyBtn.click(); } catch (_) {}
              }
              return window._onicordRoomLink || null;
            };
          } catch (e) {
            console.error('[Skribbl Hook Error]', e);
          }
        })()
      `
    ]
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
      if (game.id === "skribbl") {
        u.search = `?${finalRoomCode}`;
      } else {
        u.searchParams.set(game.shareCapture?.queryParam?.replace("=", "") || "sala", finalRoomCode);
      }
      joinUrl = u.href;
    } catch (_) {
      joinUrl = game.id === "skribbl" ? `${game.url}?${finalRoomCode}` : `${game.url}?sala=${finalRoomCode}`;
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

  // Atajos para lanzar juegos directamente
  Onicord.chat.onCommand("pes6", async (args) => {
    const room = args && args[0] ? args[0] : null;
    launchGame(GAMES_REGISTRY.pes6, { roomCode: room, url: room ? `https://pes6.optijuegos.net/?sala=${room}` : GAMES_REGISTRY.pes6.url });
  });

  Onicord.chat.onCommand("gartic", async (args) => {
    const room = args && args[0] ? args[0] : null;
    launchGame(GAMES_REGISTRY.garticphone, { roomCode: room, url: room ? `https://garticphone.com/es/?c=${room}` : GAMES_REGISTRY.garticphone.url });
  });

  Onicord.chat.onCommand("skribbl", async (args) => {
    const room = args && args[0] ? args[0] : null;
    launchGame(GAMES_REGISTRY.skribbl, { roomCode: room, url: room ? `https://skribbl.io/?${room}` : GAMES_REGISTRY.skribbl.url });
  });
}

// ==========================================
// 7. RESOLVEDOR AGNÓSTICO DE ETAPAS (STAGE RESOLVER)
// ==========================================
// Permite que cuando un compañero se una desde el chat a una partida de Arcade,
// Onicord consulte de forma agnóstica a este complemento los scripts y hooks locales confiables.
if (typeof Onicord !== "undefined" && Onicord.stage?.onResolveStage) {
  Onicord.stage.onResolveStage((stageReq) => {
    if (!stageReq) return null;
    const reqUrl = stageReq.url ? String(stageReq.url).toLowerCase() : "";
    for (const game of Object.values(GAMES_REGISTRY)) {
      if (!game.url) continue;
      const baseUrl = game.url.split("?")[0].toLowerCase().replace(/\/+$/, "");
      if (reqUrl.startsWith(baseUrl) || (stageReq.id && stageReq.id === game.id)) {
        return {
          title: game.title,
          icon: game.icon || "sports_esports",
          cover: game.cover || null,
          shareCapture: game.shareCapture || null,
          frameScripts: game.frameScripts || [],
        };
      }
    }
    return null;
  });
}

