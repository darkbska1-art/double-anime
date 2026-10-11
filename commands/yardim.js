const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("yardim").setDescription("Slash komutlarını listeler."),
  async execute(interaction, client, config) {
    const lines = [...client.commands.values()].map(c => `\`/${c.data.name}\` — ${c.data.description}`);
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle(`${config.prefix} Komut Merkezi`).setDescription(lines.join("\n") || "Komut yok.")
      .setFooter({ text: config.footer }).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
