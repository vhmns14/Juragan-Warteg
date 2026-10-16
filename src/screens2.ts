// v1.3 dialogs: KAMPUNG hub (Katering, Langganan, Medsos, Investasi), Kucing, Radio, Dapur Seru launcher, Kabar Pasar.
// Same wooden / cream kit and compact paper rows as screens.ts (phone 340 wide, wide 420).
import type { GameScene } from './scenes/Game';
import { Modal, COL, ROUND, DISPLAY, GW, WIDE, txt, bar } from './ui';
import { CUST, STAGES } from './data';
import { KATERING, REGULARS, PERKS, SINKS, MINIGAMES, WEATHER, type MiniId } from './data2';
import { fmtShort, fmtNum, dateOf } from './state';
import { charTex, EXTRA } from './assets';
import { sfx, RADIO, type RadioId } from './audio';
import { commitmentsPerYear, sinkCost, sinkLv, buySink, feedCat, petCat, katActive, miniDone, gudangCap, pantryKg } from './systems';
import { openMinigame } from './minigames';

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
/** text height for a wrapped string (to size a dialog before building it) */
function measure(gs: GameScene, s: string, size: number, wrap: number) { const t = txt(gs, 0, 0, s, size, T, { wrap, ...R6 }); const h = t.height; t.destroy(); return h; }
/** half-body portrait from either character sheet */
function face(gs: GameScene, m: Modal, x: number, y: number, key: string, sc = 0.42) {
  const [tex, fr] = charTex(key);
  const im = m.add(gs.add.image(x, y, tex, fr).setOrigin(0.5, 1).setScale(sc));
  if (!key.startsWith('cat_')) im.setCrop(0, 8, 64, 50);
  return im;
}

