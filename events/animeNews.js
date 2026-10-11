
const { Events, EmbedBuilder, PermissionsBitField } = require("discord.js");
const Parser = require("rss-parser");
const fs = require("fs");
const path = require("path");

// ======================================================
// DOUBLE.ANIME • ADVANCED NEWS SYSTEM
// ======================================================

const parser = new Parser({
    timeout: 25000,
    headers: {
        "User-Agent": "DOUBLE.ANIME Discord Bot/2.0"
    },
    customFields: {
        item: [
            ["media:content", "media:content"],
            ["media:thumbnail", "media:thumbnail"]
        ]
    }
});

const dataFolder = path.join(__dirname, "..", "data");

const settingsPath = path.join(
    dataFolder,
    "anime-news-settings.json"
);

const seenPath = path.join(
    dataFolder,
    "anime-news.json"
);

const RSS_URL =
    "https://news.google.com/rss/search?q=anime&hl=tr&gl=TR&ceid=TR:tr";

const CHECK_INTERVAL = 15 * 60 * 1000;
const MAX_SEEN = 500;
const MAX_RSS_ITEMS = 50;

let checkRunning = false;
let intervalStarted = false;

// ======================================================
// DOSYA SİSTEMİ
// ======================================================

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

function readJson(file, fallback = {}) {
    try {
        if (!fs.existsSync(file)) return fallback;

        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch (error) {
        console.error(
            `[DOUBLE.ANIME] JSON okunamadı (${path.basename(file)}):`,
            error.message
        );

        return fallback;
    }
}

function saveJson(file, data) {
    const tempFile = `${file}.tmp`;

    try {
        fs.writeFileSync(
            tempFile,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        fs.renameSync(tempFile, file);
    } catch (error) {
        console.error(
            `[DOUBLE.ANIME] JSON kaydedilemedi (${path.basename(file)}):`,
            error.message
        );

        try {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        } catch {}

        throw error;
    }
}

// ======================================================
// METİN VE HABER YARDIMCILARI
// ======================================================

function cleanText(value = "") {
    return String(value)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#(\d+);/g, (_, n) =>
            String.fromCodePoint(Number(n))
        )
        .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
            String.fromCodePoint(parseInt(n, 16))
        )
        .replace(/\s+/g, " ")
        .trim();
}

function getTitle(item) {
    return cleanText(item.title || "Anime haberi")
        .replace(/\s+-\s+[^-]+$/, "")
        .trim()
        .slice(0, 256) || "Anime haberi";
}

function getSource(item) {
    if (item.source?.title) {
        return cleanText(item.source.title).slice(0, 200);
    }

    const match = String(item.title || "")
        .match(/\s+-\s+([^-]+)$/);

    return match
        ? cleanText(match[1]).slice(0, 200)
        : "Google News";
}

