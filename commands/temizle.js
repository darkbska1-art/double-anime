const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("temizle").setDescription("1-100 mesaj siler.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName("miktar").setDescription("Silinecek mesaj sayısı").setMinValue(1).setMaxValue(100).setRequired(true)),
  async execute(interaction) {
    if (!interaction.channel?.isTextBased() || !interaction.channel.messages) return interaction.reply({ content: "Bu kanalda kullanılamaz.", ephemeral: true });
    const deleted = await interaction.channel.bulkDelete(interaction.options.getInteger("miktar"), true);
    await interaction.reply({ content: `${deleted.size} mesaj silindi. (14 günden eski mesajlar toplu silinemez.)`, ephemeral: true });
  }
};
