// Static game data: ingredients, dishes, customer types, staff roles/traits, map locations, rivals, decor, research,
// combos, stages, achievements. All brand / business names are fictional.

export type IngId = 'beras' | 'cabai' | 'telur' | 'ayam' | 'sayur' | 'tempe' | 'daging' | 'ikan' | 'minyak';
export interface Ing { id: IngId; name: string; unit: string; base: number; vol: number; spoil: number; icon: number }
/** prices per kg (Rp). vol = weekly volatility, spoil = fraction lost per day in the pantry (halved with a kulkas) */
export const INGS: Ing[] = [
  { id: 'beras', name: 'Beras', unit: 'kg', base: 14000, vol: 0.03, spoil: 0, icon: 15 },
  { id: 'cabai', name: 'Cabai', unit: 'kg', base: 50000, vol: 0.2, spoil: 0.06, icon: 14 },
  { id: 'telur', name: 'Telur', unit: 'kg', base: 28000, vol: 0.07, spoil: 0.02, icon: 5 },
  { id: 'ayam', name: 'Ayam', unit: 'kg', base: 38000, vol: 0.08, spoil: 0.12, icon: 4 },
  { id: 'sayur', name: 'Sayur', unit: 'kg', base: 12000, vol: 0.12, spoil: 0.2, icon: 6 },
  { id: 'tempe', name: 'Tempe & Tahu', unit: 'kg', base: 15000, vol: 0.05, spoil: 0.1, icon: 8 },
  { id: 'daging', name: 'Daging Sapi', unit: 'kg', base: 130000, vol: 0.05, spoil: 0.08, icon: 0 },
  { id: 'ikan', name: 'Ikan', unit: 'kg', base: 40000, vol: 0.1, spoil: 0.15, icon: 2 },
  // v1.3: cooking oil (gorengan); icon >= 100 = frame in dishx.png
  { id: 'minyak', name: 'Minyak Goreng', unit: 'L', base: 17000, vol: 0.06, spoil: 0, icon: 102 },
];
export const ING = Object.fromEntries(INGS.map((i) => [i.id, i])) as Record<IngId, Ing>;

