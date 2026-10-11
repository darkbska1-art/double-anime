const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("bakiye").setDescription("Sunucu ekonomisindeki bakiyeni gösterir.")
    .addUserOption(o => o.setName("kullanici").setDescription("Bakiyesi gösterilecek kullanıcı").setRequired(false)),
  async execute(interaction, client, config, store) {
    const user = interaction.options.getUser("kullanici") || interaction.user;
    const db = store.read("economy.json", {});
    const key = `${interaction.guildId}:${user.id}`;
    const account = db[key] || { cash: 0, bank: 0 };
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle(`${config.prefix} ${user.username} • Bakiye`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "Cüzdan", value: `🪙 ${account.cash}`, inline: true },
        { name: "Banka", value: `🏦 ${account.bank}`, inline: true }
      ).setFooter({ text: config.footer });
    await interaction.reply({ embeds: [embed] });
  }
};
