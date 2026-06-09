require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { exec, execFile } = require("child_process");
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
TOKEN
========================================
*/

const TOKEN = process.env.BOT_TOKEN;

/*
========================================
CLEAR WEBHOOK
========================================
*/

async function clearTelegramWebhook() {

  try {

    await axios.get(
      `https://api.telegram.org/bot${TOKEN}/deleteWebhook`
    );

    console.log("✅ Old webhook removed");

  } catch (err) {

    console.log(
      "deleteWebhook error:",
      err.message || err
    );

  }

}

/*
========================================
YT-DLP CHECK
========================================
*/

let YTDLP_PATH = "yt-dlp";

async function ensureYtDlp() {

  return new Promise((resolve) => {

    exec(
      "yt-dlp --version",

      (err, stdout, stderr) => {

        if (err) {

          console.log(
            "❌ yt-dlp not found"
          );

          console.log(stderr);

          return resolve(false);

        }

        console.log(
          "✅ yt-dlp found in PATH:",
          stdout.trim()
        );

        resolve(true);

      }
    );

  });

}

/*
========================================
TELEGRAM BOT
========================================
*/

const bot = new TelegramBot(
  TOKEN,
  {
    polling: false
  }
);

/*
========================================
POLLING ERROR
========================================
*/

bot.on(
  "polling_error",

  async (err) => {

    console.error(
      "polling_error:",
      err.message || err
    );

    try {

      if (
        err.code === "ETELEGRAM" &&
        err.message.includes("409")
      ) {

        try {
          await bot.deleteWebHook();
        } catch {}

        try {
          await bot.stopPolling();
        } catch {}

        setTimeout(() => {

          bot.startPolling({
            params: {
              timeout: 30,
              limit: 100,
              allowed_updates: [
                "message",
                "callback_query"
              ],
              drop_pending_updates: true
            }
          });

        }, 1500);

      }

    } catch (e) {

      console.log(e);

    }

  }
);

/*
========================================
ANTI CRASH
========================================
*/

process.on(
  "unhandledRejection",
  console.error
);

process.on(
  "uncaughtException",
  console.error
);

/*
========================================
STOP POLLING
========================================
*/

process.on(
  "SIGINT",

  async () => {

    try {
      await bot.stopPolling();
    } catch {}

    process.exit(0);

  }
);

process.on(
  "SIGTERM",

  async () => {

    try {
      await bot.stopPolling();
    } catch {}

    process.exit(0);

  }
);

/*
========================================
DOWNLOAD FOLDER
========================================
*/

const DOWNLOAD_DIR = path.join(
  __dirname,
  "downloads"
);

if (
  !fs.existsSync(DOWNLOAD_DIR)
) {

  fs.mkdirSync(DOWNLOAD_DIR);

}

console.log(
  "🚀 Downloader Bot Running"
);

/*
========================================
PENDING DOWNLOADS
========================================
*/

const pendingDownloads =
  new Map();

