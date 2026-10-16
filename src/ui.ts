// UI toolkit: panels, buttons, text, modals. Logical coordinates: GH = 640 tall, GW = 360 on phones and wider on
// wide screens (v5 responsive layout).
import Phaser from 'phaser';
import { sfx } from './audio';

/** logical game size. GH is fixed; GW is 360 on phones (portrait) and widens with the viewport aspect on wide screens
 *  (desktop / laptop / tablet landscape). ES live binding: importers always see the current value. */
export let GW = 360;
/** logical height: 640 (the design height) except on short landscape windows, where it shrinks so the canvas is not
 *  uniformly downscaled (text keeps >= ~1.2 CSS px per logical px; see layoutFor) */
export let GH = 640;
/** the design height every screen / dialog was drawn for */
export const DH = 640;
/** top of the bottom bar (GH - 70) */
export let BAR_Y = 570;
export function setGH(h: number) { GH = Math.max(MIN_GH, Math.min(MAX_GH, Math.round(h))); BAR_Y = GH - 70; }
/** tall portrait phones (19.5:9) get a taller logical height instead of letterboxing */
export const MAX_GH = 780;
/** smallest logical height (phone landscape): HUD 50 + bottom bar 70 + ~200 of studio */
export const MIN_GH = 320;
/** below this many CSS px of window height the layout shrinks GH instead of scaling the canvas down */
export const SHORT_SCALE = 1.2;
/** the phone-width column every 360-wide screen was designed for */
export const PW = 360;
/** x of the 360-wide design column, centred in the current GW (0 on phones) */
export let CX0 = 0;
/** true when the layout is wider than the phone column */
export let WIDE = false;
export function setGW(w: number) { GW = Math.max(PW, Math.round(w)); CX0 = Math.round((GW - PW) / 2); WIDE = GW > PW + 8; }
/** logical width for a viewport (CSS px): phones / narrow windows keep the 360 column, wide screens widen */
export function gwFor(vw: number, vh: number, gh = GH) {
  const a = vw / Math.max(1, vh);
  if (a < 0.62) return PW;
  return Math.min(Math.round(gh * 2.4), Math.max(PW, Math.round(gh * a)));
}
/** v5.1 logical size for a viewport (CSS px). Tall windows keep GH 640 (as before). Short landscape windows
 *  (laptops with a docked browser, 1366x600, phones in landscape 844x390) get a smaller logical height so one logical
 *  px stays >= SHORT_SCALE CSS px: 10 px text renders >= 12 px, the smallest 9 px labels ~11 px. Only for the wide
 *  layout (the 360 phone column is width-limited and keeps 640). */
export function layoutFor(vw: number, vh: number): { gw: number; gh: number } {
  vw = Math.max(1, vw || 360); vh = Math.max(1, vh || 640);
  if (vh < DH * SHORT_SCALE) {
    const gh = Math.max(MIN_GH, Math.min(DH, Math.round(vh / SHORT_SCALE)));
    const gw = gwFor(vw, vh, gh);
    if (gw > PW + 8) return { gw, gh };
  }
  const gw = gwFor(vw, vh, DH);
  // portrait phone column: use the extra height of tall screens (no letterbox bands)
  if (gw === PW && vh / vw > DH / PW) return { gw, gh: Math.min(MAX_GH, Math.round(PW * vh / vw)) };
  return { gw, gh: DH };
}
export const ZOOM = { z: 2 };
export const FONT = '"Pixelify Sans", "Courier New", monospace';
export const DISPLAY = 'Silkscreen, "Pixelify Sans", monospace';
/** rounded, chunky font for the HUD, bubbles, big numbers */
export const ROUND = '"Baloo 2", "Pixelify Sans", sans-serif';

export const COL = {
  out: 0x2b1a10, brown: 0x9a5a2a, brownD: 0x6a3a18, cream: 0xfbecc8, creamHi: 0xfff8e2, creamLo: 0xe8d0a0,
  text: '#4a2a12', textLight: '#fff6e0', red: '#c0392b', green: '#2e8b3a', gold: '#f6c440', blue: '#2d6cb0', muted: '#8a6a4a',
};

