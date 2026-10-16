// node tools/quick2.mjs WxH out.png  -> stage 3 warteg mid-lunch, real-time animation
import { launch, serve, helpers, openGame } from './lib.mjs';
const [wh = '1920x1080', out = '/tmp/q2.png', stage = '3', secs = '9'] = process.argv.slice(2);
const [w, h] = wh.split('x').map(Number);
const { server, port } = await serve('dist');
const { browser, page, errors, csp } = await launch(w, h, 1);
const H = helpers(page, '/tmp');
await openGame(page, `http://localhost:${port}/`);
await H.click('title_main_baru'); await H.click('title_mulai', 1200);
await H.tryClick('welcome_skip');
await H.ev((st) => {
  const w = window.__warteg, s = w.sim.s;
  s.stage = Number(st); s.money = 80e6; s.fans = 3000; s.decor = ['kipas', 'tv', 'tanaman', 'jam', 'magicom', 'lampu', 'neon'];
  s.unlocked.push('rendang', 'perkedel', 'sopayam');
  s.menu = { orek: 40, telurbalado: 40, tahu: 40, lodeh: 30, ayamgoreng: 30, rendang: 20, kangkung: 30, ikangoreng: 25, perkedel: 30, esteh: 60 }; s.nasiPorsi = 260;
  for (const r of ['masak', 'pelayan', 'kasir', 'pelayan', 'belanja']) { const c = s.candidates.find((x) => x.role === r); }
  s.apps.laparin.joined = true; s.apps.kilat.joined = true;
  s.rasa = 70; s.bersih = 70; s.suasana = 60;
  w.sim.weekStart();
  for (const r of ['pelayan', 'kasir', 'masak', 'belanja']) { const c = s.candidates.find((x) => x.role === r); if (c) w.sim.hire(c); }
  w.scene.buildWorld();
  w.sim.cookMorning();
  w.sim.s.tick = 23;
  w.scene.setSpeed(2);
}, stage);
await page.waitForTimeout(Number(secs) * 1000);
await page.screenshot({ path: out });
console.log('errors', errors.length, errors.slice(0, 5).join('\n'), 'csp', csp.length);
await browser.close(); server.close();
