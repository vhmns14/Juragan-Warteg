// v1.2 outside backdrop: the street corner around the warung, drawn procedurally as pixel art (1 texel = 1 logical
// px, nearest filtered like the rest of the game) into a cached canvas texture, plus a few depth-sorted props.
//
// Layout in the room's iso ground coords (see world.ts ISO / S()): the main street runs along the front-left side of the
// warung (b < 0) with its sidewalk and the entrance; a paved side yard with parked motorbikes along the front-right
// side (a > 194); taller neighbouring ruko / houses behind both back walls. Everything is muted and vignetted towards
// the edges so the room stays the focus, and the canvas fades into the camera background colour at its border, so no
// zoom / pan / aspect ratio ever shows a hard black edge.
import Phaser from 'phaser';
import { WX, WY, ISO, type P } from './world';
import { HI, CH } from './assets';

type RGB = [number, number, number];
/** canvas rect in logical px relative to (WX, WY); v1.4: sized per room (set at the start of each build) */
let OX = -344, OY = -256, W = 1088, H = 832;
/** v1.4: the room's iso extents (front-right edge a = RA, back-right wall b = RB) and the yard's far end */
let RA = 194, RB = 191, YARD = 330;
export const BACKDROP_EDGE = 0x140c06;
const EDGE: RGB = [0x14, 0x0c, 0x06];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const hash = (x: number, y: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const shade = (c: RGB, k: number): RGB => [clamp8(c[0] * k), clamp8(c[1] * k), clamp8(c[2] * k)];
const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** tiny RGBA pixel buffer with crisp (non anti-aliased) primitives */
class Pix {
  d: Uint8ClampedArray;
  constructor(public w: number, public h: number) { this.d = new Uint8ClampedArray(w * h * 4); }
  px(x: number, y: number, c: RGB, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.d;
    if (a >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; return; }
    d[i] = d[i] + (c[0] - d[i]) * a; d[i + 1] = d[i + 1] + (c[1] - d[i + 1]) * a; d[i + 2] = d[i + 2] + (c[2] - d[i + 2]) * a; d[i + 3] = Math.max(d[i + 3], 255 * a);
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); }
  /** scanline polygon fill (pixel centres) */
  poly(pts: P[], c: RGB, a = 1) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const A = pts[i], B = pts[j];
        if ((A.y > yc) !== (B.y > yc)) xs.push(A.x + ((yc - A.y) * (B.x - A.x)) / (B.y - A.y));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.px(x, y, c, a);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 4000; n++) {
      this.px(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** pixel map sprite: one char per pixel, '.' transparent */
  map(rows: string[], pal: Record<string, RGB>, ox = 0, oy = 0) {
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c) this.px(ox + x, oy + y, c); } });
  }
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.d);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

// iso helpers in canvas px
const cx = (a: number, b: number) => ISO.ox + a + b - OX;
const cy = (a: number, b: number, h = 0) => ISO.oy + (a - b) / 2 - h - OY;
const Q = (a: number, b: number, h = 0): P => ({ x: cx(a, b), y: cy(a, b, h) });

interface Bldg { a0: number; a1: number; b0: number; b1: number; h: number; col: RGB; roof?: 'flat' | 'genteng'; win?: boolean; winA?: boolean; seed: number; hero?: 'ruko' | 'kopi' | 'side' }

export interface BackdropOpts { stage: number; A?: number; Bm?: number; floor?: 1 | 2; key?: string }

