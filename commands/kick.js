const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("kick").setDescription("Üyeyi sunucudan atar.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName("kullanici").setDescription("Atılacak üye").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Sebep").setMaxLength(500).setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("kullanici");
    const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi.";
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: "Üye sunucuda bulunamadı.", ephemeral: true });
    if (user.id === interaction.user.id || user.id === interaction.guild.ownerId) return interaction.reply({ content: "Bu üyeye işlem yapamazsın.", ephemeral: true });
    if (interaction.guild.ownerId !== interaction.user.id && interaction.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) return interaction.reply({ content: "Rolü sana eşit veya yüksek üyeyi atamazsın.", ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: "Botun rol sırasını ve Kick Members iznini kontrol et.", ephemeral: true });
    await member.kick(reason);
    await interaction.reply(`👢 **${user.tag}** sunucudan atıldı. Sebep: ${reason}`);
  }
};
