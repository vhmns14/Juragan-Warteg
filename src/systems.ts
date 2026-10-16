// v1.3 systems on top of the pure Sim (no Phaser): weather, Ramadan / Lebaran extras, katering hajatan, pelanggan
// langganan (story arcs), the warteg cat, street figuran interactions, gejolak harga + news, netizen feed, staff drama,
// late-game investments, minigame bonuses, gerobak mangkal + satpol PP + lapak rivals, branching endings.
// Sim calls these from its hooks (startDay / simTick / serve / endDay / weekStart / monthStart / rollEvents / resolve).
import type { Sim, ChoiceEvent } from './sim';
import { DISH, INGS, CUST, LOC, STAGES, type IngId, type CustId } from './data';
import {
  KATERING, KAT_EFFORT, KAT_ING, REGULARS, PERKS, FIGURAN, SHOCKS, NEWS_FLAVOR, NETIZEN, NET_GOOD, NET_MID, NET_BAD, SINKS,
  MANGKAL, ENDINGS2, TIER_MIN, type FigKind, type MiniId, type RegReward, type EndingDef,
} from './data2';
import { type Staff, type KatOrder, type Post, dateOf, rnd, irnd, pick, clamp, fmtShort } from './state';

const inf = (sim: Sim) => sim.s.inflation;
const R = (n: number) => Math.round(n);

// ================================================================== helpers
export function hint(sim: Sim, id: string) {
  const f = sim.s.flags;
  if (f['hint_' + id]) return;
  f['hint_' + id] = 1;
  sim.emit({ type: 'hint', id });
}
export function mangkalDef(sim: Sim) { return MANGKAL.find((m) => m.id === sim.s.mangkal) ?? MANGKAL[0]; }
/** customer mix of the main warung today (gerobak: the mangkal spot) */
export function mixNow(sim: Sim): Partial<Record<CustId, number>> { return sim.s.stage === 1 ? mangkalDef(sim).mix : LOC[sim.s.loc].mix; }
export function locTraffic(sim: Sim) { return sim.s.stage === 1 ? mangkalDef(sim).traffic : LOC[sim.s.loc].traffic; }
export function hasPerk(sim: Sim, p: string) { return sim.s.perks.includes(p); }
export function sinkLv(sim: Sim, id: string) { return sim.s.sinks[id] ?? 0; }

/** multiplier on the quarter-hour arrival weight: Ramadan hours, gerobak mangkal peaks, the night guard perk */
export function hourMul(sim: Sim, t: number) {
  const h = 5 + t / 4;
  let w = 1;
  if (sim.isRamadan()) w *= h < 6 ? 3.2 : h < 15.5 ? 0.22 : h < 17.5 ? 1.15 : h < 19.25 ? 2.9 : 0.9;
  if (sim.s.stage === 1) for (const [a, b, k] of mangkalDef(sim).peaks) if (h >= a && h < b) w *= k;
  if (h >= 19 && hasPerk(sim, 'satpam')) w *= 1.25;
  return w;
}
export function rushLabel2(sim: Sim, tick: number): string | null {
  if (!sim.isRamadan()) return null;
  const h = 5 + tick / 4;
  if (h < 6) return 'SAHUR';
  if (h < 15.5) return 'SIANG PUASA';
  if (h < 17.5) return 'NGABUBURIT';
  if (h < 19.25) return 'BUKA PUASA';
  return 'TARAWIH';
}

// ================================================================== weather
export function rollWeather(sim: Sim) {
  const s = sim.s, m = sim.date.month;
  if (s.absDay > 0 && Math.random() < 0.42) return; // the weather tends to stay a day or two
  const wet = m >= 11 || m <= 2, dry = m >= 6 && m <= 9;
  const pH = wet ? 0.55 : dry ? 0.07 : 0.25, pP = wet ? 0.04 : dry ? 0.45 : 0.18;
  const r = Math.random();
  s.weather = r < pH ? 'hujan' : r < pH + pP ? 'panas' : 'normal';
}

