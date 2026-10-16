// Prestasi: checked every evening (Sim.endDay) and after big actions. Pure (no Phaser).
import type { Sim } from './sim';
import { dateOf } from './state';

export interface Ach { id: string; name: string; desc: string; test: (sim: Sim) => boolean }
export const ACHIEVEMENTS: Ach[] = [
  { id: 'hari1', name: 'Buka Lapak', desc: 'Selesaikan hari pertama jualan.', test: (m) => m.s.absDay >= 1 },
  { id: 'cust100', name: 'Seratus Piring', desc: 'Layani 100 pelanggan.', test: (m) => m.s.totals.customers >= 100 },
  { id: 'cust1000', name: 'Seribu Perut Kenyang', desc: 'Layani 1.000 pelanggan.', test: (m) => m.s.totals.customers >= 1000 },
  { id: 'cust10000', name: 'Warung Legendaris', desc: 'Layani 10.000 pelanggan.', test: (m) => m.s.totals.customers >= 10000 },
  { id: 'cust50000', name: 'Pahlawan Perut Rakyat', desc: 'Layani 50.000 pelanggan.', test: (m) => m.s.totals.customers >= 50000 },
  { id: 'harian1jt', name: 'Sejuta Sehari', desc: 'Omzet sehari Rp 1 juta.', test: (m) => m.s.totals.bestDay >= 1e6 },
  { id: 'harian5jt', name: 'Omzet Juragan', desc: 'Omzet sehari Rp 5 juta.', test: (m) => m.s.totals.bestDay >= 5e6 },
  { id: 'kas100jt', name: 'Kas Gemuk', desc: 'Punya kas Rp 100 juta.', test: (m) => m.s.money >= 1e8 },
  { id: 'kas1m', name: 'Miliarder Warteg', desc: 'Punya kas Rp 1 miliar.', test: (m) => m.s.money >= 1e9 },
  { id: 'bintang3', name: 'Tiga Bintang', desc: 'Rating 3 bintang.', test: (m) => m.stars() >= 3 },
  { id: 'bintang4', name: 'Empat Bintang', desc: 'Rating 4 bintang.', test: (m) => m.stars() >= 4 },
  { id: 'bintang45', name: 'Hampir Sempurna', desc: 'Rating 4,5 bintang.', test: (m) => m.stars() >= 4.5 },
  { id: 'fans1000', name: 'Pelanggan Setia', desc: '1.000 fans.', test: (m) => m.s.fans >= 1000 },
  { id: 'fans10000', name: 'Fans Garis Keras', desc: '10.000 fans.', test: (m) => m.s.fans >= 10000 },
  { id: 'warteg', name: 'Naik Kelas', desc: 'Upgrade gerobak jadi Warteg Kecil.', test: (m) => m.s.stage >= 2 },
  { id: 'wartegbesar', name: 'Warteg Besar', desc: 'Punya Warteg Besar.', test: (m) => m.s.stage >= 4 },
  { id: 'cabang1', name: 'Cabang Pertama', desc: 'Buka cabang pertama.', test: (m) => m.s.cabang.length >= 1 },
  { id: 'cabang5', name: 'Gurita Warteg', desc: 'Punya 5 cabang.', test: (m) => m.s.cabang.length >= 5 },
  { id: 'franchise', name: 'Franchise Nasional', desc: 'Buka sistem franchise.', test: (m) => m.s.franchise },
  { id: 'resep5', name: 'Koki Penasaran', desc: 'Riset 5 resep / teknik.', test: (m) => m.s.researched.length >= 5 },
  { id: 'combo1', name: 'Paket Rahasia', desc: 'Temukan 1 paket combo.', test: (m) => m.s.combos.length >= 1 },
  { id: 'combo5', name: 'Raja Paket', desc: 'Temukan 5 paket combo.', test: (m) => m.s.combos.length >= 5 },
  { id: 'staf5', name: 'Tim Dapur', desc: 'Punya 5 staf.', test: (m) => m.s.staff.length >= 5 },
  { id: 'lv5', name: 'Koki Senior', desc: 'Punya staf level 5.', test: (m) => m.s.staff.some((x) => x.level >= 5) },
  { id: 'ojol', name: 'Go Digital', desc: 'Gabung aplikasi ojol.', test: (m) => Object.values(m.s.apps).some((a) => a.joined) },
  { id: 'dekor5', name: 'Warung Cantik', desc: 'Punya 5 dekorasi.', test: (m) => m.s.decor.length >= 5 },
  { id: 'viral', name: 'FYP!', desc: 'Viral gara-gara food vlogger.', test: (m) => m.s.totals.viral >= 1 },
  { id: 'sidak', name: 'Warung Sehat', desc: 'Lolos sidak Dinas Kesehatan.', test: (m) => m.s.totals.sidakLolos >= 1 },
  { id: 'tahun5', name: 'Lima Tahun Jualan', desc: 'Bertahan 5 tahun.', test: (m) => dateOf(m.s.absDay).year >= 6 },
  { id: 'tamat', name: 'Sepuluh Tahun Ngebul', desc: 'Selesaikan tahun ke-10.', test: (m) => dateOf(m.s.absDay).year >= 11 },
  // v1.3
  { id: 'kucing', name: 'Babu Kucing', desc: 'Adopsi kucing warteg.', test: (m) => m.s.cat.adopted },
  { id: 'kucingsayang', name: 'Kucing Kesayangan', desc: 'Rasa sayang kucing penuh (90+).', test: (m) => m.s.cat.adopted && m.s.cat.aff >= 90 },
  { id: 'katering1', name: 'Juru Katering', desc: 'Selesaikan 1 pesanan katering tepat waktu.', test: (m) => m.s.stats2.katDone >= 1 },
  { id: 'katering10', name: 'Raja Hajatan', desc: 'Selesaikan 10 pesanan katering.', test: (m) => m.s.stats2.katDone >= 10 },
  { id: 'langganan1', name: 'Teman Curhat', desc: 'Satu cerita pelanggan langganan happy ending.', test: (m) => m.s.stats2.regGood >= 1 },
  { id: 'langganan6', name: 'Warung Penuh Cerita', desc: 'Semua 6 cerita langganan happy ending.', test: (m) => m.s.stats2.regGood >= 6 },
  { id: 'thr3', name: 'Bos Amanah', desc: 'Bayar THR penuh 3 kali.', test: (m) => m.s.stats2.thrFull >= 3 },
  { id: 'hujan', name: 'Payung Rezeki', desc: 'Layani 300 pembeli pas hujan.', test: (m) => m.s.stats2.hujanServed >= 300 },
  { id: 'takjil', name: 'Juragan Takjil', desc: 'Jual 200 takjil pas Ramadan.', test: (m) => m.s.stats2.takjilSold >= 200 },
  { id: 'netizen', name: 'Admin Gercep', desc: 'Balas 3 komplain netizen.', test: (m) => m.s.stats2.komplainReplied >= 3 },
  { id: 'followers', name: 'Seleb Warteg', desc: '10.000 pengikut medsos.', test: (m) => m.s.followers >= 10000 },
  { id: 'ruko', name: 'Punya Ruko', desc: 'Beli ruko sendiri.', test: (m) => (m.s.sinks.ruko ?? 0) >= 1 },
  { id: 'dermawan', name: 'Pahlawan Kampung', desc: 'Renovasi kampung level 3.', test: (m) => (m.s.sinks.kampung ?? 0) >= 3 },
  { id: 'sponsor', name: 'Sponsor Jersey', desc: 'Sponsor PS Kali Bening level 2.', test: (m) => (m.s.sinks.bola ?? 0) >= 2 },
  { id: 'beasiswa', name: 'Bapak/Ibu Asuh', desc: 'Beasiswa anak staf level 2.', test: (m) => (m.s.sinks.beasiswa ?? 0) >= 2 },
  { id: 'mini90', name: 'Tangan Emas', desc: 'Skor 90+ di minigame dapur.', test: (m) => m.s.stats2.miniBest >= 90 },
  { id: 'mangkal3', name: 'Gerobak Keliling', desc: 'Coba mangkal di 3 tempat.', test: (m) => m.s.stats2.mangkalTried.length >= 3 },
  { id: 'satpol', name: 'Lolos Razia', desc: 'Lolos razia Satpol PP pakai izin.', test: (m) => m.s.stats2.satpolLolos >= 1 },
  { id: 'borong', name: 'Jago Borong', desc: 'Borong 50 kg bahan pas harga murah.', test: (m) => m.s.stats2.borong >= 50 },
  { id: 'receh', name: 'Dermawan Jalanan', desc: 'Kasih receh / jajan ke figuran jalan 20 kali.', test: (m) => m.s.stats2.tips >= 20 },
  // v1.4
  { id: 'rumahmakan', name: 'Rumah Makan Resmi', desc: 'Renovasi jadi Rumah Makan.', test: (m) => m.s.stage >= 5 },
  { id: 'restoran', name: 'Restoran Dua Lantai', desc: 'Renovasi jadi Restoran Besar.', test: (m) => m.s.stage >= 6 },
  { id: 'prasmanan', name: 'Ambil Sendiri!', desc: 'Jalankan prasmanan 14 hari.', test: (m) => m.s.stats2.prasmananDays >= 14 },
  { id: 'rombongan', name: 'Satu Bus Kenyang', desc: 'Layani 30 tamu rombongan bus.', test: (m) => m.s.stats2.busServed >= 30 },
  { id: 'meja', name: 'Silakan, Kak!', desc: 'Pelayan antar 500 piring ke meja.', test: (m) => m.s.stats2.mejaServed >= 500 },
  { id: 'vip', name: 'Tamu Kehormatan', desc: 'Sukses gelar acara di Ruang VIP.', test: (m) => m.s.stats2.vipAcara >= 1 },
  { id: 'brand', name: 'Punya Brand Sendiri', desc: 'Resmikan nama brand franchise.', test: (m) => m.s.franchise && !!m.s.brand },
  { id: 'outlet3', name: 'Lintas Kota', desc: 'Outlet brand di 3 kota lain.', test: (m) => new Set(m.s.outlets.map((o) => o.city).filter((c) => c !== 'home')).size >= 3 },
  { id: 'mall', name: 'Masuk Mall', desc: 'Buka outlet di mall.', test: (m) => m.s.outlets.some((o) => o.kind === 'mall') },
  { id: 'bandara', name: 'Terbang Tinggi', desc: 'Buka outlet di bandara.', test: (m) => m.s.outlets.some((o) => o.kind === 'bandara') },
  { id: 'kepala', name: 'Chef Kepala', desc: 'Rekrut Kepala Dapur.', test: (m) => m.s.staff.some((x) => x.role === 'kepala') },
  { id: 'manajer', name: 'Tangan Kanan', desc: 'Tempatkan manajer di cabang / outlet.', test: (m) => m.s.staff.some((x) => !!x.assign) },
];
export const ACH = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** returns newly earned achievement ids (and records them) */
export function checkAchievements(sim: Sim): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (sim.s.achievements[a.id] !== undefined) continue;
    let ok = false;
    try { ok = a.test(sim); } catch { ok = false; }
    if (ok) { sim.s.achievements[a.id] = sim.s.absDay; out.push(a.id); }
  }
  return out;
}
