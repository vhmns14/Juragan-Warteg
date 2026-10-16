// Headless balance bot: plays the pure Sim for N years with a policy and prints stats.
//   npx rolldown tools/balance.ts --file .balance.mjs --platform node && node .balance.mjs smart|dumb|casual <years> <runs>
import { Sim, type ChoiceEvent } from '../src/sim';
import { newGame, dateOf, fmtShort, DAY_TICKS } from '../src/state';
import { DISH, DECORS, STAGES, LOCS, COMBOS, UPGRADES, type RoleId } from '../src/data';
import { REGULARS, SINKS } from '../src/data2';
import { careerScore2, commitmentsPerYear, feedCat, applyMini, buySink, sinkCost, setMangkal, buyIzin, figuranAct, welfare, avgStars, miniDone } from '../src/systems';
import { setPrasmanan, pelayanNeed, openOutlet, outletCheck, outletCost, assignStaff, nationalReach, outletUpkeep } from '../src/sim3';
import { CITIES, OUTLETS } from '../src/data3';

type Mode = 'smart' | 'dumb' | 'casual';
const mode = (process.argv[2] ?? 'smart') as Mode;
const years = Number(process.argv[3] ?? 10);
const runs = Number(process.argv[4] ?? 1);
const verbose = runs === 1;

let SIM: Sim | null = null;
function choose(ev: ChoiceEvent): number {
  if (mode === 'dumb') return Math.floor(Math.random() * ev.choices.length);
  const s = SIM!.s;
  if (ev.id === 'katering') return ev.text.includes('KEWALAHAN') ? (mode === 'smart' ? 2 : 1) : 0;
  if (ev.id === 'regular') {
    const r = REGULARS.find((x) => x.id === ev.data?.rid); const st = r?.steps[Number(ev.data?.step)];
    if (!st) return 0;
    if (mode === 'casual' && Math.random() < 0.35) return Math.floor(Math.random() * ev.choices.length);
    let best = 0; st.choices.forEach((c, i) => { const a = c.bersihCheck ? (s.bersih >= 60 ? c.aff : -10) : c.aff; const b = st.choices[best]; const ab = b.bersihCheck ? (s.bersih >= 60 ? b.aff : -10) : b.aff; if (a > ab) best = i; });
    return best;
  }
  if (ev.id === 'komplain') return s.rasa >= 52 && s.bersih >= 45 ? 0 : 1;
  if (ev.id === 'satpol') return mode === 'smart' ? 2 : 1;
  if (ev.id === 'lapak') return mode === 'smart' ? 2 : 0;
  if (ev.id === 'resign') return 1;
  if (ev.id === 'thr') return 0;
  if (ev.id === 'mudik') return 0;
  if (ev.id === 'vlog') return 0;
  if (ev.id === 'perang') return mode === 'smart' ? 2 : 0;
  if (ev.id === 'katering') return 0;
  if (ev.id === 'tikus') return 0;
  if (ev.id === 'naikgaji') return 1;
  if (ev.id === 'bajak') return 1;
  if (ev.id === 'bus') return mode === 'smart' ? (s.nasi > 0 || s.staff.length >= 8 ? 0 : 1) : mode === 'casual' ? 0 : Math.floor(Math.random() * 2);
  if (ev.id === 'mitra') return s.money > Number(ev.data?.fee ?? 0) + SIM!.monthlyCosts() * (mode === 'smart' ? 3 : 1.5) ? 0 : 1;
  return 0;
}

