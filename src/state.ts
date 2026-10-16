// Save state types, new game, staff generation, localStorage save/load (+ version / migration hook), formatting.
import { DISHES, INGS, ROLES, GOOD_TRAITS, BAD_TRAITS, STAFF_NAMES_F, STAFF_NAMES_M, OJOL_APPS, WARUNG_NAMES, type IngId, type RoleId, type CustId } from './data';
import { sanitizeSave } from './sanitize';
import { CAT_NAMES, type Weather, type KatKind } from './data2';

export const SAVE_KEY = 'juragan-warteg-save-v1';
/** v2 (v1.3): weather, katering, langganan, kucing, pasar, medsos, investasi, minigame, mangkal, welfare stats */
export const SAVE_VERSION = 3;
/** v3 (v1.4): stages 5-6, brand + national outlets, prasmanan, staff posting (manajer), v1.4 stats */
/** a day runs 05:00 - 22:00 in quarter hours */
export const DAY_START = 5 * 4;
export const DAY_TICKS = 17 * 4;
export const DAYS_PER_WEEK = 7, WEEKS_PER_MONTH = 4, MONTHS_PER_YEAR = 12;
export const DAYS_PER_MONTH = DAYS_PER_WEEK * WEEKS_PER_MONTH;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;
export const END_YEAR = 10;

export interface Staff {
  id: number; name: string; role: RoleId; female: boolean; sprite: string;
  skill: number; speed: number; level: number; exp: number; energy: number; salary: number; traits: string[];
  loyalty: number; hiredDay: number; off?: number; mudik?: boolean;
  /** v1.3 cinlok partner (staff id) */
  pair?: number;
  /** v1.4: manajer posted at a cabang ('cab:<loc>') or a national outlet ('out:<id>') */
  assign?: string;
}
/** v1.4 national franchise outlet (another city, a mall or an airport) */
export interface Outlet { id: number; city: string; kind: 'kota' | 'mall' | 'bandara'; lv: number; opened: number; rating: number; lastWeek: number; total: number }
export interface Customer {
  id: number; type: CustId; state: 'queue' | 'eat' | 'gone'; wait: number; patience: number; dine: boolean;
  seat: number; eatLeft: number; spent: number; mood: number; kasbon: boolean; name: string;
  /** v1.3: sheltering from the rain (buys a drink / gorengan, no rice) */
  neduh?: boolean;
  /** v1.4: part of a rombongan (tour bus group) */
  group?: boolean;
}
export interface OjolOrder { id: number; app: string; name: string; items: string[]; total: number; left: number; state: 'wait' | 'pickup' | 'done' | 'batal' }
export interface Review { id: number; day: number; name: string; type: CustId | 'vlog' | 'dinkes' | 'sistem'; stars: number; text: string }
export interface Cabang { loc: string; lv: number; opened: number; rating: number; lastWeek: number; total: number }
export interface Effect { id: string; until: number; v: number }
export interface DayStats {
  customers: number; served: number; left: number; balk: number; habis: number; revenue: number; ojolRev: number; ojolCommission: number;
  ingCost: number; portions: number; waste: number; kasbonGiven: number; kasbonBack: number; ojolDone: number; ojolBatal: number;
  waitSum: number; happy: number; byType: Partial<Record<CustId, number>>; sold: Record<string, number>; other: number;
}
// ---- v1.3 systems
export interface KatOrder { id: number; kind: KatKind; client: string; portions: number; pay: number; due: number; prep: number; lembur: boolean; state: 'aktif' | 'selesai' | 'telat' | 'gagal'; dp: number; day: number }
export interface RegState { step: number; aff: number; next: number; state: 'baru' | 'jalan' | 'good' | 'bad' }
export interface CatState { adopted: boolean; offered: boolean; name: string; aff: number; fedDay: number; petDay: number; stolen: number }
export interface News { day: number; text: string; kind: 'shock' | 'info' | 'iklan' }
export interface ShockOn { id: string; ing: IngId; mult: number; until: number }
export interface Post { id: number; day: number; user: string; text: string; kind: 'good' | 'mid' | 'bad' | 'viral' | 'komplain' | 'balas'; likes: number; replied?: string }
export interface Stats2 {
  katDone: number; katLate: number; katFail: number; hujanServed: number; neduh: number; regGood: number; regBad: number;
  thrFull: number; thrSkip: number; mogok: number; fired: number; resign: number; komplainReplied: number; komplainIgnored: number;
  miniBest: number; miniPlays: number; satpolLolos: number; satpolKena: number; tips: number; catSteal: number; kasbonGiven: number;
  borong: number; investTotal: number; mangkalTried: string[]; takjilSold: number; maling: number;
  /** v1.4 */
  busServed: number; prasmananDays: number; vipAcara: number; outletsOpened: number; mejaServed: number;
}
export const emptyStats2 = (): Stats2 => ({ katDone: 0, katLate: 0, katFail: 0, hujanServed: 0, neduh: 0, regGood: 0, regBad: 0, thrFull: 0, thrSkip: 0, mogok: 0, fired: 0, resign: 0, komplainReplied: 0, komplainIgnored: 0, miniBest: 0, miniPlays: 0, satpolLolos: 0, satpolKena: 0, tips: 0, catSteal: 0, kasbonGiven: 0, borong: 0, investTotal: 0, mangkalTried: ['pasar'], takjilSold: 0, maling: 0, busServed: 0, prasmananDays: 0, vipAcara: 0, outletsOpened: 0, mejaServed: 0 });
export const newCat = (): CatState => ({ adopted: false, offered: false, name: pick(CAT_NAMES), aff: 40, fedDay: -1, petDay: -1, stolen: 0 });

