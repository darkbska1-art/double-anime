
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const dataFolder = path.join(__dirname, "..", "data");
const filePath = path.join(dataFolder, "role-panels.json");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

function readPanels() {
    try {
        if (!fs.existsSync(filePath)) return {};
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
        return {};
    }
}

function savePanels(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function parseIds(value) {
    return [...new Set(
        (value || "")
            .split(/[\s,;]+/)
            .map(x => x.replace(/[<@&>#]/g, "").trim())
            .filter(x => /^\d{17,20}$/.test(x))
    )];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rol-panel")
        .setDescription("Sunucunun rol panelini oluşturur.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub.setName("kur")
                .setDescription("Çoklu seçimli rol panelini kurar.")
                .addChannelOption(option =>
                    option.setName("kanal")
                        .setDescription("Panelin gönderileceği kanal")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("anime")
                        .setDescription("Anime rolleri: rol ID'lerini boşlukla ayır")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("bildirim")
                        .setDescription("Bildirim rolleri: rol ID'lerini boşlukla ayır")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("etkinlik")
                        .setDescription("Etkinlik rolleri: rol ID'lerini boşlukla ayır")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: "Bu komut yalnızca sunucuda kullanılabilir.",
                ephemeral: true
            });
        }

        if (interaction.options.getSubcommand() !== "kur") return;

        const channel = interaction.options.getChannel("kanal");
        const categories = {
            anime: {
                label: "Anime Rolleri",
                emoji: "🎌",
                ids: parseIds(interaction.options.getString("anime"))
            },
            bildirim: {
                label: "Bildirim Rolleri",
                emoji: "🔔",
                ids: parseIds(interaction.options.getString("bildirim"))
            },
            etkinlik: {
                label: "Etkinlik Rolleri",
                emoji: "🎉",
                ids: parseIds(interaction.options.getString("etkinlik"))
            }
        };

        if (!channel || !channel.isTextBased() || !channel.isSendable()) {
            return interaction.reply({
                content: "Lütfen mesaj gönderilebilen bir kanal seç.",
                ephemeral: true
            });
        }

        const botMember = interaction.guild.members.me;
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({
                content: "Botta **Rolleri Yönet** izni bulunmuyor.",
                ephemeral: true
            });
        }

        const roleIds = [...new Set(
            Object.values(categories).flatMap(category => category.ids)
        )];

        if (!roleIds.length) {
            return interaction.reply({
                content: "En az bir geçerli rol ID'si girmelisin.",
                ephemeral: true
            });
        }

        const invalidRoles = [];
        for (const id of roleIds) {
            const role = interaction.guild.roles.cache.get(id);
            if (!role || role.managed || role.position >= botMember.roles.highest.position) {
                invalidRoles.push(id);
            }
        }

        if (invalidRoles.length) {
            return interaction.reply({
                content:
                    "Bazı roller bulunamadı veya botun rolünün altında değil. " +
                    "Botun en yüksek rolünü bu rollerin üzerine taşı ve ID'leri kontrol et.\n" +
                    `Kontrol edilecek ID'ler: ${invalidRoles.join(", ")}`,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x111111)
            .setTitle("🎭 DOUBLE.ANIME • Rol Paneli")
            .setDescription(
                "Aşağıdaki menülerden istediğin rolleri seçebilirsin.\n\n" +
                "• Bir kategoride birden fazla rol seçebilirsin.\n" +
                "• Aldığın rolleri kaldırmak için **Rol Kaldır** butonunu kullan.\n" +
                "• Rol kaldırma menüsü yalnızca sahip olduğun panel rollerini gösterir."
            )
            .setFooter({ text: "DOUBLE.ANIME • Rol Yönetim Sistemi" });

        const rows = [];

        for (const [key, category] of Object.entries(categories)) {
            const options = category.ids
                .map(id => interaction.guild.roles.cache.get(id))
                .filter(Boolean)
                .slice(0, 25)
                .map(role => ({
                    label: role.name.slice(0, 100),
                    value: role.id,
                    description: `Almak için seç: ${role.name}`.slice(0, 100)
                }));

            if (!options.length) continue;

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`rolepanel:add:${key}:${interaction.guildId}`)
                .setPlaceholder(`${category.emoji} ${category.label}`)
                .setMinValues(1)
                .setMaxValues(options.length)
                .addOptions(options);

            rows.push(new ActionRowBuilder().addComponents(menu));
        }

        rows.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`rolepanel:remove:${interaction.guildId}`)
                    .setLabel("Rol Kaldır")
                    .setEmoji("➖")
                    .setStyle(ButtonStyle.Danger)
            )
        );

        const panelMessage = await channel.send({
            embeds: [embed],
            components: rows
        });

        const data = readPanels();
        if (!data[interaction.guildId]) data[interaction.guildId] = {};

        data[interaction.guildId][panelMessage.id] = {
            channelId: channel.id,
            categories: Object.fromEntries(
                Object.entries(categories).map(([key, category]) => [
                    key,
                    category.ids
                ])
            )
        };

        savePanels(data);

        return interaction.reply({
            content: `✅ Rol paneli ${channel} kanalına kuruldu.`,
            ephemeral: true
        });
    }
};

