const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const store = require("./store");

const TYPES = {
  destek: { label: "Destek", emoji: "🛠️", color: 0x5865f2, style: ButtonStyle.Primary },
  sikayet: { label: "Şikayet", emoji: "🚨", color: 0xed4245, style: ButtonStyle.Danger },
  oneri: { label: "Öneri", emoji: "💡", color: 0xfee75c, style: ButtonStyle.Secondary },
  diger: { label: "Diğer", emoji: "📩", color: 0x99aab5, style: ButtonStyle.Secondary },
};

const PRIORITIES = {
  dusuk: { label: "Düşük", emoji: "🟢" },
  normal: { label: "Normal", emoji: "🟡" },
  yuksek: { label: "Yüksek", emoji: "🟠" },
  acil: { label: "Acil", emoji: "🔴" },
};

const BASE_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];
const BASE_ALLOW = {
  ViewChannel: true,
  SendMessages: true,
  ReadMessageHistory: true,
  AttachFiles: true,
  EmbedLinks: true,
};

const MAX_EXTRA_USERS = 20;
const pad = (n) => String(n).padStart(4, "0");

/* ========================= Ayarlar ========================= */

const getRawConfig = (guildId) => store.read("settings.json", {})[guildId]?.ticket ?? null;

function getConfig(guildId) {
  const raw = getRawConfig(guildId);
  if (!raw?.categoryId) return null;
  // Eski sürümdeki tek rol (supportRoleId) ayarını da destekle
  const roles = raw.supportRoleIds?.length
    ? raw.supportRoleIds
    : raw.supportRoleId
    ? [raw.supportRoleId]
    : [];
  if (!roles.length) return null;
  return { ...raw, supportRoleIds: roles };
}

function setConfig(guildId, patch) {
  const settings = store.read("settings.json", {});
  settings[guildId] ||= {};
  settings[guildId].ticket = { ...(settings[guildId].ticket ?? {}), ...patch };
  store.write("settings.json", settings);
}

function nextNumber(guildId) {
  const settings = store.read("settings.json", {});
  settings[guildId] ||= {};
  settings[guildId].ticket ||= {};
  const n = (settings[guildId].ticket.counter ?? 0) + 1;
  settings[guildId].ticket.counter = n;
  store.write("settings.json", settings);
  return n;
}

function normalizeColor(input) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(input).trim());
  return m ? m[1].toUpperCase() : null;
}

const colorOf = (cfg, fallback = 0x5865f2) => (cfg?.color ? parseInt(cfg.color, 16) : fallback);

/* ========================= Ticket kayıtları ========================= */

const getTickets = () => store.read("tickets.json", {});
const getTicket = (channelId) => getTickets()[channelId] ?? null;

function saveTicket(ticket) {
  const all = getTickets();
  all[ticket.channelId] = ticket;
  store.write("tickets.json", all);
}

function deleteTicket(channelId) {
  const all = getTickets();
  delete all[channelId];
  store.write("tickets.json", all);
}

// Kullanıcının AÇIK ticket'ları (kapalılar sayılmaz, elle silinmiş kanallar temizlenir)
function openTicketsOf(guild, userId) {
  const all = getTickets();
  let changed = false;
  const mine = [];
  for (const t of Object.values(all)) {
    if (t.guildId !== guild.id) continue;
    if (!guild.channels.cache.has(t.channelId)) {
      delete all[t.channelId];
      changed = true;
      continue;
    }
    if (t.ownerId === userId && t.status !== "closed") mine.push(t);
  }
  if (changed) store.write("tickets.json", all);
  return mine;
}

