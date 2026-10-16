import Phaser from 'phaser';
import { Sim, rushLabel, type SimEvent, type DayReport, type ChoiceEvent } from '../sim';
import { saveGame, dateOf, clock, fmtMoney, fmtShort, fmtNum, DAY_TICKS, type GameState, type Customer, type Staff, type OjolOrder } from '../state';
import { HI, CH, CHAR_H, charFrame, charTex, hasChar, iconFrame, dishTex, EXTRA } from '../assets';
const EXTRA_F = (n: string) => EXTRA.frames[n] ?? 0;
import { DISH, CUST, OJOL_APPS, TIPS } from '../data';
import { GW, GH, PW, WIDE, BAR_Y, COL, DISPLAY, ROUND, txt, button, bar, Modal, bubbleGfx, pill, woodStrip, drawPanel, type ModalOpts } from '../ui';
import { S as S2, WX, WY, WORLD_W, WORLD_H, B, OVERFLOW, OV_DEPTH, G_QUEUE, G_SEATS, G_STAFF, G_CART, SPAWNS, BELANJA_OUT, OBST_GEROBAK, NAV_GEROBAK, findPath, insideAny, segClear, type P } from '../world';
import { layoutFor, type Layout } from '../layout';
import type { Seat } from '../world';
import { buildRoom } from '../room';
import { SidePanel, SIDE_W } from '../sidepanel';
import { buildBackdrop, BACKDROP_EDGE } from '../backdrop';
import { sfx } from '../audio';
import * as screens from '../screens';
import * as backup from '../backup';
import { ACHIEVEMENTS } from '../achievements';
import { Tutorial } from '../tutorial';
import * as screens2 from '../screens2';
import * as screens3 from '../screens3';
import { assignStaff } from '../sim3';
import { normalizeSave } from '../state';
import { LOCS } from '../data';
import * as systems from '../systems';
import { FIGURAN, WEATHER, type FigKind } from '../data2';
import { figuranAct, rushLabel2, katActive, gudangCap, pantryKg, hint } from '../systems';

export const HUD_H = 50;
const fp = (g: Phaser.GameObjects.Graphics, pts: P[], close: boolean) => g.fillPoints(pts as unknown as Phaser.Math.Vector2[], close);
/** world point -> iso a (logical) */
const isoA = (x: number, y: number) => { const lx = x - WX - 7.5, ly = (y - WY - 220) * 2; return (lx + ly) / 2; };
const SPEEDS = [0, 1, 2, 4];
const TICK_MS = 400;

interface Mover {
  img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; key: string; path: P[]; speed: number; anim: number; frame: number;
  onArrive?: () => void; mode: 'walk' | 'stand' | 'sit'; depthFix?: number; extra?: Phaser.GameObjects.GameObject[];
  phase?: 'enter' | 'queue' | 'served' | 'eat' | 'leaving'; served?: { amount: number; kasbon: boolean; dine: boolean; seat: number; dishes: string[] };
  leaveReason?: string; seat?: number;
  // v1.2 natural movement: feet position (img.y adds the idle bob), facing, per-person pace, idle behaviour
  uid: number; px: number; py: number; left: boolean; up: boolean; pace: number; seed: number; fkey: string;
  idle: 'stand' | 'queue' | 'sit' | 'staff' | 'none'; nextFidget: number; fidgetUntil: number; jx: number; jy: number;
  goal?: P; movedTok?: number; final?: boolean; finalLeg?: boolean; fadeIn?: number; fadeOut?: boolean; home?: P; outing?: 'out' | 'in'; poseUntil?: number;
}
interface Pop { c: Phaser.GameObjects.Container; x: number; y: number; w: number; h: number }

export class GameScene extends Phaser.Scene {
  sim!: Sim;
  get s(): GameState { return this.sim.s; }
  speedIdx = 1;
  acc = 0;
  modals: Modal[] = [];
  tut: Tutorial | null = null;
  // world
  private worldObjs: Phaser.GameObjects.GameObject[] = [];
  private builtStage = 0;
  private builtDecor = '';
  private cust = new Map<number, Mover>();
  private staffSpr = new Map<number, Mover>();
  private drivers = new Map<number, Mover>();
  private extras: Mover[] = [];
  private pops: Pop[] = [];
  private seatsTaken = new Map<number, number>();
  private larisShown = new Set<string>();
  // chrome
  private chrome: Phaser.GameObjects.GameObject[] = [];
  private hud: Record<string, Phaser.GameObjects.Text> = {};
  private stars: Phaser.GameObjects.Image[] = [];
  private speedBtns: Phaser.GameObjects.Container[] = [];
  private rush: Phaser.GameObjects.Container | null = null;
  private rushKey = '';
  sideL: SidePanel | null = null;
  sideR: SidePanel | null = null;
  private dock: Phaser.GameObjects.Container | null = null;
  private dockKey = '';
  dockTab = 0;
  private toastQ: string[] = [];
  private toastBusy = false;
  private listener!: (e: SimEvent) => void;
  private lastSave = 0;
  private reportCard: Phaser.GameObjects.Container | null = null;
  worldCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private pinch: { d: number; wz: number } | null = null;
  wz = 1; wcx = WX + WORLD_W / 2; wcy = WY + WORLD_H / 2;
  vx0 = 0; vx1 = PW; vy0 = HUD_H; vy1 = BAR_Y;
  rushBottom = 110;
  private drag: { x: number; y: number; cx: number; cy: number } | null = null;
  dragMoved = false;
  reportFull = 2;

  constructor() { super('Game'); }

  init(data: { state: GameState }) {
    this.sim = new Sim(data.state);
    this.speedIdx = 1; this.acc = 0; this.modals = [];
    this.worldObjs = []; this.builtStage = 0; this.builtDecor = '';
    this.cust = new Map(); this.staffSpr = new Map(); this.drivers = new Map(); this.extras = []; this.pops = []; this.seatsTaken = new Map();
    this.chrome = []; this.hud = {}; this.stars = []; this.speedBtns = []; this.rush = null; this.rushKey = ''; this.sideL = null; this.sideR = null; this.dock = null; this.dockKey = '';
    this.toastQ = []; this.toastBusy = false; this.worldCam = null; this.wz = 1; this.wcx = WX + WORLD_W / 2; this.wcy = WY + WORLD_H / 2;
    this.drag = null; this.pinch = null; this.dragMoved = false; this.reportCard = null;
    this.cat = null; this.figs = []; this.nextFig = 0; this.wfx = null; this.drops = []; this.radioProp = null; this.nextNote = 0;
    try { this.reportFull = Number(localStorage.getItem('warteg-report') ?? '2'); } catch { this.reportFull = 2; }
  }

  create() {
    const cam = this.cameras.main;
    cam.setZoom(this.registry.get('zoom') as number).centerOn(GW / 2, GH / 2);
    cam.setBackgroundColor('#140c06');
    this.buildWorld();
    this.syncStaff();
    this.buildChrome();
    this.setupInput();
    this.listener = (e) => this.onSim(e);
    this.sim.on(this.listener);
    this.events.once('shutdown', () => { this.sim.off(this.listener); sfx.setPaused(false); sfx.setMusicOverride(null); });
    this.tut = new Tutorial(this);
    (window as unknown as { __warteg?: unknown }).__warteg = { scene: this, sim: this.sim, screens, screens2, screens3, systems, backup, achievements: ACHIEVEMENTS, sfx, tut: this.tut, assignStaff: (st: Staff, t: string | null) => assignStaff(this.sim, st, t), normalizeSave, locIds: () => LOCS.map((l) => l.id) };
    this.refreshMusic();
    if (this.s.tut === 0) screens.showWelcome(this);
  }