export type CustId = 'buruh' | 'mhs' | 'kantor' | 'ojol' | 'mandor' | 'ibu';
export type Tag = 'murah' | 'kenyang' | 'pedas' | 'mewah' | 'sayur' | 'gorengan' | 'kuah' | 'minum' | 'takjil';
export interface Dish {
  id: string; name: string; icon: number; price: number; ing: Partial<Record<IngId, number>>; tags: Tag[];
  /** cooking effort per portion (1 = easy) */
  effort: number; unlock: 'start' | 'riset' | 'takjil'; poin?: number; days?: number; desc?: string;
  /** v1.4: research needs at least this warung stage (Rumah Makan recipes) */
  stage?: number;
}
// icon = frame in dishes.png (row-major 5x4); icon >= 100 = frame (icon - 100) in dishx.png (v1.3)
export const DISHES: Dish[] = [
  { id: 'rendang', name: 'Rendang', icon: 0, price: 15000, ing: { daging: 0.07, cabai: 0.01 }, tags: ['mewah', 'pedas'], effort: 2.2, unlock: 'riset', poin: 40, days: 6, desc: 'Lauk sultan. Pegawai kantor & mandor doyan.' },
  { id: 'orek', name: 'Orek Tempe', icon: 1, price: 3000, ing: { tempe: 0.07, cabai: 0.004 }, tags: ['murah', 'pedas'], effort: 0.7, unlock: 'start' },
  { id: 'ikangoreng', name: 'Ikan Goreng', icon: 2, price: 9000, ing: { ikan: 0.13, minyak: 0.02 }, tags: ['gorengan', 'kenyang'], effort: 1.2, unlock: 'start' },
  { id: 'lodeh', name: 'Sayur Lodeh', icon: 3, price: 4000, ing: { sayur: 0.12, tempe: 0.02 }, tags: ['sayur', 'kuah', 'murah'], effort: 0.8, unlock: 'start' },
  { id: 'ayamgoreng', name: 'Ayam Goreng', icon: 4, price: 11000, ing: { ayam: 0.14, minyak: 0.02 }, tags: ['gorengan', 'kenyang'], effort: 1.2, unlock: 'start' },
  { id: 'telurbalado', name: 'Telur Balado', icon: 5, price: 5000, ing: { telur: 0.065, cabai: 0.012 }, tags: ['pedas', 'kenyang'], effort: 0.8, unlock: 'start' },
  { id: 'kangkung', name: 'Tumis Kangkung', icon: 6, price: 4000, ing: { sayur: 0.12, cabai: 0.004 }, tags: ['sayur', 'murah'], effort: 0.6, unlock: 'start' },
  { id: 'perkedel', name: 'Perkedel', icon: 7, price: 3000, ing: { sayur: 0.05, telur: 0.01, minyak: 0.01 }, tags: ['gorengan', 'murah'], effort: 0.9, unlock: 'riset', poin: 12, days: 2, desc: 'Bulat, gurih, murah. Mahasiswa suka.' },
  { id: 'tahu', name: 'Tahu Goreng', icon: 8, price: 2500, ing: { tempe: 0.06, minyak: 0.012 }, tags: ['gorengan', 'murah'], effort: 0.5, unlock: 'start' },
  { id: 'ati', name: 'Sambal Goreng Ati', icon: 9, price: 7000, ing: { ayam: 0.07, cabai: 0.012 }, tags: ['pedas', 'mewah'], effort: 1.4, unlock: 'riset', poin: 22, days: 3, desc: 'Ati ampela pedas manis.' },
  { id: 'jengkol', name: 'Semur Jengkol', icon: 10, price: 8000, ing: { sayur: 0.1, cabai: 0.004 }, tags: ['kenyang', 'kuah'], effort: 1.3, unlock: 'riset', poin: 26, days: 4, desc: 'Fans garis keras pasti balik lagi.' },
  { id: 'tongkol', name: 'Tongkol Balado', icon: 11, price: 7000, ing: { ikan: 0.09, cabai: 0.014 }, tags: ['pedas', 'kenyang'], effort: 1.1, unlock: 'riset', poin: 18, days: 3, desc: 'Pedasnya bikin buruh semangat.' },
  { id: 'asem', name: 'Sayur Asem', icon: 12, price: 4000, ing: { sayur: 0.13 }, tags: ['sayur', 'kuah', 'murah'], effort: 0.7, unlock: 'riset', poin: 10, days: 2, desc: 'Seger, cocok buat siang bolong.' },
  { id: 'bakwan', name: 'Bakwan Jagung', icon: 13, price: 2000, ing: { sayur: 0.04, beras: 0.01, minyak: 0.012 }, tags: ['gorengan', 'murah'], effort: 0.6, unlock: 'start' },
  { id: 'mercon', name: 'Oseng Mercon', icon: 14, price: 13000, ing: { daging: 0.05, cabai: 0.03 }, tags: ['pedas', 'mewah'], effort: 1.8, unlock: 'riset', poin: 34, days: 5, desc: 'Pedasnya kayak petasan. Viral potential!' },
  { id: 'esteh', name: 'Es Teh Manis', icon: 16, price: 3000, ing: {}, tags: ['minum', 'murah'], effort: 0.2, unlock: 'start' },
  { id: 'kerupuk', name: 'Kerupuk', icon: 17, price: 1000, ing: { beras: 0.01, minyak: 0.003 }, tags: ['murah'], effort: 0.1, unlock: 'riset', poin: 6, days: 1, desc: 'Kriuk. Semua orang beli.' },
  { id: 'pepes', name: 'Pepes Ikan', icon: 18, price: 9000, ing: { ikan: 0.11, cabai: 0.006 }, tags: ['mewah', 'sayur'], effort: 1.6, unlock: 'riset', poin: 28, days: 4, desc: 'Wangi daun pisang. Ibu-ibu suka.' },
  // v1.3 takjil: only on the menu during Ramadan (extra etalase slots), bought as an add-on around buka puasa
  { id: 'kolak', name: 'Kolak Pisang', icon: 100, price: 5000, ing: { sayur: 0.05 }, tags: ['takjil', 'murah'], effort: 0.5, unlock: 'takjil', desc: 'Takjil wajib pas buka puasa.' },
  { id: 'esbuah', name: 'Es Buah', icon: 101, price: 6000, ing: { sayur: 0.06 }, tags: ['takjil', 'minum'], effort: 0.3, unlock: 'takjil', desc: 'Seger buat buka puasa.' },
  { id: 'sopayam', name: 'Sop Ayam', icon: 19, price: 8000, ing: { ayam: 0.08, sayur: 0.05 }, tags: ['kuah', 'kenyang'], effort: 1.1, unlock: 'riset', poin: 20, days: 3, desc: 'Anget, pas musim hujan.' },
  // v1.4: bigger menus for the bigger warung (Warteg Besar: 3 extra, Rumah Makan: masakan Padang-style, Restoran Besar: premium)
  { id: 'dadar', name: 'Telur Dadar Tebal', icon: 103, price: 6000, ing: { telur: 0.08, minyak: 0.012, cabai: 0.003 }, tags: ['gorengan', 'kenyang'], effort: 0.8, unlock: 'riset', poin: 16, days: 2, stage: 3, desc: 'Tebal, renyah pinggirnya. Pendamping semua lauk.' },
  { id: 'singkong', name: 'Daun Singkong Rebus', icon: 104, price: 3000, ing: { sayur: 0.1 }, tags: ['sayur', 'murah'], effort: 0.5, unlock: 'riset', poin: 12, days: 2, stage: 3, desc: 'Sayur wajib nasi Padang, murah meriah.' },
  { id: 'esjeruk', name: 'Es Jeruk', icon: 105, price: 5000, ing: { sayur: 0.03 }, tags: ['minum'], effort: 0.3, unlock: 'riset', poin: 14, days: 2, stage: 4, desc: 'Seger, buat yang bosan es teh.' },
  { id: 'gulaiayam', name: 'Gulai Ayam', icon: 106, price: 13000, ing: { ayam: 0.13, cabai: 0.006, sayur: 0.02 }, tags: ['kuah', 'kenyang', 'mewah'], effort: 1.6, unlock: 'riset', poin: 40, days: 4, stage: 5, desc: 'Kuah santan kuning kental. Andalan rumah makan.' },
  { id: 'ayampop', name: 'Ayam Pop', icon: 107, price: 14000, ing: { ayam: 0.14, minyak: 0.01 }, tags: ['kenyang', 'mewah'], effort: 1.5, unlock: 'riset', poin: 42, days: 4, stage: 5, desc: 'Ayam pucat yang lembut, sambal merahnya juara.' },
  { id: 'dendeng', name: 'Dendeng Balado', icon: 108, price: 18000, ing: { daging: 0.07, cabai: 0.02, minyak: 0.01 }, tags: ['pedas', 'mewah'], effort: 2.0, unlock: 'riset', poin: 50, days: 5, stage: 5, desc: 'Daging tipis kering, balado merah. Mandor doyan.' },
  { id: 'gulaitunjang', name: 'Gulai Tunjang', icon: 109, price: 16000, ing: { daging: 0.08, cabai: 0.008, sayur: 0.02 }, tags: ['kuah', 'mewah', 'kenyang'], effort: 2.1, unlock: 'riset', poin: 48, days: 5, stage: 5, desc: 'Kikil kenyal kuah gulai. Penggemarnya fanatik.' },
  { id: 'nangka', name: 'Gulai Nangka', icon: 110, price: 5000, ing: { sayur: 0.12, cabai: 0.004 }, tags: ['sayur', 'kuah', 'murah'], effort: 0.9, unlock: 'riset', poin: 22, days: 3, stage: 5, desc: 'Sayur gulai muda yang bikin nambah nasi.' },
  { id: 'ikanbakar', name: 'Ikan Bakar Rica', icon: 111, price: 15000, ing: { ikan: 0.16, cabai: 0.01 }, tags: ['pedas', 'mewah', 'kenyang'], effort: 1.8, unlock: 'riset', poin: 44, days: 4, stage: 5, desc: 'Wangi arang, pedas rica. Pegawai kantor rela antre.' },
  { id: 'paru', name: 'Paru Goreng', icon: 112, price: 11000, ing: { daging: 0.05, minyak: 0.02 }, tags: ['gorengan', 'mewah'], effort: 1.4, unlock: 'riset', poin: 34, days: 3, stage: 5, desc: 'Kriuk gurih, teman sambal ijo.' },
  { id: 'sambalijo', name: 'Sambal Ijo', icon: 113, price: 2000, ing: { cabai: 0.02, minyak: 0.004 }, tags: ['pedas', 'murah'], effort: 0.4, unlock: 'riset', poin: 18, days: 2, stage: 5, desc: 'Cabai hijau tumbuk, pelengkap semua lauk.' },
  { id: 'kalio', name: 'Kalio Daging', icon: 114, price: 15000, ing: { daging: 0.075, cabai: 0.01 }, tags: ['kuah', 'mewah'], effort: 1.9, unlock: 'riset', poin: 46, days: 5, stage: 5, desc: 'Rendang setengah jadi, kuahnya basah.' },
  { id: 'udang', name: 'Udang Balado', icon: 115, price: 20000, ing: { ikan: 0.12, cabai: 0.018 }, tags: ['pedas', 'mewah'], effort: 1.9, unlock: 'riset', poin: 60, days: 6, stage: 6, desc: 'Udang besar merah menyala. Menu acara VIP.' },
  { id: 'kepalaikan', name: 'Gulai Kepala Ikan', icon: 116, price: 30000, ing: { ikan: 0.25, cabai: 0.012, sayur: 0.04 }, tags: ['kuah', 'mewah', 'kenyang'], effort: 2.6, unlock: 'riset', poin: 70, days: 7, stage: 6, desc: 'Satu kepala buat rame-rame. Rombongan wajib pesan.' },
];
export const DISH = Object.fromEntries(DISHES.map((d) => [d.id, d])) as Record<string, Dish>;
/** rice: always on, one per dine-in / bungkus customer */
export const NASI = { price: 4000, beras: 0.11, icon: 15 };

