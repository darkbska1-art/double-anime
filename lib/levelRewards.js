
const { PermissionFlagsBits } = require("discord.js");
const store = require("./store");

async function giveLevelReward(member, level) {
    try {
        const rewards = store.read("level-rewards.json", {});
        const guildRewards = rewards[member.guild.id] || {};
        const roleId = guildRewards[String(level)];

        // Bu seviyeye özel ödül yoksa işlem yapma.
        if (!roleId) return false;

        const botMember = member.guild.members.me;
        if (!botMember) return false;

        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            console.warn("[SEVİYE ROLÜ] Botta Rolleri Yönet izni yok.");
            return false;
        }

        const newRole = await member.guild.roles
            .fetch(roleId)
            .catch(() => null);

        if (
            !newRole ||
            newRole.managed ||
            newRole.position >= botMember.roles.highest.position
        ) {
            console.warn("[SEVİYE ROLÜ] Yeni ödül rolü verilemiyor.");
            return false;
        }

        // Önce yeni rolü ver; işlem başarısızsa eski rolü koru.
        if (!member.roles.cache.has(newRole.id)) {
            await member.roles.add(
                newRole,
                `${level}. seviyeye ulaştı`
            );
        }

        // Daha düşük seviyelere ait tanımlı ödül rollerini kaldır.
        for (const [rewardLevel, rewardRoleId] of Object.entries(guildRewards)) {
            if (Number(rewardLevel) >= Number(level)) continue;
            if (rewardRoleId === newRole.id) continue;

            const oldRole = await member.guild.roles
                .fetch(rewardRoleId)
                .catch(() => null);

            if (!oldRole || !member.roles.cache.has(oldRole.id)) continue;

            if (
                oldRole.managed ||
                oldRole.position >= botMember.roles.highest.position
            ) {
                console.warn(
                    `[SEVİYE ROLÜ] Eski rol kaldırılamadı: ${oldRole.name}`
                );
                continue;
            }

            await member.roles.remove(
                oldRole,
                `${level}. seviyeye yükseldi`
            );
        }

        console.log(
            `[SEVİYE ROLÜ] ${member.user.tag} için ${level}. seviye ödülü uygulandı.`
        );

        return true;
    } catch (error) {
        console.error("[SEVİYE ROLÜ] İşlem hatası:", error);
        return false;
    }
}

module.exports = { giveLevelReward };