// ================================================================ KAMPUNG hub
export function openKampung(gs: GameScene, tab = 0) {
  const s = gs.s, sim = gs.sim;
  const w0 = WW();
  let h = 300;
  if (tab === 0) h = 120 + Math.max(1, katActive(sim).length) * 52 + Math.min(5, s.katering.filter((k) => k.state !== 'aktif').length) * 20 + 70;
  else if (tab === 1) h = 104 + REGULARS.length * 48 + Math.max(1, s.perks.length) * 14 + 10;
  else if (tab === 2) {
    const posts = [...s.posts].reverse().slice(0, 10);
    h = 92 + posts.reduce((a, p) => a + 24 + measure(gs, p.text, 9, w0 - 70) + (p.replied ? 12 : 0), 0) + (posts.length ? 0 : 40);
  } else h = 92 + SINKS.length * 66 + 16;
  const m = gs.modal({ w: w0, h: Math.max(240, h), title: 'KAMPUNG', closable: true });
  m.build((mm) => {
    const w = mm.w;
    tabs(mm, ['Katering', 'Langganan', 'Medsos', 'Investasi'], tab, 24, (i) => { mm.close(); openKampung(gs, i); });
    let y = 56;
    if (tab === 0) {
      const act = katActive(sim);
      mm.text(14, y, `Aktif ${act.length} · Sukses ${s.stats2.katDone} · Telat ${s.stats2.katLate} · Gagal ${s.stats2.katFail}`, 10, T, R);
      mm.text(14, y + 15, 'Pesanan datang lewat kabar mendadak. Dapur nyicil tiap pagi (maks 45% tenaga, lembur 78%).', 8, COL.muted, { wrap: w - 28, ...R6 });
      y += 40;
      if (!act.length) { mm.panel(10, y, w - 20, 44, 'paper'); mm.text(w / 2, y + 22, 'Belum ada pesanan katering.\nTunggu tawaran dari warga!', 9, COL.muted, { ox: 0.5, oy: 0.5, align: 'center', ...R6 }); y += 52; }
      for (const o of act) {
        const K = KATERING.find((k) => k.id === o.kind)!;
        const left = o.due - s.absDay;
        const frac = o.prep / o.portions;
        const daily = Math.ceil((o.portions - o.prep) / Math.max(1, left));
        mm.panel(10, y, w - 20, 48, left <= 1 && frac < 1 ? 'sel' : 'paper');
        mm.text(18, y + 4, `${K.name} · ${o.client}`, 10, T, R);
        mm.text(w - 18, y + 4, left <= 0 ? 'Hari ini!' : `${left} hari lagi`, 9, left <= 1 ? COL.red : '#b04a1a', { ox: 1, ...R });
        mm.bar(18, y + 20, w - 150, 7, frac, frac >= 1 ? 0x6ac46a : 0xf6a020);
        mm.text(18, y + 30, `${o.prep}/${o.portions} porsi · ${fmtShort(o.pay)}${frac < 1 ? ` · perlu ~${daily}/hari` : ' · siap antar'}`, 8, COL.muted, R6);
        mm.btn(w - 124, y + 18, 108, 24, o.lembur ? 'Lembur: ON' : 'Lembur: OFF', () => { o.lembur = !o.lembur; gs.toast(o.lembur ? 'Dapur lembur: katering ngebut, juru masak lebih capek.' : 'Lembur dimatikan.'); mm.rebuild(); }, { kind: o.lembur ? 'green' : 'btn', size: 9 }).setName('kat_lembur_' + o.id);
        y += 52;
      }
      const hist = s.katering.filter((k) => k.state !== 'aktif').slice(-5).reverse();
      if (hist.length) {
        mm.text(14, y + 2, 'RIWAYAT', 9, '#b04a1a', { font: DISPLAY });
        y += 16;
        for (const o of hist) {
          const col = o.state === 'selesai' ? COL.green : o.state === 'telat' ? '#e8a020' : COL.red;
          mm.text(18, y, `${KATERING.find((k) => k.id === o.kind)?.name ?? ''} · ${o.client} · ${o.portions} porsi`, 9, T, R6);
          mm.text(w - 18, y, o.state === 'selesai' ? 'Sukses' : o.state === 'telat' ? 'Kurang porsi' : 'Gagal', 9, col, { ox: 1, ...R });
          y += 20;
        }
      }
    } else if (tab === 1) {
      mm.text(14, y, 'Pelanggan setia yang punya cerita. Pilihanmu tiap kunjungan nentuin akhirnya.', 9, COL.muted, { wrap: w - 28, ...R6 });
      y += 26;
      for (const r of REGULARS) {
        const st = s.regulars[r.id];
        const locked = !st && (s.absDay < r.startDay || s.stage < r.minStage);
        mm.panel(10, y, w - 20, 44, st?.state === 'good' ? 'green' : st?.state === 'bad' ? 'disabled' : 'paper');
        face(gs, mm, 30, y + 42, r.sprite + '_f', 0.56).setAlpha(locked ? 0.35 : 1);
        mm.text(50, y + 4, locked ? '???' : r.name, 11, locked ? COL.muted : T, R);
        mm.text(50, y + 19, locked ? (s.stage < r.minStage ? `Muncul di ${STAGES[r.minStage - 1].name}` : 'Belum mampir') : `${r.role} · ${CUST[r.type].name}`, 8, COL.muted, { wrap: w - 170, ...R6 });
        let status = '';
        if (st?.state === 'good') status = 'Happy End';
        else if (st?.state === 'bad') status = 'Sad End';
        else if (st) status = `Cerita ${st.step}/${r.steps.length}`;
        else if (!locked) status = 'Belum kenal';
        if (status) mm.text(w - 18, y + 4, status, 9, st?.state === 'good' ? COL.green : st?.state === 'bad' ? COL.red : '#b04a1a', { ox: 1, ...R });
        if (st && st.state !== 'bad') {
          const aff = Math.max(0, Math.min(1, st.aff / 80));
          mm.text(w - 104, y + 22, '♥', 10, '#d0402e', R);
          mm.bar(w - 92, y + 26, 74, 6, aff, aff >= 0.62 ? 0xd0402e : 0xe8a0a0);
        }
        y += 48;
      }
      mm.text(14, y + 4, 'BONUS TETAP', 9, '#b04a1a', { font: DISPLAY });
      y += 18;
      if (!s.perks.length) mm.text(14, y, 'Belum ada. Selesaikan cerita dengan happy ending!', 9, COL.muted, R6);
      for (const p of s.perks) { mm.text(14, y, '★ ' + PERKS[p], 9, T, R6); y += 14; }
    } else if (tab === 2) {
      const handle = '@' + s.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
      mm.text(14, y, `${handle} · ${fmtNum(s.followers)} pengikut`, 11, T, R);
      mm.text(w - 14, y + 1, `Komplain dibalas ${s.stats2.komplainReplied} · dicuekin ${s.stats2.komplainIgnored}`, 8, COL.muted, { ox: 1, ...R6 });
      y += 22;
      const posts = [...s.posts].reverse().slice(0, 10);
      if (!posts.length) mm.text(w / 2, y + 20, 'Belum ada yang ngomongin warungmu.\nBuka terus, nanti netizen datang!', 9, COL.muted, { ox: 0.5, align: 'center', ...R6 });
      for (const p of posts) {
        const col = p.kind === 'viral' ? 0xe8701a : p.kind === 'komplain' || p.kind === 'bad' ? 0xc0392b : p.kind === 'balas' ? 0x2e8b3a : 0x7a5a3a;
        const g = gs.add.graphics(); g.fillStyle(0x2b1a10, 1); g.fillCircle(26, y + 9, 9); g.fillStyle(col, 1); g.fillCircle(26, y + 9, 7.5); mm.add(g);
        mm.text(26, y + 9, p.user.charAt(1).toUpperCase(), 9, '#ffffff', { ox: 0.5, oy: 0.5, ...R });
        mm.text(42, y, p.user, 9, '#b04a1a', R);
        const tag = p.kind === 'viral' ? 'VIRAL' : p.kind === 'komplain' ? (p.replied ? 'DITANGGAPI' : 'KOMPLAIN') : '';
        mm.text(w - 16, y, `${tag ? tag + ' · ' : ''}♥ ${fmtNum(p.likes)} · ${dateOf(p.day).dom}/${dateOf(p.day).month}`, 8, tag === 'KOMPLAIN' ? COL.red : COL.muted, { ox: 1, ...R });
        const t = mm.text(42, y + 13, p.text, 9, T, { wrap: w - 70, ...R6 });
        y += 16 + t.height;
        if (p.replied) { mm.text(42, y, '↳ ' + p.replied, 8, COL.green, R6); y += 12; }
        y += 6;
      }
    } else {
      mm.text(14, y, `Kas ${fmtShort(s.money)} · bonus permanen, ikut nentuin gelar akhir.`, 10, T, R);
      y += 20;
      for (const k of SINKS) {
        const lv = sinkLv(sim, k.id), max = lv >= k.max, lock = s.stage < k.stage;
        mm.panel(10, y, w - 20, 62, max ? 'green' : 'paper');
        mm.text(18, y + 4, k.name, 11, lock ? COL.muted : T, R);
        let dots = ''; for (let i = 0; i < k.max; i++) dots += i < lv ? '●' : '○';
        mm.text(18 + (k.max > 1 ? 0 : 0), y + 19, k.max > 1 ? `Lv ${lv}/${k.max} ${dots}` : lv ? 'Sudah dibeli' : 'Belum', 9, '#b04a1a', R);
        mm.text(18, y + 32, lock ? `Butuh ${STAGES[k.stage - 1].name}` : k.per, 8, COL.muted, { wrap: w - 140, ...R6 });
        if (k.yearly) mm.text(18, y + 46, k.yearly, 7, '#7a3a10', { wrap: w - 140, ...R6 });
        if (max) mm.text(w - 20, y + 22, 'Maksimal', 10, COL.green, { ox: 1, ...R });
        else mm.btn(w - 112, y + 16, 96, 26, fmtShort(sinkCost(sim, k.id)), () => { if (!err(gs, buySink(sim, k.id))) { sfx.fanfare(); gs.toast(`${k.name} naik ke level ${sinkLv(sim, k.id)}!`); mm.rebuild(); } }, { kind: 'primary', size: 10, disabled: lock }).setName('sink_' + k.id);
        y += 66;
      }
      const cy = commitmentsPerYear(sim);
      mm.text(14, y + 2, cy ? `Komitmen tiap Januari sekarang: ${fmtShort(cy)}` : 'Belum ada iuran tahunan.', 9, cy ? '#b04a1a' : COL.muted, R);
    }
  });
}