export interface CustType {
  id: CustId; name: string; sprite: string; budget: number; patience: number; likes: Tag[]; dislikes: Tag[]; dine: number;
  /** kasbon: chance to ask on tanggal tua and chance to never pay */
  kasbon: number; kabur: number; names: string[];
}
export const CUSTS: CustType[] = [
  { id: 'buruh', name: 'Buruh', sprite: 'buruh', budget: 17000, patience: 4, likes: ['kenyang', 'pedas', 'murah'], dislikes: ['mewah'], dine: 0.75, kasbon: 0.25, kabur: 0.15, names: ['Ujang', 'Darto', 'Asep', 'Slamet', 'Rohim', 'Joko'] },
  { id: 'mhs', name: 'Mahasiswa', sprite: 'mhs', budget: 13000, patience: 5, likes: ['murah', 'gorengan', 'pedas'], dislikes: ['mewah'], dine: 0.65, kasbon: 0.3, kabur: 0.25, names: ['Sasa', 'Dimas', 'Rian', 'Nadia', 'Bima', 'Tiara'] },
  { id: 'kantor', name: 'Pegawai Kantor', sprite: 'kantor', budget: 32000, patience: 3, likes: ['mewah', 'sayur', 'kuah'], dislikes: [], dine: 0.6, kasbon: 0.08, kabur: 0.05, names: ['Pak Hendra', 'Mbak Rina', 'Mas Yoga', 'Bu Wulan', 'Pak Teguh'] },
  { id: 'ojol', name: 'Driver Ojol', sprite: 'ojol', budget: 15000, patience: 3, likes: ['kenyang', 'murah', 'gorengan'], dislikes: [], dine: 0.5, kasbon: 0.2, kabur: 0.1, names: ['Bang Udin', 'Mas Eko', 'Bang Jali', 'Kang Odin'] },
  { id: 'mandor', name: 'Mandor', sprite: 'mandor', budget: 40000, patience: 3, likes: ['mewah', 'kenyang', 'pedas'], dislikes: [], dine: 0.3, kasbon: 0.12, kabur: 0.05, names: ['Pak Bonar', 'Pak Kasno', 'Pak Darmaji'] },
  { id: 'ibu', name: 'Ibu-ibu', sprite: 'hijab', budget: 22000, patience: 4, likes: ['sayur', 'kuah', 'mewah'], dislikes: ['pedas'], dine: 0.35, kasbon: 0.1, kabur: 0.05, names: ['Bu Ningsih', 'Mbak Lilis', 'Bu Sri', 'Teh Euis', 'Bu Yati'] },
];
export const CUST = Object.fromEntries(CUSTS.map((c) => [c.id, c])) as Record<CustId, CustType>;