// ================================================================== katering
export function katUnitCost(sim: Sim) {
  let c = 1500 * inf(sim); // box + packaging
  for (const [i, q] of Object.entries(KAT_ING)) c += (q ?? 0) * sim.marketPrice(i as IngId);
  return c;
}
export function katActive(sim: Sim) { return sim.s.katering.filter((k) => k.state === 'aktif'); }
export function offerKatering(sim: Sim) {
  const s = sim.s;
  const kinds = KATERING.filter((k) => k.stage <= s.stage);
  if (!kinds.length || katActive(sim).length >= 2) return false;
  const K = pick(kinds);
  const scale = 0.75 + Math.min(4, s.stage) * 0.12 + Math.max(0, s.stage - 4) * 0.08;
  const portions = Math.round(irnd(K.min, K.max) * scale / 5) * 5;
  const days = irnd(K.days[0], K.days[1]);
  const pay = Math.round(portions * K.pay * inf(sim) * (K.id === 'vip' && sim.has('karaoke') ? 1.2 : 1) / 1000) * 1000;
  const need = Math.ceil(portions * KAT_EFFORT / days);
  const cap = Math.round(sim.cookCap() * 0.45);
  const cost = Math.round(portions * katUnitCost(sim));
  const client = pick(K.clients);
  sim.queueChoice({
    id: 'katering', title: 'PESANAN KATERING',
    text: `${client} pesan ${K.name.toLowerCase()}: ${portions} porsi, diantar ${days} hari lagi.\nBayar ${fmtShort(pay)} (DP 30% sekarang). Bahan ~${fmtShort(cost)}.\nDapur butuh ~${need} tenaga/hari (jatah katering ${cap}${need > cap ? ', BAKAL KEWALAHAN' : ''}).`,
    choices: [
      { label: 'Terima!', act: 'terima', hint: need > cap ? 'Berisiko telat' : 'Untung gede' },
      { label: 'Terima + lembur', act: 'lembur', hint: 'Dapur ngebut, staf capek' },
      { label: 'Tolak halus', act: 'tolak' },
    ],
    data: { kind: K.id, portions, pay, due: s.absDay + days, client },
  });
  hint(sim, 'katering');
  return true;
}
function acceptKatering(sim: Sim, D: Record<string, number | string>, lembur: boolean) {
  const s = sim.s;
  const pay = Number(D.pay), dp = Math.round(pay * 0.3);
  const o: KatOrder = { id: s.katSeq++, kind: String(D.kind) as KatOrder['kind'], client: String(D.client), portions: Number(D.portions), pay, due: Number(D.due), prep: 0, lembur, state: 'aktif', dp, day: s.absDay };
  s.katering.push(o);
  if (s.katering.length > 14) s.katering = [...s.katering.filter((k) => k.state === 'aktif'), ...s.katering.filter((k) => k.state !== 'aktif').slice(-8)];
  sim.money(dp, 'revenue');
  sim.toast(`Katering diterima! DP ${fmtShort(dp)} masuk.`);
}
/** morning: deliver what is due, then cook today's share of the open orders (returns the effort used) */
export function prepKatering(sim: Sim): number {
  const s = sim.s;
  let used = 0;
  for (const o of katActive(sim).sort((a, b) => a.due - b.due)) {
    if (o.due <= s.absDay) { deliverKatering(sim, o); continue; }
    const need = o.portions - o.prep;
    if (need <= 0) continue;
    const daysLeft = Math.max(1, o.due - s.absDay);
    const want = Math.ceil(need / daysLeft * (o.lembur ? 1.15 : 1));
    const capAvail = sim.cookCap() * (o.lembur ? 0.78 : 0.45) - used;
    const can = Math.max(0, Math.floor(capAvail / KAT_EFFORT));
    const n = Math.min(need, want, can);
    if (n <= 0) continue;
    const cost = Math.round(n * katUnitCost(sim));
    sim.money(-cost, 'ingredients'); s.today.ingCost += cost;
    o.prep += n; used += n * KAT_EFFORT;
    if (o.lembur) for (const st of sim.byRole('masak')) st.energy = Math.max(5, st.energy - 7);
  }
  return used;
}
function deliverKatering(sim: Sim, o: KatOrder) {
  const s = sim.s;
  const ratio = o.prep / Math.max(1, o.portions);
  if (ratio >= 0.999) {
    o.state = 'selesai';
    sim.money(o.pay - o.dp, 'revenue');
    s.fans += R(20 + o.portions / 4);
    s.stats2.katDone++;
    if (o.kind === 'vip') s.stats2.vipAcara++;
    sim.addReview({ name: o.client, type: 'sistem', stars: 5, text: `Katering ${o.portions} porsi datang tepat waktu, rapi & enak. Makasih, Juragan!` });
    sim.toast(`Katering ${o.client} beres! Pelunasan ${fmtShort(o.pay - o.dp)} masuk.`);
  } else if (ratio >= 0.75) {
    o.state = 'telat';
    sim.money(R(o.pay * ratio * 0.8) - o.dp, 'revenue');
    s.fans = Math.max(0, s.fans - 30);
    s.effects.push({ id: 'jelek', until: s.absDay + 2, v: 0.92 });
    s.stats2.katLate++;
    sim.addReview({ name: o.client, type: 'sistem', stars: 2, text: `Katering kurang ${o.portions - o.prep} porsi, tamu ada yang nggak kebagian. Kecewa.` });
    sim.toast(`Katering ${o.client} kurang porsi! Bayaran dipotong.`);
  } else {
    o.state = 'gagal';
    const pen = R(o.pay * 0.15);
    sim.money(-o.dp - pen, 'other');
    s.fans = Math.max(0, R(s.fans * 0.96) - 60);
    s.effects.push({ id: 'jelek', until: s.absDay + 5, v: 0.8 });
    s.stats2.katFail++;
    sim.addReview({ name: o.client, type: 'sistem', stars: 1, text: 'Katering GAGAL. Acara kacau, tamu kelaparan. Jangan pesan di sini!' });
    addPost(sim, 'komplain', `Acara keluarga berantakan gara-gara katering ${s.name} nggak dateng`);
    sim.toast(`Katering ${o.client} GAGAL! DP dikembalikan + denda ${fmtShort(pen)}.`);
  }
}

// ================================================================== pelanggan langganan
export function maybeRegular(sim: Sim) {
  const s = sim.s;
  if (Math.random() > 0.16) return;
  const elig = REGULARS.filter((r) => {
    const st = s.regulars[r.id];
    if (st && (st.state === 'good' || st.state === 'bad')) return false;
    if (s.absDay < r.startDay || s.stage < r.minStage) return false;
    return !st || st.next <= s.absDay;
  });
  if (!elig.length) return;
  const r = pick(elig);
  const st = s.regulars[r.id] ?? (s.regulars[r.id] = { step: 0, aff: 20, next: 0, state: 'baru' });
  const step = r.steps[st.step];
  if (!step) return;
  sim.queueChoice({
    id: 'regular', title: r.name.toUpperCase(), text: `${r.role} · cerita ${st.step + 1}/${r.steps.length}\n${step.text}`,
    choices: step.choices.map((c, i) => ({ label: c.label, hint: c.hint, act: String(i) })),
    data: { rid: r.id, step: st.step, face: r.sprite + '_f' },
  });
  hint(sim, 'regular');
}
function applyReward(sim: Sim, r: RegReward) {
  const s = sim.s;
  if (r.money) sim.money(R(r.money * inf(sim)), 'revenue');
  if (r.fans) s.fans = Math.max(0, s.fans + r.fans);
  if (r.poin) s.poin += r.poin;
  if (r.followers) s.followers = Math.max(0, s.followers + r.followers);
  if (r.perk && !s.perks.includes(r.perk)) s.perks.push(r.perk);
  if (r.kasbonLost) s.totals.kasbonLost += R(r.kasbonLost * inf(sim));
  if (r.jelek) s.effects.push({ id: 'jelek', until: s.absDay + r.jelek, v: 0.85 });
  if (r.rating) for (const a of Object.values(s.apps)) a.rating = clamp(a.rating + r.rating, 1, 5);
}
function resolveRegular(sim: Sim, D: Record<string, number | string>, idx: number) {
  const s = sim.s;
  const r = REGULARS.find((x) => x.id === D.rid);
  if (!r) return;
  const st = s.regulars[r.id];
  if (!st || st.step !== Number(D.step)) return;
  const c = r.steps[st.step]?.choices[idx] ?? r.steps[st.step]?.choices[0];
  if (!c) return;
  let aff = c.aff;
  if (c.bersihCheck) aff = s.bersih >= 60 ? c.aff : -10;
  st.aff += aff;
  if (c.cost) sim.money(-R(c.cost * inf(sim)), 'other');
  if (c.gain) { const g = R(c.gain * inf(sim)); sim.money(g, 'revenue'); s.today.other += g; }
  if (c.energy) for (const x of sim.working()) x.energy = Math.max(5, x.energy - c.energy);
  if (c.followers) s.followers += c.followers;
  if (c.bersihCheck) sim.toast(s.bersih >= 60 ? 'Dapurnya bersih! Bosnya terkesan.' : 'Dapurnya... kurang bersih. Bosnya ilfil.');
  else if (aff >= 10) sim.toast(`${r.name} senang banget!`);
  else if (aff < 0) sim.toast(`${r.name} kelihatan kecewa...`);
  st.step++; st.state = 'jalan'; st.next = s.absDay + irnd(5, 9);
  if (st.step >= r.steps.length) {
    const good = st.aff >= r.need;
    st.state = good ? 'good' : 'bad';
    if (good) s.stats2.regGood++; else s.stats2.regBad++;
    const end = good ? r.good : r.bad;
    applyReward(sim, end.r);
    const parts: string[] = [];
    if (end.r.money) parts.push(`+${fmtShort(end.r.money * inf(sim))}`);
    if (end.r.fans) parts.push(`fans ${end.r.fans > 0 ? '+' : ''}${end.r.fans}`);
    if (end.r.perk) parts.push(`Bonus tetap: ${PERKS[end.r.perk]}`);
    sim.queueChoice({ id: 'info', title: good ? `CERITA ${r.name.toUpperCase()}: HAPPY END` : `CERITA ${r.name.toUpperCase()}: SAD END`, text: end.text + (parts.length ? '\n' + parts.join(' · ') : ''), choices: [{ label: good ? 'Terharu!' : 'Yah...', act: 'ok' }], data: { face: r.sprite + '_f' } });
  }
}

