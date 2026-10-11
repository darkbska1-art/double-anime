const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("otorol-ayarla").setDescription("Yeni üyelere otomatik verilecek rolü ayarlar.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption(o => o.setName("rol").setDescription("Yeni üyelere verilecek rol").setRequired(true)),
  async execute(interaction, client, config, store) {
    const role = interaction.options.getRole("rol");
    if (role.managed || role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({ content: "Bu rolü veremem. Bot rolünü hedef rolün üstüne taşı.", ephemeral: true });
    }
    const settings = store.read("settings.json", {});
    settings[interaction.guildId] ||= {};
    settings[interaction.guildId].autoroleId = role.id;
    store.write("settings.json", settings);
    await interaction.reply({ content: `🌷 Otorol ayarlandı: **${role.name}**`, ephemeral: true });
  }
};
