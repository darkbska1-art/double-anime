const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  InteractionContextType,
  EmbedBuilder,
} = require("discord.js");
const { validateAutorole } = require("../utils/autoroleCheck");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("otorol")
    .setDescription("Otomatik rol sistemi.")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("ayarla")
        .setDescription("Yeni üyelere ve botlara otomatik verilecek rolleri ayarlar.")
        .addRoleOption((o) =>
          o.setName("uye").setDescription("Yeni üyelere verilecek rol")
        )
        .addRoleOption((o) =>
          o.setName("bot").setDescription("Sunucuya eklenen botlara verilecek rol")
        )
    )
    .addSubcommand((s) =>
      s
        .setName("kapat")
        .setDescription("Otomatik rol ayarını kapatır.")
        .addStringOption((o) =>
          o
            .setName("tur")
            .setDescription("Hangi otorol kapatılsın? (varsayılan: hepsi)")
            .addChoices(
              { name: "Üye", value: "uye" },
              { name: "Bot", value: "bot" },
              { name: "Hepsi", value: "hepsi" }
            )
        )
    )
    .addSubcommand((s) =>
      s.setName("durum").setDescription("Mevcut otorol ayarlarını gösterir.")
    ),

  async execute(interaction, client, config, store) {
    const sub = interaction.options.getSubcommand();
    const reply = (content) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });

    if (sub === "ayarla") return ayarla(interaction, store, reply);
    if (sub === "kapat") return kapat(interaction, store, reply);
    if (sub === "durum") return durum(interaction, store);
  },
};

async function ayarla(interaction, store, reply) {
  const memberRole = interaction.options.getRole("uye");
  const botRole = interaction.options.getRole("bot");

  if (!memberRole && !botRole) {
    return reply("En az bir rol seçmelisin: `uye` ve/veya `bot`.");
  }

  for (const role of [memberRole, botRole].filter(Boolean)) {
    const error = await validateAutorole(interaction, role);
    if (error) return reply(error);
  }

  try {
    const settings = store.read("settings.json", {});
    settings[interaction.guildId] ||= {};
    if (memberRole) settings[interaction.guildId].autoroleId = memberRole.id;
    if (botRole) settings[interaction.guildId].botAutoroleId = botRole.id;
    store.write("settings.json", settings);
  } catch (err) {
    console.error("otorol ayarla hatası:", err);
    return reply("Ayar kaydedilirken bir hata oluştu, lütfen tekrar dene.");
  }

  const lines = [];
  if (memberRole) lines.push(`👤 Üye otorolü: ${memberRole}`);
  if (botRole) lines.push(`🤖 Bot otorolü: ${botRole}`);
  await reply(`🌷 Otorol ayarlandı\n${lines.join("\n")}`);
}

async function kapat(interaction, store, reply) {
  const tur = interaction.options.getString("tur") ?? "hepsi";

  try {
    const settings = store.read("settings.json", {});
    const guildSettings = settings[interaction.guildId];

    const hasMember = Boolean(guildSettings?.autoroleId);
    const hasBot = Boolean(guildSettings?.botAutoroleId);

    if (
      (tur === "uye" && !hasMember) ||
      (tur === "bot" && !hasBot) ||
      (tur === "hepsi" && !hasMember && !hasBot)
    ) {
      return reply("Kapatılacak aktif bir otorol ayarı yok.");
    }

    if (tur === "uye" || tur === "hepsi") delete guildSettings.autoroleId;
    if (tur === "bot" || tur === "hepsi") delete guildSettings.botAutoroleId;

    store.write("settings.json", settings);
  } catch (err) {
    console.error("otorol kapat hatası:", err);
    return reply("Ayar kaydedilirken bir hata oluştu, lütfen tekrar dene.");
  }

  const label = { uye: "Üye otorolü", bot: "Bot otorolü", hepsi: "Tüm otorollar" }[tur];
  await reply(`🍂 ${label} kapatıldı.`);
}

async function durum(interaction, store) {
  const { guild } = interaction;
  const me = await guild.members.fetchMe();
  const guildSettings = store.read("settings.json", {})[guild.id] ?? {};

  const canManageRoles = me.permissions.has(PermissionFlagsBits.ManageRoles);

  const describe = (roleId) => {
    if (!roleId) return "Kapalı";

    const role = guild.roles.cache.get(roleId);
    if (!role) return "⚠️ Rol silinmiş, yeniden ayarla.";
    if (!canManageRoles) return `${role}\n⚠️ Botta **Rolleri Yönet** yetkisi yok.`;
    if (role.managed || role.position >= me.roles.highest.position) {
      return `${role}\n⚠️ Bot rolü bu rolün altında, verilemiyor.`;
    }
    return `${role} ✅`;
  };

  const embed = new EmbedBuilder()
    .setTitle("🌷 Otorol Durumu")
    .addFields(
      { name: "👤 Üye rolü", value: describe(guildSettings.autoroleId), inline: true },
      { name: "🤖 Bot rolü", value: describe(guildSettings.botAutoroleId), inline: true }
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}