// v1.3 Dapur Seru: three short, optional minigames (<= 20 s, touch + mouse + Space). The score (0-100) becomes a
// temporary quality bonus through systems.applyMini. "Lewati" closes without a bonus. Runs inside a dialog, so the
// game clock is paused while playing.
import Phaser from 'phaser';
import type { GameScene } from './scenes/Game';
import { COL, ROUND, DISPLAY, GW, txt, drawPanel } from './ui';
import { DISH } from './data';
import { MINIGAMES, type MiniId } from './data2';
import { applyMini } from './systems';
import { dishTex } from './assets';
import { sfx } from './audio';

const R = { font: ROUND, weight: '800' } as const;
const R6 = { font: ROUND, weight: '600' } as const;
const DUR: Record<MiniId, number> = { sambal: 15, tempe: 18, piring: 18 };

interface Ctx {
  gs: GameScene; area: { x: number; y: number; w: number; h: number }; g: Phaser.GameObjects.Graphics;
  add: <T extends Phaser.GameObjects.GameObject>(o: T) => T; score: () => number;
}

export function openMinigame(gs: GameScene, id: MiniId) {
  const G = MINIGAMES[id];
  const w = Math.min(GW - 12, 340), h = 400;
  let timer: Phaser.Time.TimerEvent | null = null;
  let keyFn: ((e: KeyboardEvent) => void) | null = null;
  const stop = () => { timer?.remove(); timer = null; if (keyFn) gs.input.keyboard?.off('keydown', keyFn); keyFn = null; };
  const m = gs.modal({ w, h, title: G.name.toUpperCase(), closable: false, onClose: stop });
  m.build((mm) => {
    const area = { x: 12, y: 58, w: mm.w - 24, h: 250 };
    mm.text(mm.w / 2, 24, G.desc, 10, COL.muted, { ox: 0.5, align: 'center', wrap: mm.w - 30, ...R6 });
    const pg = gs.add.graphics(); drawPanel(pg, area.x - 2, area.y - 2, area.w + 4, area.h + 4, 'paper'); mm.add(pg);
    const g = mm.add(gs.add.graphics());
    const tbar = mm.add(gs.add.graphics());
    const scoreT = mm.text(mm.w - 16, 42, 'Skor 0', 11, COL.text, { ox: 1, oy: 0.5, ...R });
    const timeT = mm.text(16, 42, `${DUR[id]} dtk`, 11, COL.text, { oy: 0.5, ...R });
    const zone = mm.add(gs.add.zone(area.x, area.y, area.w, area.h).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setName('mini_area'));
    const ctx: Ctx = { gs, area, g, add: (o) => mm.add(o), score: () => 0 };
    const game = id === 'sambal' ? sambal(ctx) : id === 'tempe' ? tempe(ctx) : piring(ctx);
    ctx.score = game.score;
    const total = (window as unknown as { __wartegMiniFast?: boolean }).__wartegMiniFast ? 2500 : DUR[id] * 1000;
    let left = total, done = false, started = false;
    const finish = () => {
      if (done) return;
      done = true; stop();
      const sc = Math.round(Math.max(0, Math.min(100, game.score())));
      sfx[sc >= 70 ? 'fanfare' : sc >= 40 ? 'levelup' : 'blooper']();
      const res = gs.add.container(0, 0); mm.add(res);
      const rg = gs.add.graphics(); drawPanel(rg, 30, area.y + 50, mm.w - 60, 150, 'cream'); res.add(rg);
      res.add(txt(gs, mm.w / 2, area.y + 66, sc >= 85 ? 'MANTAP JIWA!' : sc >= 60 ? 'Lumayan!' : sc >= 30 ? 'Masih belajar...' : 'Waduh!', 14, '#e8701a', { ox: 0.5, font: DISPLAY, stroke: '#4a1e0a', strokeW: 2 }));
      res.add(txt(gs, mm.w / 2, area.y + 96, `Skor ${sc}/100`, 16, COL.text, { ox: 0.5, ...R }).setName('mini_score'));
      res.add(txt(gs, mm.w / 2, area.y + 122, `Bonus: ${G.effect}`, 10, COL.muted, { ox: 0.5, ...R6 }));
      const btn = mm.btn(mm.w / 2 - 70, area.y + 148, 140, 34, 'Ambil bonus', () => { const e = applyMini(gs.sim, id, sc); if (e) gs.toast(e); else gs.toast(`${G.name}: skor ${sc}! ${G.effect}.`); mm.close(); }, { kind: 'primary', size: 12 });
      btn.setName('mini_done');
      skip.setVisible(false);
    };
    const tick = () => {
      if (done) return;
      if (!started) return;
      const dt = 33;
      left -= dt;
      game.update(dt);
      tbar.clear(); tbar.fillStyle(0x2b1a10, 1); tbar.fillRect(70, 37, mm.w - 160, 10); tbar.fillStyle(left < 4000 ? 0xd0402e : 0x6ac46a, 1); tbar.fillRect(71, 38, Math.max(0, (mm.w - 162) * left / total), 8);
      timeT.setText(`${Math.max(0, Math.ceil(left / 1000))} dtk`);
      scoreT.setText(`Skor ${Math.round(Math.max(0, Math.min(100, game.score())))}`);
      if (left <= 0 || game.over()) finish();
    };
    const tap = (px: number, py: number) => { if (done) return; if (!started) { started = true; hint.setVisible(false); } game.tap(px - mm.x, py - mm.y - mm.root.y * 0); };
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => { const Z = gs.registry.get('zoom') as number; tap(p.x / Z - mm.root.x, p.y / Z - mm.root.y); });
    keyFn = (e: KeyboardEvent) => { if (e.key === ' ' && gs.modals[gs.modals.length - 1] === mm) { e.preventDefault?.(); tap(-1, -1); } };
    gs.input.keyboard?.on('keydown', keyFn);
    const hint = mm.text(mm.w / 2, area.y + area.h - 18, 'Ketuk area ini (atau Spasi) buat mulai!', 10, '#b04a1a', { ox: 0.5, ...R });
    const skip = mm.btn(mm.w / 2 - 60, h - 52, 120, 30, 'Lewati', () => { done = true; stop(); mm.close(); }, { size: 11 });
    skip.setName('mini_skip');
    game.update(0);
    timer = gs.time.addEvent({ delay: 33, loop: true, callback: tick });
  });
  return m;
}

