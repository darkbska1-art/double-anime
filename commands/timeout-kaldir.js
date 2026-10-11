const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("timeout-kaldir").setDescription("Üyenin timeout'unu kaldırır.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName("kullanici").setDescription("Üye").setRequired(true)),
  async execute(interaction) {
    const user = interaction.options.getUser("kullanici");
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: "Üye bulunamadı.", ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: "Bu üyenin timeout'unu kaldıramıyorum.", ephemeral: true });
    await member.timeout(null, `Timeout kaldıran: ${interaction.user.tag}`);
    await interaction.reply(`🔊 ${user.tag} kullanıcısının timeout'u kaldırıldı.`);
  }
};
