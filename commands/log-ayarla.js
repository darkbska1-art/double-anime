const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("log-ayarla").setDescription("Log kanalını ayarlar.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName("kanal").setDescription("Log kanalı").addChannelTypes(ChannelType.GuildText).setRequired(true)),
  async execute(interaction, client, config, store) {
    const channel = interaction.options.getChannel("kanal");
    const settings = store.read("settings.json", {});
    settings[interaction.guildId] ||= {};
    settings[interaction.guildId].logChannelId = channel.id;
    store.write("settings.json", settings);
    await interaction.reply({ content: `🌷 Log kanalı ${channel} olarak ayarlandı.`, ephemeral: true });
  }
};
