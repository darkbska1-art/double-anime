const { EmbedBuilder } = require("discord.js");
module.exports = {
  name: "guildMemberRemove",
  async execute(member, client, config, store) {
    const settings = store.read("settings.json", {})[member.guild.id] || {};
    if (settings.goodbyeChannelId) {
      const channel = await member.guild.channels.fetch(settings.goodbyeChannelId).catch(() => null);
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder().setColor(config.colors.secondary)
          .setTitle(`${config.prefix} Görüşürüz`)
          .setDescription(`**${member.user.tag}** sunucudan ayrıldı. ♡`)
          .setThumbnail(member.user.displayAvatarURL({ size: 512 })).setFooter({ text: config.footer });
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
    if (settings.logChannelId) {
      const channel = await member.guild.channels.fetch(settings.logChannelId).catch(() => null);
      if (channel?.isTextBased()) await channel.send({ embeds: [
        new EmbedBuilder().setColor(config.colors.warning).setDescription(`➖ ${member.user.tag} sunucudan ayrıldı.`).setTimestamp()
      ] }).catch(() => {});
    }
  }
};
