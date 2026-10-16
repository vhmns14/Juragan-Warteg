// v1.4 room renderer: composes the warung room of any Layout into a cached canvas texture (2x art px like the old
// bitmap, drawn at 0.5): a procedural tiled floor + walls (colours sampled from the generated room art), then the
// furniture / kitchen pieces cut from that art (tools/room_art.py -> room.png): kitchen modules along the left wall,
// the counter + etalase stretched by repeating its middle strip, table sets, wall props, the prasmanan buffet, the
// staircase and (upstairs) the VIP room. Depth-sorted overlays (counter, table tops) are separate images.
import Phaser from 'phaser';
import { WX, WY, type P } from './world';
import type { Layout, KMod } from './layout';
import roomMeta from './assets/room.json';

type RGB = [number, number, number];
const RM = roomMeta as unknown as Record<string, { r: [number, number, number, number]; o: [number, number] }>;
const hash = (x: number, y: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const c8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const mul = (c: RGB, k: number): RGB => [c8(c[0] * k), c8(c[1] * k), c8(c[2] * k)];

/** wall profile (art px above the floor) sampled from the generated room's right wall */
function wallColor(h: number, upstairs: boolean): RGB {
  const green: RGB = upstairs ? [150, 104, 70] : [106, 142, 88];
  const cream: RGB = upstairs ? [214, 196, 160] : [202, 178, 147];
  if (h < 1) return [106, 133, 94];
  if (h < 5) return upstairs ? [96, 64, 40] : [78, 100, 78];
  if (h < 6) return [106, 133, 94];
  if (h < 67) return green;
  if (h < 68 || (h >= 73 && h < 74)) return [155, 154, 122];
  if (h < 70 || (h >= 72 && h < 73)) return [176, 171, 143];
  if (h < 72) return [195, 174, 146];
  if (h < 88) return upstairs ? green : [107, 145, 88];
  if (h < 90) return [155, 154, 122];
  if (h < 250) return cream;
  if (h < 252) return [124, 104, 83];
  if (h < 268) return [139, 126, 109];
  return [78, 66, 53];
}
const FLOOR_PAL: RGB[] = [[197, 136, 80], [191, 129, 77], [200, 137, 83], [194, 134, 83], [196, 134, 78], [198, 136, 82]];

export interface RoomBuild { objs: Phaser.GameObjects.GameObject[]; steam: P[]; signAt: P }

/** canvas origin in absolute art px (the original bitmap's coordinate system: left corner of the floor at (15, 440)) */
function frame(L: Layout) {
  const X0 = -8, Y0 = Math.floor(440 - L.Bm - 268 - 16);
  const W = Math.ceil(15 + 2 * (L.A + L.Bm) + 24 - X0), H = Math.ceil(440 + L.A + 40 - Y0);
  return { X0, Y0, W, H };
}

export function buildRoom(sc: Phaser.Scene, L: Layout, name: string): RoomBuild {
  const { X0, Y0, W, H } = frame(L);
  const key = 'room_' + L.key;
  const steam: P[] = [];
  const kitchenPlan = planKitchen(L.spec.kitchen);
  for (const k of kitchenPlan) if (k.m === 'KB') steam.push({ x: WX + (255 + k.dx) / 2, y: WY + (245 - k.dx / 2) / 2 });
  if (!sc.textures.exists(key)) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    shell(ctx, L, X0, Y0, W, H);
    const src = sc.textures.get('room').getSourceImage() as CanvasImageSource;
    const piece = (n: string, ax: number, ay: number, sx0 = 0, sw?: number) => {
      const f = RM[n]; const [x, y, w, h] = f.r;
      const ww = sw ?? w - sx0;
      ctx.drawImage(src, x + sx0, y, ww, h, Math.round(ax - X0), Math.round(ay - Y0), ww, h);
    };
    // wall props: fans, menu boards (one above every stove counter)
    const up = L.floor === 2;
    if (!up) {
      piece('fan_l', RM.fan_l.o[0], RM.fan_l.o[1]);
      let kb = 0;
      for (const k of kitchenPlan) if (k.m === 'KB' && kb++ < 4) piece('menu', RM.menu.o[0] + k.dx + 0, RM.menu.o[1] - k.dx / 2);
    } else windows(ctx, L, X0, Y0);
    const dB = (L.Bm - 191) * 2; // right wall shift (art px along b)
    for (let a = 0; a < L.A - 60; a += 150) piece('fan_r', RM.fan_r.o[0] + dB + a * 2, RM.fan_r.o[1] - dB / 2 + a);
    // kitchen modules, farthest (largest b) first
    for (const k of [...kitchenPlan].reverse()) {
      const f = RM.kitchen;
      piece('kitchen', MODS[k.m][0] + k.dx, f.o[1] - k.dx / 2, MODS[k.m][0] - f.o[0], MODS[k.m][1] - MODS[k.m][0]);
    }
    if (!up) drawCounter((sx, sw, ax, ay) => piece('counter', ax, ay, sx, sw), L.spec.n);
    // buffet line, tables (farthest first), staircase, VIP partition
    const drawn: { d: number; f: () => void }[] = [];
    if (L.buffet) { const bf = L.buffet; drawn.push({ d: (bf.da - bf.db) / 2, f: () => piece('buffet', RM.buffet.o[0] + 2 * (bf.da + bf.db), RM.buffet.o[1] + bf.da - bf.db) }); }
    for (const t of L.tables) drawn.push({ d: (t.da - t.db) / 2, f: () => piece(t.kind, RM[t.kind].o[0] + 2 * (t.da + t.db), RM[t.kind].o[1] + t.da - t.db) });
    drawn.sort((p, q) => p.d - q.d);
    for (const d of drawn) d.f();
    if (L.vip) vipRoom(ctx, L, X0, Y0);
    if (L.stairs && up) stairHole(ctx, L, X0, Y0);
    sc.textures.addCanvas(key, cv);
  }
  const objs: Phaser.GameObjects.GameObject[] = [];
  objs.push(sc.add.image(WX + X0 / 2, WY + Y0 / 2, key).setOrigin(0, 0).setScale(0.5).setDepth(0));
  // counter overlay (people in line stand in front of it, staff behind it)
  if (L.floor === 1) {
    const ck = 'counter_n' + L.spec.n;
    const ox = 90 - 2, oy = Math.floor(205 - 52 * Math.max(0, L.spec.n)) - 2;
    if (!sc.textures.exists(ck)) {
      const f = RM.counter;
      const cw = f.r[2] + 104 * Math.max(0, L.spec.n) + 4, chh = f.r[3] + 52 * Math.max(0, L.spec.n) + 4;
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh;
      const ctx = cv.getContext('2d')!; ctx.imageSmoothingEnabled = false;
      const src = sc.textures.get('room').getSourceImage() as CanvasImageSource;
      drawCounter((sx, sw, ax, ay) => ctx.drawImage(src, f.r[0] + sx, f.r[1], sw, f.r[3], Math.round(ax - ox), Math.round(ay - oy), sw, f.r[3]), L.spec.n);
      sc.textures.addCanvas(ck, cv);
    }
    objs.push(sc.add.image(WX + ox / 2, WY + oy / 2, ck).setOrigin(0, 0).setScale(0.5).setDepth(L.counterDepth));
  }
  // table tops over the people on the back benches
  for (const t of L.tables) {
    const f = RM['ov_' + t.kind];
    objs.push(sc.add.image(WX + (f.o[0] + 2 * (t.da + t.db)) / 2, WY + (f.o[1] + t.da - t.db) / 2, roomFrame(sc, 'ov_' + t.kind), 'ov_' + t.kind).setOrigin(0, 0).setScale(0.5).setDepth(t.depth));
  }
  if (L.buffet) {
    const bf = L.buffet, f = RM.ov_buffet;
    objs.push(sc.add.image(WX + (f.o[0] + 2 * (bf.da + bf.db)) / 2, WY + (f.o[1] + bf.da - bf.db) / 2, roomFrame(sc, 'ov_buffet'), 'ov_buffet').setOrigin(0, 0).setScale(0.5).setDepth(220 + (bf.da - bf.db) / 2 + 54));
  }
  if (L.stairs && L.floor === 1) objs.push(stairsImage(sc, L));
  void name;
  const signAt = L.wallR(Math.min(L.A - 40, 150), 82);
  return { objs, steam, signAt };
}

