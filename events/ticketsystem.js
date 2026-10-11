
const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder,
    MessageFlags
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ============================================================
// DOUBLE.ANIME • ADVANCED TICKET SYSTEM
// Discord.js v14
// ============================================================

const DATA_DIR = path.join(__dirname, "..", "data");
const SETTINGS_FILE = path.join(DATA_DIR, "ticket-settings.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");

const ALLOWED_CATEGORIES = ["genel", "teknik", "sikayet", "isbirligi"];

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(file) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, "{}", "utf8");
    }
}

ensureFile(SETTINGS_FILE);
ensureFile(TICKETS_FILE);

// ============================================================
// JSON SİSTEMİ
// ============================================================

function readJSON(file) {
    try {
        const raw = fs.readFileSync(file, "utf8");
        const data = JSON.parse(raw || "{}");

        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return {};
        }

        return data;
    } catch (error) {
        console.error(
            `[TICKET] JSON okuma hatası (${path.basename(file)}):`,
            error
        );
        return {};
    }
}

function writeJSON(file, data) {
    const tempFile = `${file}.tmp`;

    try {
        fs.writeFileSync(
            tempFile,
            JSON.stringify(data, null, 4),
            "utf8"
        );

        fs.renameSync(tempFile, file);
    } catch (error) {
        try {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        } catch {}

        console.error(
            `[TICKET] JSON yazma hatası (${path.basename(file)}):`,
            error
        );

        throw error;
    }
}

function getConfig(guildId) {
    const all = readJSON(SETTINGS_FILE);
    return all[guildId] || {};
}

function getAllTickets() {
    return readJSON(TICKETS_FILE);
}

function getTicket(guildId, channelId) {
    const all = getAllTickets();
    return all[guildId]?.[channelId] || null;
}

function updateTicket(guildId, channelId, ticket) {
    const all = getAllTickets();

    if (!all[guildId]) {
        all[guildId] = {};
    }

    all[guildId][channelId] = ticket;
    writeJSON(TICKETS_FILE, all);
}

function deleteTicketData(guildId, channelId) {
    const all = getAllTickets();

    if (!all[guildId]?.[channelId]) return;

    delete all[guildId][channelId];

    if (Object.keys(all[guildId]).length === 0) {
        delete all[guildId];
    }

    writeJSON(TICKETS_FILE, all);
}

// ============================================================
// AYARLAR VE YETKİLER
// ============================================================

function getCategoryChannelId(config, category) {
    const categories = config.categories || {};
    const value = categories[category];

    if (typeof value === "string") return value;
    if (value?.channelId) return value.channelId;
    if (value?.id) return value.id;

    return null;
}

function getSupportRoleId(config) {
    return config.supportRoleId || config.supportRole || null;
}

function getLogChannelId(config) {
    return config.logChannelId || config.logChannel || null;
}

function getTicketLimit(config) {
    const limit = Number(config.limit ?? config.ticketLimit ?? 1);

    return Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : 1;
}

function isStaff(member, config) {
    if (!member) return false;

    if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) {
        return true;
    }

    const roleId = getSupportRoleId(config);
    if (!roleId) return false;

    if (member.roles?.cache?.has?.(roleId)) {
        return true;
    }

    if (Array.isArray(member.roles) && member.roles.includes(roleId)) {
        return true;
    }

    return false;
}

function categoryLabel(category) {
    const labels = {
        genel: "Genel Destek",
        teknik: "Teknik Destek",
        sikayet: "Şikâyet",
        isbirligi: "İş Birliği"
    };

    return labels[category] || "Destek";
}

function safeChannelName(text) {
    return String(text ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30) || "kullanici";
}

// ============================================================
// GÜVENLİ ETKİLEŞİM YANITLARI
// ============================================================

async function safeReply(interaction, content) {
    if (!interaction?.isRepliable?.()) return null;

    const payload = {
        ...(typeof content === "string" ? { content } : content),
        flags: MessageFlags.Ephemeral
    };

    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.followUp(payload);
        }

        return await interaction.reply(payload);
    } catch (error) {
        if (error.code !== 10062 && error.code !== 40060) {
            console.error("[TICKET] Yanıt hatası:", error);
        }

        return null;
    }
}

// ============================================================
// TICKET BUTONLARI
// ============================================================

