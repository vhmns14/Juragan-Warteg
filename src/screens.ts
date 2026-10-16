// Every dialog: Menu, Masak, Staf, Belanja, Promosi, Info, Riset, Warung (dekor + renovasi), Peta & Cabang, Keuangan,
// Prestasi, Ulasan, events, daily report, ending, bankrupt, welcome.
import type { GameScene } from './scenes/Game';
import { Modal, COL, ROUND, DISPLAY, GW, GH, WIDE, txt, button, bar, drawPanel } from './ui';
import { DISH, DISHES, INGS, ROLES, TRAITS, DECORS, STAGES, LOCS, LOC, COMBOS, UPGRADES, PROMOS, OJOL_APPS, RIVALS, CUSTS, CUST, FRANCHISE, ENDINGS, type IngId } from './data';
import { fmtMoney, fmtShort, fmtNum, dateOf, saveGame, newGame, deleteSave, clock, DAY_TICKS, type Staff } from './state';
import type { ChoiceEvent, DayReport } from './sim';
import { ACHIEVEMENTS, ACH } from './achievements';
import { charFrame, charTex, iconFrame, dishTex } from './assets';
import { exportPanel, importPanel } from './backup';
import { sfx } from './audio';
import { openKampung, openKucing, openRadio, openDapurSeru, radioLabel, weatherLine, gudangLine } from './screens2';
import { MANGKAL } from './data2';
import { setMangkal, buyIzin, mangkalDef, katActive, welfare, dermawan, avgStars } from './systems';
import { ENDINGS2 } from './data2';
import { openNasional, startFranchiseFlow, renameBrand, openAssign, growthLine } from './screens3';
import { prasmananOn, setPrasmanan, pelayanNeed, brandName, nationalReach } from './sim3';
import { CITY, OUTLET } from './data3';

const T = COL.text;
const W = () => Math.min(GW - 12, 340);
const WW = () => Math.min(GW - 12, WIDE ? 420 : 340);
const R = { font: ROUND, weight: '800' } as const;
const R6 = { font: ROUND, weight: '600' } as const;
const err = (gs: GameScene, e: string | null) => { if (e) { gs.toast(e); sfx.bad(); return true; } sfx.coin(); return false; };

function tabs(m: Modal, labels: string[], cur: number, y: number, onSel: (i: number) => void) {
  const w = (m.w - 20) / labels.length;
  labels.forEach((l, i) => m.btn(10 + i * w, y, w - 4, 24, l, () => onSel(i), { kind: i === cur ? 'sel' : 'btn', size: 10 }).setName('tab_' + i));
}
function stepper(m: Modal, x: number, y: number, val: string, minus: () => void, plus: () => void, name = '') {
  m.btn(x, y, 22, 20, '-', minus, { size: 12, font: DISPLAY, sound: false }).setName(name + '_minus');
  m.text(x + 44, y + 10, val, 11, T, { ox: 0.5, oy: 0.5, ...R });
  m.btn(x + 66, y, 22, 20, '+', plus, { size: 12, font: DISPLAY, sound: false }).setName(name + '_plus');
}

// ================================================================ welcome / menu
export function showWelcome(gs: GameScene) {
  const m = gs.modal({ w: W(), h: 300, title: 'SELAMAT DATANG!' });
  m.build((mm) => {
    mm.img(mm.w / 2, 62, 'chars', 0.75).setFrame(charFrame('cookf_f'));
    mm.text(mm.w / 2, 104, `"Juragan! Gerobak ${gs.s.name} siap jualan di pinggir pasar."`, 12, T, { ox: 0.5, align: 'center', wrap: mm.w - 40, ...R });
    mm.text(mm.w / 2, 150, 'Modal Rp 6 juta, satu juru masak, satu gerobak.\nTarget: jadi Raja Warteg Nusantara dalam 10 tahun!', 11, COL.muted, { ox: 0.5, align: 'center', wrap: mm.w - 30, ...R6 });
    mm.btn(20, 220, mm.w - 40, 34, 'Ayo mulai (pakai tutorial)', () => { mm.close(); gs.s.tut = 1; gs.tut?.start(); }, { kind: 'primary', size: 13 }).setName('welcome_go');
    mm.btn(20, 260, mm.w - 40, 26, 'Lewati tutorial', () => { mm.close(); gs.s.tut = 99; }, { size: 11 }).setName('welcome_skip');
  });
}

export function openMenu(gs: GameScene) {
  const items: [string, () => void, string?][] = [
    ['Riset Resep & Combo', () => openRiset(gs)],
    ['Kampung: Katering, Langganan, Medsos', () => openKampung(gs)],
    ['Warung: Dekor & Renovasi', () => openWarung(gs)],
    ['Peta & Cabang', () => openPeta(gs)],
    ['Keuangan', () => openKeuangan(gs)],
    ['Prestasi', () => openPrestasi(gs)],
    ['Ulasan Pelanggan', () => openUlasan(gs)],
    ['Backup Save', () => openBackup(gs)],
    ['Pengaturan', () => openSettings(gs)],
    ...(gs.s.cat.adopted ? [[`Kucing: ${gs.s.cat.name}`, () => openKucing(gs)] as [string, () => void]] : []),
    ['Ulang Tutorial', () => { gs.closeAll(); gs.s.tut = 1; gs.tut?.start(); }],
    ['Tentang Game', () => openAbout(gs)],
    ['Simpan & ke Judul', () => { saveGame(gs.s); gs.scene.start('Title'); }, 'red'],
  ];
  const h = 54 + items.length * 34 + 22;
  const m = gs.modal({ w: W(), h, title: 'MENU', closable: true });
  m.build((mm) => {
    items.forEach(([l, fn, kind], i) => mm.btn(20, 30 + i * 34, mm.w - 40, 30, l, () => { if (l !== 'Ulang Tutorial' && l !== 'Simpan & ke Judul') mm.close(); fn(); }, { kind: kind === 'red' ? 'red' : 'btn', size: 12 }).setName('menu_' + i));
    mm.text(mm.w / 2, h - 18, 'Dibuat oleh KodeKecil · kodekecil.my.id', 9, '#b04a1a', { ox: 0.5, oy: 0.5, ...R });
  });
}
function openAbout(gs: GameScene) {
  const m = gs.modal({ w: W(), h: 260, title: 'TENTANG GAME', closable: true });
  m.build((mm) => {
    mm.text(mm.w / 2, 40, 'JURAGAN WARTEG', 16, '#e8701a', { ox: 0.5, font: DISPLAY, stroke: '#4a1e0a', strokeW: 3 });
    mm.text(mm.w / 2, 66, 'v1 · game tycoon warteg pixel ala Kairosoft', 11, T, { ox: 0.5, ...R6 });
    mm.text(mm.w / 2, 100, 'Semua nama warung, aplikasi ojol, saingan,\ndan tokoh di game ini fiktif.', 10, COL.muted, { ox: 0.5, align: 'center', ...R6 });
    mm.text(mm.w / 2, 150, 'Dibuat oleh KodeKecil', 14, '#b04a1a', { ox: 0.5, ...R });
    mm.text(mm.w / 2, 172, 'kodekecil.my.id', 12, T, { ox: 0.5, ...R6 });
    mm.btn(mm.w / 2 - 60, 210, 120, 30, 'Oke', () => mm.close(), { kind: 'primary' });
  });
}
function openSettings(gs: GameScene) {
  const m = gs.modal({ w: W(), h: 268, title: 'PENGATURAN', closable: true });
  m.build((mm) => {
    mm.btn(20, 34, mm.w - 40, 30, 'Suara: ' + (sfx.muted ? 'MATI' : 'NYALA'), () => { sfx.setMuted(!sfx.muted); mm.rebuild(); });
    mm.btn(20, 72, mm.w - 40, 30, 'Musik radio: ' + (sfx.musicOn ? 'NYALA' : 'MATI'), () => { sfx.setMusic(!sfx.musicOn); mm.rebuild(); });
    mm.btn(20, 110, mm.w - 40, 30, 'Channel radio: ' + radioLabel(sfx.radio), () => { mm.close(); openRadio(gs); }).setName('set_radio');
    const modes = ['Ringkas', 'Selalu lengkap', 'Lengkap tiap minggu'];
    mm.btn(20, 148, mm.w - 40, 30, 'Laporan harian: ' + modes[gs.reportFull] , () => { gs.reportFull = (gs.reportFull + 1) % 3; try { localStorage.setItem('warteg-report', String(gs.reportFull)); } catch { /* */ } mm.rebuild(); }).setName('set_report');
    mm.text(mm.w / 2, 198, 'Laporan ringkas muncul sebentar di bawah layar;\nketuk buat lihat lengkapnya.', 10, COL.muted, { ox: 0.5, align: 'center', ...R6 });
  });
}
function openBackup(gs: GameScene) {
  const m = gs.modal({ w: W(), h: 190, title: 'BACKUP SAVE', closable: true });
  m.build((mm) => {
    mm.text(mm.w / 2, 30, 'Simpan progres ke file / kode,\natau pulihkan dari backup.', 11, T, { ox: 0.5, align: 'center', ...R6 });
    mm.btn(20, 76, mm.w - 40, 34, 'Ekspor Backup', () => { saveGame(gs.s); exportPanel(gs.s); }, { kind: 'green', size: 13 }).setName('bk_export');
    mm.btn(20, 120, mm.w - 40, 34, 'Impor Backup', () => importPanel((st, summary) => {
      const c = gs.modal({ w: W(), h: 200, title: 'PULIHKAN SAVE?', closable: true });
      c.build((cc) => {
        cc.text(cc.w / 2, 30, summary, 12, T, { ox: 0.5, align: 'center', ...R });
        cc.text(cc.w / 2, 104, 'Progres sekarang bakal diganti.', 11, COL.red, { ox: 0.5, ...R6 });
        cc.btn(20, 140, cc.w - 40, 36, 'Ya, pulihkan', () => { saveGame(st); gs.scene.restart({ state: st }); }, { kind: 'primary' }).setName('bk_confirm');
      });
    }), { size: 13 }).setName('bk_import');
  });
}

