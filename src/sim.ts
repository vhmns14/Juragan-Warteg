// Pure simulation (no Phaser): the daily loop (morning belanja + masak, customers per quarter hour, ojol orders,
// evening report), monthly costs, research, staff, rivals, events, cabang / franchise, achievements, ending.
// The Game scene and the balance bot both drive it through tick().
import {
  DISH, NASI, INGS, CUSTS, CUST, LOC, STAGES, DECOR, COMBOS, UPGRADES, PROMOS, OJOL_APPS, RIVALS, ROLES,
  FRANCHISE, type IngId, type CustId, type RoleId, type Dish,
} from './data';
import {
  type GameState, type Customer, type OjolOrder, type Review, type Staff,
  DAY_TICKS, DAYS_PER_MONTH, DAYS_PER_WEEK, END_YEAR, emptyDay, emptyLedger, dateOf, makeStaff, rnd, irnd, pick, clamp, fmtShort, fmtMoney, HARI,
} from './state';
import { checkAchievements } from './achievements';
import { ROOM_UPKEEP } from './data3';
import {
  rollWeather, prepKatering, catDaily, dailyExtras, maybeRegular, rollEvents2, resolveExt, onReview, dailySocial, nightCheck,
  weeklyMarket, shockMult, yearlyCommitments, typeMul, trafficMul, mixNow, locTraffic, mangkalDef, hourMul, miniV, sinkLv,
  gudangCap, pantryKg, staffLeaves, careerScore2, endingFor, hasPerk, hint, commitmentsPerYear,
} from './systems';
import {
  kepalaCapMul, kepalaRasa, shiftRate, manajerHome, canHireRole, prasmananOn, mejaCover, offerBus, resolveBus, busTick,
  outletsWeek, outletUpkeep, offerMitra, resolveMitra, cabangMgrMul, clearAssign, setBrand, managerAt, yearlyTax, taxEstimate,
} from './sim3';

export type SimEvent =
  | { type: 'arrive'; c: Customer }
  | { type: 'served'; c: Customer; amount: number; dishes: string[]; kasbon: boolean }
  | { type: 'leave'; c: Customer; reason: 'lama' | 'habis' | 'penuh' | 'mahal' | 'kenyang' }
  | { type: 'ojolNew'; o: OjolOrder } | { type: 'ojolPickup'; o: OjolOrder } | { type: 'ojolDone'; o: OjolOrder; amount: number } | { type: 'ojolBatal'; o: OjolOrder }
  | { type: 'toast'; text: string } | { type: 'pop'; text: string; color?: string }
  | { type: 'choice'; ev: ChoiceEvent }
  | { type: 'dayStart' } | { type: 'dayEnd'; report: DayReport }
  | { type: 'review'; r: Review } | { type: 'achievement'; id: string }
  | { type: 'staffChange' } | { type: 'levelUp'; st: Staff } | { type: 'stage' } | { type: 'decor' }
  | { type: 'research'; name: string } | { type: 'ending' } | { type: 'bankrupt' } | { type: 'visitor'; kind: 'dinkes' | 'vlog' | 'belanja' | 'satpol' }
  | { type: 'hint'; id: string } | { type: 'cat'; kind: 'steal' | 'happy' | 'eat' | 'adopt' } | { type: 'bus'; n: number };

export interface Choice { label: string; hint?: string; act: string }
export interface ChoiceEvent { id: string; title: string; text: string; choices: Choice[]; data?: Record<string, number | string> }
export interface DayReport {
  day: number; customers: number; served: number; lost: number; revenue: number; ojolNet: number; ingCost: number; overhead: number; profit: number;
  waste: number; kasbon: number; stars: number; deltaStars: number; fans: number; best: string; ojolDone: number; ojolBatal: number; poin: number; byType: Partial<Record<CustId, number>>;
}

const LEVEL_MULT = [0.85, 1, 1.2];
/** arrivals per quarter hour, 05:00 .. 22:00 (68 ticks) */
const HOUR_W: number[] = (() => {
  const w: number[] = [];
  for (let t = 0; t < DAY_TICKS; t++) {
    const h = 5 + t / 4;
    let v = 0.35;
    if (h >= 6 && h < 9) v = 1.0;
    else if (h >= 9 && h < 11) v = 0.45;
    else if (h >= 11 && h < 13.5) v = 2.6;
    else if (h >= 13.5 && h < 17) v = 0.5;
    else if (h >= 17 && h < 20) v = 1.35;
    else if (h >= 20) v = 0.35;
    w.push(v);
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / sum);
})();
export const hourWeight = (t: number) => HOUR_W[Math.max(0, Math.min(DAY_TICKS - 1, t))] * DAY_TICKS;

export const expNeed = (lv: number) => 100 + lv * lv * 40;
export function ramadanMonth(year: number) { return (((9 - (year - 1)) - 1) % 12 + 12) % 12 + 1; }
export function rushLabel(tick: number) {
  const h = 5 + tick / 4;
  if (tick >= DAY_TICKS) return 'TUTUP';
  if (h < 6) return 'BUKA PAGI';
  if (h < 9) return 'SARAPAN PAGI';
  if (h < 11) return 'JEDA PAGI';
  if (h < 13.5) return 'JAM MAKAN SIANG';
  if (h < 17) return 'SIANG SANTAI';
  if (h < 20) return 'MAKAN MALAM';
  return 'MAU TUTUP';
}

export class Sim {
  s: GameState;
  customers: Customer[] = [];
  pending: ChoiceEvent[] = [];
  private listeners: ((e: SimEvent) => void)[] = [];
  private spawnAcc = 0;
  private serveAcc = 0;
  /** effort units cooked today (extra cooking uses what is left) */
  usedCap = 0;
  /** v1.3: effort the katering orders took this morning */
  katUsed = 0;
  /** choice events queued today (a regular only drops by on a quiet day) */
  evToday = 0;
  /** bot / tests: auto-resolve choice events with this picker instead of queueing them */
  autoChoice: ((ev: ChoiceEvent) => number) | null = null;
  constructor(s: GameState) { this.s = s; if (this.s.tick > 0) this.usedCap = this.cookCap() * 0.9; }
  on(f: (e: SimEvent) => void) { this.listeners.push(f); }
  off(f: (e: SimEvent) => void) { this.listeners = this.listeners.filter((x) => x !== f); }
  emit(e: SimEvent) { for (const f of this.listeners) f(e); }
  toast(text: string) { this.emit({ type: 'toast', text }); }

  // ------------------------------------------------------------ derived values
  get date() { return dateOf(this.s.absDay); }
  stageInfo() { return STAGES[this.s.stage - 1]; }
  stars() { const s = this.s; return clamp((s.rasa * 0.33 + s.bersih * 0.2 + s.murah * 0.2 + s.antrian * 0.15 + s.suasana * 0.12) / 20, 0, 5); }
  has(decor: string) { return this.s.decor.includes(decor); }
  hasR(id: string) { return this.s.researched.includes(id); }
  effect(id: string) { return this.s.effects.find((e) => e.id === id && e.until > this.s.absDay); }
  promoOn(id: string) { return this.s.promo.some((p) => p.id === id && p.left > 0); }
  working(): Staff[] { return this.s.staff.filter((st) => !st.off); }
  byRole(r: RoleId) { return this.working().filter((st) => st.role === r); }
  speedMul(st: Staff) { return (st.traits.includes('cekatan') ? 1.25 : 1) * (st.traits.includes('mager') ? 0.85 : 1) * (0.55 + st.energy / 220); }
  isRamadan() { return this.date.month === ramadanMonth(this.date.year); }
  isLebaranWeek() { const d = this.date; const lm = ramadanMonth(d.year) % 12 + 1; return d.month === lm && d.week === 1; }
  isRainy() { const m = this.date.month; return m >= 11 || m <= 2; }
  lebaranMonth() { return ramadanMonth(this.date.year) % 12 + 1; }
  hujan() { return this.s.weather === 'hujan'; }
  /** tanggal tua: 0 (gajian) .. 1 (paling tua) */
  tua() { const dom = this.date.dom; return dom <= 5 ? 0 : clamp((dom - 8) / 18, 0, 1); }
  /** purchasing power multiplier on budgets */
  power() { const dom = this.date.dom; return dom <= 5 ? 1.15 : 1 - 0.25 * this.tua(); }
  priceMult() { return LEVEL_MULT[this.s.priceLevel] * this.s.inflation * (this.promoOn('gajian') ? 0.9 : 1) * (this.effect('perang') ? 0.9 : 1); }
  dishPrice(d: Dish | string) { const x = typeof d === 'string' ? DISH[d] : d; return Math.round((x.price * this.priceMult()) / 500) * 500; }
  nasiPrice() { return Math.round((NASI.price * this.priceMult()) / 500) * 500; }
  marketPrice(i: IngId) { return Math.round(this.s.prices[i] * (1 - this.belanjaDiscount())); }
  belanjaDiscount() {
    const b = this.byRole('belanja');
    if (!b.length) return 0;
    const best = Math.max(...b.map((st) => 0.04 + st.skill / 900 + st.level * 0.006 + (st.traits.includes('hemat') ? 0.04 : 0)));
    return clamp(best, 0, 0.18);
  }
  slots() { return this.stageInfo().slots; }
  /** v1.3: extra etalase slots for takjil during Ramadan */
  takjilSlots() { return this.isRamadan() ? 2 : 0; }
  seats() { return this.stageInfo().seats; }
  /** cooking capacity in effort units per day */
  cookCap() {
    const cooks = this.byRole('masak');
    let cap = cooks.length ? 0 : 30;
    for (const c of cooks) cap += (45 + c.skill * 0.9 + c.level * 7) * this.speedMul(c);
    if (this.hasR('teknik_cepat')) cap *= 1.2;
    cap *= kepalaCapMul(this);
    if (this.effect('mogok')) cap *= 0.5;
    return Math.round(cap);
  }
  /** customers served per quarter hour */
  serveRate() {
    let r = 1.6;
    for (const p of this.byRole('pelayan')) r += (1.6 + p.skill / 40 + p.speed / 30 + p.level * 0.25) * this.speedMul(p);
    for (const k of this.byRole('kasir')) r += (1.2 + k.speed / 35 + k.level * 0.2) * this.speedMul(k);
    if (!this.byRole('pelayan').length && !this.byRole('kasir').length) r += this.byRole('masak').length * 0.6;
    r += shiftRate(this);
    // v1.4: self-service buffet = a faster line (somebody has to keep refilling it), a manajer keeps the floor moving
    if (prasmananOn(this)) r *= this.byRole('pelayan').length ? 1.3 : 1.1;
    if (manajerHome(this)) r *= 1.05;
    if (this.hasR('qris')) r *= 1.15;
    r *= 1 + 0.3 * miniV(this, 'm_piring');
    if (this.effect('mogok')) r *= 0.6;
    return r;
  }
  monthlySalaries() { return this.s.staff.reduce((a, b) => a + b.salary, 0); }
  /** decor upkeep + v1.4 running costs of the big rooms (listrik AC, genset, parkir, kebersihan) */
  monthlyUpkeep() { return this.s.decor.reduce((a, d) => a + (DECOR[d]?.upkeep ?? 0), 0) + Math.round((ROOM_UPKEEP[this.s.stage - 1] ?? 0) * this.s.inflation); }
  monthlyRent() { return sinkLv(this, 'ruko') ? 0 : Math.round(this.stageInfo().rent * this.s.inflation); }
  monthlyCosts() { return this.monthlySalaries() + this.monthlyUpkeep() + this.monthlyRent() + Math.round(outletUpkeep(this)); }
  stockPct() { const want = Math.max(1, this.s.nasiPorsi); return clamp(this.s.nasi / want, 0, 1); }
  totalStock(id: string) { const x = this.s.stock[id]; return x ? x.fresh + x.old : 0; }
  ojolWaiting() { return this.s.orders.filter((o) => o.state === 'wait' || o.state === 'pickup').length; }
  queue() { return this.customers.filter((c) => c.state === 'queue'); }
  seatsUsed() { return this.customers.filter((c) => c.state === 'eat' && c.seat >= 0).length; }
  ingIndex() { let a = 0; for (const i of INGS) a += this.s.prices[i.id] / (i.base * this.s.inflation); return a / INGS.length; }
  activeMenu(): string[] {
    const ids = Object.keys(this.s.menu).filter((id) => this.s.menu[id] > 0 && DISH[id] && DISH[id].unlock !== 'takjil' && this.s.unlocked.includes(id));
    const out = ids.slice(0, this.slots());
    // takjil: cookable only in Ramadan, on their own extra slots
    if (this.isRamadan()) for (const id of Object.keys(this.s.menu)) if (this.s.menu[id] > 0 && DISH[id]?.unlock === 'takjil') out.push(id);
    return out;
  }
  effortOf(plan: Record<string, number>, nasi: number) {
    let e = nasi * 0.12;
    for (const [id, n] of Object.entries(plan)) if (DISH[id]) e += n * DISH[id].effort;
    return e;
  }

