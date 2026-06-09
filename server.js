require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execFile, spawnSync } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

/*
========================================
EXPRESS SERVER (KEEP SAME)
========================================
*/

const app = express();

app.get("/", (req, res) => {
  res.send("Bot Running ✅");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

/*
========================================
WEBHOOK CLEAR (KEEP SAME)
========================================
*/

const TOKEN = process.env.BOT_TOKEN;

async function clearTelegramWebhook() {
  try {
    await axios.get(`https://api.telegram.org/bot${TOKEN}/deleteWebhook`);
    console.log("✅ Old webhook removed");
  } catch (err) {
    console.log("deleteWebhook error:", err.message || err);
  }
}

/*
========================================
FIXED yt-dlp (ONLY FIX AREA)
========================================
*/

let YTDLP_PATH = null;

async function ensureYtDlp() {
  const localExe = "/tmp/yt-dlp";

  // 1. system yt-dlp
  try {
    const check = spawnSync("yt-dlp", ["--version"], { encoding: "utf8" });
    if (check.status === 0) {
      YTDLP_PATH = "yt-dlp";
      console.log("✅ yt-dlp system OK");
      return "yt-dlp";
    }
  } catch (e) {}

  // 2. local binary
  if (fs.existsSync(localExe)) {
    fs.chmodSync(localExe, 0o755);
    YTDLP_PATH = localExe;
    console.log("✅ yt-dlp local OK");
    return localExe;
  }

  // 3. download
  try {
    console.log("⬇️ downloading yt-dlp...");

    const url =
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

    const res = await axios.get(url, { responseType: "arraybuffer" });

    fs.writeFileSync(localExe, res.data);
    fs.chmodSync(localExe, 0o755);

    YTDLP_PATH = localExe;
    console.log("✅ yt-dlp installed");

    return localExe;
  } catch (e) {
    console.log("❌ yt-dlp fail:", e.message);
    YTDLP_PATH = "yt-dlp";
    return "yt-dlp";
  }
}

/*
========================================
BOT INIT (KEEP SAME LOGIC)
========================================
*/

const bot = new TelegramBot(TOKEN, { polling: false });

bot.on("polling_error", async (err) => {
  console.log("polling_error:", err.message);

  if (err.message && err.message.includes("409")) {
    try { await bot.deleteWebHook(); } catch {}
    try { await bot.stopPolling(); } catch {}

    setTimeout(() => {
      bot.startPolling({
        params: {
          timeout: 30,
          limit: 100,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
        },
      });
    }, 1500);
  }
});

/*
========================================
ANTI CRASH (KEEP)
========================================
*/
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/*
========================================
CONFIG (KEEP SAME)
========================================
*/

const DOWNLOAD_DIR = "/tmp";

const pendingDownloads = new Map();

function makeCallback(action, url) {
  const id = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  pendingDownloads.set(id, url);
  return `${action}|${id}`;
}

const BASE_URL =
  process.env.BASE_URL || "https://AmertakBotDownloader.onrender.com";

const BUTTONS = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "Tools", url: "https://tools-amertak.vercel.app" },
        { text: "Dashboard", url: `${BASE_URL}/dashboard` },
      ],
    ],
  },
};

/*
========================================
START COMMAND (UNCHANGED)
========================================
*/

bot.onText(/\/start/, async (msg) => {
  bot.sendMessage(
    msg.chat.id,
`⚑ *សូមស្វាគមន៏មកកាន់ Amertak Bot Downloader*
✱ Commands:

✦ /dashboard - Open dashboard to view history download and redownload
✦ /clear - clear download history

✱ Supported Platforms

✦ YouTube
✦ TikTok
✦ Pinterest
✦ Spotify

✱ How to use - របៀបប្រើ

✦ (KHM) ផ្ញើលីងទៅកាន់ Bot រួចជ្រើសរើស formats
✦ (ENG) Send Link to bot and then choose a format button

✦ សូមផ្ញើរលីងដែលត្រឺមត្រូវ! ✦

⚑ *Owner: @Amertak_Network*`,
    BUTTONS
  );
});

/*
========================================
MESSAGE HANDLER (KEEP SAME LOGIC)
========================================
*/

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  if (text.includes("youtube.com") || text.includes("youtu.be")) {
    return bot.sendMessage(chatId, "YouTube Downloader", {
      reply_markup: {
        inline_keyboard: [[
          { text: "⮩ វីដេអូ", callback_data: makeCallback("yt_mp4", text) },
          { text: "⮩ សំឡេង", callback_data: makeCallback("yt_mp3", text) },
          { text: "⮩ Thumbnail", callback_data: makeCallback("yt_thumb", text) }
        ]]
      }
    });
  }

  if (text.includes("tiktok.com")) {
    return bot.sendMessage(chatId, "TikTok Downloader", {
      reply_markup: {
        inline_keyboard: [[
          { text: "⮩ វីដេអូ", callback_data: makeCallback("tt_video", text) },
          { text: "⮩ សំឡេង", callback_data: makeCallback("tt_audio", text) },
          { text: "⮩ រូបភាព", callback_data: makeCallback("tt_image", text) }
        ]]
      }
    });
  }

  if (text.includes("pinterest.com") || text.includes("pin.it")) {
    return bot.sendMessage(chatId, "Pinterest Downloader", {
      reply_markup: {
        inline_keyboard: [[
          { text: "⮩ ទាញយករូបភាព", callback_data: makeCallback("pin_image", text) }
        ]]
      }
    });
  }

  if (text.includes("spotify.com") || text.startsWith("spotify:")) {
    return spotifyInfo(chatId, text);
  }

  bot.sendMessage(chatId, "✘ Unsupported URL");
});