// ================================================================ masak
export function openMasak(gs: GameScene) {
  const sim = gs.sim, s = gs.s;
  const list = DISHES.filter((d) => s.unlocked.includes(d.id) || (d.unlock === 'takjil' && sim.isRamadan()));
  const rowH = 30;
  const pras = s.stage >= 5;
  const h = 150 + list.length * rowH + 130 + (pras ? 40 : 0);
  const m = gs.modal({ w: WW(), h, title: 'MASAK', closable: true });
  m.build((mm) => {
    const w = mm.w;
    const active = sim.activeMenu();
    const eff = sim.effortOf(Object.fromEntries(active.map((id) => [id, s.menu[id]])), s.nasiPorsi);
    const cap = sim.cookCap();
    mm.text(14, 26, `Rencana masak tiap pagi · Etalase ${active.length}/${sim.slots()} lauk`, 11, T, R);
    const kat = katActive(sim).length ? ` · katering ${Math.round(sim.katUsed)}` : '';
    mm.text(14, 42, `Dapur: ${Math.round(eff)}/${Math.round(cap - sim.katUsed)} tenaga masak${kat}${eff > cap - sim.katUsed ? ' (kelebihan, porsi dipotong!)' : ''}`, 10, eff > cap - sim.katUsed ? COL.red : COL.muted, R6);
    mm.bar(14, 58, w - 28, 8, eff / Math.max(1, cap - sim.katUsed), eff > cap - sim.katUsed ? 0xd0402e : 0xf6a020);
    // nasi
    mm.panel(10, 72, w - 20, 34, 'sel');
    mm.img(28, 89, 'dishes', 0.38).setFrame(15);
    mm.text(44, 76, 'Nasi Putih', 11, T, R);
    mm.text(44, 90, `${fmtShort(sim.nasiPrice())} · stok ${s.nasi}`, 9, COL.muted, R6);
    stepper(mm, w - 104, 79, String(s.nasiPorsi), () => { s.nasiPorsi = Math.max(0, s.nasiPorsi - 10); mm.rebuild(); }, () => { s.nasiPorsi = Math.min(999, s.nasiPorsi + 10); mm.rebuild(); }, 'nasi');
    let y = 112;
    for (const d of list) {
      const on = (s.menu[d.id] ?? 0) > 0;
      const inSlots = active.includes(d.id);
      const takjil = d.unlock === 'takjil';
      mm.panel(10, y, w - 20, rowH - 2, on ? (inSlots ? 'paper' : 'disabled') : 'paper');
      mm.add(gs.add.image(28, y + 14, ...dishTex(d.icon)).setScale(0.36));
      mm.text(44, y + 3, d.name, 11, on ? T : COL.muted, R);
      const fav = CUSTS.filter((c) => d.tags.some((t) => c.likes.includes(t))).map((c) => c.name.split(' ')[0]).slice(0, 2).join(', ');
      mm.text(44, y + 16, `${fmtShort(sim.dishPrice(d))} · stok ${Math.round(sim.totalStock(d.id))}${WIDE ? ' · ' + fav : ''}`, 8, COL.muted, R6);
      if (on) stepper(mm, w - 104, y + 4, String(s.menu[d.id]), () => { sim.setMenu(d.id, (s.menu[d.id] ?? 0) - 5); mm.rebuild(); }, () => { sim.setMenu(d.id, (s.menu[d.id] ?? 0) + 5); mm.rebuild(); }, 'dish_' + d.id);
      else if (takjil) mm.btn(w - 104, y + 4, 88, 20, '+ Takjil', () => { sim.setMenu(d.id, 20); mm.rebuild(); }, { size: 10, kind: 'green' }).setName('add_' + d.id);
      else mm.btn(w - 104, y + 4, 88, 20, '+ Etalase', () => { if (active.filter((x) => DISH[x].unlock !== 'takjil').length >= sim.slots()) { gs.toast(`Etalase penuh (${sim.slots()} lauk). Upgrade warung buat nambah.`); return; } sim.setMenu(d.id, 20); mm.rebuild(); }, { size: 10, disabled: active.length >= sim.slots() }).setName('add_' + d.id);
      y += rowH;
    }
    y += 6;
    mm.btn(10, y, (w - 26) / 2, 28, 'Sisa: ' + (s.sisaPolicy === 'panas' ? 'Panasin besok' : 'Buang'), () => { s.sisaPolicy = s.sisaPolicy === 'panas' ? 'buang' : 'panas'; mm.rebuild(); }, { size: 10 }).setName('masak_sisa');
    const open = s.tick > 0 && s.tick < DAY_TICKS - 4;
    mm.btn(16 + (w - 26) / 2, y, (w - 26) / 2, 28, 'Masak Tambahan', () => extraCook(gs), { kind: 'green', size: 10, disabled: !open }).setName('masak_extra');
    mm.btn(10, y + 34, w - 20, 30, 'DAPUR SERU: minigame bonus kualitas', () => openDapurSeru(gs), { kind: 'gold', size: 10 }).setName('masak_mini');
    if (pras) {
      // v1.4 Rumah Makan+: self-service buffet line
      y += 40;
      const on = prasmananOn(sim);
      mm.btn(10, y + 34, w - 20, 30, on ? 'PRASMANAN: NYALA (ambil sendiri)' : 'PRASMANAN: mati (dilayani di etalase)', () => { err(gs, setPrasmanan(sim, !on)); mm.rebuild(); }, { kind: on ? 'green' : 'btn', size: 10 }).setName('masak_prasmanan');
    }
    mm.text(w / 2, y + 74, sim.isRamadan() ? 'Ramadan: takjil punya slot sendiri, laku pas ngabuburit & buka.' : 'Perubahan berlaku besok pagi. Lauk sisa dipanasin\nbikin Kebersihan & Rasa turun dikit.', 9, COL.muted, { ox: 0.5, align: 'center', wrap: w - 24, ...R6 });
  });
}
function extraCook(gs: GameScene) {
  const sim = gs.sim, s = gs.s;
  const ids = ['nasi', ...sim.activeMenu()];
  const m = gs.modal({ w: W(), h: 70 + Math.ceil(ids.length / 2) * 32 + 30, title: 'MASAK TAMBAHAN', closable: true });
  m.build((mm) => {
    const spare = Math.max(0, Math.round(sim.cookCap() - sim.usedCap));
    mm.text(mm.w / 2, 26, `Sisa tenaga dapur hari ini: ${spare}`, 11, T, { ox: 0.5, ...R });
    ids.forEach((id, i) => {
      const x = 10 + (i % 2) * ((mm.w - 20) / 2), y = 46 + Math.floor(i / 2) * 32;
      const name = id === 'nasi' ? 'Nasi +20' : `${DISH[id].name} +10`;
      mm.btn(x, y, (mm.w - 20) / 2 - 4, 28, name, () => { const e = sim.cookExtra(id, id === 'nasi' ? 20 : 10); if (!err(gs, e)) { gs.toast(`${id === 'nasi' ? 'Nasi' : DISH[id].name} tambahan mateng!`); mm.rebuild(); } }, { size: 10 });
    });
    void s;
  });
}

