
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
    name: Events.GuildMemberAdd,

    async execute(member) {
        try {
            const settings = getSettings();
            const channelId = settings[member.guild.id]?.welcomeChannelId;
            if (!channelId) return;

            const channel = await member.guild.channels
                .fetch(channelId)
                .catch(() => null);

            if (!channel || !channel.isTextBased() || !channel.send) return;

            const image = await createWelcomeCard(member, "welcome");
            const attachment = new AttachmentBuilder(image, {
                name: "double-anime-hosgeldin.png"
            });

            const embed = new EmbedBuilder()
                .setColor("#e879c5")
                .setTitle("🌸 Aramıza Hoş Geldin!")
                .setDescription(
                    `${member} sunucumuza katıldı!\n\n` +
                    `**Üye:** ${member.user.username}\n` +
                    `**Sunucu:** ${member.guild.name}\n` +
                    `**Üye sayısı:** ${member.guild.memberCount}`
                )
                .setImage("attachment://double-anime-hosgeldin.png")
                .setFooter({ text: "DOUBLE.ANIME • İyi eğlenceler!" })
                .setTimestamp();

            await channel.send({
                content: `Hoş geldin ${member}! 💗`,
                embeds: [embed],
                files: [attachment],
                allowedMentions: { users: [member.id] }
            });
        } catch (error) {
            console.error("[Karşılama] Hata:", error);
        }
    }
};