// mi-paiai web UI templates.
export const APP_VERSION = '0.9.1';

import { PROVIDER_PRESETS, PROVIDER_GROUPS, DEFAULT_PROVIDER_ID } from './providers.js';

// Rendered into the provider dropdown so the list can grow without touching the markup.
const PROVIDER_OPTIONS_HTML = PROVIDER_GROUPS.map((group) =>
  '                <optgroup label="' + group + '">' +
  PROVIDER_PRESETS.filter((preset) => preset.group === group)
    .map((preset) => '<option value="' + preset.id + '">' + preset.label + '</option>')
    .join('') +
  '</optgroup>',
).join('');

const PROVIDER_LOOKUP_JSON = JSON.stringify(
  Object.fromEntries(
    PROVIDER_PRESETS.map((preset) => [
      preset.id,
      {
        label: preset.label,
        url: preset.baseURL,
        model: preset.model || "",
        placeholder: preset.keyHint || "输入 API Key",
        selfHosted: preset.selfHosted === true,
      },
    ]),
  ),
).replace(/</gu, '\\u003c');

export const LOGIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mi-paiai · 登录</title>
<style>
  :root { --accent: #0a84ff; --accent-2: #5ac8fa; --text: #1d1d1f; --dim: #6e7381; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: radial-gradient(900px 620px at 12% -8%, #d6ecff 0%, transparent 60%),
                radial-gradient(760px 560px at 100% 104%, #e6f1ff 0%, transparent 62%), #f5f7fb;
    color: var(--text);
  }
  .orb { position: fixed; border-radius: 50%; filter: blur(90px); opacity: .7; pointer-events: none; }
  .orb.a { width: 460px; height: 460px; background: #a8d8ff; top: -160px; left: -120px; }
  .orb.b { width: 380px; height: 380px; background: #cbe7ff; bottom: -140px; right: -80px; }
  .card {
    position: relative; width: 100%; max-width: 400px; padding: 40px 34px 32px; border-radius: 26px;
    background: rgba(255,255,255,.86); border: 1px solid rgba(10,132,255,.14);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    box-shadow: 0 26px 60px -28px rgba(12,52,110,.26), 0 2px 10px rgba(12,52,110,.05);
  }
  .mark { width: 66px; height: 66px; margin: 0 auto 20px; border-radius: 20px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--accent), var(--accent-2)); box-shadow: 0 14px 30px -12px rgba(10,132,255,.45); }
  .mark svg { width: 34px; height: 34px; fill: #fff; }
  h1 { font-size: 23px; font-weight: 650; text-align: center; letter-spacing: -.4px; }
  .sub { text-align: center; color: var(--dim); font-size: 13.5px; margin: 6px 0 28px; }
  .alert { display: none; margin-bottom: 18px; padding: 12px 14px; border-radius: 13px; font-size: 13px; background: rgba(255,59,48,.08); border: 1px solid rgba(255,59,48,.24); color: #c1121f; }
  .alert.show { display: block; animation: shake .4s ease; }
  @keyframes shake { 0%,100% { transform: translateX(0); } 30% { transform: translateX(-7px); } 70% { transform: translateX(7px); } }
  label { display: block; font-size: 12.5px; color: var(--dim); margin-bottom: 8px; }
  input { width: 100%; padding: 15px 16px; border-radius: 14px; font-size: 15px; color: var(--text); background: #fff; border: 1px solid rgba(0,0,0,.1); outline: none; transition: border-color .2s, box-shadow .2s, background .2s; }
  input::placeholder { color: #8a909b; }
  input:focus { border-color: #0a84ff; box-shadow: 0 0 0 4px rgba(10,132,255,.14); background: #fff; }
  .field { margin-bottom: 18px; }
  button { width: 100%; margin-top: 6px; padding: 16px; border: none; border-radius: 14px; cursor: pointer; font-size: 15.5px; font-weight: 600; color: #fff; letter-spacing: .4px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); box-shadow: 0 16px 34px -18px rgba(10,132,255,.8); transition: transform .18s, box-shadow .18s, opacity .18s; }
  button:hover { transform: translateY(-1px); }
  button:disabled { opacity: .6; cursor: not-allowed; transform: none; }
  .foot { text-align: center; margin-top: 22px; font-size: 12px; color: #6b7280; }
</style>
</head>
<body>
  <div class="orb a"></div><div class="orb b"></div>
  <div class="card">
    <div class="mark"><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm7 9a7 7 0 0 1-6 6.92V21h3v2H8v-2h3v-2.08A7 7 0 0 1 5 12h2a5 5 0 0 0 10 0h2z"/></svg></div>
    <h1>mi-paiai</h1>
    <p class="sub">小爱音箱 · 多账号多设备控制台</p>
    <div id="errorMsg" class="alert"></div>
    <form id="loginForm" onsubmit="handleLogin(event)">
      <div class="field"><label for="username">用户名</label><input type="text" id="username" placeholder="请输入用户名" required autocomplete="username" autofocus></div>
      <div class="field"><label for="password">密码</label><input type="password" id="password" placeholder="请输入密码" required autocomplete="current-password"></div>
      <button type="submit" id="loginBtn">登录控制台</button>
    </form>
    <p class="foot">仅限局域网访问 · 请勿暴露到公网</p>
  </div>
  <script>
    async function handleLogin(event) {
      event.preventDefault();
      var btn = document.getElementById('loginBtn');
      var box = document.getElementById('errorMsg');
      box.classList.remove('show');
      btn.disabled = true; btn.textContent = '登录中...';
      try {
        var res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value }) });
        var data = await res.json().catch(function () { return {}; });
        if (res.ok && data.success) { window.location.href = '/'; return; }
        box.textContent = data.error || '登录失败，请重试';
        box.classList.add('show');
      } catch (error) {
        box.textContent = '无法连接服务器';
        box.classList.add('show');
      }
      btn.disabled = false; btn.textContent = '登录控制台';
    }
  </script>
</body>
</html>`;

export const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mi-paiai · 控制台</title>
<style>
  :root {
    --bg: #f5f7fb; --panel: rgba(255,255,255,.9); --panel-2: rgba(10,132,255,.05); --sunken: rgba(10,30,60,.035);
    --border: rgba(12,52,110,.09); --border-2: rgba(12,52,110,.16);
    --text: #1d1d1f; --dim: #4b5563; --mute: #78808f;
    --accent: #0a84ff; --accent-2: #5ac8fa; --ok: #34c759; --warn: #ff9f0a; --err: #ff3b30;
    --radius: 18px; --radius-sm: 12px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh; padding: 18px; color: var(--text); -webkit-font-smoothing: antialiased;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: radial-gradient(1000px 640px at 6% -12%, #d9ecff 0%, transparent 58%),
                radial-gradient(900px 660px at 104% 108%, #e8f4ff 0%, transparent 60%), var(--bg);
  }
  a { color: var(--accent-2); }
  .shell { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: 236px minmax(0,1fr); gap: 18px; align-items: start; }

  /* ---------- sidebar ---------- */
  .sidebar {
    position: sticky; top: 18px; display: flex; flex-direction: column; gap: 14px; padding: 16px 13px;
    background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: 0 18px 44px -30px rgba(12,52,110,.35);
  }
  .brand { display: flex; align-items: center; gap: 11px; padding: 2px 6px 4px; }
  .brand-mark { width: 40px; height: 40px; flex: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--accent), var(--accent-2)); box-shadow: 0 12px 26px -12px rgba(124,92,255,1); }
  .brand-mark svg { width: 21px; height: 21px; fill: #fff; }
  .brand-title { font-size: 14.5px; font-weight: 650; letter-spacing: -.2px; display: flex; align-items: center; gap: 7px; }
  .brand-sub { font-size: 11px; color: #78808f; margin-top: 2px; }
  .ver { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 999px; color: #0a63c2; background: rgba(10,132,255,.12); border: 1px solid rgba(10,132,255,.3); }
  .nav-label { font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; color: #8a909b; padding: 6px 12px 0; }
  .nav { display: flex; flex-direction: column; gap: 3px; }
  .nav-item {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 12px; cursor: pointer;
    font-family: inherit; font-size: 13.5px; color: var(--dim); background: transparent; border: 1px solid transparent; text-align: left;
    transition: background .16s, color .16s, border-color .16s;
  }
  .nav-item svg { width: 16px; height: 16px; flex: none; fill: currentColor; opacity: .85; }
  .nav-item:hover { background: rgba(10,132,255,.08); color: var(--text); }
  .nav-item.active { background: linear-gradient(135deg, rgba(10,132,255,.15), rgba(90,200,250,.12)); border-color: rgba(10,132,255,.4); color: #0a63c2; font-weight: 600; }
  .nav-badge { margin-left: auto; font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: rgba(10,132,255,.14); color: #0a63c2; border: 1px solid rgba(10,132,255,.3); }
  .sidebar-foot { margin-top: auto; display: flex; flex-direction: column; gap: 8px; padding: 10px 6px 2px; border-top: 1px solid var(--border); }
  .sidebar-note { font-size: 11px; color: #78808f; line-height: 1.6; }

  /* ---------- main ---------- */
  .main { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
  .topbar {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 18px; border-radius: var(--radius);
    background: var(--panel); border: 1px solid var(--border); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  }
  .topbar-title { font-size: 16px; font-weight: 650; letter-spacing: -.2px; }
  .topbar-desc { font-size: 12px; color: var(--mute); margin-top: 3px; }
  .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .pane { display: none; flex-direction: column; gap: 18px; }
  .pane.active { display: flex; animation: fade .22s ease; }
  @keyframes fade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }

  .pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 13px; border-radius: 999px; font-size: 12.5px; font-weight: 550; border: 1px solid var(--border-2); background: var(--panel-2); color: var(--dim); white-space: nowrap; }
  .pill-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--mute); flex: none; }
  .pill.is-run { color: #0a7d3f; border-color: rgba(52,199,89,.45); background: rgba(52,199,89,.12); }
  .pill.is-run .pill-dot { background: var(--ok); box-shadow: 0 0 0 4px rgba(52,211,153,.18); animation: breathe 2s ease-in-out infinite; }
  .pill.is-err { color: #c1121f; border-color: rgba(255,59,48,.42); background: rgba(255,59,48,.1); }
  .pill.is-err .pill-dot { background: var(--err); }
  .pill.is-warn { color: #9a5b00; border-color: rgba(255,159,10,.45); background: rgba(255,159,10,.12); }
  .pill.is-warn .pill-dot { background: var(--warn); animation: breathe 1.4s ease-in-out infinite; }
  @keyframes breathe { 0%,100% { opacity: 1; } 50% { opacity: .45; } }

  .card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: 0 18px 44px -30px rgba(12,52,110,.35), 0 1px 3px rgba(12,52,110,.04); overflow: hidden; }
  .card-head { display: flex; align-items: center; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--border); background: rgba(10,132,255,.028); }
  .card-ico { width: 34px; height: 34px; flex: none; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: rgba(10,132,255,.1); border: 1px solid rgba(10,132,255,.24); }
  .card-ico svg { width: 17px; height: 17px; fill: #0a84ff; }
  .card-title { font-size: 14.5px; font-weight: 620; }
  .card-desc { font-size: 12px; color: #78808f; margin-top: 2px; }
  .card-head-right { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .card-body { padding: 18px; }
  .card-grid { display: grid; gap: 18px; grid-template-columns: repeat(2, minmax(0,1fr)); align-items: start; }
  @media (max-width: 1080px) { .card-grid { grid-template-columns: minmax(0,1fr); } }

  /* ---------- hero ---------- */
  .hero { background: linear-gradient(135deg, rgba(10,132,255,.1), rgba(90,200,250,.07) 45%, transparent 78%), var(--panel); }
  .hero-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  .hero-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .orb-status { width: 60px; height: 60px; flex: none; border-radius: 19px; display: flex; align-items: center; justify-content: center; background: rgba(10,132,255,.07); border: 1px solid var(--border-2); transition: all .3s; }
  .orb-status svg { width: 27px; height: 27px; fill: var(--dim); transition: fill .3s; }
  .orb-status.run { background: rgba(52,199,89,.12); border-color: rgba(52,199,89,.42); box-shadow: 0 0 28px -12px rgba(52,199,89,.7); }
  .orb-status.run svg { fill: var(--ok); }
  .orb-status.err { background: rgba(255,59,48,.1); border-color: rgba(255,59,48,.4); }
  .orb-status.err svg { fill: var(--err); }
  .orb-status.warn { background: rgba(255,159,10,.12); border-color: rgba(255,159,10,.42); }
  .orb-status.warn svg { fill: var(--warn); animation: breathe 1.6s ease-in-out infinite; }
  .hero-text { min-width: 0; flex: 1; }
  .hero-state { font-size: 19px; font-weight: 650; letter-spacing: -.3px; }
  .hero-sub { font-size: 12.5px; color: var(--dim); margin-top: 4px; word-break: break-word; }
  .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .hero-actions .btn { min-width: 104px; }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .chip-status { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 999px; font-size: 12px; background: var(--panel-2); border: 1px solid var(--border); color: var(--dim); }
  .chip-status .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mute); flex: none; }
  .chip-status.run { color: #0a7d3f; border-color: rgba(52,199,89,.4); background: rgba(52,199,89,.1); }
  .chip-status.run .dot { background: var(--ok); }
  .chip-status.err { color: #c1121f; border-color: rgba(255,59,48,.38); background: rgba(255,59,48,.1); }
  .chip-status.err .dot { background: var(--err); }
  .chip-status.start { color: #9a5b00; border-color: rgba(255,159,10,.4); background: rgba(255,159,10,.1); }
  .chip-status.start .dot { background: var(--warn); }

  .stat-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0,1fr)); }
  .stat { padding: 14px; border-radius: var(--radius-sm); background: var(--sunken); border: 1px solid var(--border); min-width: 0; }
  .stat-label { font-size: 11px; color: #78808f; letter-spacing: .04em; }
  .stat-value { margin-top: 6px; font-size: 14px; font-weight: 600; color: #1d1d1f; word-break: break-all; }

  /* ---------- forms ---------- */
  .grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0,1fr)); }
  .grid.one { grid-template-columns: minmax(0,1fr); }
  @media (max-width: 720px) { .grid { grid-template-columns: minmax(0,1fr); } }
  .field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
  .field > label { font-size: 12.5px; color: var(--dim); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .hint { font-size: 11.5px; color: #78808f; line-height: 1.55; }
  input[type="text"], input[type="password"], input[type="search"], select, textarea {
    width: 100%; padding: 12px 14px; color: var(--text); font-size: 13.5px; font-family: inherit;
    background: #fff; border: 1px solid var(--border-2); border-radius: var(--radius-sm); outline: none;
    transition: border-color .18s, box-shadow .18s, background .18s;
  }
  textarea { resize: vertical; min-height: 84px; line-height: 1.6; }
  input::placeholder, textarea::placeholder { color: rgba(238,241,255,.28); }
  input:focus, select:focus, textarea:focus { border-color: rgba(10,132,255,.75); background: #fff; box-shadow: 0 0 0 4px rgba(10,132,255,.13); }
  select { appearance: none; cursor: pointer; padding-right: 34px;
    background-image: linear-gradient(45deg, transparent 50%, rgba(238,241,255,.5) 50%), linear-gradient(135deg, rgba(238,241,255,.5) 50%, transparent 50%);
    background-position: calc(100% - 19px) 50%, calc(100% - 14px) 50%; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; }
  select option { background: #fff; color: var(--text); }

  .switch { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; font-size: 12.5px; color: var(--dim); }
  .switch input { position: absolute; opacity: 0; width: 0; height: 0; }
  .switch .track { width: 40px; height: 23px; border-radius: 999px; background: rgba(120,130,145,.28); border: 1px solid var(--border-2); position: relative; transition: background .2s, border-color .2s; flex: none; }
  .switch .track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%; background: #fff; opacity: .75; transition: transform .2s, opacity .2s; }
  .switch input:checked + .track { background: linear-gradient(135deg, var(--accent), var(--accent-2)); border-color: transparent; }
  .switch input:checked + .track::after { transform: translateX(17px); opacity: 1; }
  .switch input:focus-visible + .track { box-shadow: 0 0 0 4px rgba(124,92,255,.2); }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 16px; border: 1px solid transparent; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; color: var(--text); background: rgba(10,30,60,.05); transition: transform .15s, background .18s, border-color .18s, opacity .18s; white-space: nowrap; }
  .btn:hover:not(:disabled) { transform: translateY(-1px); background: rgba(10,132,255,.12); }
  .btn:disabled { opacity: .42; cursor: not-allowed; }
  .btn svg { width: 15px; height: 15px; fill: currentColor; }
  .btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; box-shadow: 0 14px 30px -18px rgba(10,132,255,.85); }
  .btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #8a6dff, #5bb0ff); }
  .btn-ok { background: linear-gradient(135deg, #34c759, #30d158); color: #fff; box-shadow: 0 12px 26px -16px rgba(52,199,89,.95); }
  .btn-ok:hover:not(:disabled) { background: linear-gradient(135deg, #2fb350, #28bd4e); }
  .btn-danger { background: rgba(255,59,48,.09); border-color: rgba(255,59,48,.32); color: #c1121f; }
  .btn-danger:hover:not(:disabled) { background: rgba(255,59,48,.16); }
  .btn-ghost { background: rgba(255,255,255,.75); border-color: var(--border-2); }
  .btn-sm { padding: 8px 12px; font-size: 12px; border-radius: 10px; }
  .btn-icon { padding: 8px 10px; border-radius: 10px; }

  .tag { font-size: 10.5px; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--border-2); color: #6b7280; background: rgba(10,30,60,.04); }
  .tag.saved { color: #0a7d3f; border-color: rgba(52,199,89,.4); background: rgba(52,199,89,.1); }

  /* ---------- model chips ---------- */
  .chips-wrap { max-height: 260px; overflow-y: auto; padding: 5px; border-radius: var(--radius-sm); background: var(--sunken); border: 1px solid var(--border); }
  .model-chip { display: inline-flex; align-items: center; gap: 7px; margin: 4px; padding: 7px 11px; border-radius: 999px; font-size: 11.5px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; background: #fff; border: 1px solid var(--border); color: var(--dim); cursor: pointer; transition: all .15s; }
  .model-chip:hover { border-color: rgba(10,132,255,.55); color: var(--text); transform: translateY(-1px); }
  .model-chip.active { background: linear-gradient(135deg, #0a84ff, #5ac8fa); border-color: transparent; color: #fff; box-shadow: 0 8px 18px -10px rgba(10,132,255,.9); }
  .empty { color: #78808f; font-size: 12.5px; padding: 14px; text-align: center; }
  .chip-index { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 10px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: rgba(10,132,255,.1); color: #0a63c2; flex: none; }
  .model-chip.active .chip-index { background: rgba(255,255,255,.3); color: #fff; }
  .model-chip.picked { border-color: rgba(10,132,255,.75); background: rgba(10,132,255,.09); color: #0a63c2; }
  .model-chip.picked .chip-index { background: #0a84ff; color: #fff; }
  .select-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; padding: 10px 12px; border-radius: var(--radius-sm); background: rgba(10,132,255,.07); border: 1px dashed rgba(10,132,255,.42); }
  .select-bar .grow { flex: 1; min-width: 180px; font-size: 12.5px; color: var(--dim); }
  .order-list { margin-top: 9px; display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; padding: 7px; border-radius: var(--radius-sm); background: var(--sunken); border: 1px solid var(--border); }
  .order-row { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 10px; background: #fff; border: 1px solid var(--border); font-size: 12px; }
  .order-num { width: 23px; height: 23px; flex: none; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #0a84ff, #5ac8fa); }
  .order-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, Menlo, Consolas, monospace; color: var(--text); }
  .order-btn { width: 25px; height: 25px; flex: none; border-radius: 8px; border: 1px solid var(--border-2); background: #fff; color: var(--dim); cursor: pointer; font-size: 11px; line-height: 1; font-family: inherit; }
  .order-btn:hover:not(:disabled) { background: rgba(10,132,255,.1); color: #0a63c2; border-color: rgba(10,132,255,.4); }
  .order-btn:disabled { opacity: .3; cursor: not-allowed; }
  .scroll::-webkit-scrollbar, .chips-wrap::-webkit-scrollbar, .log-list::-webkit-scrollbar { width: 7px; }
  .scroll::-webkit-scrollbar-thumb, .chips-wrap::-webkit-scrollbar-thumb, .log-list::-webkit-scrollbar-thumb { background: rgba(12,52,110,.2); border-radius: 4px; }
  details > summary { cursor: pointer; font-size: 12.5px; color: var(--dim); }
  details > summary:hover { color: var(--text); }

  /* ---------- speaker cards ---------- */
  .speaker { border: 1px solid var(--border); border-radius: var(--radius-sm); background: #fff; padding: 14px; }
  .speaker + .speaker { margin-top: 12px; }
  .speaker:hover { border-color: var(--border-2); }
  .speaker.off { opacity: .64; }
  .speaker-head { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; }
  .speaker-avatar { width: 34px; height: 34px; flex: none; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #0a84ff, #5ac8fa); border: none; }
  .speaker-name { font-size: 13.5px; font-weight: 620; }
  .speaker-meta { font-size: 11.5px; color: #78808f; margin-top: 2px; }
  .speaker-head-right { margin-left: auto; display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .speaker-body { margin-top: 14px; display: flex; flex-direction: column; gap: 13px; }
  .advanced { display: none; flex-direction: column; gap: 13px; padding-top: 13px; border-top: 1px dashed var(--border); }
  .advanced.open { display: flex; }

  /* ---------- logs ---------- */
  .log-list { min-height: 340px; max-height: calc(100vh - 300px); overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .log-item { padding: 10px 12px; border-radius: 11px; background: #fff; border: 1px solid var(--border); border-left: 3px solid var(--mute); }
  .log-item.user { border-left-color: #fbbf24; }
  .log-item.ai { border-left-color: var(--ok); }
  .log-item.system { border-left-color: var(--accent-2); }
  .log-time { font-size: 10.5px; color: #78808f; margin-bottom: 4px; font-family: ui-monospace, Menlo, Consolas, monospace; }
  .log-text { font-size: 12.5px; line-height: 1.6; color: #3c4149; word-break: break-word; white-space: pre-wrap; }
  .log-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .log-tab { padding: 6px 11px; border-radius: 999px; font-size: 11.5px; cursor: pointer; color: var(--mute); background: transparent; border: 1px solid var(--border); font-family: inherit; }
  .log-tab.active { color: #0a63c2; background: rgba(10,132,255,.11); border-color: rgba(10,132,255,.4); }
  .log-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border-bottom: 1px solid var(--border); }
  .log-preview { display: flex; flex-direction: column; gap: 8px; }
  .log-preview .log-item { padding: 9px 11px; }
  .log-text strong { color: #111827; font-weight: 700; }
  .log-text code { padding: 1px 5px; border-radius: 5px; background: rgba(10,132,255,.09); color: #075fae; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .92em; }
  .latest-btn { display: none; position: sticky; bottom: 12px; align-self: center; z-index: 4; margin: 0 auto 12px; box-shadow: 0 10px 24px -12px rgba(10,132,255,.65); }
  .latest-btn.show { display: inline-flex; }
  .log-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-top: 1px solid var(--border); font-size: 11.5px; color: #78808f; }
  .save-state { font-size: 11.5px; color: #78808f; white-space: nowrap; }
  .save-state.dirty { color: #9a5b00; font-weight: 600; }
  .log-speaker { display: inline-block; margin-bottom: 5px; padding: 1px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 600; color: #0a63c2; background: rgba(10,132,255,.1); border: 1px solid rgba(10,132,255,.26); }
  .filter-select { width: auto; min-width: 118px; padding: 6px 30px 6px 11px; font-size: 12px; border-radius: 999px; }

  /* ---------- modal + toast ---------- */
  .modal-overlay { position: fixed; inset: 0; z-index: 90; display: none; align-items: center; justify-content: center; background: rgba(12,32,64,.35); backdrop-filter: blur(6px); padding: 20px; }
  .modal-overlay.show { display: flex; }
  .modal { width: 100%; max-width: 520px; max-height: 86vh; overflow-y: auto; padding: 24px; background: #fff; border: 1px solid var(--border-2); border-radius: 20px; box-shadow: 0 40px 80px -40px rgba(12,52,110,.45); }
  .modal h3 { font-size: 16px; margin-bottom: 14px; }
  .modal p, .modal li { font-size: 12.8px; color: var(--dim); line-height: 1.75; }
  .modal ol { padding-left: 18px; margin: 10px 0 14px; }
  .modal code { background: rgba(10,132,255,.1); padding: 2px 6px; border-radius: 6px; font-size: 11.5px; }
  .modal .warn { color: #c1121f; font-size: 12px; margin-bottom: 16px; }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .toasts { position: fixed; right: 18px; bottom: 18px; z-index: 120; display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
  .toast { padding: 12px 16px; border-radius: 13px; font-size: 13px; font-weight: 550; color: var(--text); background: #fff; border: 1px solid var(--border-2); box-shadow: 0 20px 44px -24px rgba(12,52,110,.35); opacity: 0; transform: translateY(8px); transition: opacity .22s, transform .22s; max-width: 340px; }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.success { border-color: rgba(52,211,153,.5); }
  .toast.error { border-color: rgba(251,113,133,.55); }
  .toast.info { border-color: rgba(124,92,255,.55); }

  /* ---------- responsive ---------- */
  @media (max-width: 1020px) {
    .shell { grid-template-columns: minmax(0,1fr); }
    .sidebar { position: static; }
    .nav { flex-direction: row; overflow-x: auto; padding-bottom: 4px; }
    .nav-item { width: auto; white-space: nowrap; }
    .nav-label, .sidebar-foot { display: none; }
    .topbar-right { width: 100%; margin-left: 0; }
  }
</style>
</head>
<body>
<div class="shell">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark"><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm7 9a7 7 0 0 1-6 6.92V21h3v2H8v-2h3v-2.08A7 7 0 0 1 5 12h2a5 5 0 0 0 10 0h2z"/></svg></div>
      <div>
        <div class="brand-title">mi-paiai <span class="ver" id="versionTag">v${APP_VERSION}</span></div>
        <div class="brand-sub">小爱音箱控制台</div>
      </div>
    </div>
    <div class="nav-label">控制台</div>
    <nav class="nav" id="nav">
      <button class="nav-item active" data-section="overview" onclick="showSection('overview')">
        <svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>概览
      </button>
      <button class="nav-item" data-section="speakers" onclick="showSection('speakers')">
        <svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm7 9a7 7 0 0 1-6 6.92V21h3v2H8v-2h3v-2.08A7 7 0 0 1 5 12h2a5 5 0 0 0 10 0h2z"/></svg>音箱管理
        <span class="nav-badge" id="navSpeakerCount">0</span>
      </button>
      <button class="nav-item" data-section="ai" onclick="showSection('ai')">
        <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>AI 服务
      </button>
      <div class="nav-label">设置</div>
      <button class="nav-item" data-section="chat" onclick="showSection('chat')">
        <svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM7 9h10v2H7V9zm0-4h10v2H7V5zm0 8h7v2H7v-2z"/></svg>对话行为
      </button>
      <button class="nav-item" data-section="tts" onclick="showSection('tts')">
        <svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a6.8 6.8 0 0 1 0 13.4v2.1a8.9 8.9 0 0 0 0-17.6z"/></svg>语音合成
      </button>
      <button class="nav-item" data-section="logs" onclick="showSection('logs')">
        <svg viewBox="0 0 24 24"><path d="M4 4h16v2H4V4zm0 5h16v2H4V9zm0 5h10v2H4v-2zm0 5h10v2H4v-2z"/></svg>实时日志
      </button>
    </nav>
    <div class="sidebar-foot">
      <div class="pill" id="statusPill"><span class="pill-dot"></span><span id="statusPillText">读取中</span></div>
      <div class="sidebar-note">每个音箱独立账号与上下文，互不干扰。</div>
      <button class="btn btn-ghost btn-sm" onclick="logout()">退出登录</button>
    </div>
  </aside>

  <main class="main">
    <div class="topbar">
      <div>
        <div class="topbar-title" id="pageTitle">概览</div>
        <div class="topbar-desc" id="pageDesc">服务状态与全部音箱运行情况</div>
      </div>
      <div class="topbar-right">
        <button class="btn btn-ok" id="btnStart" onclick="start()">启动服务</button>
        <button class="btn btn-danger" id="btnStop" onclick="stop()" disabled>停止服务</button>
        <span class="save-state" id="saveState">已保存 · 保存后即时生效</span>
        <button class="btn btn-primary" id="btnSave" onclick="saveConfig()">保存配置</button>
      </div>
    </div>

    <section class="pane active" id="pane-overview">
      <div class="card hero">
        <div class="hero-body">
          <div class="hero-row">
            <div class="orb-status" id="heroOrb"><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm7 9a7 7 0 0 1-6 6.92V21h3v2H8v-2h3v-2.08A7 7 0 0 1 5 12h2a5 5 0 0 0 10 0h2z"/></svg></div>
            <div class="hero-text">
              <div class="hero-state" id="heroState">正在读取状态</div>
              <div class="hero-sub" id="heroSub">首次加载可能需要几秒</div>
            </div>
            <div class="hero-actions">
              <button class="btn btn-ghost" onclick="showSection('speakers')">管理音箱</button>
              <button class="btn btn-ghost" onclick="showSection('logs')">查看日志</button>
            </div>
          </div>
          <div class="chips" id="speakerChips"><span class="empty">暂无音箱</span></div>
        </div>
      </div>
      <div class="card-grid">
        <div class="card">
          <div class="card-head">
            <div class="card-ico"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div>
            <div><div class="card-title">配置摘要</div><div class="card-desc">当前生效的核心设置</div></div>
          </div>
          <div class="card-body">
            <div class="stat-grid">
              <div class="stat"><div class="stat-label">AI 厂商</div><div class="stat-value" id="summaryProvider">-</div></div>
              <div class="stat"><div class="stat-label">默认模型</div><div class="stat-value" id="summaryModel">-</div></div>
              <div class="stat"><div class="stat-label">音箱数量</div><div class="stat-value" id="summarySpeakers">-</div></div>
              <div class="stat"><div class="stat-label">可选模型</div><div class="stat-value" id="summaryModels">-</div></div>
              <div class="stat" style="grid-column:1/-1;"><div class="stat-label">API Base URL</div><div class="stat-value" id="summaryBaseURL">-</div></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="card-ico"><svg viewBox="0 0 24 24"><path d="M4 4h16v2H4V4zm0 5h16v2H4V9zm0 5h10v2H4v-2zm0 5h10v2H4v-2z"/></svg></div>
            <div><div class="card-title">最近日志</div><div class="card-desc">最新 5 条对话或系统事件</div></div>
            <div class="card-head-right"><button class="btn btn-ghost btn-sm" onclick="showSection('logs')">全部日志</button></div>
          </div>
          <div class="card-body"><div class="log-preview" id="dashLogs"><div class="empty">等待对话...</div></div></div>
        </div>
      </div>
    </section>

    <section class="pane" id="pane-speakers">
      <div class="card">
        <div class="card-head">
          <div class="card-ico"><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm7 9a7 7 0 0 1-6 6.92V21h3v2H8v-2h3v-2.08A7 7 0 0 1 5 12h2a5 5 0 0 0 10 0h2z"/></svg></div>
          <div>
            <div class="card-title">音箱列表</div>
            <div class="card-desc">每个音箱各自登录小米账号，独立对话历史、模型与思考等级</div>
          </div>
          <div class="card-head-right"><button class="btn btn-primary btn-sm" onclick="addSpeaker()">+ 添加音箱</button></div>
        </div>
        <div class="card-body">
          <div id="speakerList"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="card-ico"><svg viewBox="0 0 24 24"><path d="M11 7h2v6h-2V7zm0 8h2v2h-2v-2zm1-13a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg></div>
          <div><div class="card-title">多音箱隔离说明</div><div class="card-desc">为什么两个音箱不会串对话</div></div>
        </div>
        <div class="card-body">
          <div class="grid">
            <div class="field"><label>独立进程</label><div class="hint">每个音箱由单独的子进程运行，崩溃互不影响。</div></div>
            <div class="field"><label>独立上下文</label><div class="hint">对话历史、登录令牌缓存分别存放，不会互相读取。</div></div>
            <div class="field"><label>独立模型</label><div class="hint">每个音箱可单独设置模型与思考等级，语音切换只影响它自己。</div></div>
            <div class="field"><label>独立账号</label><div class="hint">不同音箱请使用各自的小米账号与 PassToken，避免设备识别串号。</div></div>
          </div>
        </div>
      </div>
    </section>

    <section class="pane" id="pane-ai">
      <div class="card">
        <div class="card-head">
          <div class="card-ico"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div>
          <div><div class="card-title">接口配置</div><div class="card-desc">默认使用你的 Sub2API，也可切换到任意 OpenAI 兼容服务</div></div>
          <div class="card-head-right"><button class="btn btn-ghost btn-sm" id="btnFetchModels" onclick="fetchModels()">从上游获取模型</button></div>
        </div>
        <div class="card-body">
          <div class="grid">
            <div class="field">
              <label>AI 厂商</label>
              <select id="aiProvider" onchange="onAiProviderChange()">
${PROVIDER_OPTIONS_HTML}
              </select>
              <div class="hint" id="aiProviderHint"></div>
            </div>
            <div class="field">
              <label>API Base URL</label>
              <input type="text" id="baseURL" spellcheck="false" placeholder="https://api.example.com/v1">
            </div>
          </div>
          <div class="grid" style="margin-top:14px;">
            <div class="field">
              <label>API Key <span class="tag" id="apiKeyTag" style="display:none;">已保存</span></label>
              <input type="password" id="apiKey" spellcheck="false" placeholder="输入 API Key">
              <div class="hint">留空表示继续使用已保存的密钥</div>
            </div>
            <div class="field">
              <label>默认模型</label>
              <input type="text" id="model" spellcheck="false" list="modelCatalog" placeholder="gpt-5.6-luna">
              <datalist id="modelCatalog"></datalist>
              <div class="hint">新增音箱时默认继承该模型</div>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="card-ico"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 17h-2v-2h2v2zm2.1-7.8-.9.9c-.7.7-1.2 1.2-1.2 2.4h-2c0-1.7.5-2.6 1.7-3.8l1.1-1.1c.4-.4.6-.9.6-1.5a2.4 2.4 0 0 0-4.8 0h-2a4.4 4.4 0 0 1 8.8 0c0 1.2-.5 2.3-1.3 3.1z"/></svg></div>
          <div><div class="card-title">联网搜索</div><div class="card-desc">模型先判断是否需要实时信息，再调用 Tavily 搜索</div></div>
        </div>
        <div class="card-body">
          <div class="grid">
            <div class="field" style="justify-content:center;">
              <label class="switch"><input type="checkbox" id="webSearchEnabled"><span class="track"></span>启用联网搜索</label>
              <div class="hint">默认关闭；启用后每次问题会先增加一次 true / false 判断请求。</div>
            </div>
            <div class="field">
              <label>Tavily API Key <span class="tag" id="webSearchKeyTag" style="display:none;">已保存</span></label>
              <input type="password" id="webSearchApiKey" spellcheck="false" placeholder="tvly-...">
              <div class="hint">每月免费额度为 1,000 credits；当前使用 basic 搜索，每次实际搜索约 1 credit。</div>
            </div>
          </div>
          <div class="grid" style="margin-top:14px;">
            <div class="field"><label>每次最多来源</label><input type="number" id="webSearchMaxResults" min="1" max="10" step="1"><div class="hint">建议 3～5 条，减少延迟和上下文长度。</div></div>
            <div class="field"><label>搜索缓存（秒）</label><input type="number" id="webSearchCacheTtl" min="0" max="3600" step="60"><div class="hint">相同问题在缓存期内不会重复消耗 Tavily 额度。</div></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="card-ico"><svg viewBox="0 0 24 24"><path d="M4 4h16v2H4V4zm0 5h16v2H4V9zm0 5h10v2H4v-2zm0 5h10v2H4v-2z"/></svg></div>
          <div><div class="card-title">模型目录</div><div class="card-desc">点击任意模型即可设为默认模型；语音指令按序号或 ID 切换</div></div>
        </div>
        <div class="card-body">
          <div class="field">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <span style="font-size:12.5px;color:var(--dim);">模型目录</span>
              <span class="tag" id="modelCount">0 个</span>
              <label class="switch" style="margin-left:auto;"><input type="checkbox" id="modelMultiMode" onchange="renderModelChips()"><span class="track"></span>多选排序</label>
            </div>
            <input type="search" id="modelFilter" placeholder="搜索模型..." oninput="renderModelChips()">
            <div class="chips-wrap scroll" id="modelChips" style="margin-top:9px;"><div class="empty">尚未获取模型，点击右上角「从上游获取模型」</div></div>
            <div class="hint">单击模型 = 设为当前模型；按住 Ctrl / ⌘ 单击，或在手机上开启“多选排序”后点选。左边数字就是语音序号。</div>
          </div>
          <div class="select-bar" id="selectBar" style="display:none;">
            <span class="grow" id="selectSummary"></span>
            <button type="button" class="btn btn-primary btn-sm" onclick="applySelectionOrder()">按选择顺序置顶</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="clearModelSelection()">清除选择</button>
          </div>
          <div style="margin-top:16px;">
            <label style="font-size:12.5px;color:var(--dim);">语音切换顺序（前 20 个可直接说序号）</label>
            <div class="order-list scroll" id="modelOrder"></div>
            <div class="hint" style="margin-top:8px;">语音指令：换模型 2 ／ 切换到第 3 个模型 ／ 切换模型 模型名字或 ID ／ 当前模型 ／ 有哪些模型</div>
          </div>
          <details style="margin-top:14px;">
            <summary>高级：手动编辑模型列表（每行一个）</summary>
            <textarea id="modelOptions" spellcheck="false" style="margin-top:10px;" placeholder="gpt-5.6-luna&#10;deepseek-v4-flash"></textarea>
          </details>
        </div>
      </div>
    </section>

    <section class="pane" id="pane-chat">
      <div class="card">
        <div class="card-head">
          <div class="card-ico"><svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg></div>
          <div><div class="card-title">人设与唤醒</div><div class="card-desc">所有音箱共用，但对话历史各自独立</div></div>
        </div>
        <div class="card-body">
          <div class="grid one">
            <div class="field">
              <label>系统提示词（人设）</label>
              <textarea id="systemPrompt" placeholder="你是一个智能助手小爱同学。"></textarea>
            </div>
            <div class="field">
              <label>唤醒关键词（每行一个，最多 20 个）</label>
              <textarea id="callAIKeywords" style="min-height:74px;" placeholder="请&#10;你"></textarea>
              <div class="hint">说话内容包含任一关键词才会请求 AI；语音控制指令不需要关键词。</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="pane" id="pane-tts">
      <div class="card">
        <div class="card-head">
          <div class="card-ico"><svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a6.8 6.8 0 0 1 0 13.4v2.1a8.9 8.9 0 0 0 0-17.6z"/></svg></div>
          <div><div class="card-title">语音合成（TTS）</div><div class="card-desc">解决部分小爱音箱不朗读回复的问题</div></div>
        </div>
        <div class="card-body">
          <div class="grid">
            <div class="field">
              <label>TTS 服务</label>
              <select id="ttsProvider" onchange="onTtsProviderChange()">
                <option value="">不使用</option>
                <option value="volcano">火山引擎（豆包）</option>
              </select>
              <div class="hint">默认关闭；需要时再填写密钥</div>
            </div>
            <div class="field" style="justify-content:center;">
              <label class="switch"><input type="checkbox" id="ttsCommandEnabled"><span class="track"></span>启用 TTS Command</label>
              <div class="hint">L05C（Play）请同时配置唤醒 5,1 和播报 5,3。</div>
            </div>
          </div>
          <div class="grid" style="margin-top:14px;">
            <div class="field"><label>唤醒 Command 服务</label><input type="number" id="wakeUpCommandService" min="0" max="10000" step="1" value="5"><div class="hint">L05C：5</div></div>
            <div class="field"><label>唤醒 Command 动作</label><input type="number" id="wakeUpCommandAction" min="0" max="10000" step="1" value="1"><div class="hint">L05C：1</div></div>
          </div>
          <div class="grid" style="margin-top:14px;">
            <div class="field"><label>播报 Command 服务</label><input type="number" id="ttsCommandService" min="0" max="10000" step="1" value="5"><div class="hint">L05C：5</div></div>
            <div class="field"><label>播报 Command 动作</label><input type="number" id="ttsCommandAction" min="0" max="10000" step="1" value="3"><div class="hint">L05C：3</div></div>
          </div>
          <div id="ttsVolcanoConfig" style="display:none;margin-top:16px;">
            <div class="grid">
              <div class="field">
                <label>API Key <span class="tag" id="ttsVolcanoKeyTag" style="display:none;">已保存</span></label>
                <input type="text" id="ttsVolcanoApiKey" spellcheck="false" placeholder="新版控制台 API Key">
                <div class="hint">控制台 → 语音合成 → 服务接口认证信息，复制 API Key（推荐）</div>
              </div>
              <div class="field">
                <label>默认音色</label>
                <input type="text" id="ttsDefaultSpeaker" list="ttsSpeakerList" spellcheck="false" placeholder="BV001">
                <datalist id="ttsSpeakerList"></datalist>
                <div class="hint">从控制台复制「音色 ID」，例如 BV001；也可直接手填</div>
              </div>
            </div>
            <details style="margin-top:14px;">
              <summary>旧版控制台：App ID + Access Token</summary>
              <div class="grid" style="margin-top:12px;">
              <div class="field"><label>App ID</label><input type="text" id="ttsVolcanoAppId" spellcheck="false" placeholder="火山引擎 AppId"></div>
              <div class="field"><label>Access Token <span class="tag" id="ttsTokenTag" style="display:none;">已保存</span></label><input type="password" id="ttsVolcanoAccessToken" spellcheck="false" placeholder="火山引擎 AccessToken"></div>
            </div>
            </details>
            <div class="grid" style="margin-top:14px;">
              <div class="field"><label>对外地址</label><input type="text" id="publicURL" spellcheck="false" placeholder="http://NAS_IP:36592"><div class="hint">必须能被小爱音箱访问到</div></div>
              <div class="field"><label>集群 Cluster</label><input type="text" id="ttsVolcanoCluster" spellcheck="false" placeholder="volcano_tts"><div class="hint">默认 volcano_tts，一般不用改</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="pane" id="pane-logs">
      <div class="card">
        <div class="log-toolbar">
          <div class="log-tabs">
            <select class="filter-select" id="logSpeakerFilter" onchange="lastLogKey=String.fromCharCode(0);loadLogs(true)"><option value="">全部音箱</option></select>
            <button class="log-tab active" data-filter="all" onclick="setLogFilter(this)">全部</button>
            <button class="log-tab" data-filter="conversation" onclick="setLogFilter(this)">对话</button>
            <button class="log-tab" data-filter="system" onclick="setLogFilter(this)">系统</button>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <label class="switch"><input type="checkbox" id="autoScroll" checked onchange="onAutoScrollChange()"><span class="track"></span>跟随最新</label>
            <button class="btn btn-ghost btn-sm" onclick="refreshLogs()">立即刷新</button>
          </div>
        </div>
        <div class="log-list" id="logList"><div class="empty">等待对话...</div></div>
        <div class="log-footer"><span id="logCount">0 条</span><span id="logFollowHint">正在跟随最新</span></div>
        <button type="button" class="btn btn-primary btn-sm latest-btn" id="goLatest" onclick="goToLatest()">↓ 回到最新</button>
      </div>
    </section>
  </main>
</div>

<div id="modalOverlay" class="modal-overlay" onclick="closeModal(event)">
  <div class="modal" onclick="event.stopPropagation()">
    <h3>获取小米账号凭证</h3>
    <ol>
      <li>点击下方「打开小米登录页」按钮</li>
      <li>使用该音箱对应的小米账号登录（已登录可跳过）</li>
      <li>登录成功后<b>不要点退出</b>，直接关闭标签页</li>
      <li>在本页按 <b>F12</b> 打开开发者工具，切到 <b>Application</b></li>
      <li>左侧 Cookies → <b>https://account.mi.com</b></li>
      <li>复制 <code>userId</code> 和 <code>pass_token</code> 的值</li>
    </ol>
    <p class="warn">复制完成后立即关闭小米登录页面，退出登录会导致 token 失效。</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">关闭</button>
      <button class="btn btn-primary" onclick="openMiLogin()">打开小米登录页</button>
    </div>
  </div>
</div>
<div class="toasts" id="toasts"></div>
<script>
    var models = [];
    var modelSelection = [];
    var secrets = { speakers: {} };
    var logFilter = 'all';
    var lastLogKey = '';
    var dirty = false;
    var autoScrollInitialized = false;
    function updateDirtyIndicator() {
      var state = q('saveState');
      if (!state) return;
      state.textContent = dirty ? '有未保存修改' : '已保存 · 保存后即时生效';
      state.classList.toggle('dirty', dirty);
    }
    function markDirty() { dirty = true; updateDirtyIndicator(); }
    function markSaved() { dirty = false; updateDirtyIndicator(); }
    var sections = {
      overview: ['概览', '服务状态与全部音箱运行情况'],
      speakers: ['音箱管理', '多账号、多设备，各自独立上下文'],
      ai: ['AI 服务', '接口地址、密钥与可用模型目录'],
      chat: ['对话行为', '人设提示词与唤醒关键词'],
      tts: ['语音合成', 'TTS 服务与音色设置'],
      logs: ['实时日志', '对话记录与系统事件']
    };

    function q(id) { return document.getElementById(id); }
    function esc(value) {
      return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function levelLabel(level) {
      return { default: '默认', minimal: '最低', low: '低', medium: '中', high: '高' }[level] || '默认';
    }
    function showSection(name) {
      if (!sections[name]) name = 'overview';
      document.querySelectorAll('.pane').forEach(function (pane) { pane.classList.toggle('active', pane.id === 'pane-' + name); });
      document.querySelectorAll('.nav-item').forEach(function (item) { item.classList.toggle('active', item.dataset.section === name); });
      q('pageTitle').textContent = sections[name][0];
      q('pageDesc').textContent = sections[name][1];
      try { localStorage.setItem('mi-paiai.section', name); } catch (error) { /* ignore */ }
      if (name === 'logs') loadLogs(true);
    }
    function restoreSection() {
      var saved = 'overview';
      try { saved = localStorage.getItem('mi-paiai.section') || 'overview'; } catch (error) { /* ignore */ }
      showSection(saved);
    }
    function showToast(message, type) {
      var wrap = q('toasts');
      var el = document.createElement('div');
      el.className = 'toast ' + (type || 'info');
      el.textContent = message;
      wrap.appendChild(el);
      requestAnimationFrame(function () { el.classList.add('show'); });
      setTimeout(function () {
        el.classList.remove('show');
        setTimeout(function () { el.remove(); }, 260);
      }, 3200);
    }
    async function apiFetch(url, options) {
      var response = await fetch(url, Object.assign({ credentials: 'same-origin' }, options || {}));
      if (response.status === 401) { window.location.href = '/'; throw new Error('登录已过期'); }
      return response;
    }
    async function readError(response, fallback) {
      try { var data = await response.json(); return data.error || fallback; } catch (error) { return fallback; }
    }

    var aiProviders = ${PROVIDER_LOOKUP_JSON};
    var defaultProviderId = '${DEFAULT_PROVIDER_ID}';
    function onAiProviderChange() {
      var provider = q('aiProvider').value;
      var info = aiProviders[provider] || { label: provider, url: '', model: '', placeholder: '输入 API Key', selfHosted: true };
      var previous = q('baseURL').dataset.autoUrl || '';
      // Keep a hand-edited address unless the field still holds a preset address.
      if (!q('baseURL').value.trim() || q('baseURL').value.trim() === previous) {
        q('baseURL').value = info.url || '';
        q('baseURL').dataset.autoUrl = info.url || '';
      }
      if (info.model && !q('model').value.trim()) q('model').value = info.model;
      q('apiKey').placeholder = info.placeholder;
      q('aiProviderHint').textContent = provider === defaultProviderId
        ? '默认使用你的 Sub2API，可一键拉取上游模型列表。'
        : (info.selfHosted
          ? '自建 / 本地服务：请填写你自己的访问地址（需以 /v1 结尾）。'
          : '已填入官方地址，可直接一键拉取模型列表。');
      updateSummary();
      markDirty();
    }
    function updateModelCatalog(list) {
      var catalog = q('modelCatalog');
      catalog.replaceChildren();
      list.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item;
        catalog.appendChild(option);
      });
    }
    function readModelOptions() {
      return q('modelOptions').value.split(/\\r?\\n/).map(function (item) { return item.trim(); }).filter(Boolean);
    }
    function currentModels() {
      var merged = models.concat(readModelOptions());
      var def = q('model').value.trim();
      if (def) merged.push(def);
      var seen = {};
      var out = [];
      merged.forEach(function (item) {
        if (!item || seen[item]) return;
        seen[item] = true;
        out.push(item);
      });
      return out.slice(0, 100);
    }
    function renderModelChips() {
      var container = q('modelChips');
      var keyword = (q('modelFilter').value || '').trim().toLowerCase();
      var all = currentModels();
      var list = all.map(function (item, index) { return { name: item, index: index + 1 }; })
        .filter(function (entry) { return !keyword || entry.name.toLowerCase().indexOf(keyword) >= 0; });
      q('modelCount').textContent = all.length + ' 个';
      container.replaceChildren();
      if (!list.length) {
        var empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = all.length ? '没有匹配的模型' : '尚未获取模型，点击右上角「从上游获取模型」';
        container.appendChild(empty);
        renderModelOrder();
        updateSelectionBar();
        return;
      }
      var active = q('model').value.trim();
      list.forEach(function (entry) {
        var item = entry.name;
        var picked = modelSelection.indexOf(item) >= 0;
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'model-chip' + (item === active ? ' active' : '') + (picked ? ' picked' : '');
        var badge = document.createElement('span');
        badge.className = 'chip-index';
        badge.textContent = String(entry.index);
        chip.appendChild(badge);
        chip.appendChild(document.createTextNode(item));
        chip.title = picked
          ? '已选中第 ' + (modelSelection.indexOf(item) + 1) + ' 个，再次 Ctrl+单击可取消'
          : '单击 = 设为当前模型；Ctrl+单击 = 加入排序';
        chip.onclick = function (event) {
          if (event.ctrlKey || event.metaKey || q('modelMultiMode').checked) {
            event.preventDefault();
            toggleModelSelection(item);
            return;
          }
          q('model').value = item;
          renderModelChips();
          updateSummary();
          markDirty();
          showToast('当前模型已切换为 ' + item, 'success');
        };
        container.appendChild(chip);
      });
      renderModelOrder();
      updateSelectionBar();
    }
    function toggleModelSelection(item) {
      var index = modelSelection.indexOf(item);
      if (index >= 0) modelSelection.splice(index, 1);
      else modelSelection.push(item);
      renderModelChips();
    }
    function updateSelectionBar() {
      var bar = q('selectBar');
      if (!bar) return;
      if (!modelSelection.length) { bar.style.display = 'none'; return; }
      bar.style.display = 'flex';
      q('selectSummary').textContent = '已选 ' + modelSelection.length + ' 个，顺序：' +
        modelSelection.map(function (item, index) { return (index + 1) + '.' + item; }).join('　');
    }
    function applySelectionOrder() {
      if (!modelSelection.length) return;
      var picked = modelSelection.slice();
      var rest = currentModels().filter(function (item) { return picked.indexOf(item) < 0; });
      modelSelection = [];
      setModelList(picked.concat(rest));
      markDirty();
      showToast('已按选择顺序置顶 ' + picked.length + ' 个模型', 'success');
    }
    function clearModelSelection() {
      modelSelection = [];
      renderModelChips();
    }
    function moveModel(index, delta) {
      var list = currentModels();
      var target = index + delta;
      if (target < 0 || target >= list.length) return;
      var tmp = list[index];
      list[index] = list[target];
      list[target] = tmp;
      setModelList(list);
      markDirty();
    }
    function renderModelOrder() {
      var container = q('modelOrder');
      if (!container) return;
      var list = currentModels().slice(0, 20);
      container.replaceChildren();
      if (!list.length) {
        var empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '获取模型后会在这里显示语音序号';
        container.appendChild(empty);
        return;
      }
      list.forEach(function (item, index) {
        var row = document.createElement('div');
        row.className = 'order-row';
        var num = document.createElement('div');
        num.className = 'order-num';
        num.textContent = String(index + 1);
        var name = document.createElement('div');
        name.className = 'order-name';
        name.textContent = item;
        name.title = item;
        var up = document.createElement('button');
        up.type = 'button';
        up.className = 'order-btn';
        up.textContent = '↑';
        up.title = '上移';
        up.disabled = index === 0;
        up.onclick = function () { moveModel(index, -1); };
        var down = document.createElement('button');
        down.type = 'button';
        down.className = 'order-btn';
        down.textContent = '↓';
        down.title = '下移';
        down.disabled = index === list.length - 1;
        down.onclick = function () { moveModel(index, 1); };
        row.appendChild(num);
        row.appendChild(name);
        row.appendChild(up);
        row.appendChild(down);
        container.appendChild(row);
      });
    }
    function setModelList(list) {
      models = list.slice(0, 100);
      q('modelOptions').value = models.join('\\n');
      updateModelCatalog(models);
      renderModelChips();
      updateSummary();
    }
    function updateSummary() {
      var provider = q('aiProvider').value;
      var presetInfo = aiProviders[provider];
      q('summaryProvider').textContent = presetInfo ? presetInfo.label : provider;
      q('summaryModel').textContent = q('model').value.trim() || '-';
      q('summaryBaseURL').textContent = q('baseURL').value.trim() || '-';
      q('summaryModels').textContent = currentModels().length + ' 个';
      var count = q('speakerList').querySelectorAll('.speaker').length;
      q('summarySpeakers').textContent = count + ' 个';
      q('navSpeakerCount').textContent = String(count);
    }

    function speakerCardMarkup(speaker, index, secret) {
      var id = speaker.id || ('speaker-' + (index + 1));
      var hasPassword = secret && secret.password;
      var hasToken = secret && secret.passToken;
      return '' +
        '<div class="speaker" data-speaker-id="' + esc(id) + '">' +
          '<div class="speaker-head">' +
            '<div class="speaker-avatar">' + (index + 1) + '</div>' +
            '<div>' +
              '<div class="speaker-name" data-role="name">' + esc(speaker.name || ('音箱 ' + (index + 1))) + '</div>' +
              '<div class="speaker-meta" data-role="meta">未启动</div>' +
            '</div>' +
            '<div class="speaker-head-right">' +
              '<label class="switch"><input type="checkbox" data-field="enabled"><span class="track"></span>启用</label>' +
              '<label class="switch"><input type="checkbox" data-field="voiceControl"><span class="track"></span>语音切换</label>' +
              '<button type="button" class="btn btn-ghost btn-sm" onclick="toggleAdvanced(this)">账号设置</button>' +
              '<button type="button" class="btn btn-danger btn-sm btn-icon" title="删除音箱" onclick="removeSpeaker(this)">删除</button>' +
            '</div>' +
          '</div>' +
          '<div class="speaker-body">' +
            '<div class="grid">' +
              '<div class="field"><label>显示名称</label><input type="text" data-field="name" placeholder="客厅音箱"></div>' +
              '<div class="field"><label>设备名称（可选）</label><input type="text" data-field="did" placeholder="小爱音箱"></div>' +
            '</div>' +
            '<div class="grid">' +
              '<div class="field"><label>当前模型</label><input type="text" data-field="model" list="modelCatalog" spellcheck="false"></div>' +
              '<div class="field"><label>思考等级</label><select data-field="thinkingLevel">' +
                '<option value="default">默认</option><option value="minimal">最低</option>' +
                '<option value="low">低</option><option value="medium">中</option><option value="high">高</option>' +
              '</select></div>' +
            '</div>' +
            '<div class="advanced">' +
              '<div class="grid">' +
                '<div class="field"><label>小米 ID</label><input type="text" data-field="userId" placeholder="纯数字账号 ID" spellcheck="false"></div>' +
                '<div class="field"><label>密码 <span class="tag' + (hasPassword ? ' saved' : '') + '" style="' + (hasPassword ? '' : 'display:none;') + '">已保存</span></label><input type="password" data-field="password" placeholder="小米账号密码" autocomplete="new-password"></div>' +
              '</div>' +
              '<div class="field"><label>PassToken <span class="tag' + (hasToken ? ' saved' : '') + '" style="' + (hasToken ? '' : 'display:none;') + '">已保存</span></label>' +
                '<textarea data-field="passToken" style="min-height:64px;" placeholder="遇到验证码时填写，建议直接使用 PassToken 登录"></textarea>' +
              '</div>' +
              '<button type="button" class="btn btn-ghost btn-sm" style="align-self:flex-start;" onclick="openModal()">如何获取小米凭证？</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
    function bindSpeakerCard(card) {
      card.addEventListener('input', function () {
        markDirty();
        card.querySelector('[data-role="name"]').textContent = card.querySelector('[data-field="name"]').value || '未命名音箱';
        updateSummary();
      });
      card.addEventListener('change', function () {
        markDirty();
        card.classList.toggle('off', !card.querySelector('[data-field="enabled"]').checked);
        updateSummary();
      });
    }
    function renderSpeakers(speakers, speakerSecrets) {
      var list = q('speakerList');
      var expanded = {};
      list.querySelectorAll('.speaker').forEach(function (node) {
        var adv = node.querySelector('.advanced');
        if (adv && adv.classList.contains('open')) expanded[node.dataset.speakerId] = true;
      });
      list.replaceChildren();
      (speakers || []).forEach(function (speaker, index) {
        var id = speaker.id || ('speaker-' + (index + 1));
        var holder = document.createElement('div');
        holder.innerHTML = speakerCardMarkup(speaker, index, (speakerSecrets || {})[id]);
        var card = holder.firstElementChild;
        card.querySelector('[data-field="name"]').value = speaker.name || '';
        card.querySelector('[data-field="did"]').value = speaker.did || '';
        card.querySelector('[data-field="userId"]').value = speaker.userId || '';
        card.querySelector('[data-field="model"]').value = speaker.model || q('model').value || '';
        card.querySelector('[data-field="thinkingLevel"]').value = speaker.thinkingLevel || 'default';
        card.querySelector('[data-field="enabled"]').checked = speaker.enabled !== false;
        card.querySelector('[data-field="voiceControl"]').checked = speaker.voiceControl !== false;
        if (speaker.enabled === false) card.classList.add('off');
        if (expanded[id]) card.querySelector('.advanced').classList.add('open');
        bindSpeakerCard(card);
        list.appendChild(card);
      });
      if (!list.children.length) {
        var empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '还没有音箱，点击右上角「添加音箱」开始配置';
        list.appendChild(empty);
      }
      updateSummary();
    }
    function toggleAdvanced(button) {
      var panel = button.closest('.speaker').querySelector('.advanced');
      panel.classList.toggle('open');
      button.textContent = panel.classList.contains('open') ? '收起设置' : '账号设置';
    }
    function addSpeaker() {
      var cards = q('speakerList').querySelectorAll('.speaker');
      if (cards.length >= 10) { showToast('最多支持 10 个音箱', 'error'); return; }
      var next = 1;
      var used = {};
      cards.forEach(function (card) { used[card.dataset.speakerId] = true; });
      while (used['speaker-' + next]) next += 1;
      var id = 'speaker-' + next;
      var holder = document.createElement('div');
      holder.innerHTML = speakerCardMarkup({ id: id, name: '音箱 ' + next, model: q('model').value || 'gpt-5.6-luna' }, cards.length, null);
      var card = holder.firstElementChild;
      card.querySelector('[data-field="model"]').value = q('model').value || 'gpt-5.6-luna';
      card.querySelector('[data-field="name"]').value = '音箱 ' + next;
      card.querySelector('[data-field="enabled"]').checked = true;
      card.querySelector('[data-field="voiceControl"]').checked = true;
      card.querySelector('.advanced').classList.add('open');
      bindSpeakerCard(card);
      var empty = q('speakerList').querySelector('.empty');
      if (empty) empty.remove();
      q('speakerList').appendChild(card);
      markDirty();
      updateSummary();
      showToast('已添加音箱 ' + next + '，请填写它自己的小米账号', 'success');
    }
    function removeSpeaker(button) {
      var card = button.closest('.speaker');
      var remaining = q('speakerList').querySelectorAll('.speaker').length;
      if (remaining <= 1) { showToast('至少需要保留 1 个音箱', 'error'); return; }
      var name = card.querySelector('[data-field="name"]').value || '该音箱';
      if (!window.confirm('确定删除“' + name + '”吗？\\n\\n该音箱保存的小米密码和 PassToken 也会被移除，且无法恢复。')) return;
      card.remove();
      markDirty();
      updateSummary();
      showToast('已移除 ' + name + '，保存后生效', 'success');
      var list = q('speakerList');
      if (!list.querySelector('.speaker')) {
        var empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '还没有音箱，点击右上角「添加音箱」开始配置';
        list.appendChild(empty);
      }
    }
    function collectConfig() {
      var speakers = [];
      q('speakerList').querySelectorAll('.speaker').forEach(function (card, index) {
        var field = function (name) { return card.querySelector('[data-field="' + name + '"]'); };
        speakers.push({
          id: card.dataset.speakerId || ('speaker-' + (index + 1)),
          name: field('name').value.trim() || ('音箱 ' + (index + 1)),
          enabled: field('enabled').checked,
          userId: field('userId').value.trim(),
          password: field('password').value,
          passToken: field('passToken').value.trim(),
          did: field('did').value.trim(),
          model: field('model').value.trim() || q('model').value.trim(),
          thinkingLevel: field('thinkingLevel').value,
          voiceControl: field('voiceControl').checked
        });
      });
      var config = {
        provider: q('aiProvider').value,
        openai: {
          model: q('model').value.trim() || 'gpt-5.6-luna',
          baseURL: q('baseURL').value.trim(),
          apiKey: q('apiKey').value
        },
        prompt: { system: q('systemPrompt').value.trim() },
        callAIKeywords: q('callAIKeywords').value.split(/\\r?\\n/).map(function (item) { return item.trim(); }).filter(Boolean),
        models: currentModels(),
        speakers: speakers,
        ttsCommand: q('ttsCommandEnabled').checked
          ? [Number(q('ttsCommandService').value) || 5, Number(q('ttsCommandAction').value) || 3]
          : null,
        wakeUpCommand: q('ttsCommandEnabled').checked
          ? [Number(q('wakeUpCommandService').value) || 5, Number(q('wakeUpCommandAction').value) || 1]
          : null,
        webSearch: {
          enabled: q('webSearchEnabled').checked,
          decision: 'model',
          endpoint: 'https://api.tavily.com/search',
          apiKey: q('webSearchApiKey').value,
          maxResults: Number(q('webSearchMaxResults').value) || 5,
          timeoutMs: 8000,
          cacheTtlSeconds: Number(q('webSearchCacheTtl').value) || 600
        }
      };
      var ttsProvider = q('ttsProvider').value;
      if (ttsProvider) {
        config.tts = { provider: ttsProvider };
        if (ttsProvider === 'volcano') {
          config.tts.volcano = {
            apiKey: q('ttsVolcanoApiKey').value.trim(),
            appId: q('ttsVolcanoAppId').value.trim(),
            accessToken: q('ttsVolcanoAccessToken').value.trim(),
            cluster: q('ttsVolcanoCluster').value.trim() || 'volcano_tts'
          };
          config.tts.defaultSpeaker = q('ttsDefaultSpeaker').value;
          var publicURL = q('publicURL').value.trim();
          if (publicURL) config.publicURL = publicURL;
        }
      }
      return config;
    }
    async function loadTtsSpeakers(selected) {
      var input = q('ttsDefaultSpeaker');
      var list = q('ttsSpeakerList');
      try {
        var res = await apiFetch('/api/tts-speakers');
        var speakers = await res.json();
        list.replaceChildren();
        (speakers || []).forEach(function (item) {
          var option = document.createElement('option');
          option.value = item.speaker;
          option.textContent = item.name + '（' + item.gender + '）';
          list.appendChild(option);
        });
      } catch (error) { /* 音色列表不可用时仍可手动填写 */ }
      input.value = selected || input.value || '';
    }
    async function loadConfig() {
      var res = await apiFetch('/api/config');
      if (!res.ok) { showToast(await readError(res, '读取配置失败'), 'error'); return; }
      var data = await res.json();
      var cfg = data.config || {};
      secrets = data.secretsConfigured || { speakers: {} };
      var volcanoKeyConfigured = Boolean(data.secretsConfigured && data.secretsConfigured.ttsVolcanoApiKey);
      q('aiProvider').value = cfg.provider || 'sub2api';
      q('baseURL').value = (cfg.openai && cfg.openai.baseURL) || 'https://api.openai.com/v1';
      q('baseURL').dataset.autoUrl = (aiProviders[q('aiProvider').value] || {}).url || '';
      q('model').value = (cfg.openai && cfg.openai.model) || 'gpt-5.6-luna';
      q('apiKey').value = '';
      q('apiKeyTag').style.display = secrets.openaiApiKey ? '' : 'none';
      var search = cfg.webSearch || {};
      q('webSearchEnabled').checked = search.enabled === true;
      q('webSearchApiKey').value = '';
      q('webSearchKeyTag').style.display = secrets.webSearchApiKey ? '' : 'none';
      q('webSearchMaxResults').value = search.maxResults || 5;
      q('webSearchCacheTtl').value = search.cacheTtlSeconds === undefined ? 600 : search.cacheTtlSeconds;
      q('systemPrompt').value = (cfg.prompt && cfg.prompt.system) || '';
      q('callAIKeywords').value = (cfg.callAIKeywords || []).join('\\n');
      models = cfg.models || [];
      q('modelOptions').value = models.join('\\n');
      updateModelCatalog(models);
      renderModelChips();
      renderSpeakers(cfg.speakers || [], secrets.speakers || {});
      renderLogSpeakerFilter(cfg.speakers || []);
      modelSelection = [];
      renderModelOrder();
      updateSelectionBar();
      var tts = cfg.tts || {};
      q('ttsProvider').value = tts.provider || '';
      q('ttsCommandEnabled').checked = cfg.ttsCommand !== null && cfg.ttsCommand !== undefined;
       q('wakeUpCommandService').value = Array.isArray(cfg.wakeUpCommand) ? cfg.wakeUpCommand[0] : 5;
       q('wakeUpCommandAction').value = Array.isArray(cfg.wakeUpCommand) ? cfg.wakeUpCommand[1] : 1;
       q('ttsCommandService').value = Array.isArray(cfg.ttsCommand) ? cfg.ttsCommand[0] : 5;
       q('ttsCommandAction').value = Array.isArray(cfg.ttsCommand) ? cfg.ttsCommand[1] : 3;
      if (tts.volcano) {
        q('ttsVolcanoAppId').value = tts.volcano.appId || '';
        q('ttsVolcanoApiKey').value = '';
        q('ttsVolcanoCluster').value = tts.volcano.cluster || 'volcano_tts';
        q('ttsVolcanoAccessToken').value = '';
      }
      q('ttsVolcanoKeyTag').style.display = volcanoKeyConfigured ? '' : 'none';
      q('ttsTokenTag').style.display = secrets.ttsVolcanoAccessToken ? '' : 'none';
      q('publicURL').value = cfg.publicURL || '';
      await loadTtsSpeakers(tts.defaultSpeaker);
      onTtsProviderChange();
      markSaved();
      updateSummary();
      await updateStatus();
    }
    function onTtsProviderChange() {
      var provider = q('ttsProvider').value;
      q('ttsVolcanoConfig').style.display = provider === 'volcano' ? '' : 'none';
      markDirty();
    }
    async function saveConfig() {
      var button = q('btnSave');
      button.disabled = true;
      button.textContent = '保存中...';
      try {
        var res = await apiFetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(collectConfig())
        });
        if (!res.ok) throw new Error(await readError(res, '保存失败'));
        var wasRunning = q('btnStop').disabled === false;
        var saved = await res.json();
        await loadConfig();
        showToast(saved && saved.applied ? '配置已保存并即时生效' : (wasRunning ? '配置已保存并即时生效' : '配置已保存'), 'success');
      } catch (error) {
        showToast('保存失败：' + error.message, 'error');
      }
      button.disabled = false;
      button.textContent = '保存配置';
    }
    async function fetchModels() {
      var button = q('btnFetchModels');
      button.disabled = true;
      button.textContent = '获取中...';
      try {
        var res = await apiFetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseURL: q('baseURL').value.trim(), apiKey: q('apiKey').value })
        });
        if (!res.ok) throw new Error(await readError(res, '获取模型失败'));
        var data = await res.json();
        setModelList(data.models || []);
        showToast('已获取 ' + (data.models || []).length + ' 个模型', 'success');
      } catch (error) {
        showToast('获取模型失败：' + error.message, 'error');
      }
      button.disabled = false;
      button.textContent = '从上游获取模型';
    }
    async function start() {
      var button = q('btnStart');
      button.disabled = true;
      button.textContent = '启动中...';
      try {
        var res = await apiFetch('/api/start', { method: 'POST' });
        if (!res.ok) throw new Error(await readError(res, '启动失败'));
        showToast('正在启动音箱服务', 'success');
      } catch (error) {
        showToast('启动失败：' + error.message, 'error');
      }
      await updateStatus();
      button.textContent = '启动服务';
    }
    async function stop() {
      var button = q('btnStop');
      button.disabled = true;
      button.textContent = '停止中...';
      try {
        var res = await apiFetch('/api/stop', { method: 'POST' });
        if (!res.ok) throw new Error(await readError(res, '停止失败'));
        showToast('已停止音箱服务', 'info');
      } catch (error) {
        showToast('停止失败：' + error.message, 'error');
      }
      await updateStatus();
      button.textContent = '停止服务';
    }
    function stateText(state) {
      return { running: '运行中', starting: '启动中', stopping: '停止中', error: '异常', stopped: '已停止' }[state] || '已停止';
    }
    function renderSpeakerStatuses(statuses) {
      var chips = q('speakerChips');
      chips.replaceChildren();
      (statuses || []).forEach(function (status) {
        var chip = document.createElement('span');
        var cls = status.state === 'running' ? 'run' : status.state === 'error' ? 'err' : status.state === 'starting' ? 'start' : '';
        chip.className = 'chip-status ' + cls;
        chip.innerHTML = '<span class="dot"></span>' + esc(status.name || status.id) + ' · ' + stateText(status.state) + (status.model ? ' · ' + esc(status.model) : '');
        if (status.error) chip.title = status.error;
        chips.appendChild(chip);
        var selector = '.speaker[data-speaker-id="' + (window.CSS && CSS.escape ? CSS.escape(status.id) : status.id) + '"]';
        var card = document.querySelector(selector);
        if (card) {
          var meta = card.querySelector('[data-role="meta"]');
          meta.textContent = stateText(status.state) + ' · ' + levelLabel(status.thinkingLevel) + '思考' + (status.error ? ' · ' + status.error : '');
          meta.style.color = status.state === 'error' ? '#c1121f' : status.state === 'running' ? '#0a7d3f' : '';
        }
      });
      if (!(statuses || []).length) chips.innerHTML = '<span class="empty">暂无音箱</span>';
    }
    async function updateStatus() {
      try {
        var res = await apiFetch('/api/status');
        var data = await res.json();
        var statuses = data.speakers || [];
        var running = statuses.filter(function (item) { return item.state === 'running'; }).length;
        var broken = statuses.some(function (item) { return item.state === 'error'; });
        var pill = q('statusPill');
        pill.className = 'pill ' + (broken ? 'is-err' : data.running ? 'is-run' : data.state === 'starting' ? 'is-warn' : '');
        q('statusPillText').textContent = data.running ? ('运行中 ' + running + '/' + statuses.length) : stateText(data.state);
        var orb = q('heroOrb');
        orb.className = 'orb-status ' + (broken ? 'err' : data.running ? 'run' : data.state === 'starting' ? 'warn' : '');
        q('heroState').textContent = data.running ? (running + ' / ' + statuses.length + ' 个音箱在线') : (data.state === 'starting' ? '正在启动...' : '服务未运行');
        var sub = data.error || '';
        if (!sub && statuses.length) sub = statuses.map(function (item) { return (item.name || item.id) + '：' + stateText(item.state); }).join('　');
        q('heroSub').textContent = sub || '点击「启动服务」开始接管音箱';
        q('btnStart').disabled = data.running || data.state === 'starting' || data.state === 'stopping';
        q('btnStop').disabled = !statuses.length || statuses.every(function (item) { return item.state === 'stopped'; });
        renderSpeakerStatuses(statuses);
      } catch (error) { /* 轮询失败静默重试 */ }
    }
    function renderLogSpeakerFilter(speakers) {
      var select = q('logSpeakerFilter');
      var current = select.value;
      select.replaceChildren();
      var all = document.createElement('option');
      all.value = '';
      all.textContent = '全部音箱';
      select.appendChild(all);
      (speakers || []).forEach(function (speaker, index) {
        var option = document.createElement('option');
        option.value = speaker.name || ('音箱 ' + (index + 1));
        option.textContent = speaker.name || ('音箱 ' + (index + 1));
        select.appendChild(option);
      });
      select.value = current;
    }
    function formatLogText(value) {
      return esc(value).replace(/\\*\\*([^*\\n]+)\\*\\*/g, '<strong>$1</strong>');
    }
    function logItemHtml(item) {
      var badge = item.speaker ? '<div class="log-speaker">' + esc(item.speaker) + '</div>' : '';
      return '<div class="log-item ' + esc(item.type || 'system') + '">' + badge + '<div class="log-time">' + esc(item.time) + '</div><div class="log-text">' + formatLogText(item.content) + '</div></div>';
    }
    function logIsNearBottom(container) {
      return container.scrollHeight - container.scrollTop - container.clientHeight < 72;
    }
    function updateFollowHint() {
      var hint = q('logFollowHint');
      if (!hint) return;
      hint.textContent = q('autoScroll').checked ? '正在跟随最新' : '已暂停跟随，可上滚查看';
    }
    function updateLatestButton() {
      var container = q('logList');
      var button = q('goLatest');
      if (!container || !button) return;
      button.classList.toggle('show', !logIsNearBottom(container));
    }
    function setAutoScroll(enabled, persist) {
      q('autoScroll').checked = enabled;
      if (persist) { try { localStorage.setItem('mi-paiai.autoscroll', enabled ? '1' : '0'); } catch (error) { /* ignore */ } }
      updateLatestButton();
      updateFollowHint();
    }
    function onAutoScrollChange() {
      var enabled = q('autoScroll').checked;
      setAutoScroll(enabled, true);
      if (enabled) goToLatest();
    }
    function goToLatest() {
      var container = q('logList');
      if (!container) return;
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      setAutoScroll(true, true);
      setTimeout(updateLatestButton, 350);
    }
    function initLogScrolling() {
      if (autoScrollInitialized) return;
      autoScrollInitialized = true;
      var container = q('logList');
      var saved = '1';
      try { saved = localStorage.getItem('mi-paiai.autoscroll') || '1'; } catch (error) { /* ignore */ }
      setAutoScroll(saved !== '0', false);
      container.addEventListener('scroll', function () {
        if (!logIsNearBottom(container) && q('autoScroll').checked) setAutoScroll(false, true);
        else updateLatestButton();
      }, { passive: true });
    }
    async function loadLogs(force) {
      try {
        var res = await apiFetch('/api/logs');
        var data = await res.json();
        var list = data.logs || [];
        var newest = list.length ? list[list.length - 1] : null;
        var key = list.length + '|' + (newest ? (newest.id || newest.time + newest.content) : '');
        if (key === lastLogKey && !force) return;
        var hadNewLogs = key !== lastLogKey;
        lastLogKey = key;
        var dash = q('dashLogs');
        // 概览保持“最新在最上”，完整日志则按时间顺序，最新在底部。
        var recent = list.slice(-5).reverse();
        dash.innerHTML = recent.length ? recent.map(logItemHtml).join('') : '<div class="empty">等待对话...</div>';
        var container = q('logList');
        var speakerFilter = q('logSpeakerFilter').value;
        var visible = list.filter(function (item) {
          if (speakerFilter && item.speaker !== speakerFilter) return false;
          if (logFilter === 'all') return true;
          if (logFilter === 'system') return item.type === 'system';
          return item.type === 'user' || item.type === 'ai';
        });
        container.innerHTML = visible.length ? visible.map(logItemHtml).join('') : '<div class="empty">' + (list.length ? '当前筛选无日志' : '等待对话...') + '</div>';
        var countLabel = q('logCount');
        if (countLabel) countLabel.textContent = visible.length + ' 条' + (visible.length !== list.length ? '（共 ' + list.length + ' 条）' : '');
        if (q('autoScroll').checked) container.scrollTop = container.scrollHeight;
        else if (hadNewLogs) updateLatestButton();
        updateFollowHint();
      } catch (error) { /* 轮询失败静默重试 */ }
    }
    function setLogFilter(button) {
      logFilter = button.dataset.filter;
      document.querySelectorAll('.log-tab').forEach(function (tab) { tab.classList.toggle('active', tab === button); });
      lastLogKey = '';
      loadLogs(true);
    }
    function refreshLogs() { lastLogKey = ''; loadLogs(true); showToast('日志已刷新', 'info'); }
    function openModal() { q('modalOverlay').classList.add('show'); }
    function closeModal(event) {
      if (event && event.target && event.target !== q('modalOverlay')) return;
      q('modalOverlay').classList.remove('show');
    }
    function openMiLogin() { window.open('https://account.mi.com/', '_blank', 'noopener'); }
    async function logout() {
      try { await apiFetch('/api/logout', { method: 'POST' }); } catch (error) { /* ignore */ }
      window.location.href = '/';
    }
    // 配置已支持保存后即时生效，刷新页面不再弹出确认框。
    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirty) saveConfig();
      }
    });
    (async function init() {
      restoreSection();
      initLogScrolling();
      try { await loadConfig(); } catch (error) { showToast('加载配置失败：' + error.message, 'error'); }
      await loadLogs(true);
      setInterval(updateStatus, 5000);
      setInterval(loadLogs, 2500);
    })();
  </script>
</body>
</html>`;