// ================================================================ staf
export function openStaff(gs: GameScene, tab = 0) {
  const s = gs.s, sim = gs.sim;
  const n = tab === 0 ? s.staff.length : s.candidates.length;
  const h = 96 + Math.max(1, n) * 56 + 30;
  const m = gs.modal({ w: WW(), h, title: 'STAF', closable: true });
  m.build((mm) => {
    const w = mm.w;
    tabs(mm, [`Staf (${s.staff.length}/${sim.stageInfo().staffMax})`, 'Rekrut'], tab, 24, (i) => { mm.close(); openStaff(gs, i); });
    const pn = pelayanNeed(sim), pl = s.staff.filter((x) => x.role === 'pelayan').length;
    mm.text(14, 54, tab === 0 ? `Gaji total ${fmtShort(sim.monthlySalaries())}/bln · Masak ${sim.cookCap()} · Layanan ${sim.serveRate().toFixed(1)}/15mnt${pn ? ` · pelayan ${pl}/${pn}` : ''}` : 'Kandidat baru tiap Senin. Ongkos rekrut = 1/2 gaji.', 9, pn && pl < pn ? COL.red : COL.muted, R6);
    let y = 70;
    const list = tab === 0 ? s.staff : s.candidates;
    if (!list.length) mm.text(w / 2, y + 20, tab === 0 ? 'Belum ada staf.' : 'Belum ada kandidat. Tunggu Senin depan.', 11, COL.muted, { ox: 0.5, ...R6 });
    for (const st of list) {
      mm.panel(10, y, w - 20, 52, 'paper');
      const im = mm.add(gs.add.image(32, y + 48, ...charTex(st.sprite + '_f')).setScale(0.5).setOrigin(0.5, 1)) as Phaser.GameObjects.Image;
      im.setCrop(0, 0, 64, 92);
      mm.text(56, y + 4, `${st.name}`, 12, T, R);
      const post = st.assign ? (st.assign.startsWith('cab:') ? ` · di cabang ${LOC[st.assign.slice(4)]?.short ?? ''}` : ' · di outlet') : '';
      const lock = tab === 1 && (ROLES[st.role].minStage ?? 1) > s.stage ? ` · mulai ${STAGES[(ROLES[st.role].minStage ?? 1) - 1].name}` : '';
      mm.text(56, y + 19, `${ROLES[st.role].name} · Lv${st.level} · ${fmtShort(st.salary)}/bln${post}${lock}`, 9, COL.muted, R6);
      mm.text(56, y + 32, `Skill ${Math.round(st.skill)} · Cepat ${Math.round(st.speed)}${st.traits.length ? ' · ' + st.traits.map((t) => TRAITS[t]?.name ?? t).join(', ') : ''}`, 9, '#7a3a10', R6);
      if (tab === 0) {
        mm.add(bar(gs, w - 70, y + 8, 50, 6, st.energy / 100, st.energy < 30 ? 0xc0392b : 0x6ac46a));
        mm.btn(w - 74, y + 22, 58, 24, 'Detail', () => { mm.close(); openStaffDetail(gs, st); }, { size: 10 }).setName('staff_detail_' + st.id);
      } else mm.btn(w - 78, y + 14, 62, 26, 'Rekrut', () => { if (!err(gs, sim.hire(st))) { gs.toast(`${st.name} gabung jadi ${ROLES[st.role].name}!`); mm.close(); openStaff(gs, 0); } }, { kind: 'primary', size: 11 }).setName('hire_' + st.role);
      y += 56;
    }
  });
}
export function openStaffDetail(gs: GameScene, st: Staff) {
  const sim = gs.sim;
  const m = gs.modal({ w: W(), h: 330, title: ROLES[st.role].name.toUpperCase(), closable: true });
  m.build((mm) => {
    const w = mm.w;
    mm.add(gs.add.image(50, 110, ...charTex(st.sprite + '_f')).setScale(1).setOrigin(0.5, 1));
    mm.text(96, 30, st.name, 15, T, R);
    mm.text(96, 50, `Lv ${st.level} · ${fmtShort(st.salary)}/bln`, 11, COL.muted, R6);
    mm.text(96, 66, ROLES[st.role].desc, 9, COL.muted, { wrap: w - 110, ...R6 });
    const stat = (label: string, v: number, y: number, col: number) => { mm.text(96, y, label, 10, T, R); mm.bar(170, y + 3, w - 190, 8, v / 100, col); };
    stat('Skill', st.skill, 92, 0xe8701a); stat('Kecepatan', st.speed, 108, 0x4aa0d8); stat('Energi', st.energy, 124, 0x6ac46a); stat('Loyal', st.loyalty, 140, 0xf6c440);
    mm.text(16, 162, st.traits.length ? st.traits.map((t) => `${TRAITS[t]?.name}: ${TRAITS[t]?.desc}`).join('\n') : 'Nggak ada sifat khusus.', 10, '#7a3a10', { wrap: w - 32, ...R6 });
    if (st.off) mm.text(16, 200, st.mudik ? `Lagi mudik (${st.off} hari lagi)` : `Lagi libur (${st.off} hari)`, 10, COL.blue, R);
    else if (st.role === 'manajer') {
      // v1.4: post the manajer at a cabang / national outlet
      const where = st.assign ? (st.assign.startsWith('cab:') ? `Cabang ${LOC[st.assign.slice(4)]?.short}` : (() => { const o = gs.s.outlets.find((x) => 'out:' + x.id === st.assign); return o ? `${OUTLET[o.kind].short} ${CITY[o.city].name}` : '?'; })()) : 'Warung utama';
      mm.btn(16, 196, w - 32, 22, `Tempat: ${where} · Ganti`, () => { mm.close(); openAssign(gs, st, () => openStaffDetail(gs, st)); }, { size: 9, kind: 'gold' }).setName('st_assign');
    }
    const by = 222;
    const bw = (w - 30) / 2;
    mm.btn(10, by, bw, 30, `Training (${fmtShort(sim.trainCost(st))} + ${4 + st.level * 2}P)`, () => { if (!err(gs, sim.train(st))) { gs.toast(`${st.name} habis training! Skill naik.`); mm.rebuild(); } }, { kind: 'green', size: 9 }).setName('st_train');
    mm.btn(20 + bw, by, bw, 30, 'Naik Gaji 10%', () => { sim.raise(st); gs.toast(`${st.name} senang gajinya naik!`); mm.rebuild(); }, { size: 10 }).setName('st_raise');
    mm.btn(10, by + 36, bw, 30, 'Liburkan 2 hari', () => { sim.rest(st); gs.toast(`${st.name} libur dulu, isi tenaga.`); mm.rebuild(); }, { size: 10, disabled: !!st.off }).setName('st_rest');
    mm.btn(20 + bw, by + 36, bw, 30, 'Pecat', () => confirm(gs, 'PECAT?', `Pecat ${st.name}? Pesangon ${fmtShort(st.salary)}. Staf lain jadi agak takut.`, () => { sim.fire(st); mm.close(); }), { kind: 'red', size: 10, disabled: gs.s.staff.length <= 1 }).setName('st_fire');
  });
}
function confirm(gs: GameScene, title: string, text: string, ok: () => void) {
  const m = gs.modal({ w: W(), h: 170, title, closable: true });
  m.build((mm) => {
    mm.text(mm.w / 2, 30, text, 11, T, { ox: 0.5, align: 'center', wrap: mm.w - 30, ...R6 });
    mm.btn(20, 120, (mm.w - 50) / 2, 32, 'Batal', () => mm.close());
    mm.btn(30 + (mm.w - 50) / 2, 120, (mm.w - 50) / 2, 32, 'Ya', () => { mm.close(); ok(); }, { kind: 'red' }).setName('confirm_yes');
  });
}

// ================================================================ belanja
export function openBelanja(gs: GameScene) {
  const sim = gs.sim, s = gs.s;
  const rowH = 40;
  const h = 140 + INGS.length * rowH + 60;
  const m = gs.modal({ w: WW(), h, title: 'BELANJA PASAR', closable: true });
  m.build((mm) => {
    const w = mm.w;
    const disc = sim.belanjaDiscount();
    mm.text(14, 26, `Kas ${fmtShort(s.money)}${disc ? ` · Tukang belanja hemat ${Math.round(disc * 100)}%` : ' · Tanpa tukang belanja'}`, 10, T, R);
    mm.text(14, 42, `Harga update tiap Senin · ${gudangLine(gs)}${sim.has('kulkas') ? ' · kulkas: 2x awet' : ''}`, 9, COL.muted, R6);
    const news = [...s.news].reverse().find((n) => n.kind === 'shock') ?? [...s.news].reverse()[0];
    mm.panel(10, 56, w - 20, 28, news?.kind === 'shock' ? 'sel' : 'paper');
    mm.text(18, 60, 'KABAR PASAR', 8, '#b04a1a', { font: DISPLAY });
    mm.text(18, 71, news ? news.text : 'Pasar adem ayem, harga normal.', 8, T, { wrap: w - 36, ...R6 }).setName('kabar_pasar');
    mm.btn(14, 88, w - 28, 26, 'Belanja otomatis tiap pagi: ' + (s.autoBuy ? 'NYALA' : 'MATI'), () => { s.autoBuy = !s.autoBuy; mm.rebuild(); }, { kind: s.autoBuy ? 'green' : 'btn', size: 11 }).setName('auto_buy');
    let y = 122;
    for (const i of INGS) {
      const p = sim.marketPrice(i.id);
      const hist = s.priceHist[i.id];
      const prev = hist.length > 1 ? hist[hist.length - 2] : hist[0];
      const ch = prev ? (s.prices[i.id] - prev) / prev : 0;
      const vsBase = s.prices[i.id] / (i.base * s.inflation);
      mm.panel(10, y, w - 20, rowH - 3, vsBase < 0.92 ? 'green' : vsBase > 1.12 ? 'sel' : 'paper');
      mm.add(gs.add.image(28, y + 18, ...dishTex(i.icon)).setScale(0.36));
      mm.text(44, y + 4, i.name, 11, T, R);
      mm.text(44, y + 19, `${fmtShort(p)}/${i.unit} ${ch > 0.01 ? '▲' : ch < -0.01 ? '▼' : '='} · gudang ${s.pantry[i.id].toFixed(1)} kg`, 9, ch > 0.01 ? COL.red : ch < -0.01 ? COL.green : COL.muted, R6);
      // sparkline
      if (WIDE && hist.length > 1) {
        const g = gs.add.graphics(); const sx = w - 190, sw = 50, sy = y + 6, sh = 22;
        const lo = Math.min(...hist), hi = Math.max(...hist);
        g.lineStyle(1.5, 0x7a3a10, 1); g.beginPath();
        hist.forEach((v, k) => { const px = sx + (k / (hist.length - 1)) * sw, py = sy + sh - ((v - lo) / Math.max(1, hi - lo)) * sh; if (k) g.lineTo(px, py); else g.moveTo(px, py); });
        g.strokePath(); mm.add(g);
      }
      const buy = (kg: number) => { if (!err(gs, sim.buy(i.id as IngId, kg))) mm.rebuild(); };
      mm.btn(w - 132, y + 7, 54, 22, '+1 kg', () => buy(1), { size: 10 }).setName('buy1_' + i.id);
      mm.btn(w - 74, y + 7, 58, 22, '+10 kg', () => buy(10), { size: 10, kind: 'green' }).setName('buy10_' + i.id);
      y += rowH;
    }
    mm.text(w / 2, y + 14, 'Tip: borong pas harga hijau (murah), hindari pas merah.\nGudang ada batasnya; sayur & ayam cepat layu.', 9, COL.muted, { ox: 0.5, align: 'center', ...R6 });
  });
}