// ================================================================== kucing
export function catDaily(sim: Sim) {
  const s = sim.s, c = s.cat;
  if (!c.adopted) return;
  c.aff = clamp(c.aff + (c.fedDay >= s.absDay - 1 ? 3 : -7), 0, 100);
  // hungry cats steal fish
  const fish = ['ikangoreng', 'tongkol', 'pepes'].filter((id) => sim.totalStock(id) >= 1);
  if (Math.random() < 0.3 * (1 - c.aff / 110) && (fish.length || s.pantry.ikan > 0.3)) {
    let what = '';
    if (fish.length) { const id = pick(fish); const st = s.stock[id]; const n = Math.min(irnd(1, 3), Math.floor(st.fresh + st.old)); st.fresh = Math.max(0, st.fresh - n); what = `${n} porsi ${DISH[id].name}`; }
    else { s.pantry.ikan = Math.max(0, s.pantry.ikan - 0.4); what = 'ikan di gudang'; }
    c.stolen++; s.stats2.catSteal++;
    sim.emit({ type: 'cat', kind: 'steal' });
    sim.toast(`${c.name} nyolong ${what}! (Kasih makan biar nggak nakal)`);
  } else if (Math.random() < c.aff / 230) {
    s.effects.push({ id: 'kucing', until: s.absDay + 1, v: 1.06 });
    s.followers += 4;
    sim.emit({ type: 'cat', kind: 'happy' });
    sim.toast(`Pelanggan gemes sama ${c.name}, pada foto-foto. Warung rame!`);
  }
}
export function feedCat(sim: Sim): string | null {
  const s = sim.s, c = s.cat;
  if (!c.adopted) return 'Belum punya kucing';
  if (c.fedDay === s.absDay) return `${c.name} udah kenyang hari ini`;
  const cost = R(8000 * inf(sim));
  if (s.money < cost) return 'Uangnya kurang';
  sim.money(-cost, 'other');
  c.fedDay = s.absDay; c.aff = clamp(c.aff + 10, 0, 100);
  sim.emit({ type: 'cat', kind: 'eat' });
  return null;
}
export function petCat(sim: Sim): string | null {
  const s = sim.s, c = s.cat;
  if (!c.adopted) return 'Belum punya kucing';
  if (c.petDay === s.absDay) return `${c.name} lagi nggak mau dielus`;
  c.petDay = s.absDay; c.aff = clamp(c.aff + 3, 0, 100);
  return null;
}

// ================================================================== figuran jalanan
export function figuranAct(sim: Sim, kind: FigKind): string | null {
  const s = sim.s, F = FIGURAN[kind];
  const cost = R(F.cost * inf(sim));
  if (s.money < cost) return 'Uangnya kurang';
  sim.money(-cost, 'other');
  s.stats2.tips++;
  switch (kind) {
    case 'pengamen': s.suasana = Math.min(100, s.suasana + 0.6); s.fans += 1; return 'Pengamen nyanyi lagu favorit pelanggan. Suasana makin asik!';
    case 'parkir': s.effects.push({ id: 'parkir', until: s.absDay + 1, v: 1.04 }); return 'Parkiran rapi, pelanggan bermotor makin betah mampir.';
    case 'asongan': for (const st of sim.working()) st.energy = Math.min(100, st.energy + 4); return 'Kopi saset buat staf. Semangat lagi!';
    case 'hansip': s.effects.push({ id: 'aman', until: s.absDay + 3, v: 1 }); return 'Hansip janji ronda lewat warung 3 malam ke depan. Aman!';
  }
  return null;
}

// ================================================================== pasar: shocks + news
export function addNews(sim: Sim, text: string, kind: 'shock' | 'info' | 'iklan' = 'info') {
  const s = sim.s;
  s.news.push({ day: s.absDay, text, kind });
  if (s.news.length > 20) s.news.splice(0, s.news.length - 20);
}
export function shockMult(sim: Sim, ing: IngId) {
  let m = 1;
  for (const x of sim.s.shocks) if (x.ing === ing && x.until > sim.s.absDay) m *= x.mult;
  return m;
}
export function weeklyMarket(sim: Sim) {
  const s = sim.s;
  s.shocks = s.shocks.filter((x) => x.until > s.absDay);
  if (s.absDay > 10 && Math.random() < 0.24) {
    const wet = sim.isRainy();
    const opts = SHOCKS.filter((x) => !s.shocks.some((y) => y.ing === x.ing) && (!x.when || (x.when === 'hujan') === wet));
    if (opts.length) {
      const sh = pick(opts);
      s.shocks.push({ id: sh.id, ing: sh.ing, mult: sh.mult, until: s.absDay + sh.weeks * 7 });
      s.prices[sh.ing] = Math.round(s.prices[sh.ing] * (1 + (sh.mult - 1) * 0.75) / 100) * 100;
      addNews(sim, sh.text, 'shock');
      sim.toast('KABAR PASAR: ' + sh.text);
      hint(sim, 'harga');
    }
  }
  if (Math.random() < 0.55) { const t = pick(NEWS_FLAVOR); addNews(sim, t, t.startsWith('Iklan') ? 'iklan' : 'info'); }
}
export function gudangCap(sim: Sim) {
  return Math.round([30, 80, 150, 250][sim.s.stage - 1] * (sim.has('kulkas') ? 1.5 : 1) + (sinkLv(sim, 'ruko') ? 150 : 0));
}
export function pantryKg(sim: Sim) { return INGS.reduce((a, i) => a + sim.s.pantry[i.id], 0); }

