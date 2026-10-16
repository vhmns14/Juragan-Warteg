// v1.4 dialogs: the national franchise map (own brand, outlets in other cities, mall + bandara), brand naming, manajer
// posting, prasmanan + stage info helpers. All names fictional.
import type { GameScene } from './scenes/Game';
import { COL, ROUND, DISPLAY, GW, WIDE } from './ui';
import { LOC, STAGES } from './data';
import { fmtShort } from './state';
import type { Staff } from './state';
import { CITIES, CITY, OUTLETS, OUTLET, BRAND_IDEAS, NATIONAL, ROYALTY, ROOM_UPKEEP, type OutletKind } from './data3';
import { outletCheck, outletCost, openOutlet, renovOutlet, outletRenovCost, closeOutlet, brandRating, brandName, nationalReach, outletUpkeep, assignStaff, managerAt, setBrand } from './sim3';
import { domPanel } from './backup';
import { sfx } from './audio';
import { layoutFor } from './layout';

const T = COL.text;
const R = { font: ROUND, weight: '800' } as const;
const R6 = { font: ROUND, weight: '600' } as const;
const err = (gs: GameScene, e: string | null) => { if (e) { gs.toast(e); sfx.bad(); return true; } sfx.coin(); return false; };

// archipelago (fictional) on a 560 x 300 map
const ISLANDS: [number, number][][] = [
  [[30, 40], [70, 30], [118, 58], [150, 100], [168, 138], [150, 150], [118, 128], [86, 104], [52, 80], [28, 58]],
  [[120, 160], [170, 156], [230, 166], [300, 172], [360, 182], [410, 196], [404, 212], [350, 214], [280, 206], [210, 204], [150, 196], [116, 180]],
  [[214, 50], [252, 26], [312, 22], [352, 44], [358, 92], [336, 128], [290, 140], [246, 128], [222, 100], [210, 72]],
  [[420, 92], [446, 86], [452, 120], [478, 112], [490, 124], [462, 140], [470, 176], [452, 198], [440, 172], [428, 150], [434, 120]],
  [[496, 150], [530, 138], [556, 150], [556, 222], [520, 230], [500, 200], [490, 172]],
  [[418, 214], [436, 210], [440, 222], [420, 226]], [[448, 220], [470, 216], [474, 228], [452, 232]], [[390, 120], [404, 116], [408, 128], [392, 132]],
  [[178, 120], [190, 116], [194, 128], [180, 132]],
];
const KIND_COL: Record<OutletKind, number> = { kota: 0x2e8b3a, mall: 0x8a3ab0, bandara: 0x2a6ad0 };

