const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Bot bağlantısını kontrol eder."),
  async execute(interaction, client, config) {
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle(`${config.prefix} DOUBLE.ANIME`)
      .setDescription("Bot bağlantısı aktif! ♡")
      .addFields({ name: "Gecikme", value: `${client.ws.ping} ms`, inline: true })
      .setFooter({ text: config.footer }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