// ================================================================== netizen
/** a feed line not used in the last few posts */
function fresh(sim: Sim, list: string[]) { const recent = sim.s.posts.slice(-6).map((p) => p.text); const ok = list.filter((t) => !recent.includes(t)); return pick(ok.length ? ok : list); }
export function addPost(sim: Sim, kind: Post['kind'], text: string, user = pick(NETIZEN)) {
  const s = sim.s;
  const likes = R((kind === 'viral' ? rnd(800, 3000) : kind === 'komplain' ? rnd(40, 400) : rnd(3, 120)) * (1 + s.followers / 2000));
  const p: Post = { id: ++s.postSeq, day: s.absDay, user, text, kind, likes };
  s.posts.push(p);
  if (s.posts.length > 30) s.posts.splice(0, s.posts.length - 30);
  return p;
}
/** a review may echo on the feed; a bad one may turn into a complaint that wants an answer */
export function onReview(sim: Sim, stars: number) {
  const s = sim.s;
  if (Math.random() > 0.3) return;
  if (stars >= 4) addPost(sim, 'good', fresh(sim, NET_GOOD));
  else if (stars === 3) addPost(sim, 'mid', fresh(sim, NET_MID));
  else {
    const last = s.flags.komplainDay ?? -99;
    if (s.absDay - last >= 6 && s.absDay > 12 && Math.random() < 0.5) {
      s.flags.komplainDay = s.absDay;
      const p = addPost(sim, 'komplain', fresh(sim, NET_BAD));
      sim.queueChoice({ id: 'komplain', title: 'KOMPLAIN NETIZEN!', text: `${p.user} posting:\n"${p.text}"\nUdah ${p.likes} like dan rame di kolom komentar. Gimana, Juragan?`, choices: [
        { label: 'Minta maaf & perbaiki', act: 'maaf', hint: 'Ampuh kalau rasa & bersih oke' },
        { label: `Kasih voucher (${fmtShort(300000 * inf(sim))})`, act: 'voucher', hint: 'Netizen luluh' },
        { label: 'Abaikan aja', act: 'abaikan', hint: 'Bisa makin rame...' }], data: { post: p.id } });
      hint(sim, 'medsos');
    } else addPost(sim, 'bad', fresh(sim, NET_BAD));
  }
}
function resolveKomplain(sim: Sim, act: string, postId: number) {
  const s = sim.s;
  const p = s.posts.find((x) => x.id === postId);
  if (act === 'maaf') {
    s.stats2.komplainReplied++;
    if (s.rasa >= 52 && s.bersih >= 45) { s.followers = R(s.followers * 1.02) + 10; s.fans += 20; if (p) p.replied = 'Admin minta maaf, netizen puas'; addPost(sim, 'balas', 'Salut adminnya gercep minta maaf & beneran berbenah'); }
    else { s.followers = R(s.followers * 0.99); s.fans = Math.max(0, s.fans - 10); if (p) p.replied = 'Minta maaf, tapi netizen belum percaya'; addPost(sim, 'mid', 'Maaf doang sih gampang, rasanya tetep gitu-gitu aja.'); }
  } else if (act === 'voucher') {
    s.stats2.komplainReplied++;
    sim.money(-R(300000 * inf(sim)), 'other');
    s.fans += 40; s.followers = R(s.followers * 1.03) + 15;
    if (p) p.replied = 'Dapat voucher, netizen luluh';
    addPost(sim, 'balas', 'Dikasih voucher sama warungnya, oke deh kukasih kesempatan kedua');
  } else {
    s.stats2.komplainIgnored++;
    if (Math.random() < 0.45) {
      s.effects.push({ id: 'jelek', until: s.absDay + 4, v: 0.85 });
      s.fans = Math.max(0, R(s.fans * 0.96)); s.followers = R(s.followers * 0.95);
      if (p) p.replied = 'Didiemin, jadi thread viral';
      addPost(sim, 'komplain', `THREAD: pengalaman buruk di ${s.name}. Adminnya diem aja!`);
      sim.toast('Komplain didiemin malah jadi thread viral... pelanggan berkurang.');
    } else if (p) p.replied = 'Didiemin, lama-lama tenggelam';
  }
}
export function dailySocial(sim: Sim) {
  const s = sim.s, T = s.today;
  s.followers = Math.max(0, R(s.followers * 0.998 + T.happy * 0.02 + (sim.effect('viral') ? 25 : 0)));
  if (Math.random() < 0.18 && T.served > 0) addPost(sim, T.happy > T.served * 0.6 ? 'good' : 'mid', fresh(sim, T.happy > T.served * 0.6 ? NET_GOOD : NET_MID));
}

