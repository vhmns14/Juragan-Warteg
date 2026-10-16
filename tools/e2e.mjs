// End-to-end playthrough in headless Chromium (real CSP headers from dist/_headers):
// title, tutorial, a full day loop, belanja, masak, rush, report, research, combo, cabang, events, backup export/import,
// achievements, ending, live resize. Screenshots -> <shots>. Exit code 1 on any failed check / console error / CSP hit.
//   node tools/e2e.mjs dist ../shots [single|preview]
import path from 'node:path';
import fs from 'node:fs';
import { launch, serve, helpers, openGame } from './lib.mjs';

const root = process.argv[2] ?? 'dist';
const shots = process.argv[3] ?? '../shots';
const mode = process.argv[4] ?? 'dist';
const W = Number(process.env.VW ?? 390), H = Number(process.env.VH ?? 844);
let server = null, url;
if (mode === 'single' || mode === 'preview') url = 'file://' + path.resolve(root, mode === 'single' ? 'juragan-warteg-single.html' : 'juragan-warteg-preview.html');
else { const sv = await serve(root); server = sv.server; url = `http://localhost:${sv.port}/`; }
const { browser, page, errors, csp } = await launch(W, H, 2);
const h = helpers(page, shots);
const fails = [];
const check = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };
const S = (fn, arg) => page.evaluate(fn, arg);
const pre = mode === 'dist' ? '' : mode + '-';

