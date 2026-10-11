const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("kullanici-bilgi").setDescription("Kullanıcı bilgilerini gösterir.")
    .addUserOption(o => o.setName("kullanici").setDescription("Bilgisi gösterilecek kişi").setRequired(false)),
  async execute(interaction, client, config) {
    const user = interaction.options.getUser("kullanici") || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle(`${config.prefix} Kullanıcı Bilgisi`)
      .setThumbnail(user.displayAvatarURL({ size: 1024 }))
      .addFields(
        { name: "Kullanıcı", value: user.tag, inline: true },
        { name: "ID", value: user.id, inline: true },
        { name: "Hesap tarihi", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>` },
        { name: "Sunucuya katılım", value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "Bulunamadı" }
      ).setFooter({ text: config.footer });
    await interaction.reply({ embeds: [embed] });
  }
};