  // ------------------------------------------------------------ money
  money(delta: number, cat: 'revenue' | 'ingredients' | 'salaries' | 'rent' | 'other' | 'ojolFee' | 'investment') {
    this.s.money += delta;
    const y = this.date.year;
    const L = this.s.ledger[y] ?? (this.s.ledger[y] = emptyLedger());
    L[cat] += cat === 'revenue' ? delta : -delta;
  }
  canAfford(n: number) { return this.s.money >= n; }

  // ------------------------------------------------------------ the clock
  tick() {
    const s = this.s;
    if (s.bankrupt) return;
    if (this.pending.length) return; // a choice is waiting (the scene shows it)
    if (s.tick === 0) this.startDay();
    if (this.pending.length && s.tick === 0) { s.tick = 1; return; }
    this.simTick(s.tick);
    s.tick++;
    if (s.tick >= DAY_TICKS) this.endDay();
  }

  // ------------------------------------------------------------ morning
  startDay() {
    const s = this.s, d = this.date;
    this.customers = []; this.spawnAcc = 0; this.serveAcc = 0; this.usedCap = 0;
    s.today = emptyDay();
    s.orders = [];
    // monthly / weekly / yearly
    if (d.dom === 1) this.monthStart();
    if (d.day === 1) this.weekStart();
    // staff days off
    for (const st of s.staff) if (st.off) { st.off--; if (!st.off) st.mudik = false; }
    rollWeather(this);
    // pantry spoilage
    for (const i of INGS) {
      const sp = i.spoil * (this.has('kulkas') ? 0.5 : 1) * (this.byRole('belanja').length ? 0.8 : 1);
      s.pantry[i.id] = Math.max(0, s.pantry[i.id] * (1 - sp));
      if (s.pantry[i.id] < 0.01) s.pantry[i.id] = 0;
    }
    this.katUsed = prepKatering(this);
    this.cookMorning();
    catDaily(this);
    dailyExtras(this);
    // research
    if (s.research) {
      s.research.left--;
      if (s.research.left <= 0) this.finishResearch(s.research.id);
    }
    for (const p of s.promo) p.left--;
    s.promo = s.promo.filter((p) => p.left > 0);
    s.effects = s.effects.filter((e) => e.until > s.absDay);
    this.evToday = 0;
    this.rollEvents();
    if (!this.evToday) maybeRegular(this);
    this.emit({ type: 'dayStart' });
  }

  /** auto-belanja + cook the day's plan into the etalase (keeps reheated leftovers) */
  cookMorning() {
    const s = this.s;
    const menu = this.activeMenu();
    const plan: Record<string, number> = {};
    for (const id of menu) plan[id] = s.menu[id];
    let nasi = s.nasiPorsi;
    // capacity
    const cap = Math.max(10, this.cookCap() - this.katUsed);
    const eff = this.effortOf(plan, nasi);
    const k = eff > cap ? cap / eff : 1;
    if (k < 1) { for (const id of menu) plan[id] = Math.floor(plan[id] * k); nasi = Math.floor(nasi * k); }
    // ingredients needed
    const need: Record<IngId, number> = Object.fromEntries(INGS.map((i) => [i.id, 0])) as Record<IngId, number>;
    need.beras += nasi * NASI.beras;
    for (const id of menu) for (const [ing, q] of Object.entries(DISH[id].ing)) need[ing as IngId] += (q ?? 0) * plan[id];
    if (s.autoBuy) {
      for (const i of INGS) {
        const miss = Math.max(0, need[i.id] - s.pantry[i.id]);
        if (miss <= 0) continue;
        const kg = Math.ceil(miss * 10) / 10;
        const cost = Math.round(kg * this.marketPrice(i.id));
        // the market lets a regular buy on credit (utang ke pemasok)
        // v1.3: up to ~2 months of costs, so one bad January (commitments) does not stop the kitchen outright
        const afford = Math.max(0, s.money + Math.max(3000000, this.monthlyCosts() * 2));
        const buyKg = cost <= afford ? kg : Math.floor((afford / this.marketPrice(i.id)) * 10) / 10;
        if (buyKg <= 0) continue;
        const c = Math.round(buyKg * this.marketPrice(i.id));
        this.money(-c, 'ingredients'); s.today.ingCost += c; s.pantry[i.id] += buyKg;
      }
    }
    // cook what the pantry allows
    const ratio = (q: Partial<Record<IngId, number>>, n: number) => {
      let r = 1;
      for (const [ing, a] of Object.entries(q)) { const want = (a ?? 0) * n; if (want > 0) r = Math.min(r, s.pantry[ing as IngId] / want); }
      return r;
    };
    const rb = nasi > 0 ? Math.min(1, s.pantry.beras / (nasi * NASI.beras)) : 1;
    nasi = Math.floor(nasi * rb);
    s.pantry.beras = Math.max(0, s.pantry.beras - nasi * NASI.beras);
    // leftover rice: kept only with a rice warmer
    s.nasi = Math.floor((this.has('magicom') ? s.nasi * 0.5 : 0) + nasi);
    let portions = nasi;
    for (const id of menu) {
      const n = Math.floor(plan[id] * Math.min(1, ratio(DISH[id].ing, plan[id])));
      for (const [ing, a] of Object.entries(DISH[id].ing)) s.pantry[ing as IngId] = Math.max(0, s.pantry[ing as IngId] - (a ?? 0) * n);
      const st = s.stock[id] ?? (s.stock[id] = { fresh: 0, old: 0 });
      st.fresh += n;
      portions += n;
      if (id === 'esteh') { const c = Math.round(n * 700 * s.inflation); this.money(-c, 'ingredients'); s.today.ingCost += c; }
    }
    // dishes taken off the menu: their leftovers still sell today (old)
    this.usedCap = this.effortOf(plan, nasi) + this.katUsed;
    s.today.portions += portions;
    s.totals.portions += portions;
  }

  /** cook an extra batch now (uses the day's spare capacity + market price) */
  cookExtra(id: string, n: number): string | null {
    const s = this.s, d = DISH[id];
    if (!d && id !== 'nasi') return 'Lauk nggak ada';
    if (s.tick >= DAY_TICKS - 4) return 'Udah mau tutup';
    const eff = id === 'nasi' ? n * 0.12 : n * d.effort;
    const spare = this.cookCap() - this.usedCap;
    if (eff > spare + 0.01) return 'Dapur udah kewalahan hari ini';
    const ing: Partial<Record<IngId, number>> = id === 'nasi' ? { beras: NASI.beras } : d.ing;
    let cost = id === 'esteh' ? n * 700 * s.inflation : 0;
    for (const [k, q] of Object.entries(ing)) { const want = (q ?? 0) * n; const miss = Math.max(0, want - s.pantry[k as IngId]); cost += miss * this.marketPrice(k as IngId) * 1.1; }
    cost = Math.round(cost);
    if (cost > s.money) return 'Uangnya kurang';
    for (const [k, q] of Object.entries(ing)) { const want = (q ?? 0) * n; const miss = Math.max(0, want - s.pantry[k as IngId]); s.pantry[k as IngId] += miss; s.pantry[k as IngId] -= want; if (s.pantry[k as IngId] < 0.0001) s.pantry[k as IngId] = 0; }
    if (cost) { this.money(-cost, 'ingredients'); s.today.ingCost += cost; }
    this.usedCap += eff;
    if (id === 'nasi') s.nasi += n; else { const st = s.stock[id] ?? (s.stock[id] = { fresh: 0, old: 0 }); st.fresh += n; }
    s.today.portions += n;
    return null;
  }

  // ------------------------------------------------------------ the day
  dailyTraffic() {
    const s = this.s, d = this.date;
    const st = this.stageInfo();
    const stars = this.stars();
    const appeal = 0.35 + (stars / 5) * 0.95;
    const fansF = 1 + Math.log10(1 + s.fans / 150) * 0.38;
    let decorT = 0; for (const id of s.decor) decorT += DECOR[id]?.traffic ?? 0;
    let promoT = 0; for (const p of s.promo) { const P = PROMOS.find((x) => x.id === p.id); if (P && !P.target) promoT += P.traffic; }
    const weekend = d.day >= 6 ? (s.stage === 1 ? mangkalDef(this).weekend : 0.9) : 1;
    const gajian = d.dom <= 5 ? 1.12 : 1 - 0.12 * this.tua();
    let ev = 1;
    for (const e of s.effects) if (e.until > s.absDay && (e.id === 'viral' || e.id === 'nobar' || e.id === 'jelek' || e.id === 'banjir')) ev *= e.v;
    return 125 * st.traffic * locTraffic(this) * appeal * fansF * (1 + decorT + promoT) * weekend * gajian * ev * trafficMul(this);
  }
  typeWeights(): [CustId, number][] {
    const s = this.s, mix = mixNow(this);
    const out: [CustId, number][] = [];
    for (const c of CUSTS) {
      let w = (mix[c.id] ?? 0.02) * typeMul(this, c.id);
      for (const p of s.promo) { const P = PROMOS.find((x) => x.id === p.id); if (P?.target === c.id) w *= 1.4; }
      for (const cid of s.activeCombos) { const cb = COMBOS.find((x) => x.id === cid); if (cb?.target === c.id && this.comboReady(cb.id)) w *= 1 + cb.bonus; }
      let steal = 0;
      for (const r of RIVALS) { const rs = s.rivals[r.id]; if (rs) steal += rs.strength * (r.steals[c.id] ?? 0) * 0.22 * (rs.cut > 0 ? 1.8 : 1); }
      w *= clamp(1 - steal, 0.35, 1);
      // menu fit: a type that finds nothing it likes comes less
      const menu = this.activeMenu();
      const likes = menu.filter((id) => DISH[id].tags.some((t) => c.likes.includes(t))).length;
      w *= 0.6 + Math.min(1, likes / 3) * 0.5;
      if (c.id === 'mhs' && this.date.month % 6 === 7 % 6 && this.date.week >= 3) w *= 0.7; // libur semester
      out.push([c.id, w]);
    }
    return out;
  }
  comboReady(id: string) { const cb = COMBOS.find((x) => x.id === id); return !!cb && cb.dishes.every((d) => this.totalStock(d) > 0); }

