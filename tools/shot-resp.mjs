// Responsive screenshots: title + in-game (Warteg mid-lunch) + a dialog per size, plus a live-resize sequence.
//   node tools/shot-resp.mjs dist ../shots/resp [WxH,...]
import { launch, serve, helpers, openGame } from './lib.mjs';
const root = process.argv[2] ?? 'dist';
const out = process.argv[3] ?? '../shots/resp';
const sizes = (process.argv[4] ?? '375x812,390x844,1280x720,1366x600,1920x1080').split(',').map((s) => s.split('x').map(Number));
const { server, port } = await serve(root);
let totalErr = 0, totalCsp = 0;
async function setupWarteg(h, page) {
  await h.ev(() => {
    const w = window.__warteg, s = w.sim.s;
    s.tut = 99; s.stage = 3; s.money = 85e6; s.fans = 3400; s.poin = 64; s.decor = ['kipas', 'tv', 'tanaman', 'jam', 'magicom', 'lampu', 'neon'];
    for (const d of ['rendang', 'perkedel', 'sopayam', 'ati']) if (!s.unlocked.includes(d)) s.unlocked.push(d);
    s.menu = { orek: 40, telurbalado: 40, tahu: 40, lodeh: 30, ayamgoreng: 30, rendang: 20, kangkung: 30, ikangoreng: 25, perkedel: 30, esteh: 60 }; s.nasiPorsi = 220;
    s.apps.laparin.joined = true; s.apps.kilat.joined = true;
    s.rasa = 72; s.bersih = 70; s.murah = 62; s.antrian = 66; s.suasana = 62;
    w.sim.weekStart();
    for (const r of ['masak', 'pelayan', 'kasir', 'masak', 'belanja']) { const c = s.candidates.find((x) => x.role === r) ?? null; if (c) w.sim.hire(c); else { w.sim.weekStart(); const c2 = s.candidates.find((x) => x.role === r); if (c2) w.sim.hire(c2); } }
    s.reviews = [];
    w.sim.addReview({ name: 'Bang Udin', type: 'ojol', stars: 5, text: 'Bungkusnya cepet, langsung narik lagi.' });
    w.sim.addReview({ name: 'Mbak Rina', type: 'kantor', stars: 4, text: 'Rendangnya lembut. Besok ajak tim.' });
    w.sim.addReview({ name: 'Sasa', type: 'mhs', stars: 5, text: 'Orek tempenya juara, akhir bulan selamat.' });
    w.sim.addReview({ name: 'Ujang', type: 'buruh', stars: 5, text: 'Porsinya mantap, kenyang sampai sore!' });
    w.scene.buildWorld(); w.sim.cookMorning();
    for (const [id, n] of Object.entries(s.menu)) s.stock[id] = { fresh: n, old: 0 };
    s.nasi = s.nasiPorsi;
    s.tick = 25; s.absDay = 1;
    w.scene.setSpeed(1);
  });
}
for (const [w, hh] of sizes) {
  const { browser, page, errors, csp } = await launch(w, hh, w < 600 ? 2 : 1);
  const h = helpers(page, out);
  await openGame(page, `http://localhost:${port}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 30000 });
  await page.waitForTimeout(600);
  await h.shot(`resp-${w}x${hh}-title.png`);
  await h.click('title_main_baru'); await h.click('title_mulai', 1200); await h.click('welcome_skip', 300);
  await setupWarteg(h, page);
  await page.waitForTimeout(6000);
  await h.shot(`resp-${w}x${hh}-game.png`);
  await h.click('btn_masak', 500);
  await h.shot(`resp-${w}x${hh}-masak.png`);
  await h.closeModals();
  await h.ev(() => window.__warteg.screens.openPeta(window.__warteg.scene));
  await page.waitForTimeout(400);
  await h.shot(`resp-${w}x${hh}-peta.png`);
  await h.closeModals();
  console.log(`${w}x${hh}: errors ${errors.length} csp ${csp.length}`, errors.slice(0, 3).join(' | '));
  totalErr += errors.length; totalCsp += csp.length;
  await browser.close();
}
// live resize: phone -> wide -> short -> desktop -> phone, with a dialog open in the middle
{
  const { browser, page, errors, csp } = await launch(390, 844, 2);
  const h = helpers(page, out);
  await openGame(page, `http://localhost:${port}/`);
  await h.click('title_main_baru'); await h.click('title_mulai', 1200); await h.click('welcome_skip', 300);
  await setupWarteg(h, page);
  await page.waitForTimeout(2000);
  let i = 0;
  for (const [w, hh] of [[1280, 720], [1366, 600], [1920, 1080], [844, 390], [390, 844]]) {
    await page.setViewportSize({ width: w, height: hh });
    await page.waitForTimeout(1200);
    if (i === 2) { await h.click('btn_staf', 400); }
    await h.shot(`resize-${i++}-${w}x${hh}.png`);
  }
  console.log(`live resize: errors ${errors.length} csp ${csp.length}`, errors.slice(0, 3).join(' | '));
  totalErr += errors.length; totalCsp += csp.length;
  await browser.close();
}
console.log(`TOTAL errors ${totalErr} csp ${totalCsp}`);
server.close();