export type RoleId = 'masak' | 'kasir' | 'pelayan' | 'belanja' | 'kepala' | 'manajer' | 'shift';
/** v1.4: minStage = the warung level the role can be hired at */
export const ROLES: Record<RoleId, { name: string; short: string; sprites: string[]; base: number; desc: string; minStage?: number }> = {
  masak: { name: 'Juru Masak', short: 'Masak', sprites: ['cookf', 'cookm'], base: 1600000, desc: 'Rasa + kapasitas masak (porsi per hari).' },
  kasir: { name: 'Kasir', short: 'Kasir', sprites: ['kasir'], base: 1400000, desc: 'Bayar lebih cepat, kasbon lebih aman.' },
  pelayan: { name: 'Pelayan', short: 'Pelayan', sprites: ['pelayan'], base: 1300000, desc: 'Antrian cepat + warung bersih.' },
  belanja: { name: 'Tukang Belanja', short: 'Belanja', sprites: ['belanja'], base: 1200000, desc: 'Harga pasar lebih murah, bahan lebih segar.' },
  // v1.4
  shift: { name: 'Kasir Shift Malam', short: 'Shift', sprites: ['shift'], base: 1700000, desc: 'Jaga kasir sore-malam: antrian makan malam cepat, kas aman.', minStage: 3 },
  kepala: { name: 'Kepala Dapur', short: 'K.Dapur', sprites: ['kepala'], base: 4200000, desc: 'Memimpin juru masak: rasa naik, dapur +kapasitas, lauk sisa lebih sedikit. Satu cukup.', minStage: 4 },
  manajer: { name: 'Manajer Cabang', short: 'Manajer', sprites: ['manajer'], base: 5200000, desc: 'Tempatkan di cabang / outlet: laba mingguan naik. Di warung utama: staf lebih disiplin.', minStage: 3 },
};
export const TRAITS: Record<string, { name: string; desc: string }> = {
  cekatan: { name: 'Cekatan', desc: '+25% kecepatan kerja' },
  jujur: { name: 'Jujur', desc: 'Kas nggak pernah selisih' },
  ramah: { name: 'Ramah', desc: 'Pelanggan lebih sabar' },
  jagosambal: { name: 'Jago Sambal', desc: '+Rasa lauk pedas' },
  rajin: { name: 'Rajin', desc: 'Energi turun lebih lambat' },
  hemat: { name: 'Jago Nawar', desc: 'Harga pasar -4% (belanja)' },
  mager: { name: 'Mager', desc: '-15% kecepatan kerja' },
  pelupa: { name: 'Pelupa', desc: 'Kadang salah pesanan' },
  baper: { name: 'Baperan', desc: 'Gampang ngambek kalau capek' },
  mudik: { name: 'Anak Rantau', desc: 'Pasti mudik pas Lebaran' },
};
export const GOOD_TRAITS = ['cekatan', 'jujur', 'ramah', 'jagosambal', 'rajin', 'hemat'];
export const BAD_TRAITS = ['mager', 'pelupa', 'baper', 'mudik'];
export const STAFF_NAMES_F = ['Mbok Darmi', 'Yu Sarni', 'Mbak Tini', 'Neng Ayu', 'Bu Parmi', 'Siti', 'Wati', 'Mbak Inah', 'Teh Lia', 'Ningsih', 'Dewi', 'Rumi'];
export const STAFF_NAMES_M = ['Kang Diman', 'Mas Bejo', 'Cak Sholeh', 'Pak Karyo', 'Ucup', 'Rahmat', 'Bayu', 'Agus', 'Dodi', 'Iwan', 'Kang Ade', 'Fajar'];