function canManage(member, cfg) {
  return (
    cfg.supportRoleIds.some((id) => member.roles.cache.has(id)) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

// Destek ekibi rolü eklenince/çıkarılınca mevcut ticket kanallarını güncelle
async function syncStaffRole(guild, roleId, add) {
  for (const t of Object.values(getTickets())) {
    if (t.guildId !== guild.id) continue;
    const ch = guild.channels.cache.get(t.channelId);
    if (!ch) continue;
    if (add) await ch.permissionOverwrites.edit(roleId, BASE_ALLOW).catch(() => {});
    else await ch.permissionOverwrites.delete(roleId).catch(() => {});
  }
}

const involvedUsers = (ticket) => new Set([ticket.ownerId, ...(ticket.members ?? [])]);

/* ========================= Panel ========================= */

function panelMessage(cfg) {
  const embed = new EmbedBuilder()
    .setColor(colorOf(cfg))
    .setTitle(cfg?.panelTitle || "🎫 Destek Merkezi")
    .setDescription(
      cfg?.panelDescription ||
        "Yardıma mı ihtiyacın var? Aşağıdan konuna uygun butonu seç, açılan formu doldur. " +
          "Sana özel bir kanal oluşturulacak ve destek ekibi orada ilgilenecek."
    )
    .setFooter({ text: "Bir kategori seçerek ticket aç" });

  const row = new ActionRowBuilder().addComponents(
    Object.entries(TYPES).map(([key, t]) =>
      new ButtonBuilder()
        .setCustomId(`ticket:open:${key}`)
        .setLabel(t.label)
        .setEmoji(t.emoji)
        .setStyle(t.style)
    )
  );
  return { embeds: [embed], components: [row] };
}

// Paneli yeni kanala gönderir, eski paneli siler
async function sendPanel(guild, channel) {
  const cfg = getConfig(guild.id);
  const old = getRawConfig(guild.id);

  const msg = await channel.send(panelMessage(cfg));

  if (old?.panelChannelId && old?.panelMessageId) {
    const oldCh = guild.channels.cache.get(old.panelChannelId);
    const oldMsg = await oldCh?.messages.fetch(old.panelMessageId).catch(() => null);
    await oldMsg?.delete().catch(() => {});
  }

  setConfig(guild.id, { panelChannelId: channel.id, panelMessageId: msg.id });
  return msg;
}

// Var olan paneli yeni ayarlara göre günceller
async function refreshPanel(guild, cfg) {
  if (!cfg?.panelChannelId || !cfg?.panelMessageId) return false;
  const ch = await guild.channels.fetch(cfg.panelChannelId).catch(() => null);
  const msg = await ch?.messages.fetch(cfg.panelMessageId).catch(() => null);
  if (!msg) return false;
  await msg.edit(panelMessage(cfg)).catch(() => {});
  return true;
}

/* ========================= Ticket arayüzü ========================= */

function ticketEmbed(ticket, cfg) {
  const type = TYPES[ticket.type] ?? TYPES.diger;
  const pr = PRIORITIES[ticket.priority] ?? PRIORITIES.normal;
  const closed = ticket.status === "closed";
  const members = ticket.members ?? [];
  const welcome =
    cfg?.welcomeMessage ||
    "Destek ekibimiz en kısa sürede seninle ilgilenecek. Lütfen sabırlı ol.";

  return new EmbedBuilder()
    .setColor(closed ? 0x4f545c : colorOf(cfg, type.color))
    .setTitle(`${closed ? "🔒" : type.emoji} ${type.label} • #${pad(ticket.number)}`)
    .setDescription(`**Konu:** ${ticket.subject}\n\n${ticket.details}`)
    .addFields(
      { name: "👤 Açan", value: `<@${ticket.ownerId}>`, inline: true },
      { name: "🛡️ Yetkili", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Bekleniyor", inline: true },
      { name: "📊 Öncelik", value: `${pr.emoji} ${pr.label}`, inline: true },
      { name: "📌 Durum", value: closed ? "🔒 Kapalı" : "🟢 Açık", inline: true },
      { name: "👥 Eklenenler", value: members.length ? members.map((id) => `<@${id}>`).join(" ") : "Yok", inline: true },
      { name: "ℹ️ Bilgi", value: welcome }
    )
    .setFooter({ text: closed ? "Bu ticket kapatıldı." : "Ticket'ı aşağıdaki butonlarla yönetebilirsin." })
    .setTimestamp(ticket.createdAt);
}

function ticketComponents(ticket) {
  const closed = ticket.status === "closed";
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:claim")
      .setLabel(ticket.claimedBy ? "Sahiplenildi" : "Sahiplen")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Success)
      .setDisabled(closed || Boolean(ticket.claimedBy)),
    new ButtonBuilder()
      .setCustomId("ticket:adduser")
      .setLabel("Kişi Ekle")
      .setEmoji("➕")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(closed),
    new ButtonBuilder()
      .setCustomId("ticket:removeuser")
      .setLabel("Kişi Çıkar")
      .setEmoji("➖")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(closed),
    new ButtonBuilder()
      .setCustomId("ticket:transcript")
      .setLabel("Transcript")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(closed),
    new ButtonBuilder()
      .setCustomId("ticket:close")
      .setLabel("Kapat")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(closed)
  );

  const priority = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket:priority")
      .setPlaceholder("📊 Öncelik seviyesi (yetkili ekip)")
      .setDisabled(closed)
      .addOptions(
        Object.entries(PRIORITIES).map(([value, p]) => ({
          label: p.label,
          value,
          emoji: { name: p.emoji },
          default: value === (ticket.priority ?? "normal"),
        }))
      )
  );

  return [buttons, priority];
}

