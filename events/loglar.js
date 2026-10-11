
const { Events, EmbedBuilder, AuditLogEvent } = require("discord.js");

module.exports = {
    name: Events.ClientReady,

    async execute(readyClient, client) {
        // Log kanalına embed gönder
        async function log(guild, title, description, color = 0x2B2D31) {
            if (!guild) return;

            const settings = require("../lib/store").read("settings.json", {});
            const channelId = settings[guild.id]?.logChannelId;
            if (!channelId) return;

            const channel = await guild.channels.fetch(channelId).catch(() => null);
            if (!channel?.isTextBased()) return;

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description.slice(0, 4000))
                .setTimestamp();

            await channel.send({ embeds: [embed] }).catch(err => {
                console.error("[LOG] Mesaj gönderilemedi:", err.message);
            });
        }

        // MESAJ SİLİNDİ
        client.on(Events.MessageDelete, async message => {
            if (!message.guild) return;

            const user = message.author
                ? `${message.author.tag} (\`${message.author.id}\`)`
                : "Bilinmiyor (önbellekte yok)";

            const content = message.content || "Mesaj içeriği alınamadı.";
            await log(
                message.guild,
                "🗑️ Mesaj Silindi",
                `**Gönderen:** ${user}\n**Kanal:** ${message.channel}\n**İçerik:**\n${content}`,
                0xE74C3C
            );
        });

        // MESAJ DÜZENLENDİ
        client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
            if (!newMsg.guild || newMsg.author?.bot) return;
            if (oldMsg.partial || newMsg.partial) return;
            if (oldMsg.content === newMsg.content) return;

            await log(
                newMsg.guild,
                "✏️ Mesaj Düzenlendi",
                `**Kullanıcı:** ${newMsg.author.tag}\n**Kanal:** ${newMsg.channel}\n[Mesaja git](${newMsg.url})\n\n**Önceki:**\n${oldMsg.content || "Boş"}\n\n**Yeni:**\n${newMsg.content || "Boş"}`,
                0xF1C40F
            );
        });

        // KANAL OLUŞTURULDU
        client.on(Events.ChannelCreate, async channel => {
            if (!channel.guild) return;
            await log(channel.guild, "📁 Kanal Oluşturuldu",
                `**Kanal:** ${channel.name}\n**ID:** \`${channel.id}\``, 0x2ECC71);
        });

        // KANAL SİLİNDİ
        client.on(Events.ChannelDelete, async channel => {
            if (!channel.guild) return;
            await log(channel.guild, "🗑️ Kanal Silindi",
                `**Kanal adı:** ${channel.name}\n**ID:** \`${channel.id}\``, 0xE74C3C);
        });

        // KANAL GÜNCELLENDİ
        client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
            if (!newChannel.guild) return;

            const changes = [];
            if (oldChannel.name !== newChannel.name)
                changes.push(`**Ad:** ${oldChannel.name} → ${newChannel.name}`);

            if ("topic" in oldChannel && oldChannel.topic !== newChannel.topic)
                changes.push(`**Konu:** ${oldChannel.topic || "Yok"} → ${newChannel.topic || "Yok"}`);

            if (!changes.length) return;

            await log(newChannel.guild, "🛠️ Kanal Güncellendi",
                `**Kanal:** ${newChannel}\n${changes.join("\n")}`, 0xF1C40F);
        });

        // ROL OLUŞTURULDU
        client.on(Events.GuildRoleCreate, async role => {
            await log(role.guild, "🎭 Rol Oluşturuldu",
                `**Rol:** ${role.name}\n**ID:** \`${role.id}\``, 0x2ECC71);
        });

        // ROL SİLİNDİ
        client.on(Events.GuildRoleDelete, async role => {
            await log(role.guild, "🗑️ Rol Silindi",
                `**Rol:** ${role.name}\n**ID:** \`${role.id}\``, 0xE74C3C);
        });

        // ROL GÜNCELLENDİ
        client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
            const changes = [];

            if (oldRole.name !== newRole.name)
                changes.push(`**Ad:** ${oldRole.name} → ${newRole.name}`);
            if (oldRole.hexColor !== newRole.hexColor)
                changes.push(`**Renk:** ${oldRole.hexColor} → ${newRole.hexColor}`);
            if (oldRole.hoist !== newRole.hoist)
                changes.push(`**Ayrı gösterim:** ${oldRole.hoist} → ${newRole.hoist}`);
            if (oldRole.mentionable !== newRole.mentionable)
                changes.push(`**Etiketlenebilir:** ${oldRole.mentionable} → ${newRole.mentionable}`);

            if (!changes.length) return;

            await log(newRole.guild, "🎭 Rol Güncellendi",
                `**Rol:** ${newRole}\n${changes.join("\n")}`, 0xF1C40F);
        });

        // SUNUCUDA YASAKLAMA
        client.on(Events.GuildBanAdd, async ban => {
            await log(ban.guild, "🔨 Üye Yasaklandı",
                `**Kullanıcı:** ${ban.user.tag}\n**ID:** \`${ban.user.id}\``, 0xE74C3C);
        });

        // YASAK KALDIRILDI
        client.on(Events.GuildBanRemove, async ban => {
            await log(ban.guild, "🔓 Yasak Kaldırıldı",
                `**Kullanıcı:** ${ban.user.tag}\n**ID:** \`${ban.user.id}\``, 0x2ECC71);
        });

        // ÜYE ROLÜ / TAKMA ADI DEĞİŞTİ
        client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
            const changes = [];

            if (oldMember.nickname !== newMember.nickname)
                changes.push(`**Takma ad:** ${oldMember.nickname || "Yok"} → ${newMember.nickname || "Yok"}`);

            const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
            const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

            if (added.size)
                changes.push(`**Eklenen roller:** ${added.map(r => r.name).join(", ")}`);
            if (removed.size)
                changes.push(`**Kaldırılan roller:** ${removed.map(r => r.name).join(", ")}`);

            if (!changes.length) return;

            await log(newMember.guild, "👤 Üye Güncellendi",
                `**Üye:** ${newMember.user.tag}\n${changes.join("\n")}`, 0x3498DB);
        });

        // SES KANALI HAREKETLERİ
        client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
            const member = newState.member || oldState.member;
            if (!member) return;

            let action = "";

            if (!oldState.channelId && newState.channelId)
                action = `Ses kanalına katıldı: <#${newState.channelId}>`;
            else if (oldState.channelId && !newState.channelId)
                action = `Ses kanalından ayrıldı: <#${oldState.channelId}>`;
            else if (oldState.channelId !== newState.channelId)
                action = `Ses kanalını değiştirdi: <#${oldState.channelId}> → <#${newState.channelId}>`;
            else if (oldState.serverMute !== newState.serverMute)
                action = `Sunucu susturması: ${newState.serverMute ? "Açıldı" : "Kapatıldı"}`;
            else if (oldState.serverDeaf !== newState.serverDeaf)
                action = `Sunucu sağırlaştırması: ${newState.serverDeaf ? "Açıldı" : "Kapatıldı"}`;

            if (!action) return;

            await log(newState.guild || oldState.guild, "🎙️ Ses Durumu",
                `**Üye:** ${member.user.tag}\n${action}`, 0x9B59B6);
        });

        // SUNUCU ADI / SİMGESİ DEĞİŞTİ
        client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
            const changes = [];

            if (oldGuild.name !== newGuild.name)
                changes.push(`**Sunucu adı:** ${oldGuild.name} → ${newGuild.name}`);
            if (oldGuild.icon !== newGuild.icon)
                changes.push("Sunucu simgesi değiştirildi.");

            if (!changes.length) return;

            await log(newGuild, "🏠 Sunucu Güncellendi",
                changes.join("\n"), 0xF1C40F);
        });

        console.log("🌷 DOUBLE.ANIME log olayları aktif.");
    }
};

