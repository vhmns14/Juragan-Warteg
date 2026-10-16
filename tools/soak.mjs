// Soak: a bot plays N in-game years inside the real page (all visuals, events, saves), checking for runtime errors.
//   node tools/soak.mjs <years> smart|dumb <WxH>   -> ../shots/soak/soak-<mode>.log + yearly screenshots
import fs from 'node:fs';
import { launch, serve, helpers, openGame } from './lib.mjs';
const years = Number(process.argv[2] ?? 10);
const mode = process.argv[3] ?? 'smart';
const [W, H] = (process.argv[4] ?? '1280x720').split('x').map(Number);
const out = '../shots/soak';
fs.mkdirSync(out, { recursive: true });
const logf = `${out}/soak-${mode}.log`;
fs.writeFileSync(logf, '');
const log = (s) => { console.log(s); fs.appendFileSync(logf, s + '\n'); };
const { server, port } = await serve('dist');
const { browser, page, errors, csp } = await launch(W, H, 1);
const h = helpers(page, out);
await openGame(page, `http://localhost:${port}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 30000 });
await page.waitForTimeout(400);
await h.click('title_main_baru'); await h.click('title_mulai', 1200); await h.click('welcome_skip', 300);
await page.evaluate((mode) => {
  const w = window.__warteg;
  w.sim.autoChoice = (ev) => (mode === 'dumb' ? Math.floor(Math.random() * ev.choices.length) : 0);
  // bot policy (JS port of tools/balance.ts, simplified)
  window.__bot = () => {
    const sim = w.sim, s = sim.s, y = s.yesterday, r = Math.random;
    const DISH = (id) => sim.dishPrice(id) > 0;
    const unlocked = s.unlocked.filter(DISH);
    if (mode === 'dumb') {
      if (s.absDay % 28 === 0) { const served = y ? y.customers : 50; const list = unlocked.slice(0, sim.slots()); s.menu = {}; for (const id of list) s.menu[id] = Math.max(5, Math.round((served / list.length) * 1.6 * (0.5 + r() * 1.5))); s.nasiPorsi = Math.round(served * (0.6 + r() * 1.2) + 10); }
    } else {
      const sold = y ? y.sold : {};
      const ranked = [...unlocked].sort((a, b) => (sold[b] ?? 0) - (sold[a] ?? 0));
      const pickList = [...new Set(['esteh', ...ranked])].slice(0, sim.slots());
      const served = y ? Math.max(20, y.served + y.left + y.habis) : 50;
      s.menu = {}; for (const id of pickList) s.menu[id] = Math.max(6, Math.round(((sold[id] ?? served / pickList.length) * 1.15 + 3) * (y && y.habis > 2 ? 1.25 : 1)));
      s.nasiPorsi = Math.round(served * 1.08 + 8); s.kasbonPolicy = 1;
    }
    if (s.absDay % 7 !== 0) return;
    const mc = sim.monthlyCosts();
    const max = sim.stageInfo().staffMax;
    const count = (ro) => s.staff.filter((x) => x.role === ro).length;
    if (s.staff.length < max && s.candidates.length) {
      const lost = y ? (y.left + y.balk) / Math.max(1, y.customers) : 0;
      const capShort = sim.effortOf(s.menu, s.nasiPorsi) > sim.cookCap() * 0.95;
      const want = capShort && count('masak') < 3 ? 'masak' : lost > 0.12 ? (count('pelayan') <= count('kasir') ? 'pelayan' : 'kasir') : s.stage >= 2 && !count('belanja') ? 'belanja' : null;
      const c = want ? s.candidates.filter((x) => x.role === want)[0] : null;
      if (c && s.money > c.salary * 3 + mc) sim.hire(c);
    }
    if (!s.research) { for (const id of ['perkedel', 'asem', 'kerupuk', 'tongkol', 'sopayam', 'ati', 'resep_bumbu', 'jengkol', 'pepes', 'qris', 'sop_antri', 'mercon', 'rendang', 'teknik_cepat', 'resep_awet', 'resep_pedas']) if (!sim.startResearch(id)) break; }
    if (s.poin > sim.comboCost() + 20) { const a = unlocked; const ids = []; while (ids.length < 3) { const d = a[Math.floor(r() * a.length)]; if (!ids.includes(d)) ids.push(d); } sim.tryCombo(ids); }
    for (const d of ['kipas', 'tanaman', 'magicom', 'jam', 'tv', 'lampu', 'wastafel', 'neon', 'kulkas', 'etalase2', 'genset', 'ac']) if (s.money > mc * 2 + 1e6 && !sim.buyDecor(d)) break;
    const nx = [0, 15e6, 60e6, 180e6][s.stage];
    if (nx && !sim.upgradeCheck() && s.money > nx * s.inflation + mc * 3) sim.upgradeStage();
    if (s.stage >= 2) for (const a of Object.keys(s.apps)) if (!s.apps[a].joined && s.money > mc + 1e6) sim.joinApp(a);
    if (s.stage >= 3 && s.absDay - (s.flags.botCab ?? -99) >= 56) for (const L of ['kampus', 'pabrik', 'terminal', 'kantor', 'kampung', 'stasiun', 'masjid']) if (s.money - sim.cabangCost(L) > mc * 6 && !sim.openCabang(L)) { s.flags.botCab = s.absDay; break; }
    if (!sim.franchiseCheck()) sim.startFranchise();
  };
}, mode);
const days = years * 336;
const t0 = Date.now();
let lastYear = 1;
for (let d = 0; d < days; d += 4) {
  const st = await page.evaluate(() => {
    const w = window.__warteg; const sim = w.sim;
    for (let k = 0; k < 4; k++) {
      if (sim.s.bankrupt) break;
      if (sim.s.tick === 0) window.__bot();
      let n = 0; const day = sim.s.absDay;
      while (sim.s.absDay === day && n++ < 200 && !sim.s.bankrupt) { while (sim.pending.length) sim.resolve(sim.pending[0], 0); sim.tick(); }
    }
    w.scene.closeAll();
    const s = sim.s;
    return { day: s.absDay, year: Math.floor(s.absDay / 336) + 1, money: s.money, stars: sim.stars(), stage: s.stage, cab: s.cabang.length, staff: s.staff.length, fans: s.fans, bankrupt: s.bankrupt, fr: s.franchise, movers: w.scene.cust.size, objs: w.scene.children.list.length };
  });
  await page.waitForTimeout(20);
  if (st.year !== lastYear || st.bankrupt) {
    lastYear = st.year;
    log(`Th${st.year - 1} selesai: kas ${Math.round(st.money / 1e6)} jt | ★${st.stars.toFixed(2)} | stage ${st.stage}${st.fr ? '+fr' : ''} | cabang ${st.cab} | staf ${st.staff} | fans ${st.fans} | objek scene ${st.objs} | errors ${errors.length} | ${Math.round((Date.now() - t0) / 1000)}s`);
    await h.shot(`soak-${mode}-th${st.year - 1}.png`);
    if (st.bankrupt) { log('BANGKRUT di tahun ' + st.year); break; }
  }
}
const fin = await page.evaluate(() => ({ ended: window.__warteg.sim.s.ended, ach: Object.keys(window.__warteg.sim.s.achievements).length, title: window.__warteg.sim.endingTitle() }));
log(`selesai: ended=${fin.ended} prestasi=${fin.ach} gelar=${fin.title.title} (${fin.title.score}) | console errors ${errors.length} | csp ${csp.length}`);
if (errors.length) log(errors.slice(0, 10).join('\n'));
await browser.close();
server.close();