function ground(px: Pix, stage: number) {
  const d = px.d;
  const asphalt: RGB = [74, 70, 68], paveA: RGB = [150, 132, 110], paveB: RGB = [140, 124, 104], grout: RGB = [112, 98, 82];
  const yard: RGB = [146, 138, 124], dirt: RGB = [104, 98, 70], curbTop: RGB = [182, 174, 158], curbSide: RGB = [118, 110, 100];
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const lx = x + OX - ISO.ox, ly = (y + OY - ISO.oy) * 2;
      const a = (lx + ly) / 2, b = (lx - ly) / 2;
      const n = hash(x, y);
      let c: RGB;
      if (b < -62 && b >= -150) {
        // street: asphalt with speckle, dashed centre line, darker tyre tracks
        c = asphalt;
        const tr = Math.abs(b + 84) < 5 || Math.abs(b + 128) < 5;
        let k = 0.94 + n * 0.12 - (tr ? 0.06 : 0);
        if (n > 0.985) k += 0.18;
        c = shade(c, k);
        if (Math.abs(b + 106) < 1.1 && ((a % 36) + 36) % 36 < 19) c = [196, 186, 156];
        if (b > -66) c = shade(asphalt, 0.72); // gutter in the curb's shadow
      } else if (b >= -62 && b < -56) {
        c = b < -59.5 ? curbSide : shade(curbTop, 0.95 + n * 0.08);
      } else if (b < -150 && b >= -156) {
        c = b > -152.5 ? curbSide : shade(curbTop, 0.95 + n * 0.08);
      } else if (b < -156) {
        // far side: a strip of paving then a weedy lot
        if (b > -190) { const tile = ((Math.floor(a / 10) + Math.floor(b / 10)) & 1) ? paveA : paveB; c = (((a % 10) + 10) % 10 < 1 || ((b % 10) + 10) % 10 < 1) ? grout : shade(tile, 0.94 + n * 0.1); }
        else c = shade(n > 0.6 ? [96, 112, 62] : dirt, 0.85 + hash(x >> 1, y >> 1) * 0.25);
      } else if (a > RA && b >= -56 && a < YARD && b >= 0) {
        if (stage >= 5) {
          // v1.4 parkiran: asphalt with white bay lines
          c = shade([92, 90, 90], 0.93 + n * 0.1);
          const bb = ((b % 34) + 34) % 34;
          if (bb < 1.2 && a > RA + 18 && a < YARD - 10) c = [214, 210, 196];
          if (Math.abs(a - (RA + 14)) < 1 && b > 4) c = [214, 196, 90];
        } else {
          // side yard: rough concrete slabs with joints and oil stains
          c = shade(yard, 0.93 + n * 0.1);
          if (((a % 40) + 40) % 40 < 1 || ((b % 40) + 40) % 40 < 1) c = shade(yard, 0.78);
          const st = hash(Math.floor(a / 14), Math.floor(b / 14));
          if (st > 0.9 && hash(x >> 2, y >> 2) > 0.35) c = shade(c, 0.82);
        }
      } else if (a >= YARD && b >= 0) {
        c = shade(n > 0.55 ? [96, 112, 62] : dirt, 0.85 + hash(x >> 1, y >> 1) * 0.25);
      } else {
        // sidewalk / paved ground: 10x10 iso tiles, two tones, grout, the odd cracked tile
        const ti = Math.floor(a / 10), tj = Math.floor(b / 10);
        const th = hash(ti, tj);
        let tile = ((ti + tj) & 1) ? paveA : paveB;
        tile = shade(tile, 0.94 + th * 0.1);
        c = (((a % 10) + 10) % 10 < 1 || ((b % 10) + 10) % 10 < 1) ? grout : shade(tile, 0.97 + n * 0.06);
        if (th > 0.93 && Math.abs(((a % 10) + 10) % 10 - ((b % 10) + 10) % 10) < 0.8) c = grout;
      }
      // contact shadows: the warung floor slab along its open front edges, and the base of the buildings
      if (stage > 1) {
        if (a >= RA && a < RA + 7 && b > -4 && b < RB + 3) c = shade(c, 0.7 + (a - RA) * 0.035);
        if (b < 0 && b > -7 && a > -2 && a < RA + 3) c = shade(c, 0.7 + -b * 0.035);
      }
      const i = (y * px.w + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
}

/** iso box: draws the two camera-facing walls (a = a1 face looks down-right, b = b0 face looks down-left) and the roof */
function box(px: Pix, B: Bldg) {
  const { a0, a1, b0, b1, h, col } = B;
  const fa = shade(col, 1.0), fb = shade(col, 0.8), top = shade(col, 1.12), ln = shade(col, 0.55);
  px.poly([Q(a1, b0), Q(a1, b1), Q(a1, b1, h), Q(a1, b0, h)], fa);
  px.poly([Q(a0, b0), Q(a1, b0), Q(a1, b0, h), Q(a0, b0, h)], fb);
  // windows on both faces
  if (B.win || B.winA) {
    const rows = Math.floor((h - 18) / 26);
    for (let r = 0; r < rows; r++) {
      const hz = 20 + r * 26;
      for (let bb = b0 + 10; bb + 10 < b1 - 4; bb += 22) winA(px, a1, bb, hz, B.seed + r * 31 + bb);
      if (B.win) for (let aa = a0 + 10; aa + 10 < a1 - 4; aa += 22) winB(px, b0, aa, hz, B.seed + r * 17 + aa);
    }
  }
  // roof
  if (B.roof === 'genteng') {
    const rh = Math.min(34, (a1 - a0) * 0.35), am = (a0 + a1) / 2;
    const tile: RGB = [150, 74, 50], tileD: RGB = [118, 56, 38];
    px.poly([Q(a1, b0, h), Q(a1, b1, h), Q(am, b1, h + rh), Q(am, b0, h + rh)], tile);
    for (let k = 3; k < rh; k += 3) { const t = k / rh; px.line(cx(a1 + (am - a1) * t, b0), cy(a1 + (am - a1) * t, b0, h + rh * t), cx(a1 + (am - a1) * t, b1), cy(a1 + (am - a1) * t, b1, h + rh * t), tileD); }
    px.poly([Q(a0, b0, h), Q(a1, b0, h), Q(am, b0, h + rh)], shade(col, 0.72));
    px.line(cx(am, b0), cy(am, b0, h + rh), cx(am, b1), cy(am, b1, h + rh), [96, 44, 30]);
    px.line(cx(a1, b0), cy(a1, b0, h), cx(a1, b1), cy(a1, b1, h), [96, 44, 30]);
  } else {
    px.poly([Q(a0, b0, h), Q(a1, b0, h), Q(a1, b1, h), Q(a0, b1, h)], top);
    // parapet lip
    px.line(cx(a0, b0), cy(a0, b0, h), cx(a1, b0), cy(a1, b0, h), shade(col, 1.25));
    px.line(cx(a1, b0), cy(a1, b0, h), cx(a1, b1), cy(a1, b1, h), shade(col, 1.25));
    if (hash(B.seed, 3) > 0.45) tank(px, a0 + (a1 - a0) * 0.4, b0 + (b1 - b0) * 0.5, h, hash(B.seed, 4) > 0.5);
  }
  // crisp outlines on the vertical edges
  px.line(cx(a1, b0), cy(a1, b0), cx(a1, b0), cy(a1, b0, h), ln);
  px.line(cx(a0, b0), cy(a0, b0), cx(a0, b0), cy(a0, b0, h), ln);
  px.line(cx(a1, b1), cy(a1, b1), cx(a1, b1), cy(a1, b1, h), ln);
}
function winA(px: Pix, a: number, b: number, h: number, seed: number) {
  const lit = hash(seed, 9) > 0.7;
  px.poly([Q(a, b), Q(a, b + 10), Q(a, b + 10, 12), Q(a, b, 12)].map((p) => ({ x: p.x, y: p.y - h })), [70, 64, 60]);
  px.poly([Q(a, b + 1), Q(a, b + 9), Q(a, b + 9, 11), Q(a, b + 1, 11)].map((p) => ({ x: p.x, y: p.y - h })), lit ? [214, 186, 120] : [92, 112, 124]);
  px.line(cx(a, b + 1), cy(a, b + 1, h + 6), cx(a, b + 9), cy(a, b + 9, h + 6), [70, 64, 60]);
}
function winB(px: Pix, b: number, a: number, h: number, seed: number) {
  const lit = hash(seed, 7) > 0.72;
  px.poly([Q(a, b), Q(a + 10, b), Q(a + 10, b, 12), Q(a, b, 12)].map((p) => ({ x: p.x, y: p.y - h })), [62, 56, 52]);
  px.poly([Q(a + 1, b), Q(a + 9, b), Q(a + 9, b, 11), Q(a + 1, b, 11)].map((p) => ({ x: p.x, y: p.y - h })), lit ? [200, 172, 112] : [80, 98, 110]);
  px.line(cx(a + 1, b), cy(a + 1, b, h + 6), cx(a + 9, b), cy(a + 9, b, h + 6), [62, 56, 52]);
}
/** rooftop water tank ("toren"), orange or blue */
function tank(px: Pix, a: number, b: number, h: number, blue: boolean) {
  const x = Math.round(cx(a, b)), y = Math.round(cy(a, b, h));
  const c: RGB = blue ? [70, 120, 170] : [214, 120, 46], c2 = shade(c, 0.75), c3 = shade(c, 1.2);
  px.rect(x - 4, y - 4, 2, 4, [80, 80, 86]); px.rect(x + 3, y - 4, 2, 4, [80, 80, 86]); // stand
  px.rect(x - 5, y - 14, 11, 10, c); px.rect(x + 2, y - 14, 4, 10, c2); px.rect(x - 4, y - 14, 2, 10, c3);
  px.rect(x - 4, y - 16, 9, 2, c3); px.rect(x - 1, y - 17, 3, 1, c2);
}
/** awning across a b-facing shopfront */
function awningB(px: Pix, b: number, a0: number, a1: number, h: number, c1: RGB, c2: RGB) {
  for (let a = a0, i = 0; a < a1; a += 6, i++) {
    const aa = Math.min(a1, a + 6);
    px.poly([Q(a, b, h), Q(aa, b, h), Q(aa, b - 7, h - 6), Q(a, b - 7, h - 6)], i & 1 ? c1 : c2);
  }
  px.line(cx(a0, b - 7), cy(a0, b - 7, h - 6), cx(a1, b - 7), cy(a1, b - 7, h - 6), shade(c1, 0.6));
}
/** b-facing rectangle on a facade (a0..a1 along it, h0..h1 up) */
const rectB = (px: Pix, b: number, a0: number, a1: number, h0: number, h1: number, c: RGB) => px.poly([Q(a0, b, h0), Q(a1, b, h0), Q(a1, b, h1), Q(a0, b, h1)], c);
const rectA = (px: Pix, a: number, b0: number, b1: number, h0: number, h1: number, c: RGB) => px.poly([Q(a, b0, h0), Q(a, b1, h0), Q(a, b1, h1), Q(a, b0, h1)], c);

/** the ruko right next to the warung on the street: rolling shutter, shop sign, upstairs windows */
function heroRuko(px: Pix, B: Bldg) {
  const b = B.b0;
  // ground floor: half-open rolling shutter with a dark interior + glass door
  rectB(px, b, B.a0 + 8, B.a0 + 82, 0, 50, [44, 40, 40]);
  rectB(px, b, B.a0 + 8, B.a0 + 82, 22, 50, [150, 154, 158]);
  for (let h = 24; h < 50; h += 3) px.line(cx(B.a0 + 8, b), cy(B.a0 + 8, b, h), cx(B.a0 + 82, b), cy(B.a0 + 82, b, h), [118, 122, 128]);
  rectB(px, b, B.a0 + 92, B.a1 - 12, 0, 46, [70, 80, 86]);
  rectB(px, b, B.a0 + 95, B.a1 - 15, 3, 44, [104, 128, 138]);
  px.line(cx(B.a0 + 95, b), cy(B.a0 + 95, b, 40), cx(B.a1 - 15, b), cy(B.a1 - 15, b, 40), [150, 176, 182]);
  // shop sign band
  rectB(px, b, B.a0 + 4, B.a1 - 4, 54, 68, [52, 92, 150]);
  for (let a = B.a0 + 14; a < B.a1 - 18; a += 9) rectB(px, b, a, a + 5, 58, 64, [226, 222, 200]);
  // upstairs
  for (let a = B.a0 + 14; a + 26 < B.a1; a += 44) { rectB(px, b, a, a + 26, 82, 116, [72, 64, 58]); rectB(px, b, a + 2, a + 24, 84, 114, [96, 116, 126]); px.line(cx(a + 13, b), cy(a + 13, b, 84), cx(a + 13, b), cy(a + 13, b, 114), [72, 64, 58]); }
  // AC unit + drain pipe
  rectB(px, b, B.a1 - 30, B.a1 - 16, 72, 80, [196, 196, 190]);
  px.line(cx(B.a1 - 5, b), cy(B.a1 - 5, b, 0), cx(B.a1 - 5, b), cy(B.a1 - 5, b, B.h), [92, 96, 100]);
}
/** smaller warung kopi with a striped awning */
function heroKopi(px: Pix, B: Bldg) {
  const b = B.b0;
  rectB(px, b, B.a0 + 10, B.a1 - 10, 0, 44, [56, 40, 30]);
  rectB(px, b, B.a0 + 14, B.a1 - 14, 14, 18, [150, 104, 60]); // counter
  awningB(px, b, B.a0 + 6, B.a1 - 6, 52, [200, 70, 52], [232, 222, 196]);
  rectB(px, b, B.a0 + 20, B.a1 - 20, 60, 72, [214, 170, 60]);
  for (let a = B.a0 + 28; a < B.a1 - 28; a += 8) rectB(px, b, a, a + 4, 63, 69, [90, 50, 30]);
  for (let a = B.a0 + 20; a + 22 < B.a1; a += 40) { rectB(px, b, a, a + 22, 80, 104, [70, 60, 52]); rectB(px, b, a + 2, a + 20, 82, 102, [100, 118, 126]); }
}
/** the neighbour's side wall facing the yard: drain pipe, small windows, AC units, an old painted ad */
function heroSide(px: Pix, B: Bldg) {
  const a = B.a1;
  rectA(px, a, B.b0 + 30, B.b0 + 100, 70, 118, [196, 70, 52]);
  rectA(px, a, B.b0 + 34, B.b0 + 96, 74, 114, [226, 212, 186]);
  for (let bb = B.b0 + 42; bb < B.b0 + 88; bb += 7) rectA(px, a, bb, bb + 4, 98, 106, [176, 52, 40]);
  for (let bb = B.b0 + 40; bb < B.b0 + 92; bb += 10) rectA(px, a, bb, bb + 6, 80, 86, [70, 70, 80]);
  winA(px, a, B.b0 + 120, 28, B.seed + 1); winA(px, a, B.b0 + 120, 92, B.seed + 2); winA(px, a, B.b0 + 12, 24, B.seed + 3);
  rectA(px, a, B.b0 + 140, B.b0 + 154, 60, 68, [190, 190, 184]);
  rectA(px, a, B.b0 + 18, B.b0 + 32, 46, 54, [190, 190, 184]);
  px.line(cx(a, B.b0 + 112), cy(a, B.b0 + 112, 0), cx(a, B.b0 + 112), cy(a, B.b0 + 112, B.h), [96, 100, 104]);
  // stains at the foot of the wall
  for (let bb = B.b0; bb < B.b1; bb += 2) if (hash(bb, B.seed) > 0.5) px.line(cx(a, bb), cy(a, bb, 0), cx(a, bb), cy(a, bb, 4 + hash(bb, 7) * 6), shade(B.col, 0.82));
}

function buildings(px: Pix, stage: number) {
  const back = stage === 1 ? -70 : -8; // the gerobak's brick wall sits further back than the warung walls
  const right = stage === 1 ? 262 : RB + 8;
  const L: Bldg[] = [];
  const pal: RGB[] = [[168, 150, 128], [150, 160, 150], [176, 140, 112], [140, 140, 150], [160, 148, 132], [146, 156, 160]];
  // region behind the left wall (a < back): bands along the street; the first band is the street row of shops
  const aBands: [number, number][] = [[back - 144, back], [back - 316, back - 154], [back - 490, back - 326]];
  const bBands: [number, number][] = [[-4, 130], [140, 270], [280, 410], [420, 550], [560, 690]];
  aBands.forEach(([a0, a1], ai) => bBands.forEach(([b0, b1], bi) => {
    const s = 11 + ai * 7 + bi * 13;
    const B: Bldg = { a0, a1, b0, b1, h: 140 + hash(s, 1) * 100 + bi * 10, col: pal[s % pal.length], roof: hash(s, 2) > 0.6 ? 'genteng' : 'flat', win: true, seed: s };
    if (bi === 0) {
      B.win = false; B.winA = true; // shopfront details on the street face, plain windows on the side
      if (ai === 0) Object.assign(B, { h: 150, col: [118, 156, 146], roof: 'flat', hero: 'ruko' });
      else if (ai === 1) Object.assign(B, { h: 124, col: [200, 156, 116], roof: 'genteng', hero: 'kopi' });
      else Object.assign(B, { h: 140, win: true });
    }
    L.push(B);
  }));
  // region behind the right wall (b > right): the neighbour whose side wall faces the side yard, more blocks behind
  const rBands: [number, number][] = [[right, right + 150], [right + 160, right + 300], [right + 310, right + 450], [right + 460, right + 600]];
  rBands.forEach(([b0, b1], bi) => {
    if (bi === 0) { L.push({ a0: back, a1: RA + 6, b0, b1, h: 165, col: [184, 176, 160], roof: 'genteng', seed: 202, hero: 'side' }); return; }
    for (const [a0, a1] of [[back, Math.round(RA * 0.46)], [Math.round(RA * 0.52), RA + 6]] as [number, number][]) {
      const s = 140 + bi * 9 + a0;
      L.push({ a0, a1, b0, b1, h: 150 + hash(s, 1) * 90 + bi * 8, col: pal[(s >>> 0) % pal.length], roof: hash(s, 2) > 0.5 ? 'genteng' : 'flat', win: true, seed: s });
    }
  });
  // painter's order: farther first (screen y of the front-bottom corner)
  L.sort((p, q) => (p.a1 - p.b0) - (q.a1 - q.b0));
  // drop overlapping duplicates: a later (nearer) building wins anyway
  for (const B of L) {
    // base shadow on the ground in front of both visible faces
    px.poly([Q(B.a1, B.b0 - 6), Q(B.a1 + 6, B.b0 - 6), Q(B.a1 + 6, B.b1), Q(B.a1, B.b1)], [0, 0, 0], 0.22);
    px.poly([Q(B.a0, B.b0 - 6), Q(B.a1 + 6, B.b0 - 6), Q(B.a1, B.b0), Q(B.a0, B.b0)], [0, 0, 0], 0.22);
    box(px, B);
    if (B.hero === 'ruko') heroRuko(px, B);
    else if (B.hero === 'kopi') heroKopi(px, B);
    else if (B.hero === 'side') heroSide(px, B);
  }
  // low brick fence closing the yard, with a gap for the motorbikes
  const fence: RGB = [150, 80, 56];
  const g0 = Math.round(RB * 0.78), g1 = Math.round(RB * 1.04);
  for (const [b0, b1] of [[0, g0], [g1, right - 2]] as [number, number][]) {
    px.poly([Q(YARD, b0), Q(YARD, b1), Q(YARD, b1, 14), Q(YARD, b0, 14)], fence);
    px.poly([Q(YARD, b0, 14), Q(YARD, b1, 14), Q(YARD - 6, b1, 14), Q(YARD - 6, b0, 14)], shade(fence, 1.2));
    for (let h = 4; h < 14; h += 4) px.line(cx(YARD, b0), cy(YARD, b0, h), cx(YARD, b1), cy(YARD, b1, h), shade(fence, 0.75));
  }
  // electricity wires sagging across the street (behind the room)
  const w1 = Q(60, -170, 150), w2 = Q(-200, -4, 170);
  for (let k = 0; k < 2; k++) {
    let last = { x: w1.x, y: w1.y + k * 4 };
    for (let i = 1; i <= 24; i++) {
      const t = i / 24, x = w1.x + (w2.x - w1.x) * t, y = w1.y + (w2.y - w1.y) * t + k * 4 + Math.sin(t * Math.PI) * 14;
      px.line(last.x, last.y, x, y, [40, 36, 36]); last = { x, y };
    }
  }
}

/** mute (slightly desaturate / darken) everything, dithered vignette around the room, fade into the camera colour */
function grade(px: Pix) {
  const d = px.d, ccx = VC.x - OX, ccy = VC.y - OY;
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const i = (y * px.w + x) * 4;
      let r = d[i], g = d[i + 1], b = d[i + 2];
      const l = r * 0.3 + g * 0.59 + b * 0.11;
      r = r + (l - r) * 0.25; g = g + (l - g) * 0.25; b = b + (l - b) * 0.25;
      const dd = Math.hypot((x - ccx) / (300 * VC.k), (y - ccy) / (225 * VC.k));
      let v = 0.84 - 0.5 * smooth(0.62, 1.45, dd);
      v = Math.floor(v * 14 + BAYER[(y & 3) * 4 + (x & 3)]) / 14;
      r *= v; g *= v; b *= v;
      // a touch of warm haze so the street reads as the same afternoon as the room
      r += 6; g += 3;
      const edge = Math.min(x, y, px.w - 1 - x, px.h - 1 - y);
      const t = 1 - smooth(0, 70, edge);
      d[i] = clamp8(r + (EDGE[0] - r) * t); d[i + 1] = clamp8(g + (EDGE[1] - g) * t); d[i + 2] = clamp8(b + (EDGE[2] - b) * t);
    }
  }
}
/** brightness the vignette gives a point (for tinting the separate props the same way) */
/** vignette centre + scale for the current room */
let VC = { x: 200, y: 165, k: 1 };
function vigAt(lx: number, ly: number) {
  const dd = Math.hypot((lx - VC.x) / (300 * VC.k), (ly - VC.y) / (225 * VC.k));
  return 0.84 - 0.5 * smooth(0.62, 1.45, dd);
}

