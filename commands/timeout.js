const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("timeout").setDescription("Üyeye iletişim kısıtlaması uygular.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName("kullanici").setDescription("Üye").setRequired(true))
    .addIntegerOption(o => o.setName("dakika").setDescription("1-40320 dakika").setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Sebep").setMaxLength(500).setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("kullanici"), minutes = interaction.options.getInteger("dakika");
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: "Üye bulunamadı.", ephemeral: true });
    if (user.id === interaction.user.id || user.id === interaction.guild.ownerId) return interaction.reply({ content: "Bu üyeye işlem yapamazsın.", ephemeral: true });
    if (interaction.guild.ownerId !== interaction.user.id && interaction.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) return interaction.reply({ content: "Rolü sana eşit veya yüksek üyeye işlem yapamazsın.", ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: "Botun rol sırasını ve Moderate Members iznini kontrol et.", ephemeral: true });
    await member.timeout(minutes * 60000, interaction.options.getString("sebep") || `Yetkili: ${interaction.user.tag}`);
    await interaction.reply(`🔇 ${user.tag} kullanıcısına ${minutes} dakika timeout uygulandı.`);
  }
};
