// Warung layout over the background bitmap (bg px = 2x logical; world logical = bg px / 2). World objects live at an
// offset (WX, WY) far away from the UI so the UI camera never sees them and the world camera never sees the UI.
export const WX = 5000, WY = 0;
export const WORLD_W = 398, WORLD_H = 321;
export type P = { x: number; y: number };
/** bg px -> world logical */
export const B = (x: number, y: number): P => ({ x: WX + x / 2, y: WY + y / 2 });

export const ENTRY = B(820, 470);
export const DOOR = B(690, 500);
export const GAP = B(560, 466);
export const COUNTER_R = B(522, 400);
// v1.2: the head of the line (slot 0) is at the right end of the etalase, by the kasir; the tail is at the left end,
// right next to the entrance, so new arrivals join the line straight away and a long line spills out onto the sidewalk
export const QUEUE: P[] = [B(522, 398), B(480, 412), B(435, 434), B(390, 456), B(345, 478), B(300, 500)];
export const OVERFLOW: P[] = [B(600, 520), B(640, 505), B(560, 540), B(680, 490), B(720, 474), B(600, 545), B(645, 528)];
export const OJOL_WAIT: P[] = [B(580, 338), B(612, 352), B(560, 360)];

/** depth of the table overlays (world y of their front edge) */
export const OV_DEPTH = { counter: B(0, 360).y, t1: B(0, 470).y, t2: B(0, 548).y };
export interface Seat { p: P; kind: 'back' | 'front'; table: number; approach: P[]; depth: number }
// table 2 (front) unlocks first, then table 1 (back), then the 4th seat per bench
const t2b = [B(368, 527), B(406, 508), B(444, 489), B(330, 546)];
const t2f = [B(445, 570), B(485, 550), B(525, 530), B(405, 590)];
const t1b = [B(575, 414), B(610, 396), B(645, 378), B(540, 432)];
const t1f = [B(653, 464), B(691, 445), B(729, 426), B(615, 483)];
/** unit vector of the iso "towards the camera, right" axis (perpendicular to the benches), logical px */
const NX = 2 / Math.sqrt(5), NY = 1 / Math.sqrt(5);
// v1.2: one approach point straight off the bench (behind a back bench, in front of a front bench); the route to it
// comes from findPath() so nobody cuts through a table any more
const mk = (p: P, kind: 'back' | 'front', table: 1 | 2): Seat => {
  const k = kind === 'back' ? -12 : table === 2 ? 22 : 18;
  return { p, kind, table, approach: [{ x: p.x + NX * k, y: p.y + NY * k }], depth: table === 1 ? OV_DEPTH.t1 : OV_DEPTH.t2 };
};
export const SEATS_ROOM: Seat[] = [
  ...[0, 1, 2].flatMap((i) => [mk(t2b[i], 'back', 2), mk(t2f[i], 'front', 2)]),
  ...[0, 1, 2].flatMap((i) => [mk(t1b[i], 'back', 1), mk(t1f[i], 'front', 1)]),
  mk(t2b[3], 'back', 2), mk(t2f[3], 'front', 2), mk(t1b[3], 'back', 1), mk(t1f[3], 'front', 1),
];

// staff spots behind the counter (feet), per role
export const STAFF_SPOTS: Record<string, P[]> = {
  masak: [B(235, 318), B(160, 352), B(300, 292)],
  pelayan: [B(372, 276), B(420, 256), B(330, 296)],
  kasir: [B(470, 258), B(445, 268)],
  belanja: [B(66, 466), B(84, 486)],
};

// ---------------------------------------------------------------- gerobak stage (procedural street corner)
// v1.1: wider steps for the bigger character scale (the line walks towards the viewer, so people cover each other)
export const G_QUEUE: P[] = [B(330, 470), B(384, 497), B(438, 524), B(492, 551), B(546, 578), B(600, 605)];
export const G_SEATS: Seat[] = [B(560, 420), B(600, 400), B(640, 380), B(520, 440)].map((p) => ({ p, kind: 'front' as const, table: 1, approach: [{ x: p.x + 8, y: p.y + 10 }], depth: p.y }));
export const G_STAFF: Record<string, P[]> = {
  masak: [B(250, 380), B(210, 400)], pelayan: [B(300, 360)], kasir: [B(330, 350)], belanja: [B(150, 440)],
};
export const G_CART = B(300, 430);

// ---------------------------------------------------------------- outside + navigation (v1.2)
/** iso ground coords of the room: a runs left corner -> bottom corner (front-left edge = b 0), b runs bottom ->
 *  right corner (front-right edge = a 194). Logical px, relative to (WX, WY). */
export const ISO = { ox: 7.5, oy: 220, A: 194, Bm: 191 };
export const S = (a: number, b: number, h = 0): P => ({ x: WX + ISO.ox + a + b, y: WY + ISO.oy + (a - b) / 2 - h });
/** world -> iso ground coords */
export const toIso = (p: P) => { const x = p.x - WX - ISO.ox, y = (p.y - WY - ISO.oy) * 2; return { a: (x + y) / 2, b: (x - y) / 2 }; };
// The street runs along the front-left side of the warung (b < 0). The entrance is the open gap between the left end
// of the counter and table 2, right next to the tail of the queue: people walk up the sidewalk, step in, join the
// line; a long line waits outside on the sidewalk.
/** sidewalk ends (people fade in / out there, outside the view at the default zoom) */
export const SPAWNS: P[] = [S(6, -32), S(244, -32)];
/** just outside / just inside the entrance */
export const ENT_OUT = S(131, -16);
export const ENT_IN = B(262, 540);
/** tukang belanja leaves for the market straight onto the sidewalk and up the street */
export const BELANJA_OUT: P[] = [S(28, -18), S(-110, -28)];
/** inspector / vlogger stand at the right end of the etalase */
export const VISIT_SPOT = B(548, 372);