// ================================================================ kucing
export function openKucing(gs: GameScene) {
  const s = gs.s, sim = gs.sim, c = s.cat;
  const m = gs.modal({ w: W(), h: 250, title: 'KUCING WARTEG', closable: true });
  m.build((mm) => {
    const w = mm.w;
    if (!c.adopted) {
      mm.text(w / 2, 60, c.offered ? 'Kucingnya udah pergi... mungkin nanti ada yang lain.' : 'Belum ada kucing yang mampir.\nSabar, nanti ada yang nongkrong!', 11, COL.muted, { ox: 0.5, align: 'center', wrap: w - 30, ...R6 });
      mm.btn(w / 2 - 50, 190, 100, 30, 'Oke', () => mm.close(), { kind: 'primary' });
      return;
    }
    const hungry = c.fedDay < s.absDay;
    const fr = EXTRA.frames[hungry ? 'cat_sit' : c.aff > 70 ? 'cat_sleep' : 'cat_sit'];
    mm.add(gs.add.image(70, 112, 'extra', fr).setOrigin(0.5, 1).setScale(1.6));
    mm.text(130, 34, c.name, 16, T, R);
    mm.text(130, 56, hungry ? 'Laper, meong-meong terus' : 'Kenyang, males-malesan', 10, hungry ? COL.red : COL.green, R6);
    mm.text(130, 76, '♥ Rasa sayang', 10, T, R);
    mm.bar(130, 92, w - 150, 9, c.aff / 100, 0xd0402e);
    mm.text(130, 106, `${Math.round(c.aff)}/100 · nyolong ${c.stolen}x`, 9, COL.muted, R6);
    mm.text(w / 2, 132, 'Kucing sayang = kadang narik pelanggan (pada foto-foto).\nKucing laper = nyolong ikan di etalase.', 9, COL.muted, { ox: 0.5, align: 'center', wrap: w - 24, ...R6 });
    const bw = (w - 30) / 2;
    mm.btn(10, 180, bw, 32, `Kasih makan (${fmtShort(8000 * s.inflation)})`, () => { if (!err(gs, feedCat(sim))) { gs.toast(`${c.name} makan lahap. Nyam!`); mm.rebuild(); } }, { kind: 'green', size: 10, disabled: c.fedDay === s.absDay }).setName('cat_feed');
    mm.btn(20 + bw, 180, bw, 32, 'Elus-elus', () => { if (!err(gs, petCat(sim))) { gs.toast(`${c.name} mendengkur. Purrr~`); mm.rebuild(); } }, { size: 11, disabled: c.petDay === s.absDay }).setName('cat_pet');
  });
}

