// v1.4 data: national franchise (fictional cities, outlet kinds incl. mall + bandara), brand name ideas, rombongan /
// VIP acara events, new hints. All names are fictional.

/** cities on the national map (px / py on the 560x300 procedural archipelago map). home = the player's own town */
export interface City { id: string; name: string; px: number; py: number; pop: number; mall: boolean; bandara: boolean; unlockYear: number; desc: string }
export const CITIES: City[] = [
  { id: 'home', name: 'Kota Kali Bening', px: 252, py: 180, pop: 1, mall: true, bandara: false, unlockYear: 1, desc: 'Kota asal warungmu. Semua cabang lokal ada di sini.' },
  { id: 'pesisir', name: 'Pesisir Raya', px: 146, py: 178, pop: 1.5, mall: true, bandara: true, unlockYear: 1, desc: 'Ibu kota provinsi, macet, kantoran di mana-mana.' },
  { id: 'kembang', name: 'Bukit Kembang', px: 200, py: 200, pop: 1.1, mall: true, bandara: false, unlockYear: 1, desc: 'Kota sejuk, mahasiswa & wisatawan akhir pekan.' },
  { id: 'teluk', name: 'Teluk Mutiara', px: 318, py: 188, pop: 1.3, mall: true, bandara: true, unlockYear: 1, desc: 'Kota pelabuhan, buruh & pelaut doyan porsi besar.' },
  { id: 'tepian', name: 'Kota Tepian', px: 118, py: 92, pop: 1.2, mall: true, bandara: true, unlockYear: 1, desc: 'Di pulau seberang. Perantau rindu masakan rumah.' },
  { id: 'gunungsari', name: 'Gunung Sari', px: 372, py: 206, pop: 0.8, mall: false, bandara: false, unlockYear: 1, desc: 'Kota kecil di kaki gunung, sewa murah.' },
  { id: 'danau', name: 'Danau Biru', px: 300, py: 82, pop: 1.0, mall: true, bandara: true, unlockYear: 1, desc: 'Kota tambang & perkebunan, gaji besar.' },
  { id: 'cakrawala', name: 'Cakrawala Timur', px: 452, py: 150, pop: 1.4, mall: true, bandara: true, unlockYear: 1, desc: 'Kota baru di timur, bandaranya paling sibuk.' },
];
export const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c])) as Record<string, City>;

export type OutletKind = 'kota' | 'mall' | 'bandara';
/** outlet kinds: cost to open (one-time, Rp, x inflation), upkeep per month, base weekly gross per outlet, royalty share */
export interface OutletDef { id: OutletKind; name: string; short: string; cost: number; upkeep: number; gross: number; needStage: number; desc: string }
export const OUTLETS: OutletDef[] = [
  { id: 'kota', name: 'Outlet Kota (mitra)', short: 'Kota', cost: 90e6, upkeep: 3e6, gross: 30e6, needStage: 4, desc: 'Mitra buka di ruko pinggir jalan. Kamu dapat royalti, bayar pendampingan.' },
  { id: 'mall', name: 'Outlet Mall', short: 'Mall', cost: 260e6, upkeep: 10e6, gross: 65e6, needStage: 5, desc: 'Food court mal. Rame tiap akhir pekan, sewa mahal.' },
  { id: 'bandara', name: 'Outlet Bandara', short: 'Bandara', cost: 620e6, upkeep: 22e6, gross: 140e6, needStage: 6, desc: 'Di terminal bandara: harga premium, penumpang nggak sempat nawar.' },
];
export const OUTLET = Object.fromEntries(OUTLETS.map((o) => [o.id, o])) as Record<OutletKind, OutletDef>;
/** royalty share the brand keeps from an outlet's weekly gross */
export const ROYALTY = 0.07;
/** v1.4 monthly running costs of the big rooms by stage (listrik AC, genset, parkir, kebersihan), x inflation */
export const ROOM_UPKEEP = [0, 0, 0, 0, 45e6, 150e6];
/** the national franchise level-up (after the town franchise) */
export const NATIONAL = { maxOutlets: 18, maxPerCity: 3 };

/** brand name ideas (the player can type their own) */
export const BRAND_IDEAS = ['Warteg Nusantara Rasa', 'Dapur Juragan', 'Warteg Kilat Kenyang', 'Rumah Makan Sambal Nenek', 'Warteg Bahagia Group', 'Dapur Sederhana Kita', 'Warteg Kenyang Nusantara', 'Nasi Rames Juragan'];

/** rombongan (tour bus) groups */
export const ROMBONGAN = ['rombongan ziarah dari Gunung Sari', 'bus pariwisata SMA', 'rombongan arisan ibu PKK', 'tim futsal antar kampung', 'rombongan study tour mahasiswa', 'karyawan pabrik outing'];
/** VIP acara (Restoran Besar): ruang VIP booked for an event, pays more than a katering order */
export const VIP_ACARA = [
  { id: 'ultah', name: 'Pesta Ultah', guests: [20, 40], pay: 85000 },
  { id: 'rapat', name: 'Rapat Kantor', guests: [15, 30], pay: 95000 },
  { id: 'lamaran', name: 'Acara Lamaran', guests: [30, 60], pay: 110000 },
  { id: 'reuni', name: 'Reuni Angkatan', guests: [25, 50], pay: 90000 },
];

export const HINTS3: Record<string, string> = {
  pajak: 'Tiap Januari ada pajak penghasilan kalau untung setahun di atas Rp 300 jt (25%, di atas Rp 1,2 M 45%). Tenang, pajaknya nggak pernah lebih dari separuh kas di atas biaya 2 bulan. Rumah Makan & Restoran juga punya biaya operasional bulanan.',
  rumahmakan: 'RUMAH MAKAN! Ruangan lebih luas, 28 slot lauk, resep baru di Riset. Nyalakan PRASMANAN di Masak, dan pelayan sekarang nganter piring ke meja.',
  prasmanan: 'Prasmanan: pelanggan ambil lauk sendiri, antrian lebih cepat & belanja lebih banyak, tapi sisa makanan naik dan butuh pelayan buat isi ulang.',
  restoran: 'RESTORAN BESAR! Dua lantai (tombol Lantai 2 di pojok), parkiran mobil, Ruang VIP buat acara, dan rombongan bus bisa mampir.',
  lantai2: 'Lantai 2: aula makan + Ruang VIP. Tamu yang dapat kursi di atas naik tangga.',
  kepala: 'Kepala Dapur memimpin juru masak: rasa naik dan dapur lebih cepat. Cukup satu orang.',
  manajer: 'Manajer bisa ditempatkan di cabang / outlet (Staf > detail) buat naikkin laba mingguannya.',
  shift: 'Kasir Shift Malam jaga sore sampai tutup: antrian makan malam jadi cepat.',
  bus: 'Rombongan bus datang sekaligus! Pastikan stok & nasi cukup, pelayan banyak.',
  brand: 'Brand-mu resmi! Buka outlet di kota lain lewat PETA > Nasional: outlet kota, mall, sampai bandara.',
  outlet: 'Outlet nasional bayar royalti tiap minggu, tapi ada biaya pendampingan bulanan. Rating brand-mu yang menentukan rame-tidaknya.',
  vip: 'Ruang VIP bisa disewa buat acara. Bayarannya besar, tapi dapur harus siap porsi banyak.',
};
