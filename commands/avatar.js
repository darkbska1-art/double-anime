const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("avatar").setDescription("Kullanıcı avatarını gösterir.")
    .addUserOption(o => o.setName("kullanici").setDescription("Avatarı gösterilecek kişi").setRequired(false)),
  async execute(interaction, client, config) {
    const user = interaction.options.getUser("kullanici") || interaction.user;
    const url = user.displayAvatarURL({ size: 1024, extension: "png" });
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle(`${config.prefix} ${user.username} • Avatar`).setImage(url).setURL(url)
      .setFooter({ text: config.footer });
    await interaction.reply({ embeds: [embed] });
  }
};