// ================================================================== investasi
export function sinkCost(sim: Sim, id: string) {
  const k = SINKS.find((x) => x.id === id);
  if (!k) return 0;
  return Math.round(k.base * Math.pow(k.mult, sinkLv(sim, id)) * inf(sim) / 100000) * 100000;
}
export function buySink(sim: Sim, id: string): string | null {
  const s = sim.s, k = SINKS.find((x) => x.id === id);
  if (!k) return 'Nggak ada';
  const lv = sinkLv(sim, id);
  if (lv >= k.max) return 'Sudah maksimal';
  if (s.stage < k.stage) return `Butuh ${STAGES[k.stage - 1].name}`;
  const c = sinkCost(sim, id);
  if (c > s.money) return `Butuh ${fmtShort(c)}`;
  sim.money(-c, 'investment');
  s.stats2.investTotal += c;
  s.sinks[id] = lv + 1;
  if (id === 'kampung') { s.fans += 150 * (lv + 1); s.followers += 60 * (lv + 1); }
  if (id === 'bola') { s.fans += 100 * (lv + 1); s.followers += 80 * (lv + 1); }
  if (id === 'beasiswa') for (const st of s.staff) st.loyalty = clamp(st.loyalty + 10, 0, 100);
  if (id === 'ruko') s.suasana = Math.min(100, s.suasana + 4);
  return null;
}
/** what January will cost (sponsor season fee + scholarships), for the UI and careful players */
export function commitmentsPerYear(sim: Sim) {
  const s = sim.s;
  let total = 0; const k = SINKS.find((x) => x.id === 'bola')!;
  for (let l = 0; l < sinkLv(sim, 'bola'); l++) total += k.base * Math.pow(k.mult, l);
  return R(total * 0.06 * inf(sim) + 1500000 * sinkLv(sim, 'beasiswa') * s.staff.length * inf(sim));
}
/** January: the season fee of the sponsorship + the school fees of the scholarship */
export function yearlyCommitments(sim: Sim) {
  const s = sim.s;
  const bola = sinkLv(sim, 'bola');
  if (bola) {
    let total = 0; const k = SINKS.find((x) => x.id === 'bola')!;
    for (let l = 0; l < bola; l++) total += k.base * Math.pow(k.mult, l);
    const fee = R(total * 0.06 * inf(sim));
    sim.money(-fee, 'other');
    sim.toast(`Iuran musim PS Kali Bening: -${fmtShort(fee)}`);
  }
  const bs = sinkLv(sim, 'beasiswa');
  if (bs && s.staff.length) {
    const fee = R(1500000 * bs * s.staff.length * inf(sim));
    sim.money(-fee, 'salaries');
    sim.toast(`Biaya beasiswa anak staf tahun ini: -${fmtShort(fee)}`);
  }
}

// ================================================================== minigame bonuses
export function miniDone(sim: Sim, id: MiniId) { return sim.s.mini.day === sim.s.absDay && sim.s.mini.done.includes(id); }
export function applyMini(sim: Sim, id: MiniId, score: number): string | null {
  const s = sim.s;
  if (s.mini.day !== s.absDay) { s.mini.day = s.absDay; s.mini.done = []; }
  if (s.mini.done.includes(id)) return 'Udah main ini hari ini. Besok lagi!';
  score = clamp(Math.round(score), 0, 100);
  s.mini.done.push(id);
  s.mini.best[id] = Math.max(s.mini.best[id] ?? 0, score);
  s.stats2.miniPlays++; s.stats2.miniBest = Math.max(s.stats2.miniBest, score);
  const v = score / 100;
  const eff = id === 'sambal' ? 'm_sambal' : id === 'tempe' ? 'm_tempe' : 'm_piring';
  s.effects = s.effects.filter((e) => e.id !== eff);
  s.effects.push({ id: eff, until: s.absDay + (id === 'piring' ? 1 : 3), v });
  return null;
}
export const miniV = (sim: Sim, eff: string) => sim.effect(eff)?.v ?? 0;

// ================================================================== gerobak: mangkal, izin, satpol, lapak
export function setMangkal(sim: Sim, id: string, free = false): string | null {
  const s = sim.s;
  if (s.stage !== 1) return 'Cuma buat gerobak';
  if (!MANGKAL.some((m) => m.id === id)) return 'Nggak ada';
  if (s.mangkal === id) return 'Udah mangkal di sini';
  const c = free ? 0 : R(150000 * inf(sim));
  if (c > s.money) return 'Uangnya kurang';
  if (c) sim.money(-c, 'other');
  s.mangkal = id;
  if (!s.stats2.mangkalTried.includes(id)) s.stats2.mangkalTried.push(id);
  return null;
}
export function buyIzin(sim: Sim): string | null {
  const s = sim.s;
  if (s.izinPKL) return 'Udah punya izin';
  const c = R(750000 * inf(sim));
  if (c > s.money) return 'Uangnya kurang';
  sim.money(-c, 'other'); s.izinPKL = true;
  return null;
}

// ================================================================== events (called from Sim.rollEvents)
/** v1.3 random events; returns true when one fired (Sim sets its cooldown) */
export function rollEvents2(sim: Sim, r: number): boolean {
  const s = sim.s, f = s.flags, d = sim.date;
  // the cat shows up once
  if (!s.cat.offered && s.absDay >= 8 && Math.random() < 0.07) {
    s.cat.offered = true;
    sim.queueChoice({ id: 'kucing', title: 'ADA KUCING!', text: `Kucing oren kurus nongkrong di depan ${s.stage === 1 ? 'gerobak' : 'warung'}, ngeliatin etalase sambil meong-meong.`, choices: [
      { label: `Adopsi! Namanya ${s.cat.name}`, act: 'adopsi', hint: 'Lucu, tapi kadang nakal' }, { label: 'Usir pelan-pelan', act: 'usir' }], data: { face: 'cat_sit' } });
    return true;
  }
  // gerobak: satpol PP + rival lapak
  if (s.stage === 1 && s.absDay > 6) {
    const M = mangkalDef(sim);
    if (Math.random() < M.satpol * (s.izinPKL ? 0.5 : 1)) {
      sim.emit({ type: 'visitor', kind: 'satpol' });
      if (s.izinPKL) { s.stats2.satpolLolos++; sim.queueChoice({ id: 'info', title: 'RAZIA SATPOL PP!', text: 'Petugas Satpol PP patroli. Kamu tunjukkin izin PKL... aman, boleh lanjut jualan!', choices: [{ label: 'Lega...', act: 'ok' }] }); }
      else sim.queueChoice({ id: 'satpol', title: 'RAZIA SATPOL PP!', text: `Satpol PP razia PKL di ${M.short.toLowerCase()}! Gerobak tanpa izin bisa diangkut.`, choices: [
        { label: 'Kabur bawa gerobak', act: 'kabur', hint: 'Lauk tumpah, 2 hari sepi' }, { label: `Bayar denda (${fmtShort(300000 * inf(sim))})`, act: 'denda' }, { label: `Urus izin PKL (${fmtShort(750000 * inf(sim))})`, act: 'izin', hint: 'Aman seterusnya' }] });
      return true;
    }
    if (s.absDay > 14 && !sim.effect('lapak') && Math.random() < 0.012) {
      s.effects.push({ id: 'lapak', until: s.absDay + 14, v: 0.82 });
      sim.queueChoice({ id: 'lapak', title: 'SAINGAN LAPAK!', text: `Gerobak "Nasi Rames Bang Jali" mangkal persis di sebelahmu di ${M.short.toLowerCase()}. Pelanggan kebagi dua!`, choices: [
        { label: 'Perang harga 10 hari', act: 'perang', hint: 'Harga -10%' }, { label: 'Pindah mangkal (gratis)', act: 'pindah' }, { label: `Ajak bagi wilayah (${fmtShort(200000 * inf(sim))})`, act: 'bagi' }] });
      return true;
    }
  }
  // netizen: a video of the warung goes viral
  if (r < 0.012 && sim.stars() >= 3.4 && s.followers >= 200 && s.absDay > 30) {
    s.effects.push({ id: 'viral', until: s.absDay + 3, v: 1.35 });
    s.followers = R(s.followers * 1.2) + 300; s.totals.viral++;
    const p = addPost(sim, 'viral', `POV: nemu warteg enak + murah di ${LOC[s.loc].short.toLowerCase()} #WartegViral`);
    sim.queueChoice({ id: 'info', title: 'FYP!', text: `Video pelanggan makan di warungmu FYP! ${p.likes.toLocaleString('id-ID')} like.\n3 hari ke depan bakal rame, siapin stok!`, choices: [{ label: 'Gas!', act: 'ok' }] });
    hint(sim, 'medsos');
    return true;
  }
  // katering offers (replaces the old one-shot hajatan)
  const katChance = s.stage === 1 ? 0.012 : 0.022 + s.stage * 0.004;
  if (r > 0.12 && r < 0.12 + katChance && s.absDay > 10 && offerKatering(sim)) return true;
  // staff drama
  if (s.staff.length >= 2 && s.absDay > 50 && Math.random() < 0.03) {
    if (staffDrama(sim)) { hint(sim, 'drama'); return true; }
  }
  // sponsor: home match nobar
  if (sinkLv(sim, 'bola') && sim.has('tv') && Math.random() < 0.02 * sinkLv(sim, 'bola')) {
    s.effects.push({ id: 'nobar', until: s.absDay + 1, v: 1.25 + 0.05 * sinkLv(sim, 'bola') });
    sim.toast('PS Kali Bening main kandang malam ini! Nobar di warung, rame!');
    return true;
  }
  void d; void f;
  return false;
}

