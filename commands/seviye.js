
const {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const { createCanvas, loadImage } = require("@napi-rs/canvas");
const store = require("../lib/store");

const W = 1200;
const H = 500;

const C = {
    pink: "#ff63d4",
    lightPink: "#ffc1f0",
    purple: "#bd8cff",
    white: "#fff7ff",
    muted: "#c4b4d9",
    track: "#30213f"
};

function rounded(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);

    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }

    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function star(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();

    for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : r * 0.42;
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }

    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function fittedText(ctx, text, x, y, maxWidth, size, color) {
    const original = String(text ?? "");
    let shown = original;
    let fontSize = size;

    while (fontSize > 13) {
        ctx.font = `bold ${fontSize}px sans-serif`;
        if (ctx.measureText(shown).width <= maxWidth) break;
        fontSize--;
    }

    ctx.font = `bold ${fontSize}px sans-serif`;

    while (shown.length > 1 && ctx.measureText(shown).width > maxWidth) {
        shown = shown.slice(0, -1);
    }

    if (shown !== original) {
        while (
            shown.length > 1 &&
            ctx.measureText(shown + "…").width > maxWidth
        ) {
            shown = shown.slice(0, -1);
        }
        shown += "…";
    }

    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText(shown, x, y);
}

async function createProfileCard(user, data) {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const level = Math.max(0, Number(data.level) || 0);
    const xp = Math.max(0, Number(data.xp) || 0);
    const neededXP = 100 + level * 75;
    const progress = Math.max(0, Math.min(1, xp / neededXP));
    const percentage = Math.floor(progress * 100);

    // Arka plan
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#090817");
    bg.addColorStop(0.48, "#1b102d");
    bg.addColorStop(1, "#401847");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Pembe ışık
    const glow = ctx.createRadialGradient(1000, 120, 5, 1000, 120, 460);
    glow.addColorStop(0, "rgba(255,75,210,0.42)");
    glow.addColorStop(1, "rgba(255,75,210,0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Çerçeve ve panel
    rounded(
        ctx, 12, 12, W - 24, H - 24, 23,
        "rgba(8,6,20,0.3)",
        C.pink
    );

    rounded(
        ctx, 34, 32, W - 68, 205, 22,
        "rgba(8,6,22,0.4)",
        "rgba(255,99,212,0.24)"
    );

    star(ctx, 405, 72, 13, C.lightPink);
    star(ctx, 810, 66, 10, C.purple);
    star(ctx, 1125, 95, 17, C.pink);
    star(ctx, 1080, 205, 10, C.lightPink);
    star(ctx, 76, 430, 15, C.pink);
    star(ctx, 1110, 455, 13, C.purple);

    // Avatar
    const ax = 145;
    const ay = 126;
    const radius = 72;

    try {
        const avatar = await loadImage(
            user.displayAvatarURL({
                extension: "png",
                size: 256,
                forceStatic: true
            })
        );

        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
            avatar,
            ax - radius,
            ay - radius,
            radius * 2,
            radius * 2
        );
        ctx.restore();

        ctx.beginPath();
        ctx.arc(ax, ay, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = C.pink;
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ax, ay, radius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = C.purple;
        ctx.lineWidth = 2;
        ctx.stroke();
    } catch (error) {
        console.error("[SEVİYE] Avatar yüklenemedi:", error.message);

        ctx.beginPath();
        ctx.arc(ax, ay, radius, 0, Math.PI * 2);
        ctx.fillStyle = C.track;
        ctx.fill();
    }

    // Başlık
    ctx.save();
    ctx.shadowColor = C.pink;
    ctx.shadowBlur = 18;
    ctx.fillStyle = C.pink;
    ctx.font = "italic bold 58px sans-serif";
    ctx.fillText("LEVEL CARD", 265, 105);
    ctx.restore();

    ctx.fillStyle = C.lightPink;
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("✦  S E V İ Y E   K A R T I  ✦", 273, 148);

    ctx.fillStyle = C.pink;
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("DOUBLE.ANIME", 273, 188);

    fittedText(ctx, user.username, 273, 218, 650, 22, C.white);

    // Bilgi paneli
    rounded(
        ctx, 36, 254, W - 72, 190, 22,
        "rgba(10,7,24,0.78)",
        "rgba(255,99,212,0.75)"
    );

    rounded(
        ctx, 61, 276, W - 122, 99, 15,
        "rgba(24,14,40,0.95)",
        "rgba(189,140,255,0.25)"
    );

    ctx.strokeStyle = "rgba(255,99,212,0.45)";
    ctx.lineWidth = 1.5;

    for (const x of [420, 790]) {
        ctx.beginPath();
        ctx.moveTo(x, 286);
        ctx.lineTo(x, 365);
        ctx.stroke();
    }

    // Seviye
    ctx.fillStyle = C.muted;
    ctx.font = "bold 17px sans-serif";
    ctx.fillText("MEVCUT SEVİYE", 85, 301);

    ctx.fillStyle = C.lightPink;
    ctx.font = "bold 48px sans-serif";
    ctx.fillText(String(level), 90, 354);

    // Toplam XP
    ctx.fillStyle = C.muted;
    ctx.font = "bold 17px sans-serif";
    ctx.fillText("TOPLAM İLERLEME", 465, 301);

    ctx.fillStyle = C.white;
    ctx.font = "bold 31px sans-serif";
    ctx.fillText(`%${percentage}`, 465, 350);

    // Sonraki seviye
    ctx.fillStyle = C.muted;
    ctx.font = "bold 17px sans-serif";
    ctx.fillText("SONRAKİ SEVİYE", 830, 301);

    fittedText(ctx, `${neededXP} XP`, 830, 349, 270, 31, C.pink);

    // XP çubuğu
    ctx.fillStyle = C.lightPink;
    ctx.font = "bold 17px sans-serif";
    ctx.fillText("SEVİYE İLERLEMESİ", 65, 402);

    const barX = 65;
    const barY = 412;
    const barW = 1070;
    const barH = 13;

    rounded(ctx, barX, barY, barW, barH, 7, C.track);

    if (progress > 0) {
        ctx.save();

        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 7);
        ctx.clip();

        const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        gradient.addColorStop(0, C.pink);
        gradient.addColorStop(0.55, "#e68de9");
        gradient.addColorStop(1, C.purple);

        ctx.fillStyle = gradient;
        ctx.fillRect(barX, barY, barW * progress, barH);

        ctx.restore();
    }

    ctx.fillStyle = C.white;
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(
        `${xp.toLocaleString("tr-TR")} / ${neededXP.toLocaleString("tr-TR")} XP`,
        65,
        439
    );

    ctx.fillStyle = C.pink;
    ctx.font = "bold 17px sans-serif";
    ctx.fillText("DOUBLE.ANIME", 65, 472);

    ctx.fillStyle = C.muted;
    ctx.font = "16px sans-serif";
    ctx.fillText("♡  Her mesaj yeni bir adım", 235, 472);

    return new AttachmentBuilder(canvas.toBuffer("image/png"), {
        name: "double-anime-seviye.png"
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("seviye")
        .setDescription("Seviye bilgilerini görüntüler ve kanalını ayarlar.")

        .addSubcommand(sub =>
            sub
                .setName("bilgi")
                .setDescription("Kendi veya başka bir üyenin seviyesini gösterir.")
                .addUserOption(option =>
                    option
                        .setName("kullanici")
                        .setDescription("Seviyesini görmek istediğin üye")
                        .setRequired(false)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("kanal")
                .setDescription("Seviye atlama mesajlarının kanalını ayarlar.")
                .addChannelOption(option =>
                    option
                        .setName("kanal")
                        .setDescription("Seviye mesajlarının gönderileceği kanal")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        ),

    async execute(interaction, client, config) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: "Bu komut yalnızca sunucularda kullanılabilir.",
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        // KANAL AYARLAMA
        if (subcommand === "kanal") {
            if (!interaction.memberPermissions?.has(
                PermissionFlagsBits.ManageGuild
            )) {
                return interaction.reply({
                    content: "⛔ Bu işlem için Sunucuyu Yönet iznine ihtiyacın var.",
                    ephemeral: true
                });
            }

            const channel = interaction.options.getChannel("kanal");

            const me = interaction.guild.members.me;

            if (
                !me ||
                !channel
                    .permissionsFor(me)
                    ?.has([
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.AttachFiles
                    ])
            ) {
                return interaction.reply({
                    content: "⛔ Bu kanalda mesaj ve görsel göndermek için gerekli izinlerim yok.",
                    ephemeral: true
                });
            }

            const settings = store.read("settings.json", {});
            settings[interaction.guildId] ||= {};
            settings[interaction.guildId].levelChannelId = channel.id;

            store.write("settings.json", settings);

            return interaction.reply({
                content: `🌸 Seviye atlama görselleri artık ${channel} kanalına gönderilecek.`,
                ephemeral: true
            });
        }

        // SEVİYE BİLGİSİ
        const user =
            interaction.options.getUser("kullanici") ||
            interaction.user;

        const allLevels = store.read("levels.json", {});
        const data = allLevels[interaction.guildId]?.[user.id] || {
            xp: 0,
            level: 0
        };

        const level = Math.max(0, Number(data.level) || 0);
        const xp = Math.max(0, Number(data.xp) || 0);

        const attachment = await createProfileCard(user, {
            level,
            xp
        });

        const neededXP = 100 + level * 75;
        const progress = Math.max(
            0,
            Math.min(100, Math.floor((xp / neededXP) * 100))
        );

        const embed = new EmbedBuilder()
            .setColor(config?.colors?.primary ?? 0xff63d4)
            .setAuthor({
                name: "DOUBLE.ANIME • SEVİYE SİSTEMİ"
            })
            .setTitle(`🌸 ${user.username} • Seviye Kartı`)
            .setDescription(
                `𓍢ִ໋🌷͙֒・**${user.username}** kullanıcısının seviye bilgileri.\n\n` +
                `🏆 **Seviye:** ${level}\n` +
                `✨ **XP:** ${xp} / ${neededXP}\n` +
                `📊 **İlerleme:** %${progress}`
            )
            .setImage("attachment://double-anime-seviye.png")
            .setFooter({
                text: config?.footer ?? "DOUBLE.ANIME • Daha yüksek seviyelere ♡"
            })
            .setTimestamp();

        return interaction.reply({
            embeds: [embed],
            files: [attachment]
        });
    }
};