  simTick(t: number) {
    const s = this.s;
    if (this.effect('tutup')) return;
    // ramadan: daytime quiet, sahur + bukber busy
    const w = hourWeight(t) * hourMul(this, t);
    const daily = this.dailyTraffic() * (this.effect('padam') && t < 34 ? 0.5 : 1);
    this.spawnAcc += (daily * w) / DAY_TICKS;
    const tw = this.typeWeights();
    const tot = tw.reduce((a, b) => a + b[1], 0);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      let r = Math.random() * tot, type: CustId = tw[0][0];
      for (const [id, wt] of tw) { r -= wt; if (r <= 0) { type = id; break; } }
      this.arrive(type);
    }
    // v1.3: rain: passers-by shelter under the awning (may buy a drink / gorengan)
    if (this.hujan() && t < DAY_TICKS - 6 && Math.random() < 0.3 * this.stageInfo().traffic) this.arrive(pick(['mhs', 'ojol', 'buruh', 'kantor'] as CustId[]), true);
    // eating customers
    for (const c of this.customers) if (c.state === 'eat') { c.eatLeft--; if (c.eatLeft <= 0) { c.state = 'gone'; this.emit({ type: 'leave', c, reason: 'kenyang' }); } }
    // service: queue + ojol share the counter
    this.serveAcc += this.serveRate();
    const q = this.queue();
    for (const o of s.orders) {
      if (o.state === 'pickup') { this.finishOjol(o); continue; }
      if (o.state !== 'wait') continue;
      o.left--;
      if (this.serveAcc >= 0.7 && (q.length < 3 || Math.random() < 0.5)) { this.serveAcc -= 0.7; this.prepOjol(o); }
      else if (o.left <= 0) this.cancelOjol(o, 'Kelamaan');
    }
    for (const c of q) {
      if (this.serveAcc >= 1) { this.serveAcc -= 1; this.serve(c); continue; }
      c.wait++;
      s.today.waitSum += 1;
      if (c.wait > c.patience) { c.state = 'gone'; s.today.left++; c.mood = 0; this.emit({ type: 'leave', c, reason: 'lama' }); this.maybeReview(c, 'lama'); }
    }
    this.serveAcc = Math.min(this.serveAcc, 3);
    // ojol orders
    if (t < DAY_TICKS - 3) this.spawnOjol(t);
    busTick(this, t);
    this.customers = this.customers.filter((c) => c.state !== 'gone' || false);
  }

  arrive(type: CustId, neduh = false, group = false) {
    const s = this.s, T = CUST[type];
    s.today.customers++;
    s.today.byType[type] = (s.today.byType[type] ?? 0) + 1;
    const c: Customer = {
      id: s.custSeq++, type, state: 'queue', wait: 0,
      patience: T.patience + (this.hasR('sop_antri') ? 1 : 0) + (this.working().some((x) => x.traits.includes('ramah')) ? 1 : 0) + (this.has('tv') || this.has('ac') ? 0.5 : 0),
      dine: Math.random() < T.dine * (this.hujan() ? 0.7 : 1), seat: -1, eatLeft: 0, spent: 0, mood: 0.6, kasbon: false, name: pick(T.names),
    };
    if (group) {
      // v1.4 rombongan: the whole bus queues together, eats in, waits longer, never balks at the door
      c.group = true; c.dine = true; c.patience += 5;
      this.customers.push(c); this.emit({ type: 'arrive', c }); return;
    }
    if (neduh) {
      // sheltering from the rain: joins the line only when there is something cheap to grab, never counts as lost
      c.neduh = true; c.dine = false; c.patience = 3;
      if (this.queue().length > 4 || !this.snackPool(true).length || Math.random() < 0.45) { s.today.customers--; s.today.byType[type]!--; c.state = 'gone'; this.emit({ type: 'arrive', c }); this.emit({ type: 'leave', c, reason: 'kenyang' }); return; }
      this.customers.push(c); this.emit({ type: 'arrive', c }); return;
    }
    // too expensive for this budget today?
    const typical = this.nasiPrice() + this.dishPrice('orek') * 0.6 + this.dishPrice('telurbalado') * 0.6;
    const budget = T.budget * this.power() * s.inflation;
    if (typical > budget * 1.25 && Math.random() < 0.6 && !(s.kasbonPolicy > 0 && this.tua() > 0.5)) {
      s.today.balk++; c.state = 'gone'; this.emit({ type: 'arrive', c }); this.emit({ type: 'leave', c, reason: 'mahal' }); return;
    }
    const maxQ = 6 + Math.round(this.serveRate() * 1.5);
    if (this.queue().length >= maxQ) { s.today.balk++; c.state = 'gone'; this.emit({ type: 'arrive', c }); this.emit({ type: 'leave', c, reason: 'penuh' }); return; }
    this.customers.push(c);
    this.emit({ type: 'arrive', c });
  }

  takeStock(id: string): 'fresh' | 'old' | null {
    const st = this.s.stock[id];
    if (!st) return null;
    if (st.old >= 1) { st.old--; return 'old'; }
    if (st.fresh >= 1) { st.fresh--; return 'fresh'; }
    return null;
  }

  /** drinks / gorengan (neduh) or takjil (ngabuburit) a customer can grab without rice */
  snackPool(neduh: boolean) {
    return this.activeMenuWithStock().filter((id) => { const d = DISH[id]; return neduh ? (d.tags.includes('minum') || d.tags.includes('gorengan') || id === 'kerupuk') : d.tags.includes('takjil'); });
  }
  /** a quick snack sale (no rice, no seat) */
  serveSnack(c: Customer, pool: string[]) {
    const s = this.s;
    const got: string[] = [];
    const n = Math.random() < 0.4 ? 2 : 1;
    for (let i = 0; i < n && pool.length; i++) { const id = pick(pool.filter((x) => !got.includes(x))); if (!id) break; if (this.takeStock(id)) got.push(id); }
    if (!got.length) { c.state = 'gone'; this.emit({ type: 'leave', c, reason: 'kenyang' }); return; }
    let total = 0;
    for (const d of got) { total += this.dishPrice(d); s.today.sold[d] = (s.today.sold[d] ?? 0) + 1; if (DISH[d].unlock === 'takjil') s.stats2.takjilSold++; }
    this.money(total, 'revenue'); s.today.revenue += total; s.totals.revenue += total;
    s.today.served++; s.totals.customers++;
    if (c.neduh) s.stats2.neduh++;
    c.mood = 0.7; c.spent = total; c.state = 'gone'; c.dine = false;
    if (this.hujan()) s.stats2.hujanServed++;
    this.emit({ type: 'served', c, amount: total, dishes: got, kasbon: false });
    this.emit({ type: 'leave', c, reason: 'kenyang' });
  }

  serve(c: Customer) {
    const s = this.s, T = CUST[c.type];
    if (c.neduh) { this.serveSnack(c, this.snackPool(true)); return; }
    if (this.isRamadan()) {
      const h = 5 + s.tick / 4;
      const tj = this.snackPool(false);
      if (h >= 15.5 && h < 17.5 && tj.length && Math.random() < 0.6) { this.serveSnack(c, tj); return; }
    }
    if (s.nasi < 1) { c.state = 'gone'; s.today.habis++; this.emit({ type: 'leave', c, reason: 'habis' }); this.maybeReview(c, 'nasihabis'); return; }
    let budget = T.budget * this.power() * s.inflation * rnd(0.8, 1.25);
    // v1.4 prasmanan: people pile up their plate (a bit more per head)
    const pras = prasmananOn(this);
    if (pras) budget *= 1.14;
    if (c.group) budget *= 1.1;
    const kasbon = this.tua() > 0.45 && s.kasbonPolicy > 0 && Math.random() < T.kasbon * (s.kasbonPolicy === 2 ? 1.6 : 1) * (this.hasR('qris') ? 0.7 : 1);
    if (kasbon) budget *= 1.3;
    const avail = this.activeMenuWithStock().filter((id) => !DISH[id].tags.includes('minum') && !DISH[id].tags.includes('takjil'));
    if (!avail.length) { c.state = 'gone'; s.today.habis++; this.emit({ type: 'leave', c, reason: 'habis' }); this.maybeReview(c, 'habis'); return; }
    s.nasi--;
    let total = this.nasiPrice();
    const got: string[] = [];
    let liked = 0, old = 0;
    // combo package first
    const combo = s.activeCombos.map((id) => COMBOS.find((x) => x.id === id)!).find((cb) => cb && cb.target === c.type && this.comboReady(cb.id));
    if (combo && Math.random() < 0.65) {
      for (const d of combo.dishes) { const k = this.takeStock(d); if (k) { got.push(d); if (k === 'old') old++; total += Math.round(this.dishPrice(d) * 0.9); } }
      liked += 2;
    } else {
      const nWant = (budget > 26000 * s.inflation ? 3 : budget > 15000 * s.inflation ? 2 : 1) + (pras && Math.random() < 0.35 ? 1 : 0);
      for (let i = 0; i < nWant; i++) {
        const cand = avail.filter((id) => !got.includes(id) && this.totalStock(id) > 0 && total + this.dishPrice(id) <= budget * 1.1);
        if (!cand.length) break;
        const ws = cand.map((id) => {
          const d = DISH[id]; let w = 1;
          for (const t of d.tags) { if (T.likes.includes(t)) w += 1.3; if (T.dislikes.includes(t)) w *= 0.35; }
          if (this.tua() > 0.5 && d.tags.includes('murah')) w *= 1.5;
          if (this.hujan() && d.tags.includes('kuah')) w *= 1.5;
          if (s.weather === 'panas' && d.tags.includes('kuah')) w *= 0.7;
          if (d.tags.includes('gorengan')) w *= 1 + 0.5 * miniV(this, 'm_tempe');
          return w;
        });
        const sum = ws.reduce((a, b) => a + b, 0);
        let r = Math.random() * sum, ch = cand[0];
        for (let j = 0; j < cand.length; j++) { r -= ws[j]; if (r <= 0) { ch = cand[j]; break; } }
        const k = this.takeStock(ch);
        if (!k) continue;
        got.push(ch); total += this.dishPrice(ch);
        if (k === 'old') old++;
        if (DISH[ch].tags.some((t) => T.likes.includes(t))) liked++;
      }
    }
    if (!got.length) { // nothing affordable / in stock: plain rice + whatever, unhappy
      liked -= 1;
    }
    const teh = s.weather === 'panas' ? 0.85 : this.hujan() ? 0.3 : 0.5;
    if (this.totalStock('esteh') > 0 && Math.random() < teh && total + this.dishPrice('esteh') <= budget * 1.2) { this.takeStock('esteh'); got.push('esteh'); total += this.dishPrice('esteh'); }
    else if (s.weather === 'panas' && this.totalStock('esteh') <= 0 && s.unlocked.includes('esteh')) liked -= 1; // haus, es teh habis
    if (this.isRamadan() && s.tick >= 50) {
      // buka puasa: takjil on top
      for (const tj of this.snackPool(false)) if (Math.random() < 0.55 && total + this.dishPrice(tj) <= budget * 1.35) { this.takeStock(tj); got.push(tj); total += this.dishPrice(tj); s.stats2.takjilSold++; break; }
    }
    if (this.totalStock('kerupuk') > 0 && Math.random() < 0.45) { this.takeStock('kerupuk'); got.push('kerupuk'); total += this.dishPrice('kerupuk'); }
    for (const d of got) s.today.sold[d] = (s.today.sold[d] ?? 0) + 1;
    s.today.served++;
    s.totals.customers++;
    // mood
    const waitPen = (c.wait / Math.max(1, c.patience)) * 0.25;
    const pricePen = Math.max(0, total / budget - 0.9) * 0.6;
    const pedasBonus = got.some((d) => DISH[d]?.tags.includes('pedas')) ? 0.04 * miniV(this, 'm_sambal') : 0;
    // v1.4 Rumah Makan+: the food is brought to the table: enough waiters = happier guests
    const meja = s.stage >= 5 && c.dine ? (mejaCover(this) - 0.7) * 0.15 : 0;
    if (meja && c.dine) s.stats2.mejaServed++;
    if (c.group) s.stats2.busServed++;
    c.mood = clamp(0.42 + meja + pedasBonus + s.rasa / 260 + s.bersih / 600 + liked * 0.07 - old * 0.07 * (this.hasR('resep_awet') ? 0.4 : 1) - waitPen - pricePen + (got.length ? 0 : -0.2) + rnd(-0.08, 0.08), 0, 1);
    if (c.mood > 0.62) s.today.happy++;
    c.kasbon = kasbon;
    c.spent = total;
    if (this.hujan()) s.stats2.hujanServed++;
    if (kasbon) { s.kasbon.push({ type: c.type, amount: total, day: s.absDay }); s.today.kasbonGiven += total; s.stats2.kasbonGiven += total; }
    else { this.money(total, 'revenue'); s.today.revenue += total; s.totals.revenue += total; }
    // seat or bungkus
    if (c.dine && this.seatsUsed() < this.seats()) { c.state = 'eat'; c.seat = this.freeSeat(); c.eatLeft = 2 + (Math.random() < 0.4 ? 1 : 0); }
    else { c.state = 'gone'; c.dine = false; }
    this.emit({ type: 'served', c, amount: total, dishes: got, kasbon });
    if (c.state === 'gone') this.emit({ type: 'leave', c, reason: 'kenyang' });
    this.maybeReview(c, 'makan');
  }
  freeSeat() {
    const used = new Set(this.customers.filter((x) => x.state === 'eat').map((x) => x.seat));
    const n = this.seats();
    const free: number[] = [];
    for (let i = 0; i < n; i++) if (!used.has(i)) free.push(i);
    return free.length ? pick(free) : 0;
  }
  activeMenuWithStock() { return Object.keys(this.s.stock).filter((id) => this.totalStock(id) > 0 && DISH[id]); }

  // ------------------------------------------------------------ ojol
  spawnOjol(t: number) {
    const s = this.s;
    for (const app of OJOL_APPS) {
      const a = s.apps[app.id];
      if (!a?.joined) continue;
      const h = 5 + t / 4;
      const hw = h >= 10.5 && h < 13.5 ? 2.2 : h >= 17 && h < 20.5 ? 2 : h >= 7 && h < 9 ? 1 : 0.35;
      const rate = 0.05 * app.volume * hw * (this.hujan() ? 1.7 : this.isRainy() ? 1.1 : 1) * (hasPerk(this, 'ojol') ? 1.2 : 1) * (a.promo ? 1.8 : 1) * (a.rating / 5) * (0.6 + this.s.stage * 0.25) * (0.6 + this.stars() / 6) * (this.effect('banjir') ? 1.6 : 1);
      if (Math.random() < rate) {
        const avail = this.activeMenuWithStock().filter((id) => !DISH[id].tags.includes('minum') && !DISH[id].tags.includes('takjil'));
        if (!avail.length) continue;
        const n = irnd(1, 3);
        const items: string[] = [];
        for (let i = 0; i < n; i++) { const d = pick(avail); if (!items.includes(d)) items.push(d); }
        const total = this.nasiPrice() + items.reduce((x, d) => x + this.dishPrice(d), 0);
        const o: OjolOrder = { id: s.orderSeq++, app: app.id, name: pick(['Kak Ria', 'Mas Dika', 'Bu Hana', 'Kak Jessi', 'Pak Rudi', 'Mbak Fitri', 'Kak Bagas', 'Dek Nisa']), items, total, left: 4, state: 'wait' };
        s.orders.push(o);
        if (s.orders.length > 14) s.orders = s.orders.filter((x) => x.state === 'wait' || x.state === 'pickup').slice(-14);
        this.emit({ type: 'ojolNew', o });
      }
    }
  }
  prepOjol(o: OjolOrder) {
    const s = this.s;
    if (s.nasi < 1 || !o.items.every((d) => this.totalStock(d) > 0)) { this.cancelOjol(o, 'Stok habis'); return; }
    s.nasi--;
    for (const d of o.items) { this.takeStock(d); s.today.sold[d] = (s.today.sold[d] ?? 0) + 1; }
    o.state = 'pickup';
    this.emit({ type: 'ojolPickup', o });
  }
  finishOjol(o: OjolOrder) {
    const s = this.s, app = OJOL_APPS.find((a) => a.id === o.app)!;
    const a = s.apps[o.app];
    const fee = Math.round(o.total * (app.commission + (a.promo ? 0.08 : 0)));
    const net = o.total - fee;
    this.money(o.total, 'revenue'); this.money(-fee, 'ojolFee');
    s.today.ojolRev += o.total; s.today.ojolCommission += fee; s.today.ojolDone++;
    s.totals.revenue += o.total;
    a.rating = clamp(a.rating + 0.004 + (s.rasa - 50) / 8000, 1, 5);
    o.state = 'done';
    this.emit({ type: 'ojolDone', o, amount: net });
  }
  cancelOjol(o: OjolOrder, _why: string) {
    const s = this.s;
    o.state = 'batal';
    s.today.ojolBatal++;
    s.apps[o.app].rating = clamp(s.apps[o.app].rating - 0.04, 1, 5);
    this.emit({ type: 'ojolBatal', o });
  }

  // ------------------------------------------------------------ reviews
  maybeReview(c: Customer, why: 'lama' | 'habis' | 'nasihabis' | 'makan', force = false) {
    const chance = why === 'makan' ? 0.035 : 0.12;
    if (!force && Math.random() > chance) return;
    const stars = why === 'makan' ? clamp(Math.round(1 + c.mood * 4.4), 1, 5) : 1;
    const T = CUST[c.type];
    const L: Record<string, string[]> = {
      lama: ['Antrinya kelamaan, keburu masuk kerja lagi.', 'Nunggu 20 menit nggak dilayani. Pindah ke sebelah deh.', 'Pelayannya kurang, antre sampai jalan.'],
      habis: ['Datang jam segini lauknya udah habis semua...', 'Etalase kosong melompong. Masak yang banyak dong!'],
      nasihabis: ['Nasinya habis?! Warteg kok kehabisan nasi.', 'Lauk ada, nasi nggak ada. Gimana sih.'],
    };
    const good: Record<CustId, string[]> = {
      buruh: ['Porsinya mantap, kenyang sampai sore!', 'Murah, pedes, nasi munjung. Langganan!', 'Pas buat tenaga ngangkut karung.'],
      mhs: ['Ramah di kantong mahasiswa. Top!', 'Orek tempenya juara, akhir bulan selamat.', 'Bisa nambah kuah gratis, terharu.'],
      kantor: ['Rasanya kayak masakan ibu. Enak!', 'Bersih, cepat, cocok buat makan siang kantor.', 'Rendangnya lembut. Besok ajak tim.'],
      ojol: ['Bungkusnya cepet, langsung narik lagi.', 'Murah meriah, cocok buat driver.', 'Es tehnya seger banget pas panas.'],
      mandor: ['Traktir anak buah di sini, semua puas.', 'Lauknya banyak pilihan, mantap.', 'Harganya masuk, rasanya juragan.'],
      ibu: ['Sayurnya seger, nggak keasinan.', 'Libur masak, beli lauk di sini aja.', 'Bersih dan ramah, ibu suka.'],
    };
    const mid = ['Lumayan lah buat ganjel perut.', 'Biasa aja, tapi harganya oke.', 'Enak sih, tapi agak lama.', 'Nasi anget, lauk standar.'];
    const bad = ['Lauknya kayak sisa kemarin, agak asem.', 'Kemahalan buat porsi segini.', 'Mejanya lengket, kurang bersih.', 'Rasanya hambar, kurang garam.'];
    let text: string;
    if (why !== 'makan') text = pick(L[why]);
    else if (stars >= 4) text = pick(good[c.type]);
    else if (stars === 3) text = pick(mid);
    else text = pick(bad);
    this.addReview({ name: `${c.name}`, type: c.type, stars, text: `${text}` });
    void T;
  }
  addReview(r: Omit<Review, 'id' | 'day'>) {
    const s = this.s;
    const rv: Review = { ...r, id: ++s.reviewSeq, day: s.absDay };
    s.reviews.push(rv);
    if (s.reviews.length > 50) s.reviews.splice(0, s.reviews.length - 50);
    this.emit({ type: 'review', r: rv });
    if (r.type !== 'sistem' && r.type !== 'vlog' && r.type !== 'dinkes') onReview(this, r.stars);
  }

  // ------------------------------------------------------------ evening
  endDay() {
    const s = this.s;
    const T = s.today;
    // leftovers
    let waste = 0;
    for (const [id, st] of Object.entries(s.stock)) {
      const d = DISH[id]; if (!d) { delete s.stock[id]; continue; }
      const unit = Object.entries(d.ing).reduce((a, [ing, q]) => a + (q ?? 0) * s.prices[ing as IngId], 0) + (id === 'esteh' ? 700 : 0);
      waste += st.old * unit;
      // v1.4: an open buffet leaves more food that can't be kept (prasmanan), a kepala dapur keeps more of it
      const keep = (prasmananOn(this) ? 0.78 : 0.9) + (this.byRole('kepala').length ? 0.04 : 0);
      if (s.sisaPolicy === 'panas' && id !== 'esteh') { st.old = Math.floor(st.fresh * Math.min(0.95, keep)); waste += (st.fresh - st.old) * unit; }
      else { waste += st.fresh * unit; st.old = 0; }
      st.fresh = 0;
      if (!st.old) delete s.stock[id];
    }
    T.waste = Math.round(waste);
    const oldShare = Object.values(s.stock).reduce((a, x) => a + x.old, 0) / Math.max(1, T.portions);
    // ratings drift toward today's targets
    const cooks = this.byRole('masak');
    const cookQ = cooks.length ? cooks.reduce((a, c) => a + c.skill * 0.42 + c.level * 1.6 + (c.traits.includes('jagosambal') ? 4 : 0), 0) / cooks.length : 8;
    let dr = 0, db = 0, ds = 0;
    for (const id of s.decor) { const D = DECOR[id]; if (D) { dr += D.rasa; db += D.bersih; ds += D.suasana; } }
    if (prasmananOn(this)) s.stats2.prasmananDays++;
    const rasaT = clamp(24 + cookQ + kepalaRasa(this) + dr * 0.8 + (this.hasR('resep_bumbu') ? 6 : 0) + (this.hasR('resep_pedas') ? 3 : 0) - oldShare * 30 * (this.hasR('resep_awet') ? 0.4 : 1) + s.activeCombos.length * 1.5 + 6 * miniV(this, 'm_sambal'), 0, 100);
    const pel = this.byRole('pelayan');
    const avgE = s.staff.length ? s.staff.reduce((a, b) => a + b.energy, 0) / s.staff.length : 80;
    const bersihT = clamp(30 + Math.min(32, pel.reduce((a, p) => a + 8 + p.skill * 0.14, 0)) + db * 0.6 - oldShare * 25 - (avgE < 40 ? 10 : 0) + (this.effect('lolos') ? 12 : 0) - (this.effect('tikus') ? 15 : 0) + Math.min(4, s.stage) * 2 + Math.max(0, s.stage - 4) * 1 - (prasmananOn(this) && pel.length < 2 ? 8 : 0), 0, 100);
    const typical = this.nasiPrice() + this.dishPrice('orek') + this.dishPrice('telurbalado') * 0.5;
    const locBudget = Object.entries(mixNow(this)).reduce((a, [t, w]) => a + CUST[t as CustId].budget * (w ?? 0), 0) * s.inflation * this.power();
    const murahT = clamp(110 - (typical / locBudget) * 95 + (this.promoOn('gajian') ? 10 : 0), 5, 100);
    const lost = T.left + T.balk + T.habis;
    const avgWait = T.waitSum / Math.max(1, T.served + T.left);
    const antrianT = clamp(100 - (lost / Math.max(1, T.customers)) * 160 - avgWait * 9 - (s.stage >= 5 ? (1 - mejaCover(this)) * 18 : 0), 0, 100);
    const suasanaT = clamp(8 + ds * 0.85 + Math.min(4, s.stage) * 5 + Math.max(0, s.stage - 4) * 3 + (s.franchise ? 5 : 0) + (sinkLv(this, 'ruko') ? 5 : 0) + sinkLv(this, 'kampung'), 0, 100);
    const before = this.stars();
    const k = 0.22;
    s.rasa += (rasaT - s.rasa) * k; s.bersih += (bersihT - s.bersih) * k; s.murah += (murahT - s.murah) * k; s.antrian += (antrianT - s.antrian) * k; s.suasana += (suasanaT - s.suasana) * k;
    const stars = this.stars();
    s.totals.maxStars = Math.max(s.totals.maxStars, stars);
    // fans + poin
    const fansBefore = s.fans;
    s.fans = Math.max(0, Math.round(s.fans * 0.997 + T.happy * 0.1 * (0.6 + stars / 5) - lost * 0.05 + T.ojolDone * 0.05));
    const poin = Math.round(T.served / 22 + T.happy / 35 + T.ojolDone / 10);
    s.poin += poin;
    dailySocial(this);
    nightCheck(this);
    // staff: energy, exp, level
    for (const st of s.staff) {
      if (st.off) { st.energy = Math.min(100, st.energy + 30); continue; }
      const load = 10 + (T.served / Math.max(1, s.staff.length)) * 0.06 + (s.stage * 1.5);
      st.energy = clamp(st.energy - load * (st.traits.includes('rajin') ? 0.6 : 1) + 22, 5, 100);
      if (st.energy < 20 && !st.off) { st.off = 1; this.toast(`${st.name} kecapekan, libur besok.`); if (st.traits.includes('baper')) st.loyalty -= 6; }
      st.exp += 6 + T.served / 60;
      while (st.exp >= expNeed(st.level) && st.level < 10) {
        st.exp -= expNeed(st.level); st.level++;
        st.skill = Math.min(100, st.skill + irnd(3, 6)); st.speed = Math.min(100, st.speed + irnd(2, 4));
        this.emit({ type: 'levelUp', st });
      }
    }
    // P&L
    const overhead = Math.round(this.monthlyCosts() / DAYS_PER_MONTH);
    const ojolNet = T.ojolRev - T.ojolCommission;
    const profit = T.revenue + ojolNet - T.ingCost - overhead + T.kasbonBack + T.other;
    s.totals.profit += profit;
    s.totals.bestDay = Math.max(s.totals.bestDay, T.revenue + T.ojolRev);
    s.history.push({ day: s.absDay, profit, customers: T.customers, stars });
    if (s.history.length > 28) s.history.splice(0, s.history.length - 28);
    const best = Object.entries(T.sold).filter(([d]) => d !== 'esteh' && d !== 'kerupuk').sort((a, b) => b[1] - a[1])[0];
    const report: DayReport = {
      day: s.absDay, customers: T.customers, served: T.served, lost, revenue: T.revenue + T.ojolRev, ojolNet, ingCost: T.ingCost, overhead, profit, waste: T.waste,
      kasbon: T.kasbonGiven, stars, deltaStars: stars - before, fans: s.fans - fansBefore, best: best ? DISH[best[0]].name : '-', ojolDone: T.ojolDone, ojolBatal: T.ojolBatal, poin, byType: T.byType,
    };
    // daily system review
    if (T.customers > 0 && Math.random() < 0.6) {
      const c: Customer = { id: 0, type: pick(Object.keys(T.byType) as CustId[]) ?? 'buruh', state: 'gone', wait: 0, patience: 4, dine: true, seat: -1, eatLeft: 0, spent: 0, mood: clamp(stars / 5 + rnd(-0.15, 0.15), 0, 1), kasbon: false, name: '' };
      c.name = pick(CUST[c.type].names);
      if (Math.random() < 0.5) this.maybeReview(c, 'makan', true);
    }
    s.yesterday = T;
    s.tick = DAY_TICKS;
    for (const c of this.customers) c.state = 'gone';
    this.customers = [];
    this.emit({ type: 'dayEnd', report });
    // advance date
    s.absDay++;
    s.tick = 0;
    this.checkStageHints();
    for (const id of checkAchievements(this)) this.emit({ type: 'achievement', id });
    if (dateOf(s.absDay).year > END_YEAR && !s.ended) { s.ended = true; this.emit({ type: 'ending' }); }
  }

  // ------------------------------------------------------------ calendar
  weekStart() {
    const s = this.s;
    const rain = this.isRainy(), ram = this.isRamadan() || this.isLebaranWeek();
    for (const i of INGS) {
      const base0 = i.base * s.inflation * (i.id === 'cabai' && rain ? 1.5 : 1) * (ram && (i.id === 'ayam' || i.id === 'daging' || i.id === 'telur') ? 1.2 : 1) * (this.effect('bbm') ? 1.1 : 1);
      const base = base0 * shockMult(this, i.id);
      const cur = s.prices[i.id];
      const next = cur + (base - cur) * 0.4 + cur * i.vol * (Math.random() * 2 - 1) * 1.2;
      s.prices[i.id] = Math.round(clamp(next, base0 * 0.5, base0 * 2.6) / 100) * 100;
      const h = s.priceHist[i.id]; h.push(s.prices[i.id]); if (h.length > 12) h.splice(0, h.length - 12);
    }
    weeklyMarket(this);
    // recruit pool
    const roles: RoleId[] = ['masak', 'kasir', 'pelayan', 'belanja'];
    // v1.4: the bigger warung attracts the new roles too (one slot rotates through them)
    const extra = (['shift', 'kepala', 'manajer'] as RoleId[]).filter((r) => !canHireRole(this, r));
    if (extra.length) roles.push(extra[Math.floor(Math.random() * extra.length)]);
    if (s.stage >= 5) roles.push(Math.random() < 0.5 ? 'pelayan' : 'masak');
    const q = 0.9 + Math.min(4, s.stage) * 0.12 + Math.max(0, s.stage - 4) * 0.06 + Math.min(0.5, s.fans / 20000);
    s.candidates = [];
    const n = roles.length;
    for (let i = 0; i < n; i++) { const st = makeStaff(s, i < roles.length ? roles[i] : pick(roles), q * rnd(0.85, 1.25)); st.salary = Math.round((st.salary * s.inflation) / 50000) * 50000; s.candidates.push(st); }
    // rivals
    for (const r of RIVALS) {
      if (!s.rivals[r.id] && this.date.year >= r.fromYear && Math.random() < 0.25) {
        s.rivals[r.id] = { strength: 0.3, cut: 0, met: false };
        this.queueChoice({ id: 'rivalBaru', title: 'SAINGAN BARU!', text: `${r.name} (${r.kind}) buka dekat warungmu.\n${r.desc}`, choices: [{ label: 'Siap bersaing!', act: 'ok' }], data: { rival: r.id } });
      }
      const rs = s.rivals[r.id];
      if (!rs) continue;
      if (rs.cut > 0) rs.cut = Math.max(0, rs.cut - 7);
      const target = 0.25 + Math.min(0.55, this.stars() / 10 + s.stage * 0.04);
      rs.strength = clamp(rs.strength + (target - rs.strength) * 0.15 + rnd(-0.02, 0.02), 0.1, 0.9);
    }
    // cabang weekly profit, national outlets' royalties
    this.cabangWeek();
    outletsWeek(this);
    // staff loyalty: underpaid or exhausted staff may quit
    const bs = sinkLv(this, 'beasiswa');
    for (const st of [...s.staff]) {
      if (st.loyalty < 25 && Math.random() < 0.3 && s.staff.length > 1) {
        this.toast(`${st.name} resign! Nggak betah katanya.`);
        staffLeaves(this, st, 'resign');
      } else {
        // v1.3: loyalty drifts with energy and pay; it settles around 80 on its own (raises, THR, beasiswa push it higher)
        const under = st.salary < ROLES[st.role].base * s.inflation * 0.9 ? 1 : 0;
        const d = (st.energy > 60 ? 1 : -1) - under + bs * 0.5 - (st.loyalty > 82 ? 0.8 : 0);
        st.loyalty = clamp(Math.max(st.loyalty + d, bs ? 25 + bs * 5 : 0), 0, 100);
      }
    }
  }

  monthStart() {
    const s = this.s, d = this.date;
    if (d.month === 1 && d.year > 1) {
      s.inflation *= 1.05;
      s.ledger[d.year] = s.ledger[d.year] ?? emptyLedger();
      this.toast('Tahun baru! Harga-harga naik 5%.');
      yearlyCommitments(this);
    }
    // salaries, rent, upkeep
    const sal = this.monthlySalaries(), rent = this.monthlyRent(), up = this.monthlyUpkeep();
    this.money(-sal, 'salaries'); this.money(-rent, 'rent'); if (up) this.money(-up, 'other');
    // v1.4 national outlets: brand support / rent share every month; now and then a mitra asks to join
    const ou = Math.round(outletUpkeep(this));
    if (ou) this.money(-ou, 'other');
    if (s.franchise && s.outlets.length < 10 && Math.random() < 0.25) offerMitra(this);
    yearlyTax(this);
    // interest on debt
    if (s.money < 0) this.money(Math.round(s.money * 0.03), 'other');
    this.toast(`Gajian! Bayar gaji ${fmtShort(sal)} + sewa ${fmtShort(rent)}. Pelanggan lagi punya duit.`);
    // kasbon repayments
    let back = 0, lost = 0;
    const keep: typeof s.kasbon = [];
    for (const k of s.kasbon) {
      const T = CUST[k.type];
      const kasirJujur = this.byRole('kasir').some((x) => x.traits.includes('jujur'));
      if (Math.random() < T.kabur * (kasirJujur ? 0.6 : 1) * (s.kasbonPolicy === 2 ? 1.3 : 1)) { lost += k.amount; continue; }
      if (Math.random() < 0.85) back += k.amount; else keep.push(k);
    }
    s.kasbon = keep.filter((k) => s.absDay - k.day < 90);
    if (back) { this.money(back, 'revenue'); s.today.kasbonBack += back; this.toast(`Kasbon dibayar: +${fmtShort(back)}`); }
    if (lost) { s.totals.kasbonLost += lost; this.toast(`${fmtShort(lost)} kasbon nggak balik. Ngilang orangnya...`); }
    // bankruptcy check
    const mc = this.monthlyCosts();
    if (s.money < -Math.max(10000000, mc * 3)) {
      s.debtMonths++;
      if (s.debtMonths >= 3) { s.bankrupt = true; this.emit({ type: 'bankrupt' }); return; }
      this.queueChoice({ id: 'utang', title: 'UTANG MENUMPUK', text: `Kas minus ${fmtShort(-s.money)}. Kalau ${3 - s.debtMonths} bulan lagi masih begini, warung disita!\nKurangi staf, masak secukupnya, atau naikkan harga.`, choices: [{ label: 'Siap, bakal berhemat', act: 'ok' }] });
    } else s.debtMonths = 0;
    if (d.month === 12) {
      const c = commitmentsPerYear(this), tx = taxEstimate(this);
      if (c || tx) this.toast(`Siap-siap: Januari ada ${[c ? `iuran sponsor + beasiswa ${fmtShort(c)}` : '', tx ? `pajak ± ${fmtShort(tx)}` : ''].filter(Boolean).join(' + ')}. Sisihkan kas!`);
    }
    // THR one week before lebaran is handled in rollEvents
    if (d.month === ramadanMonth(d.year)) this.toast('Ramadan tiba! Siang sepi, sahur & bukber ramai.');
  }

  cabangWeek() {
    const s = this.s;
    let sum = 0;
    for (const c of s.cabang) {
      const L = LOC[c.loc];
      const menu = this.activeMenu();
      let fit = 0;
      for (const [t, w] of Object.entries(L.mix)) { const T = CUST[t as CustId]; const likes = menu.filter((id) => DISH[id].tags.some((g) => T.likes.includes(g))).length; fit += (w ?? 0) * Math.min(1, likes / 3); }
      const mgr = managerAt(this, 'cab:' + c.loc);
      c.rating = clamp(c.rating + ((this.stars() * 0.85 + c.lv * 0.25 + (mgr ? 0.25 : 0)) - c.rating) * 0.2, 0.5, 5);
      const cust = 80 * L.traffic * (0.6 + c.lv * 0.25) * (0.35 + c.rating / 5) * (0.6 + fit * 0.6) * 7 * (this.isRamadan() && c.loc === 'masjid' ? 1.4 : 1);
      const rev = cust * 15000 * s.inflation;
      const gp = rev * (0.14 + c.lv * 0.025) * cabangMgrMul(this, c.loc);
      const profit = Math.round(gp - (L.rent * s.inflation) / 4 - (3500000 + c.lv * 1500000) * s.inflation / 4);
      c.lastWeek = profit; c.total += profit; sum += profit;
    }
    if (s.cabang.length) {
      this.money(sum, sum >= 0 ? 'revenue' : 'other');
      if (sum !== 0) this.toast(`Setoran ${s.cabang.length} cabang minggu ini: ${sum >= 0 ? '+' : ''}${fmtShort(sum)}`);
    }
  }

  // ------------------------------------------------------------ player actions
  setMenu(id: string, n: number) { this.s.menu[id] = clamp(Math.round(n), 0, 300); if (!this.s.menu[id]) delete this.s.menu[id]; }
  buy(ing: IngId, kg: number): string | null {
    const c = Math.round(kg * this.marketPrice(ing));
    if (c > this.s.money) return 'Uangnya kurang';
    const cap = gudangCap(this);
    if (pantryKg(this) + kg > cap + 0.01) return `Gudang penuh (maks ${cap} kg)`;
    if (this.s.prices[ing] <= INGS.find((i) => i.id === ing)!.base * this.s.inflation * 0.85) this.s.stats2.borong += kg;
    this.money(-c, 'ingredients'); this.s.today.ingCost += c; this.s.pantry[ing] += kg;
    return null;
  }
  hire(st: Staff): string | null {
    const s = this.s;
    if (s.staff.length >= this.stageInfo().staffMax) return `Maksimal ${this.stageInfo().staffMax} staf di ${this.stageInfo().name}`;
    const rh = canHireRole(this, st.role); if (rh) return rh;
    if (st.role === 'kepala' && s.staff.some((x) => x.role === 'kepala')) return 'Kepala dapur cukup satu';
    const fee = Math.round(st.salary * 0.5);
    if (fee > s.money) return 'Uang buat ongkos rekrut kurang';
    this.money(-fee, 'other');
    st.hiredDay = s.absDay;
    s.staff.push(st);
    s.candidates = s.candidates.filter((x) => x !== st);
    this.emit({ type: 'staffChange' });
    return null;
  }
  fire(st: Staff) {
    const s = this.s;
    const pesangon = st.salary;
    this.money(-pesangon, 'salaries');
    staffLeaves(this, st, 'fired');
    for (const o of s.staff) o.loyalty = clamp(o.loyalty - 4, 0, 100);
  }
  trainCost(st: Staff) { return Math.round((400000 + st.level * 250000) * this.s.inflation); }
  train(st: Staff): string | null {
    const c = this.trainCost(st), p = 4 + st.level * 2;
    if (c > this.s.money) return 'Uangnya kurang';
    if (p > this.s.poin) return `Butuh ${p} Poin Warung`;
    this.money(-c, 'other'); this.s.poin -= p;
    st.skill = Math.min(100, st.skill + irnd(4, 7)); st.speed = Math.min(100, st.speed + irnd(2, 5)); st.exp += 40; st.energy = Math.max(10, st.energy - 15);
    st.loyalty = clamp(st.loyalty + 5, 0, 100);
    return null;
  }
  raise(st: Staff) { st.salary = Math.round((st.salary * 1.1) / 50000) * 50000; st.loyalty = clamp(st.loyalty + 15, 0, 100); }
  rest(st: Staff) { st.off = 2; }
  buyDecor(id: string): string | null {
    const D = DECOR[id];
    if (!D || this.has(id)) return 'Sudah punya';
    if (this.s.stage < D.stage) return `Butuh ${STAGES[D.stage - 1].name}`;
    const c = Math.round(D.cost * this.s.inflation);
    if (c > this.s.money) return 'Uangnya kurang';
    this.money(-c, 'investment'); this.s.decor.push(id);
    this.emit({ type: 'decor' });
    return null;
  }
  upgradeCheck(): string | null {
    const s = this.s, n = STAGES[s.stage];
    if (!n) return 'Udah paling besar';
    if (this.stars() < n.needStars) return `Butuh rating ${n.needStars.toFixed(1)}★`;
    if (s.fans < n.needFans) return `Butuh ${n.needFans} fans`;
    if (s.money < Math.round(n.cost * s.inflation)) return `Butuh ${fmtShort(Math.round(n.cost * s.inflation))}`;
    return null;
  }
  upgradeStage(): string | null {
    const err = this.upgradeCheck();
    if (err) return err;
    const s = this.s, n = STAGES[s.stage];
    this.money(-Math.round(n.cost * s.inflation), 'investment');
    s.stage++;
    s.suasana = Math.min(100, s.suasana + 10);
    if (s.stage === 5) hint(this, 'rumahmakan');
    if (s.stage === 6) hint(this, 'restoran');
    if (s.stage >= 4) hint(this, 'kepala');
    this.emit({ type: 'stage' });
    return null;
  }
  startResearch(id: string): string | null {
    const s = this.s;
    if (s.research) return 'Masih ada riset yang jalan';
    const d = DISH[id], u = UPGRADES.find((x) => x.id === id);
    const poin = d ? d.poin ?? 10 : u ? u.poin : 0, days = d ? d.days ?? 2 : u ? u.days : 1;
    if (!d && !u) return 'Nggak ada';
    if (s.unlocked.includes(id) || s.researched.includes(id)) return 'Sudah dikuasai';
    if (d?.stage && s.stage < d.stage) return `Resep ini butuh ${STAGES[d.stage - 1].name}`;
    if (poin > s.poin) return `Butuh ${poin} Poin Warung`;
    s.poin -= poin;
    s.research = { id, left: days };
    return null;
  }
  finishResearch(id: string) {
    const s = this.s;
    s.research = null;
    const d = DISH[id];
    if (d) { s.unlocked.push(id); s.researched.push(id); this.emit({ type: 'research', name: d.name }); this.toast(`Resep baru: ${d.name}! Masukkan ke menu di Masak.`); }
    else { const u = UPGRADES.find((x) => x.id === id); if (u) { s.researched.push(id); this.emit({ type: 'research', name: u.name }); this.toast(`Riset selesai: ${u.name}!`); } }
  }
  comboCost() { return 8 + this.s.comboTried.length; }
  /** try a 3-lauk combination: returns the found combo or a hint */
  tryCombo(ids: string[]): { found?: string; hint: string; score: number } | string {
    const s = this.s;
    if (ids.length !== 3 || new Set(ids).size !== 3) return 'Pilih 3 lauk berbeda';
    const key = [...ids].sort().join('+');
    if (s.comboTried.includes(key)) return 'Kombinasi ini sudah pernah dicoba';
    const c = this.comboCost();
    if (c > s.poin) return `Butuh ${c} Poin Warung`;
    s.poin -= c;
    s.comboTried.push(key);
    let bestN = 0, best = COMBOS[0];
    for (const cb of COMBOS) { const n = cb.dishes.filter((d) => ids.includes(d)).length; if (n > bestN) { bestN = n; best = cb; } }
    if (bestN === 3 && !s.combos.includes(best.id)) {
      s.combos.push(best.id);
      if (s.activeCombos.length < this.comboSlots()) s.activeCombos.push(best.id);
      return { found: best.id, hint: `${best.name} ditemukan! ${best.desc}`, score: 100 };
    }
    if (bestN === 3) return { hint: 'Ini paket yang sudah kamu punya.', score: 100 };
    // per-type hint from tags
    const tagScore: [CustId, number][] = CUSTS.map((T) => [T.id, ids.reduce((a, id) => a + DISH[id].tags.filter((t) => T.likes.includes(t)).length - DISH[id].tags.filter((t) => T.dislikes.includes(t)).length, 0)]);
    tagScore.sort((a, b) => b[1] - a[1]);
    const fav = CUST[tagScore[0][0]].name;
    const hint = bestN === 2 ? `Hampir! 2 dari 3 lauk cocok buat ${CUST[best.target].name}. Ganti satu lagi...` : `Kurang nendang. Kayaknya ${fav} bakal suka arah ini.`;
    return { hint, score: bestN === 2 ? 66 : 20 + tagScore[0][1] * 5 };
  }
  comboSlots() { return 1 + Math.min(3, this.s.stage - 1 + (this.s.franchise ? 1 : 0)); }
  startPromo(id: string): string | null {
    const P = PROMOS.find((p) => p.id === id);
    if (!P) return 'Nggak ada';
    if (this.promoOn(id)) return 'Promo ini masih jalan';
    if (this.s.stage < P.stage) return `Butuh ${STAGES[P.stage - 1].name}`;
    const c = Math.round(P.cost * this.s.inflation);
    if (c > this.s.money) return 'Uangnya kurang';
    if (c) this.money(-c, 'other');
    this.s.promo.push({ id, left: P.days });
    if (id === 'selebgram') { const gain = Math.round(this.s.rasa > 60 ? 600 + this.s.fans * 0.15 : 150); this.s.fans += gain; this.toast(`Selebgram posting! Fans +${gain}`); }
    return null;
  }
  joinApp(id: string): string | null {
    const app = OJOL_APPS.find((a) => a.id === id)!;
    const a = this.s.apps[id];
    if (a.joined) return 'Sudah gabung';
    const c = Math.round(app.fee * this.s.inflation);
    if (c > this.s.money) return 'Uangnya kurang';
    this.money(-c, 'other'); a.joined = true;
    return null;
  }
  cabangCost(locId: string) { return Math.round(LOC[locId].cost * this.s.inflation); }
  openCabang(locId: string): string | null {
    const s = this.s, L = LOC[locId];
    if (!L || locId === s.loc) return 'Ini lokasi warung utama';
    if (s.cabang.some((c) => c.loc === locId)) return 'Sudah ada cabang di sini';
    if (s.stage < 3) return 'Buka cabang mulai dari level Warteg';
    const maxCab = s.franchise ? 7 : s.stage >= 4 ? 4 : 2;
    if (s.cabang.length >= maxCab) return `Maksimal ${maxCab} cabang di level ini${s.franchise ? '' : s.stage >= 4 ? ' (franchise buka semua)' : ' (Warteg Besar: 4)'}`;
    if (this.date.year < L.unlockYear) return `Lokasi ini terbuka tahun ${L.unlockYear}`;
    const c = this.cabangCost(locId);
    if (c > s.money) return `Butuh ${fmtShort(c)}`;
    this.money(-c, 'investment');
    s.cabang.push({ loc: locId, lv: 1, opened: s.absDay, rating: Math.max(1.5, this.stars() * 0.8), lastWeek: 0, total: 0 });
    this.emit({ type: 'stage' });
    return null;
  }
  renovCost(c: { lv: number; loc: string }) { return Math.round(LOC[c.loc].cost * 0.5 * c.lv * this.s.inflation); }
  renovCabang(locId: string): string | null {
    const c = this.s.cabang.find((x) => x.loc === locId);
    if (!c) return 'Belum ada cabang';
    if (c.lv >= 4) return 'Sudah maksimal';
    const cost = this.renovCost(c);
    if (cost > this.s.money) return `Butuh ${fmtShort(cost)}`;
    this.money(-cost, 'investment'); c.lv++;
    return null;
  }
  /** close a cabang: the lease and the equipment are sold back for 40% of what was put in */
  closeCabang(locId: string): number {
    const s = this.s, c = s.cabang.find((x) => x.loc === locId);
    if (!c) return 0;
    let put = this.cabangCost(locId); for (let lv = 1; lv < c.lv; lv++) put += Math.round(LOC[locId].cost * 0.5 * lv * s.inflation);
    const back = Math.round(put * 0.4);
    this.money(back, 'revenue');
    s.cabang = s.cabang.filter((x) => x !== c);
    clearAssign(this, 'cab:' + locId);
    this.emit({ type: 'stage' });
    return back;
  }
  franchiseCheck(): string | null {
    const s = this.s;
    if (s.franchise) return 'Sudah franchise';
    if (s.stage < 4) return 'Butuh Warteg Besar';
    if (s.cabang.length < FRANCHISE.needCabang) return `Butuh ${FRANCHISE.needCabang} cabang`;
    if (this.stars() < FRANCHISE.needStars) return `Butuh rating ${FRANCHISE.needStars.toFixed(1)}★`;
    const c = Math.round(FRANCHISE.cost * s.inflation);
    if (c > s.money) return `Butuh ${fmtShort(c)}`;
    return null;
  }
  /** v1.4: starting the franchise names the brand; national outlets open from PETA > Nasional */
  startFranchise(brand?: string): string | null {
    const e = this.franchiseCheck(); if (e) return e;
    if (brand !== undefined) { const be = setBrand(this, brand); if (be) return be; }
    this.money(-Math.round(FRANCHISE.cost * this.s.inflation), 'investment');
    this.s.franchise = true;
    if (!this.s.brand) this.s.brand = this.s.name;
    this.emit({ type: 'stage' });
    return null;
  }

  // ------------------------------------------------------------ events
  queueChoice(ev: ChoiceEvent) {
    this.evToday++;
    if (this.autoChoice) { this.resolve(ev, this.autoChoice(ev)); return; }
    this.pending.push(ev);
    this.emit({ type: 'choice', ev });
  }
  rollEvents() {
    const s = this.s, d = this.date;
    const f = s.flags;
    const key = (k: string) => `${k}${d.year}`;
    // THR: week 3 of Ramadan
    if (d.month === ramadanMonth(d.year) && d.week === 3 && d.day === 1 && !f[key('thr')] && s.staff.length) {
      f[key('thr')] = 1;
      const thr = this.monthlySalaries();
      hint(this, 'thr');
      this.queueChoice({ id: 'thr', title: 'WAKTUNYA THR', text: `Lebaran sebentar lagi. Staf nunggu THR: total ${fmtMoney(thr)} (1x gaji).`, choices: [
        { label: `Bayar penuh (${fmtShort(thr)})`, act: 'full', hint: 'Staf senang' }, { label: `Setengah (${fmtShort(thr / 2)})`, act: 'half', hint: 'Agak kecewa' }, { label: 'Nanti aja...', act: 'skip', hint: 'Bisa ada yang resign' }], data: { thr } });
    }
    // mudik: start of lebaran week
    if (this.isLebaranWeek() && d.day === 1 && !f[key('mudik')] && s.staff.length) {
      f[key('mudik')] = 1;
      const want = s.staff.filter((st) => st.traits.includes('mudik') || Math.random() < 0.5);
      if (want.length) {
        const bonus = Math.round(want.reduce((a, b) => a + b.salary, 0) * 0.5);
        this.queueChoice({ id: 'mudik', title: 'MUDIK LEBARAN', text: `${want.map((x) => x.name).join(', ')} mau mudik seminggu. Warung bakal kekurangan orang.`, choices: [
          { label: 'Silakan mudik', act: 'izin', hint: 'Loyal naik, warung sepi tenaga' }, { label: `Bonus biar tetap kerja (${fmtShort(bonus)})`, act: 'bonus' }, { label: 'Tutup warung seminggu', act: 'tutup', hint: 'Semua istirahat' }], data: { bonus, ids: want.map((x) => x.id).join(',') } });
      }
    }
    if (f.cooldown && f.cooldown > s.absDay) return;
    const r = Math.random();
    const yr = d.year;
    if (rollEvents2(this, r)) { f.cooldown = s.absDay + 3; return; }
    // sidak dinas kesehatan
    if (r < 0.012 && s.absDay > 20) {
      f.cooldown = s.absDay + 5;
      const b = s.bersih;
      this.emit({ type: 'visitor', kind: 'dinkes' });
      if (b >= 62) { s.effects.push({ id: 'lolos', until: s.absDay + 60, v: 1 }); s.totals.sidakLolos++; s.fans += 80; this.queueChoice({ id: 'sidak', title: 'SIDAK DINAS KESEHATAN', text: `Petugas Dinas Kesehatan datang mendadak!\nKebersihan ${Math.round(b)}: LOLOS! Dapat stiker "Warung Sehat". Pelanggan makin percaya.`, choices: [{ label: 'Alhamdulillah!', act: 'ok' }] }); }
      else if (b >= 42) this.queueChoice({ id: 'sidak', title: 'SIDAK DINAS KESEHATAN', text: `Petugas datang mendadak. Kebersihan ${Math.round(b)}: dapat teguran. Lain kali bisa didenda!`, choices: [{ label: 'Siap, bersih-bersih', act: 'ok' }] });
      else { const fine = Math.round(2000000 * s.inflation); this.money(-fine, 'other'); s.fans = Math.max(0, s.fans - 100); this.queueChoice({ id: 'sidak', title: 'SIDAK DINAS KESEHATAN', text: `Kebersihan ${Math.round(b)}: GAGAL. Denda ${fmtShort(fine)} dan fans berkurang. Beli wastafel / rekrut pelayan!`, choices: [{ label: 'Aduh...', act: 'ok' }] }); }
      return;
    }
    // food vlogger
    if (r < 0.028 && s.absDay > 14) {
      f.cooldown = s.absDay + 6;
      this.emit({ type: 'visitor', kind: 'vlog' });
      this.queueChoice({ id: 'vlog', title: 'FOOD VLOGGER DATANG!', text: 'Ada food vlogger "Kak Mukbang Nusantara" (480 rb pengikut) mau review warungmu. Kasih makan gratis?', choices: [
        { label: 'Gratisin + lauk spesial', act: 'gratis', hint: `-${fmtShort(150000 * s.inflation)}, peluang viral naik` }, { label: 'Bayar biasa aja', act: 'biasa' }] });
      return;
    }
    // price war
    const rivalIds = Object.keys(s.rivals);
    if (r < 0.04 && rivalIds.length && s.absDay > 30) {
      f.cooldown = s.absDay + 4;
      const rid = pick(rivalIds); const R = RIVALS.find((x) => x.id === rid)!;
      s.rivals[rid].cut = 14;
      this.queueChoice({ id: 'perang', title: 'PERANG HARGA!', text: `${R.name} banting harga 20% dua minggu ini. Pelanggan mulai melirik ke sana.`, choices: [
        { label: 'Ikut turunin harga', act: 'ikut', hint: 'Harga -10%, untung tipis' }, { label: 'Promo spanduk', act: 'promo', hint: `${fmtShort(350000 * s.inflation)}` }, { label: 'Cuekin', act: 'cuek', hint: 'Fokus rasa' }], data: { rival: rid } });
      return;
    }
    if (r < 0.05 && this.isRainy()) { f.cooldown = s.absDay + 3; s.effects.push({ id: 'banjir', until: s.absDay + 1, v: 0.7 }); this.toast('Hujan deras + banjir! Walk-in sepi, pesanan ojol naik.'); return; }
    if (r < 0.058 && this.has('tv')) { f.cooldown = s.absDay + 3; s.effects.push({ id: 'nobar', until: s.absDay + 1, v: 1.3 }); this.toast('Final Liga Nusantara malam ini! Nobar di warung, rame!'); return; }
    if (r < 0.072 && yr >= 2 && !this.effect('bbm')) { f.cooldown = s.absDay + 3; s.effects.push({ id: 'bbm', until: s.absDay + 56, v: 1 }); this.toast('Harga BBM naik! Bahan di pasar ikut naik ~10% dua bulan.'); return; }
    if (r < 0.078 && !this.has('genset') && s.stage >= 2) { f.cooldown = s.absDay + 3; s.effects.push({ id: 'padam', until: s.absDay + 1, v: 1 }); s.rasa -= 3; this.toast('Listrik padam setengah hari. Lauk nggak bisa dihangatin... (beli Genset)'); return; }
    if (r < 0.085 && s.absDay > 20) {
      f.cooldown = s.absDay + 4;
      this.queueChoice({ id: 'tikus', title: 'ADA TIKUS!', text: 'Pelanggan lihat tikus lari di bawah etalase. Kebersihan terancam!', choices: [
        { label: `Panggil pembasmi (${fmtShort(400000 * s.inflation)})`, act: 'basmi' }, { label: 'Pasang lem tikus aja', act: 'lem', hint: 'Murah, belum tentu beres' }] });
      return;
    }
    if (r < 0.092 && s.staff.length >= 2 && s.absDay > 45) {
      f.cooldown = s.absDay + 5;
      const st = pick(s.staff);
      this.queueChoice({ id: 'naikgaji', title: 'MINTA NAIK GAJI', text: `${st.name} (${ROLES[st.role].name} Lv${st.level}) minta naik gaji 10%. "Harga-harga naik, Juragan..."`, choices: [
        { label: `Naikkan (+${fmtShort(st.salary * 0.1)}/bln)`, act: 'naik' }, { label: 'Kasih bonus sekali', act: 'bonus', hint: `${fmtShort(st.salary * 0.3)}` }, { label: 'Tolak', act: 'tolak' }], data: { id: st.id } });
      return;
    }
    if (r < 0.097 && s.absDay > 60 && s.staff.length >= 2) {
      f.cooldown = s.absDay + 5;
      const st = [...s.staff].sort((a, b) => b.skill - a.skill)[0];
      const rid = rivalIds.length ? pick(rivalIds) : 'sebelah';
      const R = RIVALS.find((x) => x.id === rid)!;
      this.queueChoice({ id: 'bajak', title: 'STAF DIBAJAK?', text: `${R.name} nawarin ${st.name} gaji lebih tinggi. Dia galau.`, choices: [
        { label: 'Naikkan gaji 20%', act: 'naik' }, { label: 'Ajak ngobrol dari hati', act: 'hati', hint: 'Tergantung loyalitas' }, { label: 'Biarin pergi', act: 'pergi' }], data: { id: st.id } });
      return;
    }
    if (r < 0.1 && s.stage >= 5 && s.absDay > 30 && offerBus(this)) { f.cooldown = s.absDay + 3; return; }
    if (r < 0.103 && s.stage >= 2) { f.cooldown = s.absDay + 2; const m = Math.round(rnd(150000, 600000) * s.inflation); this.money(m, 'revenue'); this.toast(`Arisan ibu-ibu RT pesan lauk: +${fmtShort(m)}`); return; }
    if (r < 0.108) { f.cooldown = s.absDay + 2; this.toast('Pelanggan setia Pak Bonar bawa rombongan proyek. Rame!'); s.effects.push({ id: 'viral', until: s.absDay + 1, v: 1.25 }); return; }
  }

  resolve(ev: ChoiceEvent, idx: number) {
    const s = this.s;
    this.pending = this.pending.filter((x) => x !== ev);
    const act = ev.choices[idx]?.act ?? ev.choices[0]?.act;
    const D = ev.data ?? {};
    const st = typeof D.id === 'number' ? s.staff.find((x) => x.id === D.id) : undefined;
    switch (ev.id) {
      case 'thr': {
        const thr = Number(D.thr);
        if (act === 'full') { this.money(-thr, 'salaries'); for (const x of s.staff) x.loyalty = clamp(x.loyalty + 15, 0, 100); s.stats2.thrFull++; this.toast('THR cair! Staf semangat.'); }
        else if (act === 'half') { this.money(-thr / 2, 'salaries'); for (const x of s.staff) x.loyalty = clamp(x.loyalty - 8, 0, 100); s.flags.mogokRisk = s.absDay + 10; this.toast('THR cuma separuh... staf bisik-bisik di dapur.'); }
        else {
          for (const x of s.staff) x.loyalty = clamp(x.loyalty - 30, 0, 100);
          s.flags.thrSkipped = (s.flags.thrSkipped ?? 0) + 1; s.stats2.thrSkip++; s.flags.mogokRisk = s.absDay + 14;
          this.toast('Staf kecewa berat nggak dapat THR... awas mogok!');
          for (const x of [...s.staff]) if (x.traits.includes('baper') && s.staff.length > 1 && Math.random() < 0.5) { this.toast(`${x.name} resign: "THR aja nggak dikasih!"`); staffLeaves(this, x, 'resign'); }
        }
        break;
      }
      case 'mudik': {
        const ids = String(D.ids).split(',').map(Number);
        if (act === 'izin') for (const x of s.staff) { if (ids.includes(x.id)) { x.off = 7; x.mudik = true; x.loyalty = clamp(x.loyalty + 10, 0, 100); } }
        else if (act === 'bonus') { this.money(-Number(D.bonus), 'salaries'); for (const x of s.staff) if (ids.includes(x.id)) x.loyalty = clamp(x.loyalty - 5, 0, 100); }
        else { for (const x of s.staff) { x.off = 7; x.mudik = ids.includes(x.id); x.loyalty = clamp(x.loyalty + 12, 0, 100); } s.effects.push({ id: 'tutup', until: s.absDay + 7, v: 0 }); }
        this.emit({ type: 'staffChange' });
        break;
      }
      case 'vlog': {
        let chance = (s.rasa - 40) / 45 + (act === 'gratis' ? 0.2 : 0);
        if (act === 'gratis') this.money(-Math.round(150000 * s.inflation), 'other');
        chance = clamp(chance, 0.05, 0.92);
        if (Math.random() < chance) {
          s.effects.push({ id: 'viral', until: s.absDay + 7, v: 1.7 }); s.fans += Math.round(300 + s.fans * 0.1); s.totals.viral++;
          this.addReview({ name: 'Kak Mukbang Nusantara', type: 'vlog', stars: 5, text: 'GILA sih ini warteg, murah enak! Wajib ke sini guys!! #WartegViral' });
          this.queueChoice({ id: 'info', title: 'VIRAL!!', text: 'Video review warungmu FYP! Seminggu ke depan pelanggan membludak. Siapkan stok yang banyak!', choices: [{ label: 'Gas!', act: 'ok' }] });
        } else if (s.rasa < 48) {
          s.effects.push({ id: 'jelek', until: s.absDay + 5, v: 0.8 }); s.fans = Math.max(0, s.fans - 120);
          this.addReview({ name: 'Kak Mukbang Nusantara', type: 'vlog', stars: 2, text: 'Hmm jujur ya guys... rasanya biasa banget. Sorry ya. #JujurReview' });
          this.toast('Review vlogger jelek... pelanggan agak berkurang.');
        } else { this.addReview({ name: 'Kak Mukbang Nusantara', type: 'vlog', stars: 4, text: 'Enak kok, recommended buat makan siang hemat!' }); s.fans += 60; }
        break;
      }
      case 'perang': {
        const rid = String(D.rival);
        if (act === 'ikut') { s.effects.push({ id: 'perang', until: s.absDay + 14, v: 1 }); if (s.rivals[rid]) s.rivals[rid].cut = 3; }
        else if (act === 'promo') { if (!this.promoOn('spanduk')) { const c = Math.round(350000 * s.inflation); this.money(-c, 'other'); s.promo.push({ id: 'spanduk', left: 7 }); } }
        break;
      }
      case 'tikus': {
        if (act === 'basmi') this.money(-Math.round(400000 * s.inflation), 'other');
        else if (Math.random() < 0.5) { s.effects.push({ id: 'tikus', until: s.absDay + 10, v: 1 }); this.toast('Tikusnya masih ada... Kebersihan turun.'); }
        break;
      }
      case 'naikgaji': if (st) { if (act === 'naik') this.raise(st); else if (act === 'bonus') { this.money(-Math.round(st.salary * 0.3), 'salaries'); st.loyalty = clamp(st.loyalty + 8, 0, 100); } else st.loyalty = clamp(st.loyalty - 18, 0, 100); } break;
      case 'bajak': if (st) {
        if (act === 'naik') { st.salary = Math.round((st.salary * 1.2) / 50000) * 50000; st.loyalty = clamp(st.loyalty + 20, 0, 100); }
        else if (act === 'hati') { if (Math.random() < st.loyalty / 100 + sinkLv(this, 'beasiswa') * 0.12) { st.loyalty = clamp(st.loyalty + 15, 0, 100); this.toast(`${st.name} memilih bertahan. Terharu!`); } else { this.toast(`${st.name} pamit pindah ke saingan...`); staffLeaves(this, st, 'resign'); } }
        else staffLeaves(this, st, 'resign');
      } break;
      case 'bus': resolveBus(this, act, D); break;
      case 'mitra': resolveMitra(this, act, D); break;
      default: resolveExt(this, ev, act, idx); break;
    }
  }

  checkStageHints() {
    const s = this.s;
    if (STAGES[s.stage] && !this.upgradeCheck() && !s.flags['hintStage' + s.stage]) { s.flags['hintStage' + s.stage] = 1; this.toast(`Warung siap naik kelas jadi ${STAGES[s.stage].name}! Cek Menu > Renovasi.`); }
  }

  /** career score 0..100 for the ending title */
  /** v1.3: harder score with welfare + stories (systems.ts) */
  careerScore() { return careerScore2(this); }
  endingTitle() { return endingFor(this); }
  dayName() { return HARI[(this.s.absDay) % DAYS_PER_WEEK]; }
}