export type PanelKind = 'cream' | 'btn' | 'btnDown' | 'primary' | 'primaryDown' | 'disabled' | 'dark' | 'red' | 'gold' | 'paper' | 'green' | 'greenDown' | 'sel';

const KINDS: Record<PanelKind, { border: number; fill: number; hi: number; lo: number }> = {
  cream: { border: 0x9a5a2a, fill: 0xfbecc8, hi: 0xfff8e2, lo: 0xe8d0a0 },
  paper: { border: 0xc09a6a, fill: 0xf8ead0, hi: 0xfffaf0, lo: 0xeedcbc },
  btn: { border: 0x9a5a2a, fill: 0xf6e0b0, hi: 0xfff6dc, lo: 0xd8b880 },
  btnDown: { border: 0x9a5a2a, fill: 0xe6c890, hi: 0xd8b880, lo: 0xf0d8a8 },
  sel: { border: 0xb0402a, fill: 0xffd27a, hi: 0xfff0b8, lo: 0xe0a848 },
  primary: { border: 0x9a3a1a, fill: 0xf08a3a, hi: 0xffbe7a, lo: 0xc8642a },
  primaryDown: { border: 0x9a3a1a, fill: 0xd06a2a, hi: 0xc05a20, lo: 0xe08a4a },
  green: { border: 0x2a6a2a, fill: 0x6ac46a, hi: 0xa8e8a0, lo: 0x4a9a4a },
  greenDown: { border: 0x2a6a2a, fill: 0x4a9a4a, hi: 0x3a8a3a, lo: 0x6ab46a },
  disabled: { border: 0x8a7a6a, fill: 0xcfc4b0, hi: 0xddd4c4, lo: 0xb8ac98 },
  dark: { border: 0x5a3418, fill: 0x7a4a22, hi: 0x9a6a3a, lo: 0x5a3418 },
  red: { border: 0x7a1a12, fill: 0xd0402e, hi: 0xf07a5a, lo: 0xa02a1e },
  gold: { border: 0x9a6a10, fill: 0xf6c440, hi: 0xfff09a, lo: 0xd09a20 },
};

export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, kind: PanelKind = 'cream') {
  const k = KINDS[kind];
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const r = Math.max(1, Math.min(7, Math.floor(h / 2) - 1, Math.floor(w / 2) - 1));
  g.fillStyle(COL.out, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(k.border, 1);
  g.fillRoundedRect(x + 1, y + 1, w - 2, h - 2, Math.max(1, r - 1));
  g.fillStyle(k.lo, 1);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, Math.max(1, r - 2));
  g.fillStyle(k.fill, 1);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h - 7, Math.max(1, r - 2));
  if (h > 12 && w > 12) {
    g.fillStyle(k.hi, 1);
    g.fillRoundedRect(x + 5, y + 4, w - 10, Math.min(4, Math.max(1, Math.floor(h / 8))), 1.5);
  }
}

export interface TextOpts {
  font?: string; stroke?: string; strokeW?: number; align?: 'left' | 'center' | 'right';
  wrap?: number; ox?: number; oy?: number; bold?: boolean; lineSpacing?: number; weight?: string;
  /** extra texture resolution (world text that the zoomable studio camera magnifies) */
  res?: number;
}
export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size = 10, color: string = COL.text, o: TextOpts = {}): Phaser.GameObjects.Text {
  const t = scene.add.text(Math.round(x), Math.round(y), s, {
    fontFamily: o.font ?? FONT,
    fontSize: size + 'px',
    fontStyle: o.weight ?? (o.bold ? 'bold' : 'normal'),
    color,
    align: o.align ?? 'left',
    stroke: o.stroke ?? undefined,
    strokeThickness: o.strokeW ?? (o.stroke ? 2 : 0),
    wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
    lineSpacing: o.lineSpacing ?? 1,
    resolution: Math.min(6, ZOOM.z * (o.res ?? 1)),
  });
  t.setOrigin(o.ox ?? 0, o.oy ?? 0);
  return t;
}