// ---------------------------------------------------------------- props (separate images, depth sorted with people)
const MOTOR = [
  '...kk.....................',
  '..kmmk....................',
  '...kk.k...................',
  '......km..................',
  '....kBBk..................',
  '...kBhBBk.................',
  '..klBBBBk........ssssss...',
  '..kBBBBbk.......ssssssssk.',
  '...kBBBbk.....kkBBBBBBBBk.',
  '...kBBbbkkkkkkBBBBhhBBBBk.',
  '...kBBbbbbbbbbBBBBBBBBbrk.',
  '..kkkbbbbbbbbbbbbbbbbbbkk.',
  '.kgggk.kkkkkkkkkkk.kgggk..',
  'kgkkkgk...........kgkkkgk.',
  'kgkmkgk...........kgkmkgk.',
  'kgkkkgk...........kgkkkgk.',
  '.kgggk.............kgggk..',
  '..kkk...............kkk...',
];
const DRUM = ['.kkkkkkk.', 'kBhBBBBbk', 'kBhBBBBbk', 'kkkkkkkkk', 'kBhBBBBbk', 'kBhBBBBbk', 'kBhBBBBbk', 'kkkkkkkkk', 'kBhBBBBbk', 'kBhBBBBbk', '.kkkkkkk.'];
const BIN = ['.kkkkkkk.', 'kGGGGGGGk', '.kkkkkkk.', '.kGhGGgk.', '.kGhGGgk.', '.kGhGGgk.', '.kGhGGgk.', '.kGhGGgk.', '.kGhGGgk.', '..kkkkk..'];