// ================================================================ promosi
export function openPromosi(gs: GameScene, tab = 0) {
  const sim = gs.sim, s = gs.s;
  const h = tab === 0 ? 120 + PROMOS.length * 40 + 30 : tab === 1 ? 110 + OJOL_APPS.length * 76 + 20 : 300;
  const m = gs.modal({ w: WW(), h, title: 'PROMOSI', closable: true });
  m.build((mm) => {
    const w = mm.w;
    tabs(mm, ['Harga & Promo', 'Ojol Online', 'Kasbon'], tab, 24, (i) => { mm.close(); openPromosi(gs, i); });
    if (tab === 0) {
      mm.text(14, 56, 'Level harga jual:', 11, T, R);
      ['Murah', 'Normal', 'Mahal'].forEach((l, i) => mm.btn(110 + i * ((w - 124) / 3), 52, (w - 124) / 3 - 4, 24, l, () => { s.priceLevel = i; mm.rebuild(); }, { kind: s.priceLevel === i ? 'sel' : 'btn', size: 10 }).setName('price_' + i));
      mm.text(14, 82, `Nasi ${fmtShort(sim.nasiPrice())} · Orek ${fmtShort(sim.dishPrice('orek'))} · Ayam ${fmtShort(sim.dishPrice('ayamgoreng'))}`, 9, COL.muted, R6);
      let y = 100;
      for (const P of PROMOS) {
        const on = sim.promoOn(P.id), lock = s.stage < P.stage;
        mm.panel(10, y, w - 20, 37, on ? 'green' : 'paper');
        mm.text(18, y + 4, P.name, 11, lock ? COL.muted : T, R);
        mm.text(18, y + 19, lock ? `Butuh ${STAGES[P.stage - 1].name}` : `${P.desc} · ${P.days} hari`, 8, COL.muted, { wrap: w - 130, ...R6 });
        const left = s.promo.find((p) => p.id === P.id)?.left ?? 0;
        mm.btn(w - 100, y + 7, 84, 24, on ? `${left} hari` : P.cost ? fmtShort(P.cost * s.inflation) : 'Gratis', () => { if (!err(gs, sim.startPromo(P.id))) { gs.toast(`${P.name} jalan!`); mm.rebuild(); } }, { kind: 'primary', size: 10, disabled: on || lock }).setName('promo_' + P.id);
        y += 40;
      }
    } else if (tab === 1) {
      mm.text(14, 56, 'Pesanan online diantar driver. Komisi dipotong tiap\npesanan. Promo ongkir = order 1,8x tapi komisi +8%.', 9, COL.muted, R6);
      let y = 88;
      for (const A of OJOL_APPS) {
        const a = s.apps[A.id];
        mm.panel(10, y, w - 20, 72, a.joined ? 'paper' : 'paper');
        const g = gs.add.graphics(); g.fillStyle(A.color, 1); g.fillRoundedRect(18, y + 6, 90, 18, 5); mm.add(g);
        mm.text(63, y + 15, A.name, 11, '#ffffff', { ox: 0.5, oy: 0.5, ...R });
        mm.text(116, y + 8, a.joined ? `Rating toko ${a.rating.toFixed(1)}★` : `Daftar ${fmtShort(A.fee * s.inflation)}`, 10, T, R);
        mm.text(18, y + 30, A.desc, 9, COL.muted, { wrap: w - 40, ...R6 });
        if (!a.joined) mm.btn(w - 110, y + 44, 94, 22, 'Gabung', () => { if (!err(gs, sim.joinApp(A.id))) { gs.toast(`Warungmu sekarang ada di ${A.name}!`); mm.rebuild(); } }, { kind: 'primary', size: 10, disabled: s.stage < 1 }).setName('join_' + A.id);
        else mm.btn(w - 150, y + 44, 134, 22, 'Promo ongkir: ' + (a.promo ? 'ON' : 'OFF'), () => { a.promo = !a.promo; mm.rebuild(); }, { kind: a.promo ? 'green' : 'btn', size: 10 }).setName('promo_' + A.id);
        y += 76;
      }
    } else {
      const total = s.kasbon.reduce((a, k) => a + k.amount, 0);
      mm.text(14, 56, 'Pas tanggal tua, pelanggan suka minta ngebon (bayar pas\ngajian). Bikin rame, tapi ada yang nggak balik!', 9, COL.muted, R6);
      ['Tolak', 'Terbatas', 'Bebas'].forEach((l, i) => mm.btn(14 + i * ((w - 28) / 3), 90, (w - 28) / 3 - 4, 28, l, () => { s.kasbonPolicy = i; mm.rebuild(); }, { kind: s.kasbonPolicy === i ? 'sel' : 'btn', size: 11 }).setName('kasbon_' + i));
      mm.panel(14, 130, w - 28, 76, 'paper');
      mm.text(24, 138, `Kasbon belum dibayar: ${fmtMoney(total)}`, 11, T, R);
      mm.text(24, 156, `${s.kasbon.length} catatan · Hilang total: ${fmtShort(s.totals.kasbonLost)}`, 10, COL.muted, R6);
      mm.text(24, 174, sim.byRole('kasir').some((x) => x.traits.includes('jujur')) ? 'Kasir jujur: kasbon lebih aman.' : 'Tip: kasir Jujur + bayar QR bikin kasbon aman.', 9, '#7a3a10', R6);
      const top = CUSTS.map((c) => [c.name, s.kasbon.filter((k) => k.type === c.id).reduce((a, k) => a + k.amount, 0)] as [string, number]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
      mm.text(24, 222, top.length ? 'Paling banyak ngebon: ' + top.map(([n, v]) => `${n} ${fmtShort(v)}`).join(', ') : 'Buku kasbon masih bersih.', 9, T, { wrap: w - 40, ...R6 });
    }
  });
}

// ================================================================ info
export function openInfo(gs: GameScene, tab = 0) {
  const sim = gs.sim, s = gs.s;
  const m = gs.modal({ w: WW(), h: 420, title: 'INFO WARUNG', closable: true });
  m.build((mm) => {
    const w = mm.w;
    tabs(mm, ['Hari Ini', 'Rating', 'Pelanggan', 'Saingan'], tab, 24, (i) => { mm.close(); openInfo(gs, i); });
    let y = 58;
    const line = (a: string, b: string, col: string = T) => { mm.text(18, y, a, 11, T, R6); mm.text(w - 18, y, b, 11, col, { ox: 1, ...R }); y += 18; };
    const d = dateOf(s.absDay);
    if (tab === 0) {
      const t = s.today;
      mm.text(w / 2, y, `Th ${d.year} · Bulan ${d.month} · Minggu ${d.week} · ${sim.dayName()} ${clock(s.tick)}`, 11, '#b04a1a', { ox: 0.5, ...R }); y += 22;
      line('Pelanggan datang', String(t.customers));
      line('Dilayani', String(t.served));
      line('Kabur / balik kanan', String(t.left + t.balk + t.habis), t.left + t.balk + t.habis > 0 ? COL.red : T);
      line('Omzet warung', fmtMoney(t.revenue));
      line('Omzet ojol (sblm komisi)', fmtMoney(t.ojolRev));
      line('Belanja bahan', '-' + fmtMoney(t.ingCost), COL.red);
      line('Porsi dimasak', String(t.portions));
      y += 6;
      line('Kapasitas dapur', `${Math.round(sim.usedCap)}/${sim.cookCap()}`);
      line('Kecepatan layanan', `${sim.serveRate().toFixed(1)} org / 15 mnt`);
      line('Kursi', `${sim.seatsUsed()}/${sim.seats()}`);
      line('Biaya bulanan', fmtMoney(sim.monthlyCosts()));
      if (s.yesterday) line('Laba kemarin', fmtShort(s.history[s.history.length - 1]?.profit ?? 0), (s.history[s.history.length - 1]?.profit ?? 0) >= 0 ? COL.green : COL.red);
    } else if (tab === 1) {
      const st = sim.stars();
      mm.text(w / 2, y, `${st.toFixed(2)} ★`, 20, '#e8a020', { ox: 0.5, ...R }); y += 32;
      const rows: [string, number, string][] = [['Rasa', s.rasa, 'Juru masak, resep, sisa lauk'], ['Kebersihan', s.bersih, 'Pelayan, dekor, sidak'], ['Harga Murah', s.murah, 'Level harga vs dompet pelanggan'], ['Antrian', s.antrian, 'Yang kabur & lama nunggu'], ['Suasana', s.suasana, 'Dekor & ukuran warung']];
      for (const [n, v, hint] of rows) {
        mm.text(18, y, n, 11, T, R); mm.text(w - 18, y, String(Math.round(v)), 11, T, { ox: 1, ...R });
        mm.bar(18, y + 16, w - 36, 7, v / 100, 0xe8701a);
        mm.text(18, y + 25, hint, 8, COL.muted, R6);
        y += 42;
      }
      // star history
      const hist = s.history.slice(-21);
      if (hist.length > 1) {
        const g = gs.add.graphics(); const gx = 18, gw = w - 36, gy = y + 4, gh = 40;
        g.fillStyle(0xf8ead0, 1); g.fillRect(gx, gy, gw, gh);
        g.lineStyle(2, 0xe8701a, 1); g.beginPath();
        hist.forEach((hh, k) => { const px = gx + (k / (hist.length - 1)) * gw, py = gy + gh - (hh.stars / 5) * gh; if (k) g.lineTo(px, py); else g.moveTo(px, py); });
        g.strokePath(); mm.add(g);
      }
    } else if (tab === 2) {
      const tw = sim.typeWeights(); const tot = tw.reduce((a, b) => a + b[1], 0);
      mm.text(18, y, `Lokasi: ${LOC[s.loc].name}`, 11, '#b04a1a', R); y += 20;
      for (const [id, wt] of tw) {
        const C = CUST[id];
        mm.img(30, y + 30, 'chars', 0.36).setFrame(charFrame(C.sprite + '_f')).setOrigin(0.5, 1);
        mm.text(48, y + 2, `${C.name}  ${Math.round((wt / tot) * 100)}%`, 11, T, R);
        mm.text(48, y + 17, `Suka: ${C.likes.join(', ')} · budget ~${fmtShort(C.budget * s.inflation)}`, 9, COL.muted, R6);
        y += 36;
      }
      mm.text(18, y + 4, `Hari ini: ${Object.entries(s.today.byType).map(([k, v]) => `${CUST[k as keyof typeof CUST].name.split(' ')[0]} ${v}`).join(', ') || '-'}`, 9, T, { wrap: w - 36, ...R6 });
    } else {
      const ids = Object.keys(s.rivals);
      if (!ids.length) mm.text(w / 2, y + 20, 'Belum ada saingan. Nikmati selagi bisa!', 11, COL.muted, { ox: 0.5, ...R6 });
      for (const id of ids) {
        const Rv = RIVALS.find((x) => x.id === id)!; const rs = s.rivals[id];
        mm.panel(10, y, w - 20, 70, rs.cut > 0 ? 'sel' : 'paper');
        mm.text(18, y + 5, `${Rv.name}`, 12, T, R);
        mm.text(18, y + 21, `${Rv.kind}${rs.cut > 0 ? ' · LAGI BANTING HARGA!' : ''}`, 9, rs.cut > 0 ? COL.red : COL.muted, R6);
        mm.text(18, y + 34, Rv.desc, 9, COL.muted, { wrap: w - 40, ...R6 });
        mm.bar(18, y + 56, w - 36, 6, rs.strength, 0xd0402e);
        y += 76;
      }
    }
  });
}

// ================================================================ riset
export function openRiset(gs: GameScene, tab = 0, picks: string[] = []) {
  const sim = gs.sim, s = gs.s;
  const dishes = DISHES.filter((d) => d.unlock === 'riset');
  const n = tab === 0 ? dishes.length : tab === 1 ? UPGRADES.length : Math.ceil(s.unlocked.length / 3) + COMBOS.length * 0 + 6;
  const h = Math.max(380, 110 + n * (tab === 2 ? 30 : 40) + (tab === 2 ? 130 : 20));
  const m = gs.modal({ w: WW(), h, title: 'RISET', closable: true });
  m.build((mm) => {
    const w = mm.w;
    tabs(mm, ['Resep', 'Teknik', 'Uji Combo'], tab, 24, (i) => { mm.close(); openRiset(gs, i); });
    const cur = s.research;
    const curName = cur ? (DISH[cur.id]?.name ?? UPGRADES.find((u) => u.id === cur.id)?.name ?? '') : '';
    mm.text(14, 56, `Poin Warung: ${s.poin}${cur ? ` · Lagi riset: ${curName} (${cur.left} hari)` : ''}`, 10, T, R);
    let y = 76;
    if (tab === 0 || tab === 1) {
      const items = tab === 0 ? dishes.map((d) => ({ id: d.id, name: d.name, poin: d.poin ?? 0, days: d.days ?? 1, desc: (d.stage && s.stage < d.stage ? `[${STAGES[d.stage - 1].name}] ` : '') + (d.desc ?? ''), icon: d.icon, done: s.unlocked.includes(d.id), lock: !!d.stage && s.stage < d.stage })) : UPGRADES.map((u) => ({ id: u.id, name: u.name, poin: u.poin, days: u.days, desc: u.desc, icon: -1, done: s.researched.includes(u.id), lock: false }));
      for (const it of items) {
        mm.panel(10, y, w - 20, 37, it.done ? 'green' : cur?.id === it.id ? 'sel' : 'paper');
        if (it.icon >= 0) mm.add(gs.add.image(28, y + 18, ...dishTex(it.icon)).setScale(0.36));
        else mm.img(28, y + 18, 'icons', 0.36).setFrame(iconFrame('book'));
        mm.text(46, y + 4, it.name, 11, T, R);
        mm.text(46, y + 19, it.desc, 8, COL.muted, { wrap: w - 150, ...R6 });
        if (it.done) mm.text(w - 20, y + 12, 'Dikuasai', 10, COL.green, { ox: 1, ...R });
        else mm.btn(w - 104, y + 7, 88, 24, `${it.poin}P · ${it.days}hr`, () => { if (!err(gs, sim.startResearch(it.id))) { gs.toast(`Riset ${it.name} dimulai!`); mm.rebuild(); } }, { kind: 'primary', size: 10, disabled: !!cur || it.lock }).setName('riset_' + it.id);
        y += 40;
      }
    } else {
      mm.text(14, y, `Pilih 3 lauk, uji rasanya (${sim.comboCost()} poin). Paket yang cocok\nbikin tipe pelanggan tertentu makin rame. Slot paket aktif: ${s.activeCombos.length}/${sim.comboSlots()}`, 9, COL.muted, R6);
      y += 30;
      const avail = s.unlocked.filter((id) => DISH[id] && id !== 'esteh').concat(s.unlocked.includes('esteh') ? ['esteh'] : []);
      const cols = 3, cw = (w - 20) / cols;
      avail.forEach((id, i) => {
        const x = 10 + (i % cols) * cw, yy = y + Math.floor(i / cols) * 30;
        const sel = picks.includes(id);
        mm.btn(x, yy, cw - 4, 26, DISH[id].name, () => {
          const np = sel ? picks.filter((p) => p !== id) : picks.length < 3 ? [...picks, id] : picks;
          mm.close(); openRiset(gs, 2, np);
        }, { kind: sel ? 'sel' : 'btn', size: 9 }).setName('cb_' + id);
      });
      y += Math.ceil(avail.length / cols) * 30 + 6;
      mm.btn(10, y, w - 20, 30, picks.length === 3 ? `Uji: ${picks.map((p) => DISH[p].name).join(' + ')}` : `Pilih ${3 - picks.length} lauk lagi`, () => {
        const r = sim.tryCombo(picks);
        if (typeof r === 'string') { err(gs, r); return; }
        if (r.found) { sfx.fanfare(); } else sfx.event();
        const res = gs.modal({ w: W(), h: 190, title: r.found ? 'PAKET BARU!' : 'HASIL UJI RASA', closable: true });
        res.build((rr) => {
          rr.text(rr.w / 2, 34, `Skor ${r.score}`, 18, r.score >= 100 ? COL.green : r.score >= 60 ? '#e8a020' : COL.muted, { ox: 0.5, ...R });
          rr.text(rr.w / 2, 70, r.hint, 11, T, { ox: 0.5, align: 'center', wrap: rr.w - 30, ...R6 });
          rr.btn(rr.w / 2 - 50, 140, 100, 30, 'Oke', () => { rr.close(); mm.close(); openRiset(gs, 2, []); }, { kind: 'primary' }).setName('combo_ok');
        });
      }, { kind: 'primary', size: 11, disabled: picks.length !== 3 }).setName('cb_try');
      y += 38;
      mm.text(14, y, 'PAKET DITEMUKAN', 10, '#b04a1a', { font: DISPLAY });
      y += 16;
      if (!s.combos.length) mm.text(14, y, 'Belum ada. Coba-coba dulu!', 10, COL.muted, R6);
      for (const id of s.combos) {
        const cb = COMBOS.find((c) => c.id === id)!;
        const on = s.activeCombos.includes(id);
        mm.panel(10, y, w - 20, 30, on ? 'green' : 'paper');
        mm.text(18, y + 3, `${cb.name} (${CUST[cb.target].name})`, 10, T, R);
        mm.text(18, y + 16, cb.dishes.map((d) => DISH[d].name).join(' + '), 8, COL.muted, R6);
        mm.btn(w - 80, y + 4, 64, 22, on ? 'Aktif' : 'Pakai', () => {
          if (on) s.activeCombos = s.activeCombos.filter((x) => x !== id);
          else if (s.activeCombos.length < sim.comboSlots()) s.activeCombos.push(id);
          else { gs.toast('Slot paket penuh. Matikan satu dulu.'); return; }
          mm.close(); openRiset(gs, 2, picks);
        }, { kind: on ? 'green' : 'btn', size: 10 });
        y += 33;
      }
    }
  });
}

// ================================================================ warung: renovasi + dekor
export function openWarung(gs: GameScene) {
  const sim = gs.sim, s = gs.s;
  const gerobak = s.stage === 1;
  const fr = s.stage >= 4;
  const h = 200 + DECORS.length * 40 + 20 + (gerobak ? 108 : 0) + (fr ? 96 : 0);
  const m = gs.modal({ w: WW(), h, title: 'WARUNG', closable: true });
  m.build((mm) => {
    const w = mm.w;
    const cur = STAGES[s.stage - 1], next = STAGES[s.stage];
    mm.panel(10, 26, w - 20, 120, 'sel');
    mm.text(20, 32, `${s.name}`, 13, T, R);
    mm.text(20, 50, `${cur.name} · ${cur.seats} kursi · ${cur.slots} lauk · ${cur.staffMax} staf · sewa ${fmtShort(cur.rent * s.inflation)}`, 9, COL.muted, { wrap: w - 40, ...R6 });
    if (next) {
      const e = sim.upgradeCheck();
      mm.text(20, 66, `Renovasi jadi ${next.name}: ${next.seats} kursi, ${next.slots} lauk, ${next.staffMax} staf`, 10, T, { wrap: w - 40, ...R });
      mm.text(20, 80, growthLine(next.lv, s.inflation), 8, '#7a3a10', { wrap: w - 40, ...R6 });
      mm.text(20, 93, `Syarat: ${next.needStars}★ · ${fmtNum(next.needFans)} fans · ${fmtShort(next.cost * s.inflation)}`, 9, e ? COL.red : COL.green, R6);
      mm.btn(20, 108, w - 40, 30, e ? e : `Renovasi! (${fmtShort(next.cost * s.inflation)})`, () => { if (!err(gs, sim.upgradeStage())) { sfx.fanfare(); gs.toast(`Selamat! Sekarang jadi ${STAGES[s.stage - 1].name}!`); mm.rebuild(); } }, { kind: 'primary', size: 11, disabled: !!e }).setName('upgrade_stage');
    } else mm.text(20, 72, `Warung sudah paling besar: ${cur.name}! Tinggal ekspansi brand ke seluruh negeri.`, 10, T, { wrap: w - 40, ...R });
    let y0 = 156;
    if (fr) {
      // v1.4 franchise level-up: own brand, national outlets
      const fe = sim.franchiseCheck();
      mm.panel(10, y0 - 4, w - 20, 88, 'paper');
      if (!s.franchise) {
        mm.text(20, y0, `FRANCHISE NASIONAL: brand sendiri + outlet di kota lain (${FRANCHISE.needCabang} cabang, ${FRANCHISE.needStars}★).`, 9, T, { wrap: w - 40, ...R });
        mm.btn(20, y0 + 44, w - 40, 30, fe ? fe : `Buka Franchise (${fmtShort(FRANCHISE.cost * s.inflation)})`, () => startFranchiseFlow(gs, () => mm.rebuild()), { kind: 'gold', size: 11, disabled: !!fe }).setName('franchise');
      } else {
        const r = nationalReach(sim);
        mm.text(20, y0, `Brand: ${brandName(sim)}`, 11, T, R);
        mm.text(20, y0 + 16, `${r.outlets} outlet di ${r.cities} kota${r.mall ? ' · mall' : ''}${r.bandara ? ' · bandara' : ''}`, 9, COL.muted, R6);
        const bw = (w - 46) / 2;
        mm.btn(20, y0 + 44, bw, 30, 'Peta Nasional', () => { mm.close(); openNasional(gs); }, { kind: 'gold', size: 10 }).setName('warung_nasional');
        mm.btn(26 + bw, y0 + 44, bw, 30, 'Ganti nama brand', () => renameBrand(gs, () => mm.rebuild()), { size: 10 }).setName('brand_rename');
      }
      y0 += 96;
    }
    if (gerobak) {
      const M = mangkalDef(sim);
      mm.text(14, y0, 'LOKASI MANGKAL GEROBAK', 10, '#b04a1a', { font: DISPLAY });
      mm.text(14, y0 + 15, `${M.name}: ${M.desc}`, 8, COL.muted, { wrap: w - 28, ...R6 });
      const bw = (w - 28) / 3;
      MANGKAL.forEach((mk, i) => mm.btn(14 + i * bw, y0 + 38, bw - 4, 26, mk.short, () => { if (!err(gs, setMangkal(sim, mk.id))) { gs.toast(`Gerobak pindah mangkal ke ${mk.name}!`); mm.rebuild(); } }, { kind: s.mangkal === mk.id ? 'sel' : 'btn', size: 10 }).setName('mangkal_' + mk.id));
      mm.btn(14, y0 + 70, w - 28, 26, s.izinPKL ? 'Izin PKL: sudah punya (razia aman)' : `Urus izin PKL (${fmtShort(750000 * s.inflation)})`, () => { if (!err(gs, buyIzin(sim))) { gs.toast('Izin PKL beres!'); mm.rebuild(); } }, { kind: s.izinPKL ? 'green' : 'btn', size: 10, disabled: s.izinPKL }).setName('izin_pkl');
      y0 += 108;
    }
    mm.text(14, y0, 'DEKORASI', 10, '#b04a1a', { font: DISPLAY });
    let y = y0 + 16;
    for (const D of DECORS) {
      const own = s.decor.includes(D.id), lock = s.stage < D.stage;
      mm.panel(10, y, w - 20, 37, own ? 'green' : 'paper');
      mm.text(18, y + 4, D.name, 11, lock ? COL.muted : T, R);
      const fx = [D.rasa && `Rasa+${D.rasa}`, D.bersih && `Bersih+${D.bersih}`, D.suasana && `Suasana+${D.suasana}`, D.traffic && `Ramai+${Math.round(D.traffic * 100)}%`].filter(Boolean).join(' ');
      mm.text(18, y + 19, lock ? `Butuh ${STAGES[D.stage - 1].name}` : `${fx}${fx ? ' · ' : ''}${D.desc}`, 8, COL.muted, { wrap: w - 130, ...R6 });
      if (own) mm.text(w - 20, y + 12, 'Terpasang', 10, COL.green, { ox: 1, ...R });
      else mm.btn(w - 100, y + 7, 84, 24, fmtShort(D.cost * s.inflation), () => { if (!err(gs, sim.buyDecor(D.id))) { gs.toast(`${D.name} terpasang!`); mm.rebuild(); } }, { kind: 'primary', size: 10, disabled: lock }).setName('decor_' + D.id);
      y += 40;
    }
  });
}

// ================================================================ peta & cabang
export function openPeta(gs: GameScene, sel = '') {
  const sim = gs.sim, s = gs.s;
  const w = Math.min(GW - 12, WIDE ? 700 : 340);
  const mapW = w - 20, mapH = Math.round(mapW * 384 / 688);
  const h = 60 + mapH + 150;
  const m = gs.modal({ w, h, title: 'PETA & CABANG', closable: true });
  m.build((mm) => {
    const sc = mapW / 688;
    mm.img(10, 28, 'peta', sc).setOrigin(0, 0);
    const g = gs.add.graphics(); g.lineStyle(2, 0x4a2508, 1); g.strokeRect(10, 28, mapW, mapH); mm.add(g);
    mm.btn(w - 104, 32, 90, 22, 'NASIONAL ›', () => { mm.close(); openNasional(gs); }, { kind: 'gold', size: 9 }).setName('peta_nasional');
    for (const L of LOCS) {
      const px = 10 + L.px * sc, py = 28 + L.py * sc;
      const main = L.id === s.loc, cab = s.cabang.find((c) => c.loc === L.id);
      const lock = sim.date.year < L.unlockYear;
      const col = main ? 0xe8701a : cab ? 0x2e8b3a : lock ? 0x8a7a6a : 0xf6c440;
      const pg = gs.add.graphics();
      pg.fillStyle(0x2b1a10, 1); pg.fillCircle(px, py - 9, 8); pg.fillTriangle(px - 6, py - 6, px + 6, py - 6, px, py + 3);
      pg.fillStyle(col, 1); pg.fillCircle(px, py - 9, 6);
      if (sel === L.id) { pg.lineStyle(2, 0xffffff, 1); pg.strokeCircle(px, py - 9, 10); }
      mm.add(pg);
      const lab = mm.text(px, py + 5, main ? 'Warung Utama' : L.short, 8, '#ffffff', { ox: 0.5, font: ROUND, weight: '800', stroke: '#2b1a10', strokeW: 3 });
      void lab;
      const z = gs.add.zone(px - 16, py - 20, 32, 34).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setName('pin_' + L.id);
      z.on('pointerup', () => { mm.close(); openPeta(gs, L.id); });
      mm.add(z);
    }
    const y = 36 + mapH;
    const L = LOC[sel || s.loc];
    mm.panel(10, y, w - 20, 140, 'paper');
    mm.text(20, y + 6, L.name, 12, T, R);
    mm.text(20, y + 22, L.desc, 9, COL.muted, { wrap: w - 40, ...R6 });
    mm.text(20, y + 50, 'Pelanggan: ' + Object.entries(L.mix).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([k, v]) => `${CUST[k as keyof typeof CUST].name} ${Math.round((v ?? 0) * 100)}%`).join(', '), 9, T, { wrap: w - 40, ...R6 });
    const cab = s.cabang.find((c) => c.loc === L.id);
    if (L.id === s.loc) mm.text(20, y + 90, `Warung utamamu di sini. Cabang dibuka mulai level Warteg. Punya ${s.cabang.length} cabang.`, 9, '#7a3a10', { wrap: w - 40, ...R6 });
    else if (cab) {
      mm.text(20, y + 84, `Cabang Lv${cab.lv} · rating ${cab.rating.toFixed(1)}★ · setoran minggu lalu ${fmtShort(cab.lastWeek)} · total ${fmtShort(cab.total)}`, 9, cab.lastWeek >= 0 ? COL.green : COL.red, { wrap: w - 40, ...R });
      const bw = (w - 46) / 2;
      mm.btn(20, y + 106, bw + 30, 28, cab.lv >= 4 ? 'Sudah maksimal' : `Renovasi (${fmtShort(sim.renovCost(cab))})`, () => { if (!err(gs, sim.renovCabang(L.id))) { gs.toast('Cabang direnovasi!'); mm.close(); openPeta(gs, L.id); } }, { kind: 'green', size: 10, disabled: cab.lv >= 4 }).setName('renov_' + L.id);
      mm.btn(56 + bw, y + 106, bw - 30, 28, 'Tutup', () => confirm(gs, 'TUTUP CABANG?', `Tutup cabang ${L.short}? Sewa & peralatan dijual balik 40% dari modal.`, () => { const back = sim.closeCabang(L.id); gs.toast(`Cabang ${L.short} ditutup. Balik modal ${fmtShort(back)}.`); mm.close(); openPeta(gs, L.id); }), { kind: 'red', size: 10 }).setName('close_' + L.id);
    } else {
      const e = sim.date.year < L.unlockYear ? `Terbuka tahun ${L.unlockYear}` : s.stage < 3 ? 'Butuh level Warteg' : null;
      mm.text(20, y + 84, `Modal buka: ${fmtShort(sim.cabangCost(L.id))} · sewa ${fmtShort(L.rent * s.inflation)}/bln`, 10, T, R);
      mm.btn(20, y + 106, w - 40, 28, e ?? 'Buka Cabang di sini!', () => { if (!err(gs, sim.openCabang(L.id))) { sfx.fanfare(); gs.toast(`Cabang ${L.short} resmi buka!`); mm.close(); openPeta(gs, L.id); } }, { kind: 'primary', size: 11, disabled: !!e }).setName('open_' + L.id);
    }
  });
}

