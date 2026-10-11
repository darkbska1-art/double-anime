
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const dataFolder = path.join(__dirname, "..", "data");
const settingsPath = path.join(dataFolder, "welcome-settings.json");

function readSettings() {
    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder, { recursive: true });
    }

    if (!fs.existsSync(settingsPath)) {
        fs.writeFileSync(settingsPath, "{}");
    }

    try {
        return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
        return {};
    }
}

function saveSettings(settings) {
    fs.writeFileSync(
        settingsPath,
        JSON.stringify(settings, null, 2)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("hosgeldin-ayarla")
        .setDescription("Karşılama ve veda sistemini ayarlar.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub =>
            sub.setName("hosgeldin")
                .setDescription("Karşılama kanalını ayarlar.")
                .addChannelOption(option =>
                    option.setName("kanal")
                        .setDescription("Karşılama mesajlarının gönderileceği kanal.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub.setName("veda")
                .setDescription("Veda kanalını ayarlar.")
                .addChannelOption(option =>
                    option.setName("kanal")
                        .setDescription("Veda mesajlarının gönderileceği kanal.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub.setName("durum")
                .setDescription("Karşılama ve veda ayarlarını gösterir.")
        )

        .addSubcommand(sub =>
            sub.setName("kapat")
                .setDescription("Karşılama ve veda sistemini kapatır.")
                .addStringOption(option =>
                    option.setName("sistem")
                        .setDescription("Kapatılacak sistem.")
                        .setRequired(true)
                        .addChoices(
                            { name: "Karşılama", value: "welcome" },
                            { name: "Veda", value: "goodbye" },
                            { name: "İkisi de", value: "both" }
                        )
                )
        ),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const settings = readSettings();

        if (!settings[guildId]) {
            settings[guildId] = {};
        }

        const guildSettings = settings[guildId];
        const subcommand = interaction.options.getSubcommand();

        const embed = new EmbedBuilder()
            .setColor("#e879c5")
            .setTimestamp();

        if (subcommand === "hosgeldin") {
            const channel = interaction.options.getChannel("kanal");

            guildSettings.welcomeChannelId = channel.id;
            saveSettings(settings);

            embed.setTitle("🌸 Karşılama Sistemi Ayarlandı")
                .setDescription(
                    `Karşılama mesajları artık ${channel} kanalına gönderilecek.`
                );
        }

        if (subcommand === "veda") {
            const channel = interaction.options.getChannel("kanal");

            guildSettings.goodbyeChannelId = channel.id;
            saveSettings(settings);

            embed.setTitle("🌙 Veda Sistemi Ayarlandı")
                .setDescription(
                    `Veda mesajları artık ${channel} kanalına gönderilecek.`
                );
        }

        if (subcommand === "durum") {
            const welcome = guildSettings.welcomeChannelId
                ? `<#${guildSettings.welcomeChannelId}>`
                : "Ayarlanmamış";

            const goodbye = guildSettings.goodbyeChannelId
                ? `<#${guildSettings.goodbyeChannelId}>`
                : "Ayarlanmamış";

            embed.setTitle("⚙️ Karşılama Sistemi Durumu")
                .addFields(
                    { name: "🌸 Karşılama Kanalı", value: welcome, inline: false },
                    { name: "🌙 Veda Kanalı", value: goodbye, inline: false }
                );
        }

        if (subcommand === "kapat") {
            const system = interaction.options.getString("sistem");

            if (system === "welcome" || system === "both") {
                delete guildSettings.welcomeChannelId;
            }

            if (system === "goodbye" || system === "both") {
                delete guildSettings.goodbyeChannelId;
            }

            saveSettings(settings);

            embed.setTitle("⚙️ Sistem Ayarları Güncellendi")
                .setDescription(
                    system === "both"
                        ? "Karşılama ve veda sistemleri kapatıldı."
                        : system === "welcome"
                            ? "Karşılama sistemi kapatıldı."
                            : "Veda sistemi kapatıldı."
                );
        }

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};