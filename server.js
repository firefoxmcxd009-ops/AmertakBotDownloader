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
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>AmertakBot — Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
:root {
  --red:#ef4444;--red-dim:rgba(239,68,68,0.15);--red-glow:0 0 28px rgba(239,68,68,0.45);
  --green:#10b981;--cyan:#06b6d4;--yellow:#f59e0b;--purple:#f43f5e;--violet:#a78bfa;
  --bg:#07070a;--surface:rgba(18,12,12,0.55);--border:rgba(239,68,68,0.14);
  --text:#f3f4f6;--muted:#9ca3af;
  --sidebar-w:240px;--header-h:60px;--radius:16px;--blur:22px;
  --trans:0.25s cubic-bezier(.4,0,.2,1);--mono:'JetBrains Mono',monospace;
}
[data-theme="light"] {
  --bg:#f0f0f5;--surface:rgba(255,255,255,0.65);--border:rgba(239,68,68,0.18);
  --text:#111827;--muted:#6b7280;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;transition:background var(--trans),color var(--trans)}
.orb{position:fixed;pointer-events:none;border-radius:50%;filter:blur(130px);z-index:0}
.orb-1{width:500px;height:500px;background:rgba(239,68,68,0.10);top:-160px;left:-160px}
.orb-2{width:600px;height:600px;background:rgba(239,68,68,0.06);bottom:-200px;right:-200px}
[data-theme="light"] .orb-1{background:rgba(239,68,68,0.07)}
[data-theme="light"] .orb-2{background:rgba(239,68,68,0.05)}
.glass{background:var(--surface);backdrop-filter:blur(var(--blur));-webkit-backdrop-filter:blur(var(--blur));border:1px solid var(--border);transition:background var(--trans),border-color var(--trans)}

/* HEADER */
.header{position:fixed;top:0;left:0;right:0;height:var(--header-h);z-index:200;display:flex;align-items:center;justify-content:space-between;padding:0 20px 0 16px;border-bottom:1px solid var(--border);background:var(--surface);backdrop-filter:blur(var(--blur));-webkit-backdrop-filter:blur(var(--blur));transition:background var(--trans)}
.header-left{display:flex;align-items:center;gap:12px}
.hamburger{display:none;flex-direction:column;gap:5px;background:transparent;border:none;cursor:pointer;padding:6px;border-radius:8px;transition:background var(--trans)}
.hamburger:hover{background:var(--red-dim)}
.hamburger span{display:block;width:20px;height:2px;background:var(--text);border-radius:2px;transition:transform var(--trans),opacity var(--trans)}
.hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.hamburger.open span:nth-child(2){opacity:0}
.hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
.logo{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700;color:var(--text);letter-spacing:.4px;text-decoration:none}
.logo-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 2s ease-in-out infinite;flex-shrink:0}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.4}}
.logo strong{color:var(--red);text-shadow:0 0 10px rgba(239,68,68,.5)}
.header-right{display:flex;align-items:center;gap:10px}
.theme-toggle{width:36px;height:36px;border-radius:10px;background:transparent;border:1px solid var(--border);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--trans);flex-shrink:0}
.theme-toggle:hover{background:var(--red-dim);border-color:var(--red);color:var(--red)}
.theme-toggle svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.header-badge{font-size:11px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;display:none}
@media(min-width:520px){.header-badge{display:block}}

/* SIDEBAR */
.sidebar{position:fixed;top:var(--header-h);left:0;bottom:0;width:var(--sidebar-w);z-index:150;border-right:1px solid var(--border);background:var(--surface);backdrop-filter:blur(var(--blur));-webkit-backdrop-filter:blur(var(--blur));display:flex;flex-direction:column;padding:20px 12px;gap:4px;overflow-y:auto;transition:transform var(--trans),background var(--trans)}
.sidebar-section{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.3px;padding:12px 10px 6px}
.nav-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:500;color:var(--muted);cursor:pointer;border:none;background:transparent;width:100%;text-align:left;transition:all var(--trans);position:relative}
.nav-item svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.nav-item:hover{background:var(--red-dim);color:var(--text)}
.nav-item.active{background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.22)}
.nav-item.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:70%;background:var(--red);border-radius:0 3px 3px 0}
.nav-badge{margin-left:auto;background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px;font-family:var(--mono);min-width:20px;text-align:center}
.sidebar-divider{height:1px;background:var(--border);margin:8px 0}
.sidebar-footer{margin-top:auto;padding-top:12px}
.sidebar-overlay{display:none;position:fixed;inset:0;z-index:140;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);animation:fadeIn .2s}
.sidebar-overlay.visible{display:block}

/* MAIN */
.main{margin-left:var(--sidebar-w);margin-top:var(--header-h);min-height:calc(100vh - var(--header-h));padding:28px 24px;position:relative;z-index:1;transition:margin var(--trans)}
@media(max-width:768px){
  .main{margin-left:0;padding:20px 14px}
  .hamburger{display:flex}
  .sidebar{transform:translateX(-100%)}
  .sidebar.open{transform:translateX(0)}
}

