// v1.4 room layouts: every warung stage (and both floors of the Restoran Besar) is composed procedurally, so the room
// really grows with each renovation: a wider frontage (more table columns), a deeper room (a longer counter + etalase,
// more kitchen), more tables / benches, more staff spots, a longer queue. Pure geometry (no Phaser): the Game scene,
// the room renderer (room.ts) and the tests all read the same Layout.
//
// Coordinates: logical iso ground coords as in world.ts (S(a, b): a runs along the street / frontage, b runs from the
// street to the back wall; the counter + kitchen stand along the left wall a = 0, the entrance is in the front-left
// edge b = 0). The original v1.0 room bitmap is the S2 layout (n = 0, 1 table column).
import { S, WX, WY, type P, type Seat } from './world';
export type { Seat };
/** one table set (table_a from room.png) placed with an iso offset from the original front table */
export interface TablePl { da: number; db: number; depth: number; kind: 'kayu' | 'gelap' | 'vip' }
export type KMod = 'KA' | 'KB' | 'KC';
export interface RoomSpec {
  stage: number; floor: 1 | 2; cols: number; rows: number;
  /** extra counter strips vs the original etalase (-1 .. 4) */
  n: number;
  kitchen: KMod[];
  /** extra depth (b) beyond what the counter needs */
  extraB?: number;
  /** extra frontage (a) beyond the table columns */
  extraA?: number;
  /** which grid cells hold tables (default: all) */
  cells?: [number, number][];
  tableKind?: 'kayu' | 'gelap';
  prasmanan?: boolean; stairs?: boolean; vip?: boolean; bigKitchen?: boolean;
}
export interface Layout {
  key: string; spec: RoomSpec; stage: number; floor: 1 | 2;
  /** iso extents (logical) */
  A: number; Bm: number;
  /** world bounds of the room incl. walls (logical, absolute) */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  /** counter front at a = 85.25; counter runs b = -1 .. cEnd */
  cEnd: number;
  queue: P[]; overflow: P[]; ojolWait: P[]; seats: Seat[]; staff: Record<string, P[]>;
  obst: P[][]; nav: P[]; entIn: P; entOut: P; spawns: P[]; belanjaOut: P[]; visit: P;
  tables: TablePl[]; counterDepth: number; steam: P;
  /** the self-service buffet line (Rumah Makan+): where customers pick their lauk, and its standing spots */
  buffet: { da: number; db: number; spots: P[] } | null;
  /** Restoran Besar: the staircase (foot on L1 / head on L2) */
  stairs: { a: number; b: number; foot: P; head: P } | null;
  /** L2: the VIP room area (iso rect) */
  vip: { a0: number; a1: number; b0: number; b1: number } | null;
  /** wall anchors for props: right wall (b = Bm) at a with height h, left wall (a = 0) at b with height h */
  wallR: (a: number, h: number) => P; wallL: (b: number, h: number) => P;
  /** the waiters stand in the dining hall (not behind the counter) */
  hallPelayan: boolean;
}

/** strip of etalase added per counter step: 104 art px = 52 logical (iso b) */
export const STRIP = 52;
const BASE_A = 194, BASE_B = 191, COL = 85, ROW = 112;
/** original table (t2) seats + obstacle in iso coords (a, b) */
const SEAT_B = [25.75, 44.75, 63.75, 82.75];
const BACK_A = 131.75, FRONT_A = 172.5;
const TOB = { a0: 123, a1: 185, b0: 8, b1: 105 };
const OV_T2 = 274; // OV_DEPTH.t2 (world y of the original front table's front edge)
const COUNTER_A = 85.25;
const CEND0 = 185.25;

