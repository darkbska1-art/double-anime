
const {
    Events,
    EmbedBuilder,
    AttachmentBuilder
} = require("discord.js");

const {
    createCanvas,
    loadImage
} = require("@napi-rs/canvas");

const store = require("../lib/store");
const { giveLevelReward } = require("../lib/levelRewards");

// =====================================================
// DOUBLE.ANIME • SEVİYE SİSTEMİ
// XP + Seviye Kartı + Otomatik Ödül Rolü
// =====================================================

const XP_MIN = 15;
const XP_MAX = 25;
const COOLDOWN = 60_000;

const cooldowns = new Map();

function requiredXP(level) {
    return 100 + level * 75;
}

function randomXP() {
    return Math.floor(
        Math.random() * (XP_MAX - XP_MIN + 1)
    ) + XP_MIN;
}

// =====================================================
// SEVİYE ATLAMA GÖRSELİ
// =====================================================

async function createLevelImage(
    user,
    oldLevel,
    newLevel,
    xp,
    neededXP,
    gainedXP
) {
    const width = 1200;
    const height = 500;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Arka plan
    const gradient = ctx.createLinearGradient(
        0, 0, width, height
    );

    gradient.addColorStop(0, "#170b2b");
    gradient.addColorStop(0.5, "#4c176e");
    gradient.addColorStop(1, "#130d25");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Dekoratif ışıklar
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#ff65dc";

    ctx.beginPath();
    ctx.arc(1050, 60, 180, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8b5cf6";

    ctx.beginPath();
    ctx.arc(120, 460, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;

    // Ana kart
    ctx.fillStyle = "rgba(10, 8, 24, 0.76)";
    ctx.beginPath();
    ctx.roundRect(35, 35, 1130, 430, 30);
    ctx.fill();

    ctx.strokeStyle = "rgba(236, 72, 153, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(35, 35, 1130, 430, 30);
    ctx.stroke();

    // Kullanıcı avatarı
    const avatarURL = user.displayAvatarURL({
        extension: "png",
        size: 256
    });

    const avatar = await loadImage(avatarURL);

    ctx.save();

    ctx.beginPath();
    ctx.arc(185, 205, 90, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
        avatar,
        95,
        115,
        180,
        180
    );

    ctx.restore();

    // Avatar çerçevesi
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = 7;

    ctx.beginPath();
    ctx.arc(185, 205, 94, 0, Math.PI * 2);
    ctx.stroke();

    // Sol bölüm metinleri
    ctx.textAlign = "center";

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("DOUBLE.ANIME", 185, 340);

    ctx.fillStyle = "#f9a8d4";
    ctx.font = "20px sans-serif";
    ctx.fillText("SEVİYE SİSTEMİ", 185, 375);

    // Sağ bölüm başlığı
    ctx.textAlign = "left";

    ctx.fillStyle = "#f9a8d4";
    ctx.font = "bold 25px sans-serif";
    ctx.fillText("TEBRİKLER!", 340, 105);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 43px sans-serif";

    const displayName =
        user.globalName ||
        user.username ||
        "Kullanıcı";

    ctx.fillText(
        displayName.length > 25
            ? displayName.slice(0, 25) + "..."
            : displayName,
        340,
        160
    );

    ctx.fillStyle = "#e9d5ff";
    ctx.font = "25px sans-serif";
    ctx.fillText(
        "Bir üst seviyeye ulaştın!",
        340,
        205
    );

    // Seviye kutuları
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    ctx.beginPath();
    ctx.roundRect(340, 235, 300, 95, 18);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(665, 235, 300, 95, 18);
    ctx.fill();

    ctx.fillStyle = "#d8b4fe";
    ctx.font = "20px sans-serif";
    ctx.fillText("ÖNCEKİ SEVİYE", 365, 267);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 35px sans-serif";
    ctx.fillText(String(oldLevel), 365, 310);

    ctx.fillStyle = "#f9a8d4";
    ctx.font = "20px sans-serif";
    ctx.fillText("YENİ SEVİYE", 690, 267);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 35px sans-serif";
    ctx.fillText(String(newLevel), 690, 310);

    // XP bilgisi
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 21px sans-serif";
    ctx.fillText("XP İLERLEMESİ", 340, 370);

    ctx.textAlign = "right";
    ctx.fillStyle = "#f9a8d4";
    ctx.font = "20px sans-serif";

    ctx.fillText(
        `${xp} / ${neededXP} XP`,
        965,
        370
    );

    // XP çubuğu
    const barX = 340;
    const barY = 390;
    const barWidth = 625;
    const barHeight = 17;

    ctx.fillStyle = "rgba(255, 255, 255, 0.13)";
    ctx.beginPath();
    ctx.roundRect(
        barX,
        barY,
        barWidth,
        barHeight,
        9
    );
    ctx.fill();

    const progress = Math.max(
        0,
        Math.min(1, xp / Math.max(neededXP, 1))
    );

    if (progress > 0) {
        const barGradient = ctx.createLinearGradient(
            barX,
            barY,
            barX + barWidth,
            barY
        );

        barGradient.addColorStop(0, "#c084fc");
        barGradient.addColorStop(1, "#f472b6");

        ctx.fillStyle = barGradient;
        ctx.beginPath();
        ctx.roundRect(
            barX,
            barY,
            Math.max(9, barWidth * progress),
            barHeight,
            9
        );
        ctx.fill();
    }

    // Kazanılan XP
    ctx.textAlign = "left";
    ctx.fillStyle = "#d8b4fe";
    ctx.font = "18px sans-serif";

    ctx.fillText(
        `+${gainedXP} XP`,
        340,
        435
    );

    ctx.textAlign = "right";
    ctx.fillStyle = "#a78bfa";
    ctx.font = "17px sans-serif";

    ctx.fillText(
        "DOUBLE.ANIME • LEVEL UP",
        1120,
        435
    );

    return canvas.toBuffer("image/png");
}

// =====================================================
// MESAJ OLAYI
// =====================================================

module.exports = {
    name: Events.MessageCreate,

    async execute(message, client, config) {
        try {
            // DM ve bot mesajlarını dikkate alma
            if (!message.guild || message.author.bot) {
                return;
            }

            const guildId = message.guild.id;
            const userId = message.author.id;

            // XP bekleme süresi
            const cooldownKey = `${guildId}:${userId}`;
            const now = Date.now();
            const lastMessage = cooldowns.get(cooldownKey) || 0;

            if (now - lastMessage < COOLDOWN) {
                return;
            }

            cooldowns.set(cooldownKey, now);

            // Eski cooldown kayıtlarını sınırla
            if (cooldowns.size > 10_000) {
                for (const [key, time] of cooldowns) {
                    if (now - time >= COOLDOWN) {
                        cooldowns.delete(key);
                    }
                }
            }

            // Seviye verilerini oku
            const allLevels = store.read("levels.json", {});

            if (!allLevels[guildId]) {
                allLevels[guildId] = {};
            }

            const data = allLevels[guildId][userId] || {
                xp: 0,
                level: 0
            };

            const oldLevel = Number(data.level) || 0;
            const gainedXP = randomXP();

            data.xp = (Number(data.xp) || 0) + gainedXP;
            data.level = oldLevel;

            // Bir mesajla birden fazla seviye atlanabilir
            while (data.xp >= requiredXP(data.level)) {
                data.xp -= requiredXP(data.level);
                data.level++;
            }

            allLevels[guildId][userId] = data;

            // Verileri kaydet
            store.write("levels.json", allLevels);

            // Seviye atlanmadıysa ödül ve duyuru işlemi yapma
            if (data.level <= oldLevel) {
                return;
            }

            console.log(
                `[LEVEL] ${message.author.tag}: ${oldLevel} -> ${data.level}`
            );

            // =================================================
            // OTOMATİK SEVİYE ÖDÜL ROLLERİ
            // =================================================

            const member =
                message.member ||
                await message.guild.members.fetch(userId).catch(() => null);

            if (member) {
                for (
                    let level = oldLevel + 1;
                    level <= data.level;
                    level++
                ) {
                    await giveLevelReward(member, level);
                }
            }

            // =================================================
            // SEVİYE DUYURU KANALI
            // =================================================

            const settings = store.read("settings.json", {});
            const channelId =
                settings[guildId]?.levelChannelId;

            // Kanal ayarlı değilse ödül rolleri verilmiş olur;
            // yalnızca görsel duyurusu gönderilmez.
            if (!channelId) {
                console.log(
                    `[LEVEL] ${message.guild.name} sunucusunda seviye duyuru kanalı ayarlanmamış.`
                );
                return;
            }

            const channel = await message.guild.channels
                .fetch(channelId)
                .catch(() => null);

            if (
                !channel ||
                !channel.isTextBased() ||
                !channel.isSendable()
            ) {
                console.warn(
                    `[LEVEL] Seviye duyuru kanalı bulunamadı veya mesaj gönderilemiyor: ${channelId}`
                );
                return;
            }

            const neededXP = requiredXP(data.level);

            // Seviye kartını oluştur
            const imageBuffer = await createLevelImage(
                message.author,
                oldLevel,
                data.level,
                data.xp,
                neededXP,
                gainedXP
            );

            const attachment = new AttachmentBuilder(
                imageBuffer,
                {
                    name: "double-anime-level-up.png"
                }
            );

            const embed = new EmbedBuilder()
                .setColor("#c084fc")
                .setTitle("✨ Seviye Atladın!")
                .setDescription(
                    `${message.author} tebrikler! **${data.level}. seviyeye** ulaştın.`
                )
                .addFields(
                    {
                        name: "Önceki Seviye",
                        value: `**${oldLevel}**`,
                        inline: true
                    },
                    {
                        name: "Yeni Seviye",
                        value: `**${data.level}**`,
                        inline: true
                    },
                    {
                        name: "Kazanılan XP",
                        value: `**+${gainedXP} XP**`,
                        inline: true
                    }
                )
                .setImage(
                    "attachment://double-anime-level-up.png"
                )
                .setFooter({
                    text: "DOUBLE.ANIME • Seviye Sistemi"
                })
                .setTimestamp();

            await channel.send({
                content: `${message.author}`,
                embeds: [embed],
                files: [attachment],
                allowedMentions: {
                    users: [message.author.id]
                }
            });

            console.log(
                `[LEVEL] Seviye görseli ${channel.name} kanalına gönderildi.`
            );
        } catch (error) {
            console.error(
                "[LEVEL SİSTEMİ HATASI]",
                error
            );
        }
    }
};