/* VIEWS */
@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
#login-view{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - var(--header-h));padding:20px;animation:fadeIn .4s}
.login-box{padding:44px 36px;width:100%;max-width:420px;text-align:center;border-radius:var(--radius);border-top:2px solid var(--red);box-shadow:var(--red-glow)}
.login-icon{width:56px;height:56px;border-radius:14px;background:var(--red-dim);border:1px solid rgba(239,68,68,.3);display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
.login-icon svg{width:28px;height:28px;stroke:var(--red);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.login-title{font-size:21px;font-weight:700;margin-bottom:8px;letter-spacing:-.4px}
.login-sub{font-size:13px;color:var(--muted);margin-bottom:28px;line-height:1.6}
.input-wrap{position:relative;margin-bottom:14px}
.input-wrap svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:16px;height:16px;stroke:var(--muted);fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
input[type="text"]{width:100%;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:10px;padding:13px 14px 13px 42px;color:var(--text);font-family:var(--mono);font-size:14px;outline:none;transition:all var(--trans)}
[data-theme="light"] input[type="text"]{background:rgba(255,255,255,.7)}
input[type="text"]:focus{border-color:var(--red);box-shadow:0 0 12px rgba(239,68,68,.2)}
input[type="text"]::placeholder{color:#555566}
[data-theme="light"] input[type="text"]::placeholder{color:#aaa}
.btn-primary{width:100%;background:var(--red);border:none;border-radius:10px;padding:13px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all var(--trans);box-shadow:0 4px 18px rgba(239,68,68,.3)}
.btn-primary:hover:not(:disabled){background:#dc2626;transform:translateY(-1px);box-shadow:0 6px 24px rgba(239,68,68,.5)}
.btn-primary:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.error-msg{font-size:12px;color:#f87171;margin-top:10px;display:none;font-weight:500;animation:fadeIn .2s}
.login-hint{margin-top:18px;font-size:11px;color:var(--muted)}
.login-hint a{color:var(--red);text-decoration:none;font-weight:600}
.login-hint a:hover{text-decoration:underline}
#dashboard-view{display:none;animation:fadeIn .4s}

/* PAGE HEADER */
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:14px}
.user-info{display:flex;align-items:center;gap:14px}
.avatar{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--red),#b91c1c);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#fff;box-shadow:0 0 16px rgba(239,68,68,.3);border:2px solid rgba(255,255,255,.1);flex-shrink:0}
.user-name{font-size:17px;font-weight:600;letter-spacing:-.3px}
.user-id{font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:2px}
.btn-outline{background:transparent;border:1px solid var(--border);border-radius:10px;padding:9px 15px;color:var(--muted);font-size:13px;font-weight:500;cursor:pointer;transition:all var(--trans);display:flex;align-items:center;gap:7px}
.btn-outline svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.btn-outline:hover{background:var(--red-dim);border-color:var(--red);color:var(--red)}

/* STATS */
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:14px;margin-bottom:24px}
.stat-card{padding:20px 18px;border-radius:var(--radius);border-left:3px solid var(--border);transition:all var(--trans);position:relative;overflow:hidden}
.stat-card:hover{border-left-color:var(--red);transform:translateY(-2px)}
.stat-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.stat-icon svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.stat-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:6px}
.stat-value{font-size:30px;font-weight:700;font-family:var(--mono);line-height:1}
.c-red{color:var(--purple);text-shadow:0 0 10px rgba(244,63,94,.3)}
.c-green{color:var(--green);text-shadow:0 0 10px rgba(16,185,129,.3)}
.c-cyan{color:var(--cyan);text-shadow:0 0 10px rgba(6,182,212,.3)}
.c-yellow{color:var(--yellow);text-shadow:0 0 10px rgba(245,158,11,.3)}

/* FILTER BAR */
.filter-bar{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.filter-btn{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:30px;padding:7px 16px;font-size:12px;color:var(--muted);font-weight:500;cursor:pointer;transition:all var(--trans);display:flex;align-items:center;gap:6px}
.filter-btn svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.filter-btn:hover{border-color:rgba(239,68,68,.4);color:var(--text)}
.filter-btn.active{background:var(--red);border-color:var(--red);color:#fff;box-shadow:0 4px 14px rgba(239,68,68,.3)}
[data-theme="light"] .filter-btn{background:rgba(0,0,0,.04)}

/* HISTORY */
.section-label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.3px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.section-label::before{content:'';display:inline-block;width:3px;height:13px;background:var(--red);border-radius:2px}
.history-panel{border-radius:var(--radius);overflow:hidden}
.history-item{padding:14px 18px;display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);transition:all var(--trans);animation:fadeIn .3s}
.history-item:last-child{border-bottom:none}
.history-item:hover{background:rgba(239,68,68,.03);transform:translateX(2px)}
.platform-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.platform-icon svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.pi-yt{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
.pi-tt{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.1)}
[data-theme="light"] .pi-tt{background:rgba(0,0,0,.07);color:#333;border-color:rgba(0,0,0,.12)}
.pi-sp{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.2)}
.pi-pin{background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.2)}
.history-info{flex:1;min-width:0}
.history-title{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:5px}
.history-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tag{font-size:10px;font-family:var(--mono);padding:2px 7px;border-radius:5px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.tag-mp4{color:var(--cyan);background:rgba(6,182,212,.12);border:1px solid rgba(6,182,212,.2)}
.tag-mp3{color:var(--green);background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.2)}
.tag-img{color:var(--yellow);background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.2)}
.tag-audio{color:var(--violet);background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.2)}
.history-date{font-size:11px;color:rgba(156,163,171,.7);font-family:var(--mono)}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.status-ok{background:var(--green);box-shadow:0 0 8px var(--green)}
.status-fail{background:var(--red);box-shadow:0 0 8px var(--red)}
.btn-inspect{background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px;padding:5px 12px;font-size:11px;color:var(--muted);text-decoration:none;transition:all var(--trans);font-weight:500;display:flex;align-items:center;gap:5px;flex-shrink:0;white-space:nowrap}
.btn-inspect svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.btn-inspect:hover{background:var(--red);border-color:var(--red);color:#fff;box-shadow:0 0 12px rgba(239,68,68,.4)}

/* EMPTY & LOADING */
.empty-state{text-align:center;padding:60px 20px;color:var(--muted)}
.empty-icon{width:52px;height:52px;border-radius:14px;background:var(--red-dim);border:1px solid rgba(239,68,68,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;opacity:.7}
.empty-icon svg{width:26px;height:26px;stroke:var(--red);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.empty-text{font-size:14px;font-weight:500;margin-bottom:4px}
.empty-sub{font-size:12px;opacity:.6}
.spinner{display:inline-block;width:22px;height:22px;border:2.5px solid rgba(255,255,255,.06);border-top-color:var(--red);border-radius:50%;animation:spin .8s cubic-bezier(.5,0,.5,1) infinite}
[data-theme="light"] .spinner{border-color:rgba(0,0,0,.08);border-top-color:var(--red)}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-row{display:flex;justify-content:center;padding:48px}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(239,68,68,.25);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:rgba(239,68,68,.4)}
</style>
</head>
<body>
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>

<header class="header glass">
  <div class="header-left">
    <button class="hamburger" id="hamburger" onclick="toggleSidebar()" aria-label="Toggle menu">
      <span></span><span></span><span></span>
    </button>
    <a class="logo" href="#">
      <span class="logo-dot"></span>AMERTAK <strong>BOT</strong>
    </a>
  </div>
  <div class="header-right">
    <span class="header-badge">User Telemetry</span>
    <button class="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark">
      <svg id="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      <svg id="icon-sun" viewBox="0 0 24 24" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    </button>
  </div>
</header>

<div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>

<aside class="sidebar glass" id="sidebar">
  <span class="sidebar-section">Navigation</span>
  <button class="nav-item active" onclick="navClick(this,'all')">
    <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
    Download History
    <span class="nav-badge" id="badge-total">0</span>
  </button>
  <button class="nav-item" onclick="navClick(this,'youtube')">
    <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><polygon points="10,8 16,12 10,16"/></svg>
    YouTube
    <span class="nav-badge" id="badge-yt">0</span>
  </button>
  <button class="nav-item" onclick="navClick(this,'tiktok')">
    <svg viewBox="0 0 24 24"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
    TikTok
    <span class="nav-badge" id="badge-tt">0</span>
  </button>
  <button class="nav-item" onclick="navClick(this,'spotify')">
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 13.5a8 8 0 0 1 8 0M6.5 10.5a11 11 0 0 1 11 0M9.5 16.5a5 5 0 0 1 5 0"/></svg>
    Spotify
    <span class="nav-badge" id="badge-sp">0</span>
  </button>
  <button class="nav-item" onclick="navClick(this,'pinterest')">
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
    Pinterest
    <span class="nav-badge" id="badge-pin">0</span>
  </button>
  <div class="sidebar-divider"></div>
  <span class="sidebar-section">Account</span>
  <button class="nav-item" id="sidebar-logout" onclick="doLogout()" style="display:none">
    <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    Disconnect
  </button>
</aside>

<main class="main" id="main">
  <div id="login-view">
    <div class="login-box glass">
      <div class="login-icon">
        <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <div class="login-title">Sign in to Dashboard</div>
      <div class="login-sub">Enter your Telegram User ID to review telemetry and download history.</div>
      <div class="input-wrap">
        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <input type="text" id="uid-input" placeholder="Enter Telegram User ID..." autocomplete="off"/>
      </div>
      <div class="error-msg" id="login-error">⚠ User ID not found in database</div>
      <button class="btn-primary" id="login-btn" onclick="doLogin()">Access Dashboard</button>
      <p class="login-hint">Find your ID: <a href="https://t.me/userinfobot" target="_blank" rel="noopener">@userinfobot</a> or use /id in bot</p>
    </div>
  </div>

  <div id="dashboard-view">
    <div class="page-header">
      <div class="user-info">
        <div class="avatar" id="user-avatar">?</div>
        <div>
          <div class="user-name" id="user-name">—</div>
          <div class="user-id" id="user-id-label">TELEMETRY ID: —</div>
        </div>
      </div>
      <button class="btn-outline" onclick="doLogout()">
        <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Disconnect
      </button>
    </div>
    <div class="stats-row">
      <div class="glass stat-card">
        <div class="stat-icon" style="background:rgba(244,63,94,.15)">
          <svg viewBox="0 0 24 24" style="stroke:#f43f5e"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
        </div>
        <div class="stat-label">Total Pipeline</div>
        <div class="stat-value c-red" id="stat-total">0</div>
      </div>
      <div class="glass stat-card">
        <div class="stat-icon" style="background:rgba(16,185,129,.15)">
          <svg viewBox="0 0 24 24" style="stroke:#10b981"><rect x="2" y="2" width="20" height="20" rx="5"/><polygon points="10,8 16,12 10,16"/></svg>
        </div>
        <div class="stat-label">YouTube</div>
        <div class="stat-value c-green" id="stat-yt">0</div>
      </div>
      <div class="glass stat-card">
        <div class="stat-icon" style="background:rgba(6,182,212,.15)">
          <svg viewBox="0 0 24 24" style="stroke:#06b6d4"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
        </div>
        <div class="stat-label">TikTok</div>
        <div class="stat-value c-cyan" id="stat-tt">0</div>
      </div>
      <div class="glass stat-card">
        <div class="stat-icon" style="background:rgba(245,158,11,.15)">
          <svg viewBox="0 0 24 24" style="stroke:#f59e0b"><circle cx="12" cy="12" r="10"/><path d="M8 13.5a8 8 0 0 1 8 0M6.5 10.5a11 11 0 0 1 11 0"/></svg>
        </div>
        <div class="stat-label">Other Assets</div>
        <div class="stat-value c-yellow" id="stat-other">0</div>
      </div>
    </div>
    <div class="filter-bar" id="filter-bar">
      <button class="filter-btn active" onclick="setFilter('all',this)">
        <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/></svg>All Nodes
      </button>
      <button class="filter-btn" onclick="setFilter('youtube',this)">
        <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><polygon points="10,8 16,12 10,16"/></svg>YouTube
      </button>
      <button class="filter-btn" onclick="setFilter('tiktok',this)">
        <svg viewBox="0 0 24 24"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>TikTok
      </button>
      <button class="filter-btn" onclick="setFilter('spotify',this)">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 13.5a8 8 0 0 1 8 0"/></svg>Spotify
      </button>
      <button class="filter-btn" onclick="setFilter('pinterest',this)">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>Pinterest
      </button>
    </div>
    <div class="section-label">Download Log</div>
    <div class="glass history-panel" id="history-list">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>
  </div>
</main>

<script>
let allRecords = [];
let currentFilter = 'all';

(function(){
  const uid = new URLSearchParams(window.location.search).get('uid');
  if(uid){ document.getElementById('uid-input').value = uid; setTimeout(doLogin, 100); }
  const saved = localStorage.getItem('theme');
  if(saved){ document.documentElement.setAttribute('data-theme',saved); if(saved==='light'){document.getElementById('icon-moon').style.display='none';document.getElementById('icon-sun').style.display='';} }
})();

function doLogin(){
  const uid = document.getElementById('uid-input').value.trim();
  if(!uid) return;
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Synchronizing...';
  document.getElementById('login-error').style.display = 'none';
  fetch('/api/history/' + uid)
    .then(r => r.json())
    .then(data => {
      if(!data || data.error){ document.getElementById('login-error').style.display='block'; btn.disabled=false; btn.textContent='Access Dashboard'; return; }
      showDashboard(uid, data);
    })
    .catch(() => { document.getElementById('login-error').style.display='block'; btn.disabled=false; btn.textContent='Access Dashboard'; });
}

document.getElementById('uid-input').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

function showDashboard(uid, data){
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('dashboard-view').style.display = 'block';
  document.getElementById('sidebar-logout').style.display = 'flex';
  const uname = data.username || 'User';
  document.getElementById('user-avatar').textContent = uname.charAt(0).toUpperCase();
  document.getElementById('user-name').textContent = uname;
  document.getElementById('user-id-label').textContent = 'TELEMETRY ID: ' + uid;
  allRecords = data.records || [];
  const yt = allRecords.filter(r=>r.platform==='youtube').length;
  const tt = allRecords.filter(r=>r.platform==='tiktok').length;
  const sp = allRecords.filter(r=>r.platform==='spotify').length;
  const pin = allRecords.filter(r=>r.platform==='pinterest').length;
  document.getElementById('stat-total').textContent = allRecords.length;
  document.getElementById('stat-yt').textContent = yt;
  document.getElementById('stat-tt').textContent = tt;
  document.getElementById('stat-other').textContent = allRecords.length - yt - tt;
  document.getElementById('badge-total').textContent = allRecords.length;
  document.getElementById('badge-yt').textContent = yt;
  document.getElementById('badge-tt').textContent = tt;
  document.getElementById('badge-sp').textContent = sp;
  document.getElementById('badge-pin').textContent = pin;
  renderList();
}

function doLogout(){
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('sidebar-logout').style.display = 'none';
  document.getElementById('uid-input').value = '';
  document.getElementById('login-error').style.display = 'none';
  const btn = document.getElementById('login-btn'); btn.disabled=false; btn.textContent='Access Dashboard';
  allRecords = []; closeSidebar();
}

function setFilter(f, el){
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); renderList(); closeSidebar();
}

function navClick(el, platform){
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const filterEl = [...document.querySelectorAll('.filter-btn')].find(b => {
    const t = b.textContent.trim().toLowerCase();
    return platform==='all' ? t.startsWith('all') : t.startsWith(platform);
  });
  if(filterEl) setFilter(platform, filterEl);
  else { currentFilter=platform; renderList(); closeSidebar(); }
}

const PI = {
  youtube: {cls:'pi-yt', svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><polygon points="10,8 16,12 10,16"/></svg>'},
  tiktok:  {cls:'pi-tt', svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>'},
  spotify: {cls:'pi-sp', svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13.5a8 8 0 0 1 8 0M6.5 10.5a11 11 0 0 1 11 0M9.5 16.5a5 5 0 0 1 5 0"/></svg>'},
  pinterest:{cls:'pi-pin',svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'},
};
const FMT = {mp4:'tag-mp4',mp3:'tag-mp3',audio:'tag-audio',image:'tag-img',thumbnail:'tag-img'};

function renderList(){
  const list = document.getElementById('history-list');
  let records = currentFilter==='all' ? allRecords : allRecords.filter(r=>r.platform===currentFilter);
  if(!records.length){
    list.innerHTML = '<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div class="empty-text">No logs found.</div><div class="empty-sub">Try a different filter or download something first.</div></div>';
    return;
  }
  list.innerHTML = records.map(r => {
    const pi = PI[r.platform] || PI.tiktok;
    const tc = FMT[r.format] || 'tag-mp4';
    const d = new Date(r.date);
    const ds = d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    const su = r.url ? (r.url.length>46 ? r.url.slice(0,46)+'…' : r.url) : 'Unknown Source';
    const st = r.status==='ok' ? 'status-ok' : 'status-fail';
    const ib = r.url ? '<a class="btn-inspect" href="'+r.url+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Inspect</a>' : '';
    return '<div class="history-item"><div class="platform-icon '+pi.cls+'">'+pi.svg+'</div><div class="history-info"><div class="history-title" title="'+(r.url||'')+'">'+su+'</div><div class="history-meta"><span class="tag '+tc+'">'+(r.format||'file').toUpperCase()+'</span><span class="history-date">'+ds+'</span></div></div><div class="status-dot '+st+'" title="'+(r.status==='ok'?'Success':'Failed')+'"></div>'+ib+'</div>';
  }).join('');
}

function toggleSidebar(){
  const s=document.getElementById('sidebar'),o=document.getElementById('sidebar-overlay'),h=document.getElementById('hamburger');
  const open=s.classList.toggle('open'); h.classList.toggle('open',open); o.classList.toggle('visible',open);
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}
function toggleTheme(){
  const html=document.documentElement, isDark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme',isDark?'light':'dark');
  document.getElementById('icon-moon').style.display=isDark?'none':'';
  document.getElementById('icon-sun').style.display=isDark?'':'none';
  localStorage.setItem('theme',isDark?'light':'dark');
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
CLEAR WEBHOOK
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
DYNAMIC PATHS (WINDOWS vs LINUX / RENDER)
========================================
*/

const YTDLP_PATH = process.env.NODE_ENV === "production"
  ? path.join(__dirname, "bin", "yt-dlp")
  : "yt-dlp";

const ffmpegPath = process.env.NODE_ENV === "production"
  ? path.join(__dirname, "bin", "ffmpeg")
  : "ffmpeg";

const COOKIES_PATH = process.env.COOKIES_PATH || path.join(__dirname, "cookies.txt");
const HAS_COOKIES = fs.existsSync(COOKIES_PATH);

if (HAS_COOKIES) {
  console.log("✅ YouTube cookies.txt found:", COOKIES_PATH);
} else {
  console.log("⚠️  No cookies.txt found — YouTube may fail on Render");
}

async function ensureYtDlp() {
  return new Promise((resolve) => {
    const cmd = process.env.NODE_ENV === "production"
      ? `"${YTDLP_PATH}" --version`
      : "yt-dlp --version";
    exec(cmd, (err, stdout) => {
      if (err) {
        console.log("❌ yt-dlp not found at path:", YTDLP_PATH);
        return resolve(false);
      }
      console.log("✅ yt-dlp found:", stdout.trim());
      resolve(true);
    });
  });
}

/*
========================================
TELEGRAM BOT
========================================
*/

const bot = new TelegramBot(TOKEN, { polling: false });

bot.on("polling_error", async (err) => {
  console.error("polling_error:", err.message || err);
  try {
    if (err.code === "ETELEGRAM" && err.message.includes("409")) {
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
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

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
DOWNLOAD DIR & PENDING MAP
========================================
*/

const DOWNLOAD_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

const pendingDownloads = new Map();

function makeCallback(action, url, userId, username) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  pendingDownloads.set(id, { url, userId, username });
  return `${action}|${id}`;
}

const BASE_URL = process.env.BASE_URL || "https://AmertakBotDownloader.onrender.com";

/*
========================================
BOT COMMANDS
========================================
*/

bot.onText(/\/start/, async (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `⚑ *សូមស្វាគមន៏មកកាន់ Amertak Bot Downloader*

✱ Commands:
✦ /dashboard - បើកផ្ទាំងគ្រប់គ្រងប្រវត្តិ
✦ /id - មើល Telegram User ID របស់អ្នក
✦ /clear - សម្អាតប្រវត្តិទាញយក

✱ Supported Platforms:
✦ [YouTube](youtube.com)
✦ [TikTok](tiktok.com)
✦ [Pinterest](Pinterest.com)
✦ [Spotify](Spotify.com)

⚙️ _ផ្ញើលីងណាមួយមកកាន់ Bot ដើម្បីសាកល្បង!_`,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/id/, async (msg) => {
  const uid      = msg.from.id;
  const uname    = msg.from.username  ? "@" + msg.from.username : "—";
  const fname    = msg.from.first_name || "";
  const lname    = msg.from.last_name  || "";
  const fullname = (fname + " " + lname).trim() || "Unknown";
  bot.sendMessage(
    msg.chat.id,
    `⚑ *Telegram User Info*\n\n` +
    `✦ *ID:* \`${uid}\`\n` +
    `✦ *Name:* ${fullname}\n` +
    `✦ *Username:* ${uname}\n\n` +
    `_Copy the ID above to sign in to the Dashboard._`,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/dashboard/, async (msg) => {
  const uid = msg.from.id;
  bot.sendMessage(
    msg.chat.id,
    `📊 *Dashboard*\n\nចុចប៊ូតុងខាងក្រោមដើម្បីបើកផ្ទាំងគ្រប់គ្រងប្រវត្តិទាញយករបស់អ្នក៖`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "🖥️ Open Dashboard", web_app: { url: `${BASE_URL}/dashboard?uid=${uid}` } }
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
  bot.sendMessage(msg.chat.id, "✓ ប្រវត្តិទាញយករបស់អ្នកត្រូវបានសម្អាតជោគជ័យ។");
});

/*
========================================
MESSAGE HANDLER
========================================
*/

bot.on("message", async (msg) => {
  try {
    const chatId   = msg.chat.id;
    const text     = msg.text;
    const userId   = String(msg.from.id);
    const username = msg.from.username || msg.from.first_name || "User";

    if (!text || text.startsWith("/")) return;

    if (text.includes("youtube.com") || text.includes("youtu.be")) {
      return bot.sendMessage(chatId, `⚑ *YouTube Downloader*\n\nសូមជ្រើសរើសទម្រង់ហ្វាយ ⮯`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "🎬 វីដេអូ (MP4)", callback_data: makeCallback("yt_mp4",   text, userId, username) },
            { text: "🎵 សំឡេង (MP3)", callback_data: makeCallback("yt_mp3",   text, userId, username) },
            { text: "🖼 Thumbnail",    callback_data: makeCallback("yt_thumb", text, userId, username) }
          ]]
        }
      });
    }

    if (text.includes("tiktok.com")) {
      return bot.sendMessage(chatId, `⚑ *TikTok Downloader*\n\nសូមជ្រើសរើសទម្រង់ហ្វាយ ⮯`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "🎬 វីដេអូ",  callback_data: makeCallback("tt_video", text, userId, username) },
            { text: "🎵 សំឡេង",  callback_data: makeCallback("tt_audio", text, userId, username) },
            { text: "🖼 រូបភាព", callback_data: makeCallback("tt_image", text, userId, username) }
          ]]
        }
      });
    }

    if (text.includes("pinterest.com") || text.includes("pin.it")) {
      return bot.sendMessage(chatId, `⚑ *Pinterest Downloader*\n\nសូមជ្រើសរើសទម្រង់ហ្វាយ ⮯`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "⮩ ទាញយករូបភាព", callback_data: makeCallback("pin_image", text, userId, username) }
          ]]
        }
      });
    }

    if (text.includes("spotify.com") || text.startsWith("spotify:")) {
      return spotifyInfo(chatId, text, userId, username);
    }

    bot.sendMessage(chatId, "✘ មិនគាំទ្រទម្រង់ លីង នេះទេបាទ។");
  } catch (err) {
    console.log(err);
  }
});

