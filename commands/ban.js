const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("ban").setDescription("Kullanıcıyı sunucudan yasaklar.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName("kullanici").setDescription("Yasaklanacak kullanıcı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Sebep").setMaxLength(500).setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("kullanici");
    const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi.";
    if (user.id === interaction.user.id || user.id === interaction.guild.ownerId) return interaction.reply({ content: "Bu kullanıcıya işlem yapamazsın.", ephemeral: true });
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member && interaction.guild.ownerId !== interaction.user.id && interaction.member.roles.highest.comparePositionTo(member.roles.highest) <= 0)
      return interaction.reply({ content: "Rolü sana eşit veya yüksek üyeyi yasaklayamazsın.", ephemeral: true });
    if (member && !member.bannable) return interaction.reply({ content: "Botun rol sırasını ve Ban Members iznini kontrol et.", ephemeral: true });
    await interaction.guild.members.ban(user.id, { reason: `${reason} | Yetkili: ${interaction.user.tag}` });
    await interaction.reply(`🔨 **${user.tag}** yasaklandı. Sebep: ${reason}`);
  }
};
