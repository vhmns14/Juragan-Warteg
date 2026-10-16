// v1.3 static data for the new systems: weather, katering, langganan (regular story arcs), cat, street figuran, market
// shocks + news, netizen feed, staff drama, late-game investments, minigames, gerobak mangkal spots, branching endings,
// contextual hints. All names (people, companies, teams, accounts) are fictional.
import type { CustId, IngId } from './data';

// ------------------------------------------------------------------ cuaca
export type Weather = 'normal' | 'hujan' | 'panas';
export const WEATHER: Record<Weather, { name: string; desc: string }> = {
  normal: { name: 'Cerah', desc: 'Cuaca biasa.' },
  hujan: { name: 'Hujan', desc: 'Walk-in sepi, ojol rame, ada yang neduh.' },
  panas: { name: 'Panas Terik', desc: 'Es teh laris manis, kuah kurang laku.' },
};

// ------------------------------------------------------------------ katering hajatan
export type KatKind = 'tahlilan' | 'arisan' | 'kantor' | 'nikahan' | 'ultah' | 'vip';
export interface KatDef { id: KatKind; name: string; min: number; max: number; pay: number; days: [number, number]; stage: number; clients: string[]; desc: string }
export const KATERING: KatDef[] = [
  { id: 'arisan', name: 'Arisan RT', min: 20, max: 45, pay: 17000, days: [2, 3], stage: 1, clients: ['Bu RT Sumarni', 'Ibu-ibu Gang Kenari', 'Arisan Blok C'], desc: 'Nasi + 2 lauk, dibungkus rapi.' },
  { id: 'tahlilan', name: 'Tahlilan', min: 35, max: 90, pay: 15000, days: [2, 3], stage: 1, clients: ['Keluarga Pak Harjo', 'Keluarga Almarhum Mbah Karto', 'Pak RW Sobari'], desc: 'Nasi kotak sederhana buat jamaah.' },
  { id: 'ultah', name: 'Ulang Tahun Anak', min: 30, max: 70, pay: 19000, days: [2, 4], stage: 2, clients: ['Mama Kayla', 'Bunda Rafa', 'Keluarga Pak Dedi'], desc: 'Nasi kuning mini + telur + ayam.' },
  { id: 'kantor', name: 'Rapat Kantor', min: 50, max: 160, pay: 23000, days: [2, 4], stage: 2, clients: ['PT Maju Sentosa Abadi', 'CV Sinar Nusa Digital', 'Kantor Kelurahan Cempaka'], desc: 'Nasi kotak premium, wajib tepat waktu.' },
  { id: 'nikahan', name: 'Resepsi Nikahan', min: 150, max: 420, pay: 21000, days: [4, 6], stage: 3, clients: ['Mas Bayu & Mbak Laras', 'Keluarga Haji Romli', 'Dewi & Fajar'], desc: 'Prasmanan buat tamu undangan. Proyek gede!' },
  // v1.4: Restoran Besar's Ruang VIP booked for an event (pays per head much more than a nasi kotak)
  { id: 'vip', name: 'Acara Ruang VIP', min: 25, max: 60, pay: 78000, days: [2, 3], stage: 6, clients: ['Reuni SMA Angkatan 2009', 'Lamaran Rizky & Salsa', 'Rapat Direksi PT Cahaya Nusa', 'Ultah ke-60 Opa Hartono'], desc: 'Tamu makan di Ruang VIP lantai 2: menu lengkap, pelayanan khusus.' },
];
/** kitchen effort per katering portion and raw ingredient mix per portion (kg) */
export const KAT_EFFORT = 1.25;
export const KAT_ING: Partial<Record<IngId, number>> = { beras: 0.11, ayam: 0.05, telur: 0.02, sayur: 0.05, cabai: 0.005, minyak: 0.012 };