export interface Loc {
  id: string; name: string; short: string; px: number; py: number; mix: Partial<Record<CustId, number>>; traffic: number; cost: number;
  rent: number; unlockYear: number; desc: string;
}
// px / py = pin position on the 688x384 map image
export const LOCS: Loc[] = [
  { id: 'pasar', name: 'Pinggir Pasar Induk', short: 'Pasar', px: 345, py: 195, mix: { buruh: 0.3, ibu: 0.25, ojol: 0.15, mhs: 0.1, kantor: 0.1, mandor: 0.1 }, traffic: 1, cost: 0, rent: 0, unlockYear: 1, desc: 'Ramai dari subuh. Campur aduk: kuli panggul, ibu-ibu, ojol.' },
  { id: 'kampus', name: 'Depan Kampus Bhakti', short: 'Kampus', px: 168, py: 80, mix: { mhs: 0.65, kantor: 0.1, ojol: 0.15, ibu: 0.1 }, traffic: 1.1, cost: 45000000, rent: 2500000, unlockYear: 1, desc: 'Mahasiswa banyak, dompet tipis. Murah + gorengan = laris.' },
  { id: 'pabrik', name: 'Kawasan Pabrik Cikaret', short: 'Pabrik', px: 525, py: 80, mix: { buruh: 0.6, mandor: 0.2, ojol: 0.1, kantor: 0.1 }, traffic: 1.15, cost: 50000000, rent: 2200000, unlockYear: 1, desc: 'Buruh shift pagi-malam. Porsi kuli, pedas, kenyang.' },
  { id: 'terminal', name: 'Terminal Antarkota', short: 'Terminal', px: 108, py: 305, mix: { ojol: 0.35, buruh: 0.3, ibu: 0.15, mandor: 0.1, mhs: 0.1 }, traffic: 1.05, cost: 40000000, rent: 2000000, unlockYear: 2, desc: 'Sopir, kernet, ojol. Buka pagi banget.' },
  { id: 'kantor', name: 'Segitiga Perkantoran', short: 'Perkantoran', px: 575, py: 300, mix: { kantor: 0.65, ojol: 0.2, mandor: 0.05, ibu: 0.1 }, traffic: 1.2, cost: 80000000, rent: 4500000, unlockYear: 2, desc: 'Jam makan siang meledak. Rendang & sayur laku.' },
  { id: 'kampung', name: 'Kampung Rambutan Asri', short: 'Perumahan', px: 135, py: 195, mix: { ibu: 0.45, buruh: 0.2, mhs: 0.15, ojol: 0.2 }, traffic: 0.85, cost: 30000000, rent: 1200000, unlockYear: 2, desc: 'Ibu-ibu beli lauk buat di rumah. Banyak bungkus.' },
  { id: 'stasiun', name: 'Stasiun Kota Lama', short: 'Stasiun', px: 368, py: 262, mix: { kantor: 0.3, mhs: 0.25, buruh: 0.2, ojol: 0.15, ibu: 0.1 }, traffic: 1.1, cost: 60000000, rent: 3000000, unlockYear: 3, desc: 'Komuter pagi & sore. Ramai pas jam pulang.' },
  { id: 'masjid', name: 'Dekat Masjid Raya', short: 'Masjid Raya', px: 590, py: 195, mix: { ibu: 0.3, kantor: 0.25, buruh: 0.2, ojol: 0.15, mhs: 0.1 }, traffic: 0.95, cost: 55000000, rent: 2600000, unlockYear: 3, desc: 'Super ramai pas Ramadan: bukber & sahur.' },
];
export const LOC = Object.fromEntries(LOCS.map((l) => [l.id, l])) as Record<string, Loc>;