function staffDrama(sim: Sim): boolean {
  const s = sim.s;
  const r = Math.random();
  const list = [...s.staff];
  if (r < 0.34) {
    const a = pick(list.filter((x) => x.pair === undefined));
    const b = a && list.find((x) => x !== a && x.female !== a.female && x.pair === undefined);
    if (!a || !b) return false;
    sim.queueChoice({ id: 'cinlok', title: 'CINLOK DI DAPUR!', text: `${a.name} (${a.role === 'masak' ? 'juru masak' : a.role}) dan ${b.name} ketahuan sering curi-curi pandang pas ngulek sambal. Kayaknya jadian!`, choices: [
      { label: 'Restui, asal profesional', act: 'restu', hint: 'Dua-duanya makin betah' }, { label: 'Larang pacaran di warung', act: 'larang', hint: 'Loyal turun' }, { label: 'Pura-pura nggak tahu', act: 'cuek' }], data: { a: a.id, b: b.id } });
    return true;
  }
  if (r < 0.67) {
    const a = pick(list); const b = pick(list.filter((x) => x !== a));
    if (!a || !b) return false;
    const why = pick(['rebutan kompor', 'saling tuduh lauk gosong', 'beda selera lagu radio', 'giliran cuci piring']);
    sim.queueChoice({ id: 'berantem', title: 'STAF BERANTEM!', text: `${a.name} dan ${b.name} adu mulut gara-gara ${why}. Pelanggan sampai noleh semua.`, choices: [
      { label: `Damaikan + traktir (${fmtShort(150000 * inf(sim))})`, act: 'damai' }, { label: `Bela ${a.name}`, act: 'a' }, { label: `Bela ${b.name}`, act: 'b' }], data: { a: a.id, b: b.id } });
    return true;
  }
  const c = [...list].sort((x, y) => x.loyalty - y.loyalty)[0];
  if (!c || s.staff.length < 3) return false;
  const why = pick(['mau pulang kampung, orang tuanya sakit', 'dilamar orang kampung sebelah', 'ditawarin kerja di pabrik']);
  sim.queueChoice({ id: 'resign', title: 'MENDADAK RESIGN', text: `${c.name} pamit: ${why}. "Maaf ya, Juragan, mulai minggu depan..."`, choices: [
    { label: `Tahan: bonus 2x gaji (${fmtShort(c.salary * 2)})`, act: 'tahan', hint: 'Belum tentu mau' }, { label: `Relakan + pesangon (${fmtShort(c.salary)})`, act: 'pesangon', hint: 'Staf lain respek' }, { label: 'Relakan aja', act: 'relakan' }], data: { id: c.id } });
  return true;
}
/** staff leaves (resign / poached / fired): the cinlok partner takes it hard */
export function staffLeaves(sim: Sim, st: Staff, why: 'resign' | 'fired') {
  const s = sim.s;
  s.staff = s.staff.filter((x) => x.id !== st.id);
  if (why === 'fired') s.stats2.fired++; else s.stats2.resign++;
  if (st.pair !== undefined) {
    const p = s.staff.find((x) => x.id === st.pair);
    if (p) { p.pair = undefined; p.loyalty = clamp(p.loyalty - 25, 0, 100); sim.toast(`${p.name} patah hati ditinggal ${st.name}...`); }
  }
  sim.emit({ type: 'staffChange' });
}