// ---------------------------------------------------------------- nguleg sambal: tap when the marker is in the zone
function sambal(c: Ctx) {
  const { area, g } = c;
  let pos = 0, dir = 1, speed = 0.9, hits = 0, miss = 0, zoneW = 0.26, zoneC = 0.5, flash = 0, smash = 0;
  const chilies = Array.from({ length: 14 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() * 0.8 }));
  const draw = () => {
    g.clear();
    const cx = area.x + area.w / 2, cy = area.y + 120;
    // cobek
    g.fillStyle(0x3a3530, 1); g.fillEllipse(cx, cy + 10, 190, 70);
    g.fillStyle(0x6a625a, 1); g.fillEllipse(cx, cy, 186, 62);
    g.fillStyle(0x4a443e, 1); g.fillEllipse(cx, cy + 2, 150, 44);
    const k = Math.min(1, hits / 12);
    g.fillStyle(Phaser.Display.Color.GetColor(200 - k * 40, 40 + k * 10, 30), 1); g.fillEllipse(cx, cy + 3, 120 * (0.5 + k * 0.5), 32 * (0.5 + k * 0.5));
    for (const ch of chilies.slice(0, Math.max(0, 14 - hits))) { const x = cx + Math.cos(ch.a) * 58 * ch.r, y = cy - 4 + Math.sin(ch.a) * 16 * ch.r; g.fillStyle(0x5a0e0a, 1); g.fillEllipse(x, y, 16, 7); g.fillStyle(0xf04030, 1); g.fillEllipse(x - 0.5, y - 0.5, 14, 5); g.fillStyle(0xffa090, 1); g.fillRect(x - 4, y - 2, 4, 1); g.fillStyle(0x2e8a2a, 1); g.fillRect(x + 6, y - 2, 4, 3); }
    for (let i = 0; i < 4; i++) { g.fillStyle(0xf5efe0, 1); g.fillCircle(cx - 30 + i * 18, cy + 4 + (i % 2) * 5, Math.max(0, 3 - hits * 0.25)); } // bawang
    // ulekan
    const ux = cx + 20 - smash * 14, uy = cy - 48 + smash * 30;
    g.fillStyle(0x2b1a10, 1); g.fillRoundedRect(ux - 9, uy - 40, 18, 52, 8);
    g.fillStyle(0x8a7a6a, 1); g.fillRoundedRect(ux - 7, uy - 38, 14, 48, 7);
    // meter
    const mx = area.x + 20, my = area.y + 190, mw = area.w - 40;
    g.fillStyle(0x2b1a10, 1); g.fillRect(mx - 2, my - 2, mw + 4, 22);
    g.fillStyle(0xe8d0a0, 1); g.fillRect(mx, my, mw, 18);
    g.fillStyle(flash > 0 ? 0xffe066 : 0x6ac46a, 1); g.fillRect(mx + (zoneC - zoneW / 2) * mw, my, zoneW * mw, 18);
    g.fillStyle(0xc0392b, 1); g.fillRect(mx + pos * mw - 3, my - 5, 6, 28);
  };
  return {
    update(dt: number) { pos += dir * speed * dt / 1000; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; } flash = Math.max(0, flash - dt); smash = Math.max(0, smash - dt / 180); draw(); },
    tap() {
      if (Math.abs(pos - zoneC) <= zoneW / 2) { hits++; flash = 160; smash = 1; speed = Math.min(2.2, speed + 0.09); zoneW = Math.max(0.12, zoneW - 0.012); zoneC = 0.25 + Math.random() * 0.5; sfx.pop(); }
      else { miss++; sfx.back(); }
    },
    score: () => hits * 8.5 - miss * 5,
    over: () => false,
  };
}