export function openNasional(gs: GameScene, sel = '') {
  const sim = gs.sim, s = gs.s;
  const w = Math.min(GW - 12, WIDE ? 700 : 340);
  const mapW = w - 20, mapH = Math.round(mapW * 300 / 560);
  const city = CITY[sel] ?? null;
  const outs = city ? s.outlets.filter((o) => o.city === city.id) : [];
  const h = 92 + mapH + (city ? 150 + outs.length * 34 : 120);
  const m = gs.modal({ w, h, title: 'PETA NASIONAL', closable: true });
  m.build((mm) => {
    const reach = nationalReach(sim);
    mm.text(14, 26, s.franchise ? `${brandName(sim)} · rating brand ${brandRating(sim).toFixed(1)}★ · ${reach.outlets}/${NATIONAL.maxOutlets} outlet · ${reach.cities} kota` : 'Franchise belum dibuka: butuh Warteg Besar, 4 cabang, rating 4,1★.', 10, T, { wrap: w - 28, ...R });
    mm.text(14, 42, s.franchise ? `Royalti minggu lalu ${fmtShort(s.outlets.reduce((a, o) => a + o.lastWeek, 0))} · pendampingan ${fmtShort(outletUpkeep(sim))}/bln` : 'Brand-mu sendiri, outlet di kota lain, mall & bandara menunggu!', 9, COL.muted, R6);
    const top = 58;
    const sc = mapW / 560;
    const g = gs.add.graphics();
    g.fillStyle(0x3a7ab8, 1); g.fillRect(10, top, mapW, mapH);
    // waves
    g.fillStyle(0x4a8ac8, 1);
    for (let y = 8; y < 300; y += 22) for (let x = (y * 7) % 40; x < 560; x += 46) g.fillRect(10 + x * sc, top + y * sc, 8 * sc, 1.2);
    for (const isl of ISLANDS) {
      const pts = isl.map(([x, y]) => ({ x: 10 + x * sc, y: top + y * sc }));
      g.fillStyle(0xe8d8a0, 1); g.fillPoints(pts.map((p) => ({ x: p.x, y: p.y + 1.5 })) as never, true);
      g.fillStyle(0x6aa84a, 1); g.fillPoints(pts as never, true);
      g.lineStyle(1, 0x3a6a2a, 1); g.strokePoints(pts as never, true);
    }
    // mountains / forest dots
    g.fillStyle(0x4a8a3a, 1);
    for (const [x, y] of [[90, 80], [270, 70], [300, 100], [460, 150], [530, 180], [250, 190], [330, 194]]) { g.fillTriangle(10 + x * sc, top + (y - 6) * sc, 10 + (x - 6) * sc, top + (y + 3) * sc, 10 + (x + 6) * sc, top + (y + 3) * sc); }
    g.lineStyle(2, 0x2b1a10, 1); g.strokeRect(10, top, mapW, mapH);
    mm.add(g);
    for (const C of CITIES) {
      const px = 10 + C.px * sc, py = top + C.py * sc;
      const here = s.outlets.filter((o) => o.city === C.id);
      const home = C.id === 'home';
      const pg = gs.add.graphics();
      pg.fillStyle(0x2b1a10, 1); pg.fillCircle(px, py - 8, 7); pg.fillTriangle(px - 5, py - 5, px + 5, py - 5, px, py + 3);
      pg.fillStyle(home ? 0xe8701a : here.length ? 0x2e8b3a : 0xf6c440, 1); pg.fillCircle(px, py - 8, 5);
      if (sel === C.id) { pg.lineStyle(2, 0xffffff, 1); pg.strokeCircle(px, py - 8, 9); }
      here.forEach((o, i) => { pg.fillStyle(0x2b1a10, 1); pg.fillRect(px + 7 + i * 7, py - 14, 6, 6); pg.fillStyle(KIND_COL[o.kind], 1); pg.fillRect(px + 8 + i * 7, py - 13, 4, 4); });
      mm.add(pg);
      // labels above the pin for the cities that sit close together on the big island
      const up = C.id === 'home';
      mm.text(px, up ? py - 28 : py + 3, home ? `★ ${C.name}` : C.name, 8, home ? '#ffd890' : '#ffffff', { ox: 0.5, font: ROUND, weight: '800', stroke: '#2b1a10', strokeW: 3 });
      const z = gs.add.zone(px - 18, py - 20, 36, 34).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setName('city_' + C.id);
      z.on('pointerup', () => { mm.close(); openNasional(gs, C.id); });
      mm.add(z);
    }
    // legend
    const lg = gs.add.graphics();
    (['kota', 'mall', 'bandara'] as OutletKind[]).forEach((k, i) => { lg.fillStyle(0x2b1a10, 1); lg.fillRect(16 + i * 70, top + mapH - 14, 8, 8); lg.fillStyle(KIND_COL[k], 1); lg.fillRect(17 + i * 70, top + mapH - 13, 6, 6); });
    mm.add(lg);
    (['kota', 'mall', 'bandara'] as OutletKind[]).forEach((k, i) => mm.text(28 + i * 70, top + mapH - 16, OUTLET[k].short, 8, '#ffffff', { font: ROUND, weight: '800', stroke: '#2b1a10', strokeW: 3 }));
    mm.btn(w - 92, top + 4, 78, 22, '‹ Peta Kota', () => { mm.close(); gs.openPetaKota(); }, { size: 9 }).setName('peta_kota');
    let y = top + mapH + 8;
    if (!city) {
      mm.panel(10, y, w - 20, 104, 'paper');
      const raja = `Menuju "Raja Warteg Nasional": outlet di ${reach.cities}/5 kota · ${reach.mall ? 'mall ✓' : 'mall ✗'} · ${reach.bandara ? 'bandara ✓' : 'bandara ✗'} · ${s.stage >= 6 ? 'Restoran Besar ✓' : 'Restoran Besar ✗'}`;
      mm.text(20, y + 6, 'Ketuk kota buat buka outlet.', 11, T, R);
      mm.text(20, y + 24, `Outlet kota = mitra di ruko (Warteg Besar). Outlet mall butuh Rumah Makan, outlet bandara butuh Restoran Besar. Royalti ${Math.round(ROYALTY * 100)}% tiap minggu, pendampingan tiap bulan. Manajer bikin outlet lebih laris.`, 9, COL.muted, { wrap: w - 40, ...R6 });
      mm.text(20, y + 80, raja, 9, '#7a3a10', { wrap: w - 40, ...R });
      return;
    }
    mm.panel(10, y, w - 20, 140 + outs.length * 34, 'paper');
    mm.text(20, y + 6, city.name, 12, T, R);
    mm.text(20, y + 22, `${city.desc} · ramai x${city.pop.toFixed(1)}${city.mall ? ' · ada mall' : ''}${city.bandara ? ' · ada bandara' : ''}`, 9, COL.muted, { wrap: w - 40, ...R6 });
    let yy = y + 50;
    for (const o of outs) {
      const D = OUTLET[o.kind];
      const mgr = managerAt(sim, 'out:' + o.id);
      mm.text(20, yy, `${D.short} Lv${o.lv} · ${o.rating.toFixed(1)}★ · royalti ${fmtShort(o.lastWeek)}/mg${mgr ? ' · manajer ' + mgr.name : ''}`, 9, T, { wrap: w - 160, ...R });
      mm.btn(w - 142, yy - 4, 70, 22, o.lv >= 3 ? 'Maks' : `+Lv ${fmtShort(outletRenovCost(sim, o))}`, () => { if (!err(gs, renovOutlet(sim, o.id))) { gs.toast('Outlet direnovasi!'); mm.close(); openNasional(gs, city.id); } }, { kind: 'green', size: 8, disabled: o.lv >= 3 }).setName('out_renov_' + o.id);
      mm.btn(w - 68, yy - 4, 50, 22, 'Tutup', () => { const back = closeOutlet(sim, o.id); gs.toast(`Outlet ditutup. Balik ${fmtShort(back)}.`); mm.close(); openNasional(gs, city.id); }, { kind: 'red', size: 8 }).setName('out_close_' + o.id);
      yy += 34;
    }
    if (city.id === 'home') { mm.text(20, yy + 6, 'Di kota asal pakai cabang biasa (Peta Kota). Outlet mall bisa dibuka di sini.', 9, '#7a3a10', { wrap: w - 40, ...R6 }); yy += 30; }
    const bw = (w - 48) / 3;
    OUTLETS.forEach((D, i) => {
      const e = outletCheck(sim, city.id, D.id);
      mm.btn(20 + i * (bw + 4), yy, bw, 40, `${D.short}\n${fmtShort(outletCost(sim, D.id))}`, () => { if (!err(gs, openOutlet(sim, city.id, D.id))) { sfx.fanfare(); gs.toast(`${D.name} ${brandName(sim)} di ${city.name} buka!`); mm.close(); openNasional(gs, city.id); } }, { kind: e ? 'disabled' : 'primary', size: 9 }).setName(`open_${D.id}_${city.id}`);
      if (e) mm.text(20 + i * (bw + 4) + bw / 2, yy + 44, e, 7, COL.red, { ox: 0.5, wrap: bw, align: 'center', ...R6 });
    });
  });
}

