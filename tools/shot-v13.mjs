// v1.3 feature screenshots at several sizes: room with rain / heat + cat + street figuran, Kampung hub tabs, Kucing,
// Radio, Dapur Seru + each minigame, a regular's story choice (portrait), a katering offer, Masak in Ramadan with
// takjil, Belanja with Kabar Pasar, gerobak mangkal, phone Kabar dock tab, the new ending. Fails on console errors.
//   node tools/shot-v13.mjs dist ../shots/v13 1920x1080,1366x600,390x844
import { launch, serve, helpers, openGame } from './lib.mjs';
const root = process.argv[2] ?? 'dist';
const out = process.argv[3] ?? '../shots/v13';
const sizes = (process.argv[4] ?? '1920x1080,1366x600,390x844').split(',').map((s) => s.split('x').map(Number));
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const { server, port } = await serve(root);
let totalErr = 0, totalCsp = 0;
const want = (n) => !only || only.some((o) => n.includes(o));

async function setup(h) {
  await h.ev(() => {
    const w = window.__warteg, s = w.sim.s;
    s.tut = 99; s.stage = 3; s.money = 185e6; s.fans = 4400; s.poin = 64; s.decor = ['kipas', 'tv', 'tanaman', 'jam', 'magicom', 'lampu', 'neon'];
    for (const d of ['rendang', 'perkedel', 'sopayam', 'ati', 'pepes']) if (!s.unlocked.includes(d)) s.unlocked.push(d);
    s.menu = { orek: 40, telurbalado: 40, tahu: 40, lodeh: 30, ayamgoreng: 30, rendang: 20, kangkung: 30, ikangoreng: 25, perkedel: 30, esteh: 60 }; s.nasiPorsi = 220;
    s.apps.laparin.joined = true; s.apps.kilat.joined = true;
    s.rasa = 72; s.bersih = 70; s.murah = 62; s.antrian = 66; s.suasana = 62;
    w.sim.weekStart();
    for (const r of ['masak', 'pelayan', 'kasir', 'masak', 'belanja']) { const c = s.candidates.find((x) => x.role === r) ?? null; if (c) w.sim.hire(c); else { w.sim.weekStart(); const c2 = s.candidates.find((x) => x.role === r); if (c2) w.sim.hire(c2); } }
    s.cat.adopted = true; s.cat.offered = true; s.cat.aff = 72; s.cat.name = 'Si Oyen';
    s.weather = 'hujan';
    s.flags.hint_hujan = 1; s.flags.hint_figuran = 1; s.flags.hint_mini = 1; s.flags.hint_harga = 1;
    s.news = [];
    w.sim.weekStart();
    s.news.push({ day: 2, text: 'Harga cabai rawit melonjak! Pedagang: "Gagal panen, Bu..."', kind: 'shock' });
    s.shocks.push({ id: 'cabai', ing: 'cabai', mult: 2.1, until: 30 });
    w.scene.buildWorld(); w.sim.cookMorning();
    for (const [id, n] of Object.entries(s.menu)) s.stock[id] = { fresh: n, old: 0 };
    s.nasi = s.nasiPorsi;
    s.tick = 25; s.absDay = 14;
    // katering + regulars + posts so the Kampung tabs have content
    s.katering.push({ id: 1, kind: 'nikahan', client: 'Mas Bayu & Mbak Laras', portions: 220, pay: 4620000, due: 17, prep: 90, lembur: false, state: 'aktif', dp: 1386000, day: 12 });
    s.katering.push({ id: 2, kind: 'arisan', client: 'Bu RT Sumarni', portions: 30, pay: 510000, due: 10, prep: 30, lembur: false, state: 'selesai', dp: 153000, day: 8 });
    s.katering.push({ id: 3, kind: 'tahlilan', client: 'Keluarga Pak Harjo', portions: 60, pay: 900000, due: 6, prep: 41, lembur: false, state: 'gagal', dp: 270000, day: 3 });
    s.regulars.dimas = { step: 2, aff: 47, next: 30, state: 'jalan' };
    s.regulars.slamet = { step: 4, aff: 66, next: 30, state: 'good' };
    s.regulars.ningsih = { step: 1, aff: 12, next: 30, state: 'jalan' };
    s.perks = ['kuli'];
    s.followers = 1840;
    const P = (kind, user, text, replied) => { s.posts.push({ id: ++s.postSeq, day: s.absDay - 1, user, text, kind, likes: Math.round(20 + Math.random() * 900), replied }); };
    P('good', '@anakkos.hemat', 'Warteg ini underrated parah, lauknya enak semua!');
    P('komplain', '@cewe.pedes', 'Nunggu lama, pas giliranku lauknya habis. Zonk.', 'Admin minta maaf, netizen puas');
    P('viral', '@kulinerjalan_id', 'POV: nemu warteg enak + murah di pasar #WartegViral');
    P('mid', '@mas.kantoran', 'Lumayan lah, tapi antrenya bikin pegel.');
    s.sinks = { kampung: 2, bola: 1 };
    w.scene.setSpeed(1);
  });
}
const closeAll = (h) => h.closeModals();

