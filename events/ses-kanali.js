
const {
    Events,
    ChannelType
} = require("discord.js");

const {
    joinVoiceChannel,
    getVoiceConnection,
    VoiceConnectionStatus
} = require("@discordjs/voice");

let reconnectTimer = null;
let connecting = false;

async function connectToVoiceChannel(client, config) {
    if (connecting) return;

    connecting = true;

    try {
        const channelId =
            process.env.VOICE_CHANNEL_ID ||
            config?.voiceChannelId;

        if (!channelId) {
            console.error(
                "[SES] VOICE_CHANNEL_ID ayarlanmamış!"
            );
            return;
        }

        const channel = await client.channels
            .fetch(channelId)
            .catch(() => null);

        if (!channel) {
            console.error(
                "[SES] Ses kanalı bulunamadı. Kanal ID'sini kontrol et."
            );
            return;
        }

        if (
            channel.type !== ChannelType.GuildVoice &&
            channel.type !== ChannelType.GuildStageVoice
        ) {
            console.error(
                "[SES] Belirtilen ID bir ses veya sahne kanalı değil."
            );
            return;
        }

        const guild = channel.guild;

        const botMember = guild.members.me;

        if (!botMember) {
            console.error(
                "[SES] Botun sunucu üyeliği bulunamadı."
            );
            return;
        }

        const permissions = channel.permissionsFor(botMember);

        if (
            !permissions?.has("ViewChannel") ||
            !permissions?.has("Connect")
        ) {
            console.error(
                "[SES] Botun bu kanalda Kanalı Görüntüle ve Bağlan izinleri olmalı."
            );
            return;
        }

        let connection = getVoiceConnection(guild.id);

        // Var olan bağlantı sağlıklıysa tekrar bağlanma.
        if (
            connection &&
            connection.joinConfig.channelId === channel.id &&
            connection.state.status !== VoiceConnectionStatus.Destroyed
        ) {
            if (
                connection.state.status === VoiceConnectionStatus.Ready ||
                connection.state.status === VoiceConnectionStatus.Connecting ||
                connection.state.status === VoiceConnectionStatus.Signalling
            ) {
                return;
            }

            // Bağlantı kopmuşsa yeniden kur.
            connection.destroy();
        } else if (connection) {
            connection.destroy();
        }

        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true
        });

        connection.on("error", error => {
            console.error("[SES] Bağlantı hatası:", error);
        });

        connection.on("stateChange", (oldState, newState) => {
            console.log(
                `[SES] ${oldState.status} -> ${newState.status}`
            );

            if (newState.status === VoiceConnectionStatus.Ready) {
                console.log(
                    `[SES] ${channel.name} kanalına bağlandı.`
                );
            }

            if (newState.status === VoiceConnectionStatus.Disconnected) {
                console.warn(
                    "[SES] Bağlantı koptu. Yeniden bağlanılacak."
                );
            }
        });

    } catch (error) {
        console.error("[SES] Kanal bağlantısı kurulamadı:", error);
    } finally {
        connecting = false;
    }
}

module.exports = {
    name: Events.ClientReady,
    once: true,

    async execute(client, config) {
        console.log("[SES] Otomatik ses kanalı sistemi başlatılıyor.");

        await connectToVoiceChannel(client, config);

        // Bağlantıyı düzenli kontrol et.
        if (reconnectTimer) {
            clearInterval(reconnectTimer);
        }

        reconnectTimer = setInterval(() => {
            connectToVoiceChannel(client, config);
        }, 20_000);
    }
};

