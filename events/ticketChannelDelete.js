const { Events } = require("discord.js");
const { handleChannelDelete } = require("../lib/ticket");

module.exports = {
  name: Events.ChannelDelete,

  async execute(channel) {
    try {
      await handleChannelDelete(channel);
    } catch (err) {
      console.error("[TICKET] Kanal silme olayı hatası:", err);
    }
  },
};