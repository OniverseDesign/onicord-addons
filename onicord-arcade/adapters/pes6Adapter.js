// Adaptador de Integración para Pro Evolution Soccer 6 (OptiJuegos Web)

const PES6_BASE_URL = "https://pes6.optijuegos.net/";

function buildLobbyUrl(roomCode, inviteToken) {
  try {
    const url = new URL(PES6_BASE_URL);
    if (roomCode) url.searchParams.set("sala", roomCode);
    if (inviteToken) url.searchParams.set("invite", inviteToken);
    return url.href;
  } catch {
    return PES6_BASE_URL;
  }
}

function buildLobbyEmbed(user, roomCode, inviteToken) {
  const authorName = user?.nickname || user?.username || "Jugador";
  const finalRoomCode = roomCode || String(Math.floor(100 + Math.random() * 900));
  const joinUrl = buildLobbyUrl(finalRoomCode, inviteToken);

  return {
    pluginId: "onicord-arcade",
    type: "game_lobby",
    data: {
      gameTitle: "PES 6 Web Online",
      gameIcon: "sports_soccer",
      roomCode: finalRoomCode,
      authorName: authorName,
      joinUrl: joinUrl,
      supportsControllers: true,
      commentaryOptions: ["Español", "Mariano Closs"],
    },
  };
}

module.exports = {
  PES6_BASE_URL,
  buildLobbyUrl,
  buildLobbyEmbed,
};