// ------------------------------------------------------------------ pelanggan langganan (story arcs)
export interface RegReward { money?: number; fans?: number; poin?: number; followers?: number; perk?: string; kasbonLost?: number; jelek?: number; rating?: number }
export interface RegChoice { label: string; hint?: string; aff: number; cost?: number; gain?: number; energy?: number; bersihCheck?: boolean; followers?: number }
export interface RegStep { text: string; choices: RegChoice[] }
export interface Regular {
  id: string; name: string; type: CustId; sprite: string; role: string; minStage: number; startDay: number;
  steps: RegStep[]; need: number; good: { text: string; r: RegReward }; bad: { text: string; r: RegReward };
}
export const REGULARS: Regular[] = [
  {
    id: 'dimas', name: 'Dimas', type: 'mhs', sprite: 'mhs', role: 'Mahasiswa tukang kasbon', minStage: 1, startDay: 6, need: 50,
    steps: [
      { text: '"Juragan... boleh ngebon dulu nggak? Kiriman dari kampung telat. Sumpah, bayar pas transferan masuk!"', choices: [
        { label: 'Boleh, dicatat ya', aff: 15, cost: 15000, hint: 'Rp 15rb ngebon' }, { label: 'Boleh, lauk murah aja', aff: 8, cost: 7000 }, { label: 'Maaf, nggak bisa', aff: -10 }] },
      { text: '"Bon kemarin belum bisa kubayar... Tapi aku bisa bikinin menu digital & promosi di grup kampus!"', choices: [
        { label: 'Oke, bayar pakai jasa', aff: 12, followers: 80, hint: 'Pengikut medsos naik' }, { label: 'Tetap harus bayar ya', aff: -5, gain: 15000 }, { label: 'Santai, nanti aja', aff: 6 }] },
      { text: '"Skripsiku tentang UMKM warteg. Boleh wawancara Juragan sejam aja?"', choices: [
        { label: 'Boleh banget!', aff: 12 }, { label: 'Lagi sibuk, lain kali', aff: -6 }] },
      { text: '"JURAGAN, AKU WISUDA MINGGU DEPAN!" Dimas mau traktir, tapi dompetnya masih tipis.', choices: [
        { label: 'Datang bawa nasi kotak', aff: 15, cost: 300000, hint: 'Rp 300rb' }, { label: 'Kasih selamat aja', aff: 4 }] },
    ],
    good: { text: 'Dimas lunasin semua bon, bawa satu angkatan makan di sini, dan sekarang kerja di kantor dekat warung. Tiap hari pesan buat timnya!', r: { money: 600000, fans: 150, perk: 'mhs' } },
    bad: { text: 'Dimas lulus dan... ngilang. Bon-nya ikut ngilang. Ya udah, ikhlas.', r: { kasbonLost: 150000, fans: -20 } },
  },
  {
    id: 'slamet', name: 'Pak Slamet', type: 'buruh', sprite: 'buruh', role: 'Kuli proyek', minStage: 1, startDay: 12, need: 50,
    steps: [
      { text: '"Juragan, proyek gedung sebelah butuh makan siang 20 kuli. Bisa kasih harga borongan?"', choices: [
        { label: 'Bisa, diskon 10%', aff: 12, gain: 250000 }, { label: 'Harga normal aja', aff: 3, gain: 300000 }, { label: 'Nggak sanggup, Pak', aff: -10 }] },
      { text: '"Ada kuli yang jatuh dari perancah, lagi dirawat. Teman-temannya patungan buat biaya..."', choices: [
        { label: 'Ikut nyumbang Rp 200rb', aff: 15, cost: 200000 }, { label: 'Kirim nasi buat yang jaga', aff: 12, cost: 100000 }, { label: 'Turut prihatin aja', aff: 0 }] },
      { text: '"Mandor baru galak. Kuli dilarang jajan keluar proyek pas jam kerja."', choices: [
        { label: 'Antar nasi ke proyek', aff: 12, energy: 12, hint: 'Staf capek' }, { label: 'Bikin paket bungkus kilat', aff: 8 }, { label: 'Ya udah, nasib', aff: -8 }] },
      { text: '"Proyek mau kelar. Mandor nanya warung mana yang paling enak buat syukuran."', choices: [
        { label: 'Kasih harga spesial syukuran', aff: 10 }, { label: 'Harga biasa aja', aff: 2 }] },
    ],
    good: { text: 'Syukuran proyek digelar di warungmu! Mandor-mandor proyek lain jadi langganan setia.', r: { money: 1000000, fans: 120, perk: 'kuli' } },
    bad: { text: 'Pak Slamet pindah proyek ke luar kota. Rombongan kulinya ikut pindah makan.', r: { fans: -40 } },
  },
  {
    id: 'ningsih', name: 'Bu Ningsih', type: 'ibu', sprite: 'hijab', role: 'Ibu arisan', minStage: 1, startDay: 18, need: 50,
    steps: [
      { text: '"Arisan RT minggu ini di rumah Ibu. Bisa pesan 3 lauk buat 15 orang, Juragan?"', choices: [
        { label: 'Siap, saya antar', aff: 12, gain: 250000 }, { label: 'Ambil sendiri ya, Bu', aff: 4, gain: 250000 }, { label: 'Lagi penuh, Bu', aff: -8 }] },
      { text: '"Ibu-ibu bilang sayurmu keasinan lho kemarin... Ibu sih nggak, cuma nyampein aja."', choices: [
        { label: 'Makasih masukannya, Bu!', aff: 10 }, { label: 'Kasih bonus sayur buat Ibu', aff: 12, cost: 50000 }, { label: 'Masa sih? Perasaan pas', aff: -8 }] },
      { text: '"Ada warung baru di gang sebelah, katanya murah banget. Ibu-ibu pada penasaran..."', choices: [
        { label: 'Undang nyicip gratis', aff: 12, cost: 250000, hint: 'Rp 250rb' }, { label: 'Biarin, rasa nggak bohong', aff: 3 }, { label: 'Itu warung jorok kok, Bu', aff: -15 }] },
      { text: '"Ibu kepilih jadi ketua PKK! Mau bikin lomba masak sekampung."', choices: [
        { label: 'Jadi sponsor lombanya', aff: 12, cost: 500000, hint: 'Rp 500rb' }, { label: 'Ikut datang aja', aff: 5 }] },
    ],
    good: { text: 'Bu Ningsih promosiin warungmu di tiap arisan. Pesanan arisan datang rutin tiap minggu!', r: { fans: 200, perk: 'arisan' } },
    bad: { text: 'Bu Ningsih kesal dan gosipnya nyebar di grup WA RT. Pelanggan ibu-ibu menjauh.', r: { fans: -120, jelek: 4 } },
  },
  {
    id: 'darto', name: 'Pak Darto', type: 'kantor', sprite: 'dinkes', role: 'Satpam shift malam', minStage: 1, startDay: 25, need: 50,
    steps: [
      { text: '"Saya satpam ruko seberang, shift malam. Warung tutup jam 10, saya kelaparan jam 2 pagi..."', choices: [
        { label: 'Saya titipin nasi tiap malam', aff: 12, gain: 120000 }, { label: 'Nanti pas sahur, Pak', aff: 6 }, { label: 'Maaf, nggak bisa', aff: -5 }] },
      { text: '"Semalam ada orang mencurigakan ngintip warung Juragan. Udah saya usir."', choices: [
        { label: 'Makasih! Ini kopi + gorengan', aff: 12, cost: 20000 }, { label: 'Wah, masa sih?', aff: 0 }] },
      { text: '"Anak saya mau masuk SMK, bayarannya pas-pasan, Juragan..."', choices: [
        { label: 'Saya bantu Rp 500rb', aff: 15, cost: 500000 }, { label: 'Tawarin kerja sambilan', aff: 12 }, { label: 'Semoga lancar ya, Pak', aff: 2 }] },
      { text: '"Saya mau pensiun dari satpam. Boleh saya jagain warung Juragan tiap malam?"', choices: [
        { label: 'Boleh, jadi penjaga malam', aff: 10 }, { label: 'Nggak usah, Pak', aff: -5 }] },
    ],
    good: { text: 'Pak Darto jadi penjaga malam. Maling nggak berani mendekat, dan pelanggan malam makin rame.', r: { fans: 80, perk: 'satpam' } },
    bad: { text: 'Pak Darto pindah jaga ke pabrik. Malam-malam warung jadi agak rawan.', r: { fans: -20 } },
  },
  {
    id: 'rina', name: 'Mbak Rina', type: 'kantor', sprite: 'kantor', role: 'Pegawai kantor (lagi diet)', minStage: 2, startDay: 30, need: 50,
    steps: [
      { text: '"Mas/Mbak, aku lagi diet. Ada lauk yang nggak digoreng?"', choices: [
        { label: 'Ada sayur & pepes!', aff: 10 }, { label: 'Saya masakin khusus', aff: 12, cost: 30000 }, { label: 'Gorengan enak lho, sekali-sekali', aff: -6 }] },
      { text: '"Timku 12 orang mau makan siang sehat tiap Jumat. Bisa diatur?"', choices: [
        { label: 'Bisa, paket sehat Jumat', aff: 12, gain: 300000 }, { label: 'Datang langsung aja', aff: 3 }] },
      { text: '"Bosku nggak percaya warteg bisa higienis. Boleh dia lihat dapurnya?"', choices: [
        { label: 'Silakan lihat dapur', aff: 15, bersihCheck: true, hint: 'Tergantung kebersihan' }, { label: 'Dapur rahasia, maaf', aff: -8 }] },
      { text: '"Aku naik jabatan! Kantor mau langganan makan siang tiap hari..."', choices: [
        { label: 'Siap, harga kantor', aff: 10 }, { label: 'Nggak sanggup tiap hari', aff: -5 }] },
    ],
    good: { text: 'Kantor Mbak Rina langganan. Pegawai kantor sekitar ikut makan siang di warungmu.', r: { money: 1500000, fans: 100, perk: 'kantor' } },
    bad: { text: 'Mbak Rina pindah langganan ke kafe salad. Teman kantornya ikut pindah.', r: { fans: -60 } },
  },
  {
    id: 'udin', name: 'Bang Udin', type: 'ojol', sprite: 'ojol', role: 'Driver ojol', minStage: 1, startDay: 40, need: 50,
    steps: [
      { text: '"Bang, driver pada nongkrong di sini nunggu orderan. Boleh numpang ngecas HP?"', choices: [
        { label: 'Boleh, colokan gratis', aff: 12, cost: 10000 }, { label: 'Boleh, seribu sekali cas', aff: 3, gain: 10000 }, { label: 'Jangan, boros listrik', aff: -10 }] },
      { text: '"Ada diskon buat driver nggak? Kami makan di sini tiap hari lho."', choices: [
        { label: 'Gratis es teh buat driver', aff: 10, cost: 60000 }, { label: 'Diskon 10% buat driver', aff: 12, cost: 120000 }, { label: 'Nggak ada diskon', aff: -6 }] },
      { text: '"Hujan deres, anak-anak ojol neduh di depan warung. Boleh tetap di sini?"', choices: [
        { label: 'Boleh, saya buatin teh anget', aff: 12, cost: 50000 }, { label: 'Boleh, asal nggak ngalangin', aff: 4 }, { label: 'Duh, ngalangin pelanggan', aff: -10 }] },
      { text: '"Komunitas ojol mau bikin basecamp. Kami pengennya di warung Abang!"', choices: [
        { label: 'Ayo, jadikan basecamp!', aff: 10 }, { label: 'Jangan, nanti kerusuhan', aff: -8 }] },
    ],
    good: { text: 'Warungmu jadi basecamp ojol. Rating aplikasi naik dan driver selalu sigap ambil pesananmu.', r: { fans: 90, perk: 'ojol', rating: 0.3 } },
    bad: { text: 'Komunitas ojol pindah ke warung sebelah. Pesanan online agak seret.', r: { rating: -0.3 } },
  },
];
export const PERKS: Record<string, string> = {
  mhs: 'Mahasiswa +15% (alumni Dimas)', kuli: 'Buruh & mandor +15% (proyek Pak Slamet)', arisan: 'Pesanan arisan rutin (Bu Ningsih)',
  satpam: 'Aman dari maling + pelanggan malam (Pak Darto)', kantor: 'Pegawai kantor +15% (kantor Mbak Rina)', ojol: 'Basecamp ojol: pesanan online +20%',
};