/** a named frame of room.png as its own texture key (Phaser frames on the shared texture) */
function roomFrame(sc: Phaser.Scene, n: string) {
  const t = sc.textures.get('room');
  if (!t.has(n)) { const [x, y, w, h] = RM[n].r; t.add(n, 0, x, y, w, h); }
  return 'room';
}
export function setupRoomFrames(sc: Phaser.Scene) { const t = sc.textures.get('room'); for (const [n, f] of Object.entries(RM)) if (!t.has(n)) t.add(n, 0, ...f.r); }

/** kitchen modules: art x ranges in the original bitmap */
const MODS: Record<KMod, [number, number]> = { KA: [18, 166], KB: [166, 300], KC: [300, 398] };
function planKitchen(mods: KMod[]) {
  let cur = 18;
  return mods.map((m) => { const [x0, x1] = MODS[m]; const dx = cur - x0; cur += x1 - x0; return { m, dx }; });
}
/** the counter + etalase: left end, n repeats of the middle strip, right end (art px, absolute) */
function drawCounter(put: (sx: number, sw: number, ax: number, ay: number) => void, n: number) {
  const o = RM.counter.o, w = RM.counter.r[2];
  const L0 = 216, R0 = 320;
  // farthest first: right end, then the strips back to front, then the left end (pieces overlap a pixel at the joins)
  put(R0 - o[0], w - (R0 - o[0]), R0 + 104 * n, o[1] - 52 * n);
  for (let k = n; k >= 0; k--) put(L0 - o[0], R0 - L0, L0 + 104 * k, o[1] - 52 * k);
  put(0, L0 - o[0], o[0], o[1]);
}

