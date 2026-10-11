const { Events, PermissionFlagsBits } = require("discord.js");
const store = require("../lib/store");

module.exports = {
    name: Events.GuildMemberAdd,

    async execute(member) {
        try {
            const settings = store.read("settings.json", {});
            const guildSettings = settings[member.guild.id];
            if (!guildSettings) return;

            // Bot mu üye mi, ona göre doğru ayarı seç
            const key = member.user.bot ? "botAutoroleId" : "autoroleId";
            const roleId = guildSettings[key];
            if (!roleId) return;

            const role = await member.guild.roles
                .fetch(roleId)
                .catch(() => null);

            // Rol silinmişse ayarı temizle
            if (!role) {
                delete guildSettings[key];
                store.write("settings.json", settings);
                console.warn(
                    `[OTOROL] ${member.guild.name}: rol silinmiş, ayar temizlendi.`
                );
                return;
            }

            const botMember =
                member.guild.members.me ??
                (await member.guild.members.fetchMe().catch(() => null));
            if (!botMember) return;

            if (
                !botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
                role.managed ||
                role.position >= botMember.roles.highest.position
            ) {
                console.warn(
                    `[OTOROL] ${member.guild.name}: "${role.name}" rolü verilemiyor. İzinleri ve rol sırasını kontrol et.`
                );
                return;
            }

            await member.roles.add(
                role,
                member.user.bot
                    ? "DOUBLE.ANIME otomatik bot rolü"
                    : "DOUBLE.ANIME otomatik rol"
            );

            console.log(
                `[OTOROL] ${member.user.tag} (${member.user.bot ? "bot" : "üye"}) kullanıcısına ${role.name} rolü verildi.`
            );
        } catch (error) {
            console.error("[OTOROL] Hata:", error);
        }
    },
};