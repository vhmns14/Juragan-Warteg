// v1.4 systems (pure, no Phaser): the new staff roles (kepala dapur, kasir shift malam, manajer cabang), prasmanan +
// waiters serving the tables (Rumah Makan+), rombongan bus groups, the national franchise level-up (own brand, outlets
// in other cities incl. mall + bandara, royalties / upkeep), Restoran Besar extras. Hooked from Sim.
import type { Sim } from './sim';
import type { Staff, Outlet } from './state';
import { clamp, fmtShort, pick, irnd, rnd } from './state';
import { STAGES, ROLES, LOC, type CustId, type RoleId } from './data';
import { CITY, CITIES, OUTLET, ROYALTY, NATIONAL, ROMBONGAN, type OutletKind } from './data3';
import { hint } from './systems';

const inf = (sim: Sim) => sim.s.inflation;

// ------------------------------------------------------------------ roles
/** the best kepala dapur's strength (0 = none). Only one counts */
export function kepalaV(sim: Sim) {
  const k = sim.byRole('kepala');
  if (!k.length) return 0;
  return Math.max(...k.map((x) => (0.6 + x.skill / 160 + x.level * 0.05) * sim.speedMul(x)));
}
/** cook capacity multiplier from the kepala dapur */
export function kepalaCapMul(sim: Sim) { const v = kepalaV(sim); return v ? 1 + 0.12 + v * 0.1 : 1; }
/** rasa target bonus from the kepala dapur */
export function kepalaRasa(sim: Sim) { const v = kepalaV(sim); return v ? 4 + v * 5 : 0; }
/** kasir shift malam: serve-rate contribution (strong after 17:00, half before) */
export function shiftRate(sim: Sim) {
  const ev = sim.s.tick >= 48;
  let r = 0;
  for (const k of sim.byRole('shift')) r += (1.2 + k.speed / 35 + k.level * 0.2) * sim.speedMul(k) * (ev ? 1.6 : 0.45);
  return r;
}
/** an unassigned manajer at the main warung keeps the floor in order */
export function manajerHome(sim: Sim) { return sim.byRole('manajer').some((m) => !m.assign); }
export function canHireRole(sim: Sim, role: RoleId): string | null {
  const ms = ROLES[role].minStage ?? 1;
  if (sim.s.stage < ms) return `${ROLES[role].name} mulai dari ${STAGES[ms - 1].name}`;
  return null;
}
/** post a manajer at a cabang / national outlet (null = back to the main warung) */
export function assignStaff(sim: Sim, st: Staff, target: string | null): string | null {
  if (st.role !== 'manajer') return 'Cuma manajer yang bisa ditempatkan';
  if (target) {
    const [k, id] = target.split(':');
    if (k === 'cab' && !sim.s.cabang.some((c) => c.loc === id)) return 'Cabang nggak ada';
    if (k === 'out' && !sim.s.outlets.some((o) => String(o.id) === id)) return 'Outlet nggak ada';
    if (sim.s.staff.some((x) => x !== st && x.assign === target)) return 'Sudah ada manajer di sana';
    st.assign = target;
  } else delete st.assign;
  sim.emit({ type: 'staffChange' });
  return null;
}
export function managerAt(sim: Sim, target: string) { return sim.s.staff.find((x) => x.assign === target && !x.off); }
/** profit multiplier a posted manajer gives */
export const mgrMul = (st: Staff | undefined) => (st ? 1.22 + st.level * 0.025 + st.skill / 600 : 1);
/** a cabang / outlet that closed takes its manajer's post with it */
export function clearAssign(sim: Sim, target: string) { for (const st of sim.s.staff) if (st.assign === target) delete st.assign; }

// ------------------------------------------------------------------ prasmanan + waiters (Rumah Makan+)
export function prasmananOn(sim: Sim) { return sim.s.prasmanan && sim.s.stage >= 5; }
export function setPrasmanan(sim: Sim, on: boolean): string | null {
  if (on && sim.s.stage < 5) return 'Prasmanan mulai dari Rumah Makan';
  sim.s.prasmanan = on;
  if (on) hint(sim, 'prasmanan');
  return null;
}
/** waiters needed to serve every table (Rumah Makan+: dine-in food is brought to the table) */
export function pelayanNeed(sim: Sim) { return sim.s.stage >= 5 ? Math.ceil(sim.seats() / 14) : 0; }
/** 0..1: how well the tables are covered by waiters */
export function mejaCover(sim: Sim) {
  const need = pelayanNeed(sim);
  if (!need) return 1;
  return clamp(sim.byRole('pelayan').length / need, 0, 1);
}