// Kapalı ticket'ta yalnızca yetkili ekibin kullanabildiği butonlar
function closedControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:transcript")
      .setLabel("Transcript")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket:reopen")
      .setLabel("Yeniden Aç")
      .setEmoji("🔓")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket:delete")
      .setLabel("Sil")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );
}

function closeModal() {
  return new ModalBuilder()
    .setCustomId("ticket:closeconfirm")
    .setTitle("Ticket'ı Kapat")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Kapatma sebebi (isteğe bağlı)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(200)
          .setRequired(false)
      )
    );
}

async function refreshTicketMessage(channel, ticket) {
  const cfg = getConfig(channel.guild.id);
  const msg = await channel.messages.fetch(ticket.messageId).catch(() => null);
  if (msg) {
    await msg
      .edit({ embeds: [ticketEmbed(ticket, cfg)], components: ticketComponents(ticket) })
      .catch(() => {});
  }
}

/* ========================= Transcript ========================= */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function fetchAll(channel, limit = 1000) {
  const all = [];
  let before;
  while (all.length < limit) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
  }
  return all.reverse();
}

function buildTranscript(channel, ticket, messages, actor, reason) {
  const rows = messages
    .map((m) => {
      const time = new Date(m.createdTimestamp).toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
      });
      const files = [...m.attachments.values()]
        .map((a) => `<a href="${esc(a.url)}">${esc(a.name)}</a>`)
        .join(" ");
      const embeds = m.embeds.length ? `<em>[${m.embeds.length} embed]</em>` : "";
      return `<div class="msg"><img src="${esc(m.author.displayAvatarURL({ size: 64 }))}"><div><b>${esc(
        m.author.tag
      )}</b> <span>${esc(time)}</span><p>${esc(m.content).replace(/\n/g, "<br>")}</p>${files} ${embeds}</div></div>`;
    })
    .join("\n");

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<title>Ticket #${pad(ticket.number)}</title>
<style>
body{background:#1e1f22;color:#dbdee1;font-family:system-ui,sans-serif;padding:24px;max-width:900px;margin:auto}
h1{font-size:20px} .meta{background:#2b2d31;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:14px;line-height:1.7}
.msg{display:flex;gap:12px;margin:14px 0} .msg img{width:40px;height:40px;border-radius:50%}
.msg span{color:#949ba4;font-size:12px;margin-left:6px} .msg p{margin:4px 0;word-break:break-word}
a{color:#00a8fc}
</style></head><body>
<h1>#${esc(channel.name)} • Ticket #${pad(ticket.number)}</h1>
<div class="meta">
<b>Konu:</b> ${esc(ticket.subject)}<br>
<b>Açan (ID):</b> ${esc(ticket.ownerId)}<br>
<b>İşlemi yapan:</b> ${esc(actor.tag)}<br>
<b>Sebep:</b> ${esc(reason)}<br>
<b>Mesaj sayısı:</b> ${messages.length}
</div>
${rows}
</body></html>`;
}

async function makeTranscript(channel, ticket, actor, reason = "Belirtilmedi") {
  const messages = await fetchAll(channel);
  return {
    count: messages.length,
    buffer: Buffer.from(buildTranscript(channel, ticket, messages, actor, reason), "utf8"),
    name: `ticket-${pad(ticket.number)}.html`,
  };
}

const toFile = (tr) => new AttachmentBuilder(tr.buffer, { name: tr.name });

/* ========================= Log / DM yardımcıları ========================= */

async function sendLog(guild, cfg, payload) {
  if (!cfg?.logChannelId) return;
  const ch = await guild.channels.fetch(cfg.logChannelId).catch(() => null);
  if (ch?.isTextBased()) {
    await ch.send(payload).catch((e) => console.error("[TICKET] Log gönderilemedi:", e));
  }
}

function quickLog(guild, cfg, { title, color, fields = [], files = [] }) {
  return sendLog(guild, cfg, {
    embeds: [new EmbedBuilder().setColor(color).setTitle(title).addFields(fields).setTimestamp()],
    files,
  });
}

async function dmOwner(client, ownerId, payload) {
  const user = await client.users.fetch(ownerId).catch(() => null);
  await user?.send(payload).catch(() => {}); // DM kapalıysa sessizce geç
}

/* ========================= Ticket yaşam döngüsü ========================= */

async function createTicket(interaction, typeKey, subject, details) {
  const { guild, user } = interaction;
  const cfg = getConfig(guild.id);
  if (!cfg) return interaction.editReply("Ticket sistemi kurulu değil.");

  const mine = openTicketsOf(guild, user.id);
  if (mine.length >= (cfg.maxOpen ?? 1)) {
    return interaction.editReply(
      `Zaten açık ticket'ın var: <#${mine[0].channelId}>. Önce onu kapatmalısın.`
    );
  }

  const type = TYPES[typeKey] ?? TYPES.diger;
  const number = nextNumber(guild.id);

  let channel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${pad(number)}`,
      type: ChannelType.GuildText,
      parent: cfg.categoryId,
      topic: `Ticket #${pad(number)} • ${type.label} • Sahip: ${user.tag}`,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: BASE_PERMS },
        ...cfg.supportRoleIds.map((id) => ({ id, allow: BASE_PERMS })),
        { id: guild.members.me.id, allow: [...BASE_PERMS, PermissionFlagsBits.ManageChannels] },
      ],
      reason: `Ticket açıldı: ${user.tag}`,
    });
  } catch (err) {
    console.error("[TICKET] Kanal oluşturulamadı:", err);
    return interaction.editReply(
      "Kanal oluşturulamadı. Botta **Kanalları Yönet** yetkisi var mı ve kategori hâlâ duruyor mu kontrol et."
    );
  }

  const ticket = {
    guildId: guild.id,
    channelId: channel.id,
    messageId: null,
    ownerId: user.id,
    number,
    type: typeKey,
    subject,
    details,
    priority: "normal",
    status: "open",
    claimedBy: null,
    members: [],
    createdAt: Date.now(),
  };

  // Üyeyi ve destek ekibini çağır
  const msg = await channel.send({
    content: `👋 ${user} • 🛡️ ${cfg.supportRoleIds.map((id) => `<@&${id}>`).join(" ")}`,
    embeds: [ticketEmbed(ticket, cfg)],
    components: ticketComponents(ticket),
    allowedMentions: { users: [user.id], roles: cfg.supportRoleIds },
  });
  ticket.messageId = msg.id;
  saveTicket(ticket);

  await quickLog(guild, cfg, {
    title: `📬 Ticket açıldı • #${pad(number)}`,
    color: 0x57f287,
    fields: [
      { name: "Açan", value: `${user} (${user.tag})`, inline: true },
      { name: "Tür", value: `${type.emoji} ${type.label}`, inline: true },
      { name: "Kanal", value: `${channel}`, inline: true },
      { name: "Konu", value: subject },
    ],
  });

  return interaction.editReply(`✅ Ticket'ın açıldı: ${channel}`);
}

