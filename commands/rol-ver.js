const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("rol-ver").setDescription("Üyeye rol verir.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName("kullanici").setDescription("Üye").setRequired(true))
    .addRoleOption(o => o.setName("rol").setDescription("Verilecek rol").setRequired(true)),
  async execute(interaction) {
    const user = interaction.options.getUser("kullanici"), role = interaction.options.getRole("rol");
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: "Üye bulunamadı.", ephemeral: true });
    const botMember = interaction.guild.members.me;
    if (role.managed || role.position >= botMember.roles.highest.position) return interaction.reply({ content: "Bu rolü bot veremez; rol sırasını kontrol et.", ephemeral: true });
    if (interaction.guild.ownerId !== interaction.user.id && interaction.member.roles.highest.comparePositionTo(role) <= 0) return interaction.reply({ content: "Kendi rolüne eşit veya üstündeki rolü yönetemezsin.", ephemeral: true });
    await member.roles.add(role, `Rol veren: ${interaction.user.tag}`);
    await interaction.reply(`🌷 ${user} kullanıcısına **${role.name}** rolü verildi.`);
  }
};