// ------------------------------------------------------------------ rombongan bus (Rumah Makan+)
export function offerBus(sim: Sim): boolean {
  const s = sim.s;
  if (s.stage < 5 || s.flags.busDay === s.absDay + 1) return false;
  const n = s.stage >= 6 ? irnd(26, 42) : irnd(16, 26);
  const who = pick(ROMBONGAN);
  sim.queueChoice({
    id: 'bus', title: 'ROMBONGAN BUS!',
    text: `Ada ${who} (${n} orang) mau mampir makan siang besok. Siapkan stok & nasi yang banyak!`,
    choices: [{ label: 'Siap, terima!', act: 'terima', hint: 'Rame sekaligus' }, { label: 'Lain kali deh', act: 'tolak' }],
    data: { n },
  });
  hint(sim, 'bus');
  return true;
}
export function resolveBus(sim: Sim, act: string, D: Record<string, number | string>) {
  if (act !== 'terima') return;
  sim.s.flags.busDay = sim.s.absDay + 1;
  sim.s.flags.busN = Number(D.n);
  sim.toast(`Rombongan ${D.n} orang datang besok siang. Masak yang banyak!`);
}
/** tick hook: the bus arrives at 11:30 on its day */
export function busTick(sim: Sim, t: number) {
  const s = sim.s;
  if (s.flags.busDay !== s.absDay || t < 26) return;
  const n = s.flags.busN ?? 20;
  s.flags.busDay = 0;
  sim.emit({ type: 'bus', n });
  const types: CustId[] = ['buruh', 'ibu', 'mhs', 'kantor', 'mandor'];
  for (let i = 0; i < n; i++) sim.arrive(pick(types), false, true);
}