// ---------------------------------------------------------------- goreng tempe: lift each piece when golden
function tempe(c: Ctx) {
  const { area, g } = c;
  type Piece = { slot: number; p: number; rate: number; out: number };
  const slots = 4;
  let pieces: Piece[] = [], total = 0, served = 0, spawnT = 0, fx: { x: number; y: number; t: number; s: string; col: string }[] = [];
  const labels: Phaser.GameObjects.Text[] = [];
  const slotPos = (i: number) => ({ x: area.x + area.w / 2 + (i - 1.5) * 62, y: area.y + 118 + (i % 2 ? 14 : -6) });
  const color = (p: number) => p < 0.5 ? 0xf2e2a8 : p < 0.85 ? 0xe8b048 : p < 1.05 ? 0xb06a28 : 0x3a2412;
  const spawn = () => {
    const free = [...Array(slots).keys()].filter((i) => !pieces.some((x) => x.slot === i));
    if (!free.length) return;
    pieces.push({ slot: free[Math.floor(Math.random() * free.length)], p: 0, rate: 0.26 + Math.random() * 0.14 + served * 0.01, out: 0 });
  };
  const draw = () => {
    g.clear();
    const cx = area.x + area.w / 2, cy = area.y + 120;
    g.fillStyle(0x1e1a18, 1); g.fillEllipse(cx, cy + 12, 280, 120);
    g.fillStyle(0x3a3634, 1); g.fillEllipse(cx, cy + 4, 270, 106);
    g.fillStyle(0xc89a30, 0.55); g.fillEllipse(cx, cy + 8, 240, 84); // oil
    for (let i = 0; i < 6; i++) { const t = (Date.now() / 300 + i * 1.7) % 6; g.fillStyle(0xfff3c0, 0.5); g.fillCircle(cx - 100 + i * 40, cy + 20 - t * 2, 2); }
    for (const pc of pieces) {
      const sp = slotPos(pc.slot);
      g.fillStyle(0x2b1a10, 1); g.fillRoundedRect(sp.x - 25, sp.y - 13, 50, 26, 5);
      g.fillStyle(color(pc.p), 1); g.fillRoundedRect(sp.x - 23, sp.y - 11, 46, 22, 4);
      g.fillStyle(0xffffff, 0.25); g.fillRect(sp.x - 18, sp.y - 8, 30, 3);
      // ripeness ring
      g.lineStyle(3, pc.p >= 0.55 && pc.p < 0.85 ? 0x6ac46a : pc.p >= 1.05 ? 0xc0392b : 0xf6c440, 0.9); g.strokeRoundedRect(sp.x - 28, sp.y - 16, 56, 32, 7);
    }
    for (const l of labels) l.destroy();
    labels.length = 0;
    fx = fx.filter((f) => f.t > 0);
    for (const f of fx) labels.push(c.add(txt(c.gs, f.x, f.y - (600 - f.t) / 30, f.s, 12, f.col, { ox: 0.5, oy: 0.5, ...R })));
  };
  return {
    update(dt: number) {
      spawnT -= dt;
      if (spawnT <= 0) { spawn(); spawnT = 1300; }
      for (const pc of pieces) pc.p += pc.rate * dt / 1000;
      for (const f of fx) f.t -= dt;
      draw();
    },
    tap(px: number, py: number) {
      let best: Piece | null = null, bd = 1e9;
      for (const pc of pieces) { const sp = slotPos(pc.slot); const d = Math.hypot(px - sp.x, py - sp.y); if (px < 0) { if (pc.p > (best?.p ?? -1)) best = pc; } else if (d < 40 && d < bd) { bd = d; best = pc; } }
      if (!best) return;
      const sp = slotPos(best.slot);
      const pts = best.p >= 0.55 && best.p < 0.85 ? 10 : best.p >= 0.85 && best.p < 1.05 ? 6 : best.p < 0.55 ? 2 : -3;
      total += pts; served++;
      fx.push({ x: sp.x, y: sp.y - 20, t: 600, s: pts >= 10 ? 'Garing!' : pts >= 6 ? 'Oke' : pts > 0 ? 'Mentah' : 'Gosong!', col: pts >= 10 ? '#2e8b3a' : pts > 0 ? '#b04a1a' : '#c0392b' });
      pieces = pieces.filter((x) => x !== best);
      if (pts >= 6) sfx.pop(); else sfx.back();
    },
    score: () => total * 1.05,
    over: () => false,
  };
}