function ticketButtons(status, claimed) {
    if (status === "closed") {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("ticket:reopen")
                    .setLabel("Yeniden Aç")
                    .setEmoji("🔓")
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId("ticket:delete")
                    .setLabel("Ticket'ı Sil")
                    .setEmoji("🗑️")
                    .setStyle(ButtonStyle.Danger)
            )
        ];
    }

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket:claim")
                .setLabel(claimed ? "Sahiplenildi" : "Ticket'ı Sahiplen")
                .setEmoji("🙋")
                .setStyle(
                    claimed ? ButtonStyle.Secondary : ButtonStyle.Primary
                )
                .setDisabled(Boolean(claimed)),

            new ButtonBuilder()
                .setCustomId("ticket:close")
                .setLabel("Ticket'ı Kapat")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

// ============================================================
// LOG SİSTEMİ
// ============================================================

async function sendLog(
    guild,
    config,
    title,
    description,
    color,
    transcript = null
) {
    const logChannelId = getLogChannelId(config);
    if (!logChannelId) return;

    const logChannel = await guild.channels
        .fetch(logChannelId)
        .catch(() => null);

    if (
        !logChannel ||
        !logChannel.isTextBased() ||
        !logChannel.send
    ) {
        console.warn("[TICKET] Log kanalı bulunamadı veya kullanılamıyor.");
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(String(description || "Bilgi yok.").slice(0, 4000))
        .setFooter({ text: "DOUBLE.ANIME • Ticket Log Sistemi" })
        .setTimestamp();

    const payload = { embeds: [embed] };

    if (transcript) {
        payload.files = [
            new AttachmentBuilder(Buffer.from(transcript, "utf8"), {
                name: `ticket-transcript-${Date.now()}.html`
            })
        ];
    }

    try {
        await logChannel.send(payload);
    } catch (error) {
        console.error("[TICKET] Log gönderilemedi:", error);
    }
}

// ============================================================
// HTML TRANSCRIPT
// ============================================================

async function createTranscript(channel, ticket) {
    const messages = [];
    let lastId = null;

    for (let page = 0; page < 10; page++) {
        const options = { limit: 100 };

        if (lastId) {
            options.before = lastId;
        }

        const batch = await channel.messages
            .fetch(options)
            .catch(error => {
                console.error("[TICKET] Mesajlar alınamadı:", error);
                return null;
            });

        if (!batch || batch.size === 0) break;

        messages.push(...batch.values());

        const oldestMessage = batch.last();
        if (!oldestMessage) break;

        lastId = oldestMessage.id;

        if (batch.size < 100) break;
    }

    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const escapeHTML = value => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const messageHTML = messages.map(message => {
        const time = new Date(
            message.createdTimestamp
        ).toLocaleString("tr-TR");

        const attachmentLinks = [...message.attachments.values()]
            .map(file =>
                `<a href="${escapeHTML(file.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(file.name || "Dosya")}</a>`
            )
            .join("<br>");

        const embeds = message.embeds.map(embed =>
            `<div class="embed"><strong>${escapeHTML(embed.title || "Embed")}</strong><br>${escapeHTML(embed.description || "")}</div>`
        ).join("");

        return `
        <article class="message">
            <div class="meta">
                <strong>${escapeHTML(message.author?.tag || "Bilinmeyen kullanıcı")}</strong>
                <span>${escapeHTML(time)}</span>
            </div>
            <div class="content">${escapeHTML(message.content || "(Metin yok)").replace(/\n/g, "<br>")}</div>
            ${attachmentLinks ? `<div class="attachments">${attachmentLinks}</div>` : ""}
            ${embeds}
        </article>`;
    }).join("\n");

    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DOUBLE.ANIME Ticket Transcript</title>
<style>
body{font-family:Arial,sans-serif;background:#232428;color:#eee;padding:24px}
h1{color:#ff5b76}
.info{background:#303136;padding:16px;border-radius:10px;margin-bottom:20px}
.message{background:#2b2d31;padding:12px;margin:10px 0;border-radius:8px;overflow-wrap:anywhere}
.meta{display:flex;justify-content:space-between;gap:12px;color:#b5bac1;font-size:13px;margin-bottom:8px}
.content{white-space:normal}
.attachments{margin-top:8px}
a{color:#8ab4f8}
.embed{border-left:3px solid #5865f2;padding:8px;margin-top:8px;background:#222327}
</style>
</head>
<body>
<h1>DOUBLE.ANIME • Ticket Transcript</h1>
<div class="info">
<p><strong>Kanal:</strong> ${escapeHTML(channel.name)}</p>
<p><strong>Ticket sahibi:</strong> ${escapeHTML(ticket.userTag || ticket.userId)}</p>
<p><strong>Kategori:</strong> ${escapeHTML(categoryLabel(ticket.category))}</p>
<p><strong>Konu:</strong> ${escapeHTML(ticket.subject || "Belirtilmedi")}</p>
<p><strong>Oluşturulma:</strong> ${escapeHTML(new Date(ticket.createdAt || Date.now()).toLocaleString("tr-TR"))}</p>
<p><strong>Mesaj sayısı:</strong> ${messages.length}</p>
</div>
${messageHTML}
</body>
</html>`;
}

// ============================================================
// MODAL OLUŞTURUCULARI
// ============================================================

function createOpenTicketModal(category) {
    const modal = new ModalBuilder()
        .setCustomId(`ticket:open-form:${category}`)
        .setTitle(`${categoryLabel(category)} Talebi`);

    const subjectInput = new TextInputBuilder()
        .setCustomId("subject")
        .setLabel("Konu")
        .setPlaceholder("Destek talebinin kısa konusu")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(100);

    const detailsInput = new TextInputBuilder()
        .setCustomId("details")
        .setLabel("Talebini açıkla")
        .setPlaceholder("Sorunu veya talebini detaylı şekilde yaz.")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1500);

    return modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(detailsInput)
    );
}

function createCloseModal() {
    const modal = new ModalBuilder()
        .setCustomId("ticket:close-reason")
        .setTitle("Ticket Kapatma");

    const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Kapatma nedeni")
        .setPlaceholder("Ticket neden kapatılıyor?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(500);

    return modal.addComponents(
        new ActionRowBuilder().addComponents(reasonInput)
    );
}

// ============================================================
// EVENT
// ============================================================

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction, client) {
        try {
            if (!interaction.guild) return;

            // ====================================================
            // 1. TICKET AÇMA FORMU
            // ====================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith("ticket:open-form:")
            ) {
                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });

                const category = interaction.customId.split(":")[2];

                if (!ALLOWED_CATEGORIES.includes(category)) {
                    return interaction.editReply("Geçersiz ticket kategorisi.");
                }

                const config = getConfig(interaction.guildId);
                const supportRoleId = getSupportRoleId(config);

                const subject = interaction.fields
                    .getTextInputValue("subject")
                    .trim();

                const details = interaction.fields
                    .getTextInputValue("details")
                    .trim();

                if (!subject || !details) {
                    return interaction.editReply(
                        "Konu ve açıklama alanları boş bırakılamaz."
                    );
                }

                const supportRole = supportRoleId
                    ? await interaction.guild.roles
                        .fetch(supportRoleId)
                        .catch(() => null)
                    : null;

                if (!supportRole) {
                    return interaction.editReply(
                        "Destek rolü ayarlanmamış veya bulunamıyor. `/ticket-ayarla` ayarlarını kontrol edin."
                    );
                }

                const categoryChannelId = getCategoryChannelId(
                    config,
                    category
                );

                if (!categoryChannelId) {
                    return interaction.editReply(
                        "Bu kategori için Discord kategori kanalı ayarlanmamış. `/ticket-ayarla` ayarlarını kontrol edin."
                    );
                }

                const categoryChannel = await interaction.guild.channels
                    .fetch(categoryChannelId)
                    .catch(() => null);

                if (
                    !categoryChannel ||
                    categoryChannel.type !== ChannelType.GuildCategory
                ) {
                    return interaction.editReply(
                        "Ayarlanan kanal geçerli bir Discord kategori kanalı değil."
                    );
                }

                const botMember = interaction.guild.members.me
                    || await interaction.guild.members.fetch(client.user.id).catch(() => null);

                if (
                    !botMember ||
                    !botMember.permissions.has(PermissionFlagsBits.ManageChannels)
                ) {
                    return interaction.editReply(
                        "Botun kanalları yönetme yetkisi bulunmuyor. Bot rolüne **Kanalları Yönet** izni verin."
                    );
                }

                const allTickets = getAllTickets();
                const guildTickets = allTickets[interaction.guildId] || {};

                const userOpenTickets = Object.values(guildTickets).filter(
                    ticket =>
                        ticket.userId === interaction.user.id &&
                        ticket.status === "open"
                );

                const limit = getTicketLimit(config);

                if (userOpenTickets.length >= limit) {
                    return interaction.editReply(
                        `Zaten açık ticket'ın bulunuyor. Aynı anda en fazla ${limit} açık ticket oluşturabilirsin.`
                    );
                }

                const channelName =
                    `ticket-${safeChannelName(interaction.user.username)}`;

                let channel = null;

                try {
                    channel = await interaction.guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: categoryChannel.id,
                        topic: `Ticket sahibi: ${interaction.user.tag} | ID: ${interaction.user.id}`,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.ViewChannel]
                            },
                            {
                                id: interaction.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.AttachFiles,
                                    PermissionFlagsBits.EmbedLinks
                                ]
                            },
                            {
                                id: supportRole.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.AttachFiles,
                                    PermissionFlagsBits.EmbedLinks
                                ]
                            },
                            {
                                id: client.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.ManageChannels,
                                    PermissionFlagsBits.AttachFiles,
                                    PermissionFlagsBits.EmbedLinks
                                ]
                            }
                        ],
                        reason: `Ticket oluşturuldu: ${interaction.user.tag}`
                    });

                    const ticket = {
                        guildId: interaction.guildId,
                        channelId: channel.id,
                        userId: interaction.user.id,
                        userTag: interaction.user.tag,
                        category,
                        subject,
                        details,
                        status: "open",
                        claimedBy: null,
                        createdAt: Date.now(),
                        closedAt: null,
                        closedBy: null,
                        closeReason: null
                    };

                    updateTicket(interaction.guildId, channel.id, ticket);

                    const embed = new EmbedBuilder()
                        .setColor(0xFFC0CB)
                        .setTitle("🎫 DOUBLE.ANIME Destek Ticket'ı")
                        .setDescription(
                            `Merhaba ${interaction.user}, destek talebin oluşturuldu.\n\n` +
                            `**Kategori:** ${categoryLabel(category)}\n` +
                            `**Konu:** ${subject}\n` +
                            `**Açıklama:**\n${details}\n\n` +
                            "Destek ekibinin yanıtını bekleyebilirsin. Ticket kapatıldığında konuşma kaydı log kanalına gönderilir."
                        )
                        .addFields(
                            {
                                name: "Ticket Sahibi",
                                value: `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: "Durum",
                                value: "🟢 Açık",
                                inline: true
                            }
                        )
                        .setFooter({
                            text: "DOUBLE.ANIME • Destek Sistemi"
                        })
                        .setTimestamp();

                    await channel.send({
                        content: `<@&${supportRole.id}> ${interaction.user}`,
                        embeds: [embed],
                        components: ticketButtons("open", false),
                        allowedMentions: {
                            users: [interaction.user.id],
                            roles: [supportRole.id]
                        }
                    });

                    await interaction.editReply({
                        content: `Ticket'ın oluşturuldu: ${channel}`
                    });

                    await sendLog(
                        interaction.guild,
                        config,
                        "🎫 Yeni Ticket",
                        `**Sahip:** ${interaction.user.tag} (${interaction.user.id})\n` +
                        `**Kanal:** ${channel}\n` +
                        `**Kategori:** ${categoryLabel(category)}\n` +
                        `**Konu:** ${subject}`,
                        0x57F287
                    );

                    console.log(
                        `[TICKET] ${interaction.user.tag} için ${channel.name} oluşturuldu.`
                    );
                } catch (error) {
                    console.error("[TICKET] Oluşturma hatası:", error);

                    if (channel) {
                        try {
                            deleteTicketData(interaction.guildId, channel.id);
                        } catch (cleanupError) {
                            console.error("[TICKET] Kayıt temizlenemedi:", cleanupError);
                        }

                        await channel.delete("Başarısız ticket oluşturma işlemi")
                            .catch(() => null);
                    }

                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply(
                            "Ticket oluşturulamadı. Botun izinlerini ve Render loglarını kontrol edin."
                        ).catch(() => null);
                    }
                }

                return;
            }

            // ====================================================
            // 2. TICKET KAPATMA NEDENİ MODALI
            // ====================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId === "ticket:close-reason"
            ) {
                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });

                const config = getConfig(interaction.guildId);
                const ticket = getTicket(
                    interaction.guildId,
                    interaction.channelId
                );

                if (!ticket || ticket.status !== "open") {
                    return interaction.editReply(
                        "Bu ticket bulunamadı veya zaten kapalı."
                    );
                }

                if (
                    ticket.userId !== interaction.user.id &&
                    !isStaff(interaction.member, config)
                ) {
                    return interaction.editReply(
                        "Bu ticket'ı kapatma yetkin yok."
                    );
                }

                const reason = interaction.fields
                    .getTextInputValue("reason")
                    .trim();

                if (!reason) {
                    return interaction.editReply(
                        "Kapatma nedeni boş bırakılamaz."
                    );
                }

                const channel = interaction.channel;

                const transcript = await createTranscript(channel, ticket)
                    .catch(error => {
                        console.error("[TICKET] Transcript oluşturulamadı:", error);
                        return null;
                    });

                await channel.permissionOverwrites.edit(ticket.userId, {
                    ViewChannel: true,
                    SendMessages: false,
                    ReadMessageHistory: true,
                    AttachFiles: false
                });

                ticket.status = "closed";
                ticket.closedAt = Date.now();
                ticket.closedBy = interaction.user.id;
                ticket.closeReason = reason;

                updateTicket(interaction.guildId, channel.id, ticket);

                const closedEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("🔒 Ticket Kapatıldı")
                    .setDescription(
                        `**Kapatan:** ${interaction.user}\n` +
                        `**Neden:** ${reason}\n\n` +
                        "Destek ekibi bu ticket'ı yeniden açabilir."
                    )
                    .setFooter({
                        text: "DOUBLE.ANIME • Ticket Sistemi"
                    })
                    .setTimestamp();

                await channel.send({
                    embeds: [closedEmbed],
                    components: ticketButtons("closed", Boolean(ticket.claimedBy))
                });

                await interaction.editReply("Ticket başarıyla kapatıldı.");

                await sendLog(
                    interaction.guild,
                    config,
                    "🔒 Ticket Kapatıldı",
                    `**Kanal:** #${channel.name}\n` +
                    `**Ticket sahibi:** <@${ticket.userId}>\n` +
                    `**Kapatan:** ${interaction.user.tag}\n` +
                    `**Neden:** ${reason}`,
                    0xED4245,
                    transcript
                );

                return;
            }

            // ====================================================
            // 3. KATEGORİ SEÇİMİ -> MODAL
            // ====================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId === "ticket:category"
            ) {
                const category = interaction.values[0];

                if (!ALLOWED_CATEGORIES.includes(category)) {
                    return safeReply(interaction, "Geçersiz ticket kategorisi.");
                }

                return interaction.showModal(createOpenTicketModal(category));
            }

            // ====================================================
            // DİĞER TICKET İŞLEMLERİ SADECE BUTONLAR
            // ====================================================

            if (
                !interaction.isButton() ||
                !interaction.customId.startsWith("ticket:")
            ) {
                return;
            }

            const config = getConfig(interaction.guildId);
            const ticket = getTicket(
                interaction.guildId,
                interaction.channelId
            );

            if (!ticket) {
                return safeReply(
                    interaction,
                    "Bu kanal kayıtlı bir ticket değil."
                );
            }

            // ====================================================
            // 4. TICKET SAHİPLENME
            // ====================================================

            if (interaction.customId === "ticket:claim") {
                if (!isStaff(interaction.member, config)) {
                    return safeReply(
                        interaction,
                        "Ticket'ı yalnızca destek ekibi sahiplenebilir."
                    );
                }

                if (ticket.status !== "open") {
                    return safeReply(interaction, "Bu ticket zaten kapalı.");
                }

                if (ticket.claimedBy) {
                    return safeReply(
                        interaction,
                        `Bu ticket zaten <@${ticket.claimedBy}> tarafından sahiplenilmiş.`
                    );
                }

                ticket.claimedBy = interaction.user.id;
                ticket.claimedAt = Date.now();

                updateTicket(
                    interaction.guildId,
                    interaction.channelId,
                    ticket
                );

                await interaction.update({
                    components: ticketButtons("open", true)
                });

                const embed = new EmbedBuilder()
                    .setColor(0xFFC0CB)
                    .setTitle("🙋 Ticket Sahiplenildi")
                    .setDescription(
                        `${interaction.user} bu ticket ile ilgileniyor.\n` +
                        `**Ticket sahibi:** <@${ticket.userId}>`
                    )
                    .setTimestamp();

                await interaction.channel.send({ embeds: [embed] });

                await sendLog(
                    interaction.guild,
                    config,
                    "🙋 Ticket Sahiplenildi",
                    `**Kanal:** ${interaction.channel}\n` +
                    `**Ticket sahibi:** <@${ticket.userId}>\n` +
                    `**Destek görevlisi:** ${interaction.user.tag}`,
                    0xFFC0CB
                );

                return;
            }

            // ====================================================
            // 5. TICKET KAPATMA MODALI
            // ====================================================

            if (interaction.customId === "ticket:close") {
                if (
                    ticket.userId !== interaction.user.id &&
                    !isStaff(interaction.member, config)
                ) {
                    return safeReply(
                        interaction,
                        "Bu ticket'ı kapatma yetkin yok."
                    );
                }

                if (ticket.status !== "open") {
                    return safeReply(interaction, "Bu ticket zaten kapalı.");
                }

                return interaction.showModal(createCloseModal());
            }

            // ====================================================
            // 6. TICKET YENİDEN AÇMA
            // ====================================================

            if (interaction.customId === "ticket:reopen") {
                if (!isStaff(interaction.member, config)) {
                    return safeReply(
                        interaction,
                        "Ticket'ı yalnızca destek ekibi yeniden açabilir."
                    );
                }

                if (ticket.status !== "closed") {
                    return safeReply(interaction, "Bu ticket zaten açık.");
                }

                await interaction.channel.permissionOverwrites.edit(
                    ticket.userId,
                    {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        AttachFiles: true,
                        EmbedLinks: true
                    }
                );

                ticket.status = "open";
                ticket.reopenedAt = Date.now();
                ticket.reopenedBy = interaction.user.id;

                updateTicket(
                    interaction.guildId,
                    interaction.channelId,
                    ticket
                );

                await interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x57F287)
                            .setTitle("🔓 Ticket Yeniden Açıldı")
                            .setDescription(
                                `**Açan:** ${interaction.user}\n` +
                                `**Ticket sahibi:** <@${ticket.userId}>`
                            )
                            .setTimestamp()
                    ],
                    components: ticketButtons(
                        "open",
                        Boolean(ticket.claimedBy)
                    )
                });

                await interaction.channel.send({
                    content:
                        `<@${ticket.userId}> Ticket'ın yeniden açıldı. Destek ekibiyle buradan devam edebilirsin.`,
                    allowedMentions: {
                        users: [ticket.userId]
                    }
                });

                await sendLog(
                    interaction.guild,
                    config,
                    "🔓 Ticket Yeniden Açıldı",
                    `**Kanal:** ${interaction.channel}\n` +
                    `**Ticket sahibi:** <@${ticket.userId}>\n` +
                    `**Açan:** ${interaction.user.tag}`,
                    0x57F287
                );

                return;
            }

            // ====================================================
            // 7. TICKET SİLME
            // ====================================================

            if (interaction.customId === "ticket:delete") {
                if (!isStaff(interaction.member, config)) {
                    return safeReply(
                        interaction,
                        "Ticket'ı yalnızca destek ekibi silebilir."
                    );
                }

                if (ticket.status !== "closed") {
                    return safeReply(
                        interaction,
                        "Önce ticket'ı kapatmalısın."
                    );
                }

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });

                const channel = interaction.channel;

                const transcript = await createTranscript(channel, ticket)
                    .catch(error => {
                        console.error("[TICKET] Silme transcript hatası:", error);
                        return null;
                    });

                await sendLog(
                    interaction.guild,
                    config,
                    "🗑️ Ticket Siliniyor",
                    `**Kanal:** #${channel.name}\n` +
                    `**Ticket sahibi:** <@${ticket.userId}>\n` +
                    `**Silen:** ${interaction.user.tag}`,
                    0xED4245,
                    transcript
                );

                await interaction.editReply("Ticket siliniyor...");

                try {
                    await channel.delete(
                        `Ticket ${interaction.user.tag} tarafından silindi.`
                    );

                    deleteTicketData(
                        interaction.guildId,
                        interaction.channelId
                    );
                } catch (error) {
                    console.error("[TICKET] Kanal silinemedi:", error);

                    return safeReply(
                        interaction,
                        "Kanal silinemedi. Botun Kanalları Yönet iznini kontrol et."
                    );
                }

                return;
            }
        } catch (error) {
            console.error("[DOUBLE.ANIME TICKET ERROR]", error);

            await safeReply(
                interaction,
                "Ticket işlemi sırasında hata oluştu. Render konsolundaki `[DOUBLE.ANIME TICKET ERROR]` mesajını kontrol edin."
            );
        }
    }
};