// ------------------------------------------------------------------ national franchise (brand + outlets)
export function brandName(sim: Sim) { return sim.s.brand || sim.s.name; }
export function setBrand(sim: Sim, name: string): string | null {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, 32);
  if (n.length < 3) return 'Nama brand minimal 3 huruf';
  sim.s.brand = n;
  hint(sim, 'brand');
  return null;
}
export function outletCost(sim: Sim, kind: OutletKind) { return Math.round(OUTLET[kind].cost * inf(sim)); }
export function outletCheck(sim: Sim, city: string, kind: OutletKind): string | null {
  const s = sim.s, C = CITY[city], D = OUTLET[kind];
  if (!s.franchise) return 'Buka franchise dulu (butuh Warteg Besar + 4 cabang)';
  if (!C) return 'Kota nggak ada';
  if (city === 'home' && kind === 'kota') return 'Di kota sendiri pakai cabang biasa';
  if (s.stage < D.needStage) return `${D.name} butuh ${STAGES[D.needStage - 1].name}`;
  if (kind === 'mall' && !C.mall) return 'Kota ini belum punya mall';
  if (kind === 'bandara' && !C.bandara) return 'Kota ini nggak punya bandara';
  if (s.outlets.length >= NATIONAL.maxOutlets) return `Maksimal ${NATIONAL.maxOutlets} outlet`;
  if (s.outlets.filter((o) => o.city === city).length >= NATIONAL.maxPerCity) return `Maksimal ${NATIONAL.maxPerCity} outlet per kota`;
  if (kind !== 'kota' && s.outlets.some((o) => o.city === city && o.kind === kind)) return `Sudah ada outlet ${D.short.toLowerCase()} di sini`;
  const c = outletCost(sim, kind);
  if (c > s.money) return `Butuh ${fmtShort(c)}`;
  return null;
}
export function openOutlet(sim: Sim, city: string, kind: OutletKind, free = false): string | null {
  const s = sim.s;
  if (!free) { const e = outletCheck(sim, city, kind); if (e) return e; sim.money(-outletCost(sim, kind), 'investment'); }
  const o: Outlet = { id: s.outletSeq++, city, kind, lv: 1, opened: s.absDay, rating: clamp(sim.stars() * 0.85, 2, 4.5), lastWeek: 0, total: 0 };
  s.outlets.push(o);
  s.stats2.outletsOpened++;
  hint(sim, 'outlet');
  sim.emit({ type: 'stage' });
  return null;
}
export function outletRenovCost(sim: Sim, o: Outlet) { return Math.round(OUTLET[o.kind].cost * 0.45 * o.lv * inf(sim)); }
export function renovOutlet(sim: Sim, id: number): string | null {
  const o = sim.s.outlets.find((x) => x.id === id);
  if (!o) return 'Outlet nggak ada';
  if (o.lv >= 3) return 'Sudah maksimal';
  const c = outletRenovCost(sim, o);
  if (c > sim.s.money) return `Butuh ${fmtShort(c)}`;
  sim.money(-c, 'investment'); o.lv++;
  return null;
}
export function closeOutlet(sim: Sim, id: number): number {
  const s = sim.s, o = s.outlets.find((x) => x.id === id);
  if (!o) return 0;
  const back = Math.round(OUTLET[o.kind].cost * 0.3 * inf(sim));
  sim.money(back, 'revenue');
  s.outlets = s.outlets.filter((x) => x !== o);
  clearAssign(sim, 'out:' + id);
  sim.emit({ type: 'stage' });
  return back;
}
/** monthly brand support / rent share for every outlet */
export function outletUpkeep(sim: Sim) { return sim.s.outlets.reduce((a, o) => a + OUTLET[o.kind].upkeep * (0.85 + o.lv * 0.15), 0) * inf(sim); }
/** the brand's standing: main warung rating, spread thin by many outlets without managers */
export function brandRating(sim: Sim) {
  const s = sim.s;
  const mgr = s.outlets.filter((o) => managerAt(sim, 'out:' + o.id)).length;
  const thin = Math.max(0, s.outlets.length - 4 - mgr * 2) * 0.05;
  return clamp(sim.stars() - thin, 0.5, 5);
}
/** weekly: royalties from every outlet (gross x royalty share; manajer + rating + level) */
export function outletsWeek(sim: Sim) {
  const s = sim.s;
  if (!s.outlets.length) return;
  const br = brandRating(sim);
  // the national market saturates: every extra outlet sells a bit less, a 2nd / 3rd outlet in one city even less
  const sat = 1 / (1 + 0.05 * (s.outlets.length - 1));
  const nth: Record<string, number> = {};
  let sum = 0;
  for (const o of s.outlets) {
    const k = (nth[o.city] = (nth[o.city] ?? 0) + 1);
    const same = k === 1 ? 1 : k === 2 ? 0.7 : 0.5;
    const D = OUTLET[o.kind], C = CITY[o.city];
    const mgr = managerAt(sim, 'out:' + o.id);
    o.rating = clamp(o.rating + ((br * 0.9 + o.lv * 0.12 + (mgr ? 0.25 : 0)) - o.rating) * 0.2 + rnd(-0.05, 0.05), 0.5, 5);
    const gross = D.gross * C.pop * sat * same * (0.35 + o.rating / 5 * 0.85) * (0.8 + o.lv * 0.2) * inf(sim) * mgrMul(mgr) * (sim.isRamadan() ? 1.1 : 1);
    const roy = Math.round(gross * ROYALTY);
    o.lastWeek = roy; o.total += roy; sum += roy;
  }
  sim.money(sum, 'revenue');
  sim.toast(`Royalti ${s.outlets.length} outlet ${brandName(sim)}: +${fmtShort(sum)}`);
}
/** monthly: a would-be partner (mitra) asks to open an outlet in their city, paying most of the setup themselves */
export function offerMitra(sim: Sim): boolean {
  const s = sim.s;
  if (!s.franchise || !s.brand || s.outlets.length >= Math.min(10, NATIONAL.maxOutlets) || brandRating(sim) < 3.8) return false;
  const cands = CITIES.filter((c) => c.id !== 'home' && s.outlets.filter((o) => o.city === c.id).length < NATIONAL.maxPerCity);
  if (!cands.length) return false;
  const C = pick(cands);
  const fee = Math.round(OUTLET.kota.cost * 0.35 * inf(sim));
  sim.queueChoice({
    id: 'mitra', title: 'CALON MITRA FRANCHISE',
    text: `Pak/Bu ${pick(['Hendarto', 'Sulastri', 'Ronald', 'Wulandari', 'Fikri', 'Marlina'])} dari ${C.name} mau buka outlet ${brandName(sim)}.\nKamu cukup bayar pendampingan ${fmtShort(fee)}, sisanya modal mitra.`,
    choices: [{ label: `Setuju (${fmtShort(fee)})`, act: 'ok', hint: 'Royalti tiap minggu' }, { label: 'Belum dulu', act: 'tolak' }],
    data: { city: C.id, fee },
  });
  return true;
}
export function resolveMitra(sim: Sim, act: string, D: Record<string, number | string>) {
  if (act !== 'ok') return;
  const fee = Number(D.fee);
  if (sim.s.money < fee) { sim.toast('Kas nggak cukup buat pendampingan mitra.'); return; }
  sim.money(-fee, 'investment');
  openOutlet(sim, String(D.city), 'kota', true);
  sim.toast(`Outlet mitra di ${CITY[String(D.city)].name} buka!`);
}
/** distinct cities (other than home) with an outlet, and whether a mall / bandara outlet exists */
export function nationalReach(sim: Sim) {
  const s = sim.s;
  const cities = new Set(s.outlets.map((o) => o.city).filter((c) => c !== 'home')).size;
  return { cities, outlets: s.outlets.length, mall: s.outlets.some((o) => o.kind === 'mall'), bandara: s.outlets.some((o) => o.kind === 'bandara') };
}
/** cabang weekly profit multiplier from a posted manajer */
export function cabangMgrMul(sim: Sim, loc: string) { return mgrMul(managerAt(sim, 'cab:' + loc)); }
void LOC;