// ================================================================ keuangan / prestasi / ulasan
export function openKeuangan(gs: GameScene) {
  const s = gs.s;
  const years = Object.keys(s.ledger).map(Number).sort((a, b) => b - a).slice(0, 6);
  const m = gs.modal({ w: WW(), h: 110 + years.length * 92, title: 'KEUANGAN', closable: true });
  m.build((mm) => {
    const w = mm.w;
    mm.text(14, 28, `Kas ${fmtMoney(s.money)} · Laba total ${fmtShort(s.totals.profit)}`, 11, T, R);
    mm.text(14, 44, `Kasbon beredar ${fmtShort(s.kasbon.reduce((a, k) => a + k.amount, 0))} · Omzet terbaik sehari ${fmtShort(s.totals.bestDay)}`, 9, COL.muted, R6);
    let y = 64;
    for (const yr of years) {
      const L = s.ledger[yr];
      const net = L.revenue - L.ingredients - L.salaries - L.rent - L.other - L.ojolFee;
      mm.panel(10, y, w - 20, 86, 'paper');
      mm.text(18, y + 5, `Tahun ${yr}`, 12, '#b04a1a', R);
      mm.text(w - 18, y + 5, `Untung operasional ${fmtShort(net)}`, 10, net >= 0 ? COL.green : COL.red, { ox: 1, ...R });
      const rows: [string, number][] = [['Omzet', L.revenue], ['Bahan', -L.ingredients], ['Gaji', -L.salaries], ['Sewa', -L.rent], ['Lain-lain', -L.other], ['Komisi ojol', -L.ojolFee], ['Investasi', -L.investment]];
      rows.forEach(([n, v], i) => { const cx = 18 + (i % 2) * ((w - 36) / 2), cy = y + 24 + Math.floor(i / 2) * 14; mm.text(cx, cy, `${n}: ${fmtShort(v)}`, 9, v >= 0 ? T : COL.red, R6); });
      y += 92;
    }
  });
}
export function openPrestasi(gs: GameScene) {
  const s = gs.s;
  const cols = WIDE ? 2 : 1;
  const rows = Math.ceil(ACHIEVEMENTS.length / cols);
  const m = gs.modal({ w: WW(), h: 90 + rows * 34 + (s.ended ? 40 : 0), title: 'PRESTASI', closable: true });
  m.build((mm) => {
    const w = mm.w;
    mm.text(w / 2, 28, `${Object.keys(s.achievements).length}/${ACHIEVEMENTS.length} terbuka`, 11, T, { ox: 0.5, ...R });
    const cw = (w - 20) / cols;
    ACHIEVEMENTS.forEach((a, i) => {
      const x = 10 + (i % cols) * cw, y = 48 + Math.floor(i / cols) * 34;
      const got = s.achievements[a.id] !== undefined;
      mm.panel(x, y, cw - 4, 31, got ? 'gold' : 'disabled');
      mm.img(x + 16, y + 15, 'icons', 0.3).setFrame(iconFrame('trophy')).setAlpha(got ? 1 : 0.3);
      mm.text(x + 30, y + 3, a.name, 10, got ? T : '#6a5a4a', R);
      mm.text(x + 30, y + 16, a.desc, 8, got ? '#6a3a10' : '#7a6a5a', R6);
    });
    if (s.ended) mm.btn(20, 54 + rows * 34, w - 40, 30, 'Rekap Karier', () => { mm.close(); showEnding(gs); }, { kind: 'primary' }).setName('rekap');
  });
}
export function openUlasan(gs: GameScene) {
  const s = gs.s;
  const rv = [...s.reviews].reverse().slice(0, 25);
  const m = gs.modal({ w: WW(), h: Math.max(200, 60 + rv.length * 42), title: 'ULASAN PELANGGAN', closable: true });
  m.build((mm) => {
    const w = mm.w;
    let y = 28;
    if (!rv.length) mm.text(w / 2, 60, 'Belum ada ulasan.', 11, COL.muted, { ox: 0.5, ...R6 });
    for (const r of rv) {
      mm.text(16, y, '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars), 10, '#e8a020', R);
      mm.text(80, y, `${r.name} · ${r.type === 'vlog' ? 'Food Vlogger' : CUST[r.type as keyof typeof CUST]?.name ?? ''}`, 10, '#b04a1a', R);
      mm.text(w - 16, y, `${dateOf(r.day).dom}/${dateOf(r.day).month}`, 9, COL.muted, { ox: 1, ...R6 });
      const t = mm.text(16, y + 14, r.text, 10, T, { wrap: w - 32, ...R6 });
      y += 20 + t.height;
    }
    s.reviewRead = s.reviewSeq;
  });
}

// ================================================================ events / reports / ending
export function showChoice(gs: GameScene, ev: ChoiceEvent) {
  sfx.event();
  const faceKey = typeof ev.data?.face === 'string' ? ev.data.face : '';
  const probe = txt(gs, 0, 0, ev.text, 11, T, { align: 'center', wrap: W() - 30, ...R6 });
  const th = probe.height; probe.destroy();
  const h = 52 + th + (faceKey ? (faceKey.startsWith('cat_') ? 58 : 46) : 0) + ev.choices.length * 38 + 14;
  const m = gs.modal({ w: W(), h, title: ev.title });
  m.build((mm) => {
    let ty = 26;
    if (faceKey) {
      const [tex, fr] = charTex(faceKey);
      const im = mm.add(gs.add.image(mm.w / 2, ty + (faceKey.startsWith('cat_') ? 56 : 68), tex, fr).setOrigin(0.5, 1).setScale(faceKey.startsWith('cat_') ? 1.3 : 0.95));
      if (!faceKey.startsWith('cat_')) im.setCrop(0, 10, 64, 40);
      ty += faceKey.startsWith('cat_') ? 58 : 46;
    }
    const t = mm.text(mm.w / 2, ty, ev.text, 11, T, { ox: 0.5, align: 'center', wrap: mm.w - 30, ...R6 });
    let y = ty + t.height + 12;
    ev.choices.forEach((c, i) => {
      mm.btn(16, y, mm.w - 32, 32, c.label + (c.hint ? `  (${c.hint})` : ''), () => { mm.close(); gs.sim.resolve(ev, i); gs.refreshHud(true); }, { kind: i === 0 ? 'primary' : 'btn', size: c.hint ? 10 : 12 }).setName('choice_' + i);
      y += 38;
    });
  });
}
export function showDayReport(gs: GameScene, r: DayReport) {
  sfx.phase();
  const d = dateOf(r.day);
  const m = gs.modal({ w: W(), h: 390, title: 'LAPORAN HARIAN', closable: true });
  m.build((mm) => {
    const w = mm.w;
    mm.text(w / 2, 26, `Th ${d.year} · Bln ${d.month} · Mg ${d.week} · Hari ${d.day}`, 11, '#b04a1a', { ox: 0.5, ...R });
    let y = 48;
    const line = (a: string, b: string, col: string = T, big = false) => { mm.text(18, y, a, big ? 12 : 11, T, big ? R : R6); mm.text(w - 18, y, b, big ? 13 : 11, col, { ox: 1, ...R }); y += big ? 22 : 17; };
    line('Pelanggan', `${r.served} dilayani / ${r.customers} datang`);
    line('Kabur', String(r.lost), r.lost ? COL.red : T);
    line('Ojol', `${r.ojolDone} selesai${r.ojolBatal ? `, ${r.ojolBatal} batal` : ''}`);
    line('Omzet', fmtMoney(r.revenue), COL.green);
    if (r.ojolNet) line('  (komisi ojol dipotong)', fmtMoney(r.ojolNet - (r.revenue - (r.revenue - r.ojolNet))), COL.muted);
    line('Belanja bahan', '-' + fmtMoney(r.ingCost), COL.red);
    line('Biaya harian (gaji/sewa)', '-' + fmtMoney(r.overhead), COL.red);
    if (r.kasbon) line('Kasbon baru', fmtMoney(r.kasbon), '#e8a020');
    if (r.waste) line('Lauk terbuang', '-' + fmtMoney(r.waste), COL.muted);
    y += 4;
    const g = gs.add.graphics(); g.fillStyle(0x9a5a2a, 1); g.fillRect(18, y - 4, w - 36, 2); mm.add(g);
    line('LABA HARI INI', (r.profit >= 0 ? '+' : '') + fmtMoney(r.profit), r.profit >= 0 ? COL.green : COL.red, true);
    line('Rating', `${r.stars.toFixed(2)}★ ${r.deltaStars >= 0 ? '▲' : '▼'}${Math.abs(r.deltaStars).toFixed(2)}`, r.deltaStars >= 0 ? COL.green : COL.red);
    line('Fans', `${r.fans >= 0 ? '+' : ''}${r.fans}`, r.fans >= 0 ? COL.green : COL.red);
    line('Poin Warung', `+${r.poin}`, '#b04a1a');
    line('Lauk terlaris', r.best);
    const tip = r.lost > r.served * 0.2 ? 'Banyak yang kabur! Tambah pelayan/kasir atau masak lebih banyak.' : r.waste > r.revenue * 0.1 ? 'Banyak lauk terbuang. Kurangi porsi di MASAK.' : r.profit < 0 ? 'Rugi hari ini. Cek harga jual & porsi.' : 'Mantap! Warung makin dikenal.';
    mm.text(w / 2, y + 4, tip, 10, '#7a3a10', { ox: 0.5, align: 'center', wrap: w - 30, ...R6 });
    mm.btn(w / 2 - 70, 346, 140, 32, 'Lanjut besok', () => mm.close(), { kind: 'primary' }).setName('report_ok');
  });
}
export function achievementToast(gs: GameScene, id: string) {
  const a = ACH[id];
  if (!a) return;
  sfx.levelup();
  gs.toast(`PRESTASI: ${a.name}! (${a.desc})`);
}
export function showEnding(gs: GameScene) {
  const sim = gs.sim, s = gs.s;
  const t = sim.endingTitle();
  sfx.setMusicOverride('award');
  const m = gs.modal({ w: W(), h: 452, title: 'REKAP 10 TAHUN', closable: true, onClose: () => sfx.setMusicOverride(null) });
  m.build((mm) => {
    const w = mm.w;
    mm.text(w / 2, 30, t.special ? 'Gelar SPESIAL kamu:' : 'Gelar kamu:', 11, t.special ? '#b04a1a' : COL.muted, { ox: 0.5, ...R6 });
    mm.text(w / 2, 56, t.title.toUpperCase(), 16, '#e8701a', { ox: 0.5, font: DISPLAY, stroke: '#4a1e0a', strokeW: 3, wrap: w - 20, align: 'center' }).setName('ending_title');
    mm.text(w / 2, 84, `Skor karier ${t.score}/100`, 12, T, { ox: 0.5, ...R });
    mm.text(w / 2, 104, t.line, 10, T, { ox: 0.5, align: 'center', wrap: w - 30, ...R6 });
    let y = 150;
    const line = (a: string, b: string) => { mm.text(20, y, a, 10, T, R6); mm.text(w - 20, y, b, 10, T, { ox: 1, ...R }); y += 16; };
    line('Total pelanggan', fmtNum(s.totals.customers));
    line('Total laba · kas sekarang', `${fmtShort(s.totals.profit)} · ${fmtShort(s.money)}`);
    line('Rating rata-rata · tertinggi', `${avgStars(sim).toFixed(2)}★ · ${s.totals.maxStars.toFixed(2)}★`);
    line('Warung · cabang', `${STAGES[s.stage - 1].name}${s.franchise ? ' + Franchise' : ''} · ${s.cabang.length}`);
    line('Kesejahteraan staf', `${welfare(sim)}/100 (THR penuh ${s.stats2.thrFull}x, skip ${s.stats2.thrSkip}x)`);
    line('Jiwa dermawan', `${Math.round(dermawan(sim))}`);
    line('Cerita langganan happy end', `${s.stats2.regGood}/6`);
    line('Katering sukses / gagal', `${s.stats2.katDone} / ${s.stats2.katFail + s.stats2.katLate}`);
    line('Fans · pengikut', `${fmtNum(s.fans)} · ${fmtNum(s.followers)}`);
    line('Prestasi', `${Object.keys(s.achievements).length}/${ACHIEVEMENTS.length}`);
    const gt = mm.text(w / 2, y + 6, 'Gelar spesial: ' + ENDINGS2.filter((e) => e.special).map((e) => e.title).join(' · '), 8, COL.muted, { ox: 0.5, align: 'center', wrap: w - 30, ...R6 });
    y += 14 + gt.height;
    mm.text(w / 2, y, 'Warung tetap buka! Main bebas sepuasnya.', 10, '#2e8b3a', { ox: 0.5, ...R });
    mm.btn(w / 2 - 80, y + 18, 160, 32, 'Lanjut jualan', () => mm.close(), { kind: 'primary' }).setName('ending_ok');
  });
}
export function showBankrupt(gs: GameScene) {
  sfx.sad();
  const m = gs.modal({ w: W(), h: 270, title: 'BANGKRUT...' });
  m.build((mm) => {
    const t = gs.sim.endingTitle();
    mm.text(mm.w / 2, 30, t.title.toUpperCase(), 13, '#c0392b', { ox: 0.5, font: DISPLAY, stroke: '#4a1e0a', strokeW: 2 }).setName('bankrupt_title');
    const lt = mm.text(mm.w / 2, 54, t.line, 10, T, { ox: 0.5, align: 'center', wrap: mm.w - 30, ...R });
    mm.text(mm.w / 2, 62 + lt.height, `Bertahan sampai Tahun ${dateOf(gs.s.absDay).year}. Total pelanggan ${fmtNum(gs.s.totals.customers)}.`, 10, COL.muted, { ox: 0.5, align: 'center', wrap: mm.w - 30, ...R6 });
    mm.btn(20, 170, mm.w - 40, 34, 'Mulai lagi dari gerobak', () => { deleteSave(); const st = newGame(gs.s.name); st.tut = 99; saveGame(st); gs.scene.restart({ state: st }); }, { kind: 'primary' }).setName('bk_restart');
    mm.btn(20, 214, mm.w - 40, 30, 'Ke layar judul', () => { deleteSave(); gs.scene.start('Title'); }).setName('bk_title');
  });
}
// keep imports referenced
void txt; void button; void bar; void drawPanel; void GH; void fmtNum; void ENDINGS; void weatherLine;