export interface BtnOpts {
  kind?: PanelKind; size?: number; icon?: string; iconScale?: number; disabled?: boolean; color?: string; font?: string; sound?: boolean; iconAbove?: boolean;
}
export type Btn = Phaser.GameObjects.Container & { setLabel?: (s: string) => void };

/** set while the player drags a scrolling dialog: a button released at the end of a drag must not fire */
export const DRAG = { moved: false };

export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, o: BtnOpts = {}): Btn {
  const c = scene.add.container(Math.round(x), Math.round(y)) as Btn;
  const g = scene.add.graphics();
  const base: PanelKind = o.disabled ? 'disabled' : (o.kind ?? 'btn');
  const down: PanelKind = base === 'primary' ? 'primaryDown' : base === 'green' ? 'greenDown' : base === 'disabled' ? 'disabled' : 'btnDown';
  drawPanel(g, 0, 0, w, h, base);
  c.add(g);
  const color = o.disabled ? '#8a7a6a' : (o.color ?? (base === 'primary' || base === 'red' || base === 'green' || base === 'dark' ? '#fff8e8' : COL.text));
  const bf = o.font ?? ROUND;
  const bw = o.font ? undefined : '800';
  const stroke = (base === 'primary' || base === 'red' || base === 'green' || base === 'dark') ? '#4a1e0a' : undefined;
  let icon: Phaser.GameObjects.Image | null = null;
  let t: Phaser.GameObjects.Text;
  if (o.icon && o.iconAbove) {
    icon = scene.add.image(w / 2, h / 2 - 7, o.icon).setOrigin(0.5).setScale(o.iconScale ?? 1);
    t = txt(scene, w / 2, h - 6, label, o.size ?? 11, color, { ox: 0.5, oy: 1, font: bf, weight: bw, stroke, strokeW: stroke ? 3 : 0 });
    c.add(icon);
  } else if (o.icon) {
    icon = scene.add.image(8, h / 2, o.icon).setOrigin(0, 0.5).setScale(o.iconScale ?? 1);
    c.add(icon);
    const iw = icon.displayWidth + 12;
    t = txt(scene, iw + (w - iw) / 2 - 2, h / 2, label, o.size ?? 11, color, { ox: 0.5, oy: 0.5, font: bf, weight: bw, stroke, strokeW: stroke ? 3 : 0 });
  } else {
    t = txt(scene, w / 2, h / 2, label, o.size ?? 11, color, { ox: 0.5, oy: 0.5, font: bf, weight: bw, stroke, strokeW: stroke ? 3 : 0, align: 'center' });
  }
  c.add(t);
  c.setLabel = (s: string) => t.setText(s);
  const z = scene.add.zone(0, 0, w, h).setOrigin(0, 0);
  c.add(z);
  if (!o.disabled) {
    z.setInteractive({ useHandCursor: true });
    let pressed = false;
    const ty = t.y, iy = icon ? icon.y : 0;
    const resetY = () => { t.y = ty; if (icon) icon.y = iy; };
    const up = () => { pressed = false; g.clear(); drawPanel(g, 0, 0, w, h, base); resetY(); };
    z.on('pointerdown', () => { pressed = true; g.clear(); drawPanel(g, 0, 0, w, h, down); t.y = ty + 1; if (icon) icon.y = iy + 1; });
    z.on('pointerout', () => { if (pressed) up(); });
    z.on('pointerup', () => {
      if (!pressed) return;
      up();
      if (DRAG.moved) return;
      if (o.sound !== false) sfx.click();
      onClick();
    });
  } else {
    z.setInteractive();
    z.on('pointerup', () => sfx.back());
  }
  return c;
}

/** rounded bubble (speech/label) centred on 0,0 with an optional tail at the bottom */
export function bubbleGfx(g: Phaser.GameObjects.Graphics, w: number, h: number, fill = 0xffffff, border = COL.out, tail = true, r = 7) {
  const x = -w / 2, y = -h / 2;
  g.fillStyle(0x000000, 0.25); g.fillRoundedRect(x + 1, y + 2, w, h, r);
  g.fillStyle(border, 1); g.fillRoundedRect(x - 1.5, y - 1.5, w + 3, h + 3, r + 1);
  if (tail) { g.fillTriangle(-5, h / 2 - 1, 5, h / 2 - 1, 0, h / 2 + 6); }
  g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h, r);
  if (tail) { g.fillTriangle(-3.5, h / 2 - 1, 3.5, h / 2 - 1, 0, h / 2 + 4); }
  g.fillStyle(0xffffff, 0.45); g.fillRoundedRect(x + 3, y + 2, w - 6, Math.max(2, h * 0.28), Math.min(r, h * 0.14));
}