export interface Ledger { revenue: number; ingredients: number; salaries: number; rent: number; other: number; ojolFee: number; investment: number }

export interface GameState {
  version: number; created: number; name: string; money: number; absDay: number; tick: number;
  stage: number; franchise: boolean; loc: string;
  fans: number; poin: number;
  rasa: number; bersih: number; murah: number; antrian: number; suasana: number;
  priceLevel: number; sisaPolicy: 'panas' | 'buang';
  menu: Record<string, number>; nasiPorsi: number; unlocked: string[];
  stock: Record<string, { fresh: number; old: number }>; nasi: number;
  pantry: Record<IngId, number>; prices: Record<IngId, number>; priceHist: Record<IngId, number[]>; autoBuy: boolean; inflation: number;
  staff: Staff[]; nextId: number; candidates: Staff[];
  decor: string[];
  research: { id: string; left: number } | null; researched: string[]; combos: string[]; comboTried: string[]; activeCombos: string[];
  apps: Record<string, { joined: boolean; promo: boolean; rating: number }>; orders: OjolOrder[];
  kasbonPolicy: number; kasbon: { type: CustId; amount: number; day: number }[];
  cabang: Cabang[];
  rivals: Record<string, { strength: number; cut: number; met: boolean }>;
  effects: Effect[]; promo: { id: string; left: number }[];
  reviews: Review[]; reviewSeq: number; reviewRead: number;
  today: DayStats; yesterday: DayStats | null; history: { day: number; profit: number; customers: number; stars: number }[];
  ledger: Record<number, Ledger>;
  totals: { customers: number; revenue: number; profit: number; portions: number; bestDay: number; maxStars: number; viral: number; sidakLolos: number; kasbonLost: number };
  achievements: Record<string, number>;
  tut: number; ended: boolean; bankrupt: boolean; debtMonths: number; flags: Record<string, number>;
  custSeq: number; orderSeq: number;
  // ---- v1.3
  weather: Weather; katering: KatOrder[]; katSeq: number;
  regulars: Record<string, RegState>; perks: string[];
  cat: CatState;
  news: News[]; shocks: ShockOn[];
  posts: Post[]; postSeq: number; followers: number;
  sinks: Record<string, number>;
  mini: { day: number; done: string[]; best: Record<string, number> };
  mangkal: string; izinPKL: boolean;
  stats2: Stats2;
  // ---- v1.4
  /** own brand name (named when the franchise starts) */
  brand: string;
  outlets: Outlet[]; outletSeq: number;
  prasmanan: boolean;
}

export const emptyDay = (): DayStats => ({ customers: 0, served: 0, left: 0, balk: 0, habis: 0, revenue: 0, ojolRev: 0, ojolCommission: 0, ingCost: 0, portions: 0, waste: 0, kasbonGiven: 0, kasbonBack: 0, ojolDone: 0, ojolBatal: 0, waitSum: 0, happy: 0, byType: {}, sold: {}, other: 0 });
export const emptyLedger = (): Ledger => ({ revenue: 0, ingredients: 0, salaries: 0, rent: 0, other: 0, ojolFee: 0, investment: 0 });

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const irnd = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function makeStaff(s: { nextId: number; absDay: number }, role: RoleId, quality = 1): Staff {
  const female = Math.random() < (role === 'pelayan' ? 0.8 : role === 'belanja' ? 0.15 : role === 'kasir' ? 0.25 : 0.55);
  const sprites = ROLES[role].sprites;
  const sprite = role === 'masak' ? (female ? 'cookf' : 'cookm') : sprites[0];
  const skill = Math.round(clamp(rnd(18, 42) * quality, 8, 95));
  const speed = Math.round(clamp(rnd(20, 45) * quality, 8, 95));
  const traits: string[] = [];
  if (Math.random() < 0.55) traits.push(pick(GOOD_TRAITS));
  if (Math.random() < 0.35) { const b = pick(BAD_TRAITS); if (!traits.includes(b)) traits.push(b); }
  const salary = Math.round((ROLES[role].base * (0.75 + (skill + speed) / 160)) / 50000) * 50000;
  return { id: s.nextId++, name: pick(female ? STAFF_NAMES_F : STAFF_NAMES_M), role, female, sprite, skill, speed, level: 1, exp: 0, energy: 100, salary, traits, loyalty: 70, hiredDay: s.absDay };
}

