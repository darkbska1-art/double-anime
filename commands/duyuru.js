const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("duyuru").setDescription("Bir kanala embed duyuru gönderir.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName("kanal").setDescription("Hedef kanal").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addStringOption(o => o.setName("baslik").setDescription("Başlık").setMaxLength(200).setRequired(true))
    .addStringOption(o => o.setName("mesaj").setDescription("Mesaj").setMaxLength(4000).setRequired(true)),
  async execute(interaction, client, config) {
    const channel = interaction.options.getChannel("kanal");
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle(`${config.prefix} ${interaction.options.getString("baslik")}`)
      .setDescription(interaction.options.getString("mesaj"))
      .setFooter({ text: `${config.footer} • ${interaction.user.tag}` }).setTimestamp();
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `Duyuru ${channel} kanalına gönderildi.`, ephemeral: true });
  }
};
