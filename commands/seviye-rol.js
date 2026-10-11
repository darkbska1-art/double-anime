
const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const store = require("../lib/store");

const MAX_ROLES = 25;

function readRewards() {
    return store.read("level-rewards.json", {});
}

function saveRewards(data) {
    store.write("level-rewards.json", data);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("seviye-rol")
        .setDescription("Seviye ödül rollerini yönetir.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub =>
            sub.setName("ekle")
                .setDescription("Bir seviyeye ödül rolü tanımlar.")
                .addIntegerOption(option =>
                    option.setName("seviye")
                        .setDescription("Rolün verileceği seviye")
                        .setMinValue(1)
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName("rol")
                        .setDescription("Verilecek rol")
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub.setName("sil")
                .setDescription("Bir seviyenin ödülünü kaldırır.")
                .addIntegerOption(option =>
                    option.setName("seviye")
                        .setDescription("Ödülü kaldırılacak seviye")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub.setName("liste")
                .setDescription("Tanımlı seviye ödüllerini gösterir.")
        )

        .addSubcommand(sub =>
            sub.setName("sıfırla")
                .setDescription("Sunucunun tüm seviye ödüllerini kaldırır.")
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: "Bu komut yalnızca sunucularda kullanılabilir.",
                ephemeral: true
            });
        }

        if (!interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )) {
            return interaction.reply({
                content: "Bu işlem için Sunucuyu Yönet izni gerekiyor.",
                ephemeral: true
            });
        }

        const guildId = interaction.guildId;
        const subcommand = interaction.options.getSubcommand();
        const rewards = readRewards();

        rewards[guildId] ||= {};

        if (subcommand === "ekle") {
            const level = interaction.options.getInteger("seviye");
            const role = interaction.options.getRole("rol");
            const guildRewards = rewards[guildId];

            if (!role || role.id === interaction.guild.id) {
                return interaction.reply({
                    content: "Geçerli bir üye rolü seçmelisin.",
                    ephemeral: true
                });
            }

            if (
                role.managed ||
                role.position >= interaction.guild.members.me.roles.highest.position
            ) {
                return interaction.reply({
                    content: "Bu rolü veremem. Botun en yüksek rolünü benim altıma taşı ve yönetilen bot rollerini seçme.",
                    ephemeral: true
                });
            }

            if (!guildRewards[level] &&
                Object.keys(guildRewards).length >= MAX_ROLES) {
                return interaction.reply({
                    content: `En fazla ${MAX_ROLES} farklı seviye ödülü tanımlayabilirsin.`,
                    ephemeral: true
                });
            }

            guildRewards[level] = role.id;
            saveRewards(rewards);

            const embed = new EmbedBuilder()
                .setColor(0xff63d4)
                .setTitle("🌸 Seviye Ödülü Ayarlandı")
                .setDescription(
                    `**Seviye:** ${level}\n` +
                    `**Ödül rolü:** ${role}\n\n` +
                    "Üye bu seviyeye ulaştığında rol otomatik verilir."
                )
                .setFooter({ text: "DOUBLE.ANIME • Seviye Sistemi" })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === "sil") {
            const level = interaction.options.getInteger("seviye");

            if (!rewards[guildId][level]) {
                return interaction.reply({
                    content: `❌ ${level}. seviye için tanımlanmış bir ödül yok.`,
                    ephemeral: true
                });
            }

            delete rewards[guildId][level];
            saveRewards(rewards);

            return interaction.reply({
                content: `✅ ${level}. seviyenin ödül rolü kaldırıldı.`,
                ephemeral: true
            });
        }

        if (subcommand === "liste") {
            const entries = Object.entries(rewards[guildId])
                .map(([level, roleId]) => ({
                    level: Number(level),
                    roleId
                }))
                .sort((a, b) => a.level - b.level);

            const embed = new EmbedBuilder()
                .setColor(0xff63d4)
                .setTitle("🌸 DOUBLE.ANIME • Seviye Ödülleri")
                .setDescription(
                    entries.length
                        ? entries.map(item =>
                            `**${item.level}. seviye** → <@&${item.roleId}>`
                        ).join("\n")
                        : "Henüz seviye ödülü tanımlanmamış."
                )
                .setFooter({
                    text: `${entries.length}/${MAX_ROLES} ödül tanımlı`
                })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === "sıfırla") {
            delete rewards[guildId];
            saveRewards(rewards);

            return interaction.reply({
                content: "🗑️ Bu sunucudaki bütün seviye ödülleri kaldırıldı.",
                ephemeral: true
            });
        }
    }
};

