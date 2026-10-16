// Wide-screen side panels (desktop / landscape). Left: Warung Saya + stats, Menu Favorit (stock bars), Staf Warung.
// Right: Pesanan Ojol, Tanggal Tua / Harga bahan meters, Ulasan Pelanggan, Prestasi, controls + credit.
// 'both' (only room for one panel): warung, menu favorit, ojol, ulasan.
import Phaser from 'phaser';
import type { GameScene } from './scenes/Game';
import { COL, ROUND, DISPLAY, txt, button, bar, drawPanel, type PanelKind } from './ui';
import { DISH, ROLES, OJOL_APPS, STAGES } from './data';
import { fmtShort, fmtNum } from './state';
import { charFrame, dishTex } from './assets';
import * as screens from './screens';
import { ACHIEVEMENTS } from './achievements';
import { sfx } from './audio';
import * as screens2 from './screens2';
import { WEATHER } from './data2';

export const SIDE_W = 236;
const ROW = '#4a2208';
const cut = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);

export class SidePanel {
  root: Phaser.GameObjects.Container;
  private sig = '';
  constructor(private gs: GameScene, public mode: 'left' | 'right' | 'both', public x: number, public y: number, public w: number, public h: number) {
    this.root = gs.add.container(0, 0).setDepth(995).setName('sidePanel_' + mode);
  }
  destroy() { this.root.destroy(); }
  refresh(force = false) {
    const gs = this.gs, s = gs.s, sim = gs.sim;
    const sig = [this.mode, Math.round(s.money / 5e4), s.fans, s.poin, s.stage, s.absDay, s.cabang.length,
      Object.entries(s.stock).map(([k, v]) => k + Math.round(v.fresh + v.old)).join(','),
      s.staff.map((x) => `${x.id}:${Math.round(x.energy / 5)}:${x.level}:${x.off ?? 0}`).join(','),
      s.orders.map((o) => o.id + o.state + o.left).join(','), s.reviewSeq, Object.keys(s.achievements).length,
      Math.round(sim.tua() * 20), Math.round(sim.ingIndex() * 20), s.today.customers, s.weather, s.news.length, sfx.radio, this.mode === 'right' ? Math.floor(Date.now() / 7000) : 0].join('|');
    if (sig === this.sig && !force) return;
    this.sig = sig;
    this.build();
  }
  private add<T extends Phaser.GameObjects.GameObject>(o: T): T { this.root.add(o); return o; }
  private panel(x: number, y: number, w: number, h: number, kind: PanelKind = 'paper') { const g = this.gs.add.graphics(); drawPanel(g, x, y, w, h, kind); return this.add(g); }
  private t(x: number, y: number, s: string, size: number, color: string = ROW, o: Parameters<typeof txt>[6] = {}) { return this.add(txt(this.gs, x, y, s, size, color, { font: ROUND, weight: '800', ...o })); }
  private tap(x: number, y: number, w: number, h: number, fn: () => void, name?: string) {
    const z = this.add(this.gs.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    if (name) z.setName(name);
    z.on('pointerup', () => { if (this.gs.modalOpen() || this.gs.dragMoved) return; sfx.click(); fn(); });
    return z;
  }
  private header(x: number, y: number, label: string) { this.t(x, y, label, 10, '#b04a1a', { font: DISPLAY, weight: 'normal' }); }

  private build() {
    const gs = this.gs;
    this.root.removeAll(true);
    const { x, y, w, h } = this;
    this.add(gs.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive());
    this.panel(x, y, w, h, 'cream');
    const bottom = y + h - 8;
    let cy = y + 8;
    const compact = h < 360;
    if (this.mode === 'left') {
      cy = this.warungBlock(cy, compact);
      const rest = bottom - cy;
      const menuRows = Math.max(2, Math.min(6, Math.floor((rest - 60 - 34) / 2 / 18)));
      cy = this.menuBlock(cy, menuRows);
      this.staffBlock(cy, bottom);
    } else if (this.mode === 'right') {
      const footH = h >= 460 ? 92 : 40;
      cy = this.ojolBlock(cy, h < 380 ? 2 : 4);
      cy = this.metersBlock(cy);
      cy = this.feedBlock(cy, bottom - footH - 4);
      this.footBlock(bottom - footH, h >= 460);
    } else {
      cy = this.warungBlock(cy, true);
      cy = this.menuBlock(cy, compact ? 2 : 3);
      cy = this.ojolBlock(cy, 2);
      this.feedBlock(cy, bottom);
    }
  }

  private warungBlock(cy: number, compact: boolean): number {
    const gs = this.gs, s = gs.s, sim = gs.sim, { x, w } = this;
    this.panel(x + 8, cy, w - 16, 40, 'dark');
    this.t(x + w / 2, cy + 13, 'WARUNG SAYA', 11, '#fff6e0', { ox: 0.5, oy: 0.5, font: DISPLAY, weight: 'normal', stroke: '#3a1c08', strokeW: 3 });
    this.t(x + w / 2, cy + 29, cut(`${s.name} · ${s.franchise ? 'Franchise' : STAGES[s.stage - 1].name}`, 34), 9, '#f6d9a8', { ox: 0.5, oy: 0.5, weight: '600' });
    this.tap(x + 8, cy, w - 16, 40, () => screens.openWarung(gs), 'side_warung');
    cy += 46;
    const stats: [string, string, string][] = [
      ['Kas', fmtShort(s.money), s.money < 0 ? COL.red : '#2e8b3a'],
      ['Pelanggan Harian', String(s.yesterday?.customers ?? s.today.customers), ROW],
      ['Biaya / bln', fmtShort(sim.monthlyCosts()), ROW],
      ['Poin Warung', String(s.poin), ROW],
    ];
    const sw = (w - 22) / 2, sh = compact ? 28 : 32;
    stats.forEach(([label, val, col], i) => {
      const sx = x + 8 + (i % 2) * (sw + 6), sy = cy + Math.floor(i / 2) * (sh + 4);
      this.panel(sx, sy, sw, sh, 'paper');
      this.t(sx + 7, sy + 3, label, 8, COL.muted, { weight: '600' });
      this.t(sx + 7, sy + (compact ? 13 : 15), val, compact ? 10 : 11, col);
    });
    this.tap(x + 8, cy, w - 16, sh * 2 + 4, () => screens.openInfo(gs, 0), 'side_stats');
    return cy + sh * 2 + 10;
  }

  private menuBlock(cy: number, rows: number): number {
    const gs = this.gs, s = gs.s, sim = gs.sim, { x, w } = this;
    this.header(x + 12, cy, 'MENU FAVORIT');
    cy += 15;
    const sold = s.today.sold;
    const ids = Object.keys(s.menu).filter((id) => DISH[id] && s.unlocked.includes(id) && id !== 'esteh' && id !== 'kerupuk')
      .sort((a, b) => (sold[b] ?? 0) - (sold[a] ?? 0) || (s.menu[b] ?? 0) - (s.menu[a] ?? 0)).slice(0, rows);
    const h = Math.max(1, ids.length) * 18 + 8;
    this.panel(x + 8, cy, w - 16, h, 'paper');
    if (!ids.length) this.t(x + 16, cy + 6, 'Menu kosong. Atur di MASAK.', 9, COL.muted, { weight: '600' });
    ids.forEach((id, i) => {
      const ry = cy + 4 + i * 18;
      this.add(gs.add.image(x + 22, ry + 8, ...dishTex(DISH[id].icon)).setScale(0.32));
      this.t(x + 34, ry + 2, cut(DISH[id].name, 15), 10, ROW, { weight: '700' });
      const n = sim.totalStock(id), want = Math.max(1, s.menu[id] ?? 1);
      this.add(bar(gs, x + w - 82, ry + 6, 44, 6, n / want, n === 0 ? 0xc0392b : n / want < 0.25 ? 0xf6a020 : 0x6ac46a));
      this.t(x + w - 16, ry + 2, String(Math.round(n)), 10, n === 0 ? COL.red : ROW, { ox: 1 });
    });
    this.tap(x + 8, cy, w - 16, h, () => screens.openMasak(gs), 'side_menu');
    return cy + h + 8;
  }

  private staffBlock(cy: number, bottom: number) {
    const gs = this.gs, s = gs.s, { x, w } = this;
    this.header(x + 12, cy, 'STAF WARUNG');
    cy += 15;
    const btnH = 26;
    const avail = bottom - cy - btnH - 6;
    const rowH = 24;
    const rows = Math.max(1, Math.floor((avail - 8) / rowH));
    const list = s.staff.slice(0, rows);
    const h = Math.max(1, list.length) * rowH + 8;
    this.panel(x + 8, cy, w - 16, h, 'paper');
    list.forEach((st, i) => {
      const ry = cy + 4 + i * rowH;
      const head = gs.add.image(x + 22, ry + 22, 'chars', charFrame(st.sprite + '_f')).setOrigin(0.5, 1).setScale(0.3);
      head.setCrop(0, 0, 64, 52);
      this.add(head);
      this.t(x + 36, ry + 1, cut(st.name, 13), 10, ROW, { weight: '700' });
      this.t(x + 36, ry + 12, `${ROLES[st.role].short} · Lv${st.level}${st.off ? (st.mudik ? ' · mudik' : ' · libur') : ''}`, 8, COL.muted, { weight: '600' });
      this.add(bar(gs, x + w - 74, ry + 9, 56, 6, st.energy / 100, st.energy < 30 ? 0xc0392b : st.energy < 60 ? 0xf6a020 : 0x6ac46a));
      this.tap(x + 8, ry, w - 16, rowH, () => screens.openStaffDetail(gs, st), 'side_staff' + i);
    });
    if (s.staff.length > rows) this.t(x + w - 16, cy + h - 12, `+${s.staff.length - rows} lagi`, 8, COL.muted, { ox: 1, weight: '600' });
    this.add(button(gs, x + 8, Math.min(bottom - btnH, cy + h + 6), w - 16, btnH, 'Rekrut / Training Staf', () => { if (!gs.modalOpen()) screens.openStaff(gs); }, { kind: 'primary', size: 11 })).setName('side_rekrut');
  }

  private ojolBlock(cy: number, rows: number): number {
    const gs = this.gs, s = gs.s, { x, w } = this;
    this.header(x + 12, cy, 'PESANAN OJOL');
    cy += 15;
    const list = s.orders.filter((o) => o.state === 'wait' || o.state === 'pickup').slice(0, rows);
    const h = Math.max(1, list.length) * 20 + 8;
    this.panel(x + 8, cy, w - 16, h, 'paper');
    const joined = Object.values(s.apps).some((a) => a.joined);
    if (!list.length) this.t(x + 16, cy + 6, joined ? 'Belum ada pesanan masuk.' : 'Belum gabung aplikasi ojol.', 9, COL.muted, { weight: '600' });
    list.forEach((o, i) => {
      const ry = cy + 4 + i * 20;
      const app = OJOL_APPS.find((a) => a.id === o.app)!;
      const g = gs.add.graphics(); g.fillStyle(app.color, 1); g.fillRoundedRect(x + 14, ry + 2, 50, 14, 4); this.add(g);
      this.t(x + 39, ry + 9, app.name, 8, '#ffffff', { ox: 0.5, oy: 0.5 });
      this.t(x + 68, ry + 3, cut(o.items.map((d) => DISH[d].name).join(', '), 18), 9, ROW, { weight: '600' });
      this.t(x + w - 16, ry + 3, o.state === 'pickup' ? 'Diambil' : `${o.left * 15}m`, 9, o.state === 'pickup' ? '#2e8b3a' : '#b04a1a', { ox: 1 });
    });
    this.tap(x + 8, cy, w - 16, h, () => screens.openPromosi(gs, 1), 'side_ojol');
    return cy + h + 8;
  }

  private metersBlock(cy: number): number {
    const gs = this.gs, sim = gs.sim, { x, w } = this;
    const s = gs.s;
    this.panel(x + 8, cy, w - 16, 70, 'paper');
    const tua = sim.tua(), d = sim.date;
    this.t(x + 16, cy + 5, d.dom <= 5 ? 'GAJIAN!' : 'TANGGAL TUA', 10, d.dom <= 5 ? '#2e8b3a' : '#b04a1a', { font: DISPLAY, weight: 'normal' });
    this.t(x + w - 16, cy + 5, `${WEATHER[s.weather].name} · tgl ${d.dom}`, 9, s.weather === 'hujan' ? COL.blue : s.weather === 'panas' ? '#c0502a' : COL.muted, { ox: 1, weight: '700' }).setName('side_weather');
    this.add(bar(gs, x + 16, cy + 18, w - 32, 7, d.dom <= 5 ? 0.02 : tua, 0xe8701a));
    const idx = sim.ingIndex();
    this.t(x + 16, cy + 29, 'Harga bahan', 9, ROW, { weight: '700' });
    this.t(x + w - 16, cy + 29, `${idx >= 1 ? '+' : ''}${Math.round((idx - 1) * 100)}%`, 9, idx > 1.08 ? COL.red : idx < 0.95 ? COL.green : ROW, { ox: 1 });
    this.add(bar(gs, x + 16, cy + 41, w - 32, 7, Math.min(1, (idx - 0.6) / 1.0), idx > 1.08 ? 0xd0402e : 0x6ac46a));
    const news = [...s.news].reverse();
    const n = news.length ? news[Math.floor(Date.now() / 7000) % Math.min(4, news.length)] : null;
    this.t(x + 16, cy + 53, cut(n ? n.text : 'Kabar pasar: harga adem ayem.', 40), 8, n?.kind === 'shock' ? COL.red : COL.muted, { weight: '700' }).setName('side_news');
    this.tap(x + 8, cy, w - 16, 70, () => screens.openBelanja(gs), 'side_meters');
    return cy + 76;
  }

  private feedBlock(cy: number, bottom: number): number {
    const gs = this.gs, s = gs.s, { x, w } = this;
    if (bottom - cy < 40) return cy;
    this.header(x + 12, cy, 'ULASAN PELANGGAN');
    cy += 15;
    const h = bottom - cy;
    this.panel(x + 8, cy, w - 16, h, 'paper');
    let yy = cy + 6;
    const rv = [...s.reviews].reverse();
    if (!rv.length) this.t(x + 16, yy, 'Belum ada ulasan. Buka dulu warungnya!', 9, COL.muted, { weight: '600', wrap: w - 32 });
    for (const r of rv) {
      const body = txt(gs, x + 16, yy + 12, r.text, 9, ROW, { font: ROUND, weight: '600', wrap: w - 32 });
      if (yy + 12 + body.height > cy + h - 4) { body.destroy(); break; }
      this.t(x + 16, yy, '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars), 9, '#e8a020');
      this.t(x + 72, yy, cut(r.name, 20), 9, '#b04a1a');
      this.add(body);
      yy += 16 + body.height;
    }
    this.tap(x + 8, cy, w - 16, h, () => screens.openUlasan(gs), 'side_feed');
    s.reviewRead = s.reviewSeq;
    return cy + h + 6;
  }

  private footBlock(cy: number, tips: boolean) {
    const gs = this.gs, s = gs.s, { x, w } = this;
    const n = Object.keys(s.achievements).length;
    this.add(button(gs, x + 8, cy, w - 98, 28, `PRESTASI ${n}/${ACHIEVEMENTS.length}`, () => { if (!gs.modalOpen()) screens.openPrestasi(gs); }, { kind: 'gold', size: 11 })).setName('side_prestasi');
    this.add(button(gs, x + w - 86, cy, 78, 28, `Radio: ${screens2.radioLabel(sfx.radio)}`, () => { if (!gs.modalOpen()) screens2.openRadio(gs); }, { size: 9 })).setName('side_radio');
    if (tips) {
      this.t(x + 14, cy + 36, 'Roda mouse: zoom · Seret / WASD: geser', 8, COL.muted, { weight: '600' });
      this.t(x + 14, cy + 48, 'Spasi: jeda · Esc: tutup jendela', 8, COL.muted, { weight: '600' });
      this.t(x + w / 2, cy + 68, 'Dibuat oleh KodeKecil · kodekecil.my.id', 8, '#b04a1a', { ox: 0.5 });
    }
    void fmtNum;
  }
}
