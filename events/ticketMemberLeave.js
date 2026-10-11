const { Events } = require("discord.js");
const { notifyOwnerLeft } = require("../lib/ticket");

module.exports = {
  name: Events.GuildMemberRemove,

  async execute(member) {
    try {
      await notifyOwnerLeft(member);
    } catch (err) {
      console.error("[TICKET] Üye ayrılma olayı hatası:", err);
    }
  },
};