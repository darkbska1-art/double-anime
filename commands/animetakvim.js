const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const store = require("../lib/store");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("anime-takvim")
        .setDescription("Otomatik anime yayın takvimini yönetir.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub =>
            sub.setName("kanal")
                .setDescription("Anime yayın duyurularının gönderileceği kanalı ayarlar.")
                .addChannelOption(option =>
                    option.setName("kanal")
                        .setDescription("Duyuru kanalı")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub.setName("kapat")
                .setDescription("Anime yayın duyurularını durdurur.")
        )

        .addSubcommand(sub =>
            sub.setName("durum")
                .setDescription("Anime takvimi ayarlarını gösterir.")
        ),

    async execute(interaction) {
        const settings = store.read("anime-schedule-settings.json", {});
        const guildSettings = settings[interaction.guildId] ||= {};
        const action = interaction.options.getSubcommand();

        if (action === "kanal") {
            const channel = interaction.options.getChannel("kanal");
            const botMember = interaction.guild.members.me;

            if (!botMember || !channel.permissionsFor(botMember)?.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks
            ])) {
                return interaction.reply({
                    content: "Bu kanalda duyuru göndermek için gerekli izinlerim yok.",
                    ephemeral: true
                });
            }

            guildSettings.channelId = channel.id;
            guildSettings.enabled = true;

            store.write("anime-schedule-settings.json", settings);

            return interaction.reply({
                content: `✅ Anime yayın takvimi etkinleştirildi. Duyurular ${channel} kanalına gönderilecek.`,
                ephemeral: true
            });
        }

        if (action === "kapat") {
            guildSettings.enabled = false;
            store.write("anime-schedule-settings.json", settings);

            return interaction.reply({
                content: "⏸️ Anime yayın takvimi durduruldu.",
                ephemeral: true
            });
        }

        const channel = guildSettings.channelId
            ? `<#${guildSettings.channelId}>`
            : "Ayarlanmamış";

        return interaction.reply({
            content:
                `**Anime Yayın Takvimi**\n` +
                `Durum: ${guildSettings.enabled ? "🟢 Açık" : "🔴 Kapalı"}\n` +
                `Kanal: ${channel}\n` +
                `Kontrol aralığı: 15 dakika`,
            ephemeral: true
        });
    }
};