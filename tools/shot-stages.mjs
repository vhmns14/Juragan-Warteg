// v1.4: one screenshot per warung stage (Gerobak .. Restoran Besar + Lantai 2) mid-lunch, at each size, so the room
// growth can be checked side by side.   node tools/shot-stages.mjs dist ../shots/stages 1920x1080,390x844 [stages]
import { launch, serve, helpers, openGame } from './lib.mjs';
const root = process.argv[2] ?? 'dist';
const out = process.argv[3] ?? '../shots/stages';
const sizes = (process.argv[4] ?? '1920x1080,390x844').split(',').map((s) => s.split('x').map(Number));
const only = (process.argv[5] ?? '1,2,3,4,5,6,6b').split(',');
const wait = Number(process.env.WAIT ?? 5000);
const { server, port } = await serve(root);
let totalErr = 0, totalCsp = 0;
const NAMES = { 1: 'gerobak', 2: 'warteg-kecil', 3: 'warteg', 4: 'warteg-besar', 5: 'rumah-makan', 6: 'restoran-besar', '6b': 'restoran-lantai2' };
for (const [w, hh] of sizes) {
  const { browser, page, errors, csp } = await launch(w, hh, w < 600 ? 2 : 1);
  const h = helpers(page, out);
  await openGame(page, `http://localhost:${port}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  await h.click('title_main_baru'); await h.click('title_mulai', 1200); await h.click('welcome_skip', 300);
  for (const st of only) {
    if (st === 'map') {
      // v1.4 Peta Nasional with a brand and a few outlets
      await h.ev(() => {
        const w = window.__warteg, s = w.sim.s;
        for (const m of [...w.scene.modals]) m.close();
        s.stage = 6; s.franchise = true; s.brand = 'Sederhana Rasa Bundo'; s.money = 5e9;
        s.outlets = []; s.outletSeq = 1;
        for (const [city, kind] of [['pesisir', 'mall'], ['pesisir', 'kota'], ['teluk', 'bandara'], ['kembang', 'kota'], ['tepian', 'mall'], ['cakrawala', 'kota'], ['danau', 'kota']]) s.outlets.push({ id: s.outletSeq++, city, kind, lv: 1, opened: 1, rating: 4.2, lastWeek: 3e6, total: 0 });
        w.scene.buildWorld(); w.scene.refreshFloorBtn();
        w.scene.openScreen('openNasional');
      });
      await page.waitForTimeout(900);
      await h.ev(() => { const t = window.__warteg.scene.tut; if (t) { t.hintQ = []; t.hintBox?.destroy(); t.hintBox = null; } });
      await h.shot(`stage-map-peta-nasional-${w}x${hh}.png`);
      continue;
    }
    const stage = parseInt(st, 10), floor = st.endsWith('b') ? 2 : 1;
    await h.ev(([stage, floor]) => {
      const w = window.__warteg, s = w.sim.s;
      s.tut = 99; s.stage = stage; s.flags.hintsOff = 1; for (const k of ['figuran', 'rumahmakan', 'prasmanan', 'restoran', 'lantai2', 'pelayan', 'kepala', 'shift', 'manajer', 'brand', 'outlet', 'pajak', 'bus', 'vip', 'parkir', 'kucing', 'radio', 'hujan', 'pasar', 'medsos', 'langganan', 'katering']) s.flags['hint_' + k] = 1; s.money = 900e6; s.fans = 30000; s.poin = 300; s.absDay = 1;
      s.decor = stage >= 2 ? ['kipas', 'tv', 'tanaman', 'jam', 'magicom', 'lampu', 'neon', 'ac', ...(stage >= 4 ? ['lampion', 'papanmenu'] : []), ...(stage >= 5 ? ['lukisan', 'aquarium'] : []), ...(stage >= 6 ? ['karaoke'] : [])] : ['kipas'];
      s.prasmanan = stage >= 5;
      for (const d of ['rendang', 'perkedel', 'sopayam', 'ati', 'gulaiayam', 'ayampop', 'dendeng']) if (!s.unlocked.includes(d)) s.unlocked.push(d);
      s.menu = { orek: 60, telurbalado: 60, tahu: 60, lodeh: 50, ayamgoreng: 50, rendang: 40, kangkung: 50, ikangoreng: 40, perkedel: 40, esteh: 90, gulaiayam: 40, ayampop: 40, dendeng: 30 };
      s.nasiPorsi = 600;
      s.apps.laparin.joined = true; s.apps.kilat.joined = true;
      s.rasa = 80; s.bersih = 78; s.murah = 66; s.antrian = 70; s.suasana = 76;
      s.staff = s.staff.slice(0, 1);
      const want = { 1: ['masak'], 2: ['masak', 'kasir', 'pelayan'], 3: ['masak', 'masak', 'pelayan', 'kasir', 'belanja'], 4: ['masak', 'masak', 'pelayan', 'pelayan', 'kasir', 'belanja', 'kepala', 'shift'], 5: ['masak', 'masak', 'masak', 'pelayan', 'pelayan', 'pelayan', 'kasir', 'belanja', 'kepala', 'shift', 'manajer'], 6: ['masak', 'masak', 'masak', 'masak', 'pelayan', 'pelayan', 'pelayan', 'pelayan', 'pelayan', 'kasir', 'belanja', 'kepala', 'shift', 'manajer'] }[stage];
      for (const r of want) { for (let k = 0; k < 6; k++) { const c = s.candidates.find((x) => x.role === r); if (c) { c.salary = 1; s.money += 1e7; w.sim.hire(c); break; } w.sim.weekStart(); } }
      w.scene.floorView = floor;
      w.scene.buildWorld(); w.sim.cookMorning();
      for (const [id, n] of Object.entries(s.menu)) s.stock[id] = { fresh: n, old: 0 };
      s.nasi = s.nasiPorsi;
      s.tick = stage === 1 ? 9 : 25;
      w.scene.camHome(); w.scene.applyWorldCam && w.scene.applyWorldCam(); w.scene.refreshFloorBtn();
      w.scene.setSpeed(1);
      for (const m of [...w.scene.modals]) m.close();
    }, [stage, floor]);
    await page.waitForTimeout(wait);
    await h.closeModals();
    // FIXED=1: every stage at the Restoran Besar's fit zoom (same world scale), so the growth reads side by side
    if (process.env.FIXED) await h.ev(() => {
      const sc = window.__warteg.scene, s = sc.sim.s;
      const st0 = s.stage, f0 = sc.floorView; s.stage = 6; sc.floorView = 1;
      const fit6 = sc.fitZoom();
      s.stage = st0; sc.floorView = f0;
      const b = sc.wb(); const Z = sc.registry.get('zoom');
      sc.worldCam.setZoom(Z * fit6).centerOn((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2 - 10);
    });
    await h.ev(() => { const t = window.__warteg.scene.tut; if (t) { t.hintQ = []; t.hintBox?.destroy(); t.hintBox = null; } });
    await page.waitForTimeout(150);
    await h.shot(`stage-${st}-${NAMES[st]}-${w}x${hh}${process.env.FIXED ? '-fixed' : ''}.png`);
  }
  console.log(`${w}x${hh}: errors ${errors.length} csp ${csp.length}`, errors.slice(0, 3).join(' | '));
  totalErr += errors.length; totalCsp += csp.length;
  await browser.close();
}
console.log(`TOTAL errors ${totalErr} csp ${totalCsp}`);
server.close();