/** v1.3 choice resolutions; returns false when the id is not one of ours */
export function resolveExt(sim: Sim, ev: ChoiceEvent, act: string, idx: number): boolean {
  const s = sim.s, D = ev.data ?? {};
  const byId = (k: string) => s.staff.find((x) => x.id === Number(D[k]));
  switch (ev.id) {
    case 'katering': if (act === 'terima' || act === 'lembur') acceptKatering(sim, D, act === 'lembur'); return true;
    case 'regular': resolveRegular(sim, D, idx); return true;
    case 'kucing': if (act === 'adopsi') { s.cat.adopted = true; s.cat.fedDay = s.absDay; sim.emit({ type: 'cat', kind: 'adopt' }); hint(sim, 'kucing'); } return true;
    case 'komplain': resolveKomplain(sim, act, Number(D.post)); return true;
    case 'satpol':
      if (act === 'kabur') {
        for (const st of Object.values(s.stock)) { st.fresh = Math.floor(st.fresh * 0.6); st.old = Math.floor(st.old * 0.6); }
        s.effects.push({ id: 'razia', until: s.absDay + 2, v: 0.8 }); s.stats2.satpolKena++;
        sim.toast('Kabur! Lauk tumpah separuh, besok-besok pelanggan bingung nyari.');
      } else if (act === 'denda') { sim.money(-R(300000 * inf(sim)), 'other'); s.stats2.satpolKena++; }
      else { const e = buyIzin(sim); if (e) { sim.money(-R(300000 * inf(sim)), 'other'); s.stats2.satpolKena++; sim.toast('Uangnya kurang buat izin, terpaksa bayar denda.'); } else { s.stats2.satpolLolos++; sim.toast('Izin PKL beres! Razia berikutnya aman.'); } }
      return true;
    case 'lapak':
      if (act === 'perang') { s.effects.push({ id: 'perang', until: s.absDay + 10, v: 1 }); s.effects = s.effects.filter((e) => e.id !== 'lapak'); s.effects.push({ id: 'lapak', until: s.absDay + 10, v: 0.93 }); }
      else if (act === 'pindah') { const other = MANGKAL.filter((m) => m.id !== s.mangkal); setMangkal(sim, pick(other).id, true); s.effects = s.effects.filter((e) => e.id !== 'lapak'); sim.toast(`Gerobak pindah ke ${mangkalDef(sim).short}.`); }
      else { sim.money(-R(200000 * inf(sim)), 'other'); s.effects = s.effects.filter((e) => e.id !== 'lapak'); s.effects.push({ id: 'lapak', until: s.absDay + 20, v: 0.95 }); }
      return true;
    case 'cinlok': {
      const a = byId('a'), b = byId('b');
      if (!a || !b) return true;
      if (act === 'restu') { a.pair = b.id; b.pair = a.id; a.loyalty = clamp(a.loyalty + 10, 0, 100); b.loyalty = clamp(b.loyalty + 10, 0, 100); sim.toast(`${a.name} & ${b.name} makin semangat kerja!`); }
      else if (act === 'larang') { a.loyalty = clamp(a.loyalty - 12, 0, 100); b.loyalty = clamp(b.loyalty - 12, 0, 100); }
      else if (Math.random() < 0.5) { a.pair = b.id; b.pair = a.id; a.loyalty += 4; b.loyalty += 4; }
      return true;
    }
    case 'berantem': {
      const a = byId('a'), b = byId('b');
      if (!a || !b) return true;
      if (act === 'damai') { sim.money(-R(150000 * inf(sim)), 'other'); a.loyalty = clamp(a.loyalty + 4, 0, 100); b.loyalty = clamp(b.loyalty + 4, 0, 100); sim.toast('Makan bareng, baikan lagi. Adem.'); }
      else { const [w, l] = act === 'a' ? [a, b] : [b, a]; w.loyalty = clamp(w.loyalty + 8, 0, 100); l.loyalty = clamp(l.loyalty - 15, 0, 100); sim.toast(`${l.name} ngambek berat...`); }
      return true;
    }
    case 'resign': {
      const c = byId('id');
      if (!c) return true;
      if (act === 'tahan') {
        sim.money(-c.salary * 2, 'salaries');
        if (Math.random() < 0.4 + c.loyalty / 200 + sinkLv(sim, 'beasiswa') * 0.08) { c.loyalty = clamp(c.loyalty + 15, 0, 100); sim.toast(`${c.name} akhirnya bertahan. Fiuh!`); }
        else { staffLeaves(sim, c, 'resign'); sim.toast(`${c.name} tetap pamit. Bonusnya buat ongkos pulang...`); }
      } else if (act === 'pesangon') { sim.money(-c.salary, 'salaries'); staffLeaves(sim, c, 'resign'); for (const x of s.staff) x.loyalty = clamp(x.loyalty + 4, 0, 100); }
      else { staffLeaves(sim, c, 'resign'); for (const x of s.staff) x.loyalty = clamp(x.loyalty - 3, 0, 100); }
      return true;
    }
  }
  return false;
}

// ================================================================== welfare + endings
export function welfare(sim: Sim) {
  const s = sim.s, x = s.stats2;
  const loy = s.staff.length ? s.staff.reduce((a, b) => a + b.loyalty, 0) / s.staff.length : 50;
  const avgE = s.staff.length ? s.staff.reduce((a, b) => a + b.energy, 0) / s.staff.length : 60;
  const w = loy * 0.6 + Math.min(15, x.thrFull * 3) + Math.min(15, sinkLv(sim, 'beasiswa') * 2.5) - x.thrSkip * 15 - x.fired * 2 - x.mogok * 6 - x.resign + (avgE > 60 ? 5 : 0);
  return Math.round(clamp(w, 0, 100));
}
export function dermawan(sim: Sim) {
  const x = sim.s.stats2;
  return sinkLv(sim, 'kampung') * 2 + sinkLv(sim, 'beasiswa') * 2 + sinkLv(sim, 'bola') + x.regGood * 1.5 + (x.katDone >= 10 ? 1 : 0) + Math.min(2, x.tips / 30);
}
export function avgStars(sim: Sim) {
  const h = sim.s.history;
  return h.length ? h.reduce((a, b) => a + b.stars, 0) / h.length : sim.stars();
}
/** v1.3 career score 0..100: profit, sustained rating, size, staff welfare, stories. Harder than v1.0 */
export function careerScore2(sim: Sim) {
  const s = sim.s;
  const profit = Math.max(0, s.totals.profit);
  let sc = Math.min(22, Math.log10(1 + profit / 5e7) * 8.5);
  sc += clamp((avgStars(sim) - 2.8) / 1.6 * 16, 0, 16) + clamp((s.totals.maxStars - 3.5) * 4, 0, 4);
  // v1.4: 6 stages (max 15) + town cabang + the national franchise (brand outlets, cities, mall / bandara)
  const nat = new Set(s.outlets.map((o) => o.city)).size;
  sc += Math.min(3, s.stage - 1) * 4 + Math.max(0, s.stage - 4) * 1.5 + Math.min(10, s.cabang.length * 1.5) + (s.franchise ? 6 : 0) + Math.min(5, nat * 0.9 + s.outlets.filter((o) => o.kind !== 'kota').length * 0.6);
  sc += Math.min(8, Object.keys(s.achievements).length / 5);
  sc += welfare(sim) / 100 * 12;
  sc += Math.min(10, s.stats2.regGood * 1.5 + Object.values(s.sinks).reduce((a, b) => a + b, 0) * 0.2);
  if (s.money < 0) sc -= 10;
  return Math.round(clamp(sc, 0, 100));
}
export function endingFor(sim: Sim): EndingDef & { score: number } {
  const s = sim.s, x = s.stats2;
  const sc = careerScore2(sim);
  const E = (id: string) => ({ ...ENDINGS2.find((e) => e.id === id)!, score: sc });
  const wf = welfare(sim), avg = avgStars(sim);
  const invest = Object.values(s.ledger).reduce((a, L) => a + L.investment, 0);
  if (s.bankrupt) return E(invest > 60e6 || x.investTotal > 0 || s.decor.length >= 6 ? 'gengsi' : 'gulung');
  // v1.4: the national king also needs a real national brand: outlets in 5+ other cities incl. a mall AND a bandara,
  // and the two-storey Restoran Besar at home
  const cities = new Set(s.outlets.map((o) => o.city).filter((c) => c !== 'home')).size;
  const big = s.outlets.some((o) => o.kind === 'mall') && s.outlets.some((o) => o.kind === 'bandara');
  if (sc >= 90 && s.franchise && !!s.brand && cities >= 5 && big && s.stage >= 6 && avg >= 4.25 && wf >= 65 && x.thrSkip === 0 && x.regGood >= 3 && x.katFail <= 2 && s.money > 0) return E('raja');
  if (dermawan(sim) >= 20 && wf >= 65 && sc >= 60) return E('dermawan');
  if (sc >= 65 && (wf < 35 || x.thrSkip >= 2)) return E('galak');
  if (s.money < 0 && (x.investTotal >= 1e8 || s.decor.length >= 8)) return E('gengsi');
  if (x.kasbonGiven >= 30e6 && s.totals.kasbonLost >= 6e6 && s.fans >= 3000) return E('kasbon');
  if (s.stage <= 2 && s.totals.maxStars >= 4 && x.regGood >= 3) return E('legenda');
  let t = 0;
  for (let i = 0; i < TIER_MIN.length; i++) if (sc >= TIER_MIN[i]) t = i;
  return E('t' + t);
}