// Kapat = arşivle: kanal kalır, sahip erişimini kaybeder, transcript alınır
async function closeTicket(channel, closer, reason = "Belirtilmedi") {
  const ticket = getTicket(channel.id);
  if (!ticket || ticket.status === "closed") return false;
  const guild = channel.guild;
  const cfg = getConfig(guild.id);

  ticket.status = "closed";
  ticket.closedBy = closer.id;
  ticket.closedAt = Date.now();
  ticket.closeReason = reason;
  saveTicket(ticket);

  let tr = null;
  try {
    tr = await makeTranscript(channel, ticket, closer, reason);
  } catch (err) {
    console.error("[TICKET] Transcript oluşturulamadı:", err);
  }

  for (const id of involvedUsers(ticket)) {
    await channel.permissionOverwrites.edit(id, { ViewChannel: false }).catch(() => {});
  }

  await channel
    .edit({
      name: `kapali-${pad(ticket.number)}`,
      parent: cfg?.archiveCategoryId ?? channel.parentId,
      lockPermissions: false,
    })
    .catch(() => {});

  const type = TYPES[ticket.type] ?? TYPES.diger;

  await quickLog(guild, cfg, {
    title: `🔒 Ticket kapatıldı • #${pad(ticket.number)}`,
    color: 0xed4245,
    fields: [
      { name: "Açan", value: `<@${ticket.ownerId}>`, inline: true },
      { name: "Kapatan", value: `${closer}`, inline: true },
      { name: "Yetkili", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Yok", inline: true },
      { name: "Tür", value: `${type.emoji} ${type.label}`, inline: true },
      { name: "Mesaj", value: String(tr?.count ?? "?"), inline: true },
      { name: "Sebep", value: reason.slice(0, 1000) },
    ],
    files: tr ? [toFile(tr)] : [],
  });

  await dmOwner(channel.client, ticket.ownerId, {
    embeds: [
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`🔒 Ticket'ın kapatıldı • #${pad(ticket.number)}`)
        .setDescription(`**Sunucu:** ${guild.name}\n**Sebep:** ${reason.slice(0, 500)}`)
        .setTimestamp(),
    ],
    files: tr ? [toFile(tr)] : [],
  });

  await refreshTicketMessage(channel, ticket);
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🔒 Ticket kapatıldı")
        .setDescription(`**Kapatan:** ${closer}\n**Sebep:** ${reason}`)
        .setFooter({ text: "Aşağıdaki işlemleri yalnızca destek ekibi kullanabilir." })
        .setTimestamp(),
    ],
    components: [closedControls()],
  });
  return true;
}

