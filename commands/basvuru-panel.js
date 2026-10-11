const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("basvuru-panel").setDescription("Yetkili/ekip başvuru paneli gönderir.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName("basvuru_kanali").setDescription("Başvuruların gönderileceği özel yönetim kanalı").addChannelTypes(ChannelType.GuildText).setRequired(true)),
  async execute(interaction, client, config, store) {
    const target = interaction.options.getChannel("basvuru_kanali");
    const settings = store.read("settings.json", {});
    settings[interaction.guildId] ||= {};
    settings[interaction.guildId].applicationChannelId = target.id;
    store.write("settings.json", settings);
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle(`${config.prefix} DOUBLE.ANIME • Ekip Başvuruları`)
      .setDescription("Ekibimize katılmak istiyorsan aşağıdaki butonlardan birini seç ve formu dürüstçe doldur. Başvurular yönetim tarafından incelenir. ♡")
      .addFields({ name: "Gerekenler", value: "• Düzenli aktiflik\n• Saygılı iletişim\n• Sorumluluk ve ekip çalışması\n• Yetkileri kötüye kullanmamak" })
      .setFooter({ text: config.footer });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("da_apply:yetkili").setLabel("Yetkili Başvurusu").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("da_apply:ekip").setLabel("Ekip Başvurusu").setStyle(ButtonStyle.Secondary)
    );
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `Başvuru paneli gönderildi. Başvurular ${target} kanalına iletilecek.`, ephemeral: true });
  }
};
