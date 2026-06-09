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
CLEAR OLD WEBHOOK
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

process.env.PATH += ":/usr/local/bin";

/*
========================================
yt-dlp helper
========================================
*/

// Ensure yt-dlp is available (use system binary or download yt-dlp.exe on Windows)
let YTDLP_PATH = "/tmp/yt-dlp";

async function ensureYtDlp() {
  const localExe = process.platform === "win32"
  ? path.join(__dirname, "yt-dlp.exe")
  : "/tmp/yt-dlp";

  try {
    const check = spawnSync(YTDLP_PATH, ["--version"], { encoding: "utf8" });
    if (check.status === 0) {
      console.log("yt-dlp found in PATH:", check.stdout.trim());
      return YTDLP_PATH;
    }
  } catch (e) {}

  if (fs.existsSync(localExe)) {
  console.log("Using local yt-dlp at", localExe);
  YTDLP_PATH = localExe;
  return localExe;
}

  // Attempt to download yt-dlp for Windows (exe) or Unix binary
  try {
    console.log("yt-dlp not found in PATH — downloading...");
    const downloadUrl = process.platform === 'win32'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

    const resp = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(localExe, resp.data);
    try { fs.chmodSync(localExe, 0o755); } catch (e) {}
    console.log('Downloaded yt-dlp to', localExe);
    return localExe;
  } catch (e) {
    console.warn('Failed to download yt-dlp:', e.message || e);
    return YTDLP_PATH; // fall back — will likely error later
  }

}


const bot = new TelegramBot(TOKEN, { polling: false });

// Handle polling errors (e.g., 409 conflict when another instance is running)
bot.on("polling_error", async (err) => {
  console.error("error: [polling_error]", err && err.message ? err.message : err);

  try {
    if (err && err.code === "ETELEGRAM" && err.message && err.message.includes("409")) {
      try { await bot.deleteWebHook(); } catch (e) { console.error("deleteWebHook error", e); }
      try { await bot.stopPolling(); } catch (e) {}
      setTimeout(() => {
        try { bot.startPolling({ params: { timeout: 30, limit: 100, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true } }); } catch (e) { console.error("failed restart", e); }
      }, 1500);
    }
  } catch (e) { console.error(e); }

});

/*
========================================
ANTI CRASH
========================================
*/

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/*
========================================
STOP POLLING
========================================
*/

process.on("SIGINT", async () => {
  console.log("Stopping bot...");
  try { await bot.stopPolling(); } catch {}
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Stopping bot...");
  try { await bot.stopPolling(); } catch {}
  process.exit(0);
});

/*
========================================
DOWNLOADS
========================================
*/

const DOWNLOAD_DIR = "/tmp";

console.log("🚀 Downloader Bot Running");

// In-memory store to avoid exceeding Telegram callback_data limits
const pendingDownloads = new Map();
function makeCallback(action, url) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  pendingDownloads.set(id, url);
  return `${action}|${id}`;
}

const BASE_URL = process.env.BASE_URL || 'https://AmertakBotDownloader.onrender.com';
const BUTTONS = {
  reply_markup: {
    inline_keyboard: [[
      { text: 'Tools', url: 'https://tools-amertak.vercel.app' },
      { text: 'Dashboard', url: `${BASE_URL}/dashboard` }
    ]]
  }
};
/*
========================================
START
========================================
*/