/*
========================================
CALLBACK (KEEP SAME LOGIC)
========================================
*/

bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const [action, id] = q.data.split("|");

  let url = pendingDownloads.get(id);
  pendingDownloads.delete(id);

  await bot.answerCallbackQuery(q.id, { text: "Processing..." });

  if (action === "yt_mp4") return downloadYouTubeVideo(chatId, url);
  if (action === "yt_mp3") return downloadYouTubeAudio(chatId, url);
  if (action === "tt_video") return downloadTikTokVideo(chatId, url);
  if (action === "tt_audio") return downloadTikTokAudio(chatId, url);
  if (action === "tt_image") return downloadTikTokImage(chatId, url);
  if (action === "pin_image") return downloadPinterest(chatId, url);
});

/*
========================================
YOUTUBE VIDEO (FIXED ONLY yt-dlp PATH)
========================================
*/

async function downloadYouTubeVideo(chatId, url) {
  const wait = await bot.sendMessage(chatId, "⏳ Downloading video...");

  const file = Date.now().toString();
  const out = path.join(DOWNLOAD_DIR, `${file}.mp4`);

  const args = [
    "-f",
    "bv*[height<=480]+ba/b[height<=480]",
    "--merge-output-format",
    "mp4",
    "--no-playlist",
    "--force-ipv4",
    "-o",
    out,
    url,
  ];

  execFile(YTDLP_PATH, args, async (err) => {
    if (err || !fs.existsSync(out)) {
      await bot.sendMessage(chatId, "✘ Video failed");
      return bot.deleteMessage(chatId, wait.message_id).catch(() => {});
    }

    await bot.sendVideo(chatId, fs.createReadStream(out));
    fs.unlinkSync(out);
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  });
}

/*
========================================
YOUTUBE AUDIO (FIXED ONLY yt-dlp PATH)
========================================
*/

async function downloadYouTubeAudio(chatId, url) {
  const wait = await bot.sendMessage(chatId, "⏳ Downloading audio...");

  const file = Date.now().toString();
  const out = path.join(DOWNLOAD_DIR, `${file}.mp3`);

  const args = [
    "-x",
    "--audio-format",
    "mp3",
    "--no-playlist",
    "-o",
    out,
    url,
  ];

  execFile(YTDLP_PATH, args, async (err) => {
    if (err || !fs.existsSync(out)) {
      await bot.sendMessage(chatId, "✘ Audio failed");
      return bot.deleteMessage(chatId, wait.message_id).catch(() => {});
    }

    await bot.sendAudio(chatId, fs.createReadStream(out));
    fs.unlinkSync(out);
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  });
}

/*
========================================
TIKTOK (UNCHANGED LOGIC)
========================================
*/

async function tiktokVideo(chatId, url) {
  const { data } = await axios.get(
    `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
  );
  bot.sendVideo(chatId, data.data.play);
}

async function tiktokAudio(chatId, url) {
  const { data } = await axios.get(
    `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
  );
  bot.sendAudio(chatId, data.data.music);
}

async function tiktokImage(chatId, url) {
  const { data } = await axios.get(
    `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
  );
  bot.sendPhoto(chatId, data.data.cover);
}

/*
========================================
PINTEREST (UNCHANGED)
========================================
*/

async function downloadPinterest(chatId, url) {
  const { data } = await axios.get(
    `https://pinterestdownloader.io/frontendService/DownloaderService?url=${encodeURIComponent(url)}`
  );
  bot.sendPhoto(chatId, data.medias[0].url);
}

/*
========================================
SPOTIFY (UNCHANGED)
========================================
*/

async function spotifyInfo(chatId, url) {
  const { data } = await axios.get(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
  );

  bot.sendPhoto(chatId, data.thumbnail_url, {
    caption: `🎵 ${data.title}\n👤 ${data.author_name}`,
  });
}

/*
========================================
START BOT
========================================
*/

(async () => {
  YTDLP_PATH = await ensureYtDlp();
  await clearTelegramWebhook();

  bot.startPolling({
    params: {
      timeout: 30,
      limit: 100,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    },
  });
})();