// Onicord Polls Addon (/p)

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

module.exports = {
  parsePollInput,
};