async function reopenTicket(channel, actor) {
  const ticket = getTicket(channel.id);
  if (!ticket || ticket.status !== "closed") return false;
  const guild = channel.guild;
  const cfg = getConfig(guild.id);

  ticket.status = "open";
  delete ticket.closedBy;
  delete ticket.closedAt;
  delete ticket.closeReason;
  saveTicket(ticket);

  for (const id of involvedUsers(ticket)) {
    await channel.permissionOverwrites.edit(id, BASE_ALLOW).catch(() => {});
  }
  await channel
    .edit({
      name: `ticket-${pad(ticket.number)}`,
      parent: cfg?.categoryId ?? channel.parentId,
      lockPermissions: false,
    })
    .catch(() => {});

  await refreshTicketMessage(channel, ticket);
  await channel.send({
    content: `<@${ticket.ownerId}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("🔓 Ticket yeniden açıldı")
        .setDescription(`**Açan yetkili:** ${actor}`)
        .setTimestamp(),
    ],
    allowedMentions: { users: [ticket.ownerId] },
  });

  await quickLog(guild, cfg, {
    title: `🔓 Ticket yeniden açıldı • #${pad(ticket.number)}`,
    color: 0x57f287,
    fields: [
      { name: "Açan yetkili", value: `${actor}`, inline: true },
      { name: "Ticket sahibi", value: `<@${ticket.ownerId}>`, inline: true },
    ],
  });
  return true;
}

// Kalıcı silme. Ticket hâlâ açıksa silmeden önce transcript alınır.
async function deleteTicketChannel(channel, actor, reason = "Belirtilmedi") {
  const ticket = getTicket(channel.id);
  const guild = channel.guild;
  const cfg = getConfig(guild.id);

  if (ticket) {
    deleteTicket(channel.id);

    let tr = null;
    if (ticket.status !== "closed") {
      try {
        tr = await makeTranscript(channel, ticket, actor, reason);
      } catch (err) {
        console.error("[TICKET] Transcript oluşturulamadı:", err);
      }
      await dmOwner(channel.client, ticket.ownerId, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle(`🗑️ Ticket'ın silindi • #${pad(ticket.number)}`)
            .setDescription(`**Sunucu:** ${guild.name}\n**Sebep:** ${reason.slice(0, 500)}`)
            .setTimestamp(),
        ],
        files: tr ? [toFile(tr)] : [],
      });
    }

    await quickLog(guild, cfg, {
      title: `🗑️ Ticket silindi • #${pad(ticket.number)}`,
      color: 0x992d22,
      fields: [
        { name: "Silen", value: `${actor}`, inline: true },
        { name: "Ticket sahibi", value: `<@${ticket.ownerId}>`, inline: true },
        { name: "Sebep", value: reason.slice(0, 1000) },
      ],
      files: tr ? [toFile(tr)] : [],
    });
  }

  setTimeout(() => {
    channel
      .delete(`Ticket silindi: ${actor.tag}`)
      .catch((e) => console.error("[TICKET] Kanal silinemedi:", e));
  }, 3000);
}

