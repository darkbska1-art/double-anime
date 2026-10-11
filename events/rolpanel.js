
const {
    Events,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "data", "role-panels.json");

function readPanels() {
    try {
        if (!fs.existsSync(filePath)) return {};
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
        return {};
    }
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        const isRolePanelMenu =
            interaction.isStringSelectMenu() &&
            interaction.customId.startsWith("rolepanel:");

        const isRemoveButton =
            interaction.isButton() &&
            interaction.customId.startsWith("rolepanel:remove:");

        if (!isRolePanelMenu && !isRemoveButton) return;
        if (!interaction.inGuild()) return;

        const parts = interaction.customId.split(":");
        const action = parts[1];
        const guildId = parts[parts.length - 1];

        if (guildId !== interaction.guildId) {
            return interaction.reply({
                content: "Bu panel başka bir sunucuya ait.",
                ephemeral: true
            });
        }

        const panels = readPanels();
        const guildPanels = panels[guildId] || {};

        const configuredRoleIds = [
            ...new Set(
                Object.values(guildPanels).flatMap(panel =>
                    Object.values(panel.categories || {}).flatMap(roles =>
                        Array.isArray(roles)
                            ? roles.map(role =>
                                typeof role === "string" ? role : role.id
                            )
                            : []
                    )
                )
            )
        ];

        const member = await interaction.guild.members
            .fetch(interaction.user.id)
            .catch(() => null);

        if (!member) {
            return interaction.reply({
                content: "Üye bilgileri alınamadı. Lütfen tekrar dene.",
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

        // ROL KALDIR BUTONU
        if (isRemoveButton) {
            const removableRoles = configuredRoleIds
                .filter(id => member.roles.cache.has(id))
                .map(id => interaction.guild.roles.cache.get(id))
                .filter(role =>
                    role &&
                    !role.managed &&
                    role.position < botMember.roles.highest.position
                )
                .slice(0, 25);

            if (!removableRoles.length) {
                return interaction.reply({
                    content: "Kaldırabileceğin bir panel rolün bulunmuyor.",
                    ephemeral: true
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`rolepanel:remove-select:${guildId}`)
                .setPlaceholder("Kaldırmak istediğin rolleri seç")
                .setMinValues(1)
                .setMaxValues(removableRoles.length)
                .addOptions(
                    removableRoles.map(role => ({
                        label: role.name.slice(0, 100),
                        value: role.id,
                        description: "Bu rolü kaldır".slice(0, 100)
                    }))
                );

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x111111)
                        .setTitle("➖ Rollerini Kaldır")
                        .setDescription(
                            "Kaldırmak istediğin rolleri seç. " +
                            "Seçmediğin rollerin korunacağını unutma."
                        )
                ],
                components: [
                    new ActionRowBuilder().addComponents(menu)
                ],
                ephemeral: true
            });
        }

        // ÖZEL KALDIRMA MENÜSÜ
        if (
            interaction.isStringSelectMenu() &&
            action === "remove-select"
        ) {
            const allowed = new Set(configuredRoleIds);
            const toRemove = interaction.values.filter(id =>
                allowed.has(id) &&
                member.roles.cache.has(id)
            );

            if (!toRemove.length) {
                return interaction.update({
                    content: "Seçtiğin rollerden kaldırılabilecek bir rol bulunamadı.",
                    embeds: [],
                    components: []
                });
            }

            const removable = toRemove.filter(id => {
                const role = interaction.guild.roles.cache.get(id);
                return role &&
                    !role.managed &&
                    role.position < botMember.roles.highest.position;
            });

            if (!removable.length) {
                return interaction.update({
                    content: "Bu roller botun rol hiyerarşisi nedeniyle kaldırılamıyor.",
                    embeds: [],
                    components: []
                });
            }

            try {
                await member.roles.remove(removable, "DOUBLE.ANIME rol panelinden kaldırıldı");

                return interaction.update({
                    content:
                        `✅ Kaldırılan roller: ${removable.map(id =>
                            `**${interaction.guild.roles.cache.get(id)?.name || id}**`
                        ).join(", ")}`,
                    embeds: [],
                    components: []
                });
            } catch (error) {
                console.error("[Rol Paneli - Rol Kaldırma]", error);

                return interaction.update({
                    content: "Roller kaldırılamadı. Botun rol sırasını ve izinlerini kontrol et.",
                    embeds: [],
                    components: []
                });
            }
        }

        // ROL ALMA MENÜSÜ
        if (
            interaction.isStringSelectMenu() &&
            action === "add"
        ) {
            const categoryKey = parts[2];
            const panel = guildPanels[interaction.message.id];

            if (!panel || !panel.categories?.[categoryKey]) {
                return interaction.reply({
                    content: "Bu rol panelinin ayarları bulunamadı. Paneli yeniden kur.",
                    ephemeral: true
                });
            }

            const allowed = new Set(
                panel.categories[categoryKey].map(role =>
                    typeof role === "string" ? role : role.id
                )
            );

            const toAdd = interaction.values.filter(id => {
                const role = interaction.guild.roles.cache.get(id);
                return allowed.has(id) &&
                    role &&
                    !role.managed &&
                    role.position < botMember.roles.highest.position &&
                    !member.roles.cache.has(id);
            });

            if (!toAdd.length) {
                return interaction.reply({
                    content: "Seçtiğin rolleri zaten almış olabilirsin.",
                    ephemeral: true
                });
            }

            try {
                await member.roles.add(toAdd, "DOUBLE.ANIME rol panelinden alındı");

                return interaction.reply({
                    content:
                        `✅ Aldığın roller: ${toAdd.map(id =>
                            `**${interaction.guild.roles.cache.get(id)?.name || id}**`
                        ).join(", ")}`,
                    ephemeral: true
                });
            } catch (error) {
                console.error("[Rol Paneli - Rol Alma]", error);

                return interaction.reply({
                    content: "Roller verilemedi. Botun rol sırasını ve izinlerini kontrol et.",
                    ephemeral: true
                });
            }
        }
    }
};