export interface Stage { lv: number; name: string; seats: number; slots: number; staffMax: number; rent: number; cost: number; needStars: number; needFans: number; traffic: number }
export const STAGES: Stage[] = [
  { lv: 1, name: 'Gerobak', seats: 4, slots: 6, staffMax: 2, rent: 300000, cost: 0, needStars: 0, needFans: 0, traffic: 0.55 },
  { lv: 2, name: 'Warteg Kecil', seats: 6, slots: 10, staffMax: 4, rent: 1500000, cost: 15000000, needStars: 2.4, needFans: 250, traffic: 0.85 },
  { lv: 3, name: 'Warteg', seats: 12, slots: 14, staffMax: 6, rent: 3000000, cost: 60000000, needStars: 3.1, needFans: 1500, traffic: 1.1 },
  { lv: 4, name: 'Warteg Besar', seats: 20, slots: 20, staffMax: 9, rent: 5000000, cost: 180000000, needStars: 3.7, needFans: 6000, traffic: 1.35 },
  // v1.4: the warung keeps growing (Rumah Makan: prasmanan + waiters to the tables, Restoran Besar: 2 floors, parkiran, VIP)
  { lv: 5, name: 'Rumah Makan', seats: 32, slots: 28, staffMax: 13, rent: 9000000, cost: 520000000, needStars: 4.1, needFans: 22000, traffic: 1.6 },
  { lv: 6, name: 'Restoran Besar', seats: 64, slots: 32, staffMax: 18, rent: 18000000, cost: 1200000000, needStars: 4.25, needFans: 30000, traffic: 1.9 },
];
export const FRANCHISE = { needCabang: 4, needStars: 4.1, cost: 800000000 };

export interface Decor { id: string; name: string; cost: number; upkeep: number; rasa: number; bersih: number; suasana: number; traffic: number; stage: number; prop?: string; desc: string }
export const DECORS: Decor[] = [
  { id: 'kipas', name: 'Kipas Angin', cost: 900000, upkeep: 40000, rasa: 0, bersih: 2, suasana: 8, traffic: 0.02, stage: 1, prop: 'fan', desc: 'Biar nggak gerah. Pelanggan betah.' },
  { id: 'tanaman', name: 'Tanaman Hias', cost: 400000, upkeep: 0, rasa: 0, bersih: 3, suasana: 5, traffic: 0.01, stage: 1, prop: 'plant', desc: 'Seger dilihat.' },
  { id: 'jam', name: 'Jam Dinding', cost: 250000, upkeep: 0, rasa: 0, bersih: 0, suasana: 3, traffic: 0, stage: 2, prop: 'clock', desc: 'Pegawai kantor nggak telat balik.' },
  { id: 'tv', name: 'TV Tabung', cost: 2500000, upkeep: 80000, rasa: 0, bersih: 0, suasana: 12, traffic: 0.05, stage: 2, prop: 'tv', desc: 'Nonton bola bareng = rame. Bisa nobar!' },
  { id: 'magicom', name: 'Penghangat Nasi', cost: 1800000, upkeep: 60000, rasa: 5, bersih: 4, suasana: 0, traffic: 0, stage: 1, prop: 'warmer', desc: 'Nasi selalu anget. Sisa kemarin nggak basi.' },
  { id: 'kulkas', name: 'Kulkas Bahan', cost: 4500000, upkeep: 150000, rasa: 3, bersih: 6, suasana: 0, traffic: 0, stage: 2, desc: 'Bahan di gudang awetnya 2x.' },
  { id: 'lampu', name: 'Lampu Hias', cost: 1200000, upkeep: 50000, rasa: 0, bersih: 0, suasana: 7, traffic: 0.04, stage: 2, prop: 'lights', desc: 'Warung kelihatan dari jauh pas malam.' },
  { id: 'etalase2', name: 'Etalase Kaca Premium', cost: 8000000, upkeep: 100000, rasa: 4, bersih: 12, suasana: 6, traffic: 0.04, stage: 2, desc: 'Lauk kelihatan menggoda, lalat minggir.' },
  { id: 'ac', name: 'AC Split', cost: 7500000, upkeep: 450000, rasa: 0, bersih: 4, suasana: 18, traffic: 0.06, stage: 3, prop: 'ac', desc: 'Pegawai kantor & ibu-ibu makin betah.' },
  { id: 'neon', name: 'Papan Nama Neon', cost: 5000000, upkeep: 120000, rasa: 0, bersih: 0, suasana: 6, traffic: 0.1, stage: 2, prop: 'sign', desc: 'Kelihatan dari ujung jalan.' },
  { id: 'genset', name: 'Genset', cost: 6000000, upkeep: 200000, rasa: 0, bersih: 0, suasana: 0, traffic: 0, stage: 2, desc: 'Listrik padam? Tetap jualan.' },
  { id: 'wastafel', name: 'Wastafel Cuci Tangan', cost: 2000000, upkeep: 30000, rasa: 0, bersih: 10, suasana: 2, traffic: 0, stage: 2, desc: 'Sidak dinkes jadi santai.' },
  // v1.4 decorations for the big rooms
  { id: 'papanmenu', name: 'Papan Menu Berdiri', cost: 3500000, upkeep: 0, rasa: 0, bersih: 0, suasana: 4, traffic: 0.05, stage: 4, desc: 'Di depan pintu: menu hari ini kelihatan dari jalan.' },
  { id: 'lampion', name: 'Lampu Gantung Rotan', cost: 9000000, upkeep: 120000, rasa: 0, bersih: 0, suasana: 10, traffic: 0.04, stage: 4, desc: 'Deretan lampu rotan hangat sepanjang dinding.' },
  { id: 'lukisan', name: 'Lukisan Pemandangan', cost: 6000000, upkeep: 0, rasa: 0, bersih: 0, suasana: 8, traffic: 0.02, stage: 5, desc: 'Sawah dan gunung di dinding. Ruang makan jadi adem.' },
  { id: 'aquarium', name: 'Akuarium Ikan Hias', cost: 15000000, upkeep: 300000, rasa: 0, bersih: 2, suasana: 14, traffic: 0.05, stage: 5, desc: 'Anak-anak nempel di kaca, orang tuanya pesan lagi.' },
  { id: 'cctv', name: 'CCTV & Alarm', cost: 12000000, upkeep: 250000, rasa: 0, bersih: 6, suasana: 2, traffic: 0, stage: 5, desc: 'Maling kabur, staf lebih rapi. Sidak juga tenang.' },
  { id: 'karaoke', name: 'Sound System VIP', cost: 35000000, upkeep: 600000, rasa: 0, bersih: 0, suasana: 12, traffic: 0.06, stage: 6, desc: 'Ruang VIP bisa buat ultah & arisan karaoke: acara lebih mahal.' },
];
export const DECOR = Object.fromEntries(DECORS.map((d) => [d.id, d])) as Record<string, Decor>;