// ------------------------------------------------------------------ kucing
export const CAT_NAMES = ['Si Oyen', 'Mbul', 'Kunyit', 'Belang', 'Ciko', 'Gembul'];

// ------------------------------------------------------------------ figuran jalanan
export type FigKind = 'pengamen' | 'parkir' | 'asongan' | 'hansip';
export const FIGURAN: Record<FigKind, { name: string; sprite: string; from: number; to: number; act: string; cost: number; lines: string[] }> = {
  pengamen: { name: 'Pengamen', sprite: 'pengamen', from: 9, to: 21, act: 'Kasih receh', cost: 2000, lines: ['♪ Jreng jreng~', '♪ Kopi dangdut~', '♪ Lagu galau~'] },
  parkir: { name: 'Tukang Parkir', sprite: 'parkir', from: 7, to: 20, act: 'Bayar parkir', cost: 2000, lines: ['Priiit! Kiri, kiri!', 'Aman, Bos!', 'Mundur dikit...'] },
  asongan: { name: 'Pedagang Asongan', sprite: 'asongan', from: 6, to: 20, act: 'Beli kopi saset', cost: 5000, lines: ['Kopi, tahu, permen!', 'Air dingin, air!', 'Tisu, tisu!'] },
  hansip: { name: 'Hansip Ronda', sprite: 'hansip', from: 18.5, to: 22, act: 'Kasih kopi + gorengan', cost: 6000, lines: ['Ronda dulu, Juragan', 'Aman terkendali!', 'Siskamling!'] },
};

