require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");
const config = require("./config");

if (!config.token || !config.clientId || !config.guildId) {
  console.error("❌ .env içinde DISCORD_TOKEN, CLIENT_ID ve GUILD_ID gerekli.");
  process.exit(1);
}
const commands = [];
const dir = path.join(__dirname, "commands");
for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) {
  const command = require(path.join(dir, file));
  if (command.data?.toJSON) commands.push(command.data.toJSON());
}
(async () => {
  try {
    await new REST({ version: "10" }).setToken(config.token).put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log(`✅ ${commands.length} slash komutu kaydedildi.`);
  } catch (error) {
    console.error("Komut kaydetme hatası:", error);
    process.exitCode = 1;
  }
})();