try {
  await openGame(page, url);
  await page.evaluate(() => { localStorage.clear(); window.__wartegNoDownload = true; });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await h.shot(pre + 'e2e-01-title.png');
  check(!!(await h.where('creditKK')), 'title shows "by KodeKecil"');
  await h.click('title_main_baru');
  await h.click('title_acak');
  await h.click('title_mulai', 1500);
  check((await h.scene()).includes('Game'), 'game scene started');
  await h.shot(pre + 'e2e-02-welcome.png');
  await h.click('welcome_go', 600);
  // tutorial step 1: MASAK
  check(await S(() => window.__warteg.sim.s.tut) === 1, 'tutorial step 1');
  check(await S(() => window.__warteg.sim.s.tick) === 0, 'clock held during tutorial step 1');
  await h.click('btn_masak', 600);
  await h.shot(pre + 'e2e-03-masak.png');
  const before = await S(() => window.__warteg.sim.s.menu.orek);
  await h.click('dish_orek_plus');
  check(await S(() => window.__warteg.sim.s.menu.orek) === before + 5, 'masak: + porsi works');
  await h.tryClick('add_kangkung');
  check(await S(() => (window.__warteg.sim.s.menu.kangkung ?? 0) > 0), 'masak: add lauk to etalase');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  check(await S(() => window.__warteg.sim.s.tut) === 2, 'tutorial step 2 after closing Masak');
  // belanja
  await h.click('btn_belanja', 600);
  const pantry0 = await S(() => window.__warteg.sim.s.pantry.beras);
  await h.click('buy10_beras');
  check(await S((p) => window.__warteg.sim.s.pantry.beras >= p + 9.9, pantry0), 'belanja: bought 10 kg beras');
  await h.shot(pre + 'e2e-04-belanja.png');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  check(await S(() => window.__warteg.sim.s.tut) === 3, 'tutorial step 3 (speed)');
  await h.click('speed2', 400);
  check(await S(() => window.__warteg.scene.speedIdx) === 2, 'speed 2x');
  // play real time a bit, then fast-forward to the lunch rush
  await page.waitForTimeout(2500);
  await S(() => { const w = window.__warteg; while (w.sim.s.tick < 25 && !w.sim.pending.length) w.sim.tick(); w.scene.refreshHud(true); });
  await page.waitForTimeout(2500);
  await h.shot(pre + 'e2e-05-rush.png');
  const tday = await S(() => window.__warteg.sim.s.today);
  check(tday.customers > 0 && tday.served > 0, `rush: customers ${tday.customers}, served ${tday.served}`);
  check(await S(() => window.__warteg.sim.s.tut) >= 4, 'tutorial advanced to the rush steps');
  // finish the day -> report
  await S(() => { const w = window.__warteg; let n = 0; while (w.sim.s.absDay < 1 && n++ < 200) { if (w.sim.pending.length) { const ev = w.sim.pending[0]; w.sim.resolve(ev, 0); } w.sim.tick(); } });
  await page.waitForTimeout(800);
  check(!!(await h.where('report_ok')), 'daily report shown');
  await h.shot(pre + 'e2e-06-report.png');
  await h.click('report_ok', 500);
  check(await S(() => window.__warteg.sim.s.tut) === 6, 'tutorial step 6 (riset)');
  check(await S(() => !!window.__warteg.sim.s.achievements.hari1), 'achievement "Buka Lapak" after day 1');
  // research via Menu
  await S(() => { window.__warteg.sim.s.poin = 200; });
  const rb = (await h.where('btn_riset')) ? 'btn_riset' : 'btn_menu';
  await h.click(rb, 500);
  if (rb === 'btn_menu') await h.click('menu_0', 500);
  check(await S(() => window.__warteg.sim.s.tut) === 99, 'tutorial finished on opening Riset');
  await h.click('riset_perkedel', 400);
  check(await S(() => window.__warteg.sim.s.research?.id) === 'perkedel', 'research started');
  await h.shot(pre + 'e2e-07-riset.png');
  await S(() => { const w = window.__warteg; for (let d = 0; d < 3; d++) { let n = 0; const day = w.sim.s.absDay; while (w.sim.s.absDay === day && n++ < 200) { if (w.sim.pending.length) w.sim.resolve(w.sim.pending[0], 0); w.sim.tick(); } } });
  check(await S(() => window.__warteg.sim.s.unlocked.includes('perkedel')), 'research finished -> perkedel unlocked');
  await h.closeModals();
  // combo
  await S(() => { const s = window.__warteg.sim.s; s.poin = 200; for (const d of ['telurbalado', 'orek', 'lodeh']) if (!s.unlocked.includes(d)) s.unlocked.push(d); });
  await S(() => window.__warteg.screens.openRiset(window.__warteg.scene, 2, ['telurbalado', 'orek', 'lodeh']));
  await page.waitForTimeout(300);
  await h.click('cb_try', 500);
  check(await S(() => window.__warteg.sim.s.combos.includes('kuli')), 'combo test found "Paket Kuli"');
  await h.shot(pre + 'e2e-08-combo.png');
  await h.click('combo_ok', 400);
  await h.closeModals();
  // staff: hire
  await S(() => { const w = window.__warteg; w.sim.s.money = 20e6; w.sim.weekStart(); });
  await h.click('btn_staf', 400);
  await h.click('tab_1', 400);
  const nStaff = await S(() => window.__warteg.sim.s.staff.length);
  await h.click('hire_pelayan', 400);
  check(await S((n) => window.__warteg.sim.s.staff.length === n + 1, nStaff), 'hired a pelayan');
  await h.shot(pre + 'e2e-09-staf.png');
  await h.closeModals();
  // promosi: join ojol
  await h.click('btn_promosi', 400);
  await h.click('tab_1', 400);
  await h.click('join_laparin', 400);
  check(await S(() => window.__warteg.sim.s.apps.laparin.joined), 'joined Lapar.in');
  await h.closeModals();
  // upgrade to warteg + decor
  await S(() => { const s = window.__warteg.sim.s; s.money = 300e6; s.fans = 3000; s.rasa = 80; s.bersih = 80; s.murah = 70; s.antrian = 80; s.suasana = 60; });
  await S(() => window.__warteg.screens.openWarung(window.__warteg.scene));
  await page.waitForTimeout(300);
  await h.click('upgrade_stage', 400);
  check(await S(() => window.__warteg.sim.s.stage) === 2, 'renovated to Warteg Kecil');
  await h.click('upgrade_stage', 400);
  check(await S(() => window.__warteg.sim.s.stage) === 3, 'renovated to Warteg');
  await h.click('decor_kipas', 300); await h.click('decor_tv', 300);
  check(await S(() => window.__warteg.sim.s.decor.includes('tv')), 'bought decor');
  await h.closeModals();
  await page.waitForTimeout(500);
  await h.shot(pre + 'e2e-10-warteg.png');
  // cabang via Peta
  await S(() => window.__warteg.screens.openPeta(window.__warteg.scene, 'kampus'));
  await page.waitForTimeout(400);
  await h.click('open_kampus', 500);
  check(await S(() => window.__warteg.sim.s.cabang.length) === 1, 'opened cabang Kampus');
  await h.shot(pre + 'e2e-11-peta.png');
  await h.closeModals();
  // events: vlogger, sidak-like info, perang harga, THR, mudik
  for (const id of ['vlog', 'perang', 'thr', 'mudik', 'katering']) {
    await S((id) => {
      const sim = window.__warteg.sim;
      const evs = {
        vlog: { id: 'vlog', title: 'FOOD VLOGGER DATANG!', text: 'Test vlogger', choices: [{ label: 'Gratisin', act: 'gratis' }, { label: 'Biasa', act: 'biasa' }] },
        perang: { id: 'perang', title: 'PERANG HARGA!', text: 'Test', choices: [{ label: 'Ikut', act: 'ikut' }, { label: 'Cuek', act: 'cuek' }], data: { rival: 'sebelah' } },
        thr: { id: 'thr', title: 'WAKTUNYA THR', text: 'Test THR', choices: [{ label: 'Bayar', act: 'full' }], data: { thr: 1000000 } },
        mudik: { id: 'mudik', title: 'MUDIK LEBARAN', text: 'Test mudik', choices: [{ label: 'Silakan', act: 'izin' }], data: { bonus: 100000, ids: String(sim.s.staff[0].id) } },
        katering: { id: 'katering', title: 'PESANAN KATERING', text: 'Test', choices: [{ label: 'Terima', act: 'terima' }, { label: 'Lembur', act: 'lembur' }, { label: 'Tolak', act: 'tolak' }], data: { kind: 'arisan', portions: 30, pay: 600000, due: sim.s.absDay + 2, client: 'Bu RT Uji' } },
      };
      sim.queueChoice(evs[id]);
    }, id);
    await page.waitForTimeout(400);
    if (id === 'vlog') await h.shot(pre + 'e2e-12-event.png');
    await h.click('choice_0', 400);
    await h.tryClick('choice_0', 400); // follow-up (viral info)
  }
  check(await S(() => window.__warteg.sim.s.effects.some((e) => e.id === 'perang')), 'event: price war effect applied');
  check(await S(() => window.__warteg.sim.s.staff[0].off === 7), 'event: staff went mudik');
  check(await S(() => window.__warteg.sim.pending.length) === 0, 'all events resolved');

  // ================================================================ v1.3 systems
  check(await S(() => window.__warteg.sim.s.katering.some((k) => k.client === 'Bu RT Uji')), 'v1.3 katering: accepted order is listed');
  await S(() => { window.__warteg.scene.setSpeed(0); window.__wartegMiniFast = true; });
  // weather: rain -> overlay + shelter customers + ojol
  await S(() => { const w = window.__warteg; w.sim.s.weather = 'hujan'; w.sim.s.flags.cooldown = w.sim.s.absDay + 50; for (let i = 0; i < 40 && !w.sim.pending.length; i++) w.sim.tick(); w.scene.setSpeed(1); });
  await page.waitForTimeout(700);
  check(await S(() => { let f = false; const walk = (l) => { for (const o of l) { if (o.name === 'weatherFx') f = true; if (o.list) walk(o.list); } }; walk(window.__warteg.scene.children.list); return f; }), 'v1.3 weather: rain overlay drawn');
  await h.shot(pre + 'e2e-16-hujan.png');
  await S(() => window.__warteg.scene.setSpeed(0));
  // katering: deliver on the due day
  await S(() => { const w = window.__warteg; const o = w.sim.s.katering.find((k) => k.client === 'Bu RT Uji'); o.due = w.sim.s.absDay + 1; let n = 0; const d = w.sim.s.absDay; while (w.sim.s.absDay < d + 2 && n++ < 400) { while (w.sim.pending.length) w.sim.resolve(w.sim.pending[0], 0); w.sim.tick(); } });
  check(await S(() => { const o = window.__warteg.sim.s.katering.find((k) => k.client === 'Bu RT Uji'); return !!o && o.state !== 'aktif'; }), 'v1.3 katering: order delivered / settled on the due day');
  await h.closeModals();
  // pelanggan langganan: a story step with a portrait
  await S(() => { const sim = window.__warteg.sim; sim.s.regulars = {}; sim.s.absDay = Math.max(sim.s.absDay, 7); let n = 0; while (!sim.pending.some((e) => e.id === 'regular') && n++ < 200) window.__warteg.systems.maybeRegular(sim); });
  await page.waitForTimeout(400);
  const regBefore = await S(() => { const ev = window.__warteg.sim.pending.find((e) => e.id === 'regular'); return ev ? { rid: ev.data.rid, step: ev.data.step } : null; });
  check(!!regBefore, 'v1.3 langganan: a regular dropped by');
  await h.shot(pre + 'e2e-17-langganan.png');
  await h.click('choice_0', 400);
  check(await S((r) => (window.__warteg.sim.s.regulars[r.rid]?.step ?? 0) === r.step + 1, regBefore), 'v1.3 langganan: the story advanced');
  await h.tryClick('choice_0', 300);
  // kucing: adopt, sprite in the room, feed
  await S(() => window.__warteg.sim.queueChoice({ id: 'kucing', title: 'ADA KUCING!', text: 'Test', choices: [{ label: 'Adopsi', act: 'adopsi' }, { label: 'Usir', act: 'usir' }], data: { face: 'cat_sit' } }));
  await page.waitForTimeout(300);
  await h.click('choice_0', 500);
  check(await S(() => window.__warteg.sim.s.cat.adopted), 'v1.3 kucing: adopted');
  await page.waitForTimeout(400);
  check(!!(await h.where('catSprite')), 'v1.3 kucing: cat sprite in the room');
  await S(() => { window.__warteg.sim.s.cat.fedDay = -1; window.__warteg.screens2.openKucing(window.__warteg.scene); });
  await page.waitForTimeout(300);
  await h.click('cat_feed', 300);
  check(await S(() => window.__warteg.sim.s.cat.fedDay === window.__warteg.sim.s.absDay), 'v1.3 kucing: fed');
  await h.closeModals();
  // figuran: tap the pengamen
  await S(() => { window.__warteg.sim.s.money = Math.max(window.__warteg.sim.s.money, 5e6); window.__warteg.scene.setSpeed(1); window.__warteg.scene.spawnFig('pengamen'); });
  await page.waitForTimeout(3500);
  await S(() => window.__warteg.scene.setSpeed(0));
  const tips0 = await S(() => window.__warteg.sim.s.stats2.tips);
  await S(() => { const sc = window.__warteg.scene; let f = null; const walk = (l) => { for (const o of l) { if (o.name === 'fig_pengamen') f = o; if (o.list) walk(o.list); } }; walk(sc.children.list); f?.emit('pointerup'); });
  await page.waitForTimeout(300);
  check(await S((t) => window.__warteg.sim.s.stats2.tips === t + 1, tips0), 'v1.3 figuran: tipped the pengamen');
  // gejolak harga
  await S(() => { const w = window.__warteg; w.sim.s.absDay = Math.max(w.sim.s.absDay, 20); w.sim.s.shocks = []; let n = 0; while (!w.sim.s.shocks.length && n++ < 200) w.systems.weeklyMarket(w.sim); });
  check(await S(() => window.__warteg.sim.s.shocks.length > 0 && window.__warteg.sim.s.news.some((x) => x.kind === 'shock')), 'v1.3 pasar: price shock + news');
  await S(() => window.__warteg.screens.openBelanja(window.__warteg.scene));
  await page.waitForTimeout(300);
  check(!!(await h.where('kabar_pasar')), 'v1.3 pasar: Kabar Pasar in Belanja');
  await S(() => { const w = window.__warteg; const cap = w.systems.gudangCap(w.sim); w.sim.s.money = 1e9; const e = w.sim.buy('beras', cap + 5); window.__capErr = e; });
  check(/Gudang penuh/.test(await S(() => window.__capErr)), 'v1.3 pasar: storage limit enforced');
  await h.closeModals();
  // netizen complaint
  await S(() => window.__warteg.sim.queueChoice({ id: 'komplain', title: 'KOMPLAIN NETIZEN!', text: 'Test', choices: [{ label: 'Maaf', act: 'maaf' }, { label: 'Voucher', act: 'voucher' }, { label: 'Abaikan', act: 'abaikan' }], data: { post: 0 } }));
  await page.waitForTimeout(300);
  await h.click('choice_1', 300);
  check(await S(() => window.__warteg.sim.s.stats2.komplainReplied >= 1), 'v1.3 medsos: complaint answered');
  // staff drama: cinlok
  await S(() => { const w = window.__warteg; const s = w.sim.s; while (s.staff.length < 2) { w.sim.weekStart(); w.sim.hire(s.candidates[0]); } s.staff[0].female = true; s.staff[1].female = false; s.staff[0].pair = undefined; s.staff[1].pair = undefined; w.sim.queueChoice({ id: 'cinlok', title: 'CINLOK DI DAPUR!', text: 'Test', choices: [{ label: 'Restui', act: 'restu' }, { label: 'Larang', act: 'larang' }], data: { a: s.staff[0].id, b: s.staff[1].id } }); });
  await page.waitForTimeout(300);
  await h.click('choice_0', 300);
  check(await S(() => window.__warteg.sim.s.staff[0].pair === window.__warteg.sim.s.staff[1].id), 'v1.3 drama staf: cinlok restu pairs them');
  // investasi
  await S(() => { window.__warteg.sim.s.money = 5e9; window.__warteg.screens2.openKampung(window.__warteg.scene, 3); });
  await page.waitForTimeout(300);
  await h.click('sink_kampung', 300);
  check(await S(() => (window.__warteg.sim.s.sinks.kampung ?? 0) >= 1), 'v1.3 investasi: renovasi kampung level 1');
  await h.shot(pre + 'e2e-18-investasi.png');
  await h.closeModals();
  for (const t of [0, 1, 2]) { await S((t) => window.__warteg.screens2.openKampung(window.__warteg.scene, t), t); await page.waitForTimeout(200); await h.closeModals(); }
  // minigame (fast mode in tests)
  await S(() => { window.__warteg.sim.s.mini.done = []; window.__warteg.screens2.openDapurSeru(window.__warteg.scene); });
  await page.waitForTimeout(300);
  await h.click('mini_piring', 400);
  await h.click('mini_area', 150);
  for (let i = 0; i < 6; i++) { await page.keyboard.press(' '); await page.waitForTimeout(120); }
  await page.waitForTimeout(2800);
  await h.shot(pre + 'e2e-19-minigame.png');
  await h.click('mini_done', 400);
  check(await S(() => window.__warteg.sim.s.effects.some((e) => e.id === 'm_piring') && window.__warteg.sim.s.stats2.miniPlays >= 1), 'v1.3 minigame: Atur Piring bonus applied');
  // radio
  await S(() => window.__warteg.screens2.openRadio(window.__warteg.scene));
  await page.waitForTimeout(300);
  await h.click('radio_berita', 300);
  check(await S(() => window.__warteg.sfx.radio === 'berita' && window.__warteg.sfx.musicTrack !== 'dangdut'), 'v1.3 radio: channel switched to berita');
  await h.click('radio_dangdut', 300);
  await h.closeModals();
  // gerobak: mangkal
  await S(() => { const w = window.__warteg; w.sim.s.stage = 1; w.scene.buildWorld(); w.screens.openWarung(w.scene); });
  await page.waitForTimeout(400);
  await h.click('mangkal_sekolah', 300);
  check(await S(() => window.__warteg.sim.s.mangkal === 'sekolah'), 'v1.3 gerobak: moved to the school');
  await h.closeModals();
  await S(() => { const w = window.__warteg; w.sim.s.stage = 3; w.scene.buildWorld(); });
  // Ramadan takjil
  await S(() => { const w = window.__warteg; const s = w.sim.s; const y = w.sim.date.year; const rm = ((9 - (y - 1)) - 1) % 12 + 1; s.absDay = (y - 1) * 336 + (rm - 1) * 28 + 2; s.tick = 0; s.menu.kolak = 40; s.menu.esbuah = 40; s.flags.cooldown = s.absDay + 30; let n = 0; const d = s.absDay; while (s.absDay === d && n++ < 300) { while (w.sim.pending.length) w.sim.resolve(w.sim.pending[0], 0); w.sim.tick(); } });
  check(await S(() => window.__warteg.sim.s.stats2.takjilSold > 0), 'v1.3 ramadan: takjil sold');
  await h.closeModals();
  // hints
  await S(() => { const w = window.__warteg; w.sim.s.flags.hint_investasi = 0; w.systems.hint(w.sim, 'investasi'); });
  await page.waitForTimeout(900);
  check(!!(await h.where('hintBubble')), 'v1.3 tutorial: contextual hint shown');
  await h.click('hintOk', 300);
  // branching ending
  check(await S(() => { const w = window.__warteg; const s = w.sim.s; s.sinks = { kampung: 6, beasiswa: 5, bola: 3 }; s.stats2.regGood = 4; s.stats2.thrFull = 5; for (const st of s.staff) st.loyalty = 95; s.totals.profit = 1e10; s.totals.maxStars = 4.3; s.history = Array.from({ length: 28 }, (_, i) => ({ day: i, profit: 1, customers: 1, stars: 4.0 })); s.money = 5e8; return w.sim.endingTitle().id === 'dermawan'; }), 'v1.3 ending: Juragan Dermawan reachable');
  check(await S(() => { const w = window.__warteg; const s = w.sim.s; s.stats2.thrSkip = 3; for (const st of s.staff) st.loyalty = 10; s.sinks = {}; s.stats2.regGood = 0; s.totals.profit = 2e10; s.stage = 4; s.cabang = Array.from({ length: 7 }, () => ({ loc: 'kampus', lv: 3, opened: 0, rating: 4, lastWeek: 0, total: 0 })); s.franchise = true; return w.sim.endingTitle().id === 'galak'; }), 'v1.3 ending: Bos Galak Kaya Raya when staff are mistreated');
  await S(() => { const s = window.__warteg.sim.s; s.stats2.thrSkip = 0; s.stage = 3; s.cabang = s.cabang.slice(0, 1); s.franchise = false; for (const st of s.staff) st.loyalty = 70; });
  // random events over a month of play
  await S(() => { const w = window.__warteg; for (let d = 0; d < 28; d++) { let n = 0; const day = w.sim.s.absDay; while (w.sim.s.absDay === day && n++ < 300) { while (w.sim.pending.length) w.sim.resolve(w.sim.pending[0], 0); w.sim.tick(); } } w.scene.closeAll(); });
  await page.waitForTimeout(500);
  await h.closeModals();
  check(await S(() => window.__warteg.sim.s.absDay) >= 30, 'played a month');
  // info + keuangan + ulasan + prestasi screens open
  for (const fn of ['openInfo', 'openKeuangan', 'openUlasan', 'openPrestasi', 'openMenu', 'openPromosi']) {
    await S((fn) => window.__warteg.screens[fn](window.__warteg.scene, fn === 'openPromosi' ? 2 : 1), fn);
    await page.waitForTimeout(250);
    if (fn === 'openPrestasi') await h.shot(pre + 'e2e-13-prestasi.png');
    if (fn === 'openInfo') await h.shot(pre + 'e2e-13b-info.png');
    await h.closeModals();
  }
  // backup export / import
  await S(() => window.__warteg.screens.openMenu(window.__warteg.scene));
  await page.waitForTimeout(300);
  await h.click('menu_7', 400);
  await h.click('bk_export', 500);
  const code = await page.evaluate(() => document.getElementById('warteg-code')?.value ?? '');
  check(code.startsWith('WARTEG:'), 'backup export code');
  await page.click('#warteg-close');
  await page.waitForTimeout(400);
  const money0 = await S(() => window.__warteg.sim.s.money);
  const day0 = await S(() => window.__warteg.sim.s.absDay);
  await S(() => { window.__warteg.sim.s.money = 1; });
  await h.click('bk_import', 400);
  await page.fill('#warteg-code', code);
  await page.click('#warteg-import');
  await page.waitForTimeout(500);
  await h.click('bk_confirm', 300);
  await S(() => window.__warteg.scene.setSpeed(0));
  const after = await S(() => ({ m: window.__warteg.sim.s.money, d: window.__warteg.sim.s.absDay }));
  check(after.d === day0 && Math.abs(after.m - money0) < Math.max(2e6, Math.abs(money0) * 0.2), `backup import restored the save (money ${after.m} vs ${money0})`);
  // bad backup
  await S(() => window.__warteg.screens.openMenu(window.__warteg.scene));
  await page.waitForTimeout(300);
  await h.click('menu_7', 400);
  await h.click('bk_import', 400);
  await page.fill('#warteg-code', 'WARTEG:!!!notbase64{"__proto__":1}');
  await page.click('#warteg-import');
  await page.waitForTimeout(300);
  const msg = await page.evaluate(() => document.getElementById('warteg-msg')?.textContent ?? '');
  check(/rusak|bukan/i.test(msg), 'bad backup rejected: ' + msg);
  await page.click('#warteg-cancel');
  await h.closeModals();
  // ================= v1.4: rooms grow per stage, Rumah Makan (prasmanan, pelayan), Restoran Besar (2 lantai, VIP, bus),
  // franchise nasional (brand, outlets, mall/bandara), new staff roles + manajer posting
  await S(() => { const w = window.__warteg, s = w.sim.s; for (const m of [...w.scene.modals]) m.close(); s.tut = 99; s.stage = 4; s.money = 3e9; s.fans = 40000; s.rasa = 98; s.bersih = 96; s.murah = 80; s.antrian = 95; s.suasana = 98; w.scene.buildWorld(); });
  {
    const sizes = [];
    for (let st = 1; st <= 6; st++) sizes.push(await S((st) => { const w = window.__warteg; const L = w.scene.layoutInfo(st); return L.A * L.Bm; }, st));
    check(sizes.slice(1).every((v, i) => v >= sizes[i]) && sizes[5] > sizes[1] * 3, `room floor grows every stage (${sizes.map((v) => Math.round(v / 1000)).join(' < ')})`);
  }
  // renovation 4 -> 5 through the Warung dialog
  await S(() => window.__warteg.scene.openScreen('openWarung'));
  await page.waitForTimeout(300);
  await h.click('upgrade_stage', 2600);
  await page.waitForFunction(() => !window.__warteg.scene.renovating, null, { timeout: 15000 }).catch(() => undefined);
  check(await S(() => window.__warteg.sim.s.stage) === 5, 'renovate Warteg Besar -> Rumah Makan');
  await h.closeModals();
  check(await S(() => { const L = window.__warteg.scene.layoutInfo(5); return window.__warteg.sim.slots() >= 28 && L.tables.length >= 6; }), 'Rumah Makan: 28 lauk slots + more tables');
  await S(() => window.__warteg.scene.openScreen('openMasak'));
  await page.waitForTimeout(300);
  await h.click('masak_prasmanan', 300);
  check(await S(() => window.__warteg.sim.s.prasmanan), 'prasmanan toggled on');
  await h.closeModals();
  // new roles: kepala dapur, kasir shift, manajer (hire from forced candidates), pelayan need
  await S(() => { const w = window.__warteg, s = w.sim.s; s.staff = s.staff.slice(0, 4); for (const role of ['kepala', 'shift', 'manajer', 'pelayan', 'pelayan']) { for (let k = 0; k < 30; k++) { const c = s.candidates.find((x) => x.role === role); if (c) { w.sim.hire(c); break; } w.sim.weekStart(); } } });
  check(await S(() => ['kepala', 'shift', 'manajer'].every((r) => window.__warteg.sim.s.staff.some((x) => x.role === r))), 'hired kepala dapur, kasir shift, manajer');
  check(await S(() => { const w = window.__warteg; return w.sim.cookCap() > 0 && w.sim.serveRate() > 0; }), 'cook capacity + serve rate with new roles');
  // bus rombongan
  await S(() => { const w = window.__warteg, s = w.sim.s; s.flags.busDay = s.absDay; s.flags.busN = 20; s.tick = 26; });
  const busBefore = await S(() => window.__warteg.sim.customers.length);
  await S(() => window.__warteg.scene.stepTicks(1));
  check(await S(() => window.__warteg.sim.customers.filter((c) => c.group).length) >= 15 || (await S(() => window.__warteg.sim.customers.length)) >= busBefore + 15, 'rombongan bus arrives as a group');
  await page.waitForTimeout(1500);
  await h.shot(pre + 'e2e-20-rumahmakan.png');
  // renovate 5 -> 6, both floors
  await S(() => { const s = window.__warteg.sim.s; s.fans = 60000; s.money = 5e9; s.rasa = 99; s.bersih = 99; s.antrian = 99; s.suasana = 99; s.murah = 90; window.__warteg.scene.openScreen('openWarung'); });
  await page.waitForTimeout(300);
  await h.click('upgrade_stage', 2600);
  check(await S(() => window.__warteg.sim.s.stage) === 6, 'renovate Rumah Makan -> Restoran Besar');
  await h.closeModals();
  // the renovation transition runs on the scene clock (slower than wall time on a loaded machine)
  await page.waitForFunction(() => !window.__warteg.scene.renovating, null, { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  check(!!(await h.where('floor_toggle')), 'Lantai toggle button shown at Restoran Besar');
  await h.click('floor_toggle', 1500);
  check(await S(() => window.__warteg.scene.floorView) === 2, 'switched to Lantai 2');
  await h.shot(pre + 'e2e-21-lantai2.png');
  await h.click('floor_toggle', 800);
  check(await S(() => window.__warteg.scene.floorView) === 1, 'back to Lantai 1');
  // franchise: name the brand in the DOM prompt, open outlets on the national map
  await S(() => { const w = window.__warteg, s = w.sim.s; s.franchise = false; s.brand = ''; s.outlets = []; if (s.cabang.length < 4) { const ids = w.locIds(); for (const id of ids) { if (s.cabang.length >= 4) break; if (id !== s.loc && !s.cabang.some((c) => c.loc === id)) s.cabang.push({ loc: id, lv: 1, opened: s.absDay, rating: 4, lastWeek: 0, total: 0 }); } } });
  await S(() => window.__warteg.scene.openScreen('openWarung'));
  await page.waitForTimeout(300);
  await h.click('franchise', 500);
  check(await page.$('#warteg-dom') !== null, 'brand name prompt opened');
  await page.fill('#warteg-code', 'Sederhana Rasa Bundo');
  await page.click('#brand-ok');
  await page.waitForTimeout(500);
  check(await S(() => { const s = window.__warteg.sim.s; return s.franchise && s.brand === 'Sederhana Rasa Bundo'; }), 'franchise started with own brand name');
  await h.closeModals();
  await S(() => window.__warteg.scene.openScreen('openNasional'));
  await page.waitForTimeout(400);
  await h.shot(pre + 'e2e-22-nasional.png');
  await h.click('city_teluk', 500);
  await h.click('open_bandara_teluk', 500);
  await h.click('city_kembang', 500);
  await h.click('open_kota_kembang', 500);
  check(await S(() => { const s = window.__warteg.sim.s; return s.outlets.some((o) => o.kind === 'bandara' && o.city === 'teluk') && s.outlets.some((o) => o.city === 'kembang'); }), 'opened bandara + kota outlets from the national map');
  await h.shot(pre + 'e2e-23-nasional-city.png');
  await h.closeModals();
  // manajer posting boosts the outlet
  check(await S(() => { const w = window.__warteg, s = w.sim.s; const m = s.staff.find((x) => x.role === 'manajer'); const o = s.outlets[0]; return !w.assignStaff(m, 'out:' + o.id) && m.assign === 'out:' + o.id; }), 'manajer posted at an outlet');
  check(await S(() => { const w = window.__warteg, s = w.sim.s; const m0 = s.money; w.sim.weekStart(); return s.outlets.every((o) => o.lastWeek > 0) && s.money !== m0; }), 'weekly royalties paid by outlets');
  // v2 save with the old automatic franchise migrates to real outlets
  check(await S(() => { const o = JSON.parse(JSON.stringify(window.__warteg.sim.s)); o.version = 2; o.stage = 4; o.franchise = true; o.flags.franchiseCount = 5; delete o.outlets; delete o.brand; delete o.outletSeq; delete o.prasmanan; const n = window.__warteg.normalizeSave(o); return !!n && n.version === 3 && n.outlets.length === 5 && n.brand === o.name; }), 'v1.3 save (franchiseCount) migrates to brand + outlets');
  await S(() => { const w = window.__warteg; w.scene.floorView = 1; w.scene.buildWorld(); });
  // achievements toast + ending
  await S(() => { const s = window.__warteg.sim.s; s.totals.customers = 1000; });
  await S(() => { const w = window.__warteg; const s = w.sim.s; s.absDay = 336 * 10 - 1; s.tick = 60; s.ended = false; let n = 0; while (s.absDay < 336 * 10 && n++ < 100) { while (w.sim.pending.length) w.sim.resolve(w.sim.pending[0], 0); w.sim.tick(); } });
  await page.waitForFunction(() => { const sc = window.__warteg.scene; let f = false; const walk = (l) => { for (const o of l) { if (o.name === 'ending_ok') f = true; if (o.list) walk(o.list); } }; walk(sc.children.list); return f; }, null, { timeout: 8000 }).catch(() => undefined);
  check(!!(await h.where('ending_ok')), 'year-10 ending recap shown');
  await h.shot(pre + 'e2e-14-ending.png');
  await h.click('ending_ok', 400);
  check(await S(() => window.__warteg.sim.s.ended), 'ended flag + free play');
  // resize
  for (const [w, hh, nm] of [[1280, 720, 'wide'], [1366, 600, 'short'], [390, 844, 'phone']]) {
    await page.setViewportSize({ width: w, height: hh });
    await page.waitForTimeout(900);
    await h.shot(pre + `e2e-15-resize-${nm}.png`);
  }
  check((await h.scene()).includes('Game'), 'still in game after resizes');
  // save survives reload
  // (the game always resumes at 1x, and the post-ending save sits at a month start, so the first tick after loading
  // charges the monthly costs: check a marker that no tick touches instead of the money)
  await S(() => { window.__warteg.scene.setSpeed(0); window.__warteg.sim.s.money = 4242; window.__warteg.sim.s.name = 'Warteg Uji Simpan'; });
  await S(() => { const w = window.__warteg; const o = JSON.parse(JSON.stringify(w.sim.s)); o.version = 1; for (const k of ['weather', 'katering', 'katSeq', 'regulars', 'perks', 'cat', 'news', 'shocks', 'posts', 'postSeq', 'followers', 'sinks', 'mini', 'mangkal', 'izinPKL', 'stats2']) delete o[k]; delete o.pantry.minyak; delete o.prices.minyak; delete o.priceHist.minyak; localStorage.setItem('juragan-warteg-save-v1', JSON.stringify(o)); });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  await h.click('title_lanjutkan', 1500);
  { const mm = await S(() => [window.__warteg?.sim.s.name, window.__warteg?.sim.s.absDay]); check(mm[0] === 'Warteg Uji Simpan' && mm[1] >= 3360, 'continue from localStorage save'); }
  check(await S(() => { const s = window.__warteg.sim.s; return s.version === 3 && !!s.cat && Array.isArray(s.katering) && !!s.stats2 && typeof s.pantry.minyak === 'number' && typeof s.prices.minyak === 'number' && s.followers >= 30; }), 'migration: old v1 save upgraded to v3');
  await S(() => { const w = window.__warteg; for (let i = 0; i < 70; i++) { while (w.sim.pending.length) w.sim.resolve(w.sim.pending[0], 0); w.sim.tick(); } });
  check(await S(() => window.__warteg.sim.s.absDay >= 3361), 'v1.3 migration: migrated save keeps playing');
} catch (e) {
  fails.push('exception: ' + e.message);
  console.log('EXCEPTION', e.stack);
  try { await h.shot(pre + 'e2e-error.png'); } catch { /* */ }
}
check(errors.length === 0, `console errors: ${errors.length}${errors.length ? '\n' + errors.slice(0, 8).join('\n') : ''}`);
check(csp.length === 0, `CSP violations: ${csp.length}${csp.length ? '\n' + csp.slice(0, 4).join('\n') : ''}`);
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL OK');
fs.writeFileSync(path.join(shots, pre + 'e2e-result.txt'), (fails.length ? fails.join('\n') : 'ALL OK') + `\nerrors ${errors.length} csp ${csp.length}\n`);
await browser.close();
server?.close();
process.exit(fails.length ? 1 : 0);
