require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execFile, spawnSync } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

/*
========================================
EXPRESS SERVER
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
TELEGRAM SETUP
========================================
*/

const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: false });

/*
========================================
ANTI CRASH
========================================
*/

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/*
========================================
WEBHOOK CLEAR
========================================
*/

async function clearTelegramWebhook() {
  try {
    await axios.get(`https://api.telegram.org/bot${TOKEN}/deleteWebhook`);
    console.log("✅ Webhook cleared");
  } catch (e) {
    console.log("Webhook error:", e.message);
  }
}

/*
========================================
YT-DLP FIXED LOADER (IMPORTANT FIX)
========================================
*/

let YTDLP_PATH = "yt-dlp";

async function ensureYtDlp() {
  const candidates = [
    path.join(__dirname, "yt-dlp.exe"),
    "/usr/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
    "/tmp/yt-dlp",
    "yt-dlp"
  ];

  for (const c of candidates) {
    try {
      const check = spawnSync(c, ["--version"], { encoding: "utf8" });
      if (check.status === 0) {
        console.log("✅ yt-dlp found:", c);
        return c;
      }
    } catch (e) {}
  }

  console.log("⚠ yt-dlp not found, fallback to system install");
  return "yt-dlp";
}

/*
========================================
DOWNLOAD STORAGE
========================================
*/

const DOWNLOAD_DIR = "/tmp";

/*
========================================
CALLBACK STORAGE
========================================
*/

const pendingDownloads = new Map();

function makeCallback(action, url) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  pendingDownloads.set(id, url);
  return `${action}|${id}`;
}

/*
========================================
START MESSAGE
========================================
*/

const BASE_URL = process.env.BASE_URL || "https://your-render-app.onrender.com";

const BUTTONS = {
  reply_markup: {
    inline_keyboard: [[
      { text: "Tools", url: "https://tools-amertak.vercel.app" },
      { text: "Dashboard", url: `${BASE_URL}/dashboard` }
    ]]
  }
};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
`⚑ សូមស្វាគមន៍ Bot Downloader

✦ YouTube
✦ TikTok
✦ Pinterest
✦ Spotify

ផ្ញើ link មក bot ដើម្បីចាប់ផ្តើម`, BUTTONS);
});

/*
========================================
MESSAGE HANDLER
========================================
*/

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith("/")) return;

  if (text.includes("youtube.com") || text.includes("youtu.be")) {
    return bot.sendMessage(chatId, "Choose format", {
      reply_markup: {
        inline_keyboard: [[
          { text: "Video", callback_data: makeCallback("yt_mp4", text) },
          { text: "Audio", callback_data: makeCallback("yt_mp3", text) },
          { text: "Thumb", callback_data: makeCallback("yt_thumb", text) }
        ]]
      }
    });
  }

  if (text.includes("tiktok.com")) {
    return bot.sendMessage(chatId, "TikTok format", {
      reply_markup: {
        inline_keyboard: [[
          { text: "Video", callback_data: makeCallback("tt_video", text) },
          { text: "Audio", callback_data: makeCallback("tt_audio", text) }
        ]]
      }
    });
  }

  bot.sendMessage(chatId, "Unsupported link");
});

/*
========================================
CALLBACK HANDLER
========================================
*/

bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  await bot.answerCallbackQuery(q.id);

  const [action, id] = q.data.split("|");

  let url = pendingDownloads.get(id);
  pendingDownloads.delete(id);

  if (!url) return bot.sendMessage(chatId, "Invalid request");

  if (action === "yt_mp4") return downloadYouTubeVideo(chatId, url);
  if (action === "yt_mp3") return downloadYouTubeAudio(chatId, url);
  if (action === "yt_thumb") return downloadThumbnail(chatId, url);
});

/*
========================================
YT VIDEO FIXED
========================================
*/

async function downloadYouTubeVideo(chatId, url) {
  const msg = await bot.sendMessage(chatId, "⏳ Downloading video...");

  const prefix = Date.now().toString();
  const output = path.join(DOWNLOAD_DIR, `${prefix}.%(ext)s`);

  const args = [
    "-f",
    "bv*+ba/b",
    "--merge-output-format",
    "mp4",
    "-o",
    output,
    url
  ];

  execFile(YTDLP_PATH, args, { timeout: 300000 }, async (err) => {
    const file = findFile(prefix);

    if (err || !file) {
      console.log("YT ERROR:", err);
      await bot.sendMessage(chatId, "❌ Download failed");
      return bot.deleteMessage(chatId, msg.message_id);
    }

    await bot.sendVideo(chatId, fs.createReadStream(file));
    cleanup(prefix);
    bot.deleteMessage(chatId, msg.message_id);
  });
}

/*
========================================
YT AUDIO FIXED
========================================
*/

async function downloadYouTubeAudio(chatId, url) {
  const msg = await bot.sendMessage(chatId, "⏳ Downloading audio...");

  const prefix = Date.now().toString();
  const output = path.join(DOWNLOAD_DIR, `${prefix}.%(ext)s`);

  const args = [
    "-f",
    "bestaudio",
    "-x",
    "--audio-format",
    "mp3",
    "-o",
    output,
    url
  ];

  execFile(YTDLP_PATH, args, { timeout: 300000 }, async (err) => {
    const file = findFile(prefix);

    if (err || !file) {
      console.log("AUDIO ERROR:", err);
      await bot.sendMessage(chatId, "❌ Audio failed");
      return bot.deleteMessage(chatId, msg.message_id);
    }

    await bot.sendAudio(chatId, fs.createReadStream(file));
    cleanup(prefix);
    bot.deleteMessage(chatId, msg.message_id);
  });
}

/*
========================================
THUMBNAIL
========================================
*/

async function downloadThumbnail(chatId, url) {
  const msg = await bot.sendMessage(chatId, "⏳ Fetching thumbnail...");

  execFile(YTDLP_PATH, ["--get-thumbnail", url], async (err, stdout) => {
    if (err) return bot.sendMessage(chatId, "❌ Thumbnail failed");

    await bot.sendPhoto(chatId, stdout.trim());
    bot.deleteMessage(chatId, msg.message_id);
  });
}

/*
========================================
FILE HELPERS (FIXED)
========================================
*/

function findFile(prefix) {
  const files = fs.readdirSync(DOWNLOAD_DIR);
  return files
    .filter(f => f.startsWith(prefix))
    .map(f => path.join(DOWNLOAD_DIR, f))[0];
}

function cleanup(prefix) {
  fs.readdirSync(DOWNLOAD_DIR).forEach(f => {
    if (f.startsWith(prefix)) {
      try { fs.unlinkSync(path.join(DOWNLOAD_DIR, f)); } catch {}
    }
  });
}

/*
========================================
START BOT (FIX FOR RENDER)
========================================
*/

(async () => {
  YTDLP_PATH = await ensureYtDlp();

  await clearTelegramWebhook();

  bot.startPolling({
    interval: 300,
    params: {
      timeout: 30,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true
    }
  });

  console.log("🚀 Bot running (Render Ready)");
})();