function makeCallback(
  action,
  url
) {

  const id =
    `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  pendingDownloads.set(
    id,
    url
  );

  return `${action}|${id}`;

}

/*
========================================
BUTTONS
========================================
*/

const BASE_URL =
  process.env.BASE_URL ||
  "https://AmertakBotDownloader.onrender.com";

const BUTTONS = {

  reply_markup: {

    inline_keyboard: [[

      {
        text: "Tools",
        url: "https://tools-amertak.vercel.app"
      },

      {
        text: "Dashboard",
        url: `${BASE_URL}/dashboard`
      }

    ]]

  }

};

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

✦ /dashboard
✦ /clear

✱ Supported Platforms

✦ YouTube
✦ TikTok
✦ Pinterest
✦ Spotify

✱ How to use

✦ Send link to bot
✦ Choose format

⚑ *Owner: @Amertak_Network*`,

      {
        parse_mode: "Markdown",
        ...BUTTONS
      }

    );

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

        return bot.sendMessage(

          chatId,

          `⚑ *YouTube Downloader*\n\nChoose format ⮯`,

          {
            parse_mode: "Markdown",

            reply_markup: {

              inline_keyboard: [[

                {
                  text: "⮩ វីដេអូ",
                  callback_data:
                    makeCallback(
                      "yt_mp4",
                      text
                    )
                },

                {
                  text: "⮩ សំឡេង",
                  callback_data:
                    makeCallback(
                      "yt_mp3",
                      text
                    )
                },

                {
                  text: "⮩ Thumbnail",
                  callback_data:
                    makeCallback(
                      "yt_thumb",
                      text
                    )
                }

              ]]

            }

          }

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

        return bot.sendMessage(

          chatId,

          `⚑ *TikTok Downloader*\n\nChoose format ⮯`,

          {
            parse_mode: "Markdown",

            reply_markup: {

              inline_keyboard: [[

                {
                  text: "⮩ វីដេអូ",
                  callback_data:
                    makeCallback(
                      "tt_video",
                      text
                    )
                },

                {
                  text: "⮩ សំឡេង",
                  callback_data:
                    makeCallback(
                      "tt_audio",
                      text
                    )
                },

                {
                  text: "⮩ រូបភាព",
                  callback_data:
                    makeCallback(
                      "tt_image",
                      text
                    )
                }

              ]]

            }

          }

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

        return bot.sendMessage(

          chatId,

          `⚑ *Pinterest Downloader*\n\nChoose format ⮯`,

          {
            parse_mode: "Markdown",

            reply_markup: {

              inline_keyboard: [[

                {
                  text:
                    "⮩ ទាញយករូបភាព",

                  callback_data:
                    makeCallback(
                      "pin_image",
                      text
                    )
                }

              ]]

            }

          }

        );

      }

      /*
      ========================================
      SPOTIFY
      ========================================
      */

      if (
        text.includes("spotify.com") ||
        text.startsWith("spotify:")
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
CALLBACK QUERY
========================================
*/

bot.on(
  "callback_query",

  async (query) => {

    try {

      if (
        !query ||
        !query.data
      ) return;

      await bot.answerCallbackQuery(
        query.id,
        {
          text: "Processing..."
        }
      );

      const chatId =
        query.message.chat.id;

      const data =
        query.data.split("|");

      const action =
        data[0];

      const key =
        data[1];

      let url = key;

      if (
        pendingDownloads.has(key)
      ) {

        url =
          pendingDownloads.get(key);

        pendingDownloads.delete(
          key
        );

      }

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

  const filePrefix =
    Date.now().toString();

  const outputTemplate =
    path.join(
      DOWNLOAD_DIR,
      `${filePrefix}.mp4`
    );

  const args = [

    "-f",

    "best[ext=mp4][height<=720]/best[height<=720]",

    "--no-playlist",

    "--restrict-filenames",

    "--socket-timeout",
    "30",

    "--retries",
    "10",

    "--fragment-retries",
    "10",

    "-o",
    outputTemplate,

    url
  ];

  execFile(

    YTDLP_PATH,

    args,

    {
      timeout:
        1000 * 60 * 5,

      maxBuffer:
        1024 * 1024 * 20
    },

    async (
      err,
      stdout,
      stderr
    ) => {

      console.log(stdout);
      console.log(stderr);

      const outputFile =
        fs.existsSync(
          outputTemplate
        )
          ? outputTemplate
          : null;

      if (
        err ||
        !outputFile
      ) {

        console.log(err);

        await bot.sendMessage(
          chatId,
          "✘ Video failed"
        );

        try {
          fs.unlinkSync(
            outputTemplate
          );
        } catch {}

        bot.deleteMessage(
          chatId,
          wait.message_id
        ).catch(() => {});

        return;

      }

      try {

        const stat =
          fs.statSync(
            outputFile
          );

        if (
          stat.size >
          49 * 1024 * 1024
        ) {

          await bot.sendMessage(
            chatId,
            "✘ Video too large"
          );

        } else {

          await bot.sendVideo(
            chatId,
            outputFile,
            {
              caption:
                "✓ YouTube Video",
              supports_streaming: true
            }
          );

        }

      } catch (e) {

        console.log(e);

        await bot.sendMessage(
          chatId,
          "✘ Upload failed"
        );

      }

      try {
        fs.unlinkSync(
          outputFile
        );
      } catch {}

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

  const filePrefix =
    Date.now().toString();

  const outputTemplate =
    path.join(
      DOWNLOAD_DIR,
      `${filePrefix}.m4a`
    );

  const args = [

    "-f",

    "bestaudio[ext=m4a]/bestaudio",

    "--no-playlist",

    "--restrict-filenames",

    "--socket-timeout",
    "30",

    "--retries",
    "10",

    "--fragment-retries",
    "10",

    "-o",
    outputTemplate,

    url
  ];

  execFile(

    YTDLP_PATH,

    args,

    {
      timeout:
        1000 * 60 * 5,

      maxBuffer:
        1024 * 1024 * 20
    },

    async (
      err,
      stdout,
      stderr
    ) => {

      console.log(stdout);
      console.log(stderr);

      const outputFile =
        fs.existsSync(
          outputTemplate
        )
          ? outputTemplate
          : null;

      if (
        err ||
        !outputFile
      ) {

        console.log(err);

        await bot.sendMessage(
          chatId,
          "✘ Audio failed"
        );

        try {
          fs.unlinkSync(
            outputTemplate
          );
        } catch {}

        bot.deleteMessage(
          chatId,
          wait.message_id
        ).catch(() => {});

        return;

      }

      try {

        const stat =
          fs.statSync(
            outputFile
          );

        if (
          stat.size >
          49 * 1024 * 1024
        ) {

          await bot.sendMessage(
            chatId,
            "✘ Audio too large"
          );

        } else {

          await bot.sendAudio(
            chatId,
            outputFile,
            {
              caption:
                "✓ YouTube Audio"
            }
          );

        }

      } catch (e) {

        console.log(e);

        await bot.sendMessage(
          chatId,
          "✘ Upload failed"
        );

      }

      try {
        fs.unlinkSync(
          outputFile
        );
      } catch {}

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

    async (
      err,
      stdout
    ) => {

      if (err) {

        await bot.sendMessage(
          chatId,
          "✘ Thumbnail failed"
        );

        return;

      }

      try {

        await bot.sendPhoto(
          chatId,
          stdout.trim(),
          {
            caption:
              "🖼 YouTube Thumbnail"
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
          "✓ TikTok Audio"
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
          "✓ TikTok Image"
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

    const api =
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;

    const { data } =
      await axios.get(api);

    await bot.sendPhoto(
      chatId,
      data.thumbnail_url,
      {
        caption:
`🎵 Spotify Track

📌 ${data.title}

👤 ${data.author_name}`
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

/*
========================================
START BOT
========================================
*/

(async () => {

  const ok =
    await ensureYtDlp();

  if (!ok) {

    process.exit(1);

  }

  await clearTelegramWebhook();

  try {

    await bot.startPolling({

      params: {

        timeout: 30,

        limit: 100,

        allowed_updates: [
          "message",
          "callback_query"
        ],

        drop_pending_updates: true

      }

    });

    console.log(
      "✅ Telegram polling started"
    );

  } catch (e) {

    console.log(e);

  }

})();