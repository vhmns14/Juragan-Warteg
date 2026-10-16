// v1.2 backdrop / movement shots: in-game (Warteg mid-lunch), zoomed out, zoomed in + panned to both limits, and the
// gerobak stage, per size.   node tools/shot-outside.mjs dist ../shots/outside 1366x600,390x844 [warteg|gerobak|both]
import { launch, serve, helpers, openGame } from './lib.mjs';
const root = process.argv[2] ?? 'dist';
const out = process.argv[3] ?? '../shots/outside';
const sizes = (process.argv[4] ?? '1366x600').split(',').map((s) => s.split('x').map(Number));
const which = process.argv[5] ?? 'both';
const { server, port } = await serve(root);
let totalErr = 0, totalCsp = 0;
async function setup(h, stage) {
  await h.ev((stage) => {
    const w = window.__warteg, s = w.sim.s;
    s.tut = 99; s.stage = stage; s.money = 85e6; s.fans = 3400; s.poin = 64; s.decor = stage > 1 ? ['kipas', 'tv', 'tanaman', 'jam', 'magicom', 'lampu', 'neon'] : [];
    for (const d of ['rendang', 'perkedel', 'sopayam', 'ati']) if (!s.unlocked.includes(d)) s.unlocked.push(d);
    s.menu = { orek: 40, telurbalado: 40, tahu: 40, lodeh: 30, ayamgoreng: 30, rendang: 20, kangkung: 30, ikangoreng: 25, perkedel: 30, esteh: 60 }; s.nasiPorsi = 220;
    s.apps.laparin.joined = true; s.apps.kilat.joined = true;
    s.rasa = 72; s.bersih = 70; s.murah = 62; s.antrian = 66; s.suasana = 62;
    w.sim.weekStart();
    for (const r of ['masak', 'pelayan', 'kasir', 'masak', 'belanja']) { const c = s.candidates.find((x) => x.role === r) ?? null; if (c) w.sim.hire(c); else { w.sim.weekStart(); const c2 = s.candidates.find((x) => x.role === r); if (c2) w.sim.hire(c2); } }
    w.scene.buildWorld(); w.sim.cookMorning();
    for (const [id, n] of Object.entries(s.menu)) s.stock[id] = { fresh: n, old: 0 };
    s.nasi = s.nasiPorsi;
    s.tick = 22; s.absDay = 1;
    w.scene.setSpeed(1);
  }, stage);
}
for (const [w, hh] of sizes) {
  const { browser, page, errors, csp } = await launch(w, hh, w < 600 ? 2 : 1);
  const h = helpers(page, out);
  await openGame(page, `http://localhost:${port}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  await h.click('title_main_baru'); await h.click('title_mulai', 1200); await h.click('welcome_skip', 300);
  for (const stage of which === 'both' ? [3, 1] : which === 'gerobak' ? [1] : [3]) {
    const tag = stage === 1 ? 'gerobak-' : '';
    await setup(h, stage);
    await page.waitForTimeout(6000);
    await h.shot(`o-${tag}${w}x${hh}.png`);
    if (process.env.DUMP) console.log(JSON.stringify(await h.ev(() => window.__warteg.scene.debugMovers().filter((m) => m.vis).map((m) => [m.id, Math.round(m.x - 5000), Math.round(m.y), m.f, m.flip ? 'L' : 'R', m.mode]))));
    // zoomed out to the minimum
    await h.ev(() => { const sc = window.__warteg.scene; sc.zoomAt(0.1, sc.vcx(), 300); });
    await page.waitForTimeout(400);
    await h.shot(`o-${tag}${w}x${hh}-out.png`);
    // zoomed in, panned to the left / top and right / bottom limits
    await h.ev(() => { const sc = window.__warteg.scene; sc.zoomAt(2.2, sc.vcx(), 300); sc.panBy(-5000, -5000); });
    await page.waitForTimeout(300);
    await h.shot(`o-${tag}${w}x${hh}-tl.png`);
    await h.ev(() => { const sc = window.__warteg.scene; sc.panBy(10000, 10000); });
    await page.waitForTimeout(300);
    await h.shot(`o-${tag}${w}x${hh}-br.png`);
    await h.ev(() => { const sc = window.__warteg.scene; sc.zoomAt(0.1, sc.vcx(), 300); });
  }
  console.log(`${w}x${hh}: errors ${errors.length} csp ${csp.length}`, errors.slice(0, 3).join(' | '));
  totalErr += errors.length; totalCsp += csp.length;
  await browser.close();
}
console.log(`TOTAL errors ${totalErr} csp ${totalCsp}`);
server.close();