export function botDay(sim: Sim, m: Mode) {
  const s = sim.s;
  const y = s.yesterday;
  const r = Math.random;
  // ---- menu
  const unlocked = s.unlocked.filter((id) => DISH[id]);
  if (m === 'dumb') {
    // dumb: re-plans once a month with a rough guess (0.5x .. 2x of what is needed), never checks the report
    if (s.absDay % 28 === 0) {
      const served = y ? y.customers : 50;
      const list = unlocked.slice(0, sim.slots());
      s.menu = {}; for (const id of list) s.menu[id] = Math.max(5, Math.round((served / list.length) * 1.6 * (0.5 + r() * 1.5)));
      s.nasiPorsi = Math.round(served * (0.6 + r() * 1.2) + 10);
      s.priceLevel = Math.floor(r() * 3);
    }
  } else {
    const slots = sim.slots();
    // keep the best sellers + fill with unlocked
    const sold = y?.sold ?? {};
    const ranked = [...unlocked].sort((a, b) => (sold[b] ?? 0) - (sold[a] ?? 0));
    const combosNeed = s.activeCombos.flatMap((c) => COMBOS.find((x) => x.id === c)!.dishes);
    const pickList = [...new Set([...combosNeed, 'esteh', ...ranked])].filter((id) => unlocked.includes(id)).slice(0, slots);
    const served = y ? Math.max(20, y.served + y.left + y.habis) : 50;
    s.menu = {};
    for (const id of pickList) {
      const prev = sold[id] ?? served / pickList.length;
      const habisBoost = y && y.habis > 2 ? 1.25 : 1;
      s.menu[id] = Math.max(6, Math.round((prev * 1.15 + 3) * habisBoost * (m === 'casual' ? 1.2 : 1)));
    }
    s.nasiPorsi = Math.round(served * (m === 'smart' ? 1.08 : 1.25) + 8);
    s.priceLevel = 1;
    s.kasbonPolicy = 1;
  }
  // ---- v1.3 systems
  if (m === 'smart' || (m === 'casual' && r() < 0.5)) {
    feedCat(sim);
    for (const g of ['sambal', 'tempe', 'piring'] as const) if (!miniDone(sim, g) && (m === 'smart' || r() < 0.3)) applyMini(sim, g, 50 + r() * 45);
  }
  if (m === 'dumb' && r() < 0.15) for (const g of ['sambal', 'tempe', 'piring'] as const) applyMini(sim, g, r() * 70);
  if (s.stage === 1 && s.absDay === 15) {
    if (m === 'smart') { buyIzin(sim); setMangkal(sim, 'stasiun'); }
    else if (m === 'dumb') setMangkal(sim, ['pasar', 'sekolah', 'stasiun'][Math.floor(r() * 3)]);
  }
  if (m === 'smart' && s.stage >= 2 && s.absDay % 3 === 0) figuranAct(sim, 'hansip');
  if (s.stage >= 2 && s.absDay % 7 === 3) {
    const mc0 = sim.monthlyCosts();
    for (const k of SINKS) {
      const c = sinkCost(sim, k.id); if (!c || (s.sinks[k.id] ?? 0) >= k.max) continue;
      if (m === 'dumb') { if (r() < 0.08 && s.money > c) buySink(sim, k.id); }
      else if (s.money - c > mc0 * (m === 'smart' ? 8 : 4) + 50e6 + (m === 'smart' ? commitmentsPerYear(sim) * 2 : 0) && s.stage >= (m === 'smart' ? 3 : 2)) { buySink(sim, k.id); break; }
    }
  }
  if (s.absDay % 7 !== 0 && m !== 'smart') return;
  // ---- staff
  const max = STAGES[s.stage - 1].staffMax;
  const count = (r2: RoleId) => s.staff.filter((x) => x.role === r2).length;
  const mc = sim.monthlyCosts();
  if (s.staff.length < max && s.candidates.length) {
    let want: RoleId | null = null;
    if (m === 'dumb') want = r() < 0.3 ? s.candidates[Math.floor(r() * s.candidates.length)].role : null;
    else {
      const lostRate = y ? (y.left + y.balk) / Math.max(1, y.customers) : 0;
      const capShort = sim.effortOf(s.menu, s.nasiPorsi) > sim.cookCap() * 0.95;
      if (capShort && count('masak') < 3 + Math.max(0, s.stage - 3)) want = 'masak';
      else if (s.stage >= 4 && count('kepala') === 0 && (m === 'smart' || r() < 0.5)) want = 'kepala';
      else if (s.stage >= 5 && count('pelayan') < pelayanNeed(sim)) want = 'pelayan';
      else if (lostRate > 0.12 && count('pelayan') <= count('kasir')) want = 'pelayan';
      else if (lostRate > 0.12 && s.stage >= 3 && count('shift') === 0) want = 'shift';
      else if (lostRate > 0.12) want = 'kasir';
      else if (s.stage >= 2 && count('belanja') === 0) want = 'belanja';
      else if (m === 'smart' && s.cabang.length + s.outlets.length >= 3 && count('manajer') < Math.min(3, Math.floor((s.cabang.length + s.outlets.length) / 3))) want = 'manajer';
    }
    const c = want ? s.candidates.filter((x) => x.role === want).sort((a, b) => b.skill + b.speed - a.skill - a.speed)[0] : null;
    if (c && s.money > c.salary * 3 + mc) sim.hire(c);
  }
  if (m !== 'dumb') for (const st of s.staff) if (st.energy < 30 && !st.off) sim.rest(st);
  // v1.4: post idle managers at the best outlet / cabang, prasmanan once there are waiters
  if (m !== 'dumb') {
    for (const st of s.staff.filter((x) => x.role === 'manajer' && !x.assign)) {
      const t = [...s.outlets.map((o) => ({ id: 'out:' + o.id, v: o.lastWeek * 3 })), ...s.cabang.map((c) => ({ id: 'cab:' + c.loc, v: c.lastWeek }))].filter((x) => !s.staff.some((y) => y.assign === x.id)).sort((a, b) => b.v - a.v)[0];
      if (t) assignStaff(sim, st, t.id);
    }
    if (s.stage >= 5) setPrasmanan(sim, s.staff.filter((x) => x.role === 'pelayan').length >= 2);
  }
  // ---- research
  if (!s.research) {
    const dishes = Object.values(DISH).filter((d) => d.unlock === 'riset' && !s.unlocked.includes(d.id) && (d.poin ?? 0) <= s.poin && (!d.stage || d.stage <= s.stage));
    const ups = UPGRADES.filter((u) => !s.researched.includes(u.id) && u.poin <= s.poin);
    const opts = [...dishes.map((d) => d.id), ...ups.map((u) => u.id)];
    if (opts.length && (m !== 'dumb' || r() < 0.3)) sim.startResearch(m === 'smart' ? opts[0] : opts[Math.floor(r() * opts.length)]);
  }
  // combos
  if (s.poin > sim.comboCost() + 20 && m !== 'dumb') {
    const avail = s.unlocked.filter((id) => DISH[id]);
    let ids: string[];
    const known = COMBOS.find((c) => !s.combos.includes(c.id) && c.dishes.every((d) => avail.includes(d)));
    if (m === 'smart' && known && r() < 0.5) ids = [...known.dishes];
    else { ids = []; while (ids.length < 3) { const d = avail[Math.floor(r() * avail.length)]; if (!ids.includes(d)) ids.push(d); } }
    sim.tryCombo(ids);
  }
  // ---- decor / stage / ojol / cabang
  const reserve = mc * (m === 'smart' ? 2 : 1);
  for (const d of DECORS) {
    if (s.decor.includes(d.id) || s.stage < d.stage) continue;
    if (s.money - d.cost * s.inflation > reserve && (m !== 'dumb' || r() < 0.2)) { sim.buyDecor(d.id); break; }
  }
  const next = STAGES[s.stage];
  if (next && !sim.upgradeCheck() && s.money - next.cost * s.inflation > reserve) sim.upgradeStage();
  if (s.stage >= 2) for (const a of Object.keys(s.apps)) if (!s.apps[a].joined && s.money > reserve + 1e6) sim.joinApp(a);
  if (s.stage >= 3) {
    for (const L of LOCS) {
      if (L.id === s.loc || s.cabang.some((c) => c.loc === L.id)) continue;
      if (s.money - sim.cabangCost(L.id) > reserve * 1.5 && (m !== 'dumb' || r() < 0.3)) { sim.openCabang(L.id); break; }
    }
    for (const c of s.cabang) if (c.lv < 3 && s.money - sim.renovCost(c) > reserve * 3) sim.renovCabang(c.loc);
  }
  if (!sim.franchiseCheck() && (m !== 'smart' || s.money - 800e6 * s.inflation > reserve * 2 + commitmentsPerYear(sim) * 2)) sim.startFranchise('Brand Bot');
  // v1.4 national outlets: bandara > mall > kota, in the biggest cities first, keeping a reserve
  if (s.franchise && (m !== 'dumb' || r() < 0.2)) {
    const res2 = reserve * (m === 'smart' ? 2.5 : 2) + (m === 'smart' ? commitmentsPerYear(sim) * 2 : 0);
    let done = false;
    for (const D of [...OUTLETS].reverse()) {
      if (done) break;
      for (const C of [...CITIES].sort((a, b) => b.pop - a.pop)) {
        if (!outletCheck(sim, C.id, D.id) && s.money - outletCost(sim, D.id) > res2 && (D.id !== 'kota' || s.outlets.filter((o) => o.kind === 'kota').length < (m === 'smart' ? 6 : 10))) { openOutlet(sim, C.id, D.id); done = true; break; }
      }
    }
  }
  if (m !== 'dumb' && s.absDay % 14 === 0 && s.money > reserve + 3e6 && r() < 0.5) sim.startPromo(s.stage >= 2 ? 'medsos' : 'spanduk');
}