/* ========================= Event yardımcıları ========================= */

// Ticket kanalı elle silinirse kaydı temizle ve logla
async function handleChannelDelete(channel) {
  if (!channel.guild) return;
  const ticket = getTicket(channel.id);
  if (!ticket) return;
  deleteTicket(channel.id);

  await quickLog(channel.guild, getConfig(channel.guild.id), {
    title: `🗑️ Ticket kanalı elle silindi • #${pad(ticket.number)}`,
    color: 0x992d22,
    fields: [{ name: "Ticket sahibi", value: `<@${ticket.ownerId}>`, inline: true }],
  });
}

// Ticket sahibi sunucudan ayrılırsa destek ekibini uyar
async function notifyOwnerLeft(member) {
  const cfg = getConfig(member.guild.id);
  if (!cfg) return;

  for (const t of Object.values(getTickets())) {
    if (t.guildId !== member.guild.id || t.ownerId !== member.id || t.status === "closed") continue;
    const ch = member.guild.channels.cache.get(t.channelId);
    if (!ch) continue;

    await ch
      .send({
        content: cfg.supportRoleIds.map((id) => `<@&${id}>`).join(" "),
        embeds: [
          new EmbedBuilder()
            .setColor(0xfaa61a)
            .setDescription(
              `👋 Ticket sahibi **${member.user?.tag ?? member.id}** sunucudan ayrıldı. Gerekirse ticket'ı kapatabilirsiniz.`
            ),
        ],
        allowedMentions: { roles: cfg.supportRoleIds },
      })
      .catch(() => {});
  }
}

/* ========================= Buton / menü / modal işleyicisi ========================= */

