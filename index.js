
require("dotenv").config();

const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const express = require("express");

const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  ActivityType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const config = require("./config");
const store = require("./lib/store");

// ==================================================
// TOKEN KONTROLÜ
// ==================================================

if (!config.token) {
  console.error(
    "❌ DISCORD_TOKEN eksik. .env veya Render Environment Variables ayarını kontrol et."
  );
  process.exit(1);
}

// ==================================================
// WEB SUNUCUSU
// ==================================================

const app = express();

app.get("/", (_req, res) => {
  res.status(200).send("𓍢ִ໋🌷͙֒・ DOUBLE.ANIME bot servisi aktif.");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "double-anime"
  });
});

const server = http.createServer(app);

server.listen(
  Number(process.env.PORT) || 3000,
  "0.0.0.0",
  () => console.log("🌐 Web sunucusu hazır.")
);

// ==================================================
// DISCORD CLIENT
// ==================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [
    Partials.GuildMember,
    Partials.Channel,
    Partials.Message
  ]
});

client.commands = new Collection();

// ==================================================
// KOMUTLARI YÜKLE
// ==================================================

const commandsDir = path.join(__dirname, "commands");

if (!fs.existsSync(commandsDir)) {
  fs.mkdirSync(commandsDir, { recursive: true });
}

for (
  const file of fs.readdirSync(commandsDir).filter(f => f.endsWith(".js"))
) {
  try {
    const command = require(path.join(commandsDir, file));

    if (
      command.data?.name &&
      typeof command.execute === "function"
    ) {
      client.commands.set(command.data.name, command);
      console.log(`📦 /${command.data.name}`);
    } else {
      console.warn(`⚠️ Komut biçimi hatalı: ${file}`);
    }
  } catch (error) {
    console.error(`❌ Komut yüklenemedi: ${file}`, error);
  }
}

// ==================================================
// EVENT DOSYALARINI YÜKLE
// ==================================================

const eventsDir = path.join(__dirname, "events");

if (!fs.existsSync(eventsDir)) {
  fs.mkdirSync(eventsDir, { recursive: true });
}

for (
  const file of fs.readdirSync(eventsDir).filter(f => f.endsWith(".js"))
) {
  try {
    const eventPath = path.join(eventsDir, file);

    // Event dosyasını yükle.
    const event = require(eventPath);

    if (
      !event.name ||
      typeof event.execute !== "function"
    ) {
      console.warn(`⚠️ Event biçimi hatalı veya eksik: ${file}`);
      continue;
    }

    // Discord olayını yalnızca bir kez bağla.
    const runner = (...args) => {
      Promise.resolve(
        event.execute(...args, client, config, store)
      ).catch(error => {
        console.error(`❌ Event hatası (${file}):`, error);
      });
    };

    if (event.once) {
      client.once(event.name, runner);
    } else {
      client.on(event.name, runner);
    }

    console.log(`📡 Event yüklendi: ${file}`);
  } catch (error) {
    console.error(`❌ Event yüklenemedi: ${file}`, error);
  }
}

// ==================================================
// LOG SİSTEMİ
// ==================================================

async function sendLog(guild, embed) {
  const settings = store.read("settings.json", {});
  const channelId = settings[guild.id]?.logChannelId;

  if (!channelId) return;

  const channel = await guild.channels
    .fetch(channelId)
    .catch(error => {
      console.error("[LOG] Kanal alınamadı:", error.message);
      return null;
    });

  if (channel?.isTextBased()) {
    await channel.send({ embeds: [embed] }).catch(error => {
      console.error("[LOG] Mesaj gönderilemedi:", error.message);
    });
  }
}

client.sendLog = sendLog;

// ==================================================
// BOT HAZIR
// ==================================================

client.once("ready", readyClient => {
  console.log(`✅ ${readyClient.user.tag} olarak giriş yapıldı.`);
  console.log(`📦 Yüklenen komut sayısı: ${client.commands.size}`);
  console.log("🌸 DOUBLE.ANIME hazır!");

  readyClient.user.setPresence({
    status: config.presence.status,
    activities: [
      {
        name: config.presence.activity,
        type: ActivityType.Watching
      }
    ]
  });
});

// ==================================================
// SLASH KOMUTLARI VE ETKİLEŞİMLER
// ==================================================