function normalizeTitle(value = "") {
    return cleanText(value)
        .toLocaleLowerCase("tr-TR")
        .replace(/\s+-\s+[^-]+$/, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

function getNewsId(item) {
    return String(
        item.guid ||
        item.id ||
        item.link ||
        item.title ||
        ""
    ).trim();
}

function getNewsKeys(item) {
    const keys = [];
    const id = getNewsId(item);
    const title = normalizeTitle(getTitle(item));

    if (id) keys.push(id);

    if (item.link) {
        keys.push(`url:${String(item.link).trim()}`);
    }

    if (title) {
        keys.push(`title:${title}`);
    }

    return [...new Set(keys)];
}

function getDescription(item) {
    const raw =
        item.contentSnippet ||
        item.summary ||
        item.description ||
        item.content ||
        "";

    const description = cleanText(raw);

    if (!description) {
        return "Haberi ayrıntılarıyla okumak için aşağıdaki bağlantıyı kullan.";
    }

    return description.length > 900
        ? `${description.slice(0, 897)}...`
        : description;
}

function isValidHttpUrl(value) {
    try {
        const url = new URL(value);

        return (
            url.protocol === "https:" ||
            url.protocol === "http:"
        );
    } catch {
        return false;
    }
}

// ======================================================
// HABER GÖRSELİ
// ======================================================

function getImageUrl(item) {
    const mediaContent = Array.isArray(item["media:content"])
        ? item["media:content"][0]
        : item["media:content"];

    const mediaThumbnail = Array.isArray(item["media:thumbnail"])
        ? item["media:thumbnail"][0]
        : item["media:thumbnail"];

    const candidates = [
        item.enclosure?.url,
        item.image?.url,
        item.itunes?.image,
        mediaContent?.url,
        mediaContent?.$?.url,
        mediaThumbnail?.url,
        mediaThumbnail?.$?.url
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && isValidHttpUrl(candidate)) {
            return candidate;
        }
    }

    // RSS açıklamasında HTML görseli varsa bul.
    const html = String(
        item.content ||
        item.description ||
        item["content:encoded"] ||
        ""
    );

    const imageMatch = html.match(
        /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i
    );

    if (imageMatch && isValidHttpUrl(imageMatch[1])) {
        return imageMatch[1];
    }

    return null;
}

// ======================================================
// HABER EMBEDİ
// ======================================================

function createEmbed(item) {
    const url = item.link;
    const imageUrl = getImageUrl(item);

    const publishedDate =
        item.isoDate && !Number.isNaN(Date.parse(item.isoDate))
            ? new Date(item.isoDate)
            : item.pubDate && !Number.isNaN(Date.parse(item.pubDate))
                ? new Date(item.pubDate)
                : new Date();

    const embed = new EmbedBuilder()
        .setColor(0xB3132B)
        .setAuthor({
            name: "DOUBLE.ANIME • Anime Haberleri"
        })
        .setTitle(getTitle(item))
        .setDescription(
            `${getDescription(item)}\n\n` +
            `**[Haberi oku →](${url})**`
        )
        .addFields(
            {
                name: "📰 Kaynak",
                value: getSource(item) || "Bilinmiyor",
                inline: true
            },
            {
                name: "📅 Yayın tarihi",
                value: `<t:${Math.floor(publishedDate.getTime() / 1000)}:R>`,
                inline: true
            }
        )
        .setFooter({
            text: "DOUBLE.ANIME • Otomatik Anime Haberleri"
        })
        .setTimestamp(publishedDate);

    if (imageUrl) {
        embed.setImage(imageUrl);
    }

    if (url) {
        embed.setURL(url);
    }

    return embed;
}

// ======================================================
// HABER KONTROLÜ
// ======================================================

async function checkAnimeNews(client) {
    if (checkRunning) {
        console.log("[Anime Haber] Önceki kontrol hâlâ devam ediyor.");
        return;
    }

    checkRunning = true;

    try {
        const settings = readJson(settingsPath, {});
        const seenData = readJson(seenPath, {});

        const activeGuilds = Object.entries(settings).filter(
            ([, config]) => config?.enabled && config?.channelId
        );

        if (!activeGuilds.length) {
            console.log(
                "[Anime Haber] Aktif haber sistemi bulunamadı. " +
                "animehaber komutuyla kanal ve sistemi kontrol et."
            );
            return;
        }

        console.log(
            `[Anime Haber] RSS kontrol ediliyor. Aktif sunucu: ${activeGuilds.length}`
        );

        let feed;

        try {
            feed = await parser.parseURL(RSS_URL);
        } catch (error) {
            console.error(
                "[Anime Haber] RSS alınamadı:",
                error.message
            );
            return;
        }

        const items = (feed.items || [])
            .filter(item =>
                item.link &&
                item.title &&
                isValidHttpUrl(item.link)
            )
            .slice(0, MAX_RSS_ITEMS);

        if (!items.length) {
            console.warn("[Anime Haber] RSS kaynağında haber bulunamadı.");
            return;
        }

        console.log(
            `[Anime Haber] RSS başarılı: ${items.length} haber alındı.`
        );

        for (const [guildId, config] of activeGuilds) {
            try {
                const guild = client.guilds.cache.get(guildId);

                if (!guild) {
                    console.warn(
                        `[Anime Haber] Bot ${guildId} sunucusunda bulunamadı.`
                    );
                    continue;
                }

                const channel = await guild.channels
                    .fetch(config.channelId)
                    .catch(() => null);

                if (
                    !channel ||
                    !channel.isTextBased() ||
                    !channel.isSendable()
                ) {
                    console.warn(
                        `[Anime Haber] ${guild.name}: Kanal bulunamadı veya mesaj gönderilemiyor.`
                    );
                    continue;
                }

                // İlk çalıştırmada eski haberleri kaydet,
                // eski haberleri topluca paylaşma.
                if (!Array.isArray(seenData[guildId])) {
                    const initialKeys = [];

                    for (const item of items) {
                        initialKeys.push(...getNewsKeys(item));
                    }

                    seenData[guildId] = [
                        ...new Set(initialKeys)
                    ].slice(-MAX_SEEN * 3);

                    saveJson(seenPath, seenData);

                    console.log(
                        `[Anime Haber] ${guild.name}: ` +
                        `İlk kayıt tamamlandı (${items.length} haber). ` +
                        "Yeni haber bekleniyor."
                    );

                    continue;
                }

                const known = seenData[guildId];
                const knownSet = new Set(known);

                // En yeni ve daha önce görülmemiş haberi bul.
                const selectedItem = items.find(item => {
                    return !getNewsKeys(item).some(key =>
                        knownSet.has(key)
                    );
                });

                if (!selectedItem) {
                    console.log(
                        `[Anime Haber] ${guild.name}: Yeni haber yok.`
                    );
                    continue;
                }

                // Botun kanal izinlerini kontrol et.
                const botMember = guild.members.me;

                if (
                    botMember &&
                    !channel.permissionsFor(botMember)?.has(
                        [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.EmbedLinks
                        ]
                    )
                ) {
                    console.error(
                        `[Anime Haber] ${guild.name}: ` +
                        "Kanalda Görüntüle, Mesaj Gönder ve Bağlantı Yerleştir izinleri eksik."
                    );
                    continue;
                }

                const roleId = config.roleId || null;
                let roleExists = false;

                if (roleId) {
                    roleExists = Boolean(
                        await guild.roles.fetch(roleId).catch(() => null)
                    );
                }

                const content = roleExists
                    ? `<@&${roleId}> 📰 Yeni anime haberi!`
                    : "📰 Yeni anime haberi!";

                // Gönderim başarısız olursa haberi görülmüş sayma.
                await channel.send({
                    content,
                    embeds: [createEmbed(selectedItem)],
                    allowedMentions: {
                        parse: [],
                        roles: roleExists ? [roleId] : []
                    }
                });

                // Gönderim başarılı olduktan sonra tüm anahtarları kaydet.
                const updated = [
                    ...known,
                    ...getNewsKeys(selectedItem)
                ];

                seenData[guildId] = [
                    ...new Set(updated)
                ].slice(-MAX_SEEN * 3);

                saveJson(seenPath, seenData);

                console.log(
                    `[Anime Haber] ${guild.name}: Haber gönderildi: ` +
                    getTitle(selectedItem)
                );
            } catch (error) {
                console.error(
                    `[Anime Haber] Sunucu hatası (${guildId}):`,
                    error
                );
            }
        }
    } catch (error) {
        console.error("[Anime Haber] Kontrol hatası:", error);
    } finally {
        checkRunning = false;
    }
}

// ======================================================
// EVENT
// ======================================================

module.exports = {
    name: Events.ClientReady,
    once: true,

    async execute(client) {
        if (intervalStarted) return;
        intervalStarted = true;

        console.log(
            "[DOUBLE.ANIME] Haber sistemi başlatıldı. Kontrol aralığı: 5 dakika."
        );

        // İlk kontrol
        await checkAnimeNews(client);

        // Sonraki kontroller
        setInterval(() => {
            checkAnimeNews(client);
        }, CHECK_INTERVAL);
    }
};