async function handleInteraction(interaction) {
  if (!interaction.customId?.startsWith("ticket:")) return;
  const [, action, arg] = interaction.customId.split(":");
  const ephemeral = (content) =>
    interaction.reply({ content, flags: MessageFlags.Ephemeral });

  /* ---------- Modallar ---------- */
  if (interaction.isModalSubmit()) {
    if (action === "create") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const subject = interaction.fields.getTextInputValue("subject").trim();
      const details = interaction.fields.getTextInputValue("details").trim();
      return createTicket(interaction, arg, subject, details);
    }

    if (action === "closeconfirm") {
      const cfg = getConfig(interaction.guildId);
      const ticket = getTicket(interaction.channelId);
      if (!cfg || !ticket) return ephemeral("Bu ticket sistemde kayıtlı değil.");
      if (ticket.status === "closed") return ephemeral("Bu ticket zaten kapalı.");

      const isStaff = canManage(interaction.member, cfg);
      const ownerOk = ticket.ownerId === interaction.user.id && cfg.ownerCanClose !== false;
      if (!isStaff && !ownerOk) return ephemeral("Bu ticket'ı kapatma yetkin yok.");

      const reason = interaction.fields.getTextInputValue("reason").trim() || "Belirtilmedi";
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await closeTicket(interaction.channel, interaction.user, reason);
      return interaction.editReply("✅ Ticket kapatıldı.");
    }
    return;
  }

  /* ---------- Panelden ticket aç ---------- */
  if (action === "open") {
    const cfg = getConfig(interaction.guildId);
    if (!cfg) return ephemeral("Ticket sistemi kurulu değil.");

    const mine = openTicketsOf(interaction.guild, interaction.user.id);
    if (mine.length >= (cfg.maxOpen ?? 1)) {
      return ephemeral(`Zaten açık ticket'ın var: <#${mine[0].channelId}>`);
    }

    const type = TYPES[arg] ?? TYPES.diger;
    const modal = new ModalBuilder()
      .setCustomId(`ticket:create:${arg}`)
      .setTitle(`${type.label} Ticket`)
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("subject")
            .setLabel("Konu")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(80)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("details")
            .setLabel("Sorununu detaylı anlat")
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(1000)
            .setRequired(true)
        )
      );
    return interaction.showModal(modal);
  }

  /* ---------- Ticket kanalı etkileşimleri ---------- */
  const cfg = getConfig(interaction.guildId);
  const ticket = getTicket(interaction.channelId);
  if (!cfg || !ticket) return ephemeral("Bu ticket sistemde kayıtlı değil.");
  const isStaff = canManage(interaction.member, cfg);
  const closed = ticket.status === "closed";
  const staffOnly = "Bu işlem sadece destek ekibi içindir.";

  switch (action) {
    case "claim": {
      if (!isStaff) return ephemeral(staffOnly);
      if (closed) return ephemeral("Kapalı ticket sahiplenilemez.");
      if (ticket.claimedBy) return ephemeral(`Bu ticket zaten <@${ticket.claimedBy}> tarafından sahiplenilmiş.`);

      ticket.claimedBy = interaction.user.id;
      saveTicket(ticket);
      await interaction.update({
        embeds: [ticketEmbed(ticket, cfg)],
        components: ticketComponents(ticket),
      });
      await interaction.channel.send(`🙋 ${interaction.user} bu ticket ile ilgilenecek.`);
      return quickLog(interaction.guild, cfg, {
        title: `🙋 Ticket sahiplenildi • #${pad(ticket.number)}`,
        color: 0x57f287,
        fields: [{ name: "Yetkili", value: `${interaction.user}`, inline: true }],
      });
    }

    case "priority": {
      if (!isStaff) return ephemeral(staffOnly);
      if (closed) return ephemeral("Kapalı ticket'ın önceliği değiştirilemez.");
      ticket.priority = interaction.values[0];
      saveTicket(ticket);
      return interaction.update({
        embeds: [ticketEmbed(ticket, cfg)],
        components: ticketComponents(ticket),
      });
    }

    case "adduser": {
      if (!isStaff) return ephemeral(staffOnly);
      if (closed) return ephemeral("Önce ticket'ı yeniden aç.");
      if ((ticket.members ?? []).length >= MAX_EXTRA_USERS) {
        return ephemeral(`En fazla ${MAX_EXTRA_USERS} kişi eklenebilir.`);
      }
      return interaction.reply({
        content: "➕ Ticket'a eklemek istediğin kişileri seç:",
        components: [
          new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
              .setCustomId("ticket:adduserselect")
              .setPlaceholder("Kullanıcı seç...")
              .setMinValues(1)
              .setMaxValues(5)
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    case "adduserselect": {
      if (!isStaff) return ephemeral(staffOnly);
      if (closed) return ephemeral("Önce ticket'ı yeniden aç.");

      const current = ticket.members ?? [];
      const added = [];
      for (const user of interaction.users.values()) {
        if (user.bot || user.id === ticket.ownerId || current.includes(user.id)) continue;
        if (current.length + added.length >= MAX_EXTRA_USERS) break;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) continue;
        try {
          await interaction.channel.permissionOverwrites.edit(user.id, BASE_ALLOW);
          added.push(user);
        } catch (err) {
          console.error("[TICKET] Kullanıcı eklenemedi:", err);
        }
      }

      if (!added.length) {
        return interaction.update({
          content: "Eklenecek geçerli kullanıcı bulunamadı (bot, zaten ekli ya da sunucuda değil).",
          components: [],
        });
      }

      ticket.members = [...current, ...added.map((u) => u.id)];
      saveTicket(ticket);

      await interaction.update({ content: `✅ Eklendi: ${added.join(" ")}`, components: [] });
      await interaction.channel.send({
        content: `➕ ${added.join(" ")} ticket'a eklendi. (${interaction.user} tarafından)`,
        allowedMentions: { users: added.map((u) => u.id) },
      });
      await refreshTicketMessage(interaction.channel, ticket);
      return quickLog(interaction.guild, cfg, {
        title: `➕ Ticket'a kişi eklendi • #${pad(ticket.number)}`,
        color: 0x5865f2,
        fields: [
          { name: "Ekleyen", value: `${interaction.user}`, inline: true },
          { name: "Eklenenler", value: added.join(" "), inline: true },
        ],
      });
    }

    case "removeuser": {
      if (!isStaff) return ephemeral(staffOnly);
      if (closed) return ephemeral("Önce ticket'ı yeniden aç.");
      const ids = (ticket.members ?? []).slice(0, 25);
      if (!ids.length) return ephemeral("Ticket'a sonradan eklenmiş kimse yok.");

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const options = await Promise.all(
        ids.map(async (id) => {
          const m = await interaction.guild.members.fetch(id).catch(() => null);
          return { label: (m?.displayName ?? `Bilinmeyen (${id})`).slice(0, 100), value: id };
        })
      );
      return interaction.editReply({
        content: "➖ Ticket'tan çıkarmak istediğin kişileri seç:",
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("ticket:removeselect")
              .setPlaceholder("Kişi seç...")
              .setMinValues(1)
              .setMaxValues(options.length)
              .addOptions(options)
          ),
        ],
      });
    }

    case "removeselect": {
      if (!isStaff) return ephemeral(staffOnly);
      const removed = interaction.values.filter((id) => (ticket.members ?? []).includes(id));
      for (const id of removed) {
        await interaction.channel.permissionOverwrites.delete(id).catch(() => {});
      }
      ticket.members = (ticket.members ?? []).filter((id) => !removed.includes(id));
      saveTicket(ticket);

      if (!removed.length) {
        return interaction.update({ content: "Çıkarılacak kimse bulunamadı.", components: [] });
      }
      const mentions = removed.map((id) => `<@${id}>`).join(" ");
      await interaction.update({ content: `✅ Çıkarıldı: ${mentions}`, components: [] });
      await interaction.channel.send({
        content: `➖ ${mentions} ticket'tan çıkarıldı. (${interaction.user} tarafından)`,
        allowedMentions: { parse: [] },
      });
      await refreshTicketMessage(interaction.channel, ticket);
      return quickLog(interaction.guild, cfg, {
        title: `➖ Ticket'tan kişi çıkarıldı • #${pad(ticket.number)}`,
        color: 0xfaa61a,
        fields: [
          { name: "Çıkaran", value: `${interaction.user}`, inline: true },
          { name: "Çıkarılanlar", value: mentions, inline: true },
        ],
      });
    }

    case "transcript": {
      if (!isStaff) return ephemeral(staffOnly);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const tr = await makeTranscript(interaction.channel, ticket, interaction.user, "Manuel istek");
      return interaction.editReply({ content: "📄 Transcript hazır.", files: [toFile(tr)] });
    }

    case "close": {
      if (closed) return ephemeral("Bu ticket zaten kapalı.");
      const ownerOk = ticket.ownerId === interaction.user.id && cfg.ownerCanClose !== false;
      if (!isStaff && !ownerOk) return ephemeral("Bu ticket'ı kapatma yetkin yok.");
      return interaction.showModal(closeModal());
    }

    case "reopen": {
      if (!isStaff) return ephemeral(staffOnly);
      if (!closed) return ephemeral("Bu ticket zaten açık.");
      await interaction.update({ components: [] });
      return reopenTicket(interaction.channel, interaction.user);
    }

    case "delete": {
      if (!isStaff) return ephemeral(staffOnly);
      return interaction.reply({
        content: "⚠️ Bu ticket **kalıcı olarak silinecek**. Emin misin?",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("ticket:deleteyes").setLabel("Evet, sil").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("ticket:deleteno").setLabel("Vazgeç").setStyle(ButtonStyle.Secondary)
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    case "deleteyes": {
      if (!isStaff) return ephemeral(staffOnly);
      await interaction.update({ content: "🗑️ Ticket siliniyor...", components: [] });
      return deleteTicketChannel(interaction.channel, interaction.user, "Buton ile silindi");
    }

    case "deleteno":
      return interaction.update({ content: "Vazgeçildi.", components: [] });
  }
}

module.exports = {
  TYPES,
  PRIORITIES,
  pad,
  getRawConfig,
  getConfig,
  setConfig,
  normalizeColor,
  colorOf,
  getTicket,
  saveTicket,
  canManage,
  syncStaffRole,
  panelMessage,
  sendPanel,
  refreshPanel,
  handleInteraction,
  handleChannelDelete,
  notifyOwnerLeft,
};