function propTextures(sc: Phaser.Scene) {
  const add = (key: string, px: Pix) => { if (!sc.textures.exists(key)) sc.textures.addCanvas(key, px.toCanvas()); };
  const motor = (key: string, body: RGB) => {
    const p = new Pix(26, 18);
    p.map(MOTOR, { k: [28, 24, 24], m: [160, 160, 168], g: [86, 86, 92], B: body, b: shade(body, 0.72), h: shade(body, 1.35), s: [38, 32, 30], l: [250, 232, 150], r: [210, 50, 36] });
    add(key, p);
  };
  motor('bdp_motor_r', [196, 52, 44]); motor('bdp_motor_b', [52, 96, 170]); motor('bdp_motor_k', [70, 70, 76]); motor('bdp_motor_w', [210, 206, 196]);
  const drum = new Pix(9, 11); drum.map(DRUM, { k: [24, 40, 70], B: [52, 100, 170], b: [36, 70, 120], h: [110, 160, 210] }); add('bdp_drum', drum);
  const bin = new Pix(9, 10); bin.map(BIN, { k: [24, 50, 30], G: [60, 130, 70], g: [40, 96, 50], h: [110, 180, 110] }); add('bdp_bin', bin);
  // electricity pole with a street lamp arm (art px, drawn at the character pixel scale)
  const pole = new Pix(22, 92);
  pole.rect(10, 4, 2, 88, [96, 96, 102]); pole.rect(10, 4, 1, 88, [136, 136, 144]);
  pole.rect(3, 8, 16, 1, [70, 70, 76]);
  for (const x of [4, 8, 14, 18]) pole.rect(x, 6, 1, 2, [220, 220, 210]);
  pole.rect(12, 24, 8, 1, [80, 80, 86]); pole.rect(18, 25, 4, 2, [60, 60, 66]); pole.rect(19, 27, 2, 1, [255, 236, 170]);
  pole.rect(9, 70, 4, 1, [70, 70, 76]); pole.rect(9, 88, 4, 4, [80, 80, 86]);
  add('bdp_pole', pole);
  // v1.4: cars (iso boxes along the street) and a tour bus, a PARKIR sign
  const carCols: RGB[] = [[196, 60, 50], [220, 220, 214], [60, 90, 150], [40, 40, 46]];
  carCols.forEach((col, i) => add('bdp_car_' + i, isoVehicle(34, 15, 13, col, false)));
  add('bdp_bus', isoVehicle(70, 18, 24, [228, 176, 52], true));
  const sign = new Pix(14, 24); sign.rect(6, 8, 2, 16, [90, 90, 96]); sign.rect(1, 0, 12, 10, [40, 90, 170]); sign.rect(2, 1, 10, 8, [56, 112, 196]);
  sign.map(['.kkk.', '.k..k', '.kkk.', '.k...', '.k...'].map((r) => r.replace(/k/g, 'w')), { w: [240, 240, 240] }, 4, 2);
  add('bdp_parkir', sign);
}
/** small iso vehicle (length along the street axis a, width along b, height) as art px, side window band */
function isoVehicle(len: number, wid: number, hgt: number, col: RGB, bus: boolean): Pix {
  const Wd = len + wid + 4, Ht = Math.ceil((len + wid) / 2 + hgt + 6);
  const p = new Pix(Wd, Ht);
  const ox = 2, oy = wid / 2 + hgt + 2;
  const P2 = (a: number, b: number, h = 0): P => ({ x: ox + a + b, y: oy + (a - b) / 2 - h });
  const dark = shade(col, 0.7), lite = shade(col, 1.15), glass: RGB = [120, 160, 190];
  // wheels
  for (const a of bus ? [8, len - 10] : [6, len - 8]) { const w = P2(a, 0); p.rect(Math.round(w.x) - 3, Math.round(w.y) - 3, 6, 4, [24, 22, 22]); }
  const cab = bus ? hgt : hgt * 0.55;
  // body: side (b = 0 face), end (a = len face), roof
  p.poly([P2(0, 0, 2), P2(len, 0, 2), P2(len, 0, cab), P2(0, 0, cab)], col);
  p.poly([P2(len, 0, 2), P2(len, wid, 2), P2(len, wid, cab), P2(len, 0, cab)], dark);
  if (!bus) {
    // cabin on top, set back
    p.poly([P2(len * 0.25, 0, cab), P2(len * 0.8, 0, cab), P2(len * 0.72, 0, hgt), P2(len * 0.32, 0, hgt)], glass);
    p.poly([P2(len * 0.8, 0, cab), P2(len * 0.8, wid, cab), P2(len * 0.72, wid, hgt), P2(len * 0.72, 0, hgt)], shade(glass, 0.8));
    p.poly([P2(len * 0.32, 0, hgt), P2(len * 0.72, 0, hgt), P2(len * 0.72, wid, hgt), P2(len * 0.32, wid, hgt)], lite);
    p.poly([P2(0, 0, cab), P2(len * 0.25, 0, cab), P2(len * 0.25, wid, cab), P2(0, wid, cab)], lite);
    p.poly([P2(len * 0.8, 0, cab), P2(len, 0, cab), P2(len, wid, cab), P2(len * 0.8, wid, cab)], lite);
  } else {
    p.poly([P2(0, 0, hgt), P2(len, 0, hgt), P2(len, wid, hgt), P2(0, wid, hgt)], lite);
    for (let a = 4; a < len - 6; a += 8) p.poly([P2(a, 0, hgt * 0.5), P2(a + 6, 0, hgt * 0.5), P2(a + 6, 0, hgt * 0.85), P2(a, 0, hgt * 0.85)], glass);
    p.poly([P2(len, 2, hgt * 0.45), P2(len, wid - 2, hgt * 0.45), P2(len, wid - 2, hgt * 0.85), P2(len, 2, hgt * 0.85)], glass);
    p.poly([P2(0, 0, 4), P2(len, 0, 4), P2(len, 0, 7), P2(0, 0, 7)], [200, 60, 40]);
  }
  // headlight
  const hl = P2(len, 3, 5); p.rect(Math.round(hl.x), Math.round(hl.y), 2, 2, [255, 236, 170]);
  return p;
}
/** v1.4 upstairs (Lantai 2): looking out over the neighbours' roofs, sky at the top */
function upstairs(px: Pix) {
  const d = px.d;
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    const lx = x + OX - ISO.ox, ly = (y + OY - ISO.oy) * 2;
    const a = (lx + ly) / 2, b = (lx - ly) / 2;
    const n = hash(x, y);
    let c: RGB;
    // roofs in blocks: genteng rows, a few flat concrete roofs
    const bi = Math.floor(a / 70), bj = Math.floor(b / 70), flat = hash(bi + 50, bj + 9) > 0.7;
    if (flat) c = shade([150, 146, 136], 0.9 + n * 0.1);
    else { const row = ((a % 6) + 6) % 6; c = shade(row < 1 ? [118, 56, 38] : [156, 78, 52], 0.9 + hash(Math.floor(a / 6), Math.floor(b / 14)) * 0.16); }
    if (((a % 70) + 70) % 70 < 2 || ((b % 70) + 70) % 70 < 2) c = [70, 60, 56];
    // sky towards the top of the canvas
    const sky = 1 - smooth(0, 160, y);
    if (sky > 0) c = [Math.round(c[0] + (150 - c[0]) * sky), Math.round(c[1] + (186 - c[1]) * sky), Math.round(c[2] + (214 - c[2]) * sky)];
    // the building's own facade drops below the room's front edges
    if (a > -4 && b < 0 && b > -40 && a < RA + 4) c = shade([206, 192, 166], 0.85 + (b + 40) / 200);
    if (a > RA && a < RA + 40 && b > -4 && b < RB + 4) c = shade([188, 176, 152], 0.85 + (RA + 40 - a) / 220);
    const i = (y * px.w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
}

/** build (or reuse) the backdrop texture and return the world objects for it */
export function buildBackdrop(sc: Phaser.Scene, opts: BackdropOpts): Phaser.GameObjects.GameObject[] {
  const up = opts.floor === 2;
  // v1.4: sized to the room of this stage (the canvas grows with the room, the yard becomes a parkiran at stage 5+)
  RA = opts.stage === 1 ? 194 : opts.A ?? 194; RB = opts.stage === 1 ? 191 : opts.Bm ?? 191;
  YARD = RA + (opts.stage >= 6 ? 200 : opts.stage >= 5 ? 150 : 136);
  const dA = Math.max(0, RA - 194), dB = Math.max(0, RB - 191);
  OX = -344; OY = Math.round(-256 - dB / 2); W = Math.round(1088 + dA + dB + (opts.stage >= 5 ? 60 : 0)); H = Math.round(832 + dA / 2 + dB / 2 + 30);
  VC = { x: 7.5 + (RA + RB) / 2, y: 220 + (RA - RB) / 4 - 32, k: Math.max(1, (RA + RB) / 385) };
  const key = opts.stage === 1 ? 'backdrop_gerobak' : 'backdrop_' + (opts.key ?? 'room') + (up ? '_up' : '');
  if (!sc.textures.exists(key)) {
    const px = new Pix(W, H);
    if (up) upstairs(px);
    else { ground(px, opts.stage); buildings(px, opts.stage); }
    grade(px);
    sc.textures.addCanvas(key, px.toCanvas());
  }
  propTextures(sc);
  const objs: Phaser.GameObjects.GameObject[] = [];
  objs.push(sc.add.image(WX + OX, WY + OY, key).setOrigin(0, 0).setDepth(-9));
  const S2 = (a: number, b: number) => ({ x: WX + ISO.ox + a + b, y: WY + ISO.oy + (a - b) / 2 });
  const put = (tex: string, a: number, b: number, opt: { frame?: string; flip?: boolean; scale?: number; oy?: number } = {}) => {
    const p = S2(a, b);
    const im = sc.add.image(Math.round(p.x), Math.round(p.y), tex, opt.frame).setOrigin(0.5, opt.oy ?? 1).setScale(opt.scale ?? CH * 2).setFlipX(!!opt.flip).setDepth(p.y);
    const v = Math.max(0.3, vigAt(p.x - WX, p.y - WY)) * 0.96;
    const c = Math.round(v * 255);
    im.setTint((c << 16) | (c << 8) | c);
    objs.push(im);
    return im;
  };
  if (up) return objs;
  // side yard: customers' motorbikes parked along the warung and the neighbour's wall
  const dA2 = RA - 194, dB2 = RB - 191;
  put('bdp_motor_r', 236 + dA2, 112, { flip: true }); put('bdp_motor_k', 240 + dA2, 140, { flip: true }); put('bdp_motor_b', 244 + dA2, 170, { flip: true });
  if (opts.stage >= 5) {
    // parkiran: a few cars parked in the bays + a sign
    put('bdp_car_0', RA + 70, 40); put('bdp_car_2', RA + 70, 108); if (opts.stage >= 6) { put('bdp_car_1', RA + 130, 74); put('bdp_car_3', RA + 130, 142); }
    put('bdp_parkir', RA + 16, -8);
  } else { put('bdp_motor_w', 214 + dA2, 242 + dB2); put('bdp_motor_b', 216 + dA2, 272 + dB2); }
  put('bdp_drum', YARD - 18, 206 + dB2); put('bdp_bin', YARD - 12, 222 + dB2);
  put('props', 206 + dA2, 318 + dB2, { frame: 'plant', scale: HI * 0.8 }); put('props', YARD - 30, 136 + dB2 * 0.5, { frame: 'plant', scale: HI * 0.7 });
  put('bdp_pole', YARD - 30, 232 + dB2);
  // street side
  put('bdp_pole', 60, -170); if (RA > 300) put('bdp_pole', RA - 40, -170);
  put('props', -24, -12, { frame: 'plant', scale: HI * 0.75 });
  put('bdp_motor_k', -40, -48); put('bdp_motor_r', 190, -48, { flip: true });
  if (opts.stage > 1) put('props', -96, -36, { frame: 'gerobak', scale: HI * 0.62, oy: 0.82 });
  return objs;
}
