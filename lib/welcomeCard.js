
const { createCanvas, loadImage } = require("@napi-rs/canvas");

async function createWelcomeCard(member, type = "welcome") {
    const canvas = createCanvas(1200, 500);
    const ctx = canvas.getContext("2d");

    const isWelcome = type === "welcome";

    // Arka plan
    const gradient = ctx.createLinearGradient(0, 0, 1200, 500);
    gradient.addColorStop(0, "#160c2e");
    gradient.addColorStop(0.5, "#54216e");
    gradient.addColorStop(1, "#e879c5");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 500);

    // Dekoratif daireler
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc(
            (i * 137) % 1200,
            (i * 83) % 500,
            25 + (i % 4) * 12,
            0,
            Math.PI * 2
        );
        ctx.fillStyle = "#ffffff";
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Sağ taraftaki panel
    ctx.fillStyle = "rgba(15, 8, 28, 0.55)";
    ctx.beginPath();
    ctx.roundRect(420, 45, 730, 410, 30);
    ctx.fill();

    // Avatar
    const avatarURL = member.user.displayAvatarURL({
        extension: "png",
        size: 256
    });

    const avatar = await loadImage(avatarURL);

    ctx.save();
    ctx.beginPath();
    ctx.arc(250, 250, 120, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, 130, 130, 240, 240);
    ctx.restore();

    // Avatar çerçevesi
    ctx.beginPath();
    ctx.arc(250, 250, 126, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffb8ed";
    ctx.lineWidth = 8;
    ctx.stroke();

    // Başlık
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 58px sans-serif";
    ctx.fillText(isWelcome ? "HOŞ GELDİN!" : "GÖRÜŞÜRÜZ!", 785, 145);

    // Kullanıcı adı
    ctx.font = "bold 38px sans-serif";
    let username = member.user.username;
    if (username.length > 24) username = username.slice(0, 21) + "...";
    ctx.fillStyle = "#ffd4f4";
    ctx.fillText(username, 785, 220);

    // Açıklama
    ctx.font = "25px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
        isWelcome
            ? "DOUBLE.ANIME ailesine katıldı!"
            : "Ailemizin bir üyesi ayrıldı.",
        785,
        285
    );

    // Sunucu istatistiği
    const count = member.guild.memberCount;
    ctx.font = "22px sans-serif";
    ctx.fillStyle = "#f8d8ff";
    ctx.fillText(
        `Sunucu üye sayısı: ${count}`,
        785,
        350
    );

    ctx.font = "bold 23px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("DOUBLE.ANIME • ANIME COMMUNITY", 785, 410);

    return canvas.toBuffer("image/png");
}

module.exports = { createWelcomeCard };