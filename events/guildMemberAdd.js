const { EmbedBuilder } = require("discord.js");
module.exports = {
  name: "guildMemberAdd",
  async execute(member, client, config, store) {
    const settings = store.read("settings.json", {})[member.guild.id] || {};
    if (settings.autoroleId) {
      const role = await member.guild.roles.fetch(settings.autoroleId).catch(() => null);
      if (role && !role.managed && role.position < member.guild.members.me.roles.highest.position) {
        await member.roles.add(role, "DOUBLE.ANIME oto rol").catch(err => console.error("Otorol verilemedi:", err.message));
      }
    }
    if (settings.welcomeChannelId) {
      const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder().setColor(config.colors.primary)
          .setTitle(`${config.prefix} Hoş Geldin!`)
          .setDescription(`Merhaba ${member}! **${member.guild.name}** sunucusuna hoş geldin. ♡\nŞu an **${member.guild.memberCount}** üyeyiz!`)
          .setThumbnail(member.user.displayAvatarURL({ size: 512 })).setFooter({ text: config.footer });
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
    if (settings.logChannelId) {
      const channel = await member.guild.channels.fetch(settings.logChannelId).catch(() => null);
      if (channel?.isTextBased()) await channel.send({ embeds: [
        new EmbedBuilder().setColor(config.colors.success).setDescription(`➕ ${member.user.tag} sunucuya katıldı.`).setTimestamp()
      ] }).catch(() => {});
    }
  }
};
