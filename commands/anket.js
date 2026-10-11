
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dataFolder = path.join(__dirname, "..", "data");
const pollsPath = path.join(dataFolder, "anime-polls.json");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

function readPolls() {
    try {
        if (!fs.existsSync(pollsPath)) return {};

        const data = JSON.parse(
            fs.readFileSync(pollsPath, "utf8")
        );

        return data && typeof data === "object" && !Array.isArray(data)
            ? data
            : {};
    } catch (error) {
        console.error("[Anime Anket] Veri okunamadı:", error);
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

    const description = poll.options.map((option, index) => {
        const count = Object.values(poll.votes)
            .filter(vote => vote === index)
            .length;

        const percentage = totalVotes
            ? Math.round((count / totalVotes) * 100)
            : 0;

        const barLength = Math.round(percentage / 10);
        const bar =
            "🟥".repeat(barLength) +
            "⬛".repeat(10 - barLength);

        return (
            `**${index + 1}. ${option}**\n` +
            `${bar}\n` +
            `**${count} oy** • %${percentage}`
        );
    }).join("\n\n");

    const embed = new EmbedBuilder()
        .setColor(0xB3132B)
        .setAuthor({
            name: "DOUBLE.ANIME • Anime Anketi"
        })
        .setTitle(poll.question)
        .setDescription(
            `${description}\n\n` +
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
            value: "Bu anket sona erdi.",
            inline: false
        });
    } else {
        embed.addFields({
            name: "⏰ Bitiş",
            value: `<t:${Math.floor(poll.expiresAt / 1000)}:R>`,
            inline: true
        });
    }

    return embed;
}

function createPollComponents(poll) {
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

    const optionRow = new ActionRowBuilder();

    poll.options.forEach((option, index) => {
        optionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`animepoll_vote:${poll.id}:${index}`)
                .setLabel(option.slice(0, 80))
                .setStyle(ButtonStyle.Primary)
                .setEmoji(["🎌", "🔥", "⭐", "🌸", "⚔️"][index])
        );
    });

    return [
        optionRow,
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`animepoll_end:${poll.id}`)
                .setLabel("Anketi Bitir")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("animeanket")
        .setDescription("DOUBLE.ANIME anime anketi oluşturur.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )

        // Zorunlu seçenekler önce tanımlanmalı.
        .addStringOption(option =>
            option
                .setName("soru")
                .setDescription("Anket sorusu")
                .setRequired(true)
                .setMaxLength(200)
        )
        .addStringOption(option =>
            option
                .setName("secenek1")
                .setDescription("Birinci seçenek")
                .setRequired(true)
                .setMaxLength(80)
        )
        .addStringOption(option =>
            option
                .setName("secenek2")
                .setDescription("İkinci seçenek")
                .setRequired(true)
                .setMaxLength(80)
        )
        .addIntegerOption(option =>
            option
                .setName("sure")
                .setDescription("Anket süresi (dakika, 1-10080)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10080)
        )

        // İsteğe bağlı seçenekler en sonda.
        .addStringOption(option =>
            option
                .setName("secenek3")
                .setDescription("Üçüncü seçenek (isteğe bağlı)")
                .setRequired(false)
                .setMaxLength(80)
        )
        .addStringOption(option =>
            option
                .setName("secenek4")
                .setDescription("Dördüncü seçenek (isteğe bağlı)")
                .setRequired(false)
                .setMaxLength(80)
        )
        .addStringOption(option =>
            option
                .setName("secenek5")
                .setDescription("Beşinci seçenek (isteğe bağlı)")
                .setRequired(false)
                .setMaxLength(80)
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: "Bu komut yalnızca sunucularda kullanılabilir.",
                flags: MessageFlags.Ephemeral
            });
        }

        const question = interaction.options
            .getString("soru", true)
            .trim();

        const optionNames = [
            interaction.options.getString("secenek1", true),
            interaction.options.getString("secenek2", true),
            interaction.options.getString("secenek3"),
            interaction.options.getString("secenek4"),
            interaction.options.getString("secenek5")
        ]
            .filter(value => value !== null)
            .map(value => value.trim());

        if (!question || optionNames.some(value => !value)) {
            return interaction.reply({
                content: "❌ Soru ve seçenekler boş bırakılamaz.",
                flags: MessageFlags.Ephemeral
            });
        }

        if (
            new Set(
                optionNames.map(value =>
                    value.toLocaleLowerCase("tr-TR")
                )
            ).size !== optionNames.length
        ) {
            return interaction.reply({
                content: "❌ Aynı seçeneği birden fazla kez ekleyemezsin.",
                flags: MessageFlags.Ephemeral
            });
        }

        const duration = interaction.options.getInteger("sure", true);
        const now = Date.now();

        const poll = {
            id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            messageId: null,
            creatorId: interaction.user.id,
            question,
            options: optionNames,
            votes: {},
            createdAt: now,
            expiresAt: now + duration * 60 * 1000,
            ended: false
        };

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        const polls = readPolls();

        try {
            const message = await interaction.channel.send({
                embeds: [createPollEmbed(poll)],
                components: createPollComponents(poll),
                allowedMentions: { parse: [] }
            });

            poll.messageId = message.id;
            polls[poll.id] = poll;
            savePolls(polls);

            return interaction.editReply({
                content: "✅ Anime anketi başarıyla oluşturuldu!"
            });
        } catch (error) {
            console.error("[Anime Anket] Oluşturma hatası:", error);

            return interaction.editReply({
                content:
                    "❌ Anket oluşturulamadı. Botun mesaj gönderme ve embed izinlerini kontrol et."
            }).catch(() => {});
        }
    }
};

