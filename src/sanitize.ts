// v5.1 security: every save that enters the game (localStorage or an imported backup) goes through here first.
// - deep copy of plain JSON data only, with hard limits (depth, node count, string / array length)
// - prototype-pollution keys (__proto__, constructor, prototype) are dropped at every level
// - numbers: non-finite -> 0, clamped to +-1e15 (money / fans can be big, but never Infinity / NaN)
// - strings: control characters removed, length capped
// The game renders text on a canvas (and the DOM overlay only uses textContent / value), so names can't inject HTML;
// these checks are about not crashing / corrupting the game with a hand-edited backup.
import { ROLES, DISH, ING, CUST, LOC, DECOR, COMBOS, OJOL_APPS, RIVALS, UPGRADES } from './data';
import type { GameState } from './state';
import { KATERING, REGULARS, PERKS, SINKS, MANGKAL } from './data2';
import { CITY, OUTLET } from './data3';

/** largest backup text accepted (a 10-year save is ~150-400 KB of JSON; the base64 code is 4/3 of that) */
export const MAX_BACKUP_CHARS = 4 * 1024 * 1024;
const MAX_DEPTH = 24;
const MAX_NODES = 400_000;
const MAX_STR = 400;
const MAX_ARR = 5_000;
const MAX_NUM = 1e15;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class SaveError extends Error {}

/** deep-copy JSON-like data, dropping anything that is not plain JSON and every prototype-pollution key */
export function sanitizeJSON(v: unknown): unknown {
  const budget = { n: 0 };
  const walk = (x: unknown, depth: number): unknown => {
    if (++budget.n > MAX_NODES) throw new SaveError('too many nodes');
    if (depth > MAX_DEPTH) throw new SaveError('too deep');
    if (x === null) return null;
    switch (typeof x) {
      case 'boolean': return x;
      case 'number': return Number.isFinite(x) ? Math.max(-MAX_NUM, Math.min(MAX_NUM, x)) : 0;
      // eslint-disable-next-line no-control-regex
      case 'string': return x.slice(0, MAX_STR).replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/g, '');
      case 'object': {
        if (Array.isArray(x)) {
          if (x.length > MAX_ARR) throw new SaveError('array too long');
          return x.map((e) => walk(e, depth + 1));
        }
        const proto = Object.getPrototypeOf(x);
        if (proto !== Object.prototype && proto !== null) return null;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(x as object)) {
          if (BAD_KEYS.has(k) || k.length > 80) continue;
          const val = walk((x as Record<string, unknown>)[k], depth + 1);
          if (val !== undefined) Object.defineProperty(out, k, { value: val, enumerable: true, writable: true, configurable: true });
        }
        return out;
      }
      default: return undefined; // functions, symbols, bigint, undefined: not JSON
    }
  };
  return walk(v, 0);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, lo: number, hi: number, def: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : def);
const str = (x: unknown, max: number, def: string) => (typeof x === 'string' ? x.slice(0, max) : def);
const ROLE_IDS = new Set(Object.keys(ROLES));
const COMBO_IDS = new Set(COMBOS.map((c) => c.id));
const UPG_IDS = new Set(UPGRADES.map((u) => u.id));
const APP_IDS = new Set(OJOL_APPS.map((a) => a.id));
const RIVAL_IDS = new Set(RIVALS.map((r) => r.id));
const SPRITES = new Set(['cookf', 'cookm', 'kasir', 'pelayan', 'belanja', 'kepala', 'manajer', 'shift']);
const KAT_IDS = new Set(KATERING.map((k) => k.id));
const REG_IDS = new Set(REGULARS.map((r) => r.id));
const SINK_MAX = Object.fromEntries(SINKS.map((k) => [k.id, k.max]));
const MANGKAL_IDS = new Set(MANGKAL.map((m) => m.id));

/** type / range checks on the fields the game indexes tables with (a wrong id would crash a screen later).
 *  Throws SaveError for data that can't be repaired; clamps / filters the rest in place. */