bot.onText(/\/start/, async (msg) => {
  bot.sendMessage(msg.chat.id,
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

⚑ *Owner: @Amertak_Network*`, BUTTONS);
});

/*
========================================
MESSAGE HANDLER
========================================
*/

bot.on("message", async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;
    if (text.startsWith("/")) return;

    if (text.includes("youtube.com") || text.includes("youtu.be")) {
      const ytOpts = {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[
          { text: "⮩ វីដេអូ", callback_data: makeCallback("yt_mp4", text) },
          { text: "⮩ សំឡេង", callback_data: makeCallback("yt_mp3", text) },
          { text: "⮩ Thumbnail", callback_data: makeCallback("yt_thumb", text) }
        ]] }
      };
      return bot.sendMessage(chatId, `⚑ *YouTube Downloader*\n\nChoose format ⮯`, ytOpts);
    }

    if (text.includes("tiktok.com")) {
      const ttOpts = { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[
        { text: "⮩ វីដេអូ", callback_data: makeCallback("tt_video", text) },
        { text: "⮩ សំឡេង", callback_data: makeCallback("tt_audio", text) },
        { text: "⮩ រូបភាព", callback_data: makeCallback("tt_image", text) }
      ]] } };
      return bot.sendMessage(chatId, `⚑ *TikTok Downloader*\n\nChoose format ⮯`, ttOpts);
    }

    if (text.includes("pinterest.com") || text.includes("pin.it")) {
      const pinOpts = { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "⮩ ទាញយករូបភាព", callback_data: makeCallback("pin_image", text) }]
      ] } };
      return bot.sendMessage(chatId, `⚑ *Pinterest Downloader*\n\nChoose format ⮯`, pinOpts);
    }

    if (text.includes("spotify.com") || text.startsWith("spotify:")) return spotifyInfo(chatId, text);

    bot.sendMessage(chatId, "✘ Unsupported URL");
  } catch (err) { console.log(err); }
});

/*
========================================
BUTTON HANDLER
========================================
*/

bot.on("callback_query", async (query) => {
  try {
    if (!query || !query.data || !query.message) return;
    await bot.answerCallbackQuery(query.id, { text: "Processing...", show_alert: false });
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msgId }).catch(() => {});
    const data = query.data.split("|");
    const action = data[0];
    const key = data[1];
    let url = key;
    if (pendingDownloads.has(key)) {
      url = pendingDownloads.get(key);
      pendingDownloads.delete(key);
    }

    if (action === "yt_mp4") return downloadYouTubeVideo(chatId, url);
    if (action === "yt_mp3") return downloadYouTubeAudio(chatId, url);
    if (action === "yt_thumb") return downloadYouTubeThumbnail(chatId, url);
    if (action === "tt_video") return downloadTikTokVideo(chatId, url);
    if (action === "tt_audio") return downloadTikTokAudio(chatId, url);
    if (action === "tt_image") return downloadTikTokImage(chatId, url);
    if (action === "pin_image") return downloadPinterest(chatId, url);

    await bot.sendMessage(chatId, "✘ Unknown action");
  } catch (err) {
    console.log(err);
  }
});

/*
========================================
YOUTUBE VIDEO
========================================
*/

async function downloadYouTubeVideo(chatId, url) {
  const wait = await bot.sendMessage(chatId, "⏳ Downloading video...");
  const filePrefix = Date.now().toString();
  const outputTemplate = path.join(DOWNLOAD_DIR, `${filePrefix}.%(ext)s`);
  const args = [
  "-f",
  "bv*[height<=480]+ba/b[height<=480]",
  "--merge-output-format",
  "mp4",
  "--force-ipv4",
  "--no-playlist",
  "--no-warnings",
  "--no-check-certificates",
  "--restrict-filenames",
  "--max-filesize",
  "50M",
  "-o",
  outputTemplate,
  url
];

  execFile(
  YTDLP_PATH,
  args,
  {
    timeout: 1000 * 60 * 5,
    maxBuffer: 1024 * 1024 * 10
  }, async (err, stdout, stderr) => {
    const outputFile = findDownloadedFile(filePrefix);
    if (err || !outputFile) {
      console.log("yt-dlp video error:", err || "no output file", stderr || stdout);
      await bot.sendMessage(chatId, "✘ Video failed");
      cleanupDownloadedFiles(filePrefix);
      bot.deleteMessage(chatId, wait.message_id).catch(() => {});
      return;
    }

    try {
      await bot.sendVideo(chatId, fs.createReadStream(outputFile), { caption: "✓ YouTube Video" });
    } catch (e) {
      console.log("sendVideo error:", e);
      await bot.sendMessage(chatId, "✘ Video upload failed");
    }

    cleanupDownloadedFiles(filePrefix);
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  });
}

/*
========================================
YOUTUBE AUDIO
========================================
*/

async function downloadYouTubeAudio(chatId, url) {
  const wait = await bot.sendMessage(chatId, "⏳ Downloading audio...");
  const filePrefix = Date.now().toString();
  const outputTemplate = path.join(DOWNLOAD_DIR, `${filePrefix}.%(ext)s`);
  const args = [
  "-f",
  "bestaudio",
  "-x",
  "--audio-format",
  "mp3",
  "--force-ipv4",
  "--no-playlist",
  "--no-warnings",
  "--no-check-certificates",
  "--restrict-filenames",
  "-o",
  outputTemplate,
  url
];

  execFile(
  YTDLP_PATH,
  args,
  {
    timeout: 1000 * 60 * 5,
    maxBuffer: 1024 * 1024 * 10
  },
  async (err, stdout, stderr) => {
    const outputFile = findDownloadedFile(filePrefix);
    if (err || !outputFile) {
      console.log("yt-dlp audio error:", err || "no output file", stderr || stdout);
      await bot.sendMessage(chatId, "✘ Audio failed");
      cleanupDownloadedFiles(filePrefix);
      bot.deleteMessage(chatId, wait.message_id).catch(() => {});
      return;
    }

    try {
      await bot.sendAudio(chatId, fs.createReadStream(outputFile), { caption: "✓ YouTube Audio" });
    } catch (e) {
      console.log("sendAudio error:", e);
      await bot.sendMessage(chatId, "✘ Audio upload failed");
    }

    cleanupDownloadedFiles(filePrefix);
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  });
}

function findDownloadedFile(prefix) {
  const files = fs.readdirSync(DOWNLOAD_DIR);
  const matched = files.find((name) => name.startsWith(`${prefix}.`));
  return matched ? path.join(DOWNLOAD_DIR, matched) : null;
}

function cleanupDownloadedFiles(prefix) {
  const files = fs.readdirSync(DOWNLOAD_DIR);
  files.forEach((name) => {
    if (name.startsWith(`${prefix}.`)) {
      try { fs.unlinkSync(path.join(DOWNLOAD_DIR, name)); } catch (e) { console.log("cleanup failed", e); }
    }
  });
}

/*
========================================
YOUTUBE THUMBNAIL
========================================
*/

async function downloadYouTubeThumbnail(chatId, url) {
  const wait = await bot.sendMessage(chatId, "⏳ Fetching thumbnail...");

  execFile(
    YTDLP_PATH,
    ["--get-thumbnail", "--force-ipv4", url],
    async (err, stdout) => {
      if (err) {
        console.log(err);
        await bot.sendMessage(chatId, "✘ Thumbnail failed");
      } else {
        try {
          await bot.sendPhoto(chatId, stdout.trim(), {
            caption: "🖼 YouTube Thumbnail"
          });
        } catch (e) {
          console.log(e);
        }
      }

      bot.deleteMessage(chatId, wait.message_id).catch(() => {});
    }
  );
}

/*
========================================
TIKTOK / PINTEREST / SPOTIFY handlers (unchanged)
========================================
*/

async function downloadTikTokVideo(chatId, url) {
  const wait = await bot.sendMessage(chatId, "⏳ Downloading TikTok...");
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);
    await bot.sendVideo(chatId, data.data.play, { caption: "✓ TikTok Video" });
  } catch (err) { console.log(err); bot.sendMessage(chatId, "✘ TikTok failed"); }
  bot.deleteMessage(chatId, wait.message_id).catch(() => {});
}

async function downloadTikTokAudio(chatId, url) {
  const wait = await bot.sendMessage(chatId, "⏳ Downloading audio...");
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);
    await bot.sendAudio(chatId, data.data.music, { caption: "✓ TikTok Audio" });
  } catch (err) { console.log(err); bot.sendMessage(chatId, "✘ Audio failed"); }
  bot.deleteMessage(chatId, wait.message_id).catch(() => {});
}

async function downloadTikTokImage(chatId, url) {
  const wait = await bot.sendMessage(chatId, "⏳ Fetching image...");
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);
    await bot.sendPhoto(chatId, data.data.cover, { caption: "✓ TikTok Image" });
  } catch (err) { console.log(err); bot.sendMessage(chatId, "✘ Image failed"); }
  bot.deleteMessage(chatId, wait.message_id).catch(() => {});
}

async function downloadPinterest(chatId, url) {
  const wait = await bot.sendMessage(chatId, "⏳ Downloading Pinterest...");
  try {
    const api = `https://pinterestdownloader.io/frontendService/DownloaderService?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);
    const media = data.medias[0].url;
    await bot.sendPhoto(chatId, media, { caption: "✓ Pinterest Image" });
  } catch (err) { console.log(err); bot.sendMessage(chatId, "✘ Pinterest failed"); }
  bot.deleteMessage(chatId, wait.message_id).catch(() => {});
}

async function spotifyInfo(chatId, url) {
  const wait = await bot.sendMessage(chatId, "⏳ Fetching Spotify...");
  try {
    const normalizedUrl = normalizeSpotifyUrl(url);
    const api = `https://open.spotify.com/oembed?url=${encodeURIComponent(normalizedUrl)}`;
    let { data } = await axios.get(api).catch(() => ({ data: null }));
    let thumb = data && data.thumbnail_url ? data.thumbnail_url : null;
    let title = data && data.title ? data.title : null;
    let author = data && data.author_name ? data.author_name : null;

    if (!thumb || !title) {
      try {
        const page = await axios.get(normalizedUrl);
        const html = page.data;
        const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
        const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
        const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
        if (imgMatch) thumb = thumb || imgMatch[1];
        if (titleMatch) title = title || titleMatch[1];
        if (authorMatch) author = author || authorMatch[1];
      } catch (pageErr) {
        console.log("spotify page scrape failed", pageErr.message || pageErr);
      }
    }

    if (!thumb) {
      await bot.sendMessage(chatId, "✘ Spotify thumbnail unavailable");
      return;
    }

    await bot.sendPhoto(chatId, thumb, {
      caption: `🎵 Spotify Track\n\n📌 ${title || 'Unknown'}\n\n👤 ${author || 'Unknown'}`
    });
  } catch (err) {
    console.log(err);
    await bot.sendMessage(chatId, "✘ Spotify failed");
  } finally {
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  }
}

function normalizeSpotifyUrl(url) {
  if (!url) return url;
  if (url.startsWith('spotify:')) {
    const parts = url.split(':');
    if (parts.length >= 3) return `https://open.spotify.com/${parts[1]}/${parts[2]}`;
  }
  if (url.startsWith('http')) return url;
  if (url.startsWith('www.')) return `https://${url}`;
  return url;
}

// Start polling once yt-dlp check/download has been attempted
(async () => {
  YTDLP_PATH = await ensureYtDlp();
  await clearTelegramWebhook();
  try {
    await bot.startPolling({
  interval: 300,
  autoStart: true,
  params: {
    timeout: 30,
    limit: 100,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true
  }
});
  } catch (e) {
    console.error('startPolling failed', e);
  }
})();
