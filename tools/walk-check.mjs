// v1.2 movement check: samples every drawn person on every animation frame during a busy lunch (Warteg + gerobak,
// 1x and 4x) and asserts that the facing matches the movement direction (no moonwalking), people only move with a walk
// frame (no sliding), nobody jumps (no teleport) and nobody walks through the tables / etalase.
//   node tools/walk-check.mjs [dist] [seconds per run]
import { launch, serve, helpers, openGame } from './lib.mjs';
const root = process.argv[2] ?? 'dist';
const secs = Number(process.argv[3] ?? 8);
const { server, port } = await serve(root);
const { browser, page, errors, csp } = await launch(1366, 768, 1);
const h = helpers(page, '../shots');
await openGame(page, `http://localhost:${port}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 30000 });
await page.waitForTimeout(300);
await h.click('title_main_baru'); await h.click('title_mulai', 1200); await h.click('welcome_skip', 300);
const total = { samples: 0, moving: 0, faceH: 0, faceV: 0, slide: 0, idleSlide: 0, teleport: 0, obst: 0, runs: [] };
const bad = [];
const STAGES = (process.env.STAGES ?? '2,3,4,5,6,1').split(',').map(Number);
for (const stage of STAGES) for (const spd of [1, 4]) {
  await h.ev(([stage, spd]) => {
    const w = window.__warteg, s = w.sim.s;
    s.tut = 99; s.stage = stage; s.money = 85e6; s.fans = 6000; s.prasmanan = stage >= 5;
    s.menu = { orek: 60, telurbalado: 60, tahu: 60, lodeh: 50, ayamgoreng: 50, kangkung: 50, esteh: 80 }; s.nasiPorsi = 400;
    s.apps.laparin.joined = true; s.apps.kilat.joined = true;
    s.rasa = 80; s.bersih = 75; s.murah = 70; s.antrian = 50; s.suasana = 70;
    w.sim.weekStart();
    for (const r of ['masak', 'pelayan', 'kasir', 'belanja', ...(stage >= 5 ? ['pelayan', 'pelayan'] : [])]) { if (s.staff.filter((x) => x.role === r).length >= (r === 'pelayan' && stage >= 5 ? 3 : 1)) continue; for (let k = 0; k < 5; k++) { const c = s.candidates.find((x) => x.role === r); if (c) { w.sim.hire(c); break; } w.sim.weekStart(); } }
    w.scene.buildWorld(); w.sim.cookMorning();
    for (const [id, n] of Object.entries(s.menu)) s.stock[id] = { fresh: n, old: 0 };
    s.nasi = s.nasiPorsi; s.tick = stage === 1 ? 9 : 23; s.absDay = 2;
    w.scene.setSpeed(spd === 4 ? 3 : 1);
    // visitors + the tukang belanja trip are part of the check too
    w.scene.spawnExtra('vlog'); w.scene.spawnExtra('dinkes');
  }, [stage, spd]);
  await page.waitForTimeout(1500);
  const samples = await page.evaluate((ms) => new Promise((res) => {
    const sc = window.__warteg.scene, out = [], t0 = performance.now();
    const f = () => { out.push({ t: performance.now(), n: sc.frameNo, dt: sc.lastDt, k: sc.speedMul(), m: sc.debugMovers() }); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  }), secs * 1000);
  const run = { stage, spd, frames: samples.length, people: 0, moving: 0, faceH: 0, faceV: 0, slide: 0, idleSlide: 0, teleport: 0, obst: 0 };
  const seen = new Set();
  for (let i = 1; i < samples.length; i++) {
    const A = samples[i - 1], Bs = samples[i], dt = Bs.dt;
    // only pairs exactly one game frame apart: the displacement is then exactly that frame's movement
    if (Bs.n - A.n !== 1) continue;
    const prev = new Map(A.m.map((m) => [m.id, m]));
    for (const b of Bs.m) {
      const a = prev.get(b.id); if (!a || !a.vis || !b.vis) continue;
      seen.add(b.id);
      total.samples++;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (b.obst) { run.obst++; bad.push(['obst', stage, spd, b.id, Math.round(b.x - 5000), Math.round(b.y)]); }
      if (a.mode === 'walk' && b.mode === 'walk') {
        // the frame budget is capped at 250 ms in the game loop
        const maxStep = b.spd * Math.max(1, Bs.k) * Math.min(dt, 250) / 1000 * 1.02 + 0.05;
        if (d > maxStep) { run.teleport++; bad.push(['teleport', stage, spd, b.id, d.toFixed(1), maxStep.toFixed(1)]); }
        if (d < 0.3 || b.final) continue;
        run.moving++;
        const walkF = /^_(w|w2|b|b2)$/.test(b.f);
        if (!walkF) { run.slide++; bad.push(['slide', stage, spd, b.id, b.f]); continue; }
        if (Math.abs(dx) > d * 0.35 && b.flip !== (dx < 0)) { run.faceH++; bad.push(['faceH', stage, spd, b.id, dx.toFixed(2), dy.toFixed(2), b.f, b.flip]); }
        if (Math.abs(dy) > d * 0.35 && b.f.startsWith('_b') !== (dy < 0)) { run.faceV++; bad.push(['faceV', stage, spd, b.id, dx.toFixed(2), dy.toFixed(2), b.f, b.flip]); }
      } else {
        // not walking in either frame: may still have walked a short hop inside that one frame (4x), but never more
        // than a frame's walk; standing still on the same spot otherwise (the idle bob only moves the sprite, not the feet)
        const maxStep = Math.max(b.spd, 60) * Math.max(1, Bs.k) * Math.min(dt, 250) / 1000 * 1.02 + 0.05;
        if (d > maxStep) { run.teleport++; bad.push(['teleport', stage, spd, b.id, d.toFixed(1), a.mode, b.mode]); }
        else if (a.mode === b.mode && a.mode !== 'walk' && d > 0.01 && Bs.k <= 1 && d > 0) { run.idleSlide++; bad.push(['idleSlide', stage, spd, b.id, d.toFixed(2), a.mode, b.mode]); }
      }
    }
  }
  run.people = seen.size;
  for (const k of ['moving', 'faceH', 'faceV', 'slide', 'idleSlide', 'teleport', 'obst']) total[k] += run[k];
  total.runs.push(run);
  console.log(JSON.stringify(run));
}
const mism = total.faceH + total.faceV + total.slide + total.idleSlide + total.teleport + total.obst;
console.log('first problems:', JSON.stringify(bad.slice(0, 6)), JSON.stringify(bad.filter((x) => x[1] === 1).slice(0, 10)));
console.log(`walk-check: ${total.moving} moving samples, facing mismatches ${total.faceH + total.faceV} (h ${total.faceH} / v ${total.faceV}), sliding ${total.slide + total.idleSlide}, teleports ${total.teleport}, through furniture ${total.obst}; console errors ${errors.length}, csp ${csp.length}`);
console.log(mism === 0 && errors.length === 0 && csp.length === 0 ? 'WALK-CHECK PASS' : 'WALK-CHECK FAIL');
await browser.close(); server.close();
process.exit(mism === 0 && errors.length === 0 ? 0 : 1);