export function checkSaveShape(s: Record<string, unknown>) {
  if (!Array.isArray(s.staff)) throw new SaveError('staff');
  if (typeof s.absDay !== 'number') throw new SaveError('absDay');
  s.money = num(s.money, -MAX_NUM, MAX_NUM, 0);
  s.fans = num(s.fans, 0, MAX_NUM, 0);
  s.poin = num(s.poin, 0, 1e9, 0);
  s.absDay = Math.floor(num(s.absDay, 0, 336 * 500, 0));
  s.tick = Math.floor(num(s.tick, 0, 68, 0));
  s.stage = Math.floor(num(s.stage, 1, 6, 1));
  s.name = str(s.name, 40, 'Warteg Bahari Jaya');
  s.priceLevel = Math.floor(num(s.priceLevel, 0, 2, 1));
  s.kasbonPolicy = Math.floor(num(s.kasbonPolicy, 0, 2, 0));
  if (typeof s.loc !== 'string' || !LOC[s.loc]) s.loc = 'pasar';
  for (const k of ['rasa', 'bersih', 'murah', 'antrian', 'suasana']) s[k] = num(s[k], 0, 100, 50);
  const staffOk = (st: unknown): boolean => {
    if (!isObj(st) || typeof st.id !== 'number' || !ROLE_IDS.has(st.role as string)) return false;
    st.id = Math.floor(num(st.id, 0, 1e9, 0));
    st.name = str(st.name, 40, 'Staf');
    if (!SPRITES.has(st.sprite as string)) st.sprite = st.role === 'masak' ? 'cookf' : st.role === 'belanja' ? 'belanja' : st.role === 'kasir' ? 'kasir' : ['kepala', 'manajer', 'shift'].includes(st.role as string) ? st.role as string : 'pelayan';
    if (st.assign !== undefined) { if (typeof st.assign !== 'string' || !/^(cab|out):[a-z0-9]{1,16}$/.test(st.assign)) delete st.assign; }
    st.level = Math.floor(num(st.level, 1, 10, 1));
    st.exp = num(st.exp, 0, 1e9, 0);
    st.skill = num(st.skill, 1, 100, 20); st.speed = num(st.speed, 1, 100, 20);
    st.salary = num(st.salary, 0, 1e12, 0);
    st.energy = num(st.energy, 0, 100, 100);
    st.loyalty = num(st.loyalty, 0, 100, 60);
    st.traits = Array.isArray(st.traits) ? st.traits.filter((t) => typeof t === 'string').slice(0, 4) : [];
    if (st.pair !== undefined && typeof st.pair !== 'number') delete st.pair;
    return true;
  };
  if (!s.staff.every(staffOk)) throw new SaveError('staff');
  s.candidates = Array.isArray(s.candidates) ? s.candidates.filter(staffOk) : [];
  if (isObj(s.menu)) { for (const k of Object.keys(s.menu)) { if (!DISH[k]) delete s.menu[k]; else s.menu[k] = Math.floor(num(s.menu[k], 0, 999, 0)); } } else s.menu = {};
  if (isObj(s.stock)) { for (const k of Object.keys(s.stock)) { const v = s.stock[k]; if (!DISH[k] || !isObj(v)) delete s.stock[k]; else { v.fresh = num(v.fresh, 0, 9999, 0); v.old = num(v.old, 0, 9999, 0); } } } else s.stock = {};
  if (Array.isArray(s.unlocked)) s.unlocked = s.unlocked.filter((d) => typeof d === 'string' && DISH[d]);
  for (const k of ['pantry', 'prices']) if (isObj(s[k])) { const o = s[k] as Record<string, unknown>; for (const i of Object.keys(o)) { if (!ING[i as keyof typeof ING]) delete o[i]; else o[i] = num(o[i], 0, 1e9, 0); } }
  if (isObj(s.priceHist)) { const o = s.priceHist as Record<string, unknown>; for (const i of Object.keys(o)) { if (!ING[i as keyof typeof ING] || !Array.isArray(o[i])) delete o[i]; else o[i] = (o[i] as unknown[]).filter((x) => typeof x === 'number').slice(-16); } }
  if (Array.isArray(s.decor)) s.decor = s.decor.filter((d) => typeof d === 'string' && DECOR[d]);
  for (const k of ['combos', 'comboTried', 'activeCombos']) if (Array.isArray(s[k])) s[k] = (s[k] as unknown[]).filter((c) => typeof c === 'string' && (k === 'comboTried' || COMBO_IDS.has(c)));
  if (Array.isArray(s.researched)) s.researched = s.researched.filter((r) => typeof r === 'string' && (UPG_IDS.has(r) || !!DISH[r]));
  if (s.research != null && !(isObj(s.research) && typeof s.research.id === 'string' && (UPG_IDS.has(s.research.id) || DISH[s.research.id]))) s.research = null;
  if (isObj(s.apps)) for (const k of Object.keys(s.apps)) if (!APP_IDS.has(k)) delete s.apps[k];
  if (isObj(s.rivals)) for (const k of Object.keys(s.rivals)) if (!RIVAL_IDS.has(k) || !isObj(s.rivals[k])) delete s.rivals[k];
  s.orders = Array.isArray(s.orders) ? s.orders.filter((o) => isObj(o) && APP_IDS.has(o.app as string) && Array.isArray(o.items)).map((o) => { const x = o as Record<string, unknown>; x.items = (x.items as unknown[]).filter((d) => typeof d === 'string' && DISH[d]); return x; }) : [];
  s.cabang = Array.isArray(s.cabang) ? s.cabang.filter((c) => isObj(c) && typeof c.loc === 'string' && LOC[c.loc]) : [];
  s.kasbon = Array.isArray(s.kasbon) ? s.kasbon.filter((k) => isObj(k) && CUST[k.type as keyof typeof CUST]) : [];
  s.reviews = Array.isArray(s.reviews) ? s.reviews.filter((r) => isObj(r) && typeof r.text === 'string').slice(-60) : [];
  s.effects = Array.isArray(s.effects) ? s.effects.filter((e) => isObj(e) && typeof e.id === 'string') : [];
  s.promo = Array.isArray(s.promo) ? s.promo.filter((p) => isObj(p) && typeof p.id === 'string') : [];
  if (!isObj(s.today)) s.today = undefined;
  if (s.history !== undefined && !Array.isArray(s.history)) s.history = [];
  // ---- v2 (v1.3) fields: anything malformed is dropped and migrate() refills the default
  if (!['normal', 'hujan', 'panas'].includes(s.weather as string)) s.weather = undefined;
  s.katering = Array.isArray(s.katering) ? s.katering.filter((k) => isObj(k) && KAT_IDS.has(k.kind as never) && typeof k.portions === 'number').map((k) => {
    const o = k as Record<string, unknown>;
    o.portions = Math.floor(num(o.portions, 1, 5000, 1)); o.prep = num(o.prep, 0, 5000, 0); o.pay = num(o.pay, 0, 1e12, 0); o.dp = num(o.dp, 0, 1e12, 0);
    o.due = Math.floor(num(o.due, 0, 1e7, 0)); o.client = str(o.client, 60, 'Pelanggan'); o.lembur = !!o.lembur;
    if (!['aktif', 'selesai', 'telat', 'gagal'].includes(o.state as string)) o.state = 'gagal';
    return o;
  }).slice(-20) : undefined;
  if (isObj(s.regulars)) { for (const k of Object.keys(s.regulars)) { const r = s.regulars[k]; if (!REG_IDS.has(k) || !isObj(r)) delete s.regulars[k]; else { r.step = Math.floor(num(r.step, 0, 10, 0)); r.aff = num(r.aff, -100, 200, 20); r.next = num(r.next, 0, 1e7, 0); if (!['baru', 'jalan', 'good', 'bad'].includes(r.state as string)) r.state = 'baru'; } } } else s.regulars = undefined;
  s.perks = Array.isArray(s.perks) ? s.perks.filter((p) => typeof p === 'string' && PERKS[p]) : undefined;
  if (isObj(s.cat)) { const c = s.cat; c.name = str(c.name, 24, 'Si Oyen'); c.aff = num(c.aff, 0, 100, 40); c.adopted = !!c.adopted; c.offered = !!c.offered; } else s.cat = undefined;
  s.news = Array.isArray(s.news) ? s.news.filter((n) => isObj(n) && typeof n.text === 'string').slice(-24) : undefined;
  s.shocks = Array.isArray(s.shocks) ? s.shocks.filter((x) => isObj(x) && ING[x.ing as keyof typeof ING]).map((x) => { const o = x as Record<string, unknown>; o.mult = num(o.mult, 0.3, 3, 1); return o; }) : undefined;
  s.posts = Array.isArray(s.posts) ? s.posts.filter((p) => isObj(p) && typeof p.text === 'string').slice(-40) : undefined;
  if (isObj(s.sinks)) { for (const k of Object.keys(s.sinks)) { if (SINK_MAX[k] === undefined) delete s.sinks[k]; else s.sinks[k] = Math.floor(num(s.sinks[k], 0, SINK_MAX[k], 0)); } } else s.sinks = undefined;
  if (!isObj(s.mini)) s.mini = undefined; else { const m = s.mini; if (!Array.isArray(m.done)) m.done = []; if (!isObj(m.best)) m.best = {}; }
  if (typeof s.mangkal !== 'string' || !MANGKAL_IDS.has(s.mangkal)) s.mangkal = undefined;
  if (!isObj(s.stats2)) s.stats2 = undefined; else if (Array.isArray(s.stats2.mangkalTried)) s.stats2.mangkalTried = (s.stats2.mangkalTried as unknown[]).filter((m) => typeof m === 'string' && MANGKAL_IDS.has(m));
  s.followers = num(s.followers, 0, 1e9, 30);
  // ---- v3 (v1.4)
  s.brand = str(s.brand, 40, '');
  s.prasmanan = !!s.prasmanan;
  s.outlets = Array.isArray(s.outlets) ? s.outlets.filter((o) => isObj(o) && typeof o.city === 'string' && CITY[o.city] && OUTLET[o.kind as never]).map((o) => {
    const x = o as Record<string, unknown>;
    x.id = Math.floor(num(x.id, 0, 1e9, 0)); x.lv = Math.floor(num(x.lv, 1, 4, 1)); x.rating = num(x.rating, 0.5, 5, 3);
    x.opened = Math.floor(num(x.opened, 0, 1e7, 0)); x.lastWeek = num(x.lastWeek, -1e12, 1e12, 0); x.total = num(x.total, -1e13, 1e13, 0);
    return x;
  }).slice(0, 40) : undefined;
  s.outletSeq = Math.floor(num(s.outletSeq, 1, 1e9, 1));
}

/** full pipeline for raw data from localStorage / a backup: sanitized copy + shape checks. null = unusable */
export function sanitizeSave(raw: unknown): GameState | null {
  try {
    const c = sanitizeJSON(raw);
    if (!isObj(c)) return null;
    if (typeof c.version === 'number' && c.version > 3) return null;
    checkSaveShape(c);
    return c as unknown as GameState;
  } catch { return null; }
}