/** brand naming when the franchise starts (DOM text box; ideas + a dice button) */
export function promptBrand(gs: GameScene, then: (name: string) => void) {
  const idea = () => BRAND_IDEAS[Math.floor(Math.random() * BRAND_IDEAS.length)];
  const p = domPanel({
    title: 'NAMA BRAND', text: 'Franchise nasional butuh nama brand sendiri. Ketik nama brand-mu (3-32 huruf):',
    input: true,
    buttons: [
      { label: 'Acak', id: 'brand-acak', fn: (pp) => { if (pp.area) pp.area.value = idea(); } },
      { label: 'Batal', id: 'brand-batal', fn: (pp) => pp.close() },
      { label: 'Resmikan!', id: 'brand-ok', primary: true, fn: (pp) => {
        const v = (pp.area?.value ?? '').replace(/\s+/g, ' ').trim();
        if (v.length < 3) { pp.setMsg('Minimal 3 huruf ya.', true); return; }
        pp.close(); then(v.slice(0, 32));
      } },
    ],
  });
  if (p.area) { p.area.value = gs.s.brand || gs.s.name; p.area.placeholder = 'contoh: ' + idea(); p.area.style.height = '44px'; p.area.style.font = '15px "Baloo 2",sans-serif'; p.area.maxLength = 32; }
}
/** start the franchise: name the brand first */
export function startFranchiseFlow(gs: GameScene, done: () => void) {
  const e = gs.sim.franchiseCheck();
  if (e) { err(gs, e); return; }
  promptBrand(gs, (name) => {
    const r = gs.sim.startFranchise(name);
    if (!err(gs, r)) { sfx.fanfare(); gs.toast(`Brand "${name}" resmi! Buka outlet di Peta > Nasional.`); done(); }
  });
}
/** rename the brand later (free) */
export function renameBrand(gs: GameScene, done: () => void) { promptBrand(gs, (name) => { if (!err(gs, setBrand(gs.sim, name))) { gs.buildWorld(); done(); } }); }

