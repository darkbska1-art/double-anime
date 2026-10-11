const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  InteractionContextType,
} = require("discord.js");
const t = require("../lib/ticket");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-ayarla")
    .setDescription("Ticket sistemini kurar/ayarlar. Seçenek vermezsen mevcut ayarları gösterir.")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o.setName("kanal").setDescription("Ticket panelinin gönderileceği kanal")
        .addChannelTypes(ChannelType.GuildText)
    )
    .addChannelOption((o) =>
      o.setName("kategori").setDescription("Ticket kanallarının açılacağı kategori")
        .addChannelTypes(ChannelType.GuildCategory)
    )
    .addRoleOption((o) => o.setName("destek-ekibi").setDescription("Ticket'lara bakacak destek ekibi rolü"))
    .addRoleOption((o) => o.setName("destek-ekibi-2").setDescription("İkinci destek ekibi rolü"))
    .addRoleOption((o) => o.setName("destek-ekibi-3").setDescription("Üçüncü destek ekibi rolü"))
    .addChannelOption((o) =>
      o.setName("log").setDescription("Log ve transcript kanalı")
        .addChannelTypes(ChannelType.GuildText)
    )
    .addBooleanOption((o) => o.setName("log-kapat").setDescription("Log kanalını kaldır"))
    .addChannelOption((o) =>
      o.setName("arsiv").setDescription("Kapatılan ticket'ların taşınacağı kategori")
        .addChannelTypes(ChannelType.GuildCategory)
    )
    .addBooleanOption((o) => o.setName("arsiv-kapat").setDescription("Arşiv kategorisini kaldır"))
    .addStringOption((o) => o.setName("baslik").setDescription("Panel başlığı").setMaxLength(100))
    .addStringOption((o) => o.setName("aciklama").setDescription("Panel açıklaması").setMaxLength(1000))
    .addStringOption((o) => o.setName("renk").setDescription("Embed rengi (hex). Örnek: #5865F2").setMaxLength(7))
    .addStringOption((o) =>
      o.setName("karsilama").setDescription("Ticket açılınca gösterilecek karşılama mesajı").setMaxLength(500)
    )
    .addIntegerOption((o) =>
      o.setName("limit").setDescription("Kişi başı en fazla açık ticket").setMinValue(1).setMaxValue(5)
    )
    .addBooleanOption((o) =>
      o.setName("sahip-kapatabilir").setDescription("Ticket sahibi kendi ticket'ını kapatabilsin mi?")
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: "Bu komut için **Sunucuyu Yönet** yetkisi gerekir.",
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const o = interaction.options;
    const guild = interaction.guild;
    const prev = t.getRawConfig(guild.id) ?? {};
    const prevRoles = t.getConfig(guild.id)?.supportRoleIds ?? [];
    const patch = {};

    // Kategori / arşiv / log
    const kategori = o.getChannel("kategori");
    if (kategori) patch.categoryId = kategori.id;

    const arsiv = o.getChannel("arsiv");
    if (arsiv) patch.archiveCategoryId = arsiv.id;
    if (o.getBoolean("arsiv-kapat")) patch.archiveCategoryId = null;

    const log = o.getChannel("log");
    if (log) patch.logChannelId = log.id;
    if (o.getBoolean("log-kapat")) patch.logChannelId = null;

    // Destek ekibi (verilen roller mevcut listenin yerine geçer)
    const roles = ["destek-ekibi", "destek-ekibi-2", "destek-ekibi-3"]
      .map((n) => o.getRole(n))
      .filter(Boolean);
    if (roles.length) {
      if (roles.some((r) => r.id === guild.id)) {
        return interaction.editReply("`@everyone` destek ekibi olarak seçilemez.");
      }
      patch.supportRoleIds = [...new Set(roles.map((r) => r.id))];
    }

    // Görünüm
    const baslik = o.getString("baslik");
    if (baslik) patch.panelTitle = baslik;
    const aciklama = o.getString("aciklama");
    if (aciklama) patch.panelDescription = aciklama;
    const karsilama = o.getString("karsilama");
    if (karsilama) patch.welcomeMessage = karsilama;

    const renk = o.getString("renk");
    if (renk) {
      const c = t.normalizeColor(renk);
      if (!c) return interaction.editReply("Geçersiz renk. Örnek: `#5865F2`");
      patch.color = c;
    }

    // Davranış
    const limit = o.getInteger("limit");
    if (limit !== null) patch.maxOpen = limit;
    const sahip = o.getBoolean("sahip-kapatabilir");
    if (sahip !== null) patch.ownerCanClose = sahip;

    const kanal = o.getChannel("kanal");
    const changed = Object.keys(patch).length > 0;

    // Bot yetkisi (kategori seçildiyse)
    if (kategori || arsiv) {
      const me = await guild.members.fetchMe();
      if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply("Bende **Kanalları Yönet** yetkisi yok, önce onu vermelisin.");
      }
    }

    // İlk kurulumda kategori ve destek ekibi şart
    const merged = { ...prev, ...patch };
    const hasRoles = merged.supportRoleIds?.length || merged.supportRoleId;
    if ((changed || kanal) && (!merged.categoryId || !hasRoles)) {
      return interaction.editReply(
        "İlk kurulumda en az `kategori` ve `destek-ekibi` seçmelisin."
      );
    }

    if (changed) t.setConfig(guild.id, patch);

    // Destek ekibi değiştiyse açık ticket'lara yansıt
    if (patch.supportRoleIds) {
      const added = patch.supportRoleIds.filter((id) => !prevRoles.includes(id));
      const removed = prevRoles.filter((id) => !patch.supportRoleIds.includes(id));
      for (const id of added) await t.syncStaffRole(guild, id, true);
      for (const id of removed) await t.syncStaffRole(guild, id, false);
    }

    // Panel: yeni kanala gönder ya da mevcut paneli güncelle
    const notes = [];
    const panelChanged = patch.panelTitle || patch.panelDescription || patch.color;
    if (kanal) {
      try {
        await t.sendPanel(guild, kanal);
        notes.push(`📨 Panel ${kanal} kanalına gönderildi.`);
      } catch (err) {
        console.error("[TICKET] Panel gönderilemedi:", err);
        notes.push(`⚠️ Panel ${kanal} kanalına gönderilemedi. Botun o kanalda yetkisi var mı?`);
      }
    } else if (panelChanged) {
      const ok = await t.refreshPanel(guild, t.getConfig(guild.id));
      notes.push(
        ok
          ? "🔄 Mevcut panel güncellendi."
          : "ℹ️ Güncellenecek bir panel bulunamadı. `kanal` seçerek paneli gönder."
      );
    }

    // Mevcut ayarları göster
    const cfg = t.getConfig(guild.id);
    if (!cfg) {
      return interaction.editReply(
        "Ticket sistemi henüz kurulmamış. Başlamak için `kategori`, `destek-ekibi` ve `kanal` seçenekleriyle bu komutu kullan."
      );
    }

    const embed = new EmbedBuilder()
      .setColor(t.colorOf(cfg))
      .setTitle("🎫 Ticket Ayarları")
      .addFields(
        { name: "Panel kanalı", value: cfg.panelChannelId ? `<#${cfg.panelChannelId}>` : "Gönderilmedi", inline: true },
        { name: "Kategori", value: `<#${cfg.categoryId}>`, inline: true },
        { name: "Arşiv kategorisi", value: cfg.archiveCategoryId ? `<#${cfg.archiveCategoryId}>` : "Yok", inline: true },
        { name: "Log kanalı", value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "Kapalı", inline: true },
        { name: "Destek ekibi", value: cfg.supportRoleIds.map((id) => `<@&${id}>`).join(" "), inline: true },
        { name: "Renk", value: cfg.color ? `#${cfg.color}` : "Varsayılan", inline: true },
        { name: "Kişi başı limit", value: String(cfg.maxOpen ?? 1), inline: true },
        { name: "Sahip kapatabilir", value: cfg.ownerCanClose === false ? "Hayır" : "Evet", inline: true },
        { name: "Toplam açılan", value: String(cfg.counter ?? 0), inline: true },
        { name: "Panel başlığı", value: cfg.panelTitle || "_Varsayılan_" },
        { name: "Panel açıklaması", value: (cfg.panelDescription || "_Varsayılan_").slice(0, 1000) },
        { name: "Karşılama mesajı", value: cfg.welcomeMessage || "_Varsayılan_" }
      );

    const header = changed || kanal ? "✅ Ayarlar kaydedildi." : undefined;
    const content = [header, ...notes].filter(Boolean).join("\n") || undefined;
    await interaction.editReply({ content, embeds: [embed] });
  },
};