export function basePrices(infl = 1): Record<IngId, number> {
  return Object.fromEntries(INGS.map((i) => [i.id, Math.round(i.base * infl)])) as Record<IngId, number>;
}

export function newGame(name?: string): GameState {
  const s = {
    version: SAVE_VERSION, created: Date.now(), name: name || pick(WARUNG_NAMES), money: 6000000, absDay: 0, tick: 0,
    stage: 1, franchise: false, loc: 'pasar', fans: 20, poin: 10,
    rasa: 45, bersih: 55, murah: 60, antrian: 60, suasana: 20,
    priceLevel: 1, sisaPolicy: 'panas',
    menu: { orek: 25, telurbalado: 20, tahu: 25, lodeh: 20, esteh: 30 }, nasiPorsi: 70,
    unlocked: DISHES.filter((d) => d.unlock === 'start').map((d) => d.id),
    stock: {}, nasi: 0,
    pantry: Object.fromEntries(INGS.map((i) => [i.id, 0])) as Record<IngId, number>,
    prices: basePrices(), priceHist: Object.fromEntries(INGS.map((i) => [i.id, [i.base]])) as Record<IngId, number[]>, autoBuy: true, inflation: 1,
    staff: [], nextId: 1, candidates: [], decor: [],
    research: null, researched: [], combos: [], comboTried: [], activeCombos: [],
    apps: Object.fromEntries(OJOL_APPS.map((a) => [a.id, { joined: false, promo: false, rating: 4.5 }])), orders: [],
    kasbonPolicy: 0, kasbon: [], cabang: [],
    rivals: { sebelah: { strength: 0.35, cut: 0, met: false } },
    effects: [], promo: [], reviews: [], reviewSeq: 0, reviewRead: 0,
    today: emptyDay(), yesterday: null, history: [], ledger: { 1: emptyLedger() },
    totals: { customers: 0, revenue: 0, profit: 0, portions: 0, bestDay: 0, maxStars: 0, viral: 0, sidakLolos: 0, kasbonLost: 0 },
    achievements: {}, tut: 0, ended: false, bankrupt: false, debtMonths: 0, flags: {}, custSeq: 1, orderSeq: 1,
    weather: 'normal', katering: [], katSeq: 1, regulars: {}, perks: [], cat: newCat(), news: [], shocks: [],
    posts: [], postSeq: 0, followers: 30, sinks: {}, mini: { day: -1, done: [], best: {} }, mangkal: 'pasar', izinPKL: false,
    stats2: emptyStats2(),
    brand: '', outlets: [], outletSeq: 1, prasmanan: false,
  } as GameState;
  const cook = makeStaff(s, 'masak', 1.05);
  cook.name = 'Mbok Darmi'; cook.female = true; cook.sprite = 'cookf'; cook.traits = ['rajin']; cook.salary = 1500000;
  s.staff.push(cook);
  return s;
}