/** combo packages discovered in Riset > Uji Combo. Exactly 3 lauk; the order does not matter */
export interface Combo { id: string; name: string; dishes: [string, string, string]; target: CustId; bonus: number; desc: string }
export const COMBOS: Combo[] = [
  { id: 'kuli', name: 'Paket Kuli', dishes: ['telurbalado', 'orek', 'lodeh'], target: 'buruh', bonus: 0.3, desc: 'Nasi munjung + telur + orek + lodeh. Buruh antre!' },
  { id: 'mhs', name: 'Paket Akhir Bulan', dishes: ['tahu', 'bakwan', 'kangkung'], target: 'mhs', bonus: 0.3, desc: 'Murah meriah, kenyang sampai kiriman datang.' },
  { id: 'kantoran', name: 'Paket Meeting', dishes: ['rendang', 'asem', 'perkedel'], target: 'kantor', bonus: 0.3, desc: 'Makan siang kantoran rasa rumahan.' },
  { id: 'ojol', name: 'Paket Ngebut', dishes: ['ayamgoreng', 'tahu', 'esteh'], target: 'ojol', bonus: 0.3, desc: 'Cepat dibungkus, cepat narik lagi.' },
  { id: 'mandor', name: 'Paket Juragan Proyek', dishes: ['mercon', 'ati', 'ikangoreng'], target: 'mandor', bonus: 0.3, desc: 'Buat mandor yang traktir anak buah.' },
  { id: 'ibu', name: 'Paket Masak Libur', dishes: ['pepes', 'sopayam', 'perkedel'], target: 'ibu', bonus: 0.3, desc: 'Ibu-ibu libur masak hari ini.' },
  { id: 'pedas', name: 'Paket Kepedesan', dishes: ['mercon', 'tongkol', 'telurbalado'], target: 'buruh', bonus: 0.2, desc: 'Level pedas: neraka. Ojol & buruh nantang.' },
  { id: 'jengkol', name: 'Paket Jengkol Lovers', dishes: ['jengkol', 'kangkung', 'kerupuk'], target: 'mandor', bonus: 0.2, desc: 'Baunya legendaris, fansnya fanatik.' },
];

export interface ResearchItem { id: string; name: string; poin: number; days: number; desc: string; kind: 'dish' | 'skill' }
export const UPGRADES: ResearchItem[] = [
  { id: 'resep_bumbu', name: 'Bumbu Rahasia Nenek', poin: 30, days: 4, desc: 'Rasa semua lauk +6.', kind: 'skill' },
  { id: 'teknik_cepat', name: 'Teknik Masak Kilat', poin: 35, days: 5, desc: 'Kapasitas masak +20%.', kind: 'skill' },
  { id: 'sop_antri', name: 'Sistem Antre Rapi', poin: 25, days: 3, desc: 'Antrian lebih sabar (+1 kesabaran).', kind: 'skill' },
  { id: 'resep_awet', name: 'Rahasia Lauk Awet', poin: 40, days: 5, desc: 'Lauk sisa kemarin nggak terlalu nurunin rasa.', kind: 'skill' },
  { id: 'qris', name: 'Bayar Pakai QR', poin: 20, days: 2, desc: 'Kasir lebih cepat, kasbon -30%.', kind: 'skill' },
  { id: 'resep_pedas', name: 'Ilmu Sambal 7 Level', poin: 45, days: 6, desc: 'Lauk pedas +Rasa, ojol & buruh makin setia.', kind: 'skill' },
];

