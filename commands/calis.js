const { SlashCommandBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("calis").setDescription("Çalışarak para kazanırsın."),
  async execute(interaction, client, config, store) {
    const db = store.read("economy.json", {});
    const key = `${interaction.guildId}:${interaction.user.id}`;
    const account = db[key] || { cash: 0, bank: 0, lastWork: 0 };
    const now = Date.now(), cooldown = 30 * 60 * 1000;
    if (now - (account.lastWork || 0) < cooldown) {
      const left = cooldown - (now - account.lastWork);
      return interaction.reply({ content: `Dinlenmelisin. **${Math.ceil(left / 60000)} dakika** sonra tekrar çalışabilirsin.`, ephemeral: true });
    }
    const reward = Math.floor(Math.random() * 151) + 100;
    account.cash = (account.cash || 0) + reward;
    account.lastWork = now; db[key] = account; store.write("economy.json", db);
    await interaction.reply(`💼 Çalıştın ve **${reward}** 🪙 kazandın!`);
  }
};