export interface DateInfo { year: number; month: number; week: number; day: number; dom: number; absDay: number }
export function dateOf(absDay: number): DateInfo {
  const year = Math.floor(absDay / DAYS_PER_YEAR) + 1;
  const dy = absDay % DAYS_PER_YEAR;
  const month = Math.floor(dy / DAYS_PER_MONTH) + 1;
  const dom = (dy % DAYS_PER_MONTH) + 1;
  return { year, month, week: Math.floor((dom - 1) / DAYS_PER_WEEK) + 1, day: ((dom - 1) % DAYS_PER_WEEK) + 1, dom, absDay };
}
export const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export function clock(tick: number) {
  const q = DAY_START + Math.min(tick, DAY_TICKS);
  return `${String(Math.floor(q / 4)).padStart(2, '0')}:${String((q % 4) * 15).padStart(2, '0')}`;
}
export function fmtMoney(n: number) { const neg = n < 0; return (neg ? '-Rp ' : 'Rp ') + Math.round(Math.abs(n)).toLocaleString('id-ID'); }
export function fmtShort(n: number) {
  const a = Math.abs(n), sg = n < 0 ? '-' : '';
  if (a >= 1e12) return `${sg}Rp ${(a / 1e12).toFixed(1).replace('.', ',')} T`;
  if (a >= 1e9) return `${sg}Rp ${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace('.', ',')} M`;
  if (a >= 1e6) return `${sg}Rp ${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace('.', ',')} jt`;
  if (a >= 1e3) return `${sg}Rp ${Math.round(a / 1e3)} rb`;
  return `${sg}Rp ${Math.round(a)}`;
}
export function fmtNum(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' jt';
  if (n >= 1e4) return Math.round(n / 1e3) + ' rb';
  return Math.round(n).toLocaleString('id-ID');
}

// ------------------------------------------------------------------ persistence
/** fill fields that older saves (or a partial backup) lack, and run version migrations */
export function migrate(s: GameState): GameState {
  const d = newGame(s.name);
  for (const k of Object.keys(d) as (keyof GameState)[]) if ((s as unknown as Record<string, unknown>)[k] === undefined) (s as unknown as Record<string, unknown>)[k] = (d as unknown as Record<string, unknown>)[k];
  for (const i of INGS) {
    if (typeof s.pantry[i.id] !== 'number') s.pantry[i.id] = 0;
    if (typeof s.prices[i.id] !== 'number') s.prices[i.id] = i.base;
    if (!Array.isArray(s.priceHist[i.id])) s.priceHist[i.id] = [s.prices[i.id]];
  }
  for (const a of OJOL_APPS) if (!s.apps[a.id]) s.apps[a.id] = { joined: false, promo: false, rating: 4.5 };
  s.today = { ...emptyDay(), ...s.today };
  if (!s.ledger[dateOf(s.absDay).year]) s.ledger[dateOf(s.absDay).year] = emptyLedger();
  // v1 -> v2 (v1.3 systems): nested objects get their missing keys; old saves keep playing with the new features off
  // until they trigger (the cat offer, the first katering order, the first regular...)
  s.cat = { ...newCat(), ...(s.cat ?? {}) };
  s.mini = Object.assign({ day: -1, done: [], best: {} }, s.mini ?? {});
  s.stats2 = { ...emptyStats2(), ...(s.stats2 ?? {}) };
  if (!Array.isArray(s.stats2.mangkalTried)) s.stats2.mangkalTried = ['pasar'];
  if (s.version < 2) {
    // a running v1 game: keep the old ending feel fair (no welfare history yet) and seed the netizen count from fans
    s.followers = Math.max(30, Math.round(s.fans * 0.25));
    if (s.stage > 1 || s.absDay > 40) s.cat.offered = false;
    s.version = 2;
  }
  if (s.version < 3) {
    // v2 -> v3 (v1.4): the old automatic franchise outlets become real outlets of a brand named after the warung
    s.stage = Math.min(Math.max(1, s.stage), 4);
    if (s.franchise) {
      s.brand = s.brand || s.name;
      const n = Math.min(8, Math.max(0, Math.round(s.flags.franchiseCount ?? 0)));
      const cities = ['pesisir', 'kembang', 'teluk', 'gunungsari', 'tepian', 'danau', 'cakrawala', 'pesisir'];
      for (let i = 0; i < n; i++) s.outlets.push({ id: s.outletSeq++, city: cities[i], kind: 'kota', lv: 1, opened: s.absDay, rating: 3.5, lastWeek: 0, total: 0 });
      delete s.flags.franchiseCount;
    }
    s.version = 3;
  }
  for (const st of s.staff) if (st.assign && !st.assign.startsWith('cab:') && !st.assign.startsWith('out:')) delete st.assign;
  s.version = SAVE_VERSION;
  return s;
}
/** sanitize (deep plain copy, limits, ids) + migrate; null when the data is not a usable save */
export function normalizeSave(raw: unknown): GameState | null {
  const s = sanitizeSave(raw);
  if (!s) return null;
  return migrate(s);
}
export function saveGame(s: GameState) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage full / blocked */ }
}
export function loadGame(): GameState | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const s = normalizeSave(JSON.parse(raw));
    if (s) return s;
  } catch { /* fallthrough */ }
  // unreadable: keep it aside instead of overwriting it with a new game
  try { localStorage.setItem(SAVE_KEY + '-rusak', raw); localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  return null;
}
export function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
export function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
