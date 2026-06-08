require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { exec, execFile, spawnSync } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

/*
========================================
EXPRESS SERVER (must start first for Render)
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

// Try to remove any old webhook
(async () => {
  try {
    await axios.get(`https://api.telegram.org/bot${TOKEN}/deleteWebhook`);
    console.log("✅ Old webhook removed");
  } catch (err) {
    console.log("deleteWebhook error:", err.message || err);
  }
})();

/*
========================================
yt-dlp helper
========================================
*/

// Ensure yt-dlp is available (use system binary or download yt-dlp.exe on Windows)
let YTDLP_PATH = "yt-dlp";

async function ensureYtDlp() {
  const localExe = path.join(__dirname, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

  try {
    const check = spawnSync(YTDLP_PATH, ["--version"], { encoding: "utf8" });
    if (check.status === 0) {
      console.log("yt-dlp found in PATH:", check.stdout.trim());
      return YTDLP_PATH;
    }
  } catch (e) {}

  if (fs.existsSync(localExe)) {
    console.log("Using local yt-dlp at", localExe);
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

// initialize YTDLP_PATH asynchronously (before starting polling)
(async () => { YTDLP_PATH = await ensureYtDlp(); })();

/*
========================================
BOT (create without polling, start after init)
========================================
*/

const bot = new TelegramBot(TOKEN, { polling: false });

// Handle polling errors (e.g., 409 conflict when another instance is running)
bot.on("polling_error", async (err) => {
  console.error("error: [polling_error]", err && err.message ? err.message : err);

  try {
    if (err && err.code === "ETELEGRAM" && err.message && err.message.includes("409")) {
      await axios.get(`https://api.telegram.org/bot${TOKEN}/deleteWebhook`);
      try { await bot.stopPolling(); } catch (e) {}
      setTimeout(() => {
        try { bot.startPolling(); } catch (e) { console.error("failed restart", e); }
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

const DOWNLOAD_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

console.log("🚀 Downloader Bot Running");

// In-memory store to avoid exceeding Telegram callback_data limits
const pendingDownloads = new Map();
function makeCallback(action, url) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  pendingDownloads.set(id, url);
  return `${action}|${id}`;
}
const userid = message.chat.id;
const BASE_URL = 'process.env.BASE_URL';
const BUTTONS = {
  reply_markup: {
    inline_keyboard: [[
      {text: 'Tools', url: 'https://tools-amertak.vercel.app'},
      {text: 'Dashboard', web_app: {
        url: BASE_URL + '/dashboard?id=' + userid
      }}
    ]]
  }
}
/*
========================================
START
========================================
*/

bot.onText(/\/start/, async (msg) => {
  bot.sendMessage(msg.chat.id,
`⚑ *សូមស្វាគមន៏មកកាន់ Amertak Bot Downloader*
✱ Commands:

⮞ /dashboard - Open dashboard to view history download and redownload
⮞ /clear - clear download history

✱ Supported Platforms

⮞ YouTube
⮞ TikTok
⮞ Pinterest
⮞ Spotify

✱ How to use - របៀបប្រើ

⮩ (KHM) ផ្ញើលីងទៅកាន់ Bot រួចជ្រើសរើស formats
⮩ (ENG) Send Link to bot and then choose a format button

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
          { text: "⮩​​ វីដេអូ", callback_data: makeCallback("yt_mp4", text) },
          { text: "⮩ សំឡេង", callback_data: makeCallback("yt_mp3", text) },
          { text: "⮩ Thumbnail", callback_data: makeCallback("yt_thumb", text) }
        ]] }
      };
      return bot.sendMessage(chatId, `⚑ *YouTube Downloader*\n\nChoose format ⮯`, ytOpts);
    }

    if (text.includes("tiktok.com")) {
      const ttOpts = { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[
        { text: "⮩ វីដេអូ", callback_data: makeCallback("tt_video", text) },
        { text: "⮩​ សំឡេង", callback_data: makeCallback("tt_audio", text) },
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
    await bot.answerCallbackQuery(query.id);
    const chatId = query.message.chat.id;
    const data = query.data.split("|");
    const action = data[0];
    let url = data[1];
    if (pendingDownloads.has(url)) { url = pendingDownloads.get(url); pendingDownloads.delete(data[1]); }

    if (action === "yt_mp4") return downloadYouTubeVideo(chatId, url);
    if (action === "yt_mp3") return downloadYouTubeAudio(chatId, url);
    if (action === "yt_thumb") return downloadYouTubeThumbnail(chatId, url);
    if (action === "tt_video") return downloadTikTokVideo(chatId, url);
    if (action === "tt_audio") return downloadTikTokAudio(chatId, url);
    if (action === "tt_image") return downloadTikTokImage(chatId, url);
    if (action === "pin_image") return downloadPinterest(chatId, url);

  } catch (err) { console.log(err); }
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
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--restrict-filenames",
    "-o",
    outputTemplate,
    url
  ];

  execFile(YTDLP_PATH, args, async (err, stdout, stderr) => {
    const outputFile = findDownloadedFile(filePrefix);
    if (err || !outputFile) {
      console.log("yt-dlp video error:", err || "no output file", stderr || stdout);
      await bot.sendMessage(chatId, "✘ Video failed");
      cleanupDownloadedFiles(filePrefix);
      bot.deleteMessage(chatId, wait.message_id).catch(() => {});
      return;
    }

    try {
      await bot.sendVideo(chatId, outputFile, { caption: "✓ YouTube Video" });
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
    "bestaudio[ext=m4a]/bestaudio/best",
    "--restrict-filenames",
    "-o",
    outputTemplate,
    url
  ];

  execFile(YTDLP_PATH, args, async (err, stdout, stderr) => {
    const outputFile = findDownloadedFile(filePrefix);
    if (err || !outputFile) {
      console.log("yt-dlp audio error:", err || "no output file", stderr || stdout);
      await bot.sendMessage(chatId, "✘ Audio failed");
      cleanupDownloadedFiles(filePrefix);
      bot.deleteMessage(chatId, wait.message_id).catch(() => {});
      return;
    }

    try {
      await bot.sendAudio(chatId, outputFile, { caption: "✓ YouTube Audio" });
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
  const binary = YTDLP_PATH.includes(' ') ? `"${YTDLP_PATH}"` : YTDLP_PATH;
  const cmd = `${binary} --get-thumbnail "${url}"`;

  exec(cmd, async (err, stdout) => {
    if (err) { console.log(err); await bot.sendMessage(chatId, "✘ Thumbnail failed"); }
    try { await bot.sendPhoto(chatId, stdout.trim(), { caption: "🖼 YouTube Thumbnail" }); } catch (e) { console.log(e); }
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  });
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
    const api = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);
    await bot.sendPhoto(chatId, data.thumbnail_url, { caption: `🎵 Spotify Track\n\n✘ ${data.title}\n\n👤 ${data.author_name}` });
  } catch (err) { console.log(err); bot.sendMessage(chatId, "✘ Spotify failed"); }
  bot.deleteMessage(chatId, wait.message_id).catch(() => {});
}

// Start polling once yt-dlp check/download has been attempted
(async () => {
  YTDLP_PATH = await ensureYtDlp();
  try { bot.startPolling(); } catch (e) { console.error('startPolling failed', e); }
})();

/*
========================================
START
========================================
*/

bot.onText(
  /\/start/,
  async (msg) => {

    bot.sendMessage(

      msg.chat.id,

`⚑ *សូមស្វាគមន៏មកកាន់ Amertak Bot Downloader*
✱ Commands:

⮞ /dashboard - Open dashboard to view history download and redownload
⮞ /clear - clear download history

✱ Supported Platforms

⮞ YouTube
⮞ TikTok
⮞ Pinterest
⮞ Spotify

✱ How to use - របៀបប្រើ

⮩ (KHM) ផ្ញើលីងទៅកាន់ Bot រួចជ្រើសរើស formats
⮩ (ENG) Send Link to bot and then choose a format button

✦ សូមផ្ញើរលីងដែលត្រឺមត្រូវ! ✦

⚑ *Owner: @Amertak_Network*`, BUTTONS);

  }
);

/*
========================================
MESSAGE HANDLER
========================================
*/

bot.on(
  "message",
  async (msg) => {

    try {

      const chatId =
        msg.chat.id;

      const text =
        msg.text;

      if (!text) return;

      if (
        text.startsWith("/")
      ) return;

      /*
      ========================================
      YOUTUBE
      ========================================
      */

      if (

        text.includes("youtube.com") ||
        text.includes("youtu.be")

      ) {

        const ytOpts = {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
                {
                  text: "⮩ វីដេអូ",
                  callback_data: makeCallback("yt_mp4", text)
                },
                {
                  text: "⮩ សំឡេង",
                  callback_data: makeCallback("yt_mp3", text)
                },
                {
                  text: "⮩ Thumbnail",
                  callback_data: makeCallback("yt_thumb", text)
                }
            ]]
          }
        };

        return bot.sendMessage(
          chatId,
  `⚑ *YouTube Downloader*

  Choose format ⮯`,
          ytOpts
        );

      }

      /*
      ========================================
      TIKTOK
      ========================================
      */

      if (
        text.includes("tiktok.com")
      ) {

        const ttOpts = {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
                {
                  text: "⮩ វីដេអូ",
                  callback_data: makeCallback("tt_video", text)
                },
                {
                  text: "⮩ សំឡេង",
                  callback_data: makeCallback("tt_audio", text)
                },
                {
                  text: "⮩ រូបភាព",
                  callback_data: makeCallback("tt_image", text)
                }
            ]]
          }
        };

        return bot.sendMessage(
          chatId,
  `⚑ *TikTok Downloader*

  Choose format ⮯`,
          ttOpts
        );

      }

      /*
      ========================================
      PINTEREST
      ========================================
      */

      if (

        text.includes("pinterest.com") ||
        text.includes("pin.it")

      ) {

        const pinOpts = {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⮩ ទាញយករូបភាព",
                  callback_data: makeCallback("pin_image", text)
                }
              ]
            ]
          }
        };

        return bot.sendMessage(
          chatId,
  `⚑ *Pinterest Downloader*

  Choose format ⮯`,
          pinOpts
        );

      }

      /*
      ========================================
      SPOTIFY
      ========================================
      */

      if (
        text.includes("spotify.com")
      ) {

        return spotifyInfo(
          chatId,
          text
        );

      }

      /*
      ========================================
      UNSUPPORTED
      ========================================
      */

      bot.sendMessage(
        chatId,
        "✘ Unsupported URL"
      );

    } catch (err) {

      console.log(err);

    }

  }
);

/*
========================================
BUTTON HANDLER
========================================
*/

bot.on(
  "callback_query",
  async (query) => {

    try {

      await bot.answerCallbackQuery(
        query.id
      );

      const chatId =
        query.message.chat.id;

      const data = query.data.split("|");

      const action = data[0];

      let url = data[1];
      if (pendingDownloads.has(url)) {
        url = pendingDownloads.get(url);
        pendingDownloads.delete(data[1]);
      }

      /*
      ========================================
      YOUTUBE
      ========================================
      */

      if (
        action === "yt_mp4"
      ) {

        return downloadYouTubeVideo(
          chatId,
          url
        );

      }

      if (
        action === "yt_mp3"
      ) {

        return downloadYouTubeAudio(
          chatId,
          url
        );

      }

      if (
        action === "yt_thumb"
      ) {

        return downloadYouTubeThumbnail(
          chatId,
          url
        );

      }

      /*
      ========================================
      TIKTOK
      ========================================
      */

      if (
        action === "tt_video"
      ) {

        return downloadTikTokVideo(
          chatId,
          url
        );

      }

      if (
        action === "tt_audio"
      ) {

        return downloadTikTokAudio(
          chatId,
          url
        );

      }

      if (
        action === "tt_image"
      ) {

        return downloadTikTokImage(
          chatId,
          url
        );

      }

      /*
      ========================================
      PINTEREST
      ========================================
      */

      if (
        action === "pin_image"
      ) {

        return downloadPinterest(
          chatId,
          url
        );

      }

    } catch (err) {

      console.log(err);

    }

  }
);

/*
========================================
YOUTUBE VIDEO
========================================
*/

async function downloadYouTubeVideo(
  chatId,
  url
) {

  const wait =
    await bot.sendMessage(
      chatId,
      "⏳ Downloading video..."
    );

  const file =
    `${Date.now()}.mp4`;

  const output =
    path.join(
      DOWNLOAD_DIR,
      file
    );

  exec(

`yt-dlp -f "bestvideo+bestaudio" -o "${output}" "${url}"`,
`${YTDLP_PATH} -f "bestvideo+bestaudio" -o "${output}" "${url}"`,

    async (err) => {

      if (err) {

        console.log(err);

        return bot.sendMessage(
          chatId,
          "✘ Video failed"
        );

      }

      try {

        await bot.sendVideo(
          chatId,
          output,
          {
            caption:
              "✓ YouTube Video"
          }
        );

      } catch (e) {

        console.log(e);

      }

      if (
        fs.existsSync(output)
      ) {

        fs.unlinkSync(output);

      }

      bot.deleteMessage(
        chatId,
        wait.message_id
      ).catch(() => {});

    }

  );

}

/*
========================================
YOUTUBE AUDIO
========================================
*/

async function downloadYouTubeAudio(
  chatId,
  url
) {

  const wait =
    await bot.sendMessage(
      chatId,
      "⏳ Downloading audio..."
    );

  const file =
    `${Date.now()}.m4a`;

  const output =
    path.join(
      DOWNLOAD_DIR,
      file
    );

  exec(

`yt-dlp -f bestaudio -o "${output}" "${url}"`,
`${YTDLP_PATH} -f bestaudio -o "${output}" "${url}"`,

    async (err) => {

      if (err) {

        console.log(err);

        return bot.sendMessage(
          chatId,
          "✘ Audio failed"
        );

      }

      try {

        await bot.sendAudio(
          chatId,
          output,
          {
            caption:
              "✓ YouTube Audio"
          }
        );

      } catch (e) {

        console.log(e);

      }

      if (
        fs.existsSync(output)
      ) {

        fs.unlinkSync(output);

      }

      bot.deleteMessage(
        chatId,
        wait.message_id
      ).catch(() => {});

    }

  );

}

/*
========================================
YOUTUBE THUMBNAIL
========================================
*/

async function downloadYouTubeThumbnail(
  chatId,
  url
) {

  const wait =
    await bot.sendMessage(
      chatId,
      "⏳ Fetching thumbnail..."
    );

  exec(

`${YTDLP_PATH} --get-thumbnail "${url}"`,

    async (err, stdout) => {

      if (err) {

        console.log(err);

        return bot.sendMessage(
          chatId,
          "✘ Thumbnail failed"
        );

      }

      try {

        await bot.sendPhoto(
          chatId,
          stdout.trim(),
          {
            caption:
              "⮩ YouTube Thumbnail"
          }
        );

      } catch (e) {

        console.log(e);

      }

      bot.deleteMessage(
        chatId,
        wait.message_id
      ).catch(() => {});

    }

  );

}

/*
========================================
TIKTOK VIDEO
========================================
*/

async function downloadTikTokVideo(
  chatId,
  url
) {

  const wait =
    await bot.sendMessage(
      chatId,
      "⏳ Downloading TikTok..."
    );

  try {

    const api =
`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;

    const { data } =
      await axios.get(api);

    await bot.sendVideo(
      chatId,
      data.data.play,
      {
        caption:
          "✓ TikTok Video"
      }
    );

  } catch (err) {

    console.log(err);

    bot.sendMessage(
      chatId,
      "✘ TikTok failed"
    );

  }

  bot.deleteMessage(
    chatId,
    wait.message_id
  ).catch(() => {});

}

/*
========================================
TIKTOK AUDIO
========================================
*/

async function downloadTikTokAudio(
  chatId,
  url
) {

  const wait =
    await bot.sendMessage(
      chatId,
      "⏳ Downloading audio..."
    );

  try {

    const api =
`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;

    const { data } =
      await axios.get(api);

    await bot.sendAudio(
      chatId,
      data.data.music,
      {
        caption:
          "✘ TikTok Audio"
      }
    );

  } catch (err) {

    console.log(err);

    bot.sendMessage(
      chatId,
      "✘ Audio failed"
    );

  }

  bot.deleteMessage(
    chatId,
    wait.message_id
  ).catch(() => {});

}

/*
========================================
TIKTOK IMAGE
========================================
*/

async function downloadTikTokImage(
  chatId,
  url
) {

  const wait =
    await bot.sendMessage(
      chatId,
      "⏳ Fetching image..."
    );

  try {

    const api =
`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;

    const { data } =
      await axios.get(api);

    await bot.sendPhoto(
      chatId,
      data.data.cover,
      {
        caption:
          "✘ TikTok Cover"
      }
    );

  } catch (err) {

    console.log(err);

    bot.sendMessage(
      chatId,
      "✘ Image failed"
    );

  }

  bot.deleteMessage(
    chatId,
    wait.message_id
  ).catch(() => {});

}

/*
========================================
PINTEREST
========================================
*/

async function downloadPinterest(
  chatId,
  url
) {

  const wait =
    await bot.sendMessage(
      chatId,
      "⏳ Downloading Pinterest..."
    );

  try {

    const api =
`https://pinterestdownloader.io/frontendService/DownloaderService?url=${encodeURIComponent(url)}`;

    const { data } =
      await axios.get(api);

    const media =
      data.medias[0].url;

    await bot.sendPhoto(
      chatId,
      media,
      {
        caption:
          "✓ Pinterest Image"
      }
    );

  } catch (err) {

    console.log(err);

    bot.sendMessage(
      chatId,
      "✘ Pinterest failed"
    );

  }

  bot.deleteMessage(
    chatId,
    wait.message_id
  ).catch(() => {});

}

/*
========================================
SPOTIFY
========================================
*/

async function spotifyInfo(
  chatId,
  url
) {

  const wait =
    await bot.sendMessage(
      chatId,
      "⏳ Fetching Spotify..."
    );

  try {

    // normalize spotify URIs like spotify:track:ID -> https URL
    function normalize(u) {
      if (!u) return u;
      if (u.startsWith('spotify:')) {
        const parts = u.split(':');
        if (parts.length >= 3) return `https://open.spotify.com/${parts[1]}/${parts[2]}`;
      }
      if (u.startsWith('http') && u.includes('spotify')) return u;
      if (u.startsWith('www.')) return 'https://' + u;
      return u;
    }

    const nurl = normalize(url);
    const api = `https://open.spotify.com/oembed?url=${encodeURIComponent(nurl)}`;

    let { data } = await axios.get(api).catch(() => ({ data: null }));

    let thumb = data && data.thumbnail_url ? data.thumbnail_url : null;
    let title = data && data.title ? data.title : null;
    let author = data && data.author_name ? data.author_name : null;

    // fallback: scrape the page for og meta tags
    if (!thumb || !title) {
      try {
        const page = await axios.get(nurl);
        const html = page.data;
        const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
        if (imgMatch) thumb = imgMatch[1];
        const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
        if (titleMatch) title = titleMatch[1];
        const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
        if (authorMatch) author = authorMatch[1];
      } catch (e) {
        console.log('spotify page scrape failed', e.message || e);
      }
    }

    if (!thumb) {
      await bot.sendMessage(chatId, '✘ Could not fetch Spotify thumbnail');
      return bot.deleteMessage(chatId, wait.message_id).catch(() => {});
    }

    await bot.sendPhoto(
      chatId,
      thumb,
      {
        caption: `⯈ ${title || 'Unknown'}\n\n⯈ ${author || 'Unknown'}`
      }
    );

  } catch (err) {

    console.log(err);

    bot.sendMessage(
      chatId,
      "✘ Spotify failed"
    );

  }

  bot.deleteMessage(
    chatId,
    wait.message_id
  ).catch(() => {});

}
