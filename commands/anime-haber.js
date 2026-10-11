
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const dataFolder = path.join(__dirname, "..", "data");
const settingsPath = path.join(
    dataFolder,
    "anime-news-settings.json"
);

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

function readSettings() {
    try {
        return JSON.parse(
            fs.readFileSync(settingsPath, "utf8")
        );
    } catch {
        return {};
    }
}

function saveSettings(data) {
    fs.writeFileSync(
        settingsPath,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("animehaber")
        .setDescription("Anime haber sistemini yönet.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .addSubcommand(sub =>
            sub.setName("kanal")
                .setDescription("Haber kanalını ayarla.")
                .addChannelOption(option =>
                    option.setName("kanal")
                        .setDescription("Haberlerin gönderileceği kanal.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("rol")
                .setDescription("Haberlerde etiketlenecek rolü ayarla.")
                .addRoleOption(option =>
                    option.setName("rol")
                        .setDescription("Etiketlenecek rol.")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("rol-sifirla")
                .setDescription("Haber rolü etiketlemesini kapat.")
        )
        .addSubcommand(sub =>
            sub.setName("aç")
                .setDescription("Otomatik anime haberlerini aç.")
        )
        .addSubcommand(sub =>
            sub.setName("kapat")
                .setDescription("Otomatik anime haberlerini kapat.")
        )
        .addSubcommand(sub =>
            sub.setName("durum")
                .setDescription("Anime haber sistemi ayarlarını göster.")
        ),

    async execute(interaction) {
        const guildId = interaction.guildId;

        if (!guildId) {
            return interaction.reply({
                content: "Bu komut yalnızca sunucuda kullanılabilir.",
                ephemeral: true
            });
        }

        const settings = readSettings();

        if (!settings[guildId]) {
            settings[guildId] = {
                enabled: false,
                channelId: null,
                roleId: null
            };
        }

        const config = settings[guildId];
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "kanal") {
            const channel = interaction.options.getChannel("kanal");

            config.channelId = channel.id;
            saveSettings(settings);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x111111)
                        .setTitle("📰 Anime Haber Kanalı")
                        .setDescription(
                            `Haber kanalı ${channel} olarak ayarlandı.\n\n` +
                            "Yeni haberler bu kanala gönderilecek."
                        )
                        .setFooter({
                            text: "DOUBLE.ANIME • Ayar Sistemi"
                        })
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }

        if (subcommand === "rol") {
            const role = interaction.options.getRole("rol");

            config.roleId = role.id;
            saveSettings(settings);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x111111)
                        .setTitle("🏷️ Anime Haber Rolü")
                        .setDescription(
                            `Etiketlenecek rol: ${role}\n\n` +
                            "Her yeni haber gönderildiğinde bu rol etiketlenecek."
                        )
                        .setFooter({
                            text: "DOUBLE.ANIME • Ayar Sistemi"
                        })
                        .setTimestamp()
                ],
                allowedMentions: {
                    parse: [],
                    roles: []
                },
                ephemeral: true
            });
        }

        if (subcommand === "rol-sifirla") {
            config.roleId = null;
            saveSettings(settings);

            return interaction.reply({
                content: "✅ Anime haberlerinde rol etiketlemesi kapatıldı.",
                ephemeral: true
            });
        }

        if (subcommand === "aç") {
            if (!config.channelId) {
                return interaction.reply({
                    content:
                        "Önce `/animehaber kanal` komutuyla haber kanalını ayarlamalısın.",
                    ephemeral: true
                });
            }

            config.enabled = true;
            saveSettings(settings);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x111111)
                        .setTitle("✅ Anime Haber Sistemi Açıldı")
                        .setDescription(
                            `**Kanal:** <#${config.channelId}>\n` +
                            `**Rol:** ${
                                config.roleId
                                    ? `<@&${config.roleId}>`
                                    : "Etiketleme kapalı"
                            }\n` +
                            "**Kontrol aralığı:** 15 dakika\n" +
                            "**Her kontrolde:** En fazla 1 haber"
                        )
                        .setFooter({
                            text: "DOUBLE.ANIME"
                        })
                        .setTimestamp()
                ],
                allowedMentions: { parse: [] },
                ephemeral: true
            });
        }

        if (subcommand === "kapat") {
            config.enabled = false;
            saveSettings(settings);

            return interaction.reply({
                content: "⏸️ Otomatik anime haberleri kapatıldı.",
                ephemeral: true
            });
        }

        if (subcommand === "durum") {
            const embed = new EmbedBuilder()
                .setColor(0x111111)
                .setTitle("📰 DOUBLE.ANIME • Haber Ayarları")
                .addFields(
                    {
                        name: "Durum",
                        value: config.enabled ? "🟢 Açık" : "🔴 Kapalı",
                        inline: true
                    },
                    {
                        name: "Kontrol aralığı",
                        value: "5 dakika",
                        inline: true
                    },
                    {
                        name: "Gönderim sınırı",
                        value: "Kontrol başına 1 haber",
                        inline: true
                    },
                    {
                        name: "Haber kanalı",
                        value: config.channelId
                            ? `<#${config.channelId}>`
                            : "Ayarlanmamış",
                        inline: true
                    },
                    {
                        name: "Etiketlenecek rol",
                        value: config.roleId
                            ? `<@&${config.roleId}>`
                            : "Ayarlanmamış",
                        inline: true
                    }
                )
                .setFooter({
                    text: "DOUBLE.ANIME • Anime Haber Sistemi"
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed],
                allowedMentions: { parse: [] },
                ephemeral: true
            });
        }
    }
};