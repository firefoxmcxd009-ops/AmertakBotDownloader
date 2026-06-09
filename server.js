require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execFile, spawnSync } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

/*
========================================
APP INIT
========================================
*/
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/*
========================================
IN-MEMORY HISTORY (NEW DASHBOARD FEATURE)
========================================
*/
const userHistory = new Map(); 
// format: userId => [{type,url,time}]

function addHistory(userId, type, url) {
  if (!userHistory.has(userId)) userHistory.set(userId, []);
  userHistory.get(userId).push({
    type,
    url,
    time: new Date().toISOString(),
  });
}

/*
========================================
DASHBOARD UI (DARK MODE)
========================================
*/
function dashboardHTML(userId) {
  const history = userHistory.get(String(userId)) || [];

  const items = history
    .slice()
    .reverse()
    .map(
      (h) => `
      <div class="card">
        <div class="type">${h.type}</div>
        <div class="url">${h.url}</div>
        <div class="time">${h.time}</div>
      </div>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
<title>Downloader Dashboard</title>
<style>
body {
  margin:0;
  font-family: Arial;
  background:#0f0f0f;
  color:#fff;
}
.header {
  padding:20px;
  background:#111;
  font-size:20px;
  font-weight:bold;
}
.container {
  padding:15px;
}
.card {
  background:#1c1c1c;
  margin-bottom:10px;
  padding:10px;
  border-radius:10px;
  border:1px solid #333;
}
.type {
  color:#00ff99;
  font-weight:bold;
}
.url {
  color:#ccc;
  font-size:13px;
  word-break:break-all;
}
.time {
  font-size:11px;
  color:#777;
}
</style>
</head>

<body>
  <div class="header">📊 Amertak Downloader Dashboard (User: ${userId})</div>
  <div class="container">
    ${items || "<p>No history yet</p>"}
  </div>
</body>
</html>
`;
}

/*
========================================
DASHBOARD ROUTE (AUTO LOGIN BY ID)
========================================
*/
app.get("/dashboard/:id", (req, res) => {
  const id = req.params.id;
  res.send(dashboardHTML(id));
});

/*
========================================
MAIN PAGE
========================================
*/
app.get("/", (req, res) => {
  res.send("Bot Running ✅");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

/*
========================================
TELEGRAM BOT
========================================
*/
const TOKEN = process.env.BOT_TOKEN;

const bot = new TelegramBot(TOKEN, { polling: false });

/*
========================================
WEBHOOK CLEAR
========================================
*/
async function clearTelegramWebhook() {
  try {
    await axios.get(`https://api.telegram.org/bot${TOKEN}/deleteWebhook?drop_pending_updates=true`);
    console.log("✅ Webhook cleared");
  } catch (e) {
    console.log(e.message);
  }
}

/*
========================================
YT-DLP FIX (SAFE)
========================================
*/
let YTDLP_PATH = "yt-dlp";

async function ensureYtDlp() {
  const local = "/tmp/yt-dlp";

  const check = spawnSync("yt-dlp", ["--version"], { encoding: "utf8" });
  if (check.status === 0) return "yt-dlp";

  if (fs.existsSync(local)) return local;

  try {
    const url =
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

    const res = await axios.get(url, { responseType: "arraybuffer" });

    fs.writeFileSync(local, res.data);
    fs.chmodSync(local, 0o755);

    return local;
  } catch {
    return "yt-dlp";
  }
}

/*
========================================
CONFIG
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
    inline_keyboard: [[
      { text: "Tools", url: "https://tools-amertak.vercel.app" },
      { text: "Dashboard", url: `${BASE_URL}/dashboard/0` }
    ]]
  }
};

/*
========================================
START
========================================
*/
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🚀 Downloader Bot Ready", BUTTONS);
});

/*
========================================
MESSAGE HANDLER (KEEP LOGIC + ADD HISTORY)
========================================
*/
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  addHistory(chatId, "URL", text);

  if (text.includes("youtube.com") || text.includes("youtu.be")) {
    return bot.sendMessage(chatId, "YouTube Downloader", {
      reply_markup: {
        inline_keyboard: [[
          { text: "Video", callback_data: makeCallback("yt_mp4", text) },
          { text: "Audio", callback_data: makeCallback("yt_mp3", text) }
        ]]
      }
    });
  }

  if (text.includes("tiktok.com")) {
    return bot.sendMessage(chatId, "TikTok Downloader", {
      reply_markup: {
        inline_keyboard: [[
          { text: "Video", callback_data: makeCallback("tt_video", text) },
          { text: "Audio", callback_data: makeCallback("tt_audio", text) }
        ]]
      }
    });
  }

  if (text.includes("pinterest.com")) {
    return bot.sendMessage(chatId, "Pinterest Downloader", {
      reply_markup: {
        inline_keyboard: [[
          { text: "Image", callback_data: makeCallback("pin_image", text) }
        ]]
      }
    });
  }
});

/*
========================================
DASHBOARD COMMAND (NEW)
========================================
*/
bot.onText(/\/dashboard/, (msg) => {
  const url = `${BASE_URL}/dashboard/${msg.chat.id}`;
  bot.sendMessage(msg.chat.id, `📊 Your Dashboard:\n${url}`);
});

/*
========================================
CALLBACK (KEEP LOGIC + HISTORY)
========================================
*/
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const [action, id] = q.data.split("|");

  const url = pendingDownloads.get(id);
  pendingDownloads.delete(id);

  await bot.answerCallbackQuery(q.id, { text: "Processing..." });

  addHistory(chatId, action, url);

  if (action === "yt_mp4") return downloadYouTubeVideo(chatId, url);
  if (action === "yt_mp3") return downloadYouTubeAudio(chatId, url);
  if (action === "tt_video") return downloadTikTokVideo(chatId, url);
  if (action === "tt_audio") return downloadTikTokAudio(chatId, url);
  if (action === "pin_image") return downloadPinterest(chatId, url);
});

/*
========================================
DOWNLOAD FUNCTIONS (UNCHANGED LOGIC STYLE)
========================================
*/
async function downloadYouTubeVideo(chatId, url) {
  const file = Date.now() + ".mp4";
  const out = path.join(DOWNLOAD_DIR, file);

  execFile(YTDLP_PATH, ["-f", "mp4", "-o", out, url], async () => {
    if (fs.existsSync(out)) {
      await bot.sendVideo(chatId, fs.createReadStream(out));
      fs.unlinkSync(out);
    }
  });
}

async function downloadYouTubeAudio(chatId, url) {
  const file = Date.now() + ".mp3";
  const out = path.join(DOWNLOAD_DIR, file);

  execFile(YTDLP_PATH, ["-x", "--audio-format", "mp3", "-o", out, url], async () => {
    if (fs.existsSync(out)) {
      await bot.sendAudio(chatId, fs.createReadStream(out));
      fs.unlinkSync(out);
    }
  });
}

async function downloadTikTokVideo(chatId, url) {
  const { data } = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
  bot.sendVideo(chatId, data.data.play);
}

async function downloadTikTokAudio(chatId, url) {
  const { data } = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
  bot.sendAudio(chatId, data.data.music);
}

async function downloadPinterest(chatId, url) {
  const { data } = await axios.get(
    `https://pinterestdownloader.io/frontendService/DownloaderService?url=${encodeURIComponent(url)}`
  );
  bot.sendPhoto(chatId, data.medias[0].url);
}

/*
========================================
START BOT SAFE
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

  console.log("🚀 Bot fully running");
})();