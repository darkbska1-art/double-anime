# 𓍢ִ໋🌷͙֒・ DOUBLE.ANIME BOT

## Kurulum
1. Node.js 20+ kur.
2. `.env.example` dosyasını `.env` olarak kopyala ve üç alanı doldur.
3. Terminalde `npm install`, sonra `npm run deploy`, ardından `npm start` çalıştır.
4. Discord Developer Portal > Bot bölümünde **Server Members Intent** ve **Message Content Intent** seçeneklerini aç.
5. Botu `bot` ve `applications.commands` kapsamlarıyla sunucuya ekle. Gereken komut izinlerini ve rol sırasını ayarla.

## Render
GitHub'a `.env` dosyasını yükleme. Render Web Service ayarları: Build `npm install`, Start `npm start`. Environment Variables'a `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` ekle. Ücretsiz servislerde uyku/kapanma olabilir; kesintisiz 7/24 garantisi yoktur.

## Başlangıç komutları
- `/yardim`, `/ping`, `/sunucu-bilgi`, `/kullanici-bilgi`, `/avatar`
- `/temizle`, `/ban`, `/kick`, `/timeout`, `/timeout-kaldir`, `/rol-ver`, `/rol-al`, `/duyuru`
- `/log-ayarla`, `/otorol-ayarla`, `/ticket-kur`, `/basvuru-panel`
- `/bakiye`, `/gunluk`, `/calis`, `/seviye`

Ticket/başvuru/log/otorol ayarları sunucu bazlı `data/settings.json` dosyasına kaydedilir. `data` klasörünü kalıcı tutmak için Render'da uygun kalıcı disk kullan veya ileride veritabanına geç. Ücretsiz Render dosya sistemi yeniden dağıtımlarda sıfırlanabilir.

## Güvenlik
Bot tokenini paylaşma. Token sızarsa Developer Portal'dan yenile. Yetki komutlarını yalnızca güvendiğin yöneticilere aç.
