const { Events, MessageFlags } = require("discord.js");
const { handleInteraction } = require("../lib/ticket");

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    try {
      await handleInteraction(interaction);
    } catch (err) {
      console.error("[TICKET] Hata:", err);
      const msg = { content: "Bir hata oluştu, lütfen tekrar dene.", flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  },
};