
const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const https = require("https");

function fetchAnime(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: {
                "User-Agent": "DOUBLE.ANIME/1.0"
            },
            timeout: 12000
        }, response => {
            let data = "";

            response.setEncoding("utf8");

            response.on("data", chunk => {
                data += chunk;
            });

            response.on("end", () => {
                if (response.statusCode !== 200) {
                    return reject(
                        new Error(`API yanıt kodu: ${response.statusCode}`)
                    );
                }

                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error("API yanıtı okunamadı."));
                }
            });
        });

        request.on("error", reject);

        request.on("timeout", () => {
            request.destroy(new Error("İstek zaman aşımına uğradı."));
        });
    });
}

function clean(text, max = 1000) {
    if (!text) return "Bilgi bulunmuyor.";

    const value = String(text)
        .replace(/\r/g, "")
        .trim();

    return value.length > max
        ? value.slice(0, max - 3) + "..."
        : value;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("anime-ara")
        .setDescription("Anime arar ve ayrıntılı bilgilerini gösterir.")
        .addStringOption(option =>
            option
                .setName("isim")
                .setDescription("Aramak istediğin anime")
                .setMinLength(1)
                .setMaxLength(100)
                .setRequired(true)
        ),

    async execute(interaction) {
        const query = interaction.options.getString("isim", true).trim();

        await interaction.deferReply();

        try {
            const url = new URL("https://api.jikan.moe/v4/anime");
            url.searchParams.set("q", query);
            url.searchParams.set("limit", "5");
            url.searchParams.set("sfw", "true");

            const result = await fetchAnime(url);

            if (!result.data?.length) {
                return interaction.editReply({
                    content: `🔎 **${query}** için anime bulunamadı. Farklı bir isim deneyebilirsin.`
                });
            }

            const anime = result.data[0];

            const title =
                anime.title_english ||
                anime.title ||
                query;

            const genres = anime.genres?.length
                ? anime.genres.map(genre => genre.name).join(" • ")
                : "Belirtilmemiş";

            const studios = anime.studios?.length
                ? anime.studios.map(studio => studio.name).join(", ")
                : "Belirtilmemiş";

            const statusMap = {
                "Finished Airing": "Yayınlandı",
                "Currently Airing": "Yayında",
                "Not yet aired": "Henüz yayınlanmadı"
            };

            const status = statusMap[anime.status] || anime.status || "Bilinmiyor";

            const embed = new EmbedBuilder()
                .setColor(0xff63d4)
                .setAuthor({
                    name: "DOUBLE.ANIME • Anime Arama"
                })
                .setTitle(`🌸 ${clean(title, 240)}`)
                .setURL(anime.url)
                .setDescription(
                    clean(
                        anime.synopsis || "Bu anime için açıklama bulunmuyor.",
                        3500
                    )
                )
                .addFields(
                    {
                        name: "🇯🇵 Japonca Adı",
                        value: clean(anime.title_japanese, 200),
                        inline: true
                    },
                    {
                        name: "⭐ Puan",
                        value: anime.score != null
                            ? `${anime.score}/10`
                            : "Henüz puanlanmamış",
                        inline: true
                    },
                    {
                        name: "📺 Durum",
                        value: clean(status, 100),
                        inline: true
                    },
                    {
                        name: "🎞️ Bölüm Sayısı",
                        value: anime.episodes != null
                            ? String(anime.episodes)
                            : "Bilinmiyor",
                        inline: true
                    },
                    {
                        name: "📅 Yayın Yılı",
                        value: anime.year != null
                            ? String(anime.year)
                            : anime.aired?.from
                                ? anime.aired.from.slice(0, 4)
                                : "Bilinmiyor",
                        inline: true
                    },
                    {
                        name: "🎭 Türler",
                        value: clean(genres, 1000),
                        inline: false
                    },
                    {
                        name: "🏢 Stüdyo",
                        value: clean(studios, 500),
                        inline: false
                    }
                )
                .setFooter({
                    text: "Veri kaynağı: MyAnimeList • Jikan API"
                })
                .setTimestamp();

            const image =
                anime.images?.jpg?.large_image_url ||
                anime.images?.jpg?.image_url;

            if (image) {
                embed.setThumbnail(image);
            }

            if (anime.trailer?.url) {
                embed.addFields({
                    name: "▶️ Fragman",
                    value: `[Fragmanı izle](${anime.trailer.url})`,
                    inline: true
                });
            }

            return interaction.editReply({
                embeds: [embed],
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.error("[ANIME-ARA] Hata:", error);

            return interaction.editReply({
                content:
                    "❌ Anime bilgileri alınamadı. Biraz bekleyip tekrar dene; API geçici olarak istek sınırına ulaşmış olabilir."
            });
        }
    }
};