/** rounded wooden/cream pill used by the HUD */
export function pill(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill = 0xfff3d6, border = 0x5a3010) {
  const r = Math.min(10, h / 2);
  g.fillStyle(0x000000, 0.3); g.fillRoundedRect(x, y + 2, w, h, r);
  g.fillStyle(border, 1); g.fillRoundedRect(x - 1.5, y - 1.5, w + 3, h + 3, r + 1);
  g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(0xffffff, 0.5); g.fillRoundedRect(x + 3, y + 2, w - 6, h * 0.3, r * 0.6);
}

/** wooden plank strip (HUD / bottom bar) */
export function woodStrip(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(0x3a200c, 1); g.fillRect(x, y, w, h);
  const planks = Math.max(1, Math.round(h / 16));
  const ph = (h - 4) / planks;
  for (let i = 0; i < planks; i++) {
    const py = y + 2 + i * ph;
    g.fillStyle(i % 2 ? 0x9a5a2a : 0xa8662f, 1); g.fillRect(x, py, w, ph - 1);
    g.fillStyle(0xc88446, 1); g.fillRect(x, py, w, 1);
    g.fillStyle(0x7a4420, 1); g.fillRect(x, py + ph - 2, w, 1);
    // grain + nails
    for (let gx = x + ((i * 37) % 50); gx < x + w; gx += 53) { g.fillStyle(0x8a4e24, 1); g.fillRect(gx, py + ph * 0.45, Math.min(18, x + w - gx), 1); }
    for (let nx = x + 8 + (i % 2) * 60; nx < x + w; nx += 120) { g.fillStyle(0x5a3010, 1); g.fillRect(nx, py + 3, 2, 2); }
  }
}

export function bar(scene: Phaser.Scene, x: number, y: number, w: number, h: number, frac: number, color: number, bg = 0x5a3418): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COL.out, 1); g.fillRect(x, y, w, h);
  g.fillStyle(bg, 1); g.fillRect(x + 1, y + 1, w - 2, h - 2);
  const fw = Math.max(0, Math.min(1, frac)) * (w - 2);
  g.fillStyle(color, 1); g.fillRect(x + 1, y + 1, Math.round(fw), h - 2);
  g.fillStyle(0xffffff, 0.35); g.fillRect(x + 1, y + 1, Math.round(fw), 1);
  return g;
}

// ------------------------------------------------------------------ modals
export interface ModalOpts {
  w?: number; h?: number; y?: number; title?: string; closable?: boolean; onClose?: () => void; kind?: PanelKind; dim?: number; noPanel?: boolean;
}

export class Modal {
  /** every open dialog (all scenes), newest last: only the top one scrolls */
  static open: Modal[] = [];
  static top(): Modal | null {
    Modal.open = Modal.open.filter((m) => !m.closed && !!m.root.scene);
    return Modal.open[Modal.open.length - 1] ?? null;
  }
  scene: Phaser.Scene;
  root: Phaser.GameObjects.Container;
  content!: Phaser.GameObjects.Container;
  x: number; y: number; w: number; h: number;
  opts: ModalOpts;
  private builder: ((m: Modal) => void) | null = null;
  closed = false;
  closeBtn: Phaser.GameObjects.Container | null = null;
  onClosed: (() => void) | null = null;
  /** v5.1 short windows: a dialog taller than the screen scrolls (wheel / drag / arrows / PgUp-PgDn) */
  scroll = 0;
  maxScroll = 0;
  private dim: Phaser.GameObjects.Rectangle;
  private sbar: Phaser.GameObjects.Graphics | null = null;
  private offs: (() => void)[] = [];