// ================================================================== misc daily hooks
export function dailyExtras(sim: Sim) {
  const s = sim.s, d = sim.date;
  // Lebaran day: everybody is home the first two days; arus balik the week after
  const lm = sim.lebaranMonth();
  if (d.month === lm && d.week === 1 && d.day === 1 && !s.flags['lebaran' + d.year]) {
    s.flags['lebaran' + d.year] = 1;
    s.effects.push({ id: 'lebaran', until: s.absDay + 2, v: 0.55 });
    sim.toast('Selamat Idul Fitri! Mohon maaf lahir batin. Dua hari ini warga masih silaturahmi, warung sepi.');
  }
  if (d.month === lm && d.week === 2 && d.day === 1 && !s.flags['balik' + d.year]) {
    s.flags['balik' + d.year] = 1;
    s.effects.push({ id: 'balik', until: s.absDay + 7, v: 1.3 });
    sim.toast('Arus balik! Perantau balik ke kota bawa lapar. Seminggu rame!');
  }
  // THR skipped: the staff may strike for a day or two
  if (s.flags.mogokRisk && s.flags.mogokRisk > s.absDay && !sim.effect('mogok') && Math.random() < 0.25) {
    s.flags.mogokRisk = 0;
    s.effects.push({ id: 'mogok', until: s.absDay + 2, v: 0.5 });
    s.stats2.mogok++;
    sim.toast('Staf MOGOK kerja gara-gara THR nggak dibayar! Dapur & layanan setengah tenaga.');
  }
  if (sim.isRamadan() && d.dom === 1) hint(sim, 'ramadan');
  if (s.absDay === 3) hint(sim, 'mini');
  if (s.absDay === 12 && s.stage === 1) hint(sim, 'mangkal');
  if (s.money > 120e6 && s.stage >= 2) hint(sim, 'investasi');
  if (s.weather === 'hujan') hint(sim, 'hujan');
  else if (s.weather === 'panas' && s.absDay > 2) hint(sim, 'panas');
  // arisan perk: Bu Ningsih's weekly order
  if (hasPerk(sim, 'arisan') && d.day === 5) { const m = R(rnd(300000, 800000) * inf(sim)); sim.money(m, 'revenue'); s.today.other += m; sim.toast(`Pesanan arisan Bu Ningsih: +${fmtShort(m)}`); }
  void dateOf;
}
/** night: a thief may visit unless the hansip / Pak Darto keeps watch */
export function nightCheck(sim: Sim) {
  const s = sim.s;
  if (s.stage < 2 || hasPerk(sim, 'satpam') || sim.effect('aman')) return;
  if (Math.random() < 0.01 && s.today.revenue > 0) {
    const loss = R(s.today.revenue * rnd(0.2, 0.45));
    sim.money(-loss, 'other');
    s.stats2.maling++;
    sim.toast(`Ada maling semalam! Kas hilang ${fmtShort(loss)}. (Kasih kopi ke hansip biar rajin ronda)`);
    hint(sim, 'figuran');
  }
}
/** customer-type multiplier from perks and events */
export function typeMul(sim: Sim, t: CustId) {
  let w = 1;
  if (t === 'mhs' && hasPerk(sim, 'mhs')) w *= 1.15;
  if ((t === 'buruh' || t === 'mandor') && hasPerk(sim, 'kuli')) w *= 1.15;
  if (t === 'kantor' && hasPerk(sim, 'kantor')) w *= 1.15;
  if (t === 'ojol' && hasPerk(sim, 'ojol')) w *= 1.15;
  if ((t === 'buruh' || t === 'ojol') && sim.effect('balik')) w *= 1.3;
  // v1.4: the Restoran Besar's parkiran brings families and office people by car
  if (sim.s.stage >= 6 && (t === 'kantor' || t === 'ibu' || t === 'mandor')) w *= 1.2;
  return w;
}
export function trafficMul(sim: Sim) {
  const s = sim.s;
  let m = (1 + 0.025 * sinkLv(sim, 'kampung') + 0.03 * sinkLv(sim, 'bola'));
  m *= s.weather === 'hujan' ? 0.75 : s.weather === 'panas' ? 0.97 : 1;
  for (const id of ['balik', 'lebaran', 'lapak', 'razia', 'kucing', 'parkir']) { const e = sim.effect(id); if (e) m *= e.v; }
  return m;
}
void CUST;