// ------------------------------------------------------------------ gejolak harga
export interface Shock { id: string; ing: IngId; mult: number; weeks: number; text: string; when?: 'hujan' | 'kemarau' }
export const SHOCKS: Shock[] = [
  { id: 'cabai', ing: 'cabai', mult: 2.1, weeks: 3, text: 'Harga cabai rawit melonjak! Pedagang: "Gagal panen, Bu..."' },
  { id: 'minyak', ing: 'minyak', mult: 1.8, weeks: 2, text: 'Minyak goreng langka! Antrean mengular di minimarket.' },
  { id: 'telur', ing: 'telur', mult: 0.62, weeks: 2, text: 'Panen telur melimpah, harga anjlok. Saatnya borong!' },
  { id: 'beras', ing: 'beras', mult: 1.35, weeks: 4, text: 'Harga beras naik, stok di gudang menipis.' },
  { id: 'sayur', ing: 'sayur', mult: 0.6, weeks: 1, text: 'Panen raya sayur! Kangkung & kol murah meriah.' },
  { id: 'ikan', ing: 'ikan', mult: 1.6, weeks: 2, text: 'Nelayan nggak melaut, ombak tinggi. Ikan mahal.', when: 'hujan' },
  { id: 'ayam', ing: 'ayam', mult: 0.7, weeks: 2, text: 'Peternak panen besar, harga ayam potong turun.' },
  { id: 'daging', ing: 'daging', mult: 1.3, weeks: 3, text: 'Daging sapi impor tertahan di pelabuhan. Harga naik.' },
];
export const NEWS_FLAVOR = [
  'Pasar Induk dicat ulang, pedagang minta jalan diperbaiki.',
  'Lomba 17-an kampung tahun ini: makan kerupuk level dewa.',
  'Grup WA RT ramai bahas jalan berlubang di depan gang.',
  'Klub PS Kali Bening menang 2-1 di laga tarkam.',
  'Pemkot uji coba jalur sepeda di sepanjang jalan pasar.',
  'Iklan: "Kecap Kelinci Emas, manisnya bikin nambah!"',
  'Iklan: "Sabun Colek Kilat, piring bersih sekali usap."',
  'Iklan: "Kopi Saset Melek Terus, temen begadang ronda."',
  'Cuaca: Badan Cuaca Kota memprediksi hujan ringan sore hari.',
  'Harga bensin aman, antrean SPBU lancar.',
];