// ---------------------------------------------------------------- atur piring: tap the dishes of each order
function piring(c: Ctx) {
  const { area, g, gs } = c;
  const menu = gs.sim.activeMenu().filter((id) => DISH[id] && !DISH[id].tags.includes('minum')).slice(0, 4);
  const pool = menu.length >= 3 ? menu : ['orek', 'telurbalado', 'tahu', 'lodeh'];
  let order: string[] = [], got: string[] = [], doneN = 0, wrong = 0, flash = 0;
  const icons: Phaser.GameObjects.Image[] = [];
  const btnPos = (i: number) => ({ x: area.x + 10 + (i % 2) * ((area.w - 20) / 2), y: area.y + 120 + Math.floor(i / 2) * 64, w: (area.w - 30) / 2, h: 58 });
  const newOrder = () => { const n = 1 + Math.min(2, Math.floor(doneN / 2)); order = []; while (order.length < Math.min(n, pool.length)) { const d = pool[Math.floor(Math.random() * pool.length)]; if (!order.includes(d)) order.push(d); } got = []; };
  newOrder();
  // static icons on the buttons
  pool.forEach((id, i) => { const b = btnPos(i); icons.push(c.add(gs.add.image(b.x + 30, b.y + b.h / 2, ...dishTex(DISH[id].icon)).setScale(0.75))); c.add(txt(gs, b.x + 58, b.y + b.h / 2, DISH[id].name, 10, COL.text, { oy: 0.5, wrap: b.w - 62, ...R })); });
  const orderIcons: Phaser.GameObjects.Image[] = [];
  const draw = () => {
    g.clear();
    g.fillStyle(flash > 0 ? 0xd8f0c0 : 0xfff6e0, 1); g.fillRoundedRect(area.x + 10, area.y + 10, area.w - 20, 96, 8);
    g.lineStyle(2, 0x9a5a2a, 1); g.strokeRoundedRect(area.x + 10, area.y + 10, area.w - 20, 96, 8);
    pool.forEach((_, i) => { const b = btnPos(i); g.fillStyle(0x2b1a10, 1); g.fillRoundedRect(b.x, b.y, b.w, b.h, 8); g.fillStyle(0xf6e0b0, 1); g.fillRoundedRect(b.x + 2, b.y + 2, b.w - 4, b.h - 6, 7); });
    for (const o of orderIcons) o.destroy();
    orderIcons.length = 0;
    order.forEach((id, i) => {
      const x = area.x + area.w / 2 + (i - (order.length - 1) / 2) * 70, y = area.y + 58;
      const im = c.add(gs.add.image(x, y, ...dishTex(DISH[id].icon)).setScale(0.9).setAlpha(got.includes(id) ? 0.3 : 1));
      orderIcons.push(im);
      if (got.includes(id)) { g.lineStyle(4, 0x2e8b3a, 1); g.lineBetween(x - 14, y, x - 4, y + 12); g.lineBetween(x - 4, y + 12, x + 16, y - 12); }
    });
  };
  return {
    update(dt: number) { flash = Math.max(0, flash - dt); draw(); },
    tap(px: number, py: number) {
      let idx = -1;
      if (px < 0) idx = pool.indexOf(order.find((d) => !got.includes(d)) ?? '');
      else pool.forEach((_, i) => { const b = btnPos(i); if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) idx = i; });
      if (idx < 0) return;
      const id = pool[idx];
      if (order.includes(id) && !got.includes(id)) { got.push(id); sfx.pop(); if (got.length === order.length) { doneN++; flash = 200; sfx.coin(); newOrder(); } }
      else { wrong++; sfx.back(); }
    },
    score: () => doneN * 11 - wrong * 4,
    over: () => false,
  };
}