const BPoly = (pts: [number, number][]) => pts.map(([x, y]) => B(x, y));
/** floor edges of the room bitmap (bg px): front-left y = 440 + 0.512 (x - 15), front-right y = 637 - 0.4895 (x - 400) */
const edgeL = (x: number, inset: number): P => B(x, 440 + 0.512 * (x - 15) - inset);
const edgeR = (x: number, inset: number): P => B(x, 637 - 0.4895 * (x - 400) - inset);
// obstacles (bg px): counter / kitchen block, both tables with their benches (a little inflated), and the closed
// front edges of the room (the entrance gap is the only way in or out)
export const OBST_ROOM: P[][] = [
  BPoly([[-60, 420], [-60, -40], [640, -40], [640, 296], [556, 340], [192, 522], [150, 512], [15, 442]]),
  BPoly([[308, 548], [472, 458], [538, 486], [572, 510], [566, 532], [406, 614], [384, 606], [314, 576]]),
  BPoly([[505, 445], [650, 372], [772, 396], [766, 432], [622, 505], [598, 505], [592, 462], [548, 440], [540, 478], [505, 478]]),
  // front-left edge left and right of the entrance, front-right edge (from the floor edge outwards: nobody steps
  // out over the open front, only through the entrance)
  [edgeL(-20, 1), edgeL(205, 1), edgeL(205, -16), edgeL(-20, -16)],
  [edgeL(300, 1), edgeL(420, 1), edgeL(420, -16), edgeL(300, -16)],
  [edgeR(380, 1), edgeR(820, 1), edgeR(820, -16), edgeR(380, -16)],
];
export const NAV_ROOM: P[] = [
  ...BPoly([[262, 540], [292, 512], [522, 398], [556, 404], [600, 384], [650, 362], [700, 342], [470, 424], [400, 458], [340, 486]]),
  // strip along the front edges (in front of both front benches)
  edgeL(290, 6), edgeL(322, 6), edgeL(352, 8), B(399, 628), edgeR(450, 7), edgeR(505, 7), edgeR(560, 7), edgeR(615, 7), edgeR(670, 7), edgeR(725, 7),
  // sidewalk outside
  ENT_OUT, S(60, -22), S(-60, -26), S(200, -24), S(260, -26),
];
/** the line continues outside on the sidewalk, either side of the entrance */
export const OVERFLOW_ROOM: P[] = [S(126, -20), S(110, -21), S(142, -22), S(94, -22), S(158, -23), S(78, -23), S(174, -24)];

// gerobak street corner: the bench and the cart are the only obstacles
export const OBST_GEROBAK: P[][] = [
  BPoly([[486, 452], [612, 388], [636, 400], [510, 466]]),
  BPoly([[200, 420], [330, 352], [400, 392], [270, 462]]),
];
export const NAV_GEROBAK: P[] = [
  ...BPoly([[420, 470], [520, 500], [640, 470], [700, 430], [560, 560], [690, 500], [400, 560]]),
  ENT_OUT, S(60, -22), S(-60, -26), S(200, -24), S(260, -26),
];

const inPoly = (p: P, poly: P[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const segX = (p1: P, p2: P, q1: P, q2: P) => {
  const d1 = cross(q1, q2, p1), d2 = cross(q1, q2, p2), d3 = cross(p1, p2, q1), d4 = cross(p1, p2, q2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
};
/** true when the segment a-b crosses none of the polygons (polygons containing an end point are ignored for it) */
export function segClear(a: P, b: P, polys: P[][]): boolean {
  for (const poly of polys) {
    if (inPoly(a, poly) || inPoly(b, poly)) continue;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (segX(a, b, poly[i], poly[j])) return false;
    if (inPoly({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, poly)) return false;
  }
  return true;
}
export const insideAny = (p: P, polys: P[][]) => polys.some((q) => inPoly(p, q));
/** shortest walkable route from -> to over a visibility graph of the aisle nodes; returns the waypoints after `from`,
 *  ending with `to`. Falls back to a straight line when no route exists. */
export function findPath(from: P, to: P, nodes: P[], polys: P[][]): P[] {
  if (segClear(from, to, polys)) return [to];
  const pts = [from, ...nodes.filter((n) => !insideAny(n, polys)), to];
  const n = pts.length, T = n - 1;
  const dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === T) break;
    done[u] = true;
    for (let v = 1; v < n; v++) {
      if (done[v]) continue;
      const d = dist[u] + Math.hypot(pts[v].x - pts[u].x, pts[v].y - pts[u].y);
      if (d < dist[v] && segClear(pts[u], pts[v], polys)) { dist[v] = d; prev[v] = u; }
    }
  }
  if (prev[T] < 0) return [to];
  const out: P[] = [];
  for (let v = T; v > 0; v = prev[v]) out.unshift({ x: pts[v].x, y: pts[v].y });
  return out;
}
