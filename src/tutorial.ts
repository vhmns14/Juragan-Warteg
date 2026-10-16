// Guided first day: coach bubble (the warung's cook) + pulsing highlight on the button to press.
// Steps: MASAK -> BELANJA -> speed up -> lunch rush -> evening report -> Riset. s.tut: 0 = not started, 1..6 = step,
// 99 = done / skipped. Steps 1-2 hold the clock so the first morning doesn't slip by while the player reads.
import Phaser from 'phaser';
import type { GameScene } from './scenes/Game';
import type { Modal } from './ui';
import { GW, GH, WIDE, COL, ROUND, txt, button, bubbleGfx } from './ui';
import { charFrame } from './assets';
import { HINTS } from './data2';
import { HINTS3 } from './data3';
const HINT_ALL: Record<string, string> = { ...HINTS, ...HINTS3 };
import { sfx } from './audio';

interface Step { text: string; target: string | null }

export class Tutorial {
  private root: Phaser.GameObjects.Container | null = null;
  private hi: Phaser.GameObjects.Graphics;
  private key = '';
  private target: string | null = null;
  private nextCheck = 0;
  private seen = new Set<string>();
  // v1.3 contextual hints for the new systems: one coach bubble at a time, after the tutorial, never over a dialog
  private hintQ: string[] = [];
  private hintBox: Phaser.GameObjects.Container | null = null;
  private hintUntil = 0;
  constructor(private gs: GameScene) { this.hi = gs.add.graphics().setDepth(4590).setName('tutHi'); }
  queueHint(id: string) { if (HINT_ALL[id] && !this.hintQ.includes(id)) this.hintQ.push(id); }
  hintShowing() { return !!this.hintBox; }
  private hr: Phaser.Geom.Rectangle | null = null;
  /** final bounds of the hint bubble (its scale-in tween would report a smaller box) */
  hintRect() { return this.hintBox && this.hr ? this.hr : null; }
  closeHint() { this.hintBox?.destroy(); this.hintBox = null; }
  private updateHint() {
    const gs = this.gs;
    if (this.hintBox) {
      if (gs.modalOpen() || gs.time.now > this.hintUntil) this.closeHint();
      return;
    }
    if (!this.hintQ.length || this.active || gs.modalOpen() || this.root) return;
    const id = this.hintQ.shift()!;
    const W = Math.min(330, GW - 16);
    const label = txt(gs, 0, 0, HINT_ALL[id], 10, COL.text, { wrap: W - 120, font: ROUND, weight: '700' });
    const h = Math.max(50, label.height + 16);
    const x = gs.vcx(), y = Math.round(Math.min(gs.rushBottom + 14 + h / 2, GH - 80 - h / 2));
    const c = gs.add.container(x, y).setDepth(4600).setName('hintBubble');
    const g = gs.add.graphics(); bubbleGfx(g, W, h, 0xfff8e2, 0x2e7a3a, false, 10); c.add(g);
    c.add(gs.add.image(-W / 2 + 24, h / 2 - 3, 'chars', charFrame('cookf_f')).setOrigin(0.5, 1).setScale(0.5).setCrop(0, 0, 64, Math.min(80, 30 + h)));
    c.add(txt(gs, -W / 2 + 46, -h / 2 + 5, 'TIPS BARU', 8, '#2e7a3a', { font: ROUND, weight: '800' }));
    label.setPosition(-W / 2 + 46, -h / 2 + 15);
    c.add(label);
    const b = button(gs, W / 2 - 60, -11, 52, 22, 'Oke', () => this.closeHint(), { size: 10, kind: 'green' });
    b.setName('hintOk');
    c.add(b);
    c.setScale(0.6).setAlpha(0);
    gs.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    this.hintBox = c;
    this.hr = new Phaser.Geom.Rectangle(x - W / 2, y - h / 2, W, h);
    this.hintUntil = gs.time.now + 11000;
    sfx.event();
    gs.hideToastsIn({ x0: x - W / 2, x1: x + W / 2, y0: y - h / 2, y1: y + h / 2 });
  }
  get active() { const t = this.gs.s.tut; return t > 0 && t < 99; }
  start() { this.seen.clear(); this.key = ''; this.gs.s.tut = 1; sfx.event(); }
  skip() { this.gs.s.tut = 99; this.clear(); this.gs.toast('Tutorial dilewati. Bisa diulang dari Menu.'); }
  relayout() { this.key = ''; }
  blocking() { return this.active && this.gs.s.tut <= 2; }
  wantsReport() { return this.active && this.gs.s.tut >= 4; }
  onModalOpened(m: Modal) { const t = m.opts.title ?? ''; this.seen.add(t); if (this.gs.s.tut === 6 && t === 'RISET') { this.gs.s.tut = 99; this.clear(); this.gs.toast('Tutorial selesai! Semangat, Juragan!'); } }
  onModalClosed() {
    const s = this.gs.s;
    if (!this.active) return;
    if (s.tut === 1 && this.seen.has('MASAK') && !this.gs.modals.length) s.tut = 2;
    else if (s.tut === 2 && this.seen.has('BELANJA PASAR') && !this.gs.modals.length) s.tut = 3;
    else if (s.tut === 5 && this.seen.has('LAPORAN HARIAN') && !this.gs.modals.length) s.tut = 6;
  }
  onDayEnd() { if (this.active && this.gs.s.tut >= 3 && this.gs.s.tut <= 5) this.gs.s.tut = 5; }
  private clear() { this.root?.destroy(); this.root = null; this.hi.clear(); this.target = null; this.key = ''; }