/** post a manajer: list of cabang + outlets */
export function openAssign(gs: GameScene, st: Staff, back: () => void) {
  const sim = gs.sim, s = gs.s;
  const targets: { id: string; label: string }[] = [
    ...s.cabang.map((c) => ({ id: 'cab:' + c.loc, label: `Cabang ${LOC[c.loc].short} (Lv${c.lv})` })),
    ...s.outlets.map((o) => ({ id: 'out:' + o.id, label: `${OUTLET[o.kind].short} ${CITY[o.city].name}` })),
  ];
  const m = gs.modal({ w: Math.min(GW - 12, 340), h: 110 + (targets.length + 1) * 32, title: 'TEMPATKAN MANAJER', closable: true });
  m.build((mm) => {
    mm.text(mm.w / 2, 26, `${st.name}: laba mingguan tempatnya naik ~${Math.round((1.22 + st.level * 0.025 + st.skill / 600 - 1) * 100)}%`, 10, T, { ox: 0.5, wrap: mm.w - 24, align: 'center', ...R6 });
    let y = 52;
    const opt = (id: string | null, label: string) => {
      const taken = id ? s.staff.find((x) => x !== st && x.assign === id) : null;
      mm.btn(12, y, mm.w - 24, 28, `${label}${taken ? ` (ada ${taken.name})` : ''}`, () => { if (!err(gs, assignStaff(sim, st, id))) { gs.toast(id ? `${st.name} ditempatkan!` : `${st.name} kembali ke warung utama.`); mm.close(); back(); } }, { kind: (st.assign ?? null) === id ? 'sel' : 'btn', size: 10, disabled: !!taken }).setName('assign_' + (id ?? 'home'));
      y += 32;
    };
    opt(null, 'Warung utama (staf lebih disiplin)');
    for (const t of targets) opt(t.id, t.label);
    if (!targets.length) mm.text(mm.w / 2, y + 6, 'Belum ada cabang / outlet.', 10, COL.muted, { ox: 0.5, ...R6 });
  });
}
/** one line about what the next renovation adds to the room */
export function growthLine(stage: number, inflation = 1) {
  const L = layoutFor(stage), st = STAGES[stage - 1];
  if (!st) return '';
  const extra = stage === 5 ? ' + prasmanan, pelayan antar ke meja' : stage === 6 ? ' + lantai 2, Ruang VIP, parkiran' : '';
  return `Ruang ${L.A > 0 ? Math.round((L.A * L.Bm) / (204 * 191) * 10) / 10 : 1}x luas · ${L.tables.length + (stage >= 6 ? layoutFor(6, 2).tables.length : 0)} meja · etalase ${st.slots} lauk${extra}${ROOM_UPKEEP[stage - 1] ? ` · operasional +${fmtShort(ROOM_UPKEEP[stage - 1] * inflation)}/bln` : ''}`;
}
void DISPLAY;