/*
========================================
CALLBACK QUERY
========================================
*/

bot.on("callback_query", async (query) => {
  try {
    if (!query || !query.data) return;
    await bot.answerCallbackQuery(query.id, { text: "កំពុងដំណើរការ..." });

    const chatId = query.message.chat.id;
    const parts  = query.data.split("|");
    const action = parts[0];
    const key    = parts[1];

    let url      = key;
    let userId   = String(query.from.id);
    let username = query.from.username || query.from.first_name || "User";

    if (pendingDownloads.has(key)) {
      const stored = pendingDownloads.get(key);
      url      = stored.url;
      userId   = stored.userId   || userId;
      username = stored.username || username;
      pendingDownloads.delete(key);
    }

    if (action === "yt_mp4")    return downloadYouTubeVideo(chatId, url, userId, username);
    if (action === "yt_mp3")    return downloadYouTubeAudio(chatId, url, userId, username);
    if (action === "yt_thumb")  return downloadYouTubeThumbnail(chatId, url, userId, username);
    if (action === "tt_video")  return downloadTikTokVideo(chatId, url, userId, username);
    if (action === "tt_audio")  return downloadTikTokAudio(chatId, url, userId, username);
    if (action === "tt_image")  return downloadTikTokImage(chatId, url, userId, username);
    if (action === "pin_image") return downloadPinterest(chatId, url, userId, username);
  } catch (err) {
    console.log(err);
  }
});

