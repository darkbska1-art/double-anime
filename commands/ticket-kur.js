
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");
const SETTINGS = path.join(DATA, "ticket-settings.json");

function readSettings() {
    fs.mkdirSync(DATA, { recursive: true });

    if (!fs.existsSync(SETTINGS)) {
        fs.writeFileSync(SETTINGS, "{}", "utf8");
    }

    try {
        return JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
    } catch {
        return {};
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ticket-kur")
        .setDescription("Premium destek panelini oluşturur.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: "Bu komut yalnızca sunucuda kullanılabilir.",
                ephemeral: true
            });
        }

        const config = readSettings()[interaction.guildId] || {};

        const embed = new EmbedBuilder()
            .setColor(config.color || 0x7567F8)
            .setAuthor({
                name: "DOUBLE.ANIME • DESTEK MERKEZİ",
                iconURL: interaction.guild.iconURL() || undefined
            })
            .setTitle(config.title || "🎫 Nasıl yardımcı olabiliriz?")
            .setDescription(
                config.description ||
                "Destek ekibimizle iletişime geçmek için aşağıdan bir kategori seç.\n\n" +
                "```ansi\n\u001b[1;35m✦ Hızlı • Güvenli • Kişiye Özel Destek\u001b[0m\n```\n" +
                "・ Her destek talebi özel bir kanalda yürütülür.\n" +
                "・ Sorununla ilgili bilgileri açılış formunda belirt.\n" +
                "・ Destek ekibimiz talebini mümkün olan en kısa sürede inceleyecektir."
            )
            .addFields(
                {
                    name: "🛡️ Gizlilik",
                    value: "Ticket kanalını yalnızca sen, yetkili ekip ve bot görebilir.",
                    inline: true
                },
                {
                    name: "⚡ Destek",
                    value: "Doğru kategoriyi seçerek işlemi hızlandırabilirsin.",
                    inline: true
                }
            )
            .setFooter({
                text: "DOUBLE.ANIME • Gelişmiş Ticket Sistemi"
            })
            .setTimestamp();

        const menu = new StringSelectMenuBuilder()
            .setCustomId("ticket:category")
            .setPlaceholder("🎫 Destek kategorisini seç...")
            .addOptions(
                {
                    label: "Genel Destek",
                    description: "Genel soru ve yardım talepleri",
                    value: "genel",
                    emoji: "💬"
                },
                {
                    label: "Teknik Destek",
                    description: "Bot, sunucu veya teknik sorunlar",
                    value: "teknik",
                    emoji: "⚙️"
                },
                {
                    label: "Şikâyet / Bildirim",
                    description: "Bir sorunu veya durumu bildirmek için",
                    value: "sikayet",
                    emoji: "🛡️"
                },
                {
                    label: "İş Birliği",
                    description: "Proje ve iş birliği talepleri",
                    value: "isbirligi",
                    emoji: "🤝"
                }
            );

        await interaction.channel.send({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(menu)
            ]
        });

        return interaction.reply({
            content: "✅ DOUBLE.ANIME destek paneli oluşturuldu.",
            ephemeral: true
        });
    }
};