// ------------------------------------------------------------------ netizen
export const NETIZEN = ['@anakkos.hemat', '@kulinerjalan_id', '@emak.rempong', '@ojol.ngebut', '@mas.kantoran', '@foodie.receh', '@warga.gangkenari', '@si.paling.lapar', '@jajan.terus', '@cewe.pedes'];
export const NET_GOOD = ['Warteg ini underrated parah, lauknya enak semua!', 'Nasi + 3 lauk cuma segini?? Dompet aman', 'Es tehnya seger, ibunya ramah. Langganan fix.', 'Rekomendasi buat anak kos: porsi kuli harga mahasiswa.', 'Habis lembur mampir sini, auto semangat lagi.'];
export const NET_MID = ['Lumayan lah, tapi antrenya bikin pegel.', 'Rasanya oke, tempatnya agak sempit.', 'Biasa aja sih, tapi murah.'];
export const NET_BAD = ['Lauknya kayak sisa kemarin, kecewa', 'Nunggu lama, pas giliranku lauknya habis. Zonk.', 'Mejanya lengket, ada lalat. Kurang bersih.', 'Harga naik tapi porsinya makin dikit. Hmm.'];

// ------------------------------------------------------------------ investasi (late-game money sinks)
export interface Sink { id: string; name: string; max: number; base: number; mult: number; stage: number; desc: string; per: string; yearly?: string }
export const SINKS: Sink[] = [
  { id: 'ruko', name: 'Beli Ruko Sendiri', max: 1, base: 420000000, mult: 1, stage: 3, desc: 'Nggak bayar sewa warung utama lagi, gudang lebih luas, suasana naik.', per: 'Sewa Rp 0 · gudang +150 kg · suasana +5' },
  { id: 'kampung', name: 'Renovasi Kampung', max: 8, base: 45000000, mult: 2, stage: 2, desc: 'Perbaiki jalan gang, musala, pos ronda. Warga makin sayang.', per: 'Ramai +2,5%/lv · fans · jiwa dermawan' },
  { id: 'bola', name: 'Sponsor PS Kali Bening', max: 8, base: 35000000, mult: 2, stage: 2, desc: 'Logo warungmu di jersey klub bola kampung (fiktif). Nobar makin rame.', per: 'Ramai +3%/lv · nobar lebih sering', yearly: 'Iuran musim 6% dari total sponsor tiap Januari' },
  { id: 'beasiswa', name: 'Beasiswa Anak Staf', max: 8, base: 28000000, mult: 2, stage: 2, desc: 'Biaya sekolah anak-anak staf. Loyalitas naik, susah dibajak saingan.', per: 'Loyal staf +, kebal bajakan, kesejahteraan', yearly: 'Rp 1,5 jt × level × jumlah staf tiap Januari' },
];