  private find(name: string): Phaser.GameObjects.GameObject | null {
    let found: Phaser.GameObjects.GameObject | null = null;
    const walk = (list: Phaser.GameObjects.GameObject[]) => {
      for (const o of list) {
        if (o.name === name && (o as unknown as { visible?: boolean }).visible !== false && o.active) found = o;
        const c = o as Phaser.GameObjects.Container;
        if (c.list && Array.isArray(c.list)) walk(c.list);
      }
    };
    walk(this.gs.children.list);
    return found;
  }
  private inTop(o: Phaser.GameObjects.GameObject): boolean {
    const top = this.gs.modals[this.gs.modals.length - 1];
    let p: Phaser.GameObjects.Container | null = (o as unknown as { parentContainer: Phaser.GameObjects.Container | null }).parentContainer;
    let root: Phaser.GameObjects.GameObject = o;
    while (p) { root = p; p = p.parentContainer; }
    return top ? root === top.root : !this.gs.modals.length;
  }

  private step(): Step | null {
    const gs = this.gs, s = gs.s;
    const top = gs.modals[gs.modals.length - 1];
    const title = top?.opts.title ?? '';
    if (s.tut === 3 && gs.speedIdx >= 2) s.tut = 4;
    if (s.tut === 4 && s.tick >= 24) s.tut = 5;
    switch (s.tut) {
      case 1:
        if (title === 'MASAK') return { text: 'Ini rencana masak tiap pagi. Atur porsi tiap lauk pakai - / +. Lauk sisa dipanasin besok. Tutup kalau sudah oke.', target: null };
        if (top) return null;
        return { text: 'Langkah 1/4: Pagi! Cek dulu lauk apa saja yang dimasak. Tekan MASAK.', target: 'btn_masak' };
      case 2:
        if (title === 'BELANJA PASAR') return { text: 'Bahan dibeli otomatis tiap pagi sesuai rencana masak. Borong pas harga murah biar untung!', target: null };
        if (top) return null;
        return { text: 'Langkah 2/4: Harga bahan di pasar naik-turun tiap minggu. Tekan BELANJA.', target: 'btn_belanja' };
      case 3:
        if (top) return null;
        return { text: 'Langkah 3/4: Warung buka! Percepat waktu pakai tombol 2x / 4x di atas.', target: 'speed2' };
      case 4:
        if (top) return null;
        return { text: 'Tunggu jam makan siang (11:00). Pelanggan bakal rame. Antrian kepanjangan = ada yang kabur!', target: 'rushCard' };
      case 5:
        if (top) return null;
        return { text: 'Jam makan siang! Lihat popup +Rp di atas pelanggan. Habis tutup jam 22:00 ada laporan harian.', target: null };
      case 6:
        if (top) return null;
        return { text: 'Langkah 4/4: Poin Warung (lampu) dipakai buat riset resep & paket combo. Buka RISET.', target: WIDE && GW >= 900 ? 'btn_riset' : 'btn_menu' };
    }
    return null;
  }