// ---------------------------------------------------------------- shell: floor + walls
function shell(ctx: CanvasRenderingContext2D, L: Layout, X0: number, Y0: number, W: number, H: number) {
  const img = ctx.createImageData(W, H), d = img.data;
  const A = L.A, Bm = L.Bm, up = L.floor === 2;
  const floorM = new Uint8Array(W * H);
  const isoAt = (x: number, y: number) => { const lx = (x + X0 - 15) / 2, ly = y + Y0 - 440; return { a: (lx + ly) / 2, b: (lx - ly) / 2 }; };
  const put = (i: number, c: RGB, al = 255) => { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = al; };
  const vip = L.vip;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const { a, b } = isoAt(x + 0.5, y + 0.5);
      if (a < 0 || b < 0 || a > A || b > Bm) continue;
      const i = (y * W + x) * 4;
      floorM[y * W + x] = 1;
      let c: RGB;
      const n = hash(x, y);
      if (up && vip && a > vip.a0 && b < vip.b1) {
        // VIP: red carpet with a gold border
        const edge = Math.min(a - vip.a0, vip.a1 - a, b - vip.b0, vip.b1 - b);
        c = edge < 3 ? [196, 156, 70] : edge < 4 ? [120, 30, 30] : mul([150, 38, 42], 0.94 + n * 0.1);
        if (edge >= 4 && ((Math.floor(a / 6) + Math.floor(b / 6)) & 7) === 0) c = mul(c, 1.08);
      } else if (up) {
        // upstairs hall: wooden parquet (planks along a)
        const pl = Math.floor(b / 8), off = (pl * 37) % 40, seg = Math.floor((a + off) / 40);
        const tone = 0.9 + hash(pl, seg) * 0.16;
        c = mul([168, 112, 66], tone * (0.97 + n * 0.06));
        if (((b % 8) + 8) % 8 < 0.7 || ((a + off) % 40 + 40) % 40 < 0.7) c = mul(c, 0.78);
      } else {
        // large square tiles (32 logical), tone per tile, thin joints
        const ti = Math.floor(a / 32), tj = Math.floor(b / 32);
        const tone = 0.97 + hash(ti + 7, tj + 3) * 0.06;
        c = FLOOR_PAL[(n * FLOOR_PAL.length) | 0];
        c = mul(c, tone);
        const ja = ((a % 32) + 32) % 32, jb = ((b % 32) + 32) % 32;
        if (ja < 0.55 || jb < 0.55) c = [176, 118, 70];
        else if (ja < 1.1 || jb < 1.1) c = mul(c, 0.94);
      }
      // ambient occlusion along both walls + under the counter front
      const ao = Math.min(1, Math.min(a, Bm - b) / 7);
      if (ao < 1) c = mul(c, 0.84 + 0.16 * ao);
      put(i, c);
    }
  }
  // front lip of the floor slab along both front edges
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (floorM[y * W + x]) continue;
    for (let k = 1; k <= 7; k++) {
      if (y - k < 0 || !floorM[(y - k) * W + x]) continue;
      const i = (y * W + x) * 4;
      put(i, k <= 1 ? [120, 76, 42] : k >= 7 ? [70, 44, 24] : mul([150, 92, 50], 1 - k * 0.04));
      break;
    }
  }
  // walls: right wall (b = Bm) then left wall (a = 0), 268 art px tall, per column profile
  const WH = 268;
  const xL0 = Math.ceil(15 - X0), xR = Math.floor(15 + 2 * (A + Bm) - X0), xBack = Math.round(15 + 2 * Bm - X0);
  for (let x = xL0; x <= xR; x++) {
    const ax = x + X0;
    let yFloor: number, left: boolean;
    if (x <= xBack) { const b = (ax - 15) / 2; yFloor = 440 - b; left = true; }
    else { const a = (ax - 15) / 2 - Bm; yFloor = 440 + a - Bm; left = false; }
    for (let h = 0; h <= WH + 2; h++) {
      const y = Math.round(yFloor - h - Y0);
      if (y < 0 || y >= H) continue;
      let c = wallColor(h, up);
      if (left) c = h < 250 ? [c8(c[0] * 1.13), c8(c[1] * 1.15), c8(c[2] * 1.18)] : c;
      if (h > WH) c = [86, 72, 63];
      // soft vertical shading: a touch darker towards the back corner on the left wall, lighter at the front
      const k = left ? 0.97 + 0.05 * (1 - (xBack - x) / Math.max(1, xBack - xL0)) : 0.98 + hash(x, h >> 3) * 0.02;
      if (h < 250) c = mul(c, k);
      put((y * W + x) * 4, c);
    }
  }
  // outlines: back corner, both wall ends
  const vline = (x: number, yFloor: number, c: RGB) => { for (let h = 0; h <= WH + 2; h++) { const y = Math.round(yFloor - h - Y0); if (y >= 0 && y < H && x >= 0 && x < W) put((y * W + x) * 4, c); } };
  vline(xBack, 440 - Bm, [96, 84, 70]);
  for (let k = 0; k < 3; k++) { vline(xL0 + k, 440, k ? [92, 76, 60] : [56, 44, 34]); vline(xR - k, 440 + A, k ? [92, 76, 60] : [56, 44, 34]); }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- upstairs details
