require("dotenv").config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  voiceChannelId: process.env.VOICE_CHANNEL_ID,
  botName: "DOUBLE.ANIME",
  prefix: "𓍢ִ໋🌷͙֒・",
  colors: {
    primary: 0xE8A6C8,
    secondary: 0x17131A,
    success: 0x77DD99,
    error: 0xFF6B81,
    warning: 0xFFD166
  },
  footer: "𓍢ִ໋🌷͙֒・ DOUBLE.ANIME",
  presence: { status: "ıdle", activity: "𓍢ִ໋🌷͙֒・ double.anime" },
  dataFolder: "./data"
};
