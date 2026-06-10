require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
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
DASHBOARD HTML (GLASSMORPHISM + GLOWING RED UI)
========================================
*/

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Amertak Bot Premium Dashboard</title>
<style>
 @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
 *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

 :root {
   --bg: #07070a;
   --glass-bg: rgba(22, 10, 10, 0.45);
   --glass-border: rgba(239, 68, 68, 0.15);
   --glass-accent: rgba(239, 68, 68, 0.1);
   --red-glow: 0 0 25px rgba(239, 68, 68, 0.45);
   --primary: #ef4444;
   --primary-hover: #f87171;
   --green: #10b981;
   --cyan: #06b6d4;
   --yellow: #f59e0b;
   --text: #f3f4f6;
   --muted: #9ca3af;
   --mono: 'JetBrains Mono', monospace;
 }

 body { 
   background: var(--bg); 
   color: var(--text); 
   font-family: 'Plus Jakarta Sans', sans-serif; 
   min-height: 100vh;
   overflow-x: hidden;
   position: relative;
 }

 /* Background Blur Orbs */
 body::before {
   content: '';
   position: absolute;
   width: 400px; height: 400px;
   background: rgba(239, 68, 68, 0.12);
   border-radius: 50%;
   filter: blur(120px);
   top: -100px; left: -100px;
   z-index: -1;
 }
 body::after {
   content: '';
   position: absolute;
   width: 500px; height: 500px;
   background: rgba(239, 68, 68, 0.06);
   border-radius: 50%;
   filter: blur(150px);
   bottom: -100px; right: -100px;
   z-index: -1;
 }

 nav { 
   position: sticky; top: 0; z-index: 100; 
   background: rgba(7, 7, 10, 0.75); 
   backdrop-filter: blur(20px); 
   border-bottom: 1px solid var(--glass-border); 
   padding: 0 24px; height: 64px; 
   display: flex; align-items: center; justify-content: space-between; 
 }
 .nav-logo { font-size: 16px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; letter-spacing: 0.5px; }
 .nav-logo span.red-text { color: var(--primary); text-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
 .nav-logo .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 8px var(--primary); animation: pulse 2s ease-in-out infinite; }
 @keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.4; } }
 .container { max-width: 960px; margin: 0 auto; padding: 32px 20px; position: relative; z-index: 2; }

 /* GLASS BOX EFFECT */
 .glass-panel {
   background: var(--glass-bg);
   backdrop-filter: blur(25px);
   -webkit-backdrop-filter: blur(25px);
   border: 1px solid var(--glass-border);
   border-radius: 20px;
   box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
 }

 #login-view { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: calc(100vh - 64px); padding: 20px; }
 .login-box { padding: 48px 36px; width: 100%; max-width: 420px; text-align: center; border-top: 2px solid var(--primary); box-shadow: var(--red-glow); }
 .login-icon { font-size: 46px; margin-bottom: 20px; color: var(--primary); text-shadow: 0 0 15px rgba(239, 68, 68, 0.6); }
 .login-title { font-size: 22px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px; }
 .login-sub { font-size: 13px; color: var(--muted); margin-bottom: 32px; line-height: 1.5; }
 
 input[type="text"] { 
   width: 100%; background: rgba(0, 0, 0, 0.4); border: 1px solid var(--glass-border); border-radius: 10px; padding: 13px 16px; color: #fff; font-family: var(--mono); font-size: 14px; outline: none; transition: all 0.3s ease; margin-bottom: 16px; 
 }
 input[type="text"]:focus { border-color: var(--primary); box-shadow: 0 0 10px rgba(239, 68, 68, 0.25); background: rgba(0,0,0,0.6); }
 input[type="text"]::placeholder { color: #555566; }
 
 button.btn { 
   width: 100%; background: var(--primary); border: none; border-radius: 10px; padding: 13px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
 }
 button.btn:hover { background: #dc2626; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5); }
 button.btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
 .error-msg { font-size: 12px; color: #f87171; margin-top: 10px; display: none; font-weight: 500; }

 #dashboard-view { display: none; animation: fadeIn 0.4s ease; }
 @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
 .user-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; }
 .user-info { display: flex; align-items: center; gap: 14px; }
 .avatar { width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #b91c1c); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; color: #fff; box-shadow: 0 0 15px rgba(239, 68, 68, 0.3); border: 2px solid rgba(255,255,255,0.1); }
 .user-name { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
 .user-id { font-size: 12px; color: var(--muted); font-family: var(--mono); margin-top: 2px; }
 .btn-sm { background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); border-radius: 10px; padding: 10px 16px; color: #e5e7eb; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
 .btn-sm:hover { background: rgba(239, 68, 68, 0.15); border-color: var(--primary); color: #fff; }

 .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 32px; }
 .stat-card { padding: 20px; border-left: 3px solid var(--glass-border); transition: all 0.3s; }
 .stat-card:hover { border-left-color: var(--primary); background: rgba(239, 68, 68, 0.03); transform: translateY(-2px); }
 .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600; }
 .stat-value { font-size: 28px; font-weight: 700; font-family: var(--mono); }
 .stat-value.purple { color: #f43f5e; text-shadow: 0 0 10px rgba(244,63,94,0.3); }
 .stat-value.green { color: var(--green); text-shadow: 0 0 10px rgba(16,185,129,0.3); }
 .stat-value.cyan { color: var(--cyan); text-shadow: 0 0 10px rgba(6,182,212,0.3); }
 .stat-value.yellow { color: var(--yellow); text-shadow: 0 0 10px rgba(245,158,11,0.3); }

 .filter-bar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
 .filter-btn { background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 30px; padding: 7px 18px; font-size: 12px; color: var(--muted); font-weight: 500; cursor: pointer; transition: all 0.2s; }
 .filter-btn:hover { border-color: rgba(239, 68, 68, 0.4); color: #fff; }
 .filter-btn.active { background: var(--primary); border-color: var(--primary); color: #fff; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
 
 .section-title { font-size: 13px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
 .section-title::before { content: ''; display: inline-block; width: 4px; height: 14px; background: var(--primary); border-radius: 2px; }

 .history-list { display: flex; flex-direction: column; gap: 10px; }
 .history-item { padding: 16px 20px; display: flex; align-items: center; gap: 16px; transition: all 0.2s ease; }
 .history-item:hover { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.02); transform: scale(1.005); }
 
 .platform-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
 .pi-yt { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
 .pi-tt { background: rgba(255, 255, 255, 0.08); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
 .pi-sp { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
 .pi-pin { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
 
 .history-info { flex: 1; min-width: 0; }
 .history-title { font-size: 14px; font-weight: 500; color: #f3f4f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px; }
 .history-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
 
 .tag { font-size: 10px; font-family: var(--mono); padding: 2px 8px; border-radius: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
 .tag-mp4 { color: var(--cyan); background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.2); }
 .tag-mp3 { color: var(--green); background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.2); }
 .tag-img { color: var(--yellow); background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.2); }
 .tag-audio { color: #a78bfa; background: rgba(167, 139, 250, 0.12); border: 1px solid rgba(167, 139, 250, 0.2); }

 .history-date { font-size: 11px; color: rgba(156, 163, 171, 0.7); font-family: var(--mono); }
 .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
 .status-ok { background: var(--green); box-shadow: 0 0 8px var(--green); }
 .status-fail { background: var(--primary); box-shadow: 0 0 8px var(--primary); }
 
 .open-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); border-radius: 8px; padding: 6px 14px; font-size: 12px; color: #fff; text-decoration: none; transition: all 0.2s; font-weight: 500; }
 .open-btn:hover { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 12px rgba(239,68,68,0.4); }

 .empty-state { text-align: center; padding: 64px 20px; color: var(--muted); }
 .empty-icon { font-size: 44px; margin-bottom: 12px; opacity: 0.6; }
 .empty-text { font-size: 14px; }
 
 .spinner { display: inline-block; width: 22px; height: 22px; border: 2.5px solid rgba(255,255,255,0.05); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s cubic-bezier(0.5, 0, 0.5, 1) infinite; }
 @keyframes spin { to { transform: rotate(360deg); } }
 .loading-row { display: flex; justify-content: center; padding: 48px; }
</style>
</head>
<body>

<nav>
 <div class="nav-logo"><span class="dot"></span>AMERTAK <span class="red-text">BOT</span></div>
 <span style="font-size:11px; color:var(--muted); font-family:var(--mono); text-transform:uppercase; letter-spacing:1px;">Premium Console</span>
</nav>

<div id="login-view">
 <div class="login-box glass-panel">
   <div class="login-icon">⚑</div>
   <div class="login-title">Sign in to Cloud Dashboard</div>
   <div class="login-sub">Enter your Telegram Unique ID to review live telemetry and download history.</div>
   <input type="text" id="uid-input" placeholder="Enter Telegram User ID..." />
   <div class="error-msg" id="login-error">Telemetry Database: User ID not found</div>
   <button class="btn" id="login-btn" onclick="doLogin()">Access Database</button>
   <p style="margin-top:20px; font-size:11px; color:var(--muted);">
     Find your ID via Telegram secure network: <a href="https://t.me/userinfobot" target="_blank" style="color:var(--primary); text-decoration:none; font-weight:600;">@userinfobot</a>
   </p>
 </div>
</div>

<div id="dashboard-view">
 <div class="container">
   <div class="user-header">
     <div class="user-info">
       <div class="avatar" id="user-avatar">?</div>
       <div>
         <div class="user-name" id="user-name">—</div>
         <div class="user-id" id="user-id-label">TELEMETRY ID: —</div>
       </div>
     </div>
     <button class="btn-sm" onclick="doLogout()">Disconnect Server →</button>
   </div>

   <div class="stats-row">
     <div class="glass-panel stat-card"><div class="stat-label">Total Pipeline</div><div class="stat-value purple" id="stat-total">0</div></div>
     <div class="glass-panel stat-card"><div class="stat-label">YouTube Net</div><div class="stat-value green" id="stat-yt">0</div></div>
     <div class="glass-panel stat-card"><div class="stat-label">TikTok Net</div><div class="stat-value cyan" id="stat-tt">0</div></div>
     <div class="glass-panel stat-card"><div class="stat-label">Other Assets</div><div class="stat-value yellow" id="stat-other">0</div></div>
   </div>

   <div class="filter-bar">
     <button class="filter-btn active" onclick="setFilter('all', this)">All Nodes</button>
     <button class="filter-btn" onclick="setFilter('youtube', this)">YouTube</button>
     <button class="filter-btn" onclick="setFilter('tiktok', this)">TikTok</button>
     <button class="filter-btn" onclick="setFilter('spotify', this)">Spotify</button>
     <button class="filter-btn" onclick="setFilter('pinterest', this)">Pinterest</button>
   </div>

   <div class="section-title">Central Data Logs</div>
   <div class="glass-panel history-list" id="history-list" style="border-radius:16px; overflow:hidden;">
     <div class="loading-row"><div class="spinner"></div></div>
   </div>
 </div>
</div>

<script>
let allRecords = [];
let currentFilter = 'all';

(function autoLogin() {
 const params = new URLSearchParams(window.location.search);
 const uid = params.get('uid');
 if (uid) {
   document.getElementById('uid-input').value = uid;
   setTimeout(() => doLogin(), 100);
 }
})();

function doLogin() {
 const uid = document.getElementById('uid-input').value.trim();
 if (!uid) return;
 const btn = document.getElementById('login-btn');
 btn.disabled = true;
 btn.textContent = 'Synchronizing...';
 fetch('/api/history/' + uid)
   .then(r => r.json())
   .then(data => {
     if (!data || data.error) {
       document.getElementById('login-error').style.display = 'block';
       btn.disabled = false;
       btn.textContent = 'Access Database';
       return;
     }
     showDashboard(uid, data);
   })
   .catch(() => {
     document.getElementById('login-error').style.display = 'block';
     btn.disabled = false;
     btn.textContent = 'Access Database';
   });
}

document.getElementById('uid-input').addEventListener('keydown', e => {
 if (e.key === 'Enter') doLogin();
});

function showDashboard(uid, data) {
 document.getElementById('login-view').style.display = 'none';
 document.getElementById('dashboard-view').style.display = 'block';

 const uname = data.username || 'User';
 document.getElementById('user-avatar').textContent = uname.charAt(0).toUpperCase();
 document.getElementById('user-name').textContent = uname;
 document.getElementById('user-id-label').textContent = 'TELEMETRY ID: ' + uid;

 allRecords = data.records || [];
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
 btn.textContent = 'Access Database';
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
   list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No operational logs found for this node.</div></div>';
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
 const shortUrl = r.url ? (r.url.length > 45 ? r.url.slice(0, 45) + '…' : r.url) : 'Unknown Asset Source';
 const status = r.status === 'ok' ? 'status-ok' : 'status-fail';
 return \`<div class="history-item" style="border-bottom: 1px solid rgba(239, 68, 68, 0.06);">
   <div class="platform-icon \${pi.cls}">\${pi.icon}</div>
   <div class="history-info">
     <div class="history-title" title="\${r.url || ''}">\${shortUrl}</div>
     <div class="history-meta">
       <span class="tag \${tagCls}">\${(r.format || 'file').toUpperCase()}</span>
       <span class="history-date">\${dateStr}</span>
     </div>
   </div>
   <div class="status-dot \${status}" title="\${r.status === 'ok' ? 'Pipeline Active' : 'Pipeline Failed'}"></div>
   \${r.url ? \`<a class="open-btn" href="\${r.url}" target="_blank" rel="noopener">↗ Inspect</a>\` : ''}
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
 res.send("Bot Running ✅ | <a href='/dashboard'>Premium Dashboard</a>");
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
 console.log(`🌐 Infrastructure live on port ${PORT}`);
});

/*
========================================
TELEGRAM BOT CENTRAL CORE (COBALT INTERACTION)
========================================
*/

const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });
const BASE_URL = process.env.BASE_URL || "https://AmertakBotDownloader.onrender.com";

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const pendingDownloads = new Map();
function makeCallback(action, url, userId, username) {
 const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
 pendingDownloads.set(id, { url, userId, username });
 return `${action}|${id}`;
}

// មុខងារកណ្តាលសម្រាប់ហៅទៅ Cobalt API (Free, No Keys, Handles Everything)
async function processCobaltDownload(chatId, targetUrl, formatType, platform, userId, username, optionalType = "video") {
  const wait = await bot.sendMessage(chatId, "⏳ កំពុងដំណើរការទាញយកពីប្រព័ន្ធរួម (Cobalt Matrix)...");
  try {
    let mode = "video";
    if (formatType === "mp3" || formatType === "audio") mode = "audio";
    if (formatType === "thumbnail" || optionalType === "image") mode = "video"; // Cobalt extracts images through post requests

    const response = await axios.post("https://api.cobalt.tools/api/json", {
      url: targetUrl,
      downloadMode: mode,
      videoQuality: "720",
      audioFormat: "mp3",
      filenameStyle: "pretty"
    }, {
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      timeout: 40000
    });

    const data = response.data;

    if (data.status === "redirect" || data.status === "stream" || data.status === "picker") {
      let downloadLink = data.url || (data.picker && data.picker[0].url);
      
      if (!downloadLink) throw new Error("No payload URL generated");

      // Handle Formats natively via Telegram Stream injection
      if (formatType === "mp3" || formatType === "audio") {
        await bot.sendAudio(chatId, downloadLink, { caption: "✓ ទាញយកសំឡេងជោគជ័យ (Cobalt Engine)" });
      } else if (formatType === "thumbnail" || optionalType === "image") {
        // If picker contains multiple images (like TikTok Slideshow or Pinterest)
        if (data.picker) {
          for (let i = 0; i < Math.min(data.picker.length, 3); i++) {
            await bot.sendPhoto(chatId, data.picker[i].url, { caption: `✓ រូបភាពទី ${i+1}` });
          }
        } else {
          await bot.sendPhoto(chatId, downloadLink, { caption: "✓ ទាញយករូបភាពជោគជ័យ" });
        }
      } else {
        await bot.sendVideo(chatId, downloadLink, { caption: "✓ ទាញយកវីដេអូជោគជ័យ (Cobalt Engine)" });
      }

      addHistory(userId, username, { platform, format: formatType, url: targetUrl, status: "ok" });
    } else {
      throw new Error(data.text || "API Refused connection");
    }
  } catch (err) {
    console.error("Cobalt Core Exception:", err.message);
    addHistory(userId, username, { platform, format: formatType, url: targetUrl, status: "fail" });
    bot.sendMessage(chatId, `✘ ការទាញយកបរាជ័យ! ប្រព័ន្ធមិនអាចទាញយក Link នេះបានទេ (ឬឯកសារធំពេក)។`);
  }
  bot.deleteMessage(chatId, wait.message_id).catch(() => {});
}

/*
========================================
SPOTIFY ENGINE (COBALT YT-FALLBACK INTEGRATION)
========================================
*/
async function handleSpotifyRouting(chatId, spotUrl, userId, username) {
  const wait = await bot.sendMessage(chatId, "⏳ កំពុងទាញយកទិន្នន័យបទចម្រៀងពី Spotify...");
  try {
    // Fetch Metadata safely via Open Oembed protocols
    const api = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotUrl)}`;
    const { data } = await axios.get(api);

    const trackTitle = data.title || "Unknown Track";
    const artistName = data.author_name || "Unknown Artist";
    const thumbUrl = data.thumbnail_url;

    await bot.sendPhoto(chatId, thumbUrl, {
       caption: `🎵 *Spotify Premium Track*\n\n📌 បទ៖ *${trackTitle}*\n👤 ដោយ៖ *${artistName}*\n\n📡 ប្រព័ន្ធកំពុងស្វែងរក និងទាញយកសំឡេងចេញពី YouTube Matrix...`,
       parse_mode: "Markdown"
    });
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});

    // Route search string to Cobalt via automated YouTube routing query
    const searchQuery = `https://www.youtube.com/results?search_query=${encodeURIComponent(trackTitle + " " + artistName + " official audio")}`;
    
    // Process via cobalt server directly using search algorithm fallback
    await processCobaltDownload(chatId, searchQuery, "mp3", "spotify", userId, username);
  } catch (err) {
    console.error("Spotify Routing Error:", err.message);
    addHistory(userId, username, { platform: "spotify", format: "audio", url: spotUrl, status: "fail" });
    bot.sendMessage(chatId, "✘ មិនអាចទាញយកបទពី Spotify នេះបានទេ លីងអាចមិនត្រឹមត្រូវ។");
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  }
}

/*
========================================
BOT ROUTERS & INTERFACES
========================================
*/

bot.onText(/\/start/, async (msg) => {
 bot.sendMessage(
   msg.chat.id,
`⚑ *សូមស្វាគមន៏មកកាន់ Amertak Bot Downloader (Premium)*

✱ *Commands:*
✦ /dashboard - បើកមើលប្រវត្តិទាញយក
✦ /clear - សម្អាតប្រវត្តិទាញយកចោល

✱ *ប្រព័ន្ធគាំទ្រ (No Limits):*
✦ YouTube (វីដេអូ/សំឡេង/Thumbnail)
✦ TikTok (វីដេអូគ្មានម៉ាក/រូបភាព/សំឡេង)
✦ Pinterest (រូបភាព/វីដេអូ)
✦ Spotify (ទាញយកជា MP3 ពេញនិយម)

⚙️ _ផ្ញើលីងណាមួយមកកាន់ Bot ឥឡូវនេះ ដើម្បីសាកល្បងល្បឿនទាញយកកម្រិតខ្ពស់!_`, {
     parse_mode: "Markdown"
   }
 );
});

bot.onText(/\/dashboard/, async (msg) => {
 const uid = msg.from.id;
 bot.sendMessage(
   msg.chat.id,
   `📊 *Cloud Dashboard Telemetry*\n\nចុចប៊ូតុងខាងក្រោមដើម្បីបើកផ្ទាំងគ្រប់គ្រងប្រវត្តិទាញយករបស់អ្នក៖`,
   {
     parse_mode: "Markdown",
     reply_markup: {
       inline_keyboard: [[
         { text: "🖥️ បើក Dashboard", web_app: { url: `${BASE_URL}/dashboard?uid=${uid}` } }
       ]]
     }
   }
 );
});

bot.onText(/\/clear/, async (msg) => {
 const userId = String(msg.from.id);
 const history = loadHistory();
 if (history[userId]) {
   history[userId].records = [];
   saveHistory(history);
 }
 bot.sendMessage(msg.chat.id, "✓ ប្រវត្តិទាញយករបស់អ្នកត្រូវបានសម្អាតពី Database ជោគជ័យ។");
});

bot.on("message", async (msg) => {
 try {
   const chatId = msg.chat.id;
   const text = msg.text;
   const userId = String(msg.from.id);
   const username = msg.from.username || msg.from.first_name || "User";

   if (!text || text.startsWith("/")) return;

   // 1. YOUTUBE ROUTER
   if (text.includes("youtube.com") || text.includes("youtu.be") || text.includes("shorts")) {
     return bot.sendMessage(chatId, `⚑ *YouTube Downloader*\n\nសូមជ្រើសរើសទម្រង់ហ្វាយ ⮯`, {
         reply_markup: {
           inline_keyboard: [[
             { text: "🎬 វីដេអូ (MP4)", callback_data: makeCallback("yt_mp4", text, userId, username) },
             { text: "🎵 សំឡេង (MP3)", callback_data: makeCallback("yt_mp3", text, userId, username) },
             { text: "🖼 Thumbnail", callback_data: makeCallback("yt_thumb", text, userId, username) }
           ]]
         }
       });
   }

   // 2. TIKTOK ROUTER
   if (text.includes("tiktok.com")) {
     return bot.sendMessage(chatId, `⚑ *TikTok Downloader*\n\nសូមជ្រើសរើសទម្រង់ហ្វាយ ⮯`, {
         reply_markup: {
           inline_keyboard: [[
             { text: "🎬 វីដេអូ (No WM)", callback_data: makeCallback("tt_video", text, userId, username) },
             { text: "🎵 សំឡេង (MP3)", callback_data: makeCallback("tt_audio", text, userId, username) },
             { text: "🖼 រូបភាព/Slides", callback_data: makeCallback("tt_image", text, userId, username) }
           ]]
         }
       });
   }

   // 3. PINTEREST ROUTER
   if (text.includes("pinterest.com") || text.includes("pin.it")) {
     return bot.sendMessage(chatId, `⚑ *Pinterest Downloader*\n\nសូមជ្រើសរើសទម្រង់ហ្វាយ ⮯`, {
         reply_markup: {
           inline_keyboard: [[
             { text: "🎬 ទាញយកវីដេអូ", callback_data: makeCallback("pin_video", text, userId, username) },
             { text: "🖼 ទាញយករូបភាព", callback_data: makeCallback("pin_image", text, userId, username) }
           ]]
         }
       });
   }

   // 4. SPOTIFY ROUTER
   if (text.includes("spotify.com") || text.startsWith("spotify:")) {
     return handleSpotifyRouting(chatId, text, userId, username);
   }

   bot.sendMessage(chatId, "✘ មិនគាំទ្រទម្រង់ Link នេះទេបាទ។ សូមផ្ញើលីងឱ្យបានត្រឹមត្រូវឡើងវិញ!");
 } catch (err) {
   console.log(err);
 }
});

bot.on("callback_query", async (query) => {
 try {
   if (!query || !query.data) return;
   await bot.answerCallbackQuery(query.id, { text: "កំពុងចាប់ផ្តើមទាញយក..." });

   const chatId = query.message.chat.id;
   const data = query.data.split("|");
   const action = data[0];
   const key = data[1];

   if (!pendingDownloads.has(key)) return;
   const { url, userId, username } = pendingDownloads.get(key);
   pendingDownloads.delete(key);

   // Execute actions natively via unified Cobalt Core Engine
   if (action === "yt_mp4")   return processCobaltDownload(chatId, url, "mp4", "youtube", userId, username);
   if (action === "yt_mp3")   return processCobaltDownload(chatId, url, "mp3", "youtube", userId, username);
   if (action === "yt_thumb") return processCobaltDownload(chatId, url, "thumbnail", "youtube", userId, username);
   if (action === "tt_video") return processCobaltDownload(chatId, url, "mp4", "tiktok", userId, username);
   if (action === "tt_audio") return processCobaltDownload(chatId, url, "mp3", "tiktok", userId, username);
   if (action === "tt_image") return processCobaltDownload(chatId, url, "image", "tiktok", userId, username, "image");
   if (action === "pin_video") return processCobaltDownload(chatId, url, "mp4", "pinterest", userId, username);
   if (action === "pin_image") return processCobaltDownload(chatId, url, "image", "pinterest", userId, username, "image");
 } catch (err) {
   console.log(err);
 }
});

console.log("🚀 Premium Telemetry & Bot Downloader Pipeline Secured and Online.");