interface Res { y5: number; y6: number; outlets: number; welfare: number; avgStars: number; sinks: number; cash7: number; regGood: number; katDone: number; katFail: number; score: number; bankrupt: boolean; year: number; money: number; stars: number; stage: number; cabang: number; fans: number; staff: number; franchise: boolean; title: string; profit: number; minMoney: number; ach: number }
function runOne(): Res {
  const sim = new Sim(newGame('Bot'));
  SIM = sim;
  const md: Record<string, number> = {};
  if (process.env.MONEYDIAG) { const orig = sim.money.bind(sim); (sim as any).money = (v: number, cat: string) => { if (sim.s.absDay >= 336 * 4) { const st = new Error().stack!.split('\n')[2].trim().split(' ')[1]; const k = (v >= 0 ? '+' : '-') + st + ':' + cat; md[k] = (md[k] ?? 0) + v; } return orig(v, cat as any); }; }
  sim.autoChoice = choose;
  sim.s.tut = 99;
  let minMoney = sim.s.money;
  const endDay = years * 336;
  let upk = 0; let lastYear = 0, cash7 = 0, y5 = 0, y6 = 0; const trail: string[] = [];
  while (sim.s.absDay < endDay && !sim.s.bankrupt) {
    if (sim.s.absDay === 336 * 7) cash7 = sim.s.money;
    if (process.env.DBG && sim.s.absDay % 28 === 0 && sim.s.absDay >= 336 * 6 && sim.s.tick === 0) { const L = sim.s.ledger[dateOf(sim.s.absDay).year]; trail.push(`d${sim.s.absDay} kas ${fmtShort(sim.s.money)} mc ${fmtShort(sim.monthlyCosts())} cab ${sim.s.cabang.map((c) => fmtShort(c.lastWeek)).join('/')} inv ${fmtShort(L?.investment ?? 0)} oth ${fmtShort(L?.other ?? 0)} ★${sim.stars().toFixed(2)} cust ${sim.s.yesterday?.customers}`); }
    if (sim.s.tick === 0) { botDay(sim, mode); if (dateOf(sim.s.absDay).dom === 1) upk += outletUpkeep(sim); }
    for (let i = 0; i < DAY_TICKS && !sim.s.bankrupt; i++) sim.tick();
    minMoney = Math.min(minMoney, sim.s.money);
    if (!y5 && sim.s.stage >= 5) y5 = sim.s.absDay / 336 + 1; if (!y6 && sim.s.stage >= 6) y6 = sim.s.absDay / 336 + 1;
    const d = dateOf(sim.s.absDay);
    if (verbose && d.year !== lastYear && d.month === 1) {
      lastYear = d.year;
      const L = sim.s.ledger[d.year - 1]; if (L && d.year > 1) console.log('   ledger', Object.entries(L).map(([k, v]) => k + ' ' + fmtShort(v)).join(' | '), '| cabang/mg', sim.s.cabang.map((c) => fmtShort(c.lastWeek)).join(','), '| outlet', sim.s.outlets.length);
      console.log(`Th${d.year - 1} end: kas ${fmtShort(sim.s.money)} | ★${sim.stars().toFixed(2)} (R${sim.s.rasa.toFixed(0)} B${sim.s.bersih.toFixed(0)} M${sim.s.murah.toFixed(0)} A${sim.s.antrian.toFixed(0)} S${sim.s.suasana.toFixed(0)}) | ${STAGES[sim.s.stage - 1].name} | fans ${sim.s.fans} | staf ${sim.s.staff.length} | cabang ${sim.s.cabang.length}${sim.s.franchise ? ' +franchise' : ''} | cust/hari ${sim.s.yesterday?.customers} served ${sim.s.yesterday?.served} lost ${sim.s.yesterday ? sim.s.yesterday.left + sim.s.yesterday.balk + sim.s.yesterday.habis : 0} | biaya/bln ${fmtShort(sim.monthlyCosts())} | profit hari ${fmtShort(sim.s.history[sim.s.history.length - 1]?.profit ?? 0)}`);
    }
  }
  if (process.env.DBG && sim.s.bankrupt) console.log(trail.slice(-16).join('\n'));
  if (process.env.MONEYDIAG) console.log(Object.entries(md).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 30).map(([k, v]) => k + ' ' + fmtShort(v)).join('\n'));
  const t = sim.endingTitle();
  { const S = sim.s, x = S.stats2; const cities = new Set(S.outlets.map((o) => o.city).filter((c) => c !== 'home')).size; const big = S.outlets.some((o) => o.kind === 'mall') && S.outlets.some((o) => o.kind === 'bandara');
    const miss = [[careerScore2(sim) >= 90, 'score'], [S.franchise && !!S.brand, 'brand'], [cities >= 5, 'cities'], [big, 'mall+bandara'], [S.stage >= 6, 'stage'], [avgStars(sim) >= 4.25, 'avg'], [welfare(sim) >= 65, 'welfare'], [x.thrSkip === 0, 'thr'], [x.regGood >= 3, 'regGood'], [x.katFail <= 2, 'katFail'], [S.money > 0, 'money']].filter((c) => !c[0]).map((c) => c[1]);
    if (process.env.RAJA) console.log('raja miss:', miss.join(',') || '-', '| outlet royalti total', fmtShort(S.outlets.reduce((a, o) => a + o.total, 0)), 'upkeep', fmtShort(upk), 'tax', fmtShort(S.flags.pajakTotal ?? 0), 'kas', fmtShort(S.money), 'outlets', S.outlets.map((o) => o.kind[0]).join('')); }
  return { y5, y6, outlets: sim.s.outlets.length, welfare: welfare(sim), avgStars: avgStars(sim), sinks: Object.values(sim.s.sinks).reduce((a, b) => a + b, 0), cash7, regGood: sim.s.stats2.regGood, katDone: sim.s.stats2.katDone, katFail: sim.s.stats2.katFail + sim.s.stats2.katLate, score: t.score, bankrupt: sim.s.bankrupt, year: dateOf(sim.s.absDay).year, money: sim.s.money, stars: sim.stars(), stage: sim.s.stage, cabang: sim.s.cabang.length, fans: sim.s.fans, staff: sim.s.staff.length, franchise: sim.s.franchise, title: t.title, profit: sim.s.totals.profit, minMoney, ach: Object.keys(sim.s.achievements).length };
}

