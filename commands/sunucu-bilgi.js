const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("sunucu-bilgi").setDescription("Sunucu bilgilerini gösterir."),
  async execute(interaction, client, config) {
    const g = interaction.guild;
    const owner = await g.fetchOwner();
    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle(`${config.prefix} ${g.name}`)
      .setThumbnail(g.iconURL({ size: 1024 }))
      .addFields(
        { name: "Sahip", value: owner.user.tag, inline: true },
        { name: "Üye", value: String(g.memberCount), inline: true },
        { name: "Kanal", value: String(g.channels.cache.size), inline: true },
        { name: "Kuruluş", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>` }
      ).setFooter({ text: config.footer });
    await interaction.reply({ embeds: [embed] });
  }
};
