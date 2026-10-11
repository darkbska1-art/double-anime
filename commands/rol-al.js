const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("rol-al").setDescription("Üyeden rol alır.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName("kullanici").setDescription("Üye").setRequired(true))
    .addRoleOption(o => o.setName("rol").setDescription("Alınacak rol").setRequired(true)),
  async execute(interaction) {
    const user = interaction.options.getUser("kullanici"), role = interaction.options.getRole("rol");
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: "Üye bulunamadı.", ephemeral: true });
    if (role.managed || role.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: "Bu rolü bot alamaz; rol sırasını kontrol et.", ephemeral: true });
    if (interaction.guild.ownerId !== interaction.user.id && interaction.member.roles.highest.comparePositionTo(role) <= 0) return interaction.reply({ content: "Kendi rolüne eşit veya üstündeki rolü yönetemezsin.", ephemeral: true });
    await member.roles.remove(role, `Rol alan: ${interaction.user.tag}`);
    await interaction.reply(`🌷 ${user} kullanıcısından **${role.name}** rolü alındı.`);
  }
};
