const fs = require("node:fs/promises");
const path = require("node:path");

const CONFIG_FILE = "cardtrader.json";

function getCardTraderConfigPath(userDataDirectory) {
  return path.join(userDataDirectory, CONFIG_FILE);
}

async function loadCardTraderToken(userDataDirectory) {
  try {
    const raw = await fs.readFile(getCardTraderConfigPath(userDataDirectory), "utf8");
    const token = JSON.parse(raw)?.token;
    return typeof token === "string" && token.trim() ? token.trim() : null;
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function saveCardTraderToken(userDataDirectory, token) {
  const normalized = typeof token === "string" ? token.trim() : "";
  if (!normalized) throw new Error("Informe um token válido do CardTrader.");
  await fs.mkdir(userDataDirectory, { recursive: true });
  await fs.writeFile(
    getCardTraderConfigPath(userDataDirectory),
    `${JSON.stringify({ token: normalized }, null, 2)}\n`,
    "utf8",
  );
  return normalized;
}

async function removeCardTraderToken(userDataDirectory) {
  await fs.rm(getCardTraderConfigPath(userDataDirectory), { force: true });
}

module.exports = {
  getCardTraderConfigPath,
  loadCardTraderToken,
  saveCardTraderToken,
  removeCardTraderToken,
};
