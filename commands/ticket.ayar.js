
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");
const SETTINGS = path.join(DATA, "ticket-settings.json");

function readAll() {
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
        .setName("ticket-ayarla")
        .setDescription("Gelişmiş ticket ayarlarını yönetir.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName("destek-rol")
            .setDescription("Destek ekibi rolünü ayarlar.")
            .addRoleOption(o => o
                .setName("rol")
                .setDescription("Destek rolü")
                .setRequired(true)))

        .addSubcommand(s => s
            .setName("log-kanal")
            .setDescription("Ticket log kanalını ayarlar.")
            .addChannelOption(o => o
                .setName("kanal")
                .setDescription("Logların gönderileceği kanal")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)))

        .addSubcommand(s => s
            .setName("kategori")
            .setDescription("Ticket kanallarının kategorisini ayarlar.")
            .addChannelOption(o => o
                .setName("kanal")
                .setDescription("Ticket kategori kanalı")
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true)))

        .addSubcommand(s => s
            .setName("baslik")
            .setDescription("Panel başlığını ayarlar.")
            .addStringOption(o => o
                .setName("metin")
                .setDescription("Yeni panel başlığı")
                .setMaxLength(200)
                .setRequired(true)))

        .addSubcommand(s => s
            .setName("aciklama")
            .setDescription("Panel açıklamasını ayarlar.")
            .addStringOption(o => o
                .setName("metin")
                .setDescription("Yeni panel açıklaması")
                .setMaxLength(3500)
                .setRequired(true)))

        .addSubcommand(s => s
            .setName("limit")
            .setDescription("Kullanıcı başına açık ticket limitini ayarlar.")
            .addIntegerOption(o => o
                .setName("sayi")
                .setDescription("1–5 arası açık ticket limiti")
                .setMinValue(1)
                .setMaxValue(5)
                .setRequired(true)))

        .addSubcommand(s => s
            .setName("durum")
            .setDescription("Mevcut ticket ayarlarını gösterir.")),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: "Bu komut yalnızca sunucuda kullanılabilir.",
                ephemeral: true
            });
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: "❌ Bu komut için Sunucuyu Yönet izni gerekiyor.",
                ephemeral: true
            });
        }

        const all = readAll();
        const id = interaction.guildId;

        if (!all[id]) {
            all[id] = {
                supportRoleId: null,
                logChannelId: null,
                categoryId: null,
                title: "🎫 Nasıl yardımcı olabiliriz?",
                description: "Destek almak için aşağıdan bir kategori seç.",
                maxOpenTickets: 1,
                color: 0x7567F8
            };
        }

        const config = all[id];
        const sub = interaction.options.getSubcommand();

        if (sub === "destek-rol") {
            config.supportRoleId = interaction.options.getRole("rol", true).id;
        } else if (sub === "log-kanal") {
            config.logChannelId = interaction.options.getChannel("kanal", true).id;
        } else if (sub === "kategori") {
            config.categoryId = interaction.options.getChannel("kanal", true).id;
        } else if (sub === "baslik") {
            config.title = interaction.options.getString("metin", true);
        } else if (sub === "aciklama") {
            config.description = interaction.options.getString("metin", true);
        } else if (sub === "limit") {
            config.maxOpenTickets = interaction.options.getInteger("sayi", true);
        } else if (sub === "durum") {
            return interaction.reply({
                content:
                    `**🎫 DOUBLE.ANIME Ticket Ayarları**\n\n` +
                    `**Destek rolü:** ${config.supportRoleId ? `<@&${config.supportRoleId}>` : "❌ Ayarlanmamış"}\n` +
                    `**Log kanalı:** ${config.logChannelId ? `<#${config.logChannelId}>` : "❌ Ayarlanmamış"}\n` +
                    `**Ticket kategorisi:** ${config.categoryId ? `<#${config.categoryId}>` : "❌ Ayarlanmamış"}\n` +
                    `**Açık ticket limiti:** ${config.maxOpenTickets || 1}\n` +
                    `**Panel başlığı:** ${config.title || "Varsayılan"}`,
                ephemeral: true,
                allowedMentions: { parse: [] }
            });
        }

        const temp = `${SETTINGS}.tmp`;
        fs.writeFileSync(temp, JSON.stringify(all, null, 2), "utf8");
        fs.renameSync(temp, SETTINGS);

        return interaction.reply({
            content: `✅ **${sub}** ayarı kaydedildi.`,
            ephemeral: true
        });
    }
};