client.on("interactionCreate", async interaction => {
  try {
    // ----------------------------------------------
    // SLASH KOMUTLARI
    // ----------------------------------------------

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        return interaction.reply({
          content: "Komut bulunamadı.",
          ephemeral: true
        });
      }

      await command.execute(
        interaction,
        client,
        config,
        store
      );

      return;
    }

    // ----------------------------------------------
    // BUTONLAR
    // ----------------------------------------------

    if (interaction.isButton()) {

      // TICKET AÇ
      if (interaction.customId === "da_ticket_open") {
        const existing = interaction.guild.channels.cache.find(c =>
          c.type === ChannelType.GuildText &&
          c.topic === `double-anime-ticket:${interaction.user.id}`
        );

        if (existing) {
          return interaction.reply({
            content: `Zaten açık bir ticket'ın var: ${existing}`,
            ephemeral: true
          });
        }

        const settings =
          store.read("settings.json", {})[interaction.guildId] || {};

        const categoryId = settings.ticketCategoryId || null;
        const supportRoleId = settings.supportRoleId || null;

        const overwrites = [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ];

        if (supportRoleId) {
          overwrites.push({
            id: supportRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          });
        }

        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "")
            .slice(0, 80),
          type: ChannelType.GuildText,
          topic: `double-anime-ticket:${interaction.user.id}`,
          parent: categoryId || undefined,
          permissionOverwrites: overwrites
        });

        const embed = new EmbedBuilder()
          .setColor(config.colors.primary)
          .setTitle(`${config.prefix} Destek Talebi`)
          .setDescription(
            `Merhaba ${interaction.user}! Destek ekibine sorununuzu açıklayın. Gerektiğinde ekran görüntüsü ekleyebilirsiniz.`
          )
          .setFooter({ text: config.footer });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("da_ticket_close")
            .setLabel("Ticket'ı Kapat")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({
          content: `${interaction.user}${
            supportRoleId ? ` <@&${supportRoleId}>` : ""
          }`,
          embeds: [embed],
          components: [row]
        });

        return interaction.reply({
          content: `Ticket oluşturuldu: ${channel}`,
          ephemeral: true
        });
      }

      // TICKET KAPAT
      if (interaction.customId === "da_ticket_close") {
        const openerId =
          interaction.channel?.topic?.startsWith("double-anime-ticket:")
            ? interaction.channel.topic.split(":")[1]
            : null;

        const settings =
          store.read("settings.json", {})[interaction.guildId] || {};

        const isSupport =
          settings.supportRoleId &&
          interaction.member.roles.cache.has(settings.supportRoleId);

        if (
          interaction.user.id !== openerId &&
          !isSupport &&
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageChannels
          )
        ) {
          return interaction.reply({
            content: "Bu ticket'ı yalnızca açan kişi veya destek ekibi kapatabilir.",
            ephemeral: true
          });
        }

        await interaction.reply({
          content: "Ticket 5 saniye içinde kapatılacak."
        });

        setTimeout(() => {
          interaction.channel
            ?.delete("DOUBLE.ANIME ticket kapatıldı")
            .catch(() => {});
        }, 5000);

        return;
      }

      // BAŞVURU MODALINI AÇ
      if (interaction.customId.startsWith("da_apply:")) {
        const kind = interaction.customId.split(":")[1];

        const modal = new ModalBuilder()
          .setCustomId(`da_apply_submit:${kind}`)
          .setTitle(
            kind === "yetkili"
              ? "Yetkili Başvurusu"
              : "Ekip Başvurusu"
          );

        const age = new TextInputBuilder()
          .setCustomId("age")
          .setLabel("Yaşın")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3);

        const activity = new TextInputBuilder()
          .setCustomId("activity")
          .setLabel("Günlük ne kadar aktifsin?")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200);

        const experience = new TextInputBuilder()
          .setCustomId("experience")
          .setLabel("Deneyimin var mı?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        const reason = new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Neden başvuruyorsun?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        modal.addComponents(
          new ActionRowBuilder().addComponents(age),
          new ActionRowBuilder().addComponents(activity),
          new ActionRowBuilder().addComponents(experience),
          new ActionRowBuilder().addComponents(reason)
        );

        return interaction.showModal(modal);
      }
    }

    // ----------------------------------------------
    // BAŞVURU FORMU GÖNDERİMİ
    // ----------------------------------------------

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("da_apply_submit:")
    ) {
      const kind = interaction.customId.split(":")[1];

      const settings =
        store.read("settings.json", {})[interaction.guildId] || {};

      const targetId = settings.applicationChannelId;

      if (!targetId) {
        return interaction.reply({
          content: "Başvuru kanalı ayarlanmamış. Yönetimden /basvuru-panel komutunu yeniden kurmasını iste.",
          ephemeral: true
        });
      }

      const target = await interaction.guild.channels
        .fetch(targetId)
        .catch(() => null);

      if (!target?.isTextBased()) {
        return interaction.reply({
          content: "Başvuru kanalı bulunamadı.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(
          `${config.prefix} ${
            kind === "yetkili"
              ? "Yetkili Başvurusu"
              : "Ekip Başvurusu"
          }`
        )
        .setDescription(
          `Başvuran: ${interaction.user} (\`${interaction.user.id}\`)`
        )
        .addFields(
          {
            name: "Yaş",
            value: interaction.fields.getTextInputValue("age"),
            inline: true
          },
          {
            name: "Aktiflik",
            value: interaction.fields.getTextInputValue("activity")
          },
          {
            name: "Deneyim",
            value: interaction.fields.getTextInputValue("experience")
          },
          {
            name: "Başvuru nedeni",
            value: interaction.fields.getTextInputValue("reason")
          }
        )
        .setFooter({ text: config.footer })
        .setTimestamp();

      await target.send({ embeds: [embed] });

      return interaction.reply({
        content: "Başvurun gönderildi. Zaman ayırdığın için teşekkürler! ♡",
        ephemeral: true
      });
    }

  } catch (error) {
    console.error("Etkileşim hatası:", error);

    const payload = {
      content: "İşlem sırasında hata oluştu. Bot izinlerini ve kanal ayarlarını kontrol et.",
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else if (interaction.isRepliable()) {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

// ==================================================
// LEVEL SİSTEMİ
// ==================================================
// XP ve seviye yönetimi events klasöründeki event dosyasına
// bırakılmıştır. Burada ikinci bir messageCreate XP sistemi yoktur.
// ==================================================

// ==================================================
// BOTU BAŞLAT
// ==================================================

client.login(config.token).catch(error => {
  console.error(
    "❌ Discord giriş hatası. Token ve uygulama ayarlarını kontrol et.",
    error
  );
});

