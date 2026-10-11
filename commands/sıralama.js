
const {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder
} = require("discord.js");

const { createCanvas, loadImage } = require("@napi-rs/canvas");
const store = require("../lib/store");

const W = 1200;
const H = 760;

const C = {
    pink: "#ff63d4",
    lightPink: "#ffc1f0",
    purple: "#bd8cff",
    white: "#fff7ff",
    muted: "#c4b4d9",
    track: "#30213f"
};

function requiredXP(level) {
    return 100 + level * 75;
}

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

async function loadAvatar(user) {
    try {
        return await loadImage(
            user.displayAvatarURL({
                extension: "png",
                size: 128,
                forceStatic: true
            })
        );
    } catch {
        return null;
    }
}

async function createLeaderboard(guild, entries, ownRank) {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#090817");
    bg.addColorStop(0.5, "#1b102d");
    bg.addColorStop(1, "#401847");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(1000, 100, 5, 1000, 100, 500);
    glow.addColorStop(0, "rgba(255,75,210,0.35)");
    glow.addColorStop(1, "rgba(255,75,210,0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    rounded(
        ctx, 12, 12, W - 24, H - 24, 24,
        "rgba(8,6,20,0.45)",
        C.pink
    );

    ctx.fillStyle = C.pink;
    ctx.font = "bold 44px sans-serif";
    ctx.fillText("DOUBLE.ANIME", 48, 68);

    ctx.fillStyle = C.lightPink;
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("SEVİYE SIRALAMASI", 48, 111);

    ctx.fillStyle = C.muted;
    ctx.font = "20px sans-serif";
    ctx.fillText(guild.name.slice(0, 45), 48, 146);

    const topThree = [
        { x: 48, width: 350, color: "#ffd76a", medal: "🥇" },
        { x: 425, width: 350, color: "#d8d8ef", medal: "🥈" },
        { x: 802, width: 350, color: "#e6a06c", medal: "🥉" }
    ];

    const featured = [entries[0], entries[1], entries[2]];

    for (let i = 0; i < 3; i++) {
        const entry = featured[i];
        const box = topThree[i];

        rounded(
            ctx, box.x, 170, box.width, 135, 18,
            "rgba(20,12,36,0.9)",
            box.color
        );

        ctx.fillStyle = box.color;
        ctx.font = "bold 25px sans-serif";
        ctx.fillText(`#${i + 1}`, box.x + 18, 205);

        if (!entry) {
            ctx.fillStyle = C.muted;
            ctx.font = "20px sans-serif";
            ctx.fillText("Henüz kayıt yok", box.x + 18, 250);
            continue;
        }

        const avatar = await loadAvatar(entry.user);

        if (avatar) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(box.x + 55, 247, 27, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatar, box.x + 28, 220, 54, 54);
            ctx.restore();
        }

        ctx.fillStyle = C.white;
        ctx.font = "bold 19px sans-serif";

        let name = entry.user.username;
        while (name.length > 15) name = name.slice(0, -1);

        ctx.fillText(name, box.x + 95, 242);

        ctx.fillStyle = box.color;
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(`Seviye ${entry.level}`, box.x + 95, 272);

        ctx.fillStyle = C.muted;
        ctx.font = "16px sans-serif";
        ctx.fillText(`${entry.xp} XP`, box.x + 95, 294);
    }

    ctx.fillStyle = C.lightPink;
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("✦  İLK 10 ÜYE  ✦", 48, 350);

    const list = entries.slice(0, 10);

    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        const y = 370 + i * 32;
        const isSelf = entry.user.id === ownRank.userId;

        rounded(
            ctx,
            42,
            y - 22,
            1116,
            28,
            8,
            isSelf ? "rgba(255,99,212,0.24)" : "rgba(20,12,36,0.65)",
            isSelf ? C.pink : null
        );

        ctx.fillStyle = i < 3 ? C.lightPink : C.muted;
        ctx.font = "bold 18px sans-serif";
        ctx.fillText(`#${i + 1}`, 60, y);

        ctx.fillStyle = C.white;
        ctx.font = "17px sans-serif";

        let name = entry.user.username;
        if (name.length > 35) name = name.slice(0, 32) + "...";
        ctx.fillText(name, 135, y);

        ctx.textAlign = "right";
        ctx.fillStyle = C.pink;
        ctx.font = "bold 18px sans-serif";
        ctx.fillText(`Seviye ${entry.level}`, 930, y);

        ctx.fillStyle = C.lightPink;
        ctx.font = "17px sans-serif";
        ctx.fillText(`${entry.xp} XP`, 1125, y);
        ctx.textAlign = "left";
    }

    const footerY = 720;

    ctx.fillStyle = C.pink;
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(
        ownRank.rank
            ? `Senin sıran: #${ownRank.rank}`
            : "Henüz sıralamada kayıtlı değilsin.",
        48,
        footerY
    );

    ctx.fillStyle = C.muted;
    ctx.font = "17px sans-serif";
    ctx.fillText(
        `Toplam kayıt: ${ownRank.total}`,
        800,
        footerY
    );

    return new AttachmentBuilder(canvas.toBuffer("image/png"), {
        name: "double-anime-seviye-siralama.png"
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("seviye-sıralama")
        .setDescription("Sunucunun seviye sıralamasını görsel olarak gösterir."),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const allLevels = store.read("levels.json", {});
            const guildLevels = allLevels[interaction.guildId] || {};

            const records = Object.entries(guildLevels)
                .map(([userId, data]) => ({
                    userId,
                    level: Math.max(0, Number(data?.level) || 0),
                    xp: Math.max(0, Number(data?.xp) || 0)
                }))
                .sort((a, b) =>
                    b.level - a.level || b.xp - a.xp
                );

            if (!records.length) {
                return interaction.editReply({
                    content: "🌸 Henüz seviye verisi yok. Mesaj yazarak XP kazanabilirsin!"
                });
            }

            const entries = [];

            for (const record of records.slice(0, 10)) {
                const user = await interaction.client.users
                    .fetch(record.userId)
                    .catch(() => null);

                if (!user) continue;

                entries.push({
                    user,
                    userId: record.userId,
                    level: record.level,
                    xp: record.xp
                });
            }

            const ownIndex = records.findIndex(
                item => item.userId === interaction.user.id
            );

            const ownRank = {
                userId: interaction.user.id,
                rank: ownIndex === -1 ? null : ownIndex + 1,
                total: records.length
            };

            const attachment = await createLeaderboard(
                interaction.guild,
                entries,
                ownRank
            );

            const embed = new EmbedBuilder()
                .setColor("#ff63d4")
                .setTitle("🏆 DOUBLE.ANIME • Seviye Sıralaması")
                .setDescription(
                    ownRank.rank
                        ? `🌸 Sunucudaki sıran: **#${ownRank.rank}**\n✨ Toplam kayıtlı üye: **${ownRank.total}**`
                        : `🌸 Henüz seviye kaydın yok.\n✨ Toplam kayıtlı üye: **${ownRank.total}**`
                )
                .setImage("attachment://double-anime-seviye-siralama.png")
                .setFooter({
                    text: "DOUBLE.ANIME • Mesaj yaz, zirveye ulaş!"
                })
                .setTimestamp();

            return interaction.editReply({
                embeds: [embed],
                files: [attachment]
            });
        } catch (error) {
            console.error("[Seviye Sıralama] Hata:", error);

            return interaction.editReply({
                content: "Sıralama oluşturulurken hata oluştu. `levels.json` ve `lib/store.js` dosyalarını kontrol et."
            });
        }
    }
};