const res: Res[] = [];
for (let i = 0; i < runs; i++) res.push(runOne());
const avg = (f: (r: Res) => number) => res.reduce((a, r) => a + f(r), 0) / res.length;
const titles: Record<string, number> = {};
for (const r of res) titles[r.title] = (titles[r.title] ?? 0) + 1;
console.log(`\n== ${mode} x${runs}, ${years} th ==`);
console.log(`bangkrut: ${res.filter((r) => r.bankrupt).length}/${runs} | kas rata ${fmtShort(avg((r) => r.money))} | min kas rata ${fmtShort(avg((r) => r.minMoney))} | ★ ${avg((r) => r.stars).toFixed(2)} | stage ${avg((r) => r.stage).toFixed(1)} | cabang ${avg((r) => r.cabang).toFixed(1)} | franchise ${res.filter((r) => r.franchise).length} | fans ${Math.round(avg((r) => r.fans))} | prestasi ${avg((r) => r.ach).toFixed(1)}`);
console.log(`skor ${avg((r) => r.score).toFixed(1)} | welfare ${avg((r) => r.welfare).toFixed(0)} | ★avg28 ${avg((r) => r.avgStars).toFixed(2)} | investasi lv ${avg((r) => r.sinks).toFixed(1)} | kas th7 ${fmtShort(avg((r) => r.cash7))} | langganan good ${avg((r) => r.regGood).toFixed(1)} | katering ok ${avg((r) => r.katDone).toFixed(1)} telat/gagal ${avg((r) => r.katFail).toFixed(1)}`);
console.log('gelar:', JSON.stringify(titles));
const r5 = res.filter((r) => r.y5), r6 = res.filter((r) => r.y6);
console.log(`Rumah Makan: ${r5.length}/${runs} (rata th ${r5.length ? (r5.reduce((a, r) => a + r.y5, 0) / r5.length).toFixed(1) : '-'}) | Restoran Besar: ${r6.length}/${runs} (rata th ${r6.length ? (r6.reduce((a, r) => a + r.y6, 0) / r6.length).toFixed(1) : '-'}) | outlet nasional ${avg((r) => r.outlets).toFixed(1)}`);
if (res.some((r) => r.bankrupt)) console.log('bangkrut di tahun:', res.filter((r) => r.bankrupt).map((r) => r.year).join(','));