  update() {
    const gs = this.gs;
    this.updateHint();
    if (!this.active) { if (this.root || this.target) this.clear(); return; }
    const now = gs.time.now;
    if (now >= this.nextCheck) {
      this.nextCheck = now + 200;
      const st = this.step();
      const key = st ? `${gs.s.tut}|${st.text}|${st.target}|${GW}|${GH}|${gs.modalOpen()}` : '';
      if (key !== this.key) { this.key = key; this.show(st); }
    }
    this.drawHi();
  }

  private show(st: Step | null) {
    const gs = this.gs;
    this.root?.destroy(); this.root = null;
    this.target = st?.target ?? null;
    if (!st) return;
    const docked = gs.modalOpen();
    const W = docked ? Math.min(356, GW - 4) : Math.min(330, GW - 16);
    const label = txt(gs, 0, 0, st.text, docked ? 10 : 11, COL.text, { wrap: W - (docked ? 124 : 74), font: ROUND, weight: '700' });
    const h = docked ? Math.max(44, label.height + 12) : Math.max(56, label.height + 34);
    let x = docked ? GW / 2 : gs.vcx();
    let y = docked ? h / 2 + 3 : Math.round(gs.rushBottom + 12 + h / 2);
    if (!docked && this.target === 'rushCard') y = Math.round(gs.rushBottom + 30 + h / 2);
    if (docked) { const sl = gs.toastSlot(W, h); if (sl && !sl.wrap) { x = sl.x; y = sl.y; } }
    const c = gs.add.container(Math.round(x), Math.round(y)).setDepth(4600).setName('tutBubble');
    const g = gs.add.graphics(); bubbleGfx(g, W, h, 0xfff8e2, 0x7a3a10, false, 10); c.add(g);
    c.add(gs.add.image(-W / 2 + 26, h / 2 - (docked ? 2 : 6), 'chars', charFrame('cookf_f')).setOrigin(0.5, 1).setScale(docked ? 0.5 : 0.62).setCrop(0, 0, 64, docked ? 70 : 80));
    label.setPosition(-W / 2 + (docked ? 48 : 54), docked ? -label.height / 2 : -h / 2 + 8);
    c.add(label);
    const done = this.gs.s.tut === 6;
    const bw = 62;
    const b = button(gs, W / 2 - bw - 8, docked ? -11 : h / 2 - 24, bw, 22, done ? 'Selesai' : 'Lewati', () => { if (done) { gs.s.tut = 99; this.clear(); sfx.levelup(); } else this.skip(); }, { size: 9 });
    b.setName(done ? 'tutDone' : 'tutSkip');
    c.add(b);
    c.setScale(0.6).setAlpha(0);
    gs.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    this.root = c;
    gs.hideToastsIn({ x0: c.x - W / 2, x1: c.x + W / 2, y0: c.y - h / 2, y1: c.y + h / 2 });
  }

  private drawHi() {
    const g = this.hi;
    g.clear();
    if (!this.target) return;
    const t = this.find(this.target);
    if (!t || !this.inTop(t)) return;
    const b = (t as unknown as { getBounds: () => Phaser.Geom.Rectangle }).getBounds();
    if (!b || b.width < 2) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.gs.time.now / 180);
    const pad = 3 + pulse * 3;
    g.lineStyle(3, 0xffe066, 0.95); g.strokeRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 9);
    g.lineStyle(1.5, 0xe0402a, 0.9); g.strokeRoundedRect(b.x - pad - 2.5, b.y - pad - 2.5, b.width + pad * 2 + 5, b.height + pad * 2 + 5, 11);
    const ax = b.centerX, above = b.y > 70;
    const ay = above ? b.y - pad - 6 - pulse * 5 : b.bottom + pad + 6 + pulse * 5;
    g.fillStyle(0x2b1a10, 1);
    if (above) g.fillTriangle(ax - 10, ay - 12, ax + 10, ay - 12, ax, ay + 1); else g.fillTriangle(ax - 10, ay + 12, ax + 10, ay + 12, ax, ay - 1);
    g.fillStyle(0xffe066, 1);
    if (above) g.fillTriangle(ax - 7, ay - 10, ax + 7, ay - 10, ax, ay - 1); else g.fillTriangle(ax - 7, ay + 10, ax + 7, ay + 10, ax, ay + 1);
  }
}
