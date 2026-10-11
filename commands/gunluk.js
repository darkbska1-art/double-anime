const { SlashCommandBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("gunluk").setDescription("Günlük para ödülünü alırsın."),
  async execute(interaction, client, config, store) {
    const db = store.read("economy.json", {});
    const key = `${interaction.guildId}:${interaction.user.id}`;
    const account = db[key] || { cash: 0, bank: 0, lastDaily: 0 };
    const now = Date.now(), cooldown = 24 * 60 * 60 * 1000;
    if (now - (account.lastDaily || 0) < cooldown) {
      const left = cooldown - (now - account.lastDaily);
      const hours = Math.floor(left / 3600000), minutes = Math.floor((left % 3600000) / 60000);
      return interaction.reply({ content: `Günlük ödülünü zaten aldın. **${hours} saat ${minutes} dakika** sonra tekrar gel.`, ephemeral: true });
    }
    const reward = 250;
    account.cash = (account.cash || 0) + reward;
    account.lastDaily = now;
    db[key] = account; store.write("economy.json", db);
    await interaction.reply(`🌷 Günlük ödülün: **${reward}** 🪙`);
  }
};