  // ================================================================ world
  private w<T extends Phaser.GameObjects.GameObject>(o: T): T { this.worldObjs.push(o); return o; }
  buildWorld() {
    for (const o of this.worldObjs) o.destroy();
    this.worldObjs = [];
    this.builtStage = this.s.stage;
    this.builtDecor = this.s.decor.join(',');
    // v1.2: the street corner around the warung (was a flat dark rectangle that read as blank black bands)
    this.w(this.add.rectangle(WX - 2000, WY - 2000, WORLD_W + 4000, WORLD_H + 4000, BACKDROP_EDGE).setOrigin(0, 0).setDepth(-10));
    if (this.s.stage < 6) this.floorView = 1;
    this.builtFloor = this.floorView;
    const L = this.s.stage > 1 ? this.lay() : null;
    for (const o of buildBackdrop(this, { stage: this.s.stage, A: L?.A, Bm: L?.Bm, floor: this.floorView, key: L?.key })) this.w(o);
    let steam: P[] = [B(250, 330)];
    if (!L) this.buildGerobak();
    else {
      // v1.4: the room is composed for this stage's layout (bigger with every renovation)
      const rb = buildRoom(this, L, this.s.name);
      for (const o of rb.objs) this.w(o);
      steam = rb.steam.slice(0, L.floor === 2 ? 0 : 3);
      this.nameBoard(L);
      this.decorProps();
    }
    // steam over the stove(s)
    for (const st of steam) for (let i = 0; i < 3; i++) {
      const p = this.w(this.add.circle(st.x + i * 4, st.y, 3, 0xffffff, 0.5).setDepth(900));
      this.tweens.add({ targets: p, y: st.y - 18, alpha: 0, scale: 2, duration: 1600, repeat: -1, delay: i * 520 });
    }
    // re-place sprites
    for (const m of this.staffSpr.values()) this.destroyMover(m);
    this.staffSpr.clear();
    for (const m of this.cust.values()) this.destroyMover(m);
    this.cust.clear(); this.seatsTaken.clear();
    // v1.4: switching floors / rooms: drivers, visitors and street people belong to the old view
    for (const m of this.drivers.values()) this.destroyMover(m);
    this.drivers.clear();
    for (const m of this.extras) this.destroyMover(m);
    this.extras = []; this.figs = [];
    for (const v of this.vehicles ?? []) v.img.destroy();
    this.vehicles = [];
    this.syncStaff();
    this.buildRadio();
    if (this.cat) { this.cat.img.destroy(); this.cat.shadow.destroy(); this.cat = null; }
    this.syncCat();
  }
  /** v1.4: the current room layout (stage >= 2; Restoran Besar: the floor being viewed) */
  floorView: 1 | 2 = 1;
  private builtFloor: 1 | 2 = 1;
  lay(): Layout { return layoutFor(Math.max(2, this.s.stage), this.s.stage >= 6 ? this.floorView : 1); }
  /** world bounds of what is drawn (gerobak corner or the room) */
  private wb() { return this.s.stage === 1 ? { x0: WX, y0: WY, x1: WX + WORLD_W, y1: WY + WORLD_H } : this.lay().bounds; }
  /** seats on the ground floor (the rest of the Restoran Besar's seats are upstairs) */
  l1Seats() { return this.s.stage >= 6 ? Math.min(layoutFor(6, 1).seats.length, 40) : this.sim.seats(); }
  /** v1.4: the warung's name on a board on the right wall (brand name once it has one) */
  private nameBoard(L: Layout) {
    if (L.floor === 2) {
      const p = L.wallR(Math.min(L.A - 60, L.vip ? L.vip.a0 + 40 : 120), 96);
      this.w(this.tag(p, 'RUANG VIP · ACARA', 8));
      return;
    }
    const nm = (this.s.brand || this.s.name).toUpperCase();
    // keep clear of the neon sign (right end of the wall, h 82..110) and the TV / AC (a < 140): left of the neon when
    // the wall is long enough, otherwise hung under it as a smaller plank
    const neon = this.s.decor.includes('neon');
    const nx = L.A - 34, natural = 26 + nm.length * 5.6;
    let wmax = 120, a = Math.min(L.A - 44, 128 + (L.stage - 2) * 30), hh = 80;
    if (neon) {
      const room = nx - 24 - 138;
      if (room >= 84) { wmax = Math.min(120, room); a = nx - 24 - Math.min(wmax, natural) / 2; }
      else { wmax = 84; a = nx; hh = 64; }
    }
    const p = L.wallR(a, hh);
    const g = this.w(this.add.graphics().setDepth(5));
    const w = Math.min(wmax, natural), h = neon && hh < 80 ? 15 : 18;
    const ts = Math.min(1, (w - 12) / Math.max(1, natural - 26 + 2));
    const q = (dx: number, dy: number) => ({ x: p.x + dx, y: p.y + dy + dx * 0.5 });
    g.fillStyle(0x4a2208, 1); fp(g, [q(-w / 2 - 2, -h / 2 - 2), q(w / 2 + 2, -h / 2 - 2), q(w / 2 + 2, h / 2 + 2), q(-w / 2 - 2, h / 2 + 2)], true);
    g.fillStyle(L.stage >= 5 ? 0x7a1a14 : 0xe8c070, 1); fp(g, [q(-w / 2, -h / 2), q(w / 2, -h / 2), q(w / 2, h / 2), q(-w / 2, h / 2)], true);
    g.fillStyle(L.stage >= 5 ? 0xe8b040 : 0x2e6a3a, 1); fp(g, [q(-w / 2, h / 2 - 3), q(w / 2, h / 2 - 3), q(w / 2, h / 2), q(-w / 2, h / 2)], true);
    if (neon && hh < 80) { g.lineStyle(1, 0x3a200c, 1); const t1 = q(-w / 2 + 8, -h / 2 - 2), t2 = q(w / 2 - 8, -h / 2 - 2); g.lineBetween(t1.x, t1.y, t1.x, t1.y - 8); g.lineBetween(t2.x, t2.y, t2.x, t2.y - 8); }
    this.w(txt(this, p.x, p.y - 1, nm, 7, L.stage >= 5 ? '#ffe8a0' : '#7a2a10', { ox: 0.5, oy: 0.5, font: DISPLAY, res: 3 }).setRotation(Math.atan(0.5)).setScale(Math.max(0.6, ts)).setDepth(6));
  }
  private tag(p: P, s: string, depth: number) {
    const c = this.add.container(p.x, p.y).setDepth(depth);
    const t = txt(this, 0, 0, s, 7, '#4a2208', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', res: 3 });
    const g = this.add.graphics(); bubbleGfx(g, t.width + 10, t.height + 2, 0xfff3d6, 0x5a3010, false, 4);
    c.add([g, t]);
    return c;
  }
  private buildGerobak() {
    const g = this.w(this.add.graphics().setDepth(1));
    // isometric sidewalk diamond
    const top = B(400, 140), right = B(790, 330), bot = B(400, 630), left = B(10, 400);
    g.fillStyle(0x6a6a72, 1); fp(g, [top, right, bot, left], true);
    g.lineStyle(1, 0x55555c, 1);
    for (let i = 1; i < 12; i++) {
      const a = i / 12;
      g.lineBetween(top.x + (left.x - top.x) * a, top.y + (left.y - top.y) * a, right.x + (bot.x - right.x) * a, right.y + (bot.y - right.y) * a);
      g.lineBetween(top.x + (right.x - top.x) * a, top.y + (right.y - top.y) * a, left.x + (bot.x - left.x) * a, left.y + (bot.y - left.y) * a);
    }
    // curb
    g.fillStyle(0xb8b0a0, 1); fp(g, [left, bot, { x: bot.x, y: bot.y + 5 }, { x: left.x, y: left.y + 5 }], true);
    g.fillStyle(0x9a9286, 1); fp(g, [bot, right, { x: right.x, y: right.y + 5 }, { x: bot.x, y: bot.y + 5 }], true);
    // brick wall behind (back-left edge)
    const wl = B(10, 400), wt = B(400, 140);
    g.fillStyle(0x9a4a2a, 1); fp(g, [wl, wt, { x: wt.x, y: wt.y - 60 }, { x: wl.x, y: wl.y - 60 }], true);
    g.lineStyle(1, 0x7a3a1e, 1);
    for (let r = 1; r < 8; r++) g.lineBetween(wl.x, wl.y - r * 7.5, wt.x, wt.y - r * 7.5);
    g.fillStyle(0xd8c8a0, 1); fp(g, [{ x: wl.x + 40, y: wl.y - 30 - 20 }, { x: wl.x + 110, y: wl.y - 30 - 55 }, { x: wl.x + 110, y: wl.y - 30 - 30 }, { x: wl.x + 40, y: wl.y - 30 + 5 }], true);
    this.w(txt(this, wl.x + 75, wl.y - 72, this.s.name.replace('Warteg ', ''), 7, '#7a2a10', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', res: 3 }).setRotation(-0.58).setDepth(2));
    // tarp
    const tp = this.w(this.add.graphics().setDepth(OV_DEPTH.counter + 40));
    const c = G_CART;
    tp.fillStyle(0x2d6cb0, 1); fp(tp, [{ x: c.x - 70, y: c.y - 70 }, { x: c.x + 10, y: c.y - 110 }, { x: c.x + 60, y: c.y - 85 }, { x: c.x - 20, y: c.y - 45 }], true);
    for (let i = 0; i < 4; i++) { tp.fillStyle(0xe8701a, 1); const a = i / 4, b2 = (i + 0.5) / 4; fp(tp, [{ x: c.x - 70 + 80 * a, y: c.y - 70 - 40 * a }, { x: c.x - 70 + 80 * b2, y: c.y - 70 - 40 * b2 }, { x: c.x - 20 + 80 * b2, y: c.y - 45 - 40 * b2 }, { x: c.x - 20 + 80 * a, y: c.y - 45 - 40 * a }], true); }
    tp.lineStyle(2, 0x6a4a2a, 1); tp.lineBetween(c.x - 20, c.y - 45, c.x - 20, c.y + 5); tp.lineBetween(c.x + 60, c.y - 85, c.x + 60, c.y - 35);
    this.w(this.add.image(c.x, c.y, 'props', 'gerobak').setOrigin(0.5, 0.75).setScale(HI).setDepth(OV_DEPTH.counter));
    // benches + stools
    const bg2 = this.w(this.add.graphics().setDepth(B(0, 470).y));
    const bench = (x: number, y: number) => {
      const p = B(x, y);
      bg2.fillStyle(0x6a3a18, 1); fp(bg2, [{ x: p.x, y: p.y }, { x: p.x + 60, y: p.y - 30 }, { x: p.x + 60, y: p.y - 26 }, { x: p.x, y: p.y + 4 }], true);
      bg2.fillStyle(0xa8662f, 1); fp(bg2, [{ x: p.x, y: p.y - 4 }, { x: p.x + 60, y: p.y - 34 }, { x: p.x + 66, y: p.y - 31 }, { x: p.x + 6, y: p.y - 1 }], true);
      bg2.fillStyle(0x4a2508, 1); bg2.fillRect(p.x + 2, p.y, 2, 6); bg2.fillRect(p.x + 56, p.y - 28, 2, 6);
    };
    bench(500, 455);
    for (const [x, y] of [[700, 470], [430, 560]]) { const p = B(x, y); bg2.fillStyle(0xd0402e, 1); bg2.fillEllipse(p.x, p.y - 6, 12, 6); bg2.fillStyle(0xa02a1e, 1); bg2.fillRect(p.x - 5, p.y - 6, 10, 6); }
    this.w(this.add.image(B(120, 380).x, B(120, 380).y, 'props', 'plant').setOrigin(0.5, 1).setScale(HI).setDepth(B(0, 380).y));
    this.w(this.add.image(B(200, 470).x, B(200, 470).y, 'props', 'basket').setOrigin(0.5, 1).setScale(HI).setDepth(B(0, 470).y));
  }
  private decorProps() {
    const has = (d: string) => this.s.decor.includes(d);
    const L = this.lay();
    const up = L.floor === 2;
    // positions on the walls of this layout (v1.2 spots on the original room, shifted with the right wall)
    const R = (a: number, h: number) => L.wallR(a, h), Lw = (b: number, h: number) => L.wallL(b, h);
    const put = (frame: string, p: P, depth: number, sc = HI, flip = false) => this.w(this.add.image(p.x, p.y, 'props', frame).setScale(sc).setDepth(depth).setFlipX(flip));
    if (has('tv')) put('tv', R(81.5, 75), 5);
    if (has('ac')) { put('ac', R(121.5, 105), 5); if (L.A > 300) put('ac', R(L.A - 70, 105), 5); }
    if (has('kipas')) { const f = put('fan', R(27.5, 46), 5); this.tweens.add({ targets: f, scaleX: HI * 0.9, duration: 300, yoyo: true, repeat: -1 }); }
    if (has('tanaman')) { const p = S2(L.A - 12, L.Bm - 10); put('plant', p, p.y); if (L.A > 300) { const p2 = S2(L.A - 12, 14); put('plant', p2, p2.y); } }
    if (has('jam')) put('clock', Lw(157.5, 81), 5);
    if (has('magicom') && !up) { const p = S2(-6.25, 33.75); put('warmer', p, p.y + 20); }
    if (has('lampu')) { put('lights', R(71.5, 100), 6, HI); if (L.A > 260) put('lights', R(171.5, 100), 6, HI); }
    if (has('neon') && !up) { const n = put('sign', R(L.A - 34, 96), 5, HI * 0.8); this.w(txt(this, n.x, n.y - 3, 'WARTEG', 8, '#fff09a', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#7a2a10', strokeW: 2, res: 3 }).setDepth(6)); }
    this.decorProps2(L);
    if (has('etalase2') && !up) {
      // sparkle on the glass
      for (let i = 0; i < 3 + L.spec.n; i++) {
        const p = B(200 + i * 110, 330 - i * 48);
        const sp = this.w(this.add.star(p.x, p.y, 4, 1, 3.5, 0xffffff, 0.9).setDepth(L.counterDepth + 1));
        this.tweens.add({ targets: sp, alpha: { from: 0, to: 0.9 }, duration: 600, yoyo: true, repeat: -1, delay: i * 400, repeatDelay: 1200 });
      }
    }
  }

  // ---------------------------------------------------------------- movers (v1.2: natural walking)
  // Facing comes from the actual movement vector every frame: the art walks towards the camera facing down-right
  // (`_w`) and away from it facing up-right (`_b`), mirrored for leftward movement. Two-frame walk cycle (contact +
  // synthesised passing pose with a 1 px bob) advanced by distance walked, so the legs never slide; routes come from
  // findPath() over the aisles; idle people breathe, glance around and face what they wait for.
  private uidSeq = 0;
  private mover(key: string, at: P, frame = '_f'): Mover {
    const shadow = this.add.ellipse(at.x, at.y, Math.round(14 * CH / HI), Math.round(5 * CH / HI), 0x000000, 0.28).setDepth(at.y - 0.5);
    const [tex, fr] = charTex(key + frame);
    const img = this.add.image(at.x, at.y, tex, fr).setOrigin(0.5, 1).setScale(CH).setDepth(at.y);
    const seed = Math.random() * 1000;
    return {
      img, shadow, key, path: [], speed: 40, anim: 0, frame: 0, mode: 'stand', px: at.x, py: at.y, left: false, up: frame === '_b' || frame === '_b2',
      uid: ++this.uidSeq, pace: 0.92 + Math.random() * 0.16, seed, fkey: frame, idle: 'stand', nextFidget: 0, fidgetUntil: 0, jx: (Math.random() - 0.5) * 6, jy: (Math.random() - 0.5) * 3,
    };
  }
  private destroyMover(m: Mover) { m.img.destroy(); m.shadow.destroy(); for (const e of m.extra ?? []) e.destroy(); }
  /** show a frame of this character (falls back to the plain walk / back frame when a synthesised one is missing) */
  private setF(m: Mover, suffix: string, left = m.left) {
    let s = suffix;
    if (!hasChar(m.key + s)) s = s.startsWith('_b') ? '_b' : s.startsWith('_w') ? '_w' : '_f';
    const [tex, fr] = charTex(m.key + s);
    if (m.img.texture.key !== tex) m.img.setTexture(tex, fr); else m.img.setFrame(fr);
    m.img.setFlipX(left);
    m.fkey = s;
  }
  /** stand still facing a direction (up = away from the camera) */
  private faceDir(m: Mover, left: boolean, up: boolean) {
    m.left = left; m.up = up;
    this.setF(m, up ? '_b2' : '_f', left);
  }
  /** stand still facing a point */
  private faceToward(m: Mover, p: P) { this.faceDir(m, p.x < m.px - 0.5, p.y < m.py - 0.5); }
  private place(m: Mover, p: P) { m.px = p.x; m.py = p.y; m.img.setPosition(p.x, p.y); m.shadow.setPosition(p.x, p.y); }
  private navFor(): { nodes: P[]; obst: P[][] } { if (this.s.stage === 1) return { nodes: NAV_GEROBAK, obst: OBST_GEROBAK }; const L = this.lay(); return { nodes: L.nav, obst: L.obst }; }
  /** walkable route from the mover's feet to `to` (aisle waypoints get a small per-person offset so a crowd spreads) */
  private route(m: Mover, to: P, from: P = { x: m.px, y: m.py }): P[] {
    const { nodes, obst } = this.navFor();
    const r = findPath(from, to, nodes, obst);
    const out: P[] = [];
    for (let i = 0; i < r.length; i++) {
      const p = r[i];
      if (i === r.length - 1) { out.push(p); break; }
      // keep the offset only where both legs around the waypoint stay clear of the furniture
      const j = { x: p.x + m.jx, y: p.y + m.jy }, prev = i ? out[i - 1] : from;
      out.push(segClear(prev, j, obst) && segClear(j, r[i + 1], obst) ? j : p);
    }
    return out;
  }
  private walkTo(m: Mover, pts: P[], onArrive?: () => void, speed = 44) {
    m.path = pts.map((p) => ({ x: p.x, y: p.y }));
    m.mode = 'walk'; m.onArrive = onArrive; m.speed = speed * m.pace;
    m.img.setVisible(true); m.shadow.setVisible(true);
    m.depthFix = undefined; m.final = false; m.idle = 'none';
    // start pose straight away: facing the first waypoint, contact frame (no standing frame while already moving)
    const p0 = m.path[0];
    // (a re-route issued later in the same frame by someone else's arrival keeps this frame's movement facing; the
    // next frame's movement turns the walker)
    if (p0 && m.movedTok !== this.moveTok) {
      const dx = p0.x - m.px, dy = p0.y - m.py, d = Math.hypot(dx, dy);
      if (d > 0.01) { if (Math.abs(dx) > d * 0.2) m.left = dx < 0; if (Math.abs(dy) > d * 0.2) m.up = dy < 0; }
      this.setF(m, m.up ? '_b' : '_w');
    } else if (p0) this.setF(m, m.up ? '_b' : '_w');
  }
  private allMovers(): Mover[] { return [...this.cust.values(), ...this.drivers.values(), ...this.staffSpr.values(), ...this.extras]; }
  private moveTok = 0;
  private moveMovers(dt: number, spd: number, t: number) {
    const k = Math.max(0, spd);
    this.moveTok++;
    for (const m of this.allMovers()) {
      if (m.mode !== 'walk') { this.idleMover(m, t, k); continue; }
      if (k === 0) continue; // paused: frozen mid-stride, no sliding
      let budget = m.speed * k * dt / 1000;
      const x0 = m.px, y0 = m.py;
      while (budget > 0 && m.path.length) {
        const tgt = m.path[0];
        const dx = tgt.x - m.px, dy = tgt.y - m.py, d = Math.hypot(dx, dy);
        // ease the turn: an intermediate waypoint is "reached" a few px early so the corner is rounded off
        const early = m.path.length > 1 ? 3 : 0;
        if (d <= budget + early) {
          const used = Math.min(d, budget);
          m.px += d ? (dx / d) * used : 0; m.py += d ? (dy / d) * used : 0;
          budget -= used;
          m.path.shift();
          if (early && d > budget + 0.01) break;
        } else { m.px += (dx / d) * budget; m.py += (dy / d) * budget; budget = 0; }
        if (m.path.length === 1 && m.finalLeg) m.final = true;
      }
      const mx = m.px - x0, my = m.py - y0, step = Math.hypot(mx, my);
      if (step > 0.0001) {
        m.movedTok = this.moveTok;
        // facing from this frame's movement vector (a near-zero component keeps the previous facing: no flicker)
        if (Math.abs(mx) > step * 0.2) m.left = mx < 0;
        if (Math.abs(my) > step * 0.2) m.up = my < 0;
        m.anim += step;
        if (m.anim >= 6) { m.anim -= 6; m.frame ^= 1; }
        this.setF(m, m.up ? (m.frame ? '_b2' : '_b') : (m.frame ? '_w2' : '_w'));
      }
      if (m.fadeIn !== undefined) { m.fadeIn += step; m.img.setAlpha(Math.min(1, m.fadeIn / 22)); m.shadow.setAlpha(Math.min(1, m.fadeIn / 22)); if (m.fadeIn >= 22) m.fadeIn = undefined; }
      if (m.fadeOut && m.path.length === 1) { const r = Math.hypot(m.path[0].x - m.px, m.path[0].y - m.py); const a = Math.max(0, Math.min(1, r / 22)); m.img.setAlpha(a); m.shadow.setAlpha(a); }
      m.img.setPosition(m.px, m.py);
      m.img.setDepth(m.depthFix ?? m.py);
      m.shadow.setPosition(m.px, m.py).setDepth(m.py - 0.5);
      if (!m.path.length) {
        m.mode = 'stand'; m.anim = 0; m.frame = 0; m.final = false; m.finalLeg = false; m.idle = 'stand';
        this.faceDir(m, m.left, m.up);
        const f = m.onArrive; m.onArrive = undefined; f?.();
      }
    }
  }
  /** idle life: breathing bob, the odd glance around (queue / waiting), spoon-to-mouth while eating */
  private idleMover(m: Mover, t: number, k: number) {
    if (!m.img.visible) return;
    let off = 0;
    if (m.idle === 'sit') {
      const per = 700 + (m.seed % 300);
      off = ((t + m.seed * 7) % per) < 190 ? -1 : 0;
    } else if (m.idle === 'stand' || m.idle === 'queue' || m.idle === 'staff') {
      const per = 2200 + (m.seed % 900);
      off = ((t + m.seed * 5) % per) < per * 0.45 ? -0.875 : 0;
      if (m.idle !== 'staff' && k > 0) {
        if (!m.nextFidget) m.nextFidget = t + 2500 + Math.random() * 6000;
        if (m.fidgetUntil && t > m.fidgetUntil) { m.fidgetUntil = 0; this.faceDir(m, m.left, m.up); m.nextFidget = t + 3000 + Math.random() * 6000; }
        else if (!m.fidgetUntil && t > m.nextFidget) {
          // glance: look around towards the camera, or over the other shoulder, then back
          m.fidgetUntil = t + 700 + Math.random() * 900;
          if (Math.random() < 0.55) this.setF(m, '_f', Math.random() < 0.5);
          else this.setF(m, m.up ? '_b2' : '_f', !m.left);
        }
      }
    }
    m.img.setPosition(m.px, m.py + off);
  }

  private queueSpots(): P[] { return this.s.stage === 1 ? G_QUEUE : this.lay().floor === 2 ? layoutFor(6, 1).queue : this.lay().queue; }
  private seatList(): Seat[] { return this.s.stage === 1 ? G_SEATS : this.lay().seats; }
  private overflowSpots(): P[] { return this.s.stage === 1 ? OVERFLOW : layoutFor(Math.max(2, this.s.stage), 1).overflow; }
  private entIn(): P { return this.lay().entIn; }
  private entOut(): P { return this.lay().entOut; }
  private spawns(): P[] { return this.s.stage === 1 ? SPAWNS : this.lay().spawns; }
  /** move every queued customer to its slot (head of the sim queue = slot 0); people face the etalase / cart */
  private layoutQueue() {
    const q = this.sim.queue();
    const spots = this.queueSpots(), over = this.overflowSpots();
    q.forEach((c, i) => {
      const m = this.cust.get(c.id);
      if (!m || m.phase !== 'queue') return;
      const inLine = i < spots.length;
      const p = inLine ? spots[i] : over[(i - spots.length) % over.length];
      const goal = m.goal ?? { x: m.px, y: m.py };
      if (Math.abs(goal.x - p.x) > 1 || Math.abs(goal.y - p.y) > 1 || (m.mode !== 'walk' && Math.hypot(m.px - p.x, m.py - p.y) > 1.5)) {
        m.goal = p;
        const look = inLine ? { x: p.x - 20, y: p.y - 12 } : this.s.stage === 1 ? spots[spots.length - 1] : this.entIn();
        this.walkTo(m, this.route(m, p), () => { this.faceToward(m, look); m.idle = 'queue'; }, 48);
      }
    });
  }
  /** sidewalk end where this person appears / disappears */
  private spawnAt(m: Mover, i = Math.floor(Math.random() * this.spawns().length)) {
    const sp = this.spawns()[i % this.spawns().length];
    this.place(m, { x: sp.x + m.jx, y: sp.y + m.jy });
    m.img.setAlpha(0); m.shadow.setAlpha(0); m.fadeIn = 0;
  }
  /** walk out to a sidewalk end, fading out over the last steps, then remove */
  private walkAway(m: Mover, onGone: () => void, speed = 48) {
    const sps = this.spawns();
    const sp = sps[Math.random() < 0.5 ? 0 : sps.length - 1];
    const end = { x: sp.x + m.jx, y: sp.y + m.jy };
    const pre: P[] = this.s.stage === 1 ? [] : this.route(m, this.entOut());
    const from = pre.length ? pre[pre.length - 1] : { x: m.px, y: m.py };
    this.walkTo(m, [...pre, ...this.route(m, end, from)], onGone, speed);
    m.fadeOut = true;
  }

  private onArriveCust(c: Customer) {
    // too many people on screen: this one is simulated but not drawn (bigger rooms draw more people)
    const cap = this.s.stage <= 3 ? 24 : this.s.stage === 4 ? 30 : 36;
    if (this.cust.size >= cap && c.state !== 'gone') return;
    if (this.cust.size >= cap + 6) return;
    // upstairs view: only people who come up to their seat are drawn (see onServed)
    if (this.s.stage >= 6 && this.floorView === 2) return;
    const key = CUST[c.type].sprite;
    const m = this.mover(key, this.spawns()[0]);
    this.spawnAt(m);
    m.phase = 'enter';
    m.img.setVisible(false); m.shadow.setVisible(false);
    this.cust.set(c.id, m);
    // arrivals of one quarter hour are spread over that quarter hour (no blob at the entrance)
    const delay = Math.random() * TICK_MS / Math.max(1, SPEEDS[this.speedIdx] || 1);
    this.time.delayedCall(delay, () => {
      if (!this.cust.has(c.id) || m.phase !== 'enter') return;
      const room = this.s.stage > 1;
      // the sim may already have served / lost this customer while it was on its way: go straight to the counter /
      // turn around instead of first joining the line
      if (m.served) { m.img.setVisible(true); m.shadow.setVisible(true); this.doServe(c.id); return; }
      if (m.leaveReason) { m.img.setVisible(true); m.shadow.setVisible(true); this.runLeave(c.id); return; }
      if (c.state === 'gone' && !m.served) {
        // turned away at the door (full / closed): walk up to the entrance, then leave
        this.walkTo(m, this.route(m, room ? this.entOut() : G_QUEUE[G_QUEUE.length - 1]), () => this.runLeave(c.id), 48);
        return;
      }
      const to = room ? this.entIn() : G_QUEUE[G_QUEUE.length - 1];
      const join = () => {
        m.phase = 'queue';
        if (m.served) this.doServe(c.id);
        else if (m.leaveReason) this.runLeave(c.id);
        else this.layoutQueue();
      };
      // v1.4 prasmanan: dine-in customers first pick their lauk at the buffet line, then pay at the kasir
      const bf = room ? this.lay().buffet : null;
      if (bf && this.s.prasmanan && c.dine && Math.random() < 0.75) {
        const spot = bf.spots[Math.floor(Math.random() * bf.spots.length)];
        this.walkTo(m, this.route(m, to), () => {
          if (m.served || m.leaveReason) { join(); return; }
          this.walkTo(m, this.route(m, spot), () => {
            this.faceDir(m, false, false); m.idle = 'queue';
            if (Math.random() < 0.4) this.popup(m.img.x, m.img.y - CHAR_H - 6, 'Ambil sendiri!', '#2e8b3a');
            this.time.delayedCall(900 / Math.max(1, SPEEDS[this.speedIdx] || 1), () => { if (this.cust.has(c.id) && m.phase === 'enter') join(); });
          }, 48);
        }, 48);
        return;
      }
      this.walkTo(m, this.route(m, to), join, 48);
    });
  }
  /** the sim served this customer: animate it at the counter once the sprite got there */
  private onServed(c: Customer, amount: number, kasbon: boolean, dishes: string[]) {
    if (this.s.stage >= 6 && this.floorView === 2) { if (c.state === 'eat' && c.seat >= this.l1Seats()) this.upstairsGuest(c); return; }
    const m = this.cust.get(c.id);
    if (!m) return;
    m.served = { amount, kasbon, dine: c.state === 'eat', seat: c.seat, dishes };
    if (m.phase === 'queue' || (m.phase === 'enter' && m.mode === 'walk')) this.doServe(c.id);
    this.layoutQueue();
  }
  private doServe(id: number) {
    const m = this.cust.get(id);
    if (!m || !m.served || m.phase === 'served') return;
    m.phase = 'served';
    const head = this.queueSpots()[0];
    const at = { x: head.x + 6 + m.jx * 1.4, y: head.y + 3 + m.jy * 1.6 }; // a little spread: not everyone on one pixel
    this.walkTo(m, this.route(m, at), () => {
      const sv = m.served!;
      this.faceToward(m, { x: at.x - 20, y: at.y - 12 });
      if (sv.kasbon) this.popup(m.img.x, m.img.y - CHAR_H - 6, 'Ngebon dulu', '#e8a020');
      else this.popup(m.img.x, m.img.y - CHAR_H - 6, '+' + fmtShort(sv.amount).replace('Rp ', 'Rp'), '#2e8b3a');
      if (Math.random() < 0.35) sfx.coin();
      for (const d of sv.dishes) if (DISH[d] && this.sim.totalStock(d) === 0 && this.s.menu[d] && !this.larisShown.has(d)) { this.larisShown.add(d); this.popup(m.img.x, m.img.y - CHAR_H - 20, DISH[d].name + ' laris!', '#e8701a'); break; }
      this.time.delayedCall(260, () => {
        if (!this.cust.has(id)) return;
        if (sv.dine) this.seatCustomer(id, sv.seat);
        else { this.popup(m.img.x, m.img.y - CHAR_H - 8, 'Bungkus!', '#2e8b3a'); this.runLeave(id, true); }
      });
    }, 48);
  }
  private seatCustomer(id: number, seatIdx: number) {
    const m = this.cust.get(id);
    if (!m) return;
    const seats = this.seatList();
    // Restoran Besar: seats past the ground floor's are upstairs: walk to the stairs and up
    if (this.s.stage >= 6 && this.floorView === 1 && seatIdx >= this.l1Seats() && this.lay().stairs) { this.goUpstairs(id); return; }
    const n = Math.min(seats.length, this.s.stage >= 6 ? this.l1Seats() : this.sim.seats());
    let si = seatIdx % n;
    const taken = new Set(this.seatsTaken.values());
    for (let i = 0; i < n && taken.has(si); i++) si = (si + 1) % n;
    if (taken.has(si)) { this.runLeave(id, true); return; }
    this.seatsTaken.set(id, si);
    m.seat = si;
    const seat = seats[si];
    const ap = seat.approach[0];
    const r = this.route(m, ap);
    this.walkTo(m, [...r, seat.p], () => {
      m.mode = 'sit'; m.phase = 'eat'; m.idle = 'sit';
      const g = this.s.stage === 1;
      const front = seat.kind === 'front' || g;
      // face the table: back bench people look down-right at it, front bench people sit with their back to us
      // facing up-left; on the gerobak bench everyone eats looking towards the cart
      if (g) { m.left = true; m.up = false; this.setF(m, '_s', true); }
      else if (front) { m.left = true; m.up = true; this.setF(m, '_bs', true); }
      else { m.left = false; m.up = false; this.setF(m, '_s', false); }
      m.shadow.setVisible(false);
      const tableD = seat.depth;
      m.depthFix = g ? seat.p.y : front ? tableD + 1 + seat.p.y / 1000 : tableD - 1;
      if (!g && this.s.stage >= 5) this.serveToTable(m, seat);
      m.img.setDepth(m.depthFix);
      // eat for a while (game time), then leave
      const eatMs = 2600 / Math.max(1, SPEEDS[this.speedIdx] || 1);
      this.time.delayedCall(eatMs, () => this.runLeave(id, true));
    }, 48);
    m.finalLeg = true;
  }
  private leaveCust(c: Customer, reason: string) {
    const m = this.cust.get(c.id);
    if (!m) return;
    if (reason === 'kenyang') return; // handled by the serve / eat animation
    m.leaveReason = reason;
    if (m.phase === 'queue' || (m.phase === 'enter' && m.mode === 'walk')) this.runLeave(c.id);
    this.layoutQueue();
  }
  private runLeave(id: number, quiet = false) {
    const m = this.cust.get(id);
    if (!m || m.phase === 'leaving') return;
    const reason = m.leaveReason;
    const wasSit = m.mode === 'sit';
    m.phase = 'leaving';
    this.tweens.killTweensOf(m.img);
    this.seatsTaken.delete(id);
    if (!quiet && reason) {
      const label = reason === 'lama' ? 'Kelamaan!' : reason === 'habis' ? 'Habis?!' : reason === 'penuh' ? 'Penuh...' : reason === 'mahal' ? 'Mahal!' : '';
      if (label) this.popup(m.img.x, m.img.y - CHAR_H - 6, label, reason === 'lama' || reason === 'habis' ? '#c0392b' : '#8a6a4a');
    }
    const seat = m.seat !== undefined ? this.seatList()[m.seat] : undefined;
    m.shadow.setVisible(true);
    m.img.setPosition(m.px, m.py);
    if (wasSit && seat) {
      // step back off the bench first, then out
      const ap = seat.approach[0];
      this.walkTo(m, [ap], () => this.walkAway(m, () => { this.destroyMover(m); this.cust.delete(id); }, 48), 48);
      m.final = true; // stepping off the bench
    } else this.walkAway(m, () => { this.destroyMover(m); this.cust.delete(id); }, reason ? 54 : 48);
    this.layoutQueue();
  }

  syncStaff() {
    const ids = new Set(this.s.staff.map((x) => x.id));
    for (const [id, m] of this.staffSpr) if (!ids.has(id)) { this.destroyMover(m); this.staffSpr.delete(id); }
    const L = this.s.stage === 1 ? null : this.lay();
    const spots: Record<string, P[]> = L ? L.staff : G_STAFF;
    const head = this.queueSpots()[0] ?? { x: WX + 200, y: WY + 200 };
    const used: Record<string, number> = {};
    const up = !!L && L.floor === 2;
    for (const st of this.s.staff) {
      const assigned = !!st.assign;
      let list = spots[st.role] ?? spots.pelayan;
      if (!list.length) list = spots.pelayan.length ? spots.pelayan : [S2(40, 40)];
      const i = used[st.role] = (used[st.role] ?? -1) + 1;
      const base = list[i % list.length];
      const p = { x: base.x + Math.floor(i / list.length) * 10, y: base.y + Math.floor(i / list.length) * 5 };
      let m = this.staffSpr.get(st.id);
      if (!m) {
        m = this.mover(st.sprite, p);
        m.img.setInteractive({ useHandCursor: true });
        const stId = st.id;
        m.img.on('pointerup', () => { if (!this.modalOpen() && !this.dragMoved) { const s2 = this.s.staff.find((x) => x.id === stId); if (s2) { sfx.click(); screens.openStaffDetail(this, s2); } } });
        this.staffSpr.set(st.id, m);
      } else if (m.mode !== 'walk') this.place(m, p);
      m.home = p;
      m.idle = 'staff';
      if (m.mode === 'walk') continue; // tukang belanja on his way to / from the market
      // tukang belanja stands in front of the steel cabinet, left of the counter (drawn over it at the bigger char scale)
      const hall = up || (st.role === 'pelayan' && !!L?.hallPelayan);
      m.img.setDepth(this.s.stage === 1 || st.role === 'belanja' || hall ? p.y : L!.counterDepth - 2 + p.y / 1000);
      m.depthFix = m.img.depth;
      m.shadow.setPosition(p.x, p.y).setDepth(m.img.depth - 0.01);
      // upstairs only the waiters / cashier work; a manajer posted at a cabang is not in the room
      const hidden = assigned || (up && !['pelayan', 'kasir', 'shift', 'manajer'].includes(st.role)) || (!up && L?.stage === 6 && st.role === 'pelayan' && (used.pelayan ?? 0) >= 4 && false);
      const away = !!st.off || hidden || (st.role === 'belanja' && this.belanjaAway());
      m.img.setVisible(!away); m.shadow.setVisible(!away);
      // staff look towards the customers at the head of the line
      m.left = st.role === 'belanja' ? false : head.x < p.x - 2; m.up = false;
      this.setF(m, '_f');
    }
  }
  /** tukang belanja is at the market early in the morning */
  private belanjaAway() { return this.s.tick < 10 && this.s.tick > 0; }
  /** walk the tukang belanja out to the market / back with the shopping instead of popping in and out */
  private updateBelanja() {
    for (const st of this.s.staff) {
      if (st.role !== 'belanja') continue;
      const m = this.staffSpr.get(st.id); if (!m || !m.home) continue;
      if (st.off) { if (m.mode !== 'walk') { m.img.setVisible(false); m.shadow.setVisible(false); } continue; }
      const away = this.belanjaAway();
      const home = m.home;
      if (away && m.img.visible && m.mode !== 'walk' && !m.outing) {
        m.outing = 'out';
        const out = this.s.stage === 1 ? [SPAWNS[0]] : BELANJA_OUT;
        if (this.floorView === 2 && this.s.stage >= 6) continue;
        this.walkTo(m, out.map((p) => ({ x: p.x, y: p.y })), () => { m.img.setVisible(false); m.shadow.setVisible(false); m.img.setAlpha(1); m.shadow.setAlpha(1); m.fadeOut = false; m.outing = undefined; this.place(m, home); }, 40);
        m.fadeOut = true;
      } else if (!away && !m.img.visible && m.mode !== 'walk' && !m.outing) {
        m.outing = 'in';
        const out = this.s.stage === 1 ? [SPAWNS[0]] : BELANJA_OUT;
        if (this.floorView === 2 && this.s.stage >= 6) continue;
        const start = out[out.length - 1];
        this.place(m, start);
        m.img.setAlpha(0); m.shadow.setAlpha(0); m.fadeIn = 0;
        this.walkTo(m, [...out.slice(0, -1).reverse(), home], () => {
          m.outing = undefined; m.idle = 'staff'; m.img.setAlpha(1); m.shadow.setAlpha(1);
          m.depthFix = home.y; m.img.setDepth(home.y);
          this.faceDir(m, false, false);
          this.speech(m, 'Belanjaan dateng!');
        }, 40);
      }
    }
  }
  /** staff at work: hold a pose for a while (front / action / a look back at the stove or shelf), more action when busy */
  private animateStaff(t: number) {
    const busyQ = this.sim.queue().length > 0;
    for (const st of this.s.staff) {
      const m = this.staffSpr.get(st.id);
      if (!m || !m.img.visible || m.mode === 'walk') continue;
      if (t < (m.poseUntil ?? 0)) continue;
      const busy = busyQ || st.role === 'masak';
      const r = Math.random();
      let pose = '_f', dur = 0;
      if (busy) {
        if (r < 0.5) { pose = '_x'; dur = 700 + Math.random() * 900; }
        else if (r < 0.88) { pose = '_f'; dur = 600 + Math.random() * 1000; }
        else { pose = '_b2'; dur = 450 + Math.random() * 500; }
      } else if (r < 0.8) { pose = '_f'; dur = 2000 + Math.random() * 2600; }
      else if (r < 0.92) { pose = '_x'; dur = 800 + Math.random() * 800; }
      else { pose = '_b2'; dur = 600 + Math.random() * 600; }
      m.poseUntil = t + dur;
      this.setF(m, pose, m.left);
    }
  }
  private spawnExtra(kind: 'dinkes' | 'vlog' | 'satpol') {
    if (this.s.stage >= 6 && this.floorView === 2) return;
    const m = this.mover(kind, this.spawns()[0]);
    this.spawnAt(m);
    this.extras.push(m);
    const stay = this.s.stage === 1 ? B(560, 520) : this.lay().visit;
    const pre = this.s.stage === 1 ? [] : this.route(m, this.entIn());
    this.walkTo(m, [...pre, ...this.route(m, stay, pre.length ? pre[pre.length - 1] : undefined)], () => {
      this.faceToward(m, { x: stay.x - 20, y: stay.y - 12 });
      this.setF(m, '_x', false);
      m.idle = 'staff';
      this.time.delayedCall(2600, () => this.walkAway(m, () => { this.destroyMover(m); this.extras = this.extras.filter((x) => x !== m); }, 40));
    }, 38);
  }
  private ojolArrive(o: OjolOrder) {
    if (this.drivers.size >= 4 || (this.s.stage >= 6 && this.floorView === 2)) return;
    const m = this.mover('ojol', this.spawns()[0]);
    this.spawnAt(m);
    this.drivers.set(o.id, m);
    const ow = this.s.stage === 1 ? [] : this.lay().ojolWait;
    const spot = ow[o.id % Math.max(1, ow.length)];
    const gi = o.id % 3, p = this.s.stage === 1 ? { x: B(620, 560).x + gi * 13, y: B(620, 560).y - gi * 6 } : spot;
    const pre = this.s.stage === 1 ? [] : this.route(m, this.entIn());
    this.walkTo(m, [...pre, ...this.route(m, p, pre.length ? pre[pre.length - 1] : undefined)], () => {
      // wait looking at the counter / cart
      this.faceToward(m, this.s.stage === 1 ? G_CART : { x: p.x - 20, y: p.y - 12 });
      m.idle = 'queue';
    }, 50);
  }
  private ojolLeave(o: OjolOrder, ok: boolean, amount = 0) {
    const m = this.drivers.get(o.id);
    if (!m) return;
    if (ok) this.popup(m.img.x, m.img.y - CHAR_H - 4, '+' + fmtShort(amount).replace('Rp ', 'Rp'), '#2e8b3a');
    const fin = () => {
      this.setF(m, ok ? '_x' : '_f', m.left);
      this.time.delayedCall(220, () => this.walkAway(m, () => { this.destroyMover(m); this.drivers.delete(o.id); }, 50));
    };
    if (m.mode === 'walk') { const prev = m.onArrive; m.onArrive = () => { prev?.(); this.time.delayedCall(250, fin); }; } else fin();
  }
  /** debug / tests: current game speed multiplier */
  speedMul() { return SPEEDS[this.speedIdx]; }
  /** debug / tests: every drawn person with its feet position, facing and frame */
  debugMovers() {
    const out: { id: string; x: number; y: number; flip: boolean; f: string; mode: string; final: boolean; vis: boolean; spd: number; obst: boolean }[] = [];
    const { obst } = this.navFor();
    // "through furniture" = feet clearly inside an obstacle (all of a 2 px cross inside), not just grazing a corner
    const deep = (x: number, y: number) => [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].every(([ox, oy]) => insideAny({ x: x + ox, y: y + oy }, obst));
    const add = (pre: string, mp: Map<number, Mover> | Mover[]) => { for (const m of mp instanceof Map ? [...mp.values()] : mp) out.push({ id: pre + m.uid, x: m.px, y: m.py, flip: m.img.flipX, f: m.fkey, mode: m.mode, final: !!m.final || m.mode === 'sit', vis: m.img.visible && m.img.alpha > 0.05, spd: m.speed, obst: m.mode === 'walk' && !m.final && pre !== 's' && deep(m.px, m.py) }); };
    add('c', this.cust); add('o', this.drivers); add('s', this.staffSpr); add('x', this.extras);
    return out;
  }

  // ================================================================ chrome (HUD, rush card, side panels, dock, bar)
  private buildChrome() {
    const before = new Set(this.children.list);
    this.sideL = null; this.sideR = null; this.dock = null;
    this.vx0 = 0; this.vx1 = GW; this.vy0 = HUD_H; this.vy1 = BAR_Y;
    const ph = BAR_Y - HUD_H - 12;
    if (GW >= 880) {
      this.sideL = new SidePanel(this, 'left', 8, HUD_H + 6, SIDE_W, ph);
      this.sideR = new SidePanel(this, 'right', GW - 8 - SIDE_W, HUD_H + 6, SIDE_W, ph);
      this.vx0 = SIDE_W + 16; this.vx1 = GW - SIDE_W - 16;
    } else if (GW >= 640) {
      this.sideL = new SidePanel(this, 'both', 8, HUD_H + 6, SIDE_W, ph);
      this.vx0 = SIDE_W + 16;
    }
    this.buildHud();
    this.buildBottom();
    // phone: the world sits under the rush card, a dock fills the space above the bottom bar
    if (!WIDE) {
      this.vy0 = this.rushBottom + 4;
      // v1.1: a taller, almost square room view (the dock below had lots of empty space) zoomed so the room fills its
      // height: people read ~2x bigger than before on a phone (with the bigger char scale), pinch / drag still work
      const worldH = Math.round(GW * 0.95);
      this.vy1 = Math.min(BAR_Y - 120, this.vy0 + worldH);
      this.wz = Math.max(1, Math.min(1.4, this.phoneFitZoom() / this.fitZoom()));
      this.camHome();
      this.dockKey = '';
      this.refreshDock();
    }
    this.chrome = this.children.list.filter((o) => !before.has(o));
    this.setupWorldCam();
    this.refreshFloorBtn();
    this.sideL?.refresh(true); this.sideR?.refresh(true);
  }
  private setupWorldCam() {
    if (this.worldCam) { this.cameras.remove(this.worldCam, true); this.worldCam = null; }
    const Z = this.registry.get('zoom') as number;
    const wc = this.cameras.add(Math.round(this.vx0 * Z), Math.round(this.vy0 * Z), Math.round((this.vx1 - this.vx0) * Z), Math.round((this.vy1 - this.vy0) * Z), false, 'world');
    wc.setBackgroundColor('#140c06');
    const arr = this.cameras.cameras;
    arr.splice(arr.indexOf(wc), 1); arr.unshift(wc);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.worldCam = wc;
    this.applyWorldCam();
  }
  private viewH() { return this.vy1 - this.vy0; }
  private fitZoom() {
    // wide: leave room for the rush card over the top of the view
    const top = WIDE ? Math.max(0, this.rushBottom - this.vy0) * 0.6 : 0;
    const b = this.wb();
    return Math.min((this.vx1 - this.vx0) / (b.x1 - b.x0 + 10), (this.viewH() - top) / (b.y1 - b.y0 + 6));
  }
  /** phones: zoom that fits the room height into the view (crops a little of the side walls); v1.4: never smaller
   *  than ~80% of the Warteg-size room's zoom, so people stay readable in the big rooms (drag / pinch to see the rest) */
  private phoneFitZoom() { const b = this.wb(); return Math.max(this.viewH() / (b.y1 - b.y0 + 6), this.viewH() / (WORLD_H + 6) * (this.s.stage >= 5 ? 0.78 : 0.86)); }
  /** v1.4: centre the camera on this layout (phones: on the counter / entrance side of a big room) */
  camHome() {
    const b = this.wb();
    if (!WIDE) {
      this.wz = Math.max(1, Math.min(2.2, this.phoneFitZoom() / this.fitZoom()));
      const z = this.fitZoom() * this.wz, visW = (this.vx1 - this.vx0) / z;
      // big rooms on a phone: show the etalase + entrance (left part) first
      this.wcx = b.x1 - b.x0 > visW + 20 && this.s.stage > 1 ? Math.min(b.x0 + visW / 2 + 40, (b.x0 + b.x1) / 2) : (b.x0 + b.x1) / 2 - 4;
      this.wcy = (b.y0 + b.y1) / 2;
    } else { this.wz = 1; this.wcx = (b.x0 + b.x1) / 2; this.wcy = (b.y0 + b.y1) / 2; }
  }
  applyWorldCam() {
    const wc = this.worldCam; if (!wc) return;
    const Z = this.registry.get('zoom') as number;
    this.wz = Math.max(1, Math.min(3, this.wz));
    const z = this.fitZoom() * this.wz;
    const visW = (this.vx1 - this.vx0) / z, visH = this.viewH() / z;
    const topPad = WIDE ? Math.max(0, this.rushBottom - this.vy0) / z * 0.55 : 0;
    const clamp = (v: number, lo: number, hi: number, vis: number) => (vis >= hi - lo ? (lo + hi) / 2 : Math.max(lo + vis / 2, Math.min(hi - vis / 2, v)));
    // v1.2: a little room past the walls (the street backdrop is drawn there), never so far that the warung leaves the view
    const b = this.wb();
    this.wcx = clamp(this.wcx, b.x0 - 24, b.x1 + 24, visW);
    const cyFit = (b.y0 + b.y1) / 2 - topPad / 2;
    this.wcy = this.wz <= 1.001 ? cyFit : clamp(this.wcy, b.y0 - topPad - 12, b.y1 + 14, visH);
    wc.setZoom(Z * z).centerOn(this.wcx, this.wcy);
  }
  panBy(dx: number, dy: number) { const z = this.fitZoom() * this.wz; this.wcx += dx / z; this.wcy += dy / z; this.applyWorldCam(); }
  zoomAt(wz: number, sx: number, sy: number) {
    if (!this.worldCam) return;
    const cx = (this.vx0 + this.vx1) / 2, cy = (this.vy0 + this.vy1) / 2;
    const z0 = this.fitZoom() * this.wz;
    const wx = this.wcx + (sx - cx) / z0, wy = this.wcy + (sy - cy) / z0;
    this.wz = Math.max(1, Math.min(3, wz));
    const z1 = this.fitZoom() * this.wz;
    this.wcx = wx - (sx - cx) / z1; this.wcy = wy - (sy - cy) / z1;
    this.applyWorldCam();
  }
  vcx() { return Math.round((this.vx0 + this.vx1) / 2); }
  private inView(x: number, y: number) { return x >= this.vx0 && x <= this.vx1 && y >= Math.max(this.vy0, this.rushBottom) && y <= this.vy1; }

  private setupInput() {
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // second finger down: start a pinch (zoom around the midpoint)
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1?.isDown && p2?.isDown && this.worldCam && !this.modalOpen()) {
        this.pinch = { d: Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y)), wz: this.wz };
        this.drag = null; this.dragMoved = true;
        return;
      }
      this.dragMoved = false;
      const Z = this.registry.get('zoom') as number;
      if (!this.worldCam || this.modalOpen() || !this.inView(p.x / Z, p.y / Z)) { this.drag = null; return; }
      this.drag = { x: p.x, y: p.y, cx: this.wcx, cy: this.wcy };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.pinch) {
        const p1 = this.input.pointer1, p2 = this.input.pointer2;
        if (!p1?.isDown || !p2?.isDown || this.modalOpen()) { this.pinch = null; return; }
        const Z = this.registry.get('zoom') as number;
        const dd = Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y));
        this.zoomAt(this.pinch.wz * dd / this.pinch.d, (p1.x + p2.x) / 2 / Z, (p1.y + p2.y) / 2 / Z);
        return;
      }
      const d = this.drag;
      if (!d || !p.isDown || this.modalOpen()) return;
      const Z = this.registry.get('zoom') as number;
      const zx = (p.x - d.x) / Z, zy = (p.y - d.y) / Z;
      if (!this.dragMoved && Math.hypot(zx, zy) < 6) return;
      this.dragMoved = true;
      const z = this.fitZoom() * this.wz;
      this.wcx = d.cx - zx / z; this.wcy = d.cy - zy / z; this.applyWorldCam();
    });
    this.input.on('pointerup', () => { this.drag = null; this.pinch = null; this.time.delayedCall(0, () => { this.dragMoved = false; }); });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => {
      if (!this.worldCam || this.modalOpen()) return;
      const Z = this.registry.get('zoom') as number;
      const sx = p.x / Z, sy = p.y / Z;
      if (!this.inView(sx, sy)) return;
      if (Math.abs(dx) > Math.abs(dy)) { this.panBy(dx / 2, 0); return; }
      if (!dy) return;
      this.zoomAt(this.wz * (dy > 0 ? 0.88 : 1.14), sx, sy);
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }
  private onKey(e: KeyboardEvent) {
    const tg = e.target as HTMLElement | null;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.getElementById('warteg-dom')) return;
    const top = this.modals[this.modals.length - 1];
    if (e.key === 'Escape') { if (top?.closeBtn) top.close(); return; }
    if (this.modalOpen()) return;
    const step = 40;
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': this.panBy(-step, 0); break;
      case 'ArrowRight': case 'd': case 'D': this.panBy(step, 0); break;
      case 'ArrowUp': case 'w': case 'W': this.panBy(0, -step); break;
      case 'ArrowDown': case 's': case 'S': this.panBy(0, step); break;
      case '+': case '=': this.zoomAt(this.wz * 1.2, this.vcx(), (this.vy0 + this.vy1) / 2); break;
      case '-': case '_': this.zoomAt(this.wz / 1.2, this.vcx(), (this.vy0 + this.vy1) / 2); break;
      case ' ': this.setSpeed(this.speedIdx === 0 ? 1 : 0); break;
      default: return;
    }
    e.preventDefault?.();
  }

  relayout(oldGW: number, oldGH = GH) {
    const cam = this.cameras.main;
    cam.setSize(this.scale.width, this.scale.height).centerOn(GW / 2, GH / 2);
    for (const o of this.chrome) o.destroy();
    for (const b of this.speedBtns) b?.destroy();
    this.sideL?.destroy(); this.sideR?.destroy(); this.rush?.destroy(); this.dock?.destroy();
    this.reportCard?.destroy(); this.reportCard = null;
    this.hud = {}; this.stars = []; this.speedBtns = []; this.rush = null; this.rushKey = '';
    this.wz = 1;
    this.buildChrome();
    const dx = Math.round((GW - oldGW) / 2);
    for (const m of this.modals) { m.root.x += dx; m.refit(oldGH); }
    for (const o of [...this.children.list]) if (o.name === 'toast') (o as unknown as { setVisible: (v: boolean) => void }).setVisible(false);
    this.tut?.relayout();
    this.refreshHud(true);
  }

  buildHud() {
    const g = this.add.graphics().setDepth(1000);
    woodStrip(g, 0, 0, GW, HUD_H);
    g.fillStyle(0x2a1608, 1); g.fillRect(0, HUD_H - 2, GW, 2);
    const ic = (x: number, y: number, name: string, sc: number) => this.add.image(x, y, 'icons', iconFrame(name)).setScale(sc).setDepth(1001);
    const big = { weight: '800', font: ROUND };
    this.stars = [];
    if (GW >= 760) {
      // mockup layout: money / stars+fans / bulb on the left, title in the middle, date + speed on the right
      pill(g, 8, 13, 170, 24); ic(22, 25, 'money', 0.42);
      pill(g, 186, 13, 132, 24);
      pill(g, 326, 13, 64, 24); ic(340, 25, 'bulb', 0.36);
      for (let i = 0; i < 5; i++) this.stars.push(ic(198 + i * 12, 25, 'star', 0.24));
      this.hud.money = txt(this, 172, 25, '', 15, '#4a2208', { ox: 1, oy: 0.5, ...big }).setDepth(1001);
      this.hud.fans = txt(this, 312, 25, '', 11, '#7a3a10', { ox: 1, oy: 0.5, ...big }).setDepth(1001);
      this.hud.rp = txt(this, 384, 25, '', 13, '#4a2208', { ox: 1, oy: 0.5, ...big }).setDepth(1001);
      const R = GW - 8;
      pill(g, R - 330, 13, 160, 24);
      this.hud.date = txt(this, R - 250, 25, '', 12, '#4a2208', { ox: 0.5, oy: 0.5, ...big }).setDepth(1001);
      for (let i = 0; i < 4; i++) this.makeSpeedBtn(i, R - 162 + i * 40.5, 13, 39, 24);
      const tw = Math.max(0, (R - 330) - 398);
      if (tw > 150) {
        const cx = Math.round((398 + R - 330) / 2);
        txt(this, cx, 18, 'JURAGAN WARTEG', tw > 240 ? 17 : 13, '#f6c440', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#3a1c08', strokeW: 4 }).setDepth(1001);
        this.hud.name = txt(this, cx, 37, this.s.name, 10, '#fff0c8', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#3a1c08', strokeW: 3 }).setDepth(1001);
      }
    } else {
      const R = GW - PW;
      pill(g, 4, 4, 187, 20); ic(17, 14, 'money', 0.36);
      pill(g, 197 + R, 4, 159, 20);
      pill(g, 4, 28, 104, 18); pill(g, 113, 28, 78, 18); ic(124, 37, 'bulb', 0.28);
      for (let i = 0; i < 5; i++) this.stars.push(ic(15 + i * 11.5, 37, 'star', 0.2));
      this.hud.money = txt(this, 186, 14, '', 14, '#4a2208', { ox: 1, oy: 0.5, ...big }).setDepth(1001);
      this.hud.date = txt(this, 276 + R, 14, '', 11, '#4a2208', { ox: 0.5, oy: 0.5, ...big }).setDepth(1001);
      this.hud.fans = txt(this, 104, 37, '', 10, '#7a3a10', { ox: 1, oy: 0.5, ...big }).setDepth(1001);
      this.hud.rp = txt(this, 186, 37, '', 12, '#4a2208', { ox: 1, oy: 0.5, ...big }).setDepth(1001);
      for (let i = 0; i < 4; i++) this.makeSpeedBtn(i, 196 + R + i * 40.5, 27, 39, 20);
    }
    this.buildRush();
    this.refreshHud(true);
  }
  private speedGeom: [number, number, number, number][] = [];
  makeSpeedBtn(i: number, x?: number, y?: number, w?: number, h?: number) {
    if (x !== undefined) this.speedGeom[i] = [x, y!, w!, h!];
    const [bx, by, bw, bh] = this.speedGeom[i];
    this.speedBtns[i]?.destroy();
    const b = button(this, bx, by, bw, bh, ['II', '1x', '2x', '4x'][i], () => this.setSpeed(i), { kind: this.speedIdx === i ? 'sel' : 'btn', size: 10, font: DISPLAY });
    b.setDepth(1001).setName('speed' + i);
    this.speedBtns[i] = b;
  }
  setSpeed(i: number) {
    const prev = this.speedIdx;
    this.speedIdx = i;
    this.makeSpeedBtn(prev); this.makeSpeedBtn(i);
    sfx.setPaused(i === 0);
  }

  /** "JAM MAKAN SIANG" card: rush meter + 4 rating meters + stock / ojol line */
  private buildRush() {
    this.rush?.destroy();
    const wide = WIDE;
    const vx0 = this.vx0, vx1 = this.vx1;
    const w = Math.min(wide ? 420 : 352, vx1 - vx0 - 16);
    const x = Math.round((vx0 + vx1) / 2 - w / 2);
    const y = HUD_H + (wide ? 8 : 4);
    const h = wide ? 70 : 58;
    this.rushBottom = y + h;
    this.rush = this.add.container(x, y).setDepth(995).setName('rushCard');
    this.rushKey = '';
    this.refreshRush(true);
  }
  private refreshRush(force = false) {
    const c = this.rush; if (!c) return;
    const s = this.s, sim = this.sim;
    const label = this.s.tick === 0 && this.s.absDay === 0 ? 'SIAP BUKA' : (s.tick < DAY_TICKS ? rushLabel2(sim, s.tick) : null) ?? rushLabel(s.tick);
    const q = sim.queue().length;
    const crowd = Math.min(1, (q + sim.seatsUsed() * 0.5) / (6 + sim.seats() * 0.5));
    const key = [label, Math.round(crowd * 20), Math.round(s.rasa), Math.round(s.bersih), Math.round(s.murah), Math.round(s.antrian), Math.round(sim.stockPct() * 100), sim.ojolWaiting(), WIDE, s.weather].join('|');
    if (key === this.rushKey && !force) return;
    this.rushKey = key;
    c.removeAll(true);
    const wide = WIDE;
    const w = Math.min(wide ? 420 : 352, this.vx1 - this.vx0 - 16), h = wide ? 70 : 58;
    const g = this.add.graphics(); drawPanel(g, 0, 0, w, h, 'cream'); c.add(g);
    // title tab
    const tg = this.add.graphics();
    const tw = Math.min(w - 40, label.length * 9 + 34);
    drawPanel(tg, w / 2 - tw / 2, -6, tw, 18, 'red'); c.add(tg);
    c.add(txt(this, w / 2, 3, label, 10, '#fff8e8', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#5a1a0a', strokeW: 2 }));
    // crowd meter
    const cm = bar(this, 10, wide ? 17 : 15, w - 20, wide ? 9 : 8, crowd, crowd > 0.75 ? 0xe8501a : crowd > 0.4 ? 0xf6a020 : 0x6ac46a);
    c.add(cm);
    // 4 meters
    const mets: [string, number, number][] = [['Rasa', s.rasa, 0xe8701a], ['Kebersihan', s.bersih, 0x4aa0d8], ['Harga Murah', s.murah, 0x6ac46a], ['Antrian', s.antrian, 0xf6c440]];
    const cw = (w - 20) / 4;
    mets.forEach(([n, v, col], i) => {
      const mx = 10 + i * cw;
      c.add(txt(this, mx + 2, wide ? 29 : 25, n, wide ? 10 : 9, COL.text, { font: ROUND, weight: '800' }));
      c.add(bar(this, mx + 2, wide ? 43 : 37, cw - 8, 6, v / 100, col));
    });
    c.add(txt(this, w / 2, h - (wide ? 11 : 9), `Nasi ${Math.round(sim.stockPct() * 100)}%  ·  Ojol ${sim.ojolWaiting()}  ·  Antre ${q}  ·  ${WEATHER[s.weather].name}`, wide ? 10 : 9, s.weather === 'normal' ? '#7a3a10' : s.weather === 'hujan' ? '#2d6cb0' : '#c0502a', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' }).setName('rushWeather'));
    const z = this.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => { if (!this.modalOpen()) { sfx.click(); screens.openInfo(this, 1); } });
    c.add(z);
  }

  refreshHud(force = false) {
    const s = this.s, d = dateOf(s.absDay);
    if (!this.hud.money) return;
    this.hud.money.setText(fmtMoney(s.money).replace('Rp ', 'Rp ')).setColor(s.money < 0 ? '#c0392b' : '#4a2208');
    const wideHud = GW >= 760;
    this.hud.date.setText(wideHud ? `Hari ${d.day} · Mg ${d.week} · ${clock(s.tick)}` : `Th${d.year} Bln${d.month} Mg${d.week} ${clock(s.tick)}`);
    this.hud.fans.setText(fmtNum(s.fans));
    this.hud.rp.setText(String(s.poin));
    const st = this.sim.stars();
    this.stars.forEach((im, i) => im.setAlpha(st >= i + 0.75 ? 1 : st >= i + 0.25 ? 0.6 : 0.2));
    this.refreshRush(force);
    this.sideL?.refresh(force); this.sideR?.refresh(force);
    this.refreshDock(force);
  }

  // ---------------------------------------------------------------- phone dock (ojol / menu / ulasan)
  refreshDock(force = false) {
    if (WIDE) return;
    const s = this.s, sim = this.sim;
    const top = this.vy1 + 4, h = BAR_Y - top - 4;
    const key = [this.dockTab, s.weather, s.news.length, s.postSeq, s.katering.map((k) => k.id + k.state + k.prep).join(','), s.orders.map((o) => o.id + o.state + o.left).join(','), Math.round((s.nasi ?? 0) / 5), Object.entries(s.stock).map(([k, v]) => k + Math.round(v.fresh + v.old)).join(','), s.reviewSeq, h, Math.round(s.money / 5e4), s.poin, s.staff.map((x) => x.id + ':' + Math.round(x.energy / 5) + (x.off ?? 0)).join(',')].join('|');
    if (key === this.dockKey && !force && this.dock) return;
    this.dockKey = key;
    this.dock?.destroy();
    const c = this.add.container(0, top).setDepth(995).setName('dock');
    this.dock = c;
    const g = this.add.graphics(); drawPanel(g, 4, 0, GW - 8, h, 'cream'); c.add(g);
    let ty = 6;
    if (h >= 200) {
      // tall phones: the Warung Saya numbers on top of the dock
      const stats: [string, string, string][] = [['Kas', fmtShort(s.money), s.money < 0 ? COL.red : '#2e8b3a'], ['Pelanggan', String(s.yesterday?.customers ?? s.today.customers), '#4a2208'], ['Biaya/bln', fmtShort(sim.monthlyCosts()), '#4a2208'], ['Poin', String(s.poin), '#4a2208']];
      const sw = (GW - 24) / 4;
      stats.forEach(([l, v, col], i) => {
        const sg = this.add.graphics(); drawPanel(sg, 10 + i * sw, 6, sw - 4, 30, 'paper'); c.add(sg);
        c.add(txt(this, 16 + i * sw, 9, l, 8, COL.muted, { font: ROUND, weight: '600' }));
        c.add(txt(this, 16 + i * sw, 20, v, 10, col, { font: ROUND, weight: '800' }));
      });
      ty = 42;
    }
    const tabs = ['Ojol', 'Etalase', 'Staf', 'Ulasan', 'Kabar'];
    const tw = (GW - 20) / tabs.length;
    tabs.forEach((t, i) => {
      const b = button(this, 10 + i * tw, ty, tw - 4, 20, t, () => { this.dockTab = i; this.refreshDock(true); }, { kind: this.dockTab === i ? 'sel' : 'btn', size: 10 });
      b.setName('dock_tab' + i);
      c.add(b);
    });
    // v1.1: every tab is a compact list on a paper card (same row height / type sizes as the wide side panels) with a
    // one-line summary on top; rows that do not fit collapse into "+N lagi"
    // the tips card only shows when the tab's list fits without its space
    const listAvail = h - 54 - (ty + 25) - 25;
    const need = this.dockTab === 2 ? s.staff.length * 20 : this.dockTab === 3 ? Math.min(8, s.reviews.length) * 26 : this.dockTab === 4 ? 9999 : 0;
    const useTip = h > 230 && need <= listAvail;
    const maxY = useTip ? h - 54 : h - 6;
    const px = 10, pw = GW - 20, py = ty + 25, phh = maxY - py;
    const pg = this.add.graphics(); drawPanel(pg, px, py, pw, phh, 'paper'); c.add(pg);
    const L = px + 7, R = px + pw - 7;
    const ROWC = '#4a2208';
    const fit = (t: Phaser.GameObjects.Text, maxW: number) => {
      if (t.width <= maxW) return t;
      let str = t.text;
      while (str.length > 2 && t.width > maxW) { str = str.slice(0, -1); t.setText(str.trimEnd() + '…'); }
      return t;
    };
    const summary = (left: string, right = '', rightCol = COL.muted) => {
      c.add(txt(this, L, py + 5, left, 8, COL.muted, { font: ROUND, weight: '700' }));
      if (right) c.add(txt(this, R, py + 5, right, 8, rightCol, { ox: 1, font: ROUND, weight: '700' }));
      const lg = this.add.graphics(); lg.fillStyle(0xd8bf90, 1); lg.fillRect(L, py + 17, R - L, 1); c.add(lg);
    };
    const empty = (msg: string) => c.add(txt(this, GW / 2, py + 22 + Math.min(40, (phh - 22) / 2 - 8), msg, 9, COL.muted, { ox: 0.5, align: 'center', font: ROUND, weight: '600' }));
    const more = (n: number) => { if (n > 0) c.add(txt(this, R, maxY - 12, `+${n} lagi`, 8, COL.muted, { ox: 1, font: ROUND, weight: '700' })); };
    let y = py + 21;
    const rowsEnd = maxY - 4;
    if (this.dockTab === 0) {
      const all = s.orders.filter((o) => o.state === 'wait' || o.state === 'pickup');
      const waitN = all.filter((o) => o.state === 'wait').length, pickN = all.length - waitN;
      const joined = OJOL_APPS.filter((a) => s.apps[a.id]?.joined);
      summary(joined.length ? `Menunggu ${waitN} · Diambil ${pickN}` : 'Ojol online', joined.length ? `Hari ini ${s.today.ojolDone} selesai · ${s.today.ojolBatal} batal` : '');
      // legend: the joined apps with their store rating
      if (joined.length) {
        let lx = L;
        for (const a of joined) {
          const lg = this.add.graphics(); lg.fillStyle(a.color, 1); lg.fillRoundedRect(lx, y + 2, 15, 10, 3); c.add(lg);
          c.add(txt(this, lx + 7.5, y + 7, a.name === 'Lapar.in' ? 'LP' : 'KM', 7, '#ffffff', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' }));
          const t = txt(this, lx + 19, y + 1, `${a.name} ★${(s.apps[a.id].rating ?? 4.5).toFixed(1)}${s.apps[a.id].promo ? ' · promo' : ''}`, 8, COL.muted, { font: ROUND, weight: '600' });
          c.add(t); lx += 19 + t.width + 12;
        }
        y += 16;
      }
      if (!all.length && joined.length) c.add(txt(this, GW / 2, y + 6, 'Belum ada pesanan masuk.', 9, COL.muted, { ox: 0.5, font: ROUND, weight: '600' }));
      if (!joined.length) empty('Belum gabung aplikasi ojol.\nGabung di PROMOSI.');
      const rowH = 17;
      const fitN = Math.max(0, Math.floor((rowsEnd - y - (all.length * rowH > rowsEnd - y ? 12 : 0)) / rowH));
      const orderRow = (o: OjolOrder, ry: number, i: number, fin: boolean) => {
        if (i % 2 === 0) { const bg = this.add.graphics(); bg.fillStyle(0xf3dfb4, fin ? 0.3 : 0.55); bg.fillRect(px + 3, ry, pw - 6, rowH - 1); c.add(bg); }
        const app = OJOL_APPS.find((a) => a.id === o.app)!;
        const cg = this.add.graphics(); cg.fillStyle(app.color, fin ? 0.45 : 1); cg.fillRoundedRect(L, ry + 3, 15, 10, 3); c.add(cg);
        c.add(txt(this, L + 7.5, ry + 8, app.name === 'Lapar.in' ? 'LP' : 'KM', 7, '#ffffff', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' }));
        const pick = o.state === 'pickup';
        const stT = o.state === 'done' ? '✓ ' + fmtShort(o.total).replace('Rp ', 'Rp') : o.state === 'batal' ? 'Batal' : pick ? 'Diambil' : `${o.left * 15} mnt`;
        const stC = o.state === 'done' ? '#6a9a5a' : o.state === 'batal' ? '#b08070' : pick ? COL.green : o.left <= 2 ? COL.red : '#b04a1a';
        const st = txt(this, R, ry + 3, stT, 8, stC, { ox: 1, font: ROUND, weight: '800' });
        c.add(st);
        const nm = txt(this, L + 20, ry + 2, o.name, 9, fin ? COL.muted : ROWC, { font: ROUND, weight: '800' }); c.add(fit(nm, 80));
        const it = txt(this, L + 24 + nm.width, ry + 3, o.items.map((d) => DISH[d].name).join(', '), 8, COL.muted, { font: ROUND, weight: '600' });
        c.add(fit(it, R - st.width - 8 - it.x));
      };
      all.slice(0, fitN).forEach((o, i) => orderRow(o, y + i * rowH, i, false));
      // the space left under the live orders shows the last finished / cancelled ones (muted)
      const fin = s.orders.filter((o) => o.state === 'done' || o.state === 'batal').reverse();
      const yF = y + Math.min(all.length, fitN) * rowH + (all.length ? 4 : 30);
      const finN = all.length > fitN ? 0 : Math.max(0, Math.floor((rowsEnd - yF - 14) / rowH));
      if (fin.length && finN > 0) {
        c.add(txt(this, L, yF, 'Selesai barusan', 8, COL.muted, { font: ROUND, weight: '700' }));
        const lg = this.add.graphics(); lg.fillStyle(0xe6d2a8, 1); lg.fillRect(L + 72, yF + 5, R - L - 72, 1); c.add(lg);
        fin.slice(0, finN).forEach((o, i) => orderRow(o, yF + 13 + i * rowH, i, true));
      }
      more(all.length - fitN);
      const z = this.add.zone(px, py, pw, phh).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setName('dock_ojol');
      z.on('pointerup', () => { if (!this.modalOpen() && !this.dragMoved && !this.tut?.blocking()) screens.openPromosi(this, 1); });
      c.addAt(z, 1);
    } else if (this.dockTab === 1) {
      const ids = Object.keys(s.stock).filter((id) => DISH[id] && (s.menu[id] || sim.totalStock(id) > 0));
      const habis = ids.filter((id) => sim.totalStock(id) === 0).length;
      const nasiPct = Math.round(100 * (s.nasi ?? 0) / Math.max(1, s.nasiPorsi));
      summary(`${ids.length} lauk di etalase${habis ? ` · ${habis} habis` : ''}`, `Nasi ${Math.max(0, Math.min(100, nasiPct))}%`, nasiPct < 20 ? COL.red : COL.muted);
      const colW = (R - L) / 2, rowH = 17;
      const perCol = Math.max(0, Math.floor((rowsEnd - y - 12) / rowH));
      const shown = ids.length > perCol * 2 ? perCol * 2 : ids.length;
      ids.slice(0, shown).forEach((id, i) => {
        const cx = L + (i % 2) * colW, cy = y + Math.floor(i / 2) * rowH;
        c.add(this.add.image(cx + 6, cy + 8, ...dishTex(DISH[id].icon)).setScale(0.26));
        const n = sim.totalStock(id), want = Math.max(1, s.menu[id] ?? n);
        const num = txt(this, cx + colW - 8, cy + 3, String(Math.round(n)), 8, n ? ROWC : COL.red, { ox: 1, font: ROUND, weight: '800' }); c.add(num);
        c.add(bar(this, cx + colW - 44, cy + 6, 22, 5, n / want, n ? 0x6ac46a : 0xc0392b));
        c.add(fit(txt(this, cx + 15, cy + 2, DISH[id].name, 9, ROWC, { font: ROUND, weight: '600' }), colW - 64));
      });
      more(ids.length - shown);
      if (!ids.length) empty('Etalase kosong. Atur di MASAK.');
    } else if (this.dockTab === 2) {
      const off = s.staff.filter((x) => x.off).length;
      const avgE = s.staff.length ? Math.round(s.staff.reduce((a, x) => a + x.energy, 0) / s.staff.length) : 0;
      summary(`${s.staff.length} staf${off ? ` · ${off} libur` : ''}`, s.staff.length ? `Tenaga rata-rata ${avgE}%` : '', avgE < 35 ? COL.red : COL.muted);
      const rowH = 20;
      const fitN = Math.max(0, Math.floor((rowsEnd - y - (s.staff.length * rowH > rowsEnd - y ? 12 : 0)) / rowH));
      s.staff.slice(0, fitN).forEach((st, i) => {
        const ry = y + i * rowH;
        if (i % 2 === 0) { const bg = this.add.graphics(); bg.fillStyle(0xf3dfb4, 0.55); bg.fillRect(px + 3, ry, pw - 6, rowH - 1); c.add(bg); }
        const im = this.add.image(L + 7, ry + 20, 'chars', charFrame(st.sprite + '_f')).setOrigin(0.5, 1).setScale(0.3).setCrop(0, 14, 64, 40); c.add(im);
        c.add(fit(txt(this, L + 20, ry + 4, st.name, 9, ROWC, { font: ROUND, weight: '800' }), 100));
        c.add(txt(this, L + 124, ry + 5, `${st.role === 'masak' ? 'Masak' : st.role === 'kasir' ? 'Kasir' : st.role === 'pelayan' ? 'Pelayan' : 'Belanja'} · Lv${st.level}${st.off ? ' · libur' : ''}`, 8, COL.muted, { font: ROUND, weight: '600' }));
        c.add(bar(this, R - 66, ry + 8, 44, 5, st.energy / 100, st.energy < 30 ? 0xc0392b : st.energy < 60 ? 0xf6a020 : 0x6ac46a));
        c.add(txt(this, R, ry + 5, `${Math.round(st.energy)}%`, 8, ROWC, { ox: 1, font: ROUND, weight: '700' }));
        const z = this.add.zone(px, ry, pw, rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        const id = st.id;
        z.on('pointerup', () => { if (!this.modalOpen()) { const x = this.s.staff.find((q) => q.id === id); if (x) screens.openStaffDetail(this, x); } });
        c.add(z);
      });
      more(s.staff.length - fitN);
      if (!s.staff.length) empty('Belum ada staf. Rekrut di STAF.');
    } else if (this.dockTab === 4) {
      // v1.3 Kabar: weather + market news, katering in progress, the netizen feed, quick buttons
      summary(`${WEATHER[s.weather].name}${sim.isRamadan() ? ' · Ramadan' : ''} · Gudang ${Math.round(pantryKg(sim))}/${gudangCap(sim)} kg`, `${fmtNum(s.followers)} pengikut`);
      const line = (label: string, text: string, col: string = ROWC) => {
        if (y + 14 > rowsEnd - 24) return false;
        c.add(txt(this, L, y + 2, label, 7, '#b04a1a', { font: DISPLAY }));
        c.add(fit(txt(this, L + 52, y + 1, text, 8, col, { font: ROUND, weight: '600' }), R - L - 54));
        y += 15;
        return true;
      };
      const news = [...s.news].reverse().slice(0, 2);
      if (!news.length) line('PASAR', 'Harga pasar adem ayem.');
      for (const n of news) line(n.kind === 'iklan' ? 'IKLAN' : 'PASAR', n.text, n.kind === 'shock' ? COL.red : ROWC);
      for (const o of katActive(sim)) line('KATERING', `${o.client} ${o.prep}/${o.portions} porsi · ${Math.max(0, o.due - s.absDay)} hari lagi`, o.prep >= o.portions ? COL.green : ROWC);
      for (const p of [...s.posts].reverse().slice(0, 3)) line('MEDSOS', `${p.user}: ${p.text}`, p.kind === 'komplain' || p.kind === 'bad' ? COL.red : ROWC);
      const bw = (pw - 20) / 3;
      const bs: [string, () => void, string][] = [['Kampung', () => screens2.openKampung(this, 0), 'dock_kampung'], [`Radio: ${screens2.radioLabel(sfx.radio)}`, () => screens2.openRadio(this), 'dock_radio'], [s.cat.adopted ? s.cat.name : 'Medsos', () => (s.cat.adopted ? screens2.openKucing(this) : screens2.openKampung(this, 2)), 'dock_cat']];
      bs.forEach(([l, fn, nm], i) => { const b = button(this, px + 6 + i * (bw + 4), rowsEnd - 22, bw, 20, l, () => { if (!this.modalOpen()) fn(); }, { size: 9 }); b.setName(nm); c.add(b); });
    } else {
      const rv = [...s.reviews].reverse();
      const avg = rv.length ? rv.slice(0, 20).reduce((a, r) => a + r.stars, 0) / Math.min(20, rv.length) : 0;
      summary('Ulasan terbaru', rv.length ? `Rata-rata ★${avg.toFixed(1)}` : '');
      let shown = 0;
      for (const r of rv.slice(0, 8)) {
        const t = txt(this, L, y + 12, r.text, 8, ROWC, { font: ROUND, weight: '600', wrap: R - L });
        if (y + 13 + t.height > rowsEnd - (rv.length > shown + 1 ? 12 : 0)) { t.destroy(); break; }
        c.add(txt(this, L, y + 1, '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars), 8, '#e8a020', { font: ROUND, weight: '800' }));
        c.add(txt(this, L + 46, y + 1, r.name, 8, '#b04a1a', { font: ROUND, weight: '800' }));
        c.add(t);
        y += 15 + t.height; shown++;
        if (shown < rv.length) { const lg = this.add.graphics(); lg.fillStyle(0xe6d2a8, 1); lg.fillRect(L, y - 2, R - L, 1); c.add(lg); }
      }
      more(Math.min(rv.length, 8) - shown);
      if (!rv.length) empty('Belum ada ulasan.');
      s.reviewRead = s.reviewSeq;
    }
    // tall phones: a rotating tip fills the bottom of the dock
    if (useTip) {
      const tip = TIPS[(s.absDay + this.dockTab) % TIPS.length];
      const tg = this.add.graphics(); drawPanel(tg, 10, h - 48, GW - 20, 40, 'sel'); c.add(tg);
      c.add(txt(this, 18, h - 43, 'TIPS JURAGAN', 8, '#b04a1a', { font: DISPLAY }));
      c.add(txt(this, 18, h - 32, tip, 9, COL.text, { font: ROUND, weight: '600', wrap: GW - 36 }));
    }
  }

  bottomLayout(n: number) {
    const w = WIDE ? Math.min(108, Math.floor((GW - 16) / n) - 6) : Math.floor((GW - 6) / n) - 3;
    const step = WIDE ? w + 8 : w + 3;
    const x0 = WIDE ? Math.round(GW / 2 - (n * step - 8) / 2) : 4;
    return { w, step, x0 };
  }
  buildBottom() {
    const g = this.add.graphics().setDepth(1000);
    woodStrip(g, 0, BAR_Y, GW, GH - BAR_Y);
    g.fillStyle(0x2a1608, 1); g.fillRect(0, BAR_Y, GW, 2);
    const defs: [string, string, () => void][] = [
      ['Menu', 'menu', () => screens.openMenu(this)],
      ['Masak', 'masak', () => screens.openMasak(this)],
      ['Staf', 'staf', () => screens.openStaff(this)],
      ['Belanja', 'belanja', () => screens.openBelanja(this)],
      ['Promosi', 'promosi', () => screens.openPromosi(this)],
      ['Info', 'info', () => screens.openInfo(this, 0)],
    ];
    if (GW >= 900) defs.push(['Riset', 'book', () => screens.openRiset(this)], ['Peta', 'peta', () => screens.openPeta(this)], ['Kampung', 'heart', () => screens2.openKampung(this)]);
    const L = this.bottomLayout(defs.length);
    const h = Math.min(58, GH - BAR_Y - 10);
    defs.forEach(([label, icon, fn], i) => {
      const x = L.x0 + i * L.step, y = BAR_Y + 7, w = L.w;
      const c = this.add.container(x, y).setDepth(1001).setName('btn_' + label.toLowerCase());
      const bg = this.add.graphics();
      const draw = (down: boolean) => {
        bg.clear();
        bg.fillStyle(0x000000, 0.35); bg.fillRoundedRect(1, 3, w - 2, h - 1, 9);
        bg.fillStyle(0x4a2508, 1); bg.fillRoundedRect(0, down ? 2 : 0, w, h - 2, 9);
        bg.fillStyle(down ? 0xe2b66e : 0xf5d595, 1); bg.fillRoundedRect(2, (down ? 2 : 0) + 2, w - 4, h - 6, 7);
        bg.fillStyle(0xfff0c8, 1); bg.fillRoundedRect(5, (down ? 2 : 0) + 4, w - 10, 6, 3);
        bg.fillStyle(0xd09a50, 1); bg.fillRoundedRect(4, (down ? 2 : 0) + h - 16, w - 8, 10, 4);
      };
      draw(false);
      const im = this.add.image(w / 2, 21, 'icons', iconFrame(icon)).setScale(WIDE ? 0.55 : 0.48);
      const t = txt(this, w / 2, h - 11, label, WIDE ? 12 : 10, '#4a2208', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#fff4d8', strokeW: 3 });
      const z = this.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      c.add([bg, im, t, z]);
      let pressed = false;
      z.on('pointerdown', () => { pressed = true; draw(true); im.y = 23; t.y = h - 9; });
      z.on('pointerout', () => { if (pressed) { pressed = false; draw(false); im.y = 21; t.y = h - 11; } });
      z.on('pointerup', () => {
        if (!pressed) return;
        pressed = false; draw(false); im.y = 21; t.y = h - 11;
        if (this.modalOpen()) return;
        sfx.click(); fn();
      });
    });
  }

  // ================================================================ modals / toasts / popups
  modalOpen() { return this.modals.length > 0 || !!document.getElementById('warteg-dom'); }
  modal(o: ModalOpts = {}): Modal {
    const m = new Modal(this, 2000 + this.modals.length * 20, o);
    this.modals.push(m);
    this.hideToastsIn(m.rect());
    m.onClosed = () => { this.modals = this.modals.filter((x) => x !== m); this.refreshHud(true); this.tut?.onModalClosed(); };
    this.tut?.onModalOpened(m);
    return m;
  }
  closeAll() { for (const m of [...this.modals]) m.close(); }
  toast(text: string) {
    this.toastQ.push(text);
    if (this.toastQ.length > 4) this.toastQ.splice(0, this.toastQ.length - 4);
    if (!this.toastBusy) { this.toastBusy = true; this.time.delayedCall(30, () => this.nextToast()); }
  }
  /** a free spot for a toast of this size that never touches an open dialog / the coach bubble (null = hold it) */
  toastSlot(w: number, h: number): { x: number; y: number; wrap?: number } | null {
    const m = this.modals[this.modals.length - 1];
    if (!m) {
      let y = this.rushBottom + 12 + h / 2;
      const tb = (this.children.getByName('tutBubble') ?? this.children.getByName('hintBubble')) as Phaser.GameObjects.Container | null;
      if (tb && tb.visible) {
        const b = this.tut?.hintRect() ?? tb.getBounds();
        if (y + h / 2 > b.y - 4 && y - h / 2 < b.bottom + 4) y = b.bottom + 6 + h / 2 <= BAR_Y - 4 ? Math.round(b.bottom + 6 + h / 2) : Math.round(b.y - 6 - h / 2);
      }
      return { x: this.vcx(), y };
    }
    const r = m.rect();
    if (m.opts.noPanel) return null;
    const pad = 6;
    const below = GH - r.y1 >= h + pad * 2 ? { x: GW / 2, y: Math.round(GH - pad - h / 2) } : null;
    const above = r.y0 >= h + pad * 2 ? { x: GW / 2, y: Math.round(pad + h / 2) } : null;
    const pick = below ?? above;
    if (pick) return pick;
    const gut = Math.min(r.x0, GW - r.x1) - pad * 2;
    if (gut >= Math.min(w, 150)) return { x: Math.round(r.x1 + pad + gut / 2), y: Math.round(GH / 2), wrap: Math.min(300, gut - 24) };
    return null;
  }
  hideToastsIn(r: { x0: number; x1: number; y0: number; y1: number }) {
    for (const o of this.children.list) {
      if (o.name !== 'toast') continue;
      const c = o as Phaser.GameObjects.Container;
      const b = c.getBounds();
      if (b.right > r.x0 && b.x < r.x1 && b.bottom > r.y0 && b.y < r.y1) c.setVisible(false);
    }
  }
  private nextToast() {
    if (!this.sys.isActive()) { this.toastQ = []; this.toastBusy = false; return; }
    const t = this.toastQ[0];
    if (!t) { this.toastBusy = false; return; }
    const label = txt(this, 0, 0, t, 12, '#4a2208', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', align: 'center', wrap: Math.min(300, GW - 40) });
    let slot = this.toastSlot(Math.min(330, label.width + 24), label.height + 10);
    if (slot?.wrap && slot.wrap < 300) { label.setWordWrapWidth(slot.wrap, true); slot = this.toastSlot(label.width + 24, label.height + 10); if (slot && !slot.wrap) slot = null; }
    if (!slot) { label.destroy(); this.time.delayedCall(400, () => this.nextToast()); return; }
    this.toastQ.shift();
    const c = this.add.container(slot.x, slot.y).setDepth(5000).setName('toast');
    const w = Math.min(GW - 16, label.width + 24), h = label.height + 10;
    const g = this.add.graphics(); bubbleGfx(g, w, h, 0xffe27a, 0x7a4a08, false, 10);
    c.add([g, label]);
    c.setAlpha(0); c.y = slot.y - 10;
    this.tweens.add({ targets: c, alpha: 1, y: slot.y, duration: 180 });
    this.time.delayedCall(2100, () => this.tweens.add({ targets: c, alpha: 0, duration: 220, onComplete: () => { c.destroy(); this.nextToast(); } }));
  }
  /** world popup bubble ("+Rp12rb", "Laris!") that never overlaps another */
  popup(x: number, y: number, text: string, color: string) {
    if (this.pops.length > 12) return;
    const t = txt(this, 0, 0, text, 8, '#3a1e08', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', res: 3 });
    const w = Math.round(t.width + 14), h = Math.round(t.height);
    t.x = 3;
    // keep the bubble inside the visible part of the world (it used to clip at the right screen edge)
    const wv = this.worldCam?.worldView;
    if (wv && wv.width > w + 4) x = Math.max(wv.x + w / 2 + 2, Math.min(wv.right - w / 2 - 2, x));
    if (wv) y = Math.max(wv.y + h / 2 + 8, Math.min(wv.bottom - h / 2 - 2, y));
    let py = y;
    const hit = (yy: number) => this.pops.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 + 1 && Math.abs(p.c.y - yy) < (p.h + h) / 2 + 1);
    let tries = 0;
    while (hit(py) && tries < 4) { py -= h + 2; tries++; }
    if (hit(py)) return;
    const c = this.add.container(Math.round(x), Math.round(py)).setDepth(1500);
    const g = this.add.graphics();
    bubbleGfx(g, w, h, 0xffffff, 0x3a1e08, true, Math.min(6, h / 2));
    g.fillStyle(0x3a1e08, 1); g.fillCircle(-w / 2 + 6, 0, 3.5);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1); g.fillCircle(-w / 2 + 6, 0, 2.6);
    c.add([g, t]);
    const pop: Pop = { c, x: Math.round(x), y: Math.round(py), w, h };
    this.pops.push(pop);
    c.setScale(0.4);
    this.tweens.add({ targets: c, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, y: c.y - 6, duration: 1100, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 950, duration: 250, onComplete: () => { c.destroy(); this.pops = this.pops.filter((p) => p !== pop); } });
  }
  speech(m: Mover, text: string) {
    const t = txt(this, 0, 0, text, 8, '#3a1e08', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', res: 3 });
    const wv = this.worldCam?.worldView, bw = t.width + 10;
    let sx = m.img.x, sy = m.img.y - CHAR_H - 12;
    if (wv && wv.width > bw + 4) sx = Math.max(wv.x + bw / 2 + 2, Math.min(wv.right - bw / 2 - 2, sx));
    if (wv) sy = Math.max(wv.y + t.height / 2 + 2, sy);
    const c = this.add.container(sx, sy).setDepth(1490);
    const g = this.add.graphics(); bubbleGfx(g, t.width + 10, t.height, 0xffffff, 0x3a1e08, true, 5);
    c.add([g, t]); c.setScale(0.3);
    this.tweens.add({ targets: c, scale: 1, duration: 150, ease: 'Back.easeOut' });
    this.time.delayedCall(1500, () => c.destroy());
  }

  // ================================================================ sim events
  onSim(e: SimEvent) {
    switch (e.type) {
      case 'arrive': this.onArriveCust(e.c); break;
      case 'served': this.onServed(e.c, e.amount, e.kasbon, e.dishes); break;
      case 'leave': this.leaveCust(e.c, e.reason); break;
      case 'ojolPickup': this.ojolArrive(e.o); break;
      case 'ojolDone': this.ojolLeave(e.o, true, e.amount); break;
      case 'ojolBatal': this.ojolLeave(e.o, false); break;
      case 'ojolNew': sfx.pop(); break;
      case 'toast': this.toast(e.text); break;
      case 'pop': this.popup(this.queueSpots()[0].x, this.queueSpots()[0].y - CHAR_H - 18, e.text, e.color ?? '#e8701a'); break;
      case 'choice': screens.showChoice(this, e.ev as ChoiceEvent); break;
      case 'dayStart': this.syncStaff(); this.larisShown.clear(); break;
      case 'dayEnd': this.onDayEnd(e.report); break;
      case 'review': break;
      case 'hint': this.tut?.queueHint(e.id); break;
      case 'cat': this.onCat(e.kind); break;
      case 'achievement': screens.achievementToast(this, e.id); break;
      case 'staffChange': this.syncStaff(); break;
      case 'levelUp': this.toast(`${e.st.name} naik ke Lv ${e.st.level}!`); sfx.levelup(); break;
      case 'stage': if (this.builtStage !== this.s.stage && this.builtStage > 0) this.renovate(this.sim.stageInfo().name); else this.buildWorld(); break;
      case 'decor': this.buildWorld(); break;
      case 'bus': this.busArrive(e.n); break;
      case 'research': sfx.fanfare(); break;
      case 'visitor': if (e.kind !== 'belanja') this.spawnExtra(e.kind); break;
      case 'ending': this.time.delayedCall(400, () => screens.showEnding(this)); break;
      case 'bankrupt': screens.showBankrupt(this); break;
    }
  }
  private onDayEnd(r: DayReport) {
    saveGame(this.s);
    this.lastSave = Date.now();
    this.tut?.onDayEnd();
    if (this.s.absDay === 0 || this.reportFull === 1 || (this.reportFull === 2 && (r.day < 2 || dateOf(r.day).day === 7)) || (this.tut && this.tut.wantsReport())) screens.showDayReport(this, r);
    else this.reportMini(r);
  }
  private reportMini(r: DayReport) {
    this.reportCard?.destroy();
    const w = Math.min(300, this.vx1 - this.vx0 - 20), h = 46;
    const x = this.vcx(), y = this.vy1 - h / 2 - 8;
    const c = this.add.container(x, y).setDepth(1500).setName('reportMini');
    const g = this.add.graphics(); drawPanel(g, -w / 2, -h / 2, w, h, 'paper'); c.add(g);
    c.add(txt(this, 0, -11, `Tutup! ${r.served} pelanggan · ${r.stars.toFixed(1)}★ ${r.deltaStars >= 0.01 ? '▲' : r.deltaStars <= -0.01 ? '▼' : ''}`, 11, COL.text, { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' }));
    c.add(txt(this, 0, 8, `Laba hari ini ${r.profit >= 0 ? '+' : ''}${fmtShort(r.profit)}  ·  Terlaris: ${r.best}`, 10, r.profit >= 0 ? COL.green : COL.red, { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' }));
    const z = this.add.zone(-w / 2, -h / 2, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => { if (!this.modalOpen()) screens.showDayReport(this, r); });
    c.add(z);
    this.reportCard = c;
    this.tweens.add({ targets: c, alpha: { from: 0, to: 1 }, duration: 200 });
    this.time.delayedCall(3200, () => { if (this.reportCard === c) { this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => { c.destroy(); if (this.reportCard === c) this.reportCard = null; } }); } });
  }

  // ================================================================ loop
  private lastT = 0;
  /** debug / tests: game frames and the last frame's delta (ms) */
  frameNo = 0;
  lastDt = 0;
  update(t: number, dtRaw: number) {
    // real elapsed time (Phaser's smoothed delta under-reports on slow / throttled frames)
    const real = this.lastT ? t - this.lastT : dtRaw;
    this.lastT = t;
    const dt = Math.max(0, Math.min(real, 250));
    const spd = SPEEDS[this.speedIdx];
    const paused = this.modalOpen() || this.sim.pending.length > 0 || this.s.bankrupt || (this.tut?.blocking() ?? false);
    if (!paused && spd > 0) {
      this.acc += dt * spd;
      let n = 0;
      while (this.acc >= TICK_MS && n < 4) {
        this.acc -= TICK_MS; n++;
        this.sim.tick();
        if (this.modalOpen() || this.sim.pending.length) { this.acc = 0; break; }
      }
    }
    this.moveMovers(dt, paused ? 0 : Math.max(1, spd), t);
    this.frameNo++; this.lastDt = dt;
    if (!paused) this.updateBelanja();
    this.animateStaff(t);
    if (!this.renovating && (this.builtStage !== this.s.stage || this.builtDecor !== this.s.decor.join(',') || this.builtFloor !== this.floorView)) this.buildWorld();
    this.refreshHud();
    if (Date.now() - this.lastSave > 20000) { saveGame(this.s); this.lastSave = Date.now(); }
    this.tut?.update();
    // v1.3 ambience: radio track, weather overlay, the cat, street figuran, music notes from the radio
    if (this.frameNo % 20 === 0) this.refreshMusic();
    this.updateWeather(dt, paused ? 0 : Math.max(1, spd), t);
    this.updateCat(dt, paused ? 0 : Math.max(1, spd), t);
    this.updateFigs(t, paused || spd === 0);
    this.updateVehicles(t, dt, paused ? 0 : Math.max(1, spd));
    this.updateRadio(t, paused);
    // idle staff chatter
    if (!paused && spd > 0 && Math.random() < 0.0015 * spd && this.sim.queue().length > 2) {
      const list = [...this.staffSpr.values()].filter((m) => m.img.visible);
      if (list.length) this.speech(list[Math.floor(Math.random() * list.length)], ['Monggo dipilih!', 'Laris manis!', 'Nasinya anget!', 'Sabar ya, Kak!', 'Lauk baru mateng!'][Math.floor(Math.random() * 5)]);
    }
    void DAY_TICKS;
  }
  // ================================================================ v1.3: radio, weather, cat, figuran
  /** the radio's track for this moment (koplo during the rush / buka puasa) */
  refreshMusic() {
    const lab = (this.s.tick < DAY_TICKS ? rushLabel2(this.sim, this.s.tick) : null) ?? rushLabel(this.s.tick);
    sfx.playMusic(sfx.radioTrack(lab === 'JAM MAKAN SIANG' || lab === 'BUKA PUASA' || lab === 'SAHUR'));
  }
  private radioProp: Phaser.GameObjects.Container | null = null;
  private nextNote = 0;
  private buildRadio() {
    this.radioProp?.destroy();
    const p = this.s.stage === 1 ? B(352, 352) : this.lay().wallR(44.5, 49);
    const c = this.add.container(p.x, p.y).setDepth(this.s.stage === 1 ? OV_DEPTH.counter + 41 : 6).setName('radioProp');
    const g = this.add.graphics();
    if (this.s.stage > 1) { g.fillStyle(0x5a3418, 1); g.fillRect(-13, 5, 26, 3); g.fillStyle(0x3a200c, 1); g.fillRect(-10, 8, 2, 4); g.fillRect(8, 8, 2, 4); }
    g.lineStyle(1, 0x2b1a10, 1); g.lineBetween(6, -6, 11, -15);
    g.fillStyle(0x2b1a10, 1); g.fillRoundedRect(-11, -7, 22, 13, 2);
    g.fillStyle(0xb03a2a, 1); g.fillRoundedRect(-10, -6, 20, 11, 2);
    g.fillStyle(0xf0d8a8, 1); g.fillCircle(-4, 0, 3.5);
    g.fillStyle(0x6a3a18, 1); g.fillCircle(-4, 0, 2);
    g.fillStyle(0xfff0b0, 1); g.fillRect(2, -4, 6, 3);
    g.fillStyle(0x2b1a10, 1); g.fillRect(3, 1, 1, 2); g.fillRect(6, 1, 1, 2);
    c.add(g);
    const z = this.add.zone(-14, -16, 28, 26).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => { if (!this.modalOpen() && !this.dragMoved) { sfx.click(); screens2.openRadio(this); } });
    c.add(z);
    this.radioProp = c;
    this.w(c);
  }
  private updateRadio(t: number, paused: boolean) {
    const c = this.radioProp; if (!c || paused || t < this.nextNote) return;
    this.nextNote = t + 1400 + Math.random() * 900;
    if (sfx.radio === 'mati' || sfx.muted || !sfx.musicOn) return;
    const n = txt(this, c.x + 4, c.y - 10, sfx.radio === 'berita' ? '·)' : '♪', 9, sfx.radio === 'iklan' ? '#e8701a' : '#4a2208', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', res: 3 }).setDepth(1480);
    this.tweens.add({ targets: n, y: n.y - 18, x: n.x + 6 + Math.random() * 6, alpha: 0, duration: 1400, onComplete: () => n.destroy() });
  }

  private wfx: Phaser.GameObjects.Graphics | null = null;
  private drops: { x: number; y: number; v: number }[] = [];
  private updateWeather(dt: number, k: number, t: number) {
    const w = this.s.weather, wc = this.worldCam;
    if (!wc) return;
    if (!this.wfx) this.wfx = this.add.graphics().setDepth(1400).setName('weatherFx');
    const g = this.wfx;
    g.clear();
    if (w === 'normal') return;
    const v = wc.worldView;
    if (w === 'hujan') {
      g.fillStyle(0x1a2a4a, 0.16); g.fillRect(v.x, v.y, v.width, v.height);
      const want = Math.round(Math.min(80, v.width * v.height / 900));
      while (this.drops.length < want) this.drops.push({ x: Math.random(), y: Math.random(), v: 0.6 + Math.random() * 0.5 });
      if (this.drops.length > want) this.drops.length = want;
      g.lineStyle(1, 0xd8ecff, 0.55);
      for (const d of this.drops) {
        d.y += d.v * dt / 1000 * (k ? 1.1 : 0); d.x -= d.v * dt / 1000 * (k ? 0.18 : 0);
        if (d.y > 1) { d.y -= 1; d.x = Math.random(); }
        if (d.x < 0) d.x += 1;
        const x = v.x + d.x * v.width, y = v.y + d.y * v.height;
        g.lineBetween(x, y, x - 2, y + 7);
      }
    } else {
      const a = 0.06 + 0.02 * Math.sin(t / 700);
      g.fillStyle(0xffa030, a); g.fillRect(v.x, v.y, v.width, v.height);
      g.fillStyle(0xfff2a0, 0.12); g.fillCircle(v.right - 10, v.y + 8, 40);
      g.lineStyle(1, 0xfff0d0, 0.35);
      for (let i = 0; i < 4; i++) { const y = v.bottom - 10 - i * 9, ph = t / 300 + i; for (let x = v.x; x < v.right; x += 14) g.lineBetween(x, y + Math.sin(ph + x / 20) * 1.5, x + 7, y + Math.sin(ph + (x + 7) / 20) * 1.5); }
    }
  }

  private cat: { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; px: number; py: number; path: P[]; mode: 'walk' | 'idle'; until: number; anim: number; fr: number; left: boolean; task: 'steal' | 'run' | null; speed: number } | null = null;
  private catNodes(): P[] { const n = this.navFor().nodes; return n.slice(0, Math.max(1, n.length - 5)); }
  syncCat() {
    const on = this.s.cat.adopted;
    if (!on && this.cat) { this.cat.img.destroy(); this.cat.shadow.destroy(); this.cat = null; return; }
    if (!on || this.cat) return;
    const nodes = this.catNodes(); const p = nodes[Math.floor(Math.random() * nodes.length)];
    const shadow = this.add.ellipse(p.x, p.y, 12, 4, 0x000000, 0.25).setDepth(p.y - 0.5);
    const img = this.add.image(p.x, p.y, 'extra', EXTRA_F('cat_sit')).setOrigin(0.5, 1).setScale(CH).setDepth(p.y).setName('catSprite');
    img.setInteractive({ useHandCursor: true });
    img.on('pointerup', () => { if (!this.modalOpen() && !this.dragMoved) { sfx.click(); screens2.openKucing(this); } });
    this.cat = { img, shadow, px: p.x, py: p.y, path: [], mode: 'idle', until: 0, anim: 0, fr: 0, left: false, task: null, speed: 26 };
  }
  private catGo(to: P, task: 'steal' | 'run' | null = null, speed = 26) {
    const c = this.cat; if (!c) return;
    const { nodes, obst } = this.navFor();
    c.path = findPath({ x: c.px, y: c.py }, to, nodes, obst); c.mode = 'walk'; c.task = task; c.speed = speed;
  }
  private onCat(kind: 'steal' | 'happy' | 'eat' | 'adopt') {
    if (kind === 'adopt') { this.syncCat(); return; }
    const c = this.cat; if (!c) return;
    if (kind === 'steal') { const q = this.queueSpots(); if (q.length > 1) this.catGo(this.s.stage === 1 ? { x: q[0].x - 18, y: q[0].y - 4 } : { x: q[1].x + 6, y: q[1].y - 2 }, 'steal', 38); }
    else this.popup(c.px, c.py - 18, kind === 'eat' ? 'Nyam nyam' : '♥ Meong~', kind === 'eat' ? '#e8701a' : '#d0402e');
  }
  private updateCat(dt: number, k: number, t: number) {
    if (this.frameNo % 120 === 0) this.syncCat();
    const c = this.cat; if (!c || !k) return;
    if (c.mode === 'walk') {
      let budget = c.speed * k * dt / 1000;
      const x0 = c.px;
      while (budget > 0 && c.path.length) {
        const tg = c.path[0]; const dx = tg.x - c.px, dy = tg.y - c.py, d = Math.hypot(dx, dy);
        if (d <= budget) { c.px = tg.x; c.py = tg.y; budget -= d; c.path.shift(); } else { c.px += dx / d * budget; c.py += dy / d * budget; budget = 0; }
      }
      if (Math.abs(c.px - x0) > 0.01) c.left = c.px < x0;
      c.anim += c.speed * k * dt / 1000;
      if (c.anim > 5) { c.anim = 0; c.fr ^= 1; }
      c.img.setFrame(EXTRA_F(c.task === 'run' ? 'cat_fish' : c.fr ? 'cat_walk2' : 'cat_walk')).setFlipX(c.left);
      if (!c.path.length) {
        if (c.task === 'steal') { c.img.setFrame(EXTRA_F('cat_fish')); this.popup(c.px, c.py - 16, 'Nyolong!', '#c0392b'); const ex = this.s.stage === 1 ? { x: c.px + 60, y: c.py + 50 } : this.entIn(); this.time.delayedCall(500, () => this.catGo(ex, 'run', 70)); c.mode = 'idle'; c.until = t + 1e9; }
        else { c.mode = 'idle'; c.task = null; c.until = t + (3500 + Math.random() * 8000) / k; c.img.setFrame(EXTRA_F(Math.random() < 0.4 ? 'cat_sleep' : 'cat_sit')).setFlipX(c.left); }
      }
    } else if (t > c.until) {
      const nodes = this.catNodes();
      this.catGo(nodes[Math.floor(Math.random() * nodes.length)]);
    }
    c.img.setPosition(c.px, c.py).setDepth(c.py);
    c.shadow.setPosition(c.px, c.py).setDepth(c.py - 0.5);
  }

  private figs: { m: Mover; kind: FigKind; done: boolean }[] = [];
  private nextFig = 0;
  private updateFigs(t: number, paused: boolean) {
    if (paused || (this.s.stage >= 6 && this.floorView === 2)) return;
    if (!this.nextFig) this.nextFig = t + 6000;
    if (t < this.nextFig || this.figs.length >= 2) return;
    this.nextFig = t + 14000 + Math.random() * 20000;
    const h = 5 + this.s.tick / 4;
    const kinds = (Object.keys(FIGURAN) as FigKind[]).filter((k) => h >= FIGURAN[k].from && h < FIGURAN[k].to && !this.figs.some((f) => f.kind === k));
    if (!kinds.length) return;
    this.spawnFig(kinds[Math.floor(Math.random() * kinds.length)]);
  }
  spawnFig(kind: FigKind) {
    const F = FIGURAN[kind];
    const side = Math.random() < 0.5 ? 0 : 1;
    const SP = this.s.stage === 1 ? SPAWNS : layoutFor(this.s.stage, 1).spawns;
    const m = this.mover(F.sprite, SP[side]);
    this.spawnAt(m, side);
    m.img.setName('fig_' + kind);
    this.extras.push(m);
    const fig = { m, kind, done: false };
    this.figs.push(fig);
    m.img.setInteractive({ useHandCursor: true });
    m.img.on('pointerup', () => {
      if (this.modalOpen() || this.dragMoved || fig.done) return;
      const e = figuranAct(this.sim, kind);
      if (e && e.startsWith('Uang')) { this.toast(e); sfx.bad(); return; }
      fig.done = true; sfx.coin();
      this.popup(m.img.x, m.img.y - CHAR_H - 6, '♥ Makasih!', '#2e8b3a');
      if (e) this.toast(e);
    });
    const stopAt: Record<FigKind, P> = { pengamen: S2(128, -21), parkir: S2(214, -27), asongan: S2(92, -24), hansip: S2(160, -24) };
    const stay = kind === 'parkir' ? 11000 : kind === 'pengamen' ? 8000 : 5000;
    this.walkTo(m, this.route(m, stopAt[kind]), () => {
      this.faceDir(m, side === 1, false); m.idle = 'stand';
      this.speech(m, F.lines[Math.floor(Math.random() * F.lines.length)]);
      if (kind === 'pengamen') for (let i = 1; i < 6; i++) this.time.delayedCall(i * 1300, () => { if (m.img.active && m.mode !== 'walk') this.popup(m.img.x + 8, m.img.y - CHAR_H - 2, '♪', '#e8701a'); });
      this.time.delayedCall(stay, () => {
        if (!m.img.active) return;
        const end = SP[1 - side];
        this.walkTo(m, this.route(m, { x: end.x + m.jx, y: end.y + m.jy }), () => { this.destroyMover(m); this.extras = this.extras.filter((x) => x !== m); this.figs = this.figs.filter((x) => x !== fig); }, kind === 'hansip' ? 30 : 38);
        m.fadeOut = true;
      });
    }, kind === 'hansip' ? 30 : 38);
    hint(this.sim, 'figuran');
  }


  // ================================================================ v1.4: bigger rooms (upstairs, waiters, renovation, parkiran)
  /** Restoran Besar: switch the view between Lantai 1 and Lantai 2 */
  setFloor(f: 1 | 2) {
    if (this.s.stage < 6 || f === this.floorView) return;
    this.floorView = f;
    this.buildWorld();
    this.camHome(); this.applyWorldCam();
    this.refreshFloorBtn();
    hint(this.sim, 'lantai2');
  }
  private floorBtn: Phaser.GameObjects.Container | null = null;
  /** the Lantai 1 / Lantai 2 toggle over the room (Restoran Besar only) */
  refreshFloorBtn() {
    this.floorBtn?.destroy(); this.floorBtn = null;
    if (this.s.stage < 6) return;
    const x = this.vx1 - 90, y = Math.max(this.vy0, WIDE ? this.rushBottom : this.vy0) + 6;
    const label = this.floorView === 1 ? 'Lantai 2 ▲' : 'Lantai 1 ▼';
    const b = button(this, x, y, 84, 24, label, () => { sfx.click(); this.setFloor(this.floorView === 1 ? 2 : 1); }, { kind: 'primary', size: 10 });
    b.setName('floor_toggle').setDepth(1450);
    this.floorBtn = b;
    this.chrome.push(b);
  }
  /** a customer with an upstairs seat walks to the stairs and goes up (ground floor view) */
  private goUpstairs(id: number) {
    const m = this.cust.get(id); const st = this.lay().stairs;
    if (!m || !st) return;
    this.walkTo(m, this.route(m, st.foot), () => {
      this.popup(m.img.x, m.img.y - CHAR_H - 6, 'Naik ke atas', '#8a5a2c');
      m.fadeOut = true;
      this.walkTo(m, [{ x: st.foot.x + 14, y: st.foot.y - 22 }], () => { this.destroyMover(m); this.cust.delete(id); }, 48);
      m.depthFix = st.foot.y - 30;
    }, 48);
  }
  /** upstairs view: a guest arrives from the stairs, eats at an upstairs seat and goes back down */
  private upstairsGuest(c: Customer) {
    const L = this.lay(); const st = L.stairs; if (!st) return;
    if (this.cust.size >= 30) return;
    const m = this.mover(CUST[c.type].sprite, st.head);
    this.place(m, { x: st.head.x + 10, y: st.head.y - 14 }); m.img.setAlpha(0); m.shadow.setAlpha(0); m.fadeIn = 0;
    this.cust.set(c.id, m); m.phase = 'served';
    const local = Math.max(0, c.seat - this.l1Seats());
    const n = Math.min(L.seats.length, Math.max(1, this.sim.seats() - this.l1Seats()));
    let si = local % n;
    const taken = new Set(this.seatsTaken.values());
    for (let i = 0; i < n && taken.has(si); i++) si = (si + 1) % n;
    if (taken.has(si)) { this.destroyMover(m); this.cust.delete(c.id); return; }
    this.seatsTaken.set(c.id, si); m.seat = si;
    const seat = L.seats[si];
    this.walkTo(m, [...this.route(m, seat.approach[0]), seat.p], () => {
      m.mode = 'sit'; m.phase = 'eat'; m.idle = 'sit';
      const front = seat.kind === 'front';
      if (front) { m.left = true; m.up = true; this.setF(m, '_bs', true); } else { m.left = false; m.up = false; this.setF(m, '_s', false); }
      m.shadow.setVisible(false);
      m.depthFix = front ? seat.depth + 1 + seat.p.y / 1000 : seat.depth - 1; m.img.setDepth(m.depthFix);
      if (L.vip && seat.table >= 4) this.popup(m.img.x, m.img.y - CHAR_H, 'VIP', '#b8860b');
      this.serveToTable(m, seat);
      this.time.delayedCall(3000 / Math.max(1, SPEEDS[this.speedIdx] || 1), () => {
        if (!this.cust.has(c.id)) return;
        m.phase = 'leaving'; this.seatsTaken.delete(c.id); m.shadow.setVisible(true);
        this.walkTo(m, [seat.approach[0]], () => this.walkTo(m, this.route(m, st.head), () => { m.fadeOut = true; this.walkTo(m, [{ x: st.head.x + 10, y: st.head.y - 14 }], () => { this.destroyMover(m); this.cust.delete(c.id); }, 46); }, 46), 46);
        m.final = true;
      });
    }, 46);
    m.finalLeg = true;
  }
  /** Rumah Makan+: a waiter brings the plates to the table (walks out around the counter and back) */
  private serveToTable(guest: Mover, seat: Seat) {
    const L = this.lay();
    const free = this.s.staff.filter((x) => x.role === 'pelayan' && !x.off && !x.assign).map((x) => this.staffSpr.get(x.id)).filter((m): m is Mover => !!m && m.img.visible && m.mode !== 'walk' && !m.outing);
    if (!free.length) return;
    const w = free[Math.floor(Math.random() * free.length)];
    const home = w.home; if (!home) return;
    // exit behind the counter's far end (the staff passage), then through the hall
    const exit = L.floor === 2 || L.hallPelayan ? null : S2(40, L.cEnd + 16);
    const target = seat.approach[0];
    const tray = this.add.image(w.px, w.py - CHAR_H - 2, 'dishes', Math.floor(Math.random() * 15)).setScale(0.32).setDepth(1300);
    w.extra = [...(w.extra ?? []), tray];
    w.outing = 'out'; w.depthFix = undefined;
    const back = () => {
      const path = this.route(w, exit ?? home);
      this.walkTo(w, exit ? [...path, home] : path, () => {
        w.outing = undefined; w.idle = 'staff';
        const d = L.floor === 2 || L.hallPelayan ? home.y : L.counterDepth - 2 + home.y / 1000;
        w.depthFix = d; w.img.setDepth(d); w.shadow.setDepth(d - 0.01);
        this.faceDir(w, true, false);
      }, 52);
    };
    const pre = exit ? [exit] : [];
    this.walkTo(w, [...pre, ...this.route(w, target, exit ?? undefined)], () => {
      this.faceToward(w, seat.p);
      tray.destroy(); w.extra = (w.extra ?? []).filter((e) => e !== tray);
      if (Math.random() < 0.5) this.popup(guest.img.x, guest.img.y - CHAR_H + 6, 'Silakan!', '#2e8b3a');
      this.time.delayedCall(350, back);
    }, 52);
    const follow = () => { if (!tray.active) return; tray.setPosition(w.px + 6, w.py - CHAR_H + 4); tray.setDepth(w.py + 1); this.time.delayedCall(30, follow); };
    follow();
  }
  /** v1.4 decorations for the big rooms */
  private decorProps2(L: Layout) {
    const has = (d: string) => this.s.decor.includes(d);
    const g = this.w(this.add.graphics().setDepth(6));
    if (has('lampion') && L.floor === 1) {
      for (let a = 40; a < L.A - 20; a += 46) { const p = L.wallR(a, 118); g.fillStyle(0x3a200c, 1); g.fillRect(p.x, p.y - 8, 1, 8); g.fillStyle(0xd8402a, 1); g.fillEllipse(p.x, p.y + 4, 9, 11); g.fillStyle(0xf0c050, 1); g.fillRect(p.x - 3, p.y - 2, 6, 2); g.fillRect(p.x - 3, p.y + 9, 6, 2); }
    }
    if (has('lukisan')) { const p = L.wallL(Math.min(L.Bm - 30, 230), 92); g.fillStyle(0x6a3a10, 1); fp(g, [{ x: p.x - 18, y: p.y - 12 - 9 }, { x: p.x + 18, y: p.y - 12 + 9 }, { x: p.x + 18, y: p.y + 12 + 9 }, { x: p.x - 18, y: p.y + 12 - 9 }].map((q) => ({ x: q.x, y: q.y - 18 * 0 })).map((q, i) => ({ x: q.x, y: q.y + (i % 3 === 0 ? 0 : 0) })), true); g.fillStyle(0x7ab0d0, 1); fp(g, [{ x: p.x - 15, y: p.y - 18 }, { x: p.x + 15, y: p.y - 3 }, { x: p.x + 15, y: p.y + 16 }, { x: p.x - 15, y: p.y + 1 }], true); g.fillStyle(0x4a8a3a, 1); fp(g, [{ x: p.x - 15, y: p.y - 4 }, { x: p.x + 15, y: p.y + 8 }, { x: p.x + 15, y: p.y + 16 }, { x: p.x - 15, y: p.y + 1 }], true); }
    if (has('aquarium') && L.floor === 1) { const p = S2(L.A - 26, L.Bm * 0.55); const a = this.w(this.add.graphics().setDepth(p.y)); a.fillStyle(0x3a2a1a, 1); a.fillRect(p.x - 16, p.y - 8, 32, 8); a.fillStyle(0x4aa0c8, 0.85); a.fillRect(p.x - 15, p.y - 28, 30, 20); a.lineStyle(1, 0xc8e8f0, 1); a.strokeRect(p.x - 15, p.y - 28, 30, 20); a.fillStyle(0xf09030, 1); a.fillEllipse(p.x - 4, p.y - 18, 6, 3); a.fillEllipse(p.x + 6, p.y - 22, 5, 3); a.fillStyle(0x3a8a3a, 1); a.fillRect(p.x + 10, p.y - 16, 1, 7); a.fillRect(p.x - 10, p.y - 15, 1, 6); }
    if (has('karaoke') && L.floor === 2 && L.vip) { const p = S2(L.vip.a1 - 18, L.vip.b1 - 26); const k = this.w(this.add.graphics().setDepth(p.y)); k.fillStyle(0x222228, 1); k.fillRect(p.x - 14, p.y - 30, 28, 18); k.fillStyle(0x5a8ae0, 1); k.fillRect(p.x - 12, p.y - 28, 24, 14); k.fillStyle(0x3a200c, 1); k.fillRect(p.x - 10, p.y - 12, 20, 12); }
    if (has('papanmenu') && L.floor === 1) { const p = S2(122, -3); const k = this.w(this.add.graphics().setDepth(p.y + 2)); k.fillStyle(0x3a200c, 1); k.fillRect(p.x - 1, p.y - 22, 2, 22); k.fillRect(p.x - 10, p.y - 2, 20, 2); k.fillStyle(0x203028, 1); k.fillRect(p.x - 9, p.y - 34, 18, 16); k.lineStyle(1, 0xc8a060, 1); k.strokeRect(p.x - 9, p.y - 34, 18, 16); k.fillStyle(0xf0f0e0, 1); for (let i = 0; i < 4; i++) k.fillRect(p.x - 6, p.y - 31 + i * 3.5, 9 - (i % 2) * 3, 1); }
  }
  /** v1.4: renovation transition: scaffolding + dust over the old room, then the new (bigger) room with confetti */
  private renovating = false;
  renovate(name: string) {
    if (this.renovating) { this.buildWorld(); return; }
    this.renovating = true;
    const b = this.wb();
    const oldZ = this.fitZoom() * this.wz;
    const over: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics().setDepth(1390); over.push(g);
    g.fillStyle(0x2a1a0e, 0.25); g.fillRect(b.x0 - 40, b.y0 - 40, b.x1 - b.x0 + 80, b.y1 - b.y0 + 80);
    g.lineStyle(2, 0x8a8a90, 1);
    for (let x = b.x0 + 10; x < b.x1; x += 34) g.lineBetween(x, b.y0 + 10, x, b.y1 - 10);
    for (let y = b.y0 + 30; y < b.y1; y += 28) { g.lineStyle(4, 0xc08040, 1); g.lineBetween(b.x0 + 6, y, b.x1 - 6, y); g.lineStyle(1, 0x6a4020, 1); g.lineBetween(b.x0 + 6, y + 2, b.x1 - 6, y + 2); }
    const tx = txt(this, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 'RENOVASI...', 18, '#fff3d6', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#4a2208', strokeW: 4, res: 3 }).setDepth(1395);
    over.push(tx);
    for (let i = 0; i < 14; i++) {
      const p = this.add.circle(b.x0 + Math.random() * (b.x1 - b.x0), b.y1 - 20 - Math.random() * (b.y1 - b.y0) * 0.6, 6 + Math.random() * 8, 0xe8dcc0, 0.7).setDepth(1392);
      over.push(p);
      this.tweens.add({ targets: p, y: p.y - 30, scale: 2, alpha: 0, duration: 900 + Math.random() * 400, delay: Math.random() * 300 });
    }
    sfx.pop();
    this.time.delayedCall(1100, () => {
      for (const o of over) o.destroy();
      this.buildWorld();
      this.camHome(); this.applyWorldCam();
      this.refreshFloorBtn();
      // the camera starts at the old room's scale and pulls back, so the bigger room is obvious
      const target = this.wz, start = oldZ / this.fitZoom();
      if (start > target * 1.03) {
        this.wz = Math.min(3, start); this.applyWorldCam();
        this.tweens.add({ targets: this, wz: target, duration: 1500, delay: 150, ease: 'Sine.easeInOut', onUpdate: () => this.applyWorldCam() });
      }
      const nb = this.wb();
      const cols = [0xe8701a, 0x2e8b3a, 0xf0c040, 0xd8402a, 0x3a7ad8, 0xffffff];
      for (let i = 0; i < 60; i++) {
        const x = nb.x0 + Math.random() * (nb.x1 - nb.x0), y = nb.y0 - 10 - Math.random() * 60;
        const r = this.add.rectangle(x, y, 3, 2, cols[i % cols.length]).setDepth(1398).setAngle(Math.random() * 180);
        this.tweens.add({ targets: r, y: y + (nb.y1 - nb.y0) * (0.6 + Math.random() * 0.4), x: x + (Math.random() - 0.5) * 60, angle: r.angle + 360, alpha: { from: 1, to: 0 }, duration: 1800 + Math.random() * 900, onComplete: () => r.destroy() });
      }
      const ban = txt(this, (nb.x0 + nb.x1) / 2, nb.y0 + 40, `${name.toUpperCase()}!`, 16, '#fff09a', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#7a2a10', strokeW: 4, res: 3 }).setDepth(1399);
      this.tweens.add({ targets: ban, y: ban.y - 16, alpha: { from: 1, to: 0 }, delay: 1600, duration: 900, onComplete: () => ban.destroy() });
      sfx.fanfare();
      this.renovating = false;
    });
  }
  /** v1.4 Restoran Besar: cars / motorbikes arriving at the parkiran, the rombongan bus */
  private vehicles: { img: Phaser.GameObjects.Image; t: number; path: P[]; speed: number; stay: number; onStop?: () => void; flip: boolean }[] = [];
  private nextCar = 0;
  private updateVehicles(t: number, dt: number, k: number) {
    if (this.s.stage < 5 || (this.s.stage >= 6 && this.floorView === 2)) { if (this.vehicles.length) { for (const v of this.vehicles) v.img.destroy(); this.vehicles = []; } return; }
    const L = layoutFor(this.s.stage, 1);
    if (k > 0 && t > this.nextCar && this.vehicles.length < 3 && this.s.tick > 4 && this.s.tick < DAY_TICKS - 4) {
      this.nextCar = t + (this.s.stage >= 6 ? 5000 : 9000) + Math.random() * 7000;
      const car = Math.random() < (this.s.stage >= 6 ? 0.6 : 0.35);
      const tex = car ? `bdp_car_${Math.floor(Math.random() * 4)}` : `bdp_motor_${'rbkw'[Math.floor(Math.random() * 4)]}`;
      if (this.textures.exists(tex)) {
        // drive in along the street, turn into the parkiran, park a while, drive off
        const slot = L.A + 30 + Math.random() * (this.s.stage >= 6 ? 120 : 60);
        const bb = 20 + Math.random() * (L.Bm - 60);
        const path = [S2(-160, -100), S2(slot, -100), S2(slot, -40), S2(slot, bb)];
        this.spawnVehicle(tex, path, car ? 34 : 40, 8000 + Math.random() * 8000);
      }
    }
    for (const v of [...this.vehicles]) {
      if (k === 0) continue;
      if (v.path.length) {
        const tgt = v.path[0]; const dx = tgt.x - v.img.x, dy = tgt.y - v.img.y, d = Math.hypot(dx, dy);
        const step = v.speed * k * dt / 1000;
        if (d <= step) { v.img.setPosition(tgt.x, tgt.y); v.path.shift(); if (!v.path.length) v.onStop?.(); }
        else { v.img.setPosition(v.img.x + dx / d * step, v.img.y + dy / d * step); if (Math.abs(dx) > 0.1) v.img.setFlipX(dx < 0 ? !v.flip : v.flip); }
        v.img.setDepth(v.img.y);
      } else if ((v.stay -= dt * k) <= 0) {
        v.stay = Infinity;
        v.path = [S2(isoA(v.img.x, v.img.y), -40), S2(isoA(v.img.x, v.img.y), -100), S2(L.A + 400, -100)];
        v.onStop = () => { v.img.destroy(); this.vehicles = this.vehicles.filter((x) => x !== v); };
      }
    }
  }
  private spawnVehicle(tex: string, path: P[], speed: number, stay: number, onStop?: () => void) {
    const p0 = path.shift()!;
    const img = this.add.image(p0.x, p0.y, tex).setOrigin(0.5, 1).setScale(CH * 2).setDepth(p0.y);
    const v = { img, t: 0, path, speed, stay, onStop, flip: false };
    this.vehicles.push(v);
    return v;
  }
  /** rombongan bus event: a tour bus pulls up, a big group walks in */
  busArrive(n: number) {
    if (this.s.stage < 5 || !this.textures.exists('bdp_bus')) return;
    const L = layoutFor(this.s.stage, 1);
    this.spawnVehicle('bdp_bus', [S2(-260, -100), S2(150, -100)], 40, 9000, () => {
      this.popup(S2(150, -100).x, S2(150, -100).y - 60, `Rombongan ${n} orang!`, '#e8701a');
      sfx.pop();
    });
    void L;
  }

  /** debug / tests: open a dialog by its function name */
  openScreen(name: string) { const f = (screens as Record<string, unknown>)[name] ?? (screens3 as Record<string, unknown>)[name]; if (typeof f === 'function') (f as (g: GameScene) => void)(this); }
  /** debug / tests: the room layout of a stage */
  layoutInfo(stage: number, floor: 1 | 2 = 1) { return layoutFor(stage, floor); }
  /** v1.4: back from the national map to the town map */
  openPetaKota() { screens.openPeta(this); }
  /** debug / tests: advance n ticks synchronously */
  stepTicks(n: number) { for (let i = 0; i < n; i++) { if (this.sim.pending.length) break; this.sim.tick(); } this.refreshHud(true); }
  staffList(): Staff[] { return this.s.staff; }
}