/*
========================================
RAPIDAPI HELPER & YOUTUBE ENGINES
========================================
*/

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";

function extractYtId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  return match ? match[1] : null;
}

async function downloadStreamToFile(streamUrl, destPath, extraHeaders) {
  extraHeaders = extraHeaders || {};
  const response = await axios.get(streamUrl, {
    responseType: "stream",
    timeout: 1000 * 60 * 8,
    maxRedirects: 10,
    headers: Object.assign({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Referer": "https://rapidapi.com/"
    }, extraHeaders)
  });
  return new Promise(function (resolve, reject) {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function tryCobaltFallback(url, modeType) {
  try {
    const res = await axios.post("https://api.cobalt.tools/api/json", {
      url: url,
      downloadMode: modeType,
      videoQuality: "720",
      audioFormat: "mp3"
    }, {
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      timeout: 20000
    });
    if (res.data && res.data.url) return res.data.url;
  } catch {
    return null;
  }
  return null;
}

async function downloadYouTubeVideo(chatId, url, userId, username) {
  const wait = await bot.sendMessage(chatId, "⏳ កំពុងទាញយកវីដេអូ YouTube...");
  const filePrefix = Date.now().toString();
  const outputFile = path.join(DOWNLOAD_DIR, filePrefix + ".mp4");

  if (RAPIDAPI_KEY) {
    try {
      const videoId = extractYtId(url);
      if (!videoId) throw new Error("Invalid YouTube URL");
      const { data } = await axios.get("https://youtube-mp36.p.rapidapi.com/dl", {
        params: { id: videoId },
        headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "youtube-mp36.p.rapidapi.com" },
        timeout: 15000
      });
      if (data.status === "ok" && data.link) {
        await downloadStreamToFile(data.link, outputFile);
        await bot.sendVideo(chatId, outputFile, { caption: "✓ YouTube Video (RapidAPI)" });
        addHistory(userId, username, { platform: "youtube", format: "mp4", url, status: "ok" });
        try { fs.unlinkSync(outputFile); } catch {}
        bot.deleteMessage(chatId, wait.message_id).catch(() => {});
        return;
      }
    } catch {}
  }

  const cobaltUrl = await tryCobaltFallback(url, "video");
  if (cobaltUrl) {
    try {
      await downloadStreamToFile(cobaltUrl, outputFile);
      await bot.sendVideo(chatId, outputFile, { caption: "✓ YouTube Video (Cobalt Fallback)" });
      addHistory(userId, username, { platform: "youtube", format: "mp4", url, status: "ok" });
      try { fs.unlinkSync(outputFile); } catch {}
      bot.deleteMessage(chatId, wait.message_id).catch(() => {});
      return;
    } catch {}
  }

  const args = [
    "--ffmpeg-location", ffmpegPath,
    "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]",
    "--max-filesize", "49M",
    ...(HAS_COOKIES ? ["--cookies", COOKIES_PATH] : []),
    "-o", outputFile, url
  ];
  execFile(YTDLP_PATH, args, { timeout: 1000 * 60 * 5 }, async (err) => {
    if (err) {
      addHistory(userId, username, { platform: "youtube", format: "mp4", url, status: "fail" });
      await bot.sendMessage(chatId, "✘ ការទាញយកវីដេអូបរាជ័យ (ឯកសារអាចធំពេក ឬលីងមានបញ្ហា)។");
    } else {
      await bot.sendVideo(chatId, outputFile, { caption: "✓ YouTube Video (yt-dlp Local)" });
      addHistory(userId, username, { platform: "youtube", format: "mp4", url, status: "ok" });
    }
    try { fs.unlinkSync(outputFile); } catch {}
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  });
}

async function downloadYouTubeAudio(chatId, url, userId, username) {
  const wait = await bot.sendMessage(chatId, "⏳ កំពុងទាញយកសំឡេង YouTube...");
  const filePrefix = Date.now().toString();
  const outputFile = path.join(DOWNLOAD_DIR, filePrefix + ".mp3");

  if (RAPIDAPI_KEY) {
    try {
      const videoId = extractYtId(url);
      if (!videoId) throw new Error("Invalid YouTube URL");
      const { data } = await axios.get("https://youtube-mp36.p.rapidapi.com/dl", {
        params: { id: videoId },
        headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "youtube-mp36.p.rapidapi.com" },
        timeout: 15000
      });
      if (data.status === "ok" && data.link) {
        await downloadStreamToFile(data.link, outputFile);
        await bot.sendAudio(chatId, outputFile, { caption: "✓ YouTube Audio (RapidAPI)" });
        addHistory(userId, username, { platform: "youtube", format: "mp3", url, status: "ok" });
        try { fs.unlinkSync(outputFile); } catch {}
        bot.deleteMessage(chatId, wait.message_id).catch(() => {});
        return;
      }
    } catch {}
  }

  const cobaltUrl = await tryCobaltFallback(url, "audio");
  if (cobaltUrl) {
    try {
      await downloadStreamToFile(cobaltUrl, outputFile);
      await bot.sendAudio(chatId, outputFile, { caption: "✓ YouTube Audio (Cobalt Fallback)" });
      addHistory(userId, username, { platform: "youtube", format: "mp3", url, status: "ok" });
      try { fs.unlinkSync(outputFile); } catch {}
      bot.deleteMessage(chatId, wait.message_id).catch(() => {});
      return;
    } catch {}
  }

  const args = [
    "--ffmpeg-location", ffmpegPath,
    "-x", "--audio-format", "mp3",
    "--max-filesize", "49M",
    ...(HAS_COOKIES ? ["--cookies", COOKIES_PATH] : []),
    "-o", path.join(DOWNLOAD_DIR, filePrefix + ".%(ext)s"), url
  ];
  execFile(YTDLP_PATH, args, { timeout: 1000 * 60 * 5 }, async (err) => {
    if (err) {
      addHistory(userId, username, { platform: "youtube", format: "mp3", url, status: "fail" });
      await bot.sendMessage(chatId, "✘ ការទាញយកសំឡេងបរាជ័យ។");
    } else {
      if (fs.existsSync(outputFile)) {
        await bot.sendAudio(chatId, outputFile, { caption: "✓ YouTube Audio (yt-dlp Local)" });
        addHistory(userId, username, { platform: "youtube", format: "mp3", url, status: "ok" });
      }
    }
    try { fs.unlinkSync(outputFile); } catch {}
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  });
}

async function downloadYouTubeThumbnail(chatId, url, userId, username) {
  const wait = await bot.sendMessage(chatId, "⏳ កំពុងទាញយក Thumbnail...");
  const thumbArgs = [
    "--ffmpeg-location", ffmpegPath,
    "--get-thumbnail", "--no-playlist",
    ...(HAS_COOKIES ? ["--cookies", COOKIES_PATH] : []),
    url
  ];
  execFile(YTDLP_PATH, thumbArgs, { timeout: 30000 }, async (err, stdout) => {
    if (err) {
      addHistory(userId, username, { platform: "youtube", format: "thumbnail", url, status: "fail" });
      await bot.sendMessage(chatId, "✘ Thumbnail failed");
    } else {
      await bot.sendPhoto(chatId, stdout.trim(), { caption: "🖼 YouTube Thumbnail" });
      addHistory(userId, username, { platform: "youtube", format: "thumbnail", url, status: "ok" });
    }
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  });
}

/*
========================================
TIKTOK ENGINES
========================================
*/

async function downloadTikTokVideo(chatId, url, userId, username) {
  const wait = await bot.sendMessage(chatId, "⏳ Downloading TikTok...");
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);
    await bot.sendVideo(chatId, data.data.play, { caption: "✓ TikTok Video" });
    addHistory(userId, username, { platform: "tiktok", format: "mp4", url, status: "ok" });
  } catch (err) {
    addHistory(userId, username, { platform: "tiktok", format: "mp4", url, status: "fail" });
    bot.sendMessage(chatId, "✘ TikTok failed");
  }
  bot.deleteMessage(chatId, wait.message_id).catch(() => {});
}