export const SPECS: Record<string, RoomSpec> = {
  s2: { stage: 2, floor: 1, cols: 1, rows: 1, n: 0, kitchen: ['KA', 'KB', 'KC'] },
  s3: { stage: 3, floor: 1, cols: 1, rows: 2, n: 1, kitchen: ['KA', 'KB', 'KB', 'KC'] },
  s4: { stage: 4, floor: 1, cols: 2, rows: 2, n: 2, kitchen: ['KA', 'KB', 'KB', 'KC', 'KC'] },
  s5: { stage: 5, floor: 1, cols: 3, rows: 2, n: 3, kitchen: ['KA', 'KB', 'KB', 'KB', 'KC', 'KC'], extraB: 18, prasmanan: true },
  s6: { stage: 6, floor: 1, cols: 4, rows: 2, n: 4, kitchen: ['KA', 'KB', 'KB', 'KB', 'KB', 'KC', 'KC'], extraB: 30, tableKind: 'gelap', stairs: true, bigKitchen: true, prasmanan: true },
  s6b: { stage: 6, floor: 2, cols: 4, rows: 2, n: 4, kitchen: ['KA', 'KC'], extraB: 30, tableKind: 'gelap', stairs: true, vip: true },
};
export function specFor(stage: number, floor: 1 | 2 = 1): RoomSpec {
  if (stage >= 6) return floor === 2 ? SPECS.s6b : SPECS.s6;
  return SPECS['s' + Math.max(2, Math.min(5, stage))];
}

const cache = new Map<string, Layout>();
export function layoutFor(stage: number, floor: 1 | 2 = 1): Layout {
  const spec = specFor(stage, floor);
  const key = `s${spec.stage}f${spec.floor}`;
  let L = cache.get(key);
  if (!L) { L = build(spec, key); cache.set(key, L); }
  return L;
}

/** iso rectangle (a0..a1, b0..b1) as a world polygon */
const rect = (a0: number, a1: number, b0: number, b1: number): P[] => [S(a0, b0), S(a1, b0), S(a1, b1), S(a0, b1)];