const ax2 = (a: number, b: number) => 15 + 2 * (a + b), ay2 = (a: number, b: number, h = 0) => 440 + (a - b) - 2 * h;
function windows(ctx: CanvasRenderingContext2D, L: Layout, X0: number, Y0: number) {
  const quad = (pts: [number, number][], fill: string) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - X0, y - Y0) : ctx.moveTo(x - X0, y - Y0))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  // right wall windows (b = Bm), left wall windows (a = 0): sky, frame, sill
  const winR = (a: number) => {
    const b = L.Bm, w = 34, h0 = 48, h1 = 104;
    quad([[ax2(a, b), ay2(a, b, h0)], [ax2(a + w, b), ay2(a + w, b, h0)], [ax2(a + w, b), ay2(a + w, b, h1)], [ax2(a, b), ay2(a, b, h1)]], '#6a4a2a');
    quad([[ax2(a + 2, b), ay2(a + 2, b, h0 + 3)], [ax2(a + w - 2, b), ay2(a + w - 2, b, h0 + 3)], [ax2(a + w - 2, b), ay2(a + w - 2, b, h1 - 3)], [ax2(a + 2, b), ay2(a + 2, b, h1 - 3)]], '#9cc8e0');
    quad([[ax2(a + 2, b), ay2(a + 2, b, h0 + 3)], [ax2(a + w - 2, b), ay2(a + w - 2, b, h0 + 3)], [ax2(a + w - 2, b), ay2(a + w - 2, b, h0 + 16)], [ax2(a + 2, b), ay2(a + 2, b, h0 + 16)]], '#b8d8a0');
    quad([[ax2(a + w / 2 - 1, b), ay2(a + w / 2 - 1, b, h0)], [ax2(a + w / 2 + 1, b), ay2(a + w / 2 + 1, b, h0)], [ax2(a + w / 2 + 1, b), ay2(a + w / 2 + 1, b, h1)], [ax2(a + w / 2 - 1, b), ay2(a + w / 2 - 1, b, h1)]], '#6a4a2a');
  };
  const winL = (b: number) => {
    const w = 34, h0 = 48, h1 = 104;
    quad([[ax2(0, b), ay2(0, b, h0)], [ax2(0, b + w), ay2(0, b + w, h0)], [ax2(0, b + w), ay2(0, b + w, h1)], [ax2(0, b), ay2(0, b, h1)]], '#7a5632');
    quad([[ax2(0, b + 2), ay2(0, b + 2, h0 + 3)], [ax2(0, b + w - 2), ay2(0, b + w - 2, h0 + 3)], [ax2(0, b + w - 2), ay2(0, b + w - 2, h1 - 3)], [ax2(0, b + 2), ay2(0, b + 2, h1 - 3)]], '#b4dcf0');
    quad([[ax2(0, b + w / 2 - 1), ay2(0, b + w / 2 - 1, h0)], [ax2(0, b + w / 2 + 1), ay2(0, b + w / 2 + 1, h0)], [ax2(0, b + w / 2 + 1), ay2(0, b + w / 2 + 1, h1)], [ax2(0, b + w / 2 - 1), ay2(0, b + w / 2 - 1, h1)]], '#7a5632');
  };
  for (let a = 30; a < L.A - 60; a += 70) winR(a);
  for (let b = 150; b < L.Bm - 50; b += 70) winL(b);
}
function vipRoom(ctx: CanvasRenderingContext2D, L: Layout, X0: number, Y0: number) {
  const v = L.vip!;
  const quad = (pts: [number, number][], fill: string, alpha = 1) => { ctx.globalAlpha = alpha; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - X0, y - Y0) : ctx.moveTo(x - X0, y - Y0))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1; };
  const H = 70;
  // glass partition along a = a0 (b0 + 30 .. b1) and along b = b1 (a0 .. a1): tinted glass, wooden posts + rail
  const wallA = (b0: number, b1: number) => {
    quad([[ax2(v.a0, b0), ay2(v.a0, b0)], [ax2(v.a0, b1), ay2(v.a0, b1)], [ax2(v.a0, b1), ay2(v.a0, b1, H)], [ax2(v.a0, b0), ay2(v.a0, b0, H)]], '#bfe4f2', 0.32);
    for (let b = b0; b <= b1; b += 22) quad([[ax2(v.a0, b), ay2(v.a0, b)], [ax2(v.a0, b + 2), ay2(v.a0, b + 2)], [ax2(v.a0, b + 2), ay2(v.a0, b + 2, H)], [ax2(v.a0, b), ay2(v.a0, b, H)]], '#5a3418');
    quad([[ax2(v.a0, b0), ay2(v.a0, b0, H)], [ax2(v.a0, b1), ay2(v.a0, b1, H)], [ax2(v.a0, b1), ay2(v.a0, b1, H - 3)], [ax2(v.a0, b0), ay2(v.a0, b0, H - 3)]], '#6a4020');
    quad([[ax2(v.a0, b0), ay2(v.a0, b0, 2)], [ax2(v.a0, b1), ay2(v.a0, b1, 2)], [ax2(v.a0, b1), ay2(v.a0, b1)], [ax2(v.a0, b0), ay2(v.a0, b0)]], '#6a4020');
  };
  const wallB = (a0: number, a1: number) => {
    const b = v.b1;
    quad([[ax2(a0, b), ay2(a0, b)], [ax2(a1, b), ay2(a1, b)], [ax2(a1, b), ay2(a1, b, H)], [ax2(a0, b), ay2(a0, b, H)]], '#bfe4f2', 0.32);
    for (let a = a0; a <= a1; a += 22) quad([[ax2(a, b), ay2(a, b)], [ax2(a + 2, b), ay2(a + 2, b)], [ax2(a + 2, b), ay2(a + 2, b, H)], [ax2(a, b), ay2(a, b, H)]], '#5a3418');
    quad([[ax2(a0, b), ay2(a0, b, H)], [ax2(a1, b), ay2(a1, b, H)], [ax2(a1, b), ay2(a1, b, H - 3)], [ax2(a0, b), ay2(a0, b, H - 3)]], '#6a4020');
  };
  wallB(v.a0, v.a1);
  wallA(v.b0 + 30, v.b1);
}
/** upstairs: the stair opening (railing around a dark hole) in the back corner */
function stairHole(ctx: CanvasRenderingContext2D, L: Layout, X0: number, Y0: number) {
  const s = L.stairs!;
  const quad = (pts: [number, number][], fill: string) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - X0, y - Y0) : ctx.moveTo(x - X0, y - Y0))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const a0 = s.a, a1 = s.a + 56, b0 = s.b + 20, b1 = s.b + 66;
  quad([[ax2(a0, b0), ay2(a0, b0)], [ax2(a1, b0), ay2(a1, b0)], [ax2(a1, b1), ay2(a1, b1)], [ax2(a0, b1), ay2(a0, b1)]], '#2a1a0e');
  // top steps visible in the hole
  for (let i = 0; i < 4; i++) { const b = b0 + 4 + i * 10; quad([[ax2(a0 + 4, b), ay2(a0 + 4, b, -6 - i * 6)], [ax2(a1 - 4, b), ay2(a1 - 4, b, -6 - i * 6)], [ax2(a1 - 4, b + 6), ay2(a1 - 4, b + 6, -6 - i * 6)], [ax2(a0 + 4, b + 6), ay2(a0 + 4, b + 6, -6 - i * 6)]], i % 2 ? '#7a4a24' : '#8a5a2c'); }
  // railing on the two open sides
  const rail = (p0: [number, number], p1: [number, number]) => {
    quad([[ax2(p0[0], p0[1]), ay2(p0[0], p0[1], 24)], [ax2(p1[0], p1[1]), ay2(p1[0], p1[1], 24)], [ax2(p1[0], p1[1]), ay2(p1[0], p1[1], 21)], [ax2(p0[0], p0[1]), ay2(p0[0], p0[1], 21)]], '#5a3418');
    const n = Math.max(2, Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 8));
    for (let i = 0; i <= n; i++) { const a = p0[0] + (p1[0] - p0[0]) * i / n, b = p0[1] + (p1[1] - p0[1]) * i / n; quad([[ax2(a, b) - 1, ay2(a, b)], [ax2(a, b) + 1, ay2(a, b)], [ax2(a, b) + 1, ay2(a, b, 22)], [ax2(a, b) - 1, ay2(a, b, 22)]], '#6a4020'); }
  };
  rail([a0, b0], [a1, b0]);
  rail([a0, b0], [a0, b1]);
}
/** ground floor: the staircase up to Lantai 2 (wooden steps rising towards the back wall) as a depth-sorted image */
function stairsImage(sc: Phaser.Scene, L: Layout) {
  const s = L.stairs!;
  const key = 'stairs_' + L.key;
  const a0 = s.a, a1 = s.a + 56, b0 = s.b, b1 = s.b + 66;
  // canvas covering the stairs (art px)
  const X0 = ax2(a0, b0) - 6, X1 = ax2(a1, b1) + 50, Y0 = ay2(a0, b1, 160) - 4, Y1 = ay2(a1, b0) + 16;
  if (!sc.textures.exists(key)) {
    const cv = document.createElement('canvas'); cv.width = X1 - X0; cv.height = Y1 - Y0;
    const ctx = cv.getContext('2d')!;
    const quad = (pts: [number, number][], fill: string) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - X0, y - Y0) : ctx.moveTo(x - X0, y - Y0))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    const N = 11, stepB = (b1 - b0) / N, stepH = 120 / N;
    // side stringer (a = a1 face, visible) as a solid wedge, then each step: riser (b face) + tread (top)
    for (let i = N - 1; i >= 0; i--) {
      const b = b0 + i * stepB, h = (i + 1) * stepH;
      quad([[ax2(a1, b), ay2(a1, b, 0)], [ax2(a1, b + stepB), ay2(a1, b + stepB, 0)], [ax2(a1, b + stepB), ay2(a1, b + stepB, h)], [ax2(a1, b), ay2(a1, b, h)]], '#6a3e1c');
      quad([[ax2(a0, b), ay2(a0, b, h - stepH)], [ax2(a1, b), ay2(a1, b, h - stepH)], [ax2(a1, b), ay2(a1, b, h)], [ax2(a0, b), ay2(a0, b, h)]], i % 2 ? '#8a5a2c' : '#94622f');
      quad([[ax2(a0, b), ay2(a0, b, h)], [ax2(a1, b), ay2(a1, b, h)], [ax2(a1, b + stepB), ay2(a1, b + stepB, h)], [ax2(a0, b + stepB), ay2(a0, b + stepB, h)]], '#c08a4c');
      quad([[ax2(a0, b), ay2(a0, b, h) - 1], [ax2(a1, b), ay2(a1, b, h) - 1], [ax2(a1, b), ay2(a1, b, h) + 1], [ax2(a0, b), ay2(a0, b, h) + 1]], '#5a3418');
    }
    // handrail on the open side (a = a1): posts + a sloped rail
    for (let i = 0; i <= N; i += 2) { const b = b0 + i * stepB, h = i * stepH; quad([[ax2(a1, b) - 1, ay2(a1, b, h)], [ax2(a1, b) + 2, ay2(a1, b, h)], [ax2(a1, b) + 2, ay2(a1, b, h + 34)], [ax2(a1, b) - 1, ay2(a1, b, h + 34)]], '#4a2810'); }
    quad([[ax2(a1, b0), ay2(a1, b0, 34)], [ax2(a1, b1), ay2(a1, b1, 154)], [ax2(a1, b1), ay2(a1, b1, 150)], [ax2(a1, b0), ay2(a1, b0, 30)]], '#3a200c');
    // sign on a post at the foot of the stairs
    const px0 = ax2(a1 + 4, b0 + 4) - X0, py0 = ay2(a1 + 4, b0 + 4) - Y0;
    ctx.fillStyle = '#4a2810'; ctx.fillRect(px0 - 1, py0 - 46, 3, 46);
    ctx.fillStyle = '#3a200c'; ctx.fillRect(px0 - 34, py0 - 70, 70, 26); ctx.fillStyle = '#f4d48a'; ctx.fillRect(px0 - 32, py0 - 68, 66, 22);
    ctx.fillStyle = '#7a2a10'; ctx.font = 'bold 12px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText('LANTAI 2 ▲', px0 + 1, py0 - 57);
    sc.textures.addCanvas(key, cv);
  }
  const p = { x: WX + X0 / 2, y: WY + Y0 / 2 };
  // depth: the front-left corner of its footprint (people in front are drawn over it, people behind under it)
  return sc.add.image(p.x, p.y, key).setOrigin(0, 0).setScale(0.5).setDepth(WY + 220 + (a0 - b0) / 2);
}
