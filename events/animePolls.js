
const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const pollsPath = path.join(
    __dirname,
    "..",
    "data",
    "anime-polls.json"
);

function readPolls() {
    try {
        if (!fs.existsSync(pollsPath)) return {};

        return JSON.parse(
            fs.readFileSync(pollsPath, "utf8")
        );
    } catch (error) {
        console.error("[Anime Anket] JSON okuma hatası:", error);
        return {};
    }
}

function savePolls(data) {
    const tempPath = `${pollsPath}.tmp`;

    fs.writeFileSync(
        tempPath,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    fs.renameSync(tempPath, pollsPath);
}

function createPollEmbed(poll) {
    const totalVotes = Object.keys(poll.votes).length;

    const results = poll.options.map((option, index) => {
        const count = Object.values(poll.votes)
            .filter(vote => vote === index)
            .length;

        const percentage = totalVotes
            ? Math.round(count / totalVotes * 100)
            : 0;

        const barLength = Math.round(percentage / 10);

        return (
            `**${index + 1}. ${option}**\n` +
            `${"🟥".repeat(barLength)}${"⬛".repeat(10 - barLength)}\n` +
            `**${count} oy** • %${percentage}`
        );
    }).join("\n\n");

    const embed = new EmbedBuilder()
        .setColor(0xB3132B)
        .setAuthor({ name: "DOUBLE.ANIME • Anime Anketi" })
        .setTitle(poll.question)
        .setDescription(
            `${results}\n\n` +
            `**Toplam oy:** ${totalVotes}\n` +
            `**Anketi başlatan:** <@${poll.creatorId}>`
        )
        .setFooter({
            text: poll.ended
                ? "DOUBLE.ANIME • Anket sona erdi"
                : "DOUBLE.ANIME • Oy vermek için butonları kullan"
        })
        .setTimestamp(new Date(poll.createdAt));

    if (poll.ended) {
        embed.addFields({
            name: "📊 Durum",
            value: "Bu anket sona erdi."
        });
    } else {
        embed.addFields({
            name: "⏰ Bitiş",
            value: `<t:${Math.floor(poll.expiresAt / 1000)}:R>`
        });
    }

    return embed;
}

function createComponents(poll) {
    if (poll.ended) {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`animepoll_closed:${poll.id}`)
                    .setLabel("Anket sona erdi")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            )
        ];
    }

    const row = new ActionRowBuilder();

    poll.options.forEach((option, index) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`animepoll_vote:${poll.id}:${index}`)
                .setLabel(option.slice(0, 80))
                .setStyle(ButtonStyle.Primary)
                .setEmoji(["🎌", "🔥", "⭐", "🌸", "⚔️"][index])
        );
    });

    const endRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`animepoll_end:${poll.id}`)
            .setLabel("Anketi Bitir")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger)
    );

    return [row, endRow];
}

async function updatePollMessage(client, poll) {
    try {
        const guild = client.guilds.cache.get(poll.guildId);

        if (!guild) return;

        const channel = await guild.channels
            .fetch(poll.channelId)
            .catch(() => null);

        if (!channel?.isTextBased() || !channel.isSendable()) return;

        const message = await channel.messages
            .fetch(poll.messageId)
            .catch(() => null);

        if (!message) return;

        await message.edit({
            embeds: [createPollEmbed(poll)],
            components: createComponents(poll),
            allowedMentions: { parse: [] }
        });
    } catch (error) {
        console.error("[Anime Anket] Mesaj güncellenemedi:", error.message);
    }
}

async function closeExpiredPolls(client) {
    const polls = readPolls();
    let changed = false;

    for (const poll of Object.values(polls)) {
        if (
            !poll ||
            poll.ended ||
            !poll.messageId ||
            Date.now() < poll.expiresAt
        ) {
            continue;
        }

        poll.ended = true;
        poll.endedAt = Date.now();
        changed = true;

        await updatePollMessage(client, poll);

        console.log(
            `[Anime Anket] Süresi doldu: ${poll.question}`
        );
    }

    if (changed) savePolls(polls);
}

module.exports = {
    name: Events.ClientReady,
    once: true,

    async execute(client) {
        console.log("[Anime Anket] Buton ve otomatik kapanma sistemi aktif.");

        // Bot yeniden başlarsa süresi geçmiş anketleri de kapat.
        await closeExpiredPolls(client);

        setInterval(() => {
            closeExpiredPolls(client);
        }, 30 * 1000);

        client.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isButton()) return;

            const parts = interaction.customId.split(":");
            const action = parts[0];
            const pollId = parts[1];

            if (
                !["animepoll_vote", "animepoll_end"].includes(action)
            ) {
                return;
            }

            const polls = readPolls();
            const poll = polls[pollId];

            if (!poll) {
                return interaction.reply({
                    content: "Bu anket bulunamadı veya kaydı silinmiş.",
                    ephemeral: true
                }).catch(() => {});
            }

            if (
                interaction.guildId !== poll.guildId ||
                interaction.channelId !== poll.channelId ||
                interaction.message.id !== poll.messageId
            ) {
                return interaction.reply({
                    content: "Bu anketin bulunduğu mesaj geçersiz.",
                    ephemeral: true
                }).catch(() => {});
            }

            if (poll.ended || Date.now() >= poll.expiresAt) {
                if (!poll.ended) {
                    poll.ended = true;
                    poll.endedAt = Date.now();
                    savePolls(polls);

                    await updatePollMessage(client, poll);
                }

                return interaction.reply({
                    content: "⏰ Bu anket sona ermiş.",
                    ephemeral: true
                }).catch(() => {});
            }

            if (action === "animepoll_vote") {
                const optionIndex = Number(parts[2]);

                if (
                    !Number.isInteger(optionIndex) ||
                    optionIndex < 0 ||
                    optionIndex >= poll.options.length
                ) {
                    return interaction.reply({
                        content: "Bu anket seçeneği geçersiz.",
                        ephemeral: true
                    });
                }

                const previousVote = poll.votes[interaction.user.id];

                // Aynı seçeneğe yeniden basarsa oyu kaldır.
                if (previousVote === optionIndex) {
                    delete poll.votes[interaction.user.id];
                } else {
                    // Başka seçeneğe basarsa oyunu değiştir.
                    poll.votes[interaction.user.id] = optionIndex;
                }

                try {
                    savePolls(polls);

                    await interaction.update({
                        embeds: [createPollEmbed(poll)],
                        components: createComponents(poll),
                        allowedMentions: { parse: [] }
                    });
                } catch (error) {
                    console.error("[Anime Anket] Oy işleme hatası:", error);

                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: "Oy işlenirken bir hata oluştu.",
                            ephemeral: true
                        }).catch(() => {});
                    }
                }

                return;
            }

            if (action === "animepoll_end") {
                const isCreator = interaction.user.id === poll.creatorId;

                const isManager = interaction.memberPermissions?.has(
                    PermissionFlagsBits.ManageGuild
                );

                if (!isCreator && !isManager) {
                    return interaction.reply({
                        content: "Anketi yalnızca oluşturan kişi veya sunucu yöneticisi bitirebilir.",
                        ephemeral: true
                    });
                }

                poll.ended = true;
                poll.endedAt = Date.now();

                try {
                    savePolls(polls);

                    await interaction.update({
                        embeds: [createPollEmbed(poll)],
                        components: createComponents(poll),
                        allowedMentions: { parse: [] }
                    });

                    console.log(
                        `[Anime Anket] Manuel kapatıldı: ${poll.question}`
                    );
                } catch (error) {
                    console.error("[Anime Anket] Kapatma hatası:", error);
                }
            }
        });
    }
};