  constructor(scene: Phaser.Scene, depth: number, o: ModalOpts = {}) {
    this.scene = scene;
    this.opts = o;
    this.w = o.w ?? 336; this.h = o.h ?? 420;
    if (o.noPanel) this.h = DH;
    this.x = Math.round((GW - this.w) / 2);
    const top = o.title ? 14 : 6;
    let y = o.noPanel ? 0 : Math.round(o.y ?? (GH - this.h) / 2);
    // keep the whole dialog (title tab included) on screen; when it can't fit it starts at the top and scrolls
    if (!o.noPanel && (y < top || y + this.h > GH - 4)) y = Math.max(top, Math.min(y, GH - 4 - this.h));
    this.y = y;
    this.root = scene.add.container(0, 0).setDepth(depth);
    // wide enough to stay full-screen after a live resize (the root is shifted, not rebuilt)
    const dim = scene.add.rectangle(-2400, -400, GW + 4800, GH + 800, 0x1a0e06, o.dim ?? 0.6).setOrigin(0, 0).setName('modalDim');
    dim.setInteractive();
    this.dim = dim;
    this.root.add(dim);
    if (!o.noPanel) {
      const g = scene.add.graphics();
      drawPanel(g, this.x, this.y, this.w, this.h, o.kind ?? 'cream');
      this.root.add(g);
      if (o.title) {
        const tg = scene.add.graphics();
        const tw = Math.min(this.w - 20, Math.max(120, o.title.length * 8 + 30));
        drawPanel(tg, this.x + (this.w - tw) / 2, this.y - 10, tw, 22, 'red');
        this.root.add(tg);
        this.root.add(txt(scene, GW / 2, this.y + 1, o.title, 11, '#fff8e8', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#5a1a0a', strokeW: 2 }));
      }
    }
    this.newContent();
    if (o.closable) {
      this.closeBtn = button(scene, this.x + this.w - 26, this.y + 4, 22, 20, 'X', () => this.close(), { kind: 'red', size: 11, font: DISPLAY });
      this.root.add(this.closeBtn);
    }
    Modal.open.push(this);
    this.setupScroll();
  }

  /** bottom of the dialog's own drawing in root coords */
  private bottom() { return this.opts.noPanel ? DH : this.y + this.h + 6; }
  /** recompute the scroll range (after a live resize too) */
  fit() {
    this.maxScroll = Math.max(0, this.bottom() - GH);
    this.setScroll(this.scroll);
  }
  setScroll(v: number) {
    this.scroll = Math.max(0, Math.min(this.maxScroll, Math.round(v)));
    this.root.y = -this.scroll;
    this.dim.y = -400 + this.scroll;
    const g = this.sbar;
    if (!g) return;
    g.clear();
    if (this.maxScroll <= 0) return;
    // thin scrollbar on the right of the dialog (stays on screen: drawn in root, offset by the scroll)
    this.root.bringToTop(g);
    const sx = Math.min(GW - 7, this.x + this.w + 3);
    const trackH = GH - 16, th = Math.max(24, trackH * GH / (GH + this.maxScroll));
    const ty = 8 + (trackH - th) * (this.scroll / this.maxScroll);
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(sx, this.scroll + 8, 5, trackH, 2.5);
    g.fillStyle(0xf6c440, 0.95); g.fillRoundedRect(sx, this.scroll + ty, 5, th, 2.5);
  }
  private setupScroll() {
    const sc = this.scene;
    this.sbar = sc.add.graphics();
    this.root.add(this.sbar);
    const isTop = () => Modal.top() === this && this.maxScroll > 0;
    const Z = () => ZOOM.z;
    let start: { y: number; s: number } | null = null;
    const down = (p: Phaser.Input.Pointer) => { DRAG.moved = false; start = isTop() ? { y: p.y / Z(), s: this.scroll } : null; };
    const move = (p: Phaser.Input.Pointer) => {
      if (!start || !p.isDown || !isTop()) return;
      const dy = p.y / Z() - start.y;
      if (!DRAG.moved && Math.abs(dy) < 6) return;
      DRAG.moved = true;
      this.setScroll(start.s - dy);
    };
    const up = () => { start = null; };
    const wheel = (_p: unknown, _o: unknown, _dx: number, dy: number) => { if (isTop()) this.setScroll(this.scroll + dy * 0.6); };
    const key = (e: KeyboardEvent) => {
      if (!isTop()) return;
      const step = e.key === 'PageDown' || e.key === 'PageUp' ? GH * 0.8 : 40;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') this.setScroll(this.scroll + step);
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') this.setScroll(this.scroll - step);
      else if (e.key === 'Home') this.setScroll(0);
      else if (e.key === 'End') this.setScroll(this.maxScroll);
    };
    sc.input.on('pointerdown', down); sc.input.on('pointermove', move); sc.input.on('pointerup', up); sc.input.on('wheel', wheel);
    sc.input.keyboard?.on('keydown', key);
    this.offs.push(() => {
      sc.input.off('pointerdown', down); sc.input.off('pointermove', move); sc.input.off('pointerup', up); sc.input.off('wheel', wheel);
      sc.input.keyboard?.off('keydown', key);
    });
    this.fit();
  }
  /** the window was resized: re-centre vertically (when it fits) and refresh the scroll range */
  refit(oldGH: number) {
    if (!this.opts.noPanel && oldGH !== GH) {
      // move the dialog's drawing by shifting the root's base: simplest is a fixed offset on all children
      const want = Math.max(this.opts.title ? 14 : 6, Math.min(Math.round((GH - this.h) / 2), GH - 4 - this.h));
      const dy = want - this.y;
      if (dy) {
        for (const c of this.root.list) if (c !== this.dim && c !== this.sbar) (c as unknown as { y: number }).y += dy;
        this.y += dy;
      }
    }
    this.dim.width = GW + 4800; this.dim.height = GH + 800;
    this.fit();
  }

  /** is the dialog (title tab included) covering this rect, in screen coords? */
  rect() {
    if (this.opts.noPanel) return { x0: -1e4, x1: 1e4, y0: -1e4, y1: 1e4 };
    // a scrolling dialog covers the full height, but its side gutters stay free
    if (this.maxScroll > 0) return { x0: this.x + this.root.x - 4, x1: this.x + this.root.x + this.w + 12, y0: -1e4, y1: 1e4 };
    return { x0: this.x + this.root.x - 4, x1: this.x + this.root.x + this.w + 4, y0: this.y - 12 - this.scroll, y1: this.y + this.h + 4 - this.scroll }; }

  private newContent() {
    this.content = this.scene.add.container(this.x, this.y);
    this.root.add(this.content);
    if (this.sbar) this.root.bringToTop(this.sbar);
  }

  /** set (and run) a builder that fills content; rebuild() re-runs it */
  build(fn: (m: Modal) => void) { this.builder = fn; this.rebuild(); return this; }
  rebuild() {
    if (this.closed) return;
    this.content.destroy();
    this.newContent();
    if (this.closeBtn) this.root.bringToTop(this.closeBtn);
    this.builder?.(this);
  }

  add<T extends Phaser.GameObjects.GameObject>(o: T): T { this.content.add(o); return o; }
  text(x: number, y: number, s: string, size = 10, color: string = COL.text, o: TextOpts = {}) { return this.add(txt(this.scene, x, y, s, size, color, o)); }
  btn(x: number, y: number, w: number, h: number, label: string, fn: () => void, o: BtnOpts = {}) { return this.add(button(this.scene, x, y, w, h, label, fn, o)); }
  panel(x: number, y: number, w: number, h: number, kind: PanelKind = 'paper') {
    const g = this.scene.add.graphics(); drawPanel(g, x, y, w, h, kind); return this.add(g);
  }
  img(x: number, y: number, key: string, scale = 1) { return this.add(this.scene.add.image(Math.round(x), Math.round(y), key).setScale(scale)); }
  bar(x: number, y: number, w: number, h: number, frac: number, color: number) { return this.add(bar(this.scene, x, y, w, h, frac, color)); }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const f of this.offs) f();
    this.offs = [];
    Modal.open = Modal.open.filter((m) => m !== this);
    sfx.back();
    this.root.destroy();
    this.opts.onClose?.();
    this.onClosed?.();
  }
}