async function downloadTikTokAudio(chatId, url, userId, username) {
  const wait = await bot.sendMessage(chatId, "⏳ Downloading audio...");
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);
    await bot.sendAudio(chatId, data.data.music, { caption: "✓ TikTok Audio" });
    addHistory(userId, username, { platform: "tiktok", format: "audio", url, status: "ok" });
  } catch (err) {
    addHistory(userId, username, { platform: "tiktok", format: "audio", url, status: "fail" });
    bot.sendMessage(chatId, "✘ Audio failed");
  }
  bot.deleteMessage(chatId, wait.message_id).catch(() => {});
}

async function downloadTikTokImage(chatId, url, userId, username) {
  const wait = await bot.sendMessage(chatId, "⏳ Fetching image...");
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);
    await bot.sendPhoto(chatId, data.data.cover, { caption: "✓ TikTok Image" });
    addHistory(userId, username, { platform: "tiktok", format: "image", url, status: "ok" });
  } catch (err) {
    addHistory(userId, username, { platform: "tiktok", format: "image", url, status: "fail" });
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
    await bot.sendPhoto(chatId, media, { caption: "✓ Pinterest Image" });
    addHistory(userId, username, { platform: "pinterest", format: "image", url, status: "ok" });
  } catch (err) {
    addHistory(userId, username, { platform: "pinterest", format: "image", url, status: "fail" });
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
  const wait = await bot.sendMessage(chatId, "⏳ Fetching Spotify track...");
  try {
    const api = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api);
    const trackTitle = data.title        || "Unknown Track";
    const artistName = data.author_name  || "";
    const thumbUrl   = data.thumbnail_url;

    await bot.sendPhoto(chatId, thumbUrl, {
      caption: `🎵 Spotify Track\n\n📌 ${trackTitle}\n👤 ${artistName}\n\n⏳ Searching audio on YouTube...`
    });
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});

    const searchQuery = `${trackTitle} ${artistName} official audio`;
    const filePrefix  = Date.now().toString();
    const wait2 = await bot.sendMessage(chatId, "⏳ Downloading audio...");
    let searchVideoId = null;

    try {
      const searchResp = await axios.get("https://youtube-search-and-download.p.rapidapi.com/search", {
        params: { query: searchQuery, type: "v", sort: "r" },
        headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "youtube-search-and-download.p.rapidapi.com" },
        timeout: 15000
      });
      const items = searchResp.data && searchResp.data.contents;
      if (items && items.length > 0) {
        searchVideoId = items[0].video && items[0].video.videoId;
      }
    } catch {}

    if (!searchVideoId) {
      addHistory(userId, username, { platform: "spotify", format: "audio", url, status: "fail" });
      await bot.sendMessage(chatId, `✘ Could not find audio for: *${trackTitle}*`, { parse_mode: "Markdown" });
      bot.deleteMessage(chatId, wait2.message_id).catch(() => {});
      return;
    }

    const dlResp = await axios.get("https://youtube-mp36.p.rapidapi.com/dl", {
      params: { id: searchVideoId },
      headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "youtube-mp36.p.rapidapi.com" },
      timeout: 30000
    });
    const dlData = dlResp.data;

    if (dlData.status !== "ok" || !dlData.link) {
      addHistory(userId, username, { platform: "spotify", format: "audio", url, status: "fail" });
      await bot.sendMessage(chatId, `✘ Could not download audio for: *${trackTitle}*`, { parse_mode: "Markdown" });
      bot.deleteMessage(chatId, wait2.message_id).catch(() => {});
      return;
    }

    const outputFile = path.join(DOWNLOAD_DIR, filePrefix + ".mp3");
    await downloadStreamToFile(dlData.link, outputFile);

    const stat = fs.statSync(outputFile);
    if (stat.size > 49 * 1024 * 1024) {
      addHistory(userId, username, { platform: "spotify", format: "audio", url, status: "fail" });
      await bot.sendMessage(chatId, "✘ Audio too large (>50MB)");
    } else {
      await bot.sendAudio(chatId, outputFile, {
        caption:   `🎵 ${trackTitle}\n👤 ${artistName}`,
        title:     trackTitle,
        performer: artistName
      });
      addHistory(userId, username, { platform: "spotify", format: "audio", url, status: "ok" });
    }
    try { fs.unlinkSync(outputFile); } catch {}
    bot.deleteMessage(chatId, wait2.message_id).catch(() => {});

  } catch (err) {
    addHistory(userId, username, { platform: "spotify", format: "audio", url, status: "fail" });
    bot.sendMessage(chatId, "✘ Spotify failed — invalid link?");
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  }
}

/*
========================================
START BOT ENGINE
========================================
*/

(async () => {
  const ok = await ensureYtDlp();
  if (!ok) {
    console.log("⚠️ yt-dlp check failed, but continuing startup...");
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
    console.log("✅ Bot polling started successfully");
  } catch (err) {
    console.log("startPolling error:", err.message || err);
  }
})();