export interface Promo { id: string; name: string; cost: number; days: number; traffic: number; target?: CustId; desc: string; stage: number }
export const PROMOS: Promo[] = [
  { id: 'spanduk', name: 'Spanduk Depan Warung', cost: 350000, days: 7, traffic: 0.12, desc: 'Lewat sekali, inget terus.', stage: 1 },
  { id: 'brosur', name: 'Brosur ke Kampus', cost: 500000, days: 7, traffic: 0.08, target: 'mhs', desc: 'Mahasiswa +40% seminggu.', stage: 1 },
  { id: 'pabrik', name: 'Titip Brosur ke Pabrik', cost: 600000, days: 7, traffic: 0.08, target: 'buruh', desc: 'Buruh +40% seminggu.', stage: 1 },
  { id: 'gajian', name: 'Diskon Gajian 10%', cost: 0, days: 5, traffic: 0.25, desc: 'Ramai banget, tapi untung per porsi turun 10%.', stage: 1 },
  { id: 'medsos', name: 'Iklan Medsos Lokal', cost: 2500000, days: 10, traffic: 0.22, desc: 'Semua tipe pelanggan naik.', stage: 2 },
  { id: 'selebgram', name: 'Endorse Selebgram Kuliner', cost: 9000000, days: 14, traffic: 0.4, desc: 'Fans naik drastis kalau rasanya enak.', stage: 3 },
];

export interface OjolApp { id: string; name: string; color: number; hex: string; fee: number; commission: number; volume: number; desc: string }
export const OJOL_APPS: OjolApp[] = [
  { id: 'laparin', name: 'Lapar.in', color: 0x2e9a4a, hex: '#2e9a4a', fee: 500000, commission: 0.2, volume: 1, desc: 'Aplikasi pesan-antar paling rame. Komisi 20%.' },
  { id: 'kilat', name: 'KilatMakan', color: 0xe8701a, hex: '#e8701a', fee: 300000, commission: 0.18, volume: 0.7, desc: 'Lebih sepi tapi komisi 18%.' },
];

export interface Rival { id: string; name: string; kind: string; steals: Partial<Record<CustId, number>>; fromYear: number; desc: string }
export const RIVALS: Rival[] = [
  { id: 'sebelah', name: 'Warteg Mbak Yuni', kind: 'Warteg sebelah', steals: { buruh: 1, ibu: 1, ojol: 0.8, mhs: 0.8 }, fromYear: 1, desc: 'Tetangga yang suka banting harga.' },
  { id: 'kafe', name: 'Kopi Senja Kita', kind: 'Kafe kekinian', steals: { mhs: 1.4, kantor: 1 }, fromYear: 2, desc: 'Kopi susu gula aren + rice bowl. Mahasiswa betah nongkrong.' },
  { id: 'fastfood', name: 'Ayam Garing Express', kind: 'Fast food', steals: { kantor: 1, mhs: 1, ojol: 0.8 }, fromYear: 3, desc: 'Ayam krispi paket hemat, AC dingin.' },
  { id: 'padang', name: 'RM Sederhana Rasa', kind: 'Rumah makan', steals: { kantor: 0.8, mandor: 1.2, ibu: 0.6 }, fromYear: 5, desc: 'Rendangnya jadi saingan berat.' },
];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const WARUNG_NAMES = ['Warteg Bahari Jaya', 'Warteg Sederhana Barokah', 'Warteg Kharisma Rasa', 'Warteg Mbak Juragan', 'Warteg Doa Ibu', 'Warteg Sinar Tegal'];

export const ENDINGS: { min: number; title: string; line: string }[] = [
  // v1.0 tiers (kept for old references; v1.3 endings: ENDINGS2 in data2.ts)
  { min: 0, title: 'Juragan Gerobak', line: 'Masih dorong gerobak, tapi pelanggan setia nggak pernah lupa rasanya.' },
  { min: 28, title: 'Juragan Warteg Gang', line: 'Satu gang kenal warungmu. Lauknya jadi obrolan pos ronda.' },
  { min: 50, title: 'Juragan Warteg Kota', line: 'Seisi kota tahu: kalau lapar dan bokek, ke warungmu.' },
  { min: 70, title: 'Bos Besar Warteg', line: 'Cabang di mana-mana, karyawan puluhan, kasbon tetap dicatat rapi.' },
  { min: 92, title: 'Raja Warteg Nusantara', line: 'Dari gerobak ke franchise. Namamu jadi legenda per-warteg-an!' },
];

export const TIPS = [
  'Belanja pas harga turun, simpan di gudang. Tapi sayur cepat layu!',
  'Tanggal tua: pelanggan hemat. Lauk murah lebih laku.',
  'Lauk sisa kemarin dipanasin bikin Kebersihan turun. Masak secukupnya.',
  'Antrian kepanjangan bikin pelanggan kabur. Tambah pelayan atau kasir.',
  'Coba Uji Combo di Riset: ada paket rahasia buat tiap tipe pelanggan.',
  'Gabung aplikasi ojol buat pesanan tambahan, tapi komisinya lumayan.',
  'Musim hujan: walk-in sepi, ojol rame. Sop & kuah laku.',
  'Kipas, TV, AC bikin Suasana naik. Rating naik, pelanggan nambah.',
];