for (const [w, hh] of sizes) {
  const tag = `${w}x${hh}`;
  const { browser, page, errors, csp } = await launch(w, hh, w < 600 ? 2 : 1);
  const h = helpers(page, out);
  await openGame(page, `http://localhost:${port}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await h.click('title_main_baru'); await h.click('title_mulai', 1200); await h.click('welcome_skip', 300);
  await setup(h);
  await h.ev(() => { const sc = window.__warteg.scene; sc.spawnFig('pengamen'); sc.spawnFig('parkir'); });
  await page.waitForTimeout(5500);
  if (want('room')) await h.shot(`v13-room-rain-${tag}.png`);
  await h.ev(() => { const w = window.__warteg; w.sim.s.weather = 'panas'; });
  await page.waitForTimeout(1200);
  if (want('room')) await h.shot(`v13-room-hot-${tag}.png`);
  await h.ev(() => { window.__warteg.scene.setSpeed(0); });
  const dlg = async (name, fn, arg) => { if (!want(name)) return; await h.ev(fn, arg); await page.waitForTimeout(450); await h.shot(`v13-${name}-${tag}.png`); await closeAll(h); await page.waitForTimeout(150); };
  for (const t of [0, 1, 2, 3]) await dlg(`kampung${t}`, (t) => window.__warteg.screens2.openKampung(window.__warteg.scene, t), t);
  await dlg('kucing', () => window.__warteg.screens2.openKucing(window.__warteg.scene));
  await dlg('radio', () => window.__warteg.screens2.openRadio(window.__warteg.scene));
  await dlg('dapurseru', () => window.__warteg.screens2.openDapurSeru(window.__warteg.scene));
  await dlg('belanja', () => window.__warteg.screens.openBelanja(window.__warteg.scene));
  await dlg('regular', () => { const sim = window.__warteg.sim; sim.s.regulars.dimas = { step: 2, aff: 47, next: 0, state: 'jalan' }; const R = { id: 'regular', title: 'DIMAS', text: 'Mahasiswa tukang kasbon · cerita 3/4\n"Skripsiku tentang UMKM warteg. Boleh wawancara Juragan sejam aja?"', choices: [{ label: 'Boleh banget!', act: '0' }, { label: 'Lagi sibuk, lain kali', act: '1' }], data: { rid: 'dimas', step: 2, face: 'mhs_f' } }; sim.queueChoice(R); });
  await h.ev(() => { const sim = window.__warteg.sim; sim.pending = []; });
  await dlg('katering', () => { const sim = window.__warteg.sim; sim.s.katering = sim.s.katering.filter((k) => k.state !== 'aktif'); window.__wartegKat = true; const ok = window.__warteg.sim.queueChoice({ id: 'katering', title: 'PESANAN KATERING', text: 'PT Maju Sentosa Abadi pesan rapat kantor: 120 porsi, diantar 3 hari lagi.\nBayar Rp 2,8 jt (DP 30% sekarang). Bahan ~Rp 790 rb.\nDapur butuh ~50 tenaga/hari (jatah katering 96).', choices: [{ label: 'Terima!', act: 'terima', hint: 'Untung gede' }, { label: 'Terima + lembur', act: 'lembur', hint: 'Dapur ngebut, staf capek' }, { label: 'Tolak halus', act: 'tolak' }], data: { kind: 'kantor', portions: 120, pay: 2800000, due: 17, client: 'PT Maju Sentosa Abadi' } }); return ok; });
  await h.ev(() => { window.__warteg.sim.pending = []; });
  await dlg('kucingevent', () => window.__warteg.sim.queueChoice({ id: 'kucing', title: 'ADA KUCING!', text: 'Kucing oren kurus nongkrong di depan warung, ngeliatin etalase sambil meong-meong.', choices: [{ label: 'Adopsi! Namanya Mbul', act: 'adopsi', hint: 'Lucu, tapi kadang nakal' }, { label: 'Usir pelan-pelan', act: 'usir' }], data: { face: 'cat_sit' } }));
  await h.ev(() => { window.__warteg.sim.pending = []; });
  await dlg('masak-ramadan', () => { const w = window.__warteg; const s = w.sim.s; const d = w.sim.date; const rm = ((9 - (d.year - 1)) - 1) % 12 + 1; s.absDay = (rm - 1) * 28 + 3; w.screens.openMasak(w.scene); });
  await h.ev(() => { window.__warteg.sim.s.absDay = 14; });
  // minigames, mid play
  for (const g of ['sambal', 'tempe', 'piring']) {
    if (!want('mini-' + g)) continue;
    await h.ev((g) => { const s = window.__warteg.sim.s; s.mini.done = []; }, g);
    await h.ev((g) => window.__warteg.screens2.openDapurSeru(window.__warteg.scene), g);
    await page.waitForTimeout(300);
    await h.click('mini_' + g, 400);
    await h.click('mini_area', 100);
    for (let i = 0; i < 6; i++) { await page.keyboard.press(' '); await page.waitForTimeout(260); }
    await page.waitForTimeout(1200);
    await h.shot(`v13-mini-${g}-${tag}.png`);
    await closeAll(h);
  }
  // gerobak with mangkal
  if (want('gerobak')) {
    await h.ev(() => { const w = window.__warteg; w.sim.s.stage = 1; w.sim.s.staff = w.sim.s.staff.slice(0, 2); w.sim.s.weather = 'normal'; w.scene.buildWorld(); w.screens.openWarung(w.scene); });
    await page.waitForTimeout(600);
    await h.shot(`v13-gerobak-warung-${tag}.png`);
    await closeAll(h);
    await h.ev(() => { window.__warteg.scene.setSpeed(1); window.__warteg.sim.emit({ type: 'visitor', kind: 'satpol' }); });
    await page.waitForTimeout(4000);
    await h.shot(`v13-gerobak-${tag}.png`);
    await h.ev(() => { const w = window.__warteg; w.sim.s.stage = 3; w.scene.buildWorld(); w.scene.setSpeed(0); });
  }
  if (w < 600 && want('dock')) { await h.ev(() => { const sc = window.__warteg.scene; sc.dockTab = 4; sc.refreshDock(true); }); await page.waitForTimeout(300); await h.shot(`v13-dock-kabar-${tag}.png`); }
  if (want('hint')) { await h.ev(() => { const w = window.__warteg; w.sim.s.flags.hint_investasi = 0; w.tut.queueHint('investasi'); }); await page.waitForTimeout(800); await h.shot(`v13-hint-${tag}.png`); await h.tryClick('hintOk', 200); }
  if (want('ending')) {
    await h.ev(() => { const w = window.__warteg; const s = w.sim.s; s.stats2.thrFull = 3; s.stats2.regGood = 4; s.sinks = { kampung: 5, beasiswa: 4, bola: 2 }; w.screens.showEnding(w.scene); });
    await page.waitForTimeout(600); await h.shot(`v13-ending-${tag}.png`); await closeAll(h);
  }
  console.log(`${tag}: errors ${errors.length} csp ${csp.length}`, errors.slice(0, 4).join(' | '));
  totalErr += errors.length; totalCsp += csp.length;
  await browser.close();
}
console.log(`TOTAL errors ${totalErr} csp ${totalCsp}`);
server.close();
process.exit(totalErr || totalCsp ? 1 : 0);