// ================================================================ radio
export function radioLabel(id: RadioId) { return RADIO.find((r) => r.id === id)?.name ?? 'Mati'; }
export function openRadio(gs: GameScene) {
  const s = gs.s;
  const m = gs.modal({ w: W(), h: 96 + RADIO.length * 34 + 70, title: 'RADIO WARUNG', closable: true });
  m.build((mm) => {
    const w = mm.w;
    mm.text(w / 2, 28, 'Pilih channel radio di warung:', 11, T, { ox: 0.5, ...R });
    RADIO.forEach((r, i) => {
      mm.btn(20, 48 + i * 34, w - 40, 30, `${r.name} · ${r.desc}`, () => { sfx.setRadio(r.id); gs.refreshMusic(); mm.rebuild(); }, { kind: sfx.radio === r.id ? 'sel' : 'btn', size: 10 }).setName('radio_' + r.id);
    });
    const y = 56 + RADIO.length * 34;
    const news = [...s.news].reverse()[0];
    mm.text(w / 2, y + 2, sfx.muted || !sfx.musicOn ? 'Suara / musik lagi dimatikan di Pengaturan.' : sfx.radio === 'berita' && news ? `"${news.text}"` : sfx.radio === 'iklan' ? '"Kecap Kelinci Emas, manisnya bikin nambah!"' : ' ', 9, COL.muted, { ox: 0.5, align: 'center', wrap: w - 30, ...R6 });
  });
}

// ================================================================ dapur seru (minigame launcher)
export function openDapurSeru(gs: GameScene) {
  const sim = gs.sim;
  const ids = Object.keys(MINIGAMES) as MiniId[];
  const m = gs.modal({ w: W(), h: 80 + ids.length * 54 + 30, title: 'DAPUR SERU', closable: true });
  m.build((mm) => {
    const w = mm.w;
    mm.text(w / 2, 28, 'Minigame singkat (maks 20 detik), sekali sehari.\nBoleh dilewati, bonusnya lumayan!', 10, COL.muted, { ox: 0.5, align: 'center', ...R6 });
    ids.forEach((id, i) => {
      const G = MINIGAMES[id];
      const y = 64 + i * 54;
      const done = miniDone(sim, id);
      mm.panel(10, y, w - 20, 50, done ? 'green' : 'paper');
      mm.text(18, y + 5, G.name, 12, T, R);
      mm.text(18, y + 21, G.desc, 8, COL.muted, { wrap: w - 130, ...R6 });
      mm.text(18, y + 35, G.effect + (gs.s.mini.best[id] ? ` · rekor ${gs.s.mini.best[id]}` : ''), 8, '#7a3a10', R6);
      mm.btn(w - 98, y + 12, 82, 26, done ? 'Besok lagi' : 'Main!', () => { mm.close(); openMinigame(gs, id); }, { kind: 'primary', size: 11, disabled: done }).setName('mini_' + id);
    });
  });
}

// ================================================================ small helpers used by other screens
export function weatherLine(gs: GameScene) {
  const s = gs.s;
  return `${WEATHER[s.weather].name}${gs.sim.isRamadan() ? ' · Ramadan' : ''}`;
}
export function gudangLine(gs: GameScene) { return `Gudang ${Math.round(pantryKg(gs.sim))}/${gudangCap(gs.sim)} kg`; }
void bar; void DISPLAY;