// ------------------------------------------------------------------ minigame
export type MiniId = 'sambal' | 'tempe' | 'piring';
export const MINIGAMES: Record<MiniId, { name: string; desc: string; effect: string }> = {
  sambal: { name: 'Nguleg Sambal', desc: 'Ketuk pas ulekan di zona hijau. 15 detik!', effect: 'Rasa naik 3 hari' },
  tempe: { name: 'Goreng Tempe', desc: 'Angkat tempe pas warnanya keemasan.', effect: 'Gorengan makin disukai 3 hari' },
  piring: { name: 'Atur Piring', desc: 'Ketuk lauk sesuai pesanan secepatnya!', effect: 'Pelayanan lebih cepat hari ini' },
};

// ------------------------------------------------------------------ gerobak: lokasi mangkal
export interface Mangkal { id: string; name: string; short: string; mix: Partial<Record<CustId, number>>; traffic: number; peaks: [number, number, number][]; weekend: number; satpol: number; desc: string }
export const MANGKAL: Mangkal[] = [
  { id: 'pasar', name: 'Pinggir Pasar Induk', short: 'Pasar', mix: { buruh: 0.3, ibu: 0.25, ojol: 0.15, mhs: 0.1, kantor: 0.1, mandor: 0.1 }, traffic: 1, peaks: [], weekend: 0.95, satpol: 0.005, desc: 'Ramai dari subuh, campur aduk. Aman dari razia.' },
  { id: 'sekolah', name: 'Depan SD & SMP Tunas Bangsa', short: 'Sekolah', mix: { mhs: 0.45, ibu: 0.35, ojol: 0.1, kantor: 0.1 }, traffic: 1.12, peaks: [[6, 7.5, 2.2], [12, 13.5, 2.4]], weekend: 0.35, satpol: 0.016, desc: 'Pelajar & ibu jemput anak. Sabtu-Minggu sepi. Rawan razia.' },
  { id: 'stasiun', name: 'Pintu Keluar Stasiun', short: 'Stasiun', mix: { kantor: 0.35, buruh: 0.25, mhs: 0.15, ojol: 0.15, ibu: 0.1 }, traffic: 1.2, peaks: [[5.5, 8, 2.2], [16.5, 19, 2.2]], weekend: 0.7, satpol: 0.022, desc: 'Komuter pagi & sore, dompet tebal. Satpol PP sering patroli.' },
];

