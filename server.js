require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { exec, execFile } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

/*
========================================
HISTORY STORE
========================================
*/

const HISTORY_FILE = path.join(__dirname, "history.json");

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    }
  } catch {}
  return {};
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch {}
}

function addHistory(userId, username, entry) {
  const history = loadHistory();
  if (!history[userId]) {
    history[userId] = { username: username || "Unknown", records: [] };
  }
  history[userId].username = username || history[userId].username;
  history[userId].records.unshift({
    ...entry,
    id: Date.now().toString(),
    date: new Date().toISOString()
  });
  // Keep max 100 per user
  if (history[userId].records.length > 100) {
    history[userId].records = history[userId].records.slice(0, 100);
  }
  saveHistory(history);
}

/*
========================================
EXPRESS SERVER
========================================
*/

const app = express();
app.use(express.json());

/*
========================================
DASHBOARD HTML
========================================
*/

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Amertak Bot Dashboard</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --surface: #111118;
    --card: #16161f;
    --border: #1e1e2e;
    --accent: #7c6af7;
    --accent2: #a78bfa;
    --green: #34d399;
    --red: #f87171;
    --yellow: #fbbf24;
    --cyan: #22d3ee;
    --text: #e2e2f0;
    --muted: #6b6b8a;
    --mono: 'JetBrains Mono', monospace;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
  }

  /* NAV */
  nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(10,10,15,0.92);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .nav-logo {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.3px;
    color: var(--accent2);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .nav-logo .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--green);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* MAIN */
  .container { max-width: 960px; margin: 0 auto; padding: 32px 20px; }

  /* LOGIN */
  #login-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 56px);
    gap: 24px;
    text-align: center;
  }
  .login-box {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 40px 32px;
    width: 100%;
    max-width: 400px;
  }
  .login-icon {
    font-size: 40px;
    margin-bottom: 16px;
  }
  .login-title {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .login-sub {
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 28px;
  }
  input[type="text"] {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 11px 14px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    margin-bottom: 12px;
  }
  input[type="text"]:focus { border-color: var(--accent); }
  input[type="text"]::placeholder { color: var(--muted); }

  button.btn {
    width: 100%;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    padding: 11px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
  }
  button.btn:hover { background: var(--accent2); }
  button.btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .error-msg {
    font-size: 12px;
    color: var(--red);
    margin-top: 8px;
    display: none;
  }

  /* DASHBOARD */
  #dashboard-view { display: none; }

  .user-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .user-info { display: flex; align-items: center; gap: 12px; }
  .avatar {
    width: 44px; height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), var(--cyan));
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 17px; color: #fff;
    flex-shrink: 0;
  }
  .user-name { font-size: 16px; font-weight: 600; }
  .user-id { font-size: 12px; color: var(--muted); font-family: var(--mono); }

  .btn-sm {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 14px;
    color: var(--muted);
    font-size: 13px;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
    white-space: nowrap;
  }
  .btn-sm:hover { color: var(--text); border-color: var(--accent); }

  /* STATS */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 28px;
  }
  .stat-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
  }
  .stat-label {
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 6px;
  }
  .stat-value {
    font-size: 24px;
    font-weight: 700;
    font-family: var(--mono);
  }
  .stat-value.green { color: var(--green); }
  .stat-value.purple { color: var(--accent2); }
  .stat-value.cyan { color: var(--cyan); }
  .stat-value.yellow { color: var(--yellow); }

  /* FILTER BAR */
  .filter-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .filter-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 5px 14px;
    font-size: 12px;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .filter-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .filter-btn:hover:not(.active) { border-color: var(--accent); color: var(--text); }

  /* HISTORY LIST */
  .history-list { display: flex; flex-direction: column; gap: 8px; }

  .history-item {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: border-color 0.15s;
  }
  .history-item:hover { border-color: #2e2e42; }

  .platform-icon {
    width: 36px; height: 36px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 17px;
    flex-shrink: 0;
  }
  .pi-yt { background: rgba(255,0,0,0.12); }
  .pi-tt { background: rgba(0,0,0,0.4); border: 1px solid #333; }
  .pi-sp { background: rgba(30,215,96,0.12); }
  .pi-pin { background: rgba(230,0,35,0.12); }

  .history-info { flex: 1; min-width: 0; }
  .history-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 3px;
  }
  .history-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tag {
    font-size: 10px;
    font-family: var(--mono);
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid;
  }
  .tag-mp4 { color: var(--cyan); border-color: rgba(34,211,238,0.3); background: rgba(34,211,238,0.07); }
  .tag-mp3 { color: var(--green); border-color: rgba(52,211,153,0.3); background: rgba(52,211,153,0.07); }
  .tag-img { color: var(--yellow); border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.07); }
  .tag-audio { color: var(--accent2); border-color: rgba(167,139,250,0.3); background: rgba(167,139,250,0.07); }

  .history-date {
    font-size: 11px;
    color: var(--muted);
    font-family: var(--mono);
  }

  .status-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-ok { background: var(--green); }
  .status-fail { background: var(--red); }

  .redownload-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 6px 12px;
    font-size: 11px;
    color: var(--accent2);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
    text-decoration: none;
    display: inline-block;
  }
  .redownload-btn:hover {
    border-color: var(--accent);
    background: rgba(124,106,247,0.1);
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--muted);
  }
  .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .empty-text { font-size: 14px; }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 14px;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  /* Loading */
  .spinner {
    display: inline-block;
    width: 18px; height: 18px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin: auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .loading-row {
    display: flex;
    justify-content: center;
    padding: 40px;
  }
</style>
</head>
<body>

<nav>
  <div class="nav-logo">
    <span class="dot"></span>
    Amertak Bot
  </div>
  <span style="font-size:12px;color:var(--muted);">Download Dashboard</span>
</nav>

<!-- LOGIN -->
<div id="login-view">
  <div class="login-box">
    <div class="login-icon">⚑</div>
    <div class="login-title">Sign in to Dashboard</div>
    <div class="login-sub">Enter your Telegram User ID to view your download history</div>
    <input type="text" id="uid-input" placeholder="Your Telegram User ID" />
    <div class="error-msg" id="login-error">User ID not found or no downloads yet</div>
    <button class="btn" id="login-btn" onclick="doLogin()">View History</button>
    <p style="margin-top:16px;font-size:11px;color:var(--muted);">
      Get your ID: message <a href="https://t.me/userinfobot" style="color:var(--accent2);">@userinfobot</a> on Telegram
    </p>
  </div>
</div>

<!-- DASHBOARD -->
<div id="dashboard-view">
  <div class="container">

    <div class="user-header">
      <div class="user-info">
        <div class="avatar" id="user-avatar">?</div>
        <div>
          <div class="user-name" id="user-name">—</div>
          <div class="user-id" id="user-id-label">ID: —</div>
        </div>
      </div>
      <button class="btn-sm" onclick="doLogout()">← Sign out</button>
    </div>

    <!-- STATS -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Downloads</div>
        <div class="stat-value purple" id="stat-total">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">YouTube</div>
        <div class="stat-value green" id="stat-yt">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">TikTok</div>
        <div class="stat-value cyan" id="stat-tt">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Other</div>
        <div class="stat-value yellow" id="stat-other">0</div>
      </div>
    </div>

    <!-- FILTER -->
    <div class="filter-bar">
      <button class="filter-btn active" onclick="setFilter('all', this)">All</button>
      <button class="filter-btn" onclick="setFilter('youtube', this)">YouTube</button>
      <button class="filter-btn" onclick="setFilter('tiktok', this)">TikTok</button>
      <button class="filter-btn" onclick="setFilter('spotify', this)">Spotify</button>
      <button class="filter-btn" onclick="setFilter('pinterest', this)">Pinterest</button>
    </div>

    <div class="section-title">Download History</div>
    <div class="history-list" id="history-list">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>

  </div>
</div>

<script>
let allRecords = [];
let currentFilter = 'all';

function doLogin() {
  const uid = document.getElementById('uid-input').value.trim();
  if (!uid) return;
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Loading...';
  fetch('/api/history/' + uid)
    .then(r => r.json())
    .then(data => {
      if (!data || data.error) {
        document.getElementById('login-error').style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'View History';
        return;
      }
      showDashboard(uid, data);
    })
    .catch(() => {
      document.getElementById('login-error').style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'View History';
    });
}

document.getElementById('uid-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

function showDashboard(uid, data) {
  document.getElementById('login-view').style.display = 'none';
  const dash = document.getElementById('dashboard-view');
  dash.style.display = 'block';

  const uname = data.username || 'User';
  document.getElementById('user-avatar').textContent = uname.charAt(0).toUpperCase();
  document.getElementById('user-name').textContent = uname;
  document.getElementById('user-id-label').textContent = 'ID: ' + uid;

  allRecords = data.records || [];

  // Stats
  const yt = allRecords.filter(r => r.platform === 'youtube').length;
  const tt = allRecords.filter(r => r.platform === 'tiktok').length;
  const other = allRecords.length - yt - tt;
  document.getElementById('stat-total').textContent = allRecords.length;
  document.getElementById('stat-yt').textContent = yt;
  document.getElementById('stat-tt').textContent = tt;
  document.getElementById('stat-other').textContent = other;

  renderList();
}

function doLogout() {
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('uid-input').value = '';
  document.getElementById('login-error').style.display = 'none';
  const btn = document.getElementById('login-btn');
  btn.disabled = false;
  btn.textContent = 'View History';
}

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderList();
}

function renderList() {
  const list = document.getElementById('history-list');
  let records = allRecords;
  if (currentFilter !== 'all') {
    records = records.filter(r => r.platform === currentFilter);
  }
  if (!records.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No downloads found</div></div>';
    return;
  }
  list.innerHTML = records.map(r => itemHTML(r)).join('');
}

const PLATFORM_ICON = {
  youtube: { cls: 'pi-yt', icon: '▶' },
  tiktok: { cls: 'pi-tt', icon: '♪' },
  spotify: { cls: 'pi-sp', icon: '♫' },
  pinterest: { cls: 'pi-pin', icon: '⊕' },
};

const FORMAT_TAG = {
  mp4: 'tag-mp4', mp3: 'tag-mp3', audio: 'tag-audio',
  image: 'tag-img', thumbnail: 'tag-img',
};

function itemHTML(r) {
  const pi = PLATFORM_ICON[r.platform] || { cls: 'pi-tt', icon: '↓' };
  const tagCls = FORMAT_TAG[r.format] || 'tag-mp4';
  const date = new Date(r.date);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const shortUrl = r.url ? (r.url.length > 45 ? r.url.slice(0, 45) + '…' : r.url) : 'Unknown URL';
  const status = r.status === 'ok' ? 'status-ok' : 'status-fail';

  return \`<div class="history-item">
    <div class="platform-icon \${pi.cls}">\${pi.icon}</div>
    <div class="history-info">
      <div class="history-title" title="\${r.url || ''}">\${shortUrl}</div>
      <div class="history-meta">
        <span class="tag \${tagCls}">\${(r.format || 'file').toUpperCase()}</span>
        <span class="history-date">\${dateStr}</span>
      </div>
    </div>
    <div class="status-dot \${status}" title="\${r.status === 'ok' ? 'Success' : 'Failed'}"></div>
    \${r.url ? \`<a class="redownload-btn" href="\${r.url}" target="_blank" rel="noopener">↗ Open</a>\` : ''}
  </div>\`;
}
</script>
</body>
</html>`;

/*
========================================
ROUTES
========================================
*/

app.get("/", (req, res) => {
  res.send("Bot Running ✅ | <a href='/dashboard'>Dashboard</a>");
});

app.get("/dashboard", (req, res) => {
  res.send(DASHBOARD_HTML);
});

app.get("/api/history/:userId", (req, res) => {
  const history = loadHistory();
  const userId = req.params.userId;
  if (!history[userId]) {
    return res.json({ error: "not found" });
  }
  res.json(history[userId]);
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

          console.log("❌ yt-dlp not found");
          console.log(stderr);
          return resolve(false);

        }

        console.log("✅ yt-dlp found in PATH:", stdout.trim());
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
  { polling: false }
);

/*
========================================
POLLING ERROR
========================================
*/

bot.on(
  "polling_error",

  async (err) => {

    console.error("polling_error:", err.message || err);

    try {

      if (
        err.code === "ETELEGRAM" &&
        err.message.includes("409")
      ) {

        try { await bot.deleteWebHook(); } catch {}
        try { await bot.stopPolling(); } catch {}

        setTimeout(() => {

          bot.startPolling({
            params: {
              timeout: 30,
              limit: 100,
              allowed_updates: ["message", "callback_query"],
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

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/*
========================================
STOP POLLING
========================================
*/

process.on("SIGINT", async () => {
  try { await bot.stopPolling(); } catch {}
  process.exit(0);
});

process.on("SIGTERM", async () => {
  try { await bot.stopPolling(); } catch {}
  process.exit(0);
});

/*
========================================
DOWNLOAD FOLDER
========================================
*/

const DOWNLOAD_DIR = path.join(__dirname, "downloads");

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

console.log("🚀 Downloader Bot Running");

/*
========================================
PENDING DOWNLOADS
========================================
*/

const pendingDownloads = new Map();

function makeCallback(action, url, userId, username) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  pendingDownloads.set(id, { url, userId, username });
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
/dashboard COMMAND
========================================
*/

bot.onText(/\/dashboard/, async (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `📊 *Dashboard*\n\nView your download history:\n${BASE_URL}/dashboard\n\nYour User ID: \`${msg.from.id}\``,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "Open Dashboard", url: `${BASE_URL}/dashboard` }
        ]]
      }
    }
  );
});

/*
========================================
/clear COMMAND — clears user history
========================================
*/

bot.onText(/\/clear/, async (msg) => {
  const userId = String(msg.from.id);
  const history = loadHistory();
  if (history[userId]) {
    history[userId].records = [];
    saveHistory(history);
  }
  bot.sendMessage(msg.chat.id, "✓ Your download history has been cleared.");
});

/*
========================================
MESSAGE HANDLER
========================================
*/

bot.on(
  "message",

  async (msg) => {

    try {

      const chatId = msg.chat.id;
      const text = msg.text;
      const userId = String(msg.from.id);
      const username = msg.from.username || msg.from.first_name || "User";

      if (!text) return;
      if (text.startsWith("/")) return;

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
                  callback_data: makeCallback("yt_mp4", text, userId, username)
                },
                {
                  text: "⮩ សំឡេង",
                  callback_data: makeCallback("yt_mp3", text, userId, username)
                },
                {
                  text: "⮩ Thumbnail",
                  callback_data: makeCallback("yt_thumb", text, userId, username)
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

      if (text.includes("tiktok.com")) {

        return bot.sendMessage(

          chatId,
          `⚑ *TikTok Downloader*\n\nChoose format ⮯`,

          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "⮩ វីដេអូ",
                  callback_data: makeCallback("tt_video", text, userId, username)
                },
                {
                  text: "⮩ សំឡេង",
                  callback_data: makeCallback("tt_audio", text, userId, username)
                },
                {
                  text: "⮩ រូបភាព",
                  callback_data: makeCallback("tt_image", text, userId, username)
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
                  text: "⮩ ទាញយករូបភាព",
                  callback_data: makeCallback("pin_image", text, userId, username)
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

        return spotifyInfo(chatId, text, userId, username);

      }

      /*
      ========================================
      UNSUPPORTED
      ========================================
      */

      bot.sendMessage(chatId, "✘ Unsupported URL");

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

      if (!query || !query.data) return;

      await bot.answerCallbackQuery(
        query.id,
        { text: "Processing..." }
      );

      const chatId = query.message.chat.id;
      const data = query.data.split("|");
      const action = data[0];
      const key = data[1];

      let url = key;
      let userId = String(query.from.id);
      let username = query.from.username || query.from.first_name || "User";

      if (pendingDownloads.has(key)) {
        const stored = pendingDownloads.get(key);
        url = stored.url;
        userId = stored.userId || userId;
        username = stored.username || username;
        pendingDownloads.delete(key);
      }

      if (action === "yt_mp4")   return downloadYouTubeVideo(chatId, url, userId, username);
      if (action === "yt_mp3")   return downloadYouTubeAudio(chatId, url, userId, username);
      if (action === "yt_thumb") return downloadYouTubeThumbnail(chatId, url, userId, username);
      if (action === "tt_video") return downloadTikTokVideo(chatId, url, userId, username);
      if (action === "tt_audio") return downloadTikTokAudio(chatId, url, userId, username);
      if (action === "tt_image") return downloadTikTokImage(chatId, url, userId, username);
      if (action === "pin_image") return downloadPinterest(chatId, url, userId, username);

    } catch (err) {

      console.log(err);

    }

  }
);

/*
========================================
YOUTUBE VIDEO (FIXED)
========================================
*/

async function downloadYouTubeVideo(chatId, url, userId, username) {

  const wait = await bot.sendMessage(chatId, "⏳ Downloading video...");

  const filePrefix = Date.now().toString();
  const outputTemplate = path.join(DOWNLOAD_DIR, `${filePrefix}.%(ext)s`);
  const expectedMp4 = path.join(DOWNLOAD_DIR, `${filePrefix}.mp4`);
  const expectedWebm = path.join(DOWNLOAD_DIR, `${filePrefix}.webm`);
  const expectedMkv = path.join(DOWNLOAD_DIR, `${filePrefix}.mkv`);

  // Fixed: use format string that actually works on modern yt-dlp
  const args = [
    "--no-playlist",
    "--restrict-filenames",
    "--socket-timeout", "60",
    "--retries", "10",
    "--fragment-retries", "10",
    "--no-check-certificates",
    "-f", "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]/best",
    "--merge-output-format", "mp4",
    "-o", outputTemplate,
    url
  ];

  execFile(

    YTDLP_PATH,
    args,
    {
      timeout: 1000 * 60 * 8,
      maxBuffer: 1024 * 1024 * 50
    },

    async (err, stdout, stderr) => {

      console.log("[YT_MP4 stdout]", stdout);
      console.log("[YT_MP4 stderr]", stderr);

      // Find output file (might be .mp4 .webm .mkv)
      let outputFile = null;
      for (const candidate of [expectedMp4, expectedWebm, expectedMkv]) {
        if (fs.existsSync(candidate)) { outputFile = candidate; break; }
      }

      // Also try glob for any file matching prefix
      if (!outputFile) {
        try {
          const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(filePrefix));
          if (files.length) outputFile = path.join(DOWNLOAD_DIR, files[0]);
        } catch {}
      }

      if (err || !outputFile) {

        console.log("[YT_MP4 err]", err);

        addHistory(userId, username, {
          platform: "youtube", format: "mp4", url, status: "fail"
        });

        await bot.sendMessage(chatId, "✘ Video download failed. YouTube may require cookies or the video is unavailable.");

        bot.deleteMessage(chatId, wait.message_id).catch(() => {});
        return;

      }

      try {

        const stat = fs.statSync(outputFile);

        if (stat.size > 49 * 1024 * 1024) {

          addHistory(userId, username, {
            platform: "youtube", format: "mp4", url, status: "fail"
          });

          await bot.sendMessage(chatId, "✘ Video too large (>50MB). Try a shorter video.");

        } else {

          await bot.sendVideo(
            chatId,
            outputFile,
            { caption: "✓ YouTube Video", supports_streaming: true }
          );

          addHistory(userId, username, {
            platform: "youtube", format: "mp4", url, status: "ok"
          });

        }

      } catch (e) {

        console.log(e);

        addHistory(userId, username, {
          platform: "youtube", format: "mp4", url, status: "fail"
        });

        await bot.sendMessage(chatId, "✘ Upload failed");

      }

      try { fs.unlinkSync(outputFile); } catch {}
      bot.deleteMessage(chatId, wait.message_id).catch(() => {});

    }
  );

}

/*
========================================
YOUTUBE AUDIO (FIXED)
========================================
*/

async function downloadYouTubeAudio(chatId, url, userId, username) {

  const wait = await bot.sendMessage(chatId, "⏳ Downloading audio...");

  const filePrefix = Date.now().toString();
  const outputTemplate = path.join(DOWNLOAD_DIR, `${filePrefix}.%(ext)s`);

  const args = [
    "--no-playlist",
    "--restrict-filenames",
    "--socket-timeout", "60",
    "--retries", "10",
    "--fragment-retries", "10",
    "--no-check-certificates",
    "-f", "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio",
    "--extract-audio",
    "--audio-format", "mp3",
    "--audio-quality", "192K",
    "-o", outputTemplate,
    url
  ];

  execFile(

    YTDLP_PATH,
    args,
    {
      timeout: 1000 * 60 * 8,
      maxBuffer: 1024 * 1024 * 50
    },

    async (err, stdout, stderr) => {

      console.log("[YT_MP3 stdout]", stdout);
      console.log("[YT_MP3 stderr]", stderr);

      // Find output
      let outputFile = null;
      try {
        const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(filePrefix));
        if (files.length) outputFile = path.join(DOWNLOAD_DIR, files[0]);
      } catch {}

      if (err || !outputFile) {

        console.log("[YT_MP3 err]", err);

        addHistory(userId, username, {
          platform: "youtube", format: "mp3", url, status: "fail"
        });

        await bot.sendMessage(chatId, "✘ Audio download failed.");

        bot.deleteMessage(chatId, wait.message_id).catch(() => {});
        return;

      }

      try {

        const stat = fs.statSync(outputFile);

        if (stat.size > 49 * 1024 * 1024) {

          addHistory(userId, username, {
            platform: "youtube", format: "mp3", url, status: "fail"
          });

          await bot.sendMessage(chatId, "✘ Audio too large (>50MB)");

        } else {

          await bot.sendAudio(
            chatId,
            outputFile,
            { caption: "✓ YouTube Audio" }
          );

          addHistory(userId, username, {
            platform: "youtube", format: "mp3", url, status: "ok"
          });

        }

      } catch (e) {

        console.log(e);

        addHistory(userId, username, {
          platform: "youtube", format: "mp3", url, status: "fail"
        });

        await bot.sendMessage(chatId, "✘ Upload failed");

      }

      try { fs.unlinkSync(outputFile); } catch {}
      bot.deleteMessage(chatId, wait.message_id).catch(() => {});

    }
  );

}

/*
========================================
YOUTUBE THUMBNAIL
========================================
*/

async function downloadYouTubeThumbnail(chatId, url, userId, username) {

  const wait = await bot.sendMessage(chatId, "⏳ Fetching thumbnail...");

  exec(

    `${YTDLP_PATH} --get-thumbnail "${url}"`,

    async (err, stdout) => {

      if (err) {

        addHistory(userId, username, {
          platform: "youtube", format: "thumbnail", url, status: "fail"
        });

        await bot.sendMessage(chatId, "✘ Thumbnail failed");
        bot.deleteMessage(chatId, wait.message_id).catch(() => {});
        return;

      }

      try {

        await bot.sendPhoto(
          chatId,
          stdout.trim(),
          { caption: "🖼 YouTube Thumbnail" }
        );

        addHistory(userId, username, {
          platform: "youtube", format: "thumbnail", url, status: "ok"
        });

      } catch (e) {

        console.log(e);

        addHistory(userId, username, {
          platform: "youtube", format: "thumbnail", url, status: "fail"
        });

      }

      bot.deleteMessage(chatId, wait.message_id).catch(() => {});

    }
  );

}

/*
========================================
TIKTOK VIDEO
========================================
*/

async function downloadTikTokVideo(chatId, url, userId, username) {

  const wait = await bot.sendMessage(chatId, "⏳ Downloading TikTok...");

  try {

    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);

    await bot.sendVideo(
      chatId,
      data.data.play,
      { caption: "✓ TikTok Video" }
    );

    addHistory(userId, username, {
      platform: "tiktok", format: "mp4", url, status: "ok"
    });

  } catch (err) {

    console.log(err);

    addHistory(userId, username, {
      platform: "tiktok", format: "mp4", url, status: "fail"
    });

    bot.sendMessage(chatId, "✘ TikTok failed");

  }

  bot.deleteMessage(chatId, wait.message_id).catch(() => {});

}

/*
========================================
TIKTOK AUDIO
========================================
*/

async function downloadTikTokAudio(chatId, url, userId, username) {

  const wait = await bot.sendMessage(chatId, "⏳ Downloading audio...");

  try {

    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);

    await bot.sendAudio(
      chatId,
      data.data.music,
      { caption: "✓ TikTok Audio" }
    );

    addHistory(userId, username, {
      platform: "tiktok", format: "audio", url, status: "ok"
    });

  } catch (err) {

    console.log(err);

    addHistory(userId, username, {
      platform: "tiktok", format: "audio", url, status: "fail"
    });

    bot.sendMessage(chatId, "✘ Audio failed");

  }

  bot.deleteMessage(chatId, wait.message_id).catch(() => {});

}

/*
========================================
TIKTOK IMAGE
========================================
*/

async function downloadTikTokImage(chatId, url, userId, username) {

  const wait = await bot.sendMessage(chatId, "⏳ Fetching image...");

  try {

    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);

    await bot.sendPhoto(
      chatId,
      data.data.cover,
      { caption: "✓ TikTok Image" }
    );

    addHistory(userId, username, {
      platform: "tiktok", format: "image", url, status: "ok"
    });

  } catch (err) {

    console.log(err);

    addHistory(userId, username, {
      platform: "tiktok", format: "image", url, status: "fail"
    });

    bot.sendMessage(chatId, "✘ Image failed");

  }

  bot.deleteMessage(chatId, wait.message_id).catch(() => {});

}

/*
========================================
PINTEREST
========================================
*/

async function downloadPinterest(chatId, url, userId, username) {

  const wait = await bot.sendMessage(chatId, "⏳ Downloading Pinterest...");

  try {

    const api = `https://pinterestdownloader.io/frontendService/DownloaderService?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);
    const media = data.medias[0].url;

    await bot.sendPhoto(
      chatId,
      media,
      { caption: "✓ Pinterest Image" }
    );

    addHistory(userId, username, {
      platform: "pinterest", format: "image", url, status: "ok"
    });

  } catch (err) {

    console.log(err);

    addHistory(userId, username, {
      platform: "pinterest", format: "image", url, status: "fail"
    });

    bot.sendMessage(chatId, "✘ Pinterest failed");

  }

  bot.deleteMessage(chatId, wait.message_id).catch(() => {});

}

/*
========================================
SPOTIFY
========================================
*/

async function spotifyInfo(chatId, url, userId, username) {

  const wait = await bot.sendMessage(chatId, "⏳ Fetching Spotify...");

  try {

    const api = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);

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

    addHistory(userId, username, {
      platform: "spotify", format: "audio", url, status: "ok"
    });

  } catch (err) {

    console.log(err);

    addHistory(userId, username, {
      platform: "spotify", format: "audio", url, status: "fail"
    });

    bot.sendMessage(chatId, "✘ Spotify failed");

  }

  bot.deleteMessage(chatId, wait.message_id).catch(() => {});

}

/*
========================================
START BOT
========================================
*/

(async () => {

  const ok = await ensureYtDlp();

  if (!ok) {
    process.exit(1);
  }

  await clearTelegramWebhook();

  try {

    await bot.startPolling({
      params: {
        timeout: 30,
        limit: 100,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true
      }
    });

    console.log("✅ Bot polling started");

  } catch (err) {

    console.log("startPolling error:", err.message || err);

  }

})();