// ------------------------------------------------------------------ late game: yearly income tax (big earners only)
/** January: pajak penghasilan on last year's operating profit (0% up to 300 jt, 25% to 1,2 M, 45% above; inflation-
 * adjusted). Keeps the late-game cash from piling up without touching the small warung years. Returns the tax paid. */
/** operating profit of a year (investments are not deductible: a rich warung pays its share however it spends it) */
function ledgerProfit(L: { revenue: number; ingredients: number; salaries: number; rent: number; other: number; ojolFee: number }) {
  return L.revenue - L.ingredients - L.salaries - L.rent - L.other - L.ojolFee;
}
export function taxFor(sim: Sim, profit: number) {
  const a = 3e8 * inf(sim), b = 1.2e9 * inf(sim);
  return Math.round(Math.max(0, Math.min(profit, b) - a) * 0.25 + Math.max(0, profit - b) * 0.45);
}
/** December: rough estimate of next January's tax from this year's ledger so far (11 of 12 months) */
export function taxEstimate(sim: Sim) {
  const L = sim.s.ledger[sim.date.year];
  return L ? taxFor(sim, ledgerProfit(L) * 12 / 11) : 0;
}
export function yearlyTax(sim: Sim): number {
  const s = sim.s, d = sim.date;
  if (d.month !== 1 || d.year < 2 || s.flags['pajak' + d.year]) return 0;
  s.flags['pajak' + d.year] = 1;
  const L = s.ledger[d.year - 1];
  if (!L) return 0;
  // never more than half of the cash above two months of running costs (the rest is "diangsur" / written off): tax must not bankrupt a warung
  const tax = Math.round(Math.min(Math.max(0, s.money - sim.monthlyCosts() * 2) * 0.5, taxFor(sim, ledgerProfit(L))));
  if (tax <= 0) return 0;
  sim.money(-tax, 'other');
  s.flags.pajakTotal = (s.flags.pajakTotal ?? 0) + tax;
  sim.toast(`Bayar pajak penghasilan tahun ${d.year - 1}: ${fmtShort(tax)}. Juragan taat pajak!`);
  hint(sim, 'pajak');
  return tax;
}