// ------------------------------------------------------------------ endings (v1.3, branching)
export interface EndingDef { id: string; title: string; line: string; special?: boolean }
export const ENDINGS2: EndingDef[] = [
  { id: 'raja', title: 'Raja Warteg Nasional', line: 'Dari gerobak ke franchise nasional, rating tinggi, staf sejahtera. Namamu jadi legenda per-warteg-an!', special: true },
  { id: 'dermawan', title: 'Juragan Dermawan', line: 'Kampung direnovasi, anak staf sekolah, warga hafal namamu. Kaya hati, kaya rezeki.', special: true },
  { id: 'galak', title: 'Bos Galak Kaya Raya', line: 'Kas gemuk, cabang banyak... tapi staf takut lihat mukamu. THR? "Nanti dulu."', special: true },
  { id: 'gengsi', title: 'Bangkrut karena Gengsi', line: 'Ruko mewah, AC di mana-mana, sponsor sana-sini... kasnya bolong. Gaya dulu, mikir belakangan.', special: true },
  { id: 'kasbon', title: 'Juragan Kasbon Rakyat', line: 'Bukumu penuh catatan bon. Banyak yang nggak balik, tapi seisi gang menganggapmu penyelamat akhir bulan.', special: true },
  { id: 'legenda', title: 'Legenda Kaki Lima', line: 'Nggak pernah jadi gede, tapi rasanya juara dan cerita pelanggannya abadi.', special: true },
  { id: 'gulung', title: 'Gulung Tikar', line: 'Utang menumpuk, warung disita. Tapi semua juragan pernah jatuh sekali.' },
  { id: 't0', title: 'Juragan Gerobak', line: 'Masih dorong gerobak, tapi pelanggan setia nggak pernah lupa rasanya.' },
  { id: 't1', title: 'Juragan Warteg Gang', line: 'Satu gang kenal warungmu. Lauknya jadi obrolan pos ronda.' },
  { id: 't2', title: 'Juragan Warteg Kota', line: 'Seisi kota tahu: kalau lapar dan bokek, ke warungmu.' },
  { id: 't3', title: 'Bos Besar Warteg', line: 'Cabang di mana-mana, karyawan puluhan, kasbon tetap dicatat rapi.' },
];
export const TIER_MIN = [0, 35, 55, 72];

// ------------------------------------------------------------------ contextual hints for the new systems
export const HINTS: Record<string, string> = {
  hujan: 'Hujan! Walk-in sepi, tapi ojol rame dan orang yang neduh suka beli es teh / gorengan.',
  panas: 'Panas terik! Es teh bakal laris. Tambah porsinya di MASAK.',
  ramadan: 'Bulan Ramadan: siang sepi, sahur & buka puasa meledak. Takjil (kolak, es buah) bisa dimasak!',
  katering: 'Pesanan katering makan tenaga dapur & bahan selama beberapa hari. Cek progresnya di menu KAMPUNG.',
  regular: 'Pelanggan langganan punya cerita sendiri. Pilihanmu menentukan akhir ceritanya (cek tab Langganan).',
  kucing: 'Ada kucing! Kasih makan tiap hari biar sayang. Kucing yang lapar suka nyolong ikan.',
  harga: 'Gejolak harga! Lihat KABAR PASAR di Belanja. Borong pas murah, tapi gudang ada batasnya.',
  medsos: 'Warungmu mulai diomongin netizen. Komplain sebaiknya dibalas, jangan didiemin!',
  drama: 'Drama staf! Pilihanmu ngaruh ke loyalitas. Staf yang nggak betah bisa resign.',
  investasi: 'Kas mulai tebal? Investasi (menu KAMPUNG) kasih bonus permanen dan nentuin gelar akhir.',
  mini: 'Coba DAPUR SERU di MASAK: minigame singkat yang kasih bonus kualitas. Boleh dilewati!',
  mangkal: 'Gerobak bisa pindah mangkal (Menu > Warung): sekolah & stasiun lebih rame, tapi rawan razia.',
  figuran: 'Ketuk orang-orang di jalan (pengamen, tukang parkir, asongan, hansip) buat interaksi kecil.',
  radio: 'Radio warung bisa diganti channel: dangdut, berita, iklan, atau dimatiin (Menu > Pengaturan).',
  thr: 'THR itu kewajiban! Nggak bayar = staf kecewa berat, bisa mogok atau resign.',
};
