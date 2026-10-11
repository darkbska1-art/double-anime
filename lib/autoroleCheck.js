const { PermissionFlagsBits } = require("discord.js");

const DANGEROUS_PERMS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
];

// Hata varsa metin, sorun yoksa null döner
async function validateAutorole(interaction, role) {
  const me = await interaction.guild.members.fetchMe();

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles))
    return "Bende **Rolleri Yönet** yetkisi yok, önce onu vermelisin.";
  if (role.id === interaction.guildId)
    return "`@everyone` rolü otorol olarak ayarlanamaz.";
  if (role.managed)
    return `**${role.name}** bir bot/entegrasyon rolü, üyelere verilemez.`;
  if (role.position >= me.roles.highest.position)
    return `**${role.name}** rolünü veremem. Bot rolünü bu rolün üstüne taşı.`;

  const isOwner = interaction.guild.ownerId === interaction.user.id;
  if (!isOwner && role.position >= interaction.member.roles.highest.position)
    return `**${role.name}** senin en yüksek rolünden yüksek, bunu ayarlayamazsın.`;

  if (role.permissions.any(DANGEROUS_PERMS))
    return `**${role.name}** tehlikeli yetkiler içeriyor (yönetici, ban, rol yönetimi vb.). Daha güvenli bir rol seç.`;

  return null;
}

module.exports = { validateAutorole, DANGEROUS_PERMS };