
const { Events, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { createWelcomeCard } = require("../lib/welcomeCard");

const settingsPath = path.join(__dirname, "..", "data", "welcome-settings.json");

function getSettings() {
    if (!fs.existsSync(settingsPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
        return {};
    }
}

module.exports = {
    name: Events.GuildMemberRemove,

    async execute(member) {
        try {
            const settings = getSettings();
            const channelId = settings[member.guild.id]?.goodbyeChannelId;
            if (!channelId) return;

            const channel = await member.guild.channels
                .fetch(channelId)
                .catch(() => null);

            if (!channel || !channel.isTextBased() || !channel.send) return;

            const image = await createWelcomeCard(member, "goodbye");
            const attachment = new AttachmentBuilder(image, {
                name: "double-anime-veda.png"
            });

            const embed = new EmbedBuilder()
                .setColor("#a855f7")
                .setTitle("🌙 Bir Üyemiz Ayrıldı")
                .setDescription(
                    `**${member.user.username}** sunucumuzdan ayrıldı.\n\n` +
                    `**Sunucu:** ${member.guild.name}\n` +
                    `**Güncel üye sayısı:** ${member.guild.memberCount}`
                )
                .setImage("attachment://double-anime-veda.png")
                .setFooter({ text: "DOUBLE.ANIME • Yine bekleriz!" })
                .setTimestamp();

            await channel.send({
                embeds: [embed],
                files: [attachment]
            });
        } catch (error) {
            console.error("[Veda] Hata:", error);
        }
    }
};