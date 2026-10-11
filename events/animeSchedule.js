
const { Events, PermissionFlagsBits } = require("discord.js");
const store = require("../lib/store");

const INTERVAL = 15 * 60 * 1000;
const LOOKAHEAD = 3 * 60 * 60;
const API_URL = "https://graphql.anilist.co";

let running = false;
let checking = false;

async function getUpcomingEpisodes() {
    const now = Math.floor(Date.now() / 1000);
    const end = now + LOOKAHEAD;

    const query = `
        query ($start: Int, $end: Int) {
            Page(page: 1, perPage: 50) {
                airingSchedules(
                    airingAt_greater: $start
                    airingAt_lesser: $end
                    sort: TIME
                ) {
                    id
                    airingAt
                    episode
                    media {
                        id
                        title {
                            romaji
                            english
                        }
                        coverImage {
                            large
                        }
                        siteUrl
                    }
                }
            }
        }
    `;

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            query,
            variables: { start: now, end }
        }),
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        throw new Error(`AniList HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.errors?.length) {
        throw new Error(json.errors[0].message);
    }

    return json.data?.Page?.airingSchedules || [];
}

function makeEmbed(episode) {
    const media = episode.media;
    const title =
        media.title.english ||
        media.title.romaji ||
        "Bilinmeyen anime";

    const date = new Date(episode.airingAt * 1000);

    const embed = new (require("discord.js").EmbedBuilder)()
        .setColor(0xff63d4)
        .setTitle(`🌸 ${title}`)
        .setDescription(
            `Yeni bölüm yayın takvimine göre yaklaşıyor!\n\n` +
            `🎬 **Bölüm:** ${episode.episode}\n` +
            `📅 **Yayın zamanı:** <t:${episode.airingAt}:F>\n` +
            `⏳ **Geri sayım:** <t:${episode.airingAt}:R>`
        )
        .setFooter({
            text: "DOUBLE.ANIME • Anime Yayın Takvimi"
        })
        .setTimestamp(date);

    if (media.coverImage?.large) {
        embed.setThumbnail(media.coverImage.large);
    }

    if (media.siteUrl) {
        embed.setURL(media.siteUrl);
    }

    return embed;
}

async function checkSchedule(client) {
    // Önceki kontrol bitmeden yenisini başlatma.
    if (checking) return;
    checking = true;

    try {
        const settings = store.read("anime-schedule-settings.json", {});
        const seen = store.read("anime-schedule-seen.json", {});
        const guilds = Object.entries(settings).filter(
            ([, config]) => config.enabled && config.channelId
        );

        if (!guilds.length) return;

        const episodes = await getUpcomingEpisodes();

        for (const [guildId, config] of guilds) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;

            const channel = await guild.channels
                .fetch(config.channelId)
                .catch(() => null);

            if (!channel?.isTextBased() || !channel.send) continue;

            const botMember = guild.members.me;

            if (
                !botMember ||
                !channel.permissionsFor(botMember)?.has([
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks
                ])
            ) {
                console.warn(
                    `[ANIME TAKVİMİ] ${guild.name}: Kanal izinleri eksik.`
                );
                continue;
            }

            seen[guildId] ||= {};

            for (const episode of episodes) {
                // AniList schedule ID'si bölüm için benzersiz anahtar.
                const id = String(episode.id);

                if (seen[guildId][id]) continue;

                /*
                 * Önce "işleniyor" kaydı yazılır.
                 * Böylece aynı süreçte yeniden kontrol edilirse
                 * aynı bölüm tekrar kuyruğa alınmaz.
                 */
                seen[guildId][id] = {
                    status: "pending",
                    timestamp: Date.now()
                };

                store.write("anime-schedule-seen.json", seen);

                try {
                    await channel.send({
                        embeds: [makeEmbed(episode)],
                        allowedMentions: { parse: [] }
                    });

                    seen[guildId][id] = {
                        status: "sent",
                        timestamp: Date.now()
                    };

                    store.write("anime-schedule-seen.json", seen);

                    console.log(
                        `[ANIME TAKVİMİ] Gönderildi: ${episode.media.title.english || episode.media.title.romaji} - ${episode.episode}. bölüm`
                    );
                } catch (error) {
                    /*
                     * Gönderimin başarısız olduğu kesin ise yeniden
                     * denenebilmesi için kaydı kaldır.
                     * Ağ hatasında Discord mesajı kabul etmiş olabilir;
                     * bu nedenle mutlak sıfır tekrar garantisi mümkün değildir.
                     */
                    console.error(
                        "[ANIME TAKVİMİ] Duyuru gönderilemedi:",
                        error.message
                    );

                    // Tekrar deneme yerine mükerrer mesajı önlemek için
                    // kaydı koru. Gerekirse başarısız kayıt elle temizlenebilir.
                }
            }

            // Son 1000 kaydı koru.
            const entries = Object.entries(seen[guildId])
                .sort((a, b) => {
                    const aTime = a[1]?.timestamp ?? a[1] ?? 0;
                    const bTime = b[1]?.timestamp ?? b[1] ?? 0;
                    return bTime - aTime;
                })
                .slice(0, 1000);

            seen[guildId] = Object.fromEntries(entries);
            store.write("anime-schedule-seen.json", seen);
        }
    } finally {
        checking = false;
    }
}

module.exports = {
    name: Events.ClientReady,
    once: true,

    async execute(client) {
        if (running) return;
        running = true;

        const run = async () => {
            try {
                await checkSchedule(client);
            } catch (error) {
                console.error(
                    "[ANIME TAKVİMİ] Kontrol hatası:",
                    error.message
                );
            }
        };

        await run();
        setInterval(run, INTERVAL);
    }
};