function build(spec: RoomSpec, key: string): Layout {
  const { cols, rows, n } = spec;
  const A = BASE_A + COL * (cols - 1) + 10 + (spec.extraA ?? 0);
  const cEnd = CEND0 + STRIP * n;
  const Bm = BASE_B + STRIP * n + (spec.extraB ?? 0);
  const L2 = spec.floor === 2;
  // ---- tables (grid cells; nearest the entrance first)
  const cells: [number, number][] = spec.cells ?? (() => { const c: [number, number][] = []; for (let ci = 0; ci < cols; ci++) for (let r = 0; r < rows; r++) c.push([ci, r]); return c; })();
  cells.sort((p, q) => (p[0] + p[1] * 0.9) - (q[0] + q[1] * 0.9));
  const kind = spec.tableKind ?? 'kayu';
  const tables: TablePl[] = cells.map(([c, r]) => {
    const da = COL * c, db = ROW * r;
    // upstairs the two front-right columns are the VIP room (white cloth, red velvet benches)
    return { da, db, depth: OV_T2 + (da - db) / 2, kind: spec.vip && c >= 2 ? 'vip' : kind };
  });
  // ---- buffet line (prasmanan) behind the last row, VIP room on L2
  let buffet: Layout['buffet'] = null;
  if (spec.prasmanan && !L2) {
    const db = ROW * rows + 14, da = spec.stage >= 6 ? COL : 0;
    const spots: P[] = [];
    for (let i = 0; i < 4; i++) spots.push(S(BACK_A - 14 + da, db + 30 + i * 19));
    buffet = { da, db, spots };
  }
  let stairs: Layout['stairs'] = null;
  if (spec.stairs) {
    // the staircase stands in the back corner of the last column (L1) / arrives at the same spot on L2
    const a = A - 60, b = Bm - 70;
    stairs = { a, b, foot: S(a - 8, b + 22), head: S(a - 8, b + 22) };
  }
  let vip: Layout['vip'] = null;
  if (spec.vip) vip = { a0: 284, a1: A - 2, b0: 2, b1: TOB.b1 + ROW + 14 };
  // ---- seats: 3 + 3 per table first (in table order), then the 4th seat of every bench
  const seats: Seat[] = [];
  const mkSeat = (t: TablePl, ti: number, side: 'back' | 'front', i: number): Seat => {
    const a = (side === 'back' ? BACK_A : FRONT_A) + t.da, b = SEAT_B[i] + t.db;
    const p = S(a, b);
    // one approach point straight off the bench: behind a back bench, in front of a front bench
    const ap = S(side === 'back' ? a - 10.7 : a + 19.7, b);
    return { p, kind: side, table: ti, approach: [ap], depth: t.depth };
  };
  tables.forEach((t, ti) => { for (const i of [1, 2, 3]) { seats.push(mkSeat(t, ti, 'back', i)); seats.push(mkSeat(t, ti, 'front', i)); } });
  tables.forEach((t, ti) => { seats.push(mkSeat(t, ti, 'back', 0)); seats.push(mkSeat(t, ti, 'front', 0)); });
  // ---- obstacles: the kitchen / counter block, every table, the closed front edges (entrance gap a 95 .. 142)
  const obst: P[][] = [];
  if (!L2) obst.push([S(-40, -1), S(70, -2.25), S(COUNTER_A, 3.25), S(COUNTER_A, Bm + 40), S(-40, Bm + 40)]);
  else obst.push(rect(-40, 40, -1, 135)); // L2 serving station along the left wall
  for (const t of tables) obst.push(rect(TOB.a0 + t.da, TOB.a1 + t.da, TOB.b0 + t.db, TOB.b1 + t.db));
  if (buffet) obst.push(rect(TOB.a0 + buffet.da + 4, TOB.a1 + buffet.da - 30, buffet.db + 16, buffet.db + 98));
  if (stairs) obst.push(rect(stairs.a - 2, stairs.a + 56, stairs.b + 2, stairs.b + 66));
  if (vip) {
    // glass partition of the VIP room (open at its b0 end towards the hall)
    obst.push(rect(vip.a0 - 3, vip.a0 + 1, vip.b0 + 30, vip.b1));
    obst.push(rect(vip.a0, vip.a1, vip.b1 - 1, vip.b1 + 3));
  }
  if (!L2) {
    obst.push(rect(-20, 95, -8, 0.5));
    obst.push(rect(142.5, A + 12, -8, 0.5));
  } else obst.push(rect(-20, A + 12, -8, 0.5));
  obst.push(rect(A - 0.5, A + 8, -10, Bm + 10));
  // ---- queue along the etalase: head at the kasir end, tail by the entrance
  const queue: P[] = [];
  const head = cEnd - 37.5;
  if (!L2) for (let b = head; b >= 40; b -= 21) queue.push(S(104 + (b - 41) / Math.max(1, head - 41) * 1.75, b));
  // ---- nav nodes: aisle lines x gap lines + the queue line + entrance + sidewalk (sidewalk nodes LAST: the cat
  // wanders the first ones)
  const aisles = [104, ...Array.from({ length: cols - 1 }, (_, c) => 199 + COL * c), A - 6];
  if (spec.extraA) aisles.push(A - 6 - spec.extraA / 2);
  if (vip) aisles.push(vip.a0 + 7, vip.a0 - 8);
  const lastRow = tables.reduce((m, t) => Math.max(m, t.db), 0);
  const gaps = [5, ...Array.from({ length: rows }, (_, r) => TOB.b1 + 8 + ROW * r).filter((b) => b < Bm - 6)];
  gaps.push(Math.min(Bm - 8, (TOB.b1 + lastRow + Bm) / 2));
  if (buffet) gaps.push(buffet.db + 8, buffet.db + 106);
  const nav: P[] = [];
  for (const a of aisles) for (const b of gaps) if (b < Bm - 4) nav.push(S(a, b));
  if (!L2) for (let b = 20; b < cEnd; b += 21) nav.push(S(104, b));
  if (buffet) for (const p of buffet.spots) nav.push(p);
  if (stairs) nav.push(stairs.foot);
  const entIn = L2 && stairs ? stairs.head : S(111.75, 11.75);
  const entOut = L2 && stairs ? stairs.head : S(131, -16);
  if (!L2) nav.push(entIn, S(120, 22));
  const sidewalk = L2 ? [] : [entOut, S(60, -22), S(-60, -26), S(200, -24), S(A + 66, -26)];
  nav.push(...sidewalk);
  // ---- staff spots (feet), behind the counter / along the kitchen
  const staff: Record<string, P[]> = { masak: [], pelayan: [], kasir: [], belanja: [], kepala: [], shift: [], manajer: [] };
  if (!L2) {
    const masakB = [116, 80.25, 145.25];
    for (let b = 178; b < cEnd - 50; b += 33) masakB.push(b);
    staff.masak = masakB.map((b, i) => S(i === 1 ? -7.75 : i === 2 ? -2.75 : -6 + (i % 2) * 3, b));
    staff.kepala = [S(-4, 98 + (spec.bigKitchen ? 60 : 0))];
    staff.pelayan = [S(7.25, cEnd - 14), S(9.25, cEnd + 8), S(6.75, cEnd - 34.5), S(8, cEnd - 58), S(8, cEnd - 80), S(8, cEnd - 102)];
    // Rumah Makan+: the waiters work the dining hall (standing in the aisles between the tables)
    if (spec.stage >= 5) staff.pelayan = Array.from({ length: Math.max(2, cols - 1) * 2 }, (_, i) => S(199 + COL * (i % Math.max(1, cols - 1)), i < Math.max(2, cols - 1) ? TOB.b1 + 8 : 6));
    staff.kasir = [S(22.75, cEnd + 19.5), S(21.5, cEnd + 8.25)];
    staff.shift = [S(20, cEnd + 30), S(19, cEnd + 41)];
    staff.manajer = [S(36, cEnd + 34)];
    staff.belanja = [S(25.75, 0.5), S(26.5, -2.5)];
  } else {
    // upstairs: the waiters work the hall + the VIP room, a cashier at the serving station
    staff.pelayan = [S(199, TOB.b1 + 8), S(vip!.a0 + 7, TOB.b1 + 8), S(199, 6), S(A - 6, TOB.b1 + 40)];
    staff.kasir = [S(48, 70)]; staff.shift = [S(48, 100)];
    staff.masak = []; staff.kepala = []; staff.belanja = []; staff.manajer = [S(60, 160)];
  }
  const ojolWait = L2 ? [] : [S(90.25, cEnd + 7), S(105.25, cEnd + 8), S(96.25, cEnd - 9)];
  const visit = L2 ? S(70, 40) : S(99.25, cEnd - 18);
  // ---- depth: the counter overlay sits just under the shallowest queue spot (everyone in line stands in front of it)
  const counterDepth = L2 ? 0 : Math.min(...queue.map((q) => q.y), ...ojolWait.map((q) => q.y), visit.y) - 4;
  const steam = S(-30, 120);
  // ---- bounds: back corner top (walls 134 tall) .. bottom corner, left corner .. right corner
  const wallH = 134;
  const bounds = {
    x0: WX + 7.5 - 4, x1: WX + 7.5 + A + Bm + 4,
    y0: WY + 220 - Bm / 2 - wallH - 4, y1: WY + 220 + A / 2 + 8,
  };
  const wallR = (a: number, h: number) => S(a, Bm, h);
  const wallL = (b: number, h: number) => S(0, b, h);
  return {
    key, spec, stage: spec.stage, floor: spec.floor, A, Bm, bounds, cEnd, queue,
    overflow: L2 ? [] : [S(126, -20), S(110, -21), S(142, -22), S(94, -22), S(158, -23), S(78, -23), S(174, -24)],
    ojolWait, seats, staff, obst, nav, entIn, entOut,
    spawns: L2 ? [entIn] : [S(6, -32), S(A + 50, -32)],
    belanjaOut: [S(28, -18), S(-110, -28)], visit, tables, counterDepth, steam, buffet, stairs, vip, wallR, wallL,
    hallPelayan: spec.stage >= 5 || L2,
  };
}
/** a world point -> iso (a, b) (logical) */
export const isoOf = (p: P) => { const x = p.x - WX - 7.5, y = (p.y - WY - 220) * 2; return { a: (x + y) / 2, b: (x - y) / 2 }; };
