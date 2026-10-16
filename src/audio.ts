// WebAudio synth: SFX + a small step sequencer for the warung radio (v1.3: original dangdut / news / jingle tracks).
// No audio files. Everything degrades to a silent no-op when AudioContext is missing.
type Wave = OscillatorType;

export type TrackId = 'title' | 'dangdut' | 'koplo' | 'berita' | 'iklan' | 'award';
export type StingId = 'roll' | 'great' | 'good' | 'flop' | 'drama';

const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteNum(tok: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(tok);
  if (!m) return 0;
  return NOTE_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}

// ------------------------------------------------------------------ track format
// 16 steps per bar. Melody strings are space separated tokens, 8 (eighths) or 16 per bar:
// note name ("A4", "C#5", "Bb4"), "." rest, "-" hold previous note.
// Bass pattern chars (16 per bar): R root, 3 third, 5 fifth, 7 seventh, 8 octave, "-" hold, "." rest.
// Stab pattern: "x" = short chord hit. Drum strings: one char per 16th, repeated over the section.
//  kendang: D dut (low) d soft dut, T tung, t tak, P loud tak, k ghost   kit: K kick S snare r roll tick
//  h hat o open hat c kecrek C crash B timpani boom
interface SectionSpec {
  bars: number;
  chords: string; // one token per bar, "Am|E" splits a bar in halves
  lead?: string;
  counter?: string;
  pad?: boolean;
  noBass?: boolean;
  noStab?: boolean;
  drums?: Record<string, string>; // replaces the track's drums for this section
  fill?: Record<string, string>; // 16-step override for the section's last bar
}
interface TrackSpec {
  bpm: number;
  lead: string; counter?: string; bass: string; stab?: string;
  bassPat: string; stabPat?: string;
  drums: Record<string, string>;
  sections: Record<string, SectionSpec>;
  order: string[];
  loopFrom: number; // index into order where the loop restarts (intro plays once)
  leadVol?: number;
}
interface Ev { drum: boolean; inst: string; midi: number; len: number; vol: number }
interface Track { bpm: number; steps: Ev[][]; loopStart: number; total: number }

function parseChord(name: string) {
  const m = /^([A-G])([#b]?)(m7|m|7|dim|sus)?$/.exec(name);
  if (!m) return { root: 9, third: 3, fifth: 7, sev: 10 };
  const root = NOTE_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const q = m[3] ?? '';
  const minor = q === 'm' || q === 'm7' || q === 'dim';
  return { root: (root + 12) % 12, third: q === 'sus' ? 5 : minor ? 3 : 4, fifth: q === 'dim' ? 6 : 7, sev: q === 'dim' ? 9 : q === 'm7' || q === '7' ? 10 : 11 };
}
function inRange(pc: number, lo: number) { let n = lo + ((pc - lo) % 12 + 12) % 12; if (n < lo) n += 12; return n; }

function melody(str: string, bars: number, base: number, inst: string, vol: number, out: Ev[][]) {
  const toks = str.trim().split(/\s+/);
  const res = Math.max(1, Math.round((bars * 16) / toks.length));
  for (let j = 0; j < toks.length; j++) {
    const t = toks[j];
    if (t === '.' || t === '-') continue;
    let holds = 0;
    while (toks[j + 1 + holds] === '-') holds++;
    const midi = noteNum(t);
    if (midi) out[base + j * res]?.push({ drum: false, inst, midi, len: res * (1 + holds), vol });
  }
}

function compile(spec: TrackSpec): Track {
  const order = spec.order.map((n) => spec.sections[n]);
  const total = order.reduce((a, s) => a + s.bars * 16, 0);
  const steps: Ev[][] = Array.from({ length: total }, () => []);
  let base = 0, loopStart = 0;
  order.forEach((sec, si) => {
    if (si === spec.loopFrom) loopStart = base;
    const bars = sec.chords.trim().split(/\s+/);
    for (let b = 0; b < sec.bars; b++) {
      const segs = (bars[b] ?? bars[bars.length - 1]).split('|');
      const segLen = 16 / segs.length;
      segs.forEach((cn, k) => {
        const c = parseChord(cn);
        const s0 = b * 16 + k * segLen;
        const rootB = inRange(c.root, 40);
        const rootS = inRange(c.root, 57);
        for (let i = 0; i < segLen; i++) {
          const st = base + s0 + i;
          const inBar = k * segLen + i;
          if (!sec.noBass) {
            const ch = spec.bassPat[inBar % spec.bassPat.length];
            const iv = ch === 'R' ? 0 : ch === '3' ? c.third : ch === '5' ? c.fifth : ch === '7' ? c.sev : ch === '8' ? 12 : -1;
            if (iv >= 0) {
              let h = 0; while (spec.bassPat[(inBar + 1 + h) % 16] === '-' && i + 1 + h < segLen) h++;
              steps[st].push({ drum: false, inst: spec.bass, midi: rootB + iv, len: 1 + h, vol: 1 });
            }
          }
          if (spec.stab && spec.stabPat && !sec.noStab && spec.stabPat[inBar % spec.stabPat.length] === 'x') {
            for (const iv of [0, c.third, c.fifth]) steps[st].push({ drum: false, inst: spec.stab, midi: inRange((c.root + iv) % 12, 57), len: 1, vol: 1 });
          }
        }
        if (sec.pad) {
          for (const n of [rootS - 12, rootS + c.third, rootS + c.fifth, rootS + 12]) steps[base + s0].push({ drum: false, inst: 'pad', midi: n, len: segLen, vol: 1 });
        }
      });
    }
    if (sec.lead) melody(sec.lead, sec.bars, base, spec.lead, spec.leadVol ?? 1, steps);
    if (sec.counter && spec.counter) melody(sec.counter, sec.bars, base, spec.counter, 1, steps);
    const kit = sec.drums ?? spec.drums;
    for (const [chan, pat] of Object.entries(kit)) {
      for (let i = 0; i < sec.bars * 16; i++) {
        const lastBar = i >= (sec.bars - 1) * 16;
        const p = lastBar && sec.fill && sec.fill[chan] !== undefined ? sec.fill[chan] : pat;
        const ch = p[i % p.length];
        if (ch && ch !== '.') steps[base + i].push({ drum: true, inst: ch, midi: 0, len: 1, vol: 1 });
      }
    }
    if (sec.fill) {
      for (const [chan, pat] of Object.entries(sec.fill)) {
        if (kit[chan] !== undefined) continue; // fill-only channel
        for (let i = 0; i < 16; i++) { const ch = pat[i]; if (ch && ch !== '.') steps[base + (sec.bars - 1) * 16 + i].push({ drum: true, inst: ch, midi: 0, len: 1, vol: 1 }); }
      }
    }
    base += sec.bars * 16;
  });
  return { bpm: spec.bpm, steps, loopStart, total };
}

// ------------------------------------------------------------------ the songs (v1.3: all new, original compositions)
// The radio in the warung plays one of these channels. Everything is generated by the step sequencer below.
// "Dangdut Warteg": E minor dangdut with a harmonic-minor (D#) bite, suling lead + plucked guitar answers. ~50s loop.
const KENDANG_WARTEG = { k: 'D.tkD.tDT.tkD.t.', h: '......c.......c.' };
const DANGDUT_SECTIONS: Record<string, SectionSpec> = {
  intro: { bars: 2, chords: 'Em B7', lead: 'B4 - C5 B4 A4 G4 F#4 -   E4 - F#4 G4 A4 - B4 -', noStab: true, fill: { k: 'TtTtD.D.TtTtDDDD' } },
  a1: { bars: 4, chords: 'Em Em Am B7',
    lead: 'E5 - D#5 E5 F#5 - E5 D5   C5 - B4 - A4 - B4 .   A4 - C5 E5 D5 C5 B4 A4   B4 - - D#5 F#5 - E5 D#5',
    counter: '. . . . . . B4 .   . . . . . . E4 .   . . . . . . A4 .   . . . . . . F#4 .' },
  a2: { bars: 4, chords: 'Em Em Am|B7 Em',
    lead: 'E5 - D#5 E5 G5 - F#5 E5   D5 - C5 - B4 - G4 .   A4 C5 B4 A4 G4 - F#4 D#4   E4 - - - . . . .',
    fill: { k: 'D.tkD.tDTtTtDDTT' } },
  b1: { bars: 4, chords: 'Am D G C',
    lead: 'A4 - C5 E5 A5 - G5 E5   F#5 - E5 D5 C5 - D5 -   B4 - D5 G5 B5 - A5 G5   E5 - - - G5 E5 C5 -',
    counter: 'E4 - - - C5 - - -   D4 - - - F#4 - - -   G4 - - - D5 - - -   E4 - - - C5 - - -' },
  b2: { bars: 4, chords: 'Am B7 Em|C B7',
    lead: 'A5 G5 F#5 E5 D5 - C5 B4   C5 - D#5 - F#5 - A5 -   G5 F#5 E5 D5 C5 - B4 -   B4 - A4 - G4 - F#4 -',
    fill: { k: 'TtTtD.D.TtTtDDDD', C: '...............C' } },
  brk: { bars: 2, chords: 'Em B7', lead: 'G5 - - - F#5 E5 D#5 -   E5 - - - B4 - - -', noStab: true,
    drums: { k: 'D.......D...t.t.' }, fill: { k: 'DtDtDtDtTTTTDDDD' } },
};
const DANGDUT: TrackSpec = {
  bpm: 116, lead: 'suling', counter: 'pluck', bass: 'bass', stab: 'stab',
  bassPat: 'R..5..R.R.5..R5.', stabPat: '..x..x..x..x..x.',
  drums: KENDANG_WARTEG, sections: DANGDUT_SECTIONS,
  order: ['intro', 'a1', 'a2', 'b1', 'b2', 'brk', 'a1', 'a2'], loopFrom: 1,
};
// "Koplo Jam Sibuk": the same song for the lunch rush, faster, koplo kendang + kecrek. ~40s loop.
const KOPLO: TrackSpec = {
  ...DANGDUT, bpm: 140, bassPat: 'R.5.R.58R.5.R.5.', stabPat: '..x.x...x.x.x..x',
  drums: { k: 'DtkDTtkDDtkDTktT', c: '..c...c...c...c.', h: 'h.h.h.h.h.h.h.h.' },
  order: ['a1', 'a2', 'b1', 'b2', 'brk'], loopFrom: 0,
};
// "Title": festive G-major chip theme with a kendang groove. ~32s loop.
const TITLE: TrackSpec = {
  bpm: 126, lead: 'chip', counter: 'bell', bass: 'bassq', stab: 'stab',
  bassPat: 'R...R.5.R...R.8.', stabPat: '..x...x...x...x.',
  drums: { k: 'D..tD.t.D..tT.t.', h: 'h.h.h.h.h.h.h.h.' },
  sections: {
    intro: { bars: 2, chords: 'G D', lead: 'D5 - G5 - B5 - A5 G5   F#5 - D5 - E5 F#5 G5 -', noStab: true, fill: { k: 'D.D.TtTtDDTtTTTT', C: '...............C' } },
    a1: { bars: 4, chords: 'G Em C D',
      lead: 'B4 D5 G5 - F#5 E5 D5 -   E5 - G5 E5 D5 B4 G4 -   C5 E5 G5 - A5 G5 E5 C5   D5 - F#5 - A5 - G5 F#5' },
    b1: { bars: 4, chords: 'Em C G D', pad: true,
      lead: 'G5 - E5 - B4 - E5 G5   A5 - G5 E5 C5 - . .   B4 C5 D5 - G5 - B5 -   A5 - - - F#5 - D5 -',
      counter: 'B5 . G5 . E5 . G5 .   C6 . G5 . E5 . G5 .   B5 . G5 . D5 . G5 .   A5 . F#5 . D5 . F#5 .' },
    a2: { bars: 4, chords: 'G Em C|D G',
      lead: 'B4 D5 G5 - F#5 E5 D5 -   E5 - G5 E5 D5 B4 G4 -   C5 E5 A5 G5 F#5 - E5 F#5   G5 - - - . . D5 -',
      fill: { k: 'D.tkT.tDTtTtDDTT' } },
  },
  order: ['intro', 'a1', 'b1', 'a2'], loopFrom: 1, leadVol: 0.85,
};
// "Berita Kota": stately C-major news bed (brass ident, then bell arpeggios over pads). ~35s loop.
const BERITA: TrackSpec = {
  bpm: 100, lead: 'brass', counter: 'bell', bass: 'bassq', stab: 'stab',
  bassPat: 'R.......5.......', stabPat: '................',
  drums: { K: 'K.......K.......', h: '....h.......h...' },
  sections: {
    intro: { bars: 2, chords: 'C G', pad: true, noBass: true, lead: 'C5 . G4 . C5 E5 G5 -   F5 - E5 - D5 - - .', drums: { B: 'B.......B.......' } },
    a1: { bars: 4, chords: 'C Am F G', pad: true,
      counter: 'C5 E5 G5 E5 C6 G5 E5 G5   A4 C5 E5 C5 A5 E5 C5 E5   F4 A4 C5 A4 F5 C5 A4 C5   G4 B4 D5 B4 G5 D5 B4 D5' },
    a2: { bars: 4, chords: 'F G Em Am', pad: true,
      counter: 'F4 A4 C5 F5 A5 F5 C5 A4   G4 B4 D5 G5 B5 G5 D5 B4   E4 G4 B4 E5 G5 E5 B4 G4   A4 C5 E5 A5 C6 A5 E5 C5' },
    a3: { bars: 4, chords: 'Dm G C C', pad: true,
      lead: 'D5 - - - F5 - E5 D5   B4 - - - D5 - - -   C5 - E5 - G5 - - -   C6 - - - - - - -',
      counter: 'D4 F4 A4 D5 . . . .   G4 B4 D5 G5 . . . .   C5 E5 G5 C6 . . . .   G5 E5 C5 G4 . . . .' },
  },
  order: ['intro', 'a1', 'a2', 'a3'], loopFrom: 1,
};
// "Jeda Iklan": bouncy F-major jingles (fictional ads), chip + brass hits + snare. ~30s loop.
const IKLAN: TrackSpec = {
  bpm: 132, lead: 'chip', counter: 'brass', bass: 'bass', stab: 'stab',
  bassPat: 'R.R.5.5.R.R.8.5.', stabPat: '..x...x...x...x.',
  drums: { K: 'K...K...K...K...', S: '....S.......S.S.', h: '..h...h...h...h.' },
  sections: {
    a1: { bars: 4, chords: 'F Bb C F',
      lead: 'C5 F5 A5 F5 C6 - A5 -   Bb5 A5 G5 F5 D5 - . .   E5 G5 C6 Bb5 A5 G5 E5 C5   F5 - A5 - F5 - . .',
      counter: 'F4 . . . . . . .   Bb4 . . . . . . .   C5 . . . . . . .   F4 . . F4 A4 . . .' },
    b1: { bars: 4, chords: 'Dm Bb Gm C',
      lead: 'D5 F5 A5 - G5 F5 E5 D5   F5 - D5 - Bb4 - . .   G4 Bb4 D5 G5 F5 E5 D5 E5   C5 - - - E5 G5 C6 -',
      fill: { S: '....S...SSSSSSSS', C: '...............C' } },
    a2: { bars: 4, chords: 'G C D G',
      lead: 'D5 G5 B5 G5 D6 - B5 -   C6 B5 A5 G5 E5 - . .   F#5 A5 D6 C6 B5 A5 F#5 D5   G5 - B5 - G5 - . .',
      counter: 'G4 . . . . . . .   C5 . . . . . . .   D5 . . . . . . .   G4 . . G4 B4 . . .' },
  },
  order: ['a1', 'b1', 'a2', 'b1'], loopFrom: 0,
};
// "Rekap Juragan": grand D-major march for the ending, brass + timpani + snare. ~38s loop.
const AWARD: TrackSpec = {
  bpm: 100, lead: 'brass', counter: 'chip', bass: 'timp', stab: 'stab',
  bassPat: 'R.......R...5.R.', stabPat: '....x.......x...',
  drums: { S: 'S..rS.r.S.rrS.r.', C: 'C...............................' },
  sections: {
    a1: { bars: 4, chords: 'D G A D', pad: true,
      lead: 'D5 - F#5 - A5 - - F#5   G5 - B5 - D6 - - B5   A5 - C#6 - E6 - D6 C#6   D6 - - - A5 - - -' },
    b1: { bars: 4, chords: 'Bm G Em|A D', pad: true,
      lead: 'F#5 - E5 D5 B4 - D5 -   G5 - F#5 E5 D5 - B4 -   E5 - G5 F#5 E5 - C#5 -   D5 - - - . . A4 -',
      fill: { S: 'S..rS.r.rrrrSSSS' } },
    a2: { bars: 4, chords: 'D G A D', pad: true,
      lead: 'D5 - F#5 - A5 - - F#5   G5 - B5 - D6 - - B5   A5 - C#6 - E6 - D6 C#6   D6 - - - A5 - - -',
      counter: 'A5 F#5 A5 D6 . . . .   B5 G5 B5 D6 . . . .   C#6 A5 C#6 E6 . . . .   D6 . A5 . D6 . . .' },
  },
  order: ['a1', 'b1', 'a2', 'b1'], loopFrom: 0,
};
const SPECS: Record<TrackId, TrackSpec> = { title: TITLE, dangdut: DANGDUT, koplo: KOPLO, berita: BERITA, iklan: IKLAN, award: AWARD };
/** v1.3 radio channels in the warung (persisted per device, like the mute settings) */
export type RadioId = 'dangdut' | 'berita' | 'iklan' | 'mati';
export const RADIO: { id: RadioId; name: string; desc: string }[] = [
  { id: 'dangdut', name: 'Dangdut', desc: 'koplo pas jam sibuk' },
  { id: 'berita', name: 'Berita', desc: 'kabar kota & pasar' },
  { id: 'iklan', name: 'Iklan', desc: 'jingle iklan fiktif' },
  { id: 'mati', name: 'Mati', desc: 'radio dimatiin' },
];

// one-shot stingers: [time in s, voice, note, dur, vol]
type StingNote = [number, string, string, number, number?];
const STINGS: Record<Exclude<StingId, 'roll'>, { len: number; notes: StingNote[]; drums: [number, string][] }> = {
  great: { len: 2.4, notes: [
    [0, 'brass', 'G4', 0.12], [0.12, 'brass', 'C5', 0.12], [0.24, 'brass', 'E5', 0.12], [0.36, 'brass', 'G5', 0.32],
    [0.72, 'brass', 'E5', 0.12], [0.84, 'brass', 'C6', 1.3],
    [0.84, 'brass', 'G5', 1.3, 0.6], [0.84, 'brass', 'E5', 1.3, 0.6], [0.84, 'pad', 'C4', 1.4], [0.84, 'pad', 'G4', 1.4],
    [0.84, 'chip', 'C6', 0.1, 0.5], [0.94, 'chip', 'E6', 0.1, 0.5], [1.04, 'chip', 'G6', 0.1, 0.5], [1.14, 'chip', 'C7', 0.3, 0.4],
    [0.84, 'timp', 'C3', 0.6], [0.36, 'timp', 'G2', 0.3]],
    drums: [[0, 'S'], [0.12, 'S'], [0.24, 'S'], [0.36, 'S'], [0.84, 'C'], [0.84, 'B']] },
  good: { len: 1.4, notes: [
    [0, 'chip', 'C5', 0.09], [0.1, 'chip', 'E5', 0.09], [0.2, 'chip', 'G5', 0.09], [0.3, 'chip', 'E5', 0.09],
    [0.4, 'chip', 'F5', 0.09], [0.5, 'chip', 'A5', 0.09], [0.6, 'chip', 'C6', 0.45], [0.6, 'bell', 'C6', 0.6], [0.6, 'bass', 'C3', 0.4]],
    drums: [[0, 'D'], [0.2, 't'], [0.3, 'D'], [0.5, 't'], [0.6, 'D'], [0.6, 'c']] },
  flop: { len: 2.9, notes: [], drums: [] }, // synthesized trombone, see sting()
  drama: { len: 2.6, notes: [
    [0, 'brass', 'D3', 0.2], [0, 'brass', 'A3', 0.2], [0, 'brass', 'D4', 0.2], [0, 'brass', 'F4', 0.2],
    [0.3, 'brass', 'D3', 0.2], [0.3, 'brass', 'A3', 0.2], [0.3, 'brass', 'D4', 0.2], [0.3, 'brass', 'F4', 0.2],
    [0.78, 'brass', 'C#4', 1.6], [0.78, 'brass', 'G4', 1.6], [0.78, 'brass', 'Bb4', 1.6], [0.78, 'brass', 'E5', 1.6],
    [0.78, 'pad', 'C#3', 1.8], [0.78, 'pad', 'G3', 1.8]],
    drums: [[0, 'B'], [0.3, 'B'], [0.78, 'B'], [0.78, 'C']] },
};

const MUSIC_VOL = 0.09; // music bus level: keeps the loops under the SFX
interface Player { track: Track; bus: GainNode; step: number; nextTime: number; endAt: number }

class Synth {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  muted = false;
  musicOn = true;
  radio: RadioId = 'dangdut';
  private loopBus: GainNode | null = null;
  private stingBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private players: Player[] = [];
  private stings: { g: GainNode; end: number }[] = [];
  private tracks = new Map<TrackId, Track>();
  private want: TrackId | null = null;
  private override: TrackId | 'silent' | null = null;
  private current: TrackId | null = null;
  private paused = false;
  private duckUntil = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem('warteg-mute') === '1';
      this.musicOn = localStorage.getItem('warteg-music') !== '0';
      const r = localStorage.getItem('warteg-radio');
      if (r === 'dangdut' || r === 'berita' || r === 'iklan' || r === 'mati') this.radio = r;
    } catch { /* ignore */ }
    try {
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => this.onVisibility());
        const first = () => { this.unlock(); };
        document.addEventListener('pointerdown', first, { once: true });
        document.addEventListener('keydown', first, { once: true });
      }
    } catch { /* ignore */ }
  }

  /** must be called from a user gesture */
  unlock() {
    if (!this.ctx) {
      const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = g.AudioContext ?? g.webkitAudioContext;
      if (!AC) return;
      try {
        const ctx = new AC();
        let out: AudioNode = ctx.destination;
        try {
          const comp = ctx.createDynamicsCompressor();
          comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
          comp.connect(ctx.destination); out = comp;
        } catch { /* optional */ }
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : 0.5;
        master.connect(out);
        const music = ctx.createGain();
        music.gain.value = this.musicOn ? MUSIC_VOL : 0;
        music.connect(master);
        const loop = ctx.createGain();
        loop.connect(music);
        const sting = ctx.createGain();
        sting.gain.value = 1.5;
        sting.connect(music);
        const n = ctx.sampleRate;
        const buf = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.ctx = ctx; this.master = master; this.musicGain = music; this.loopBus = loop; this.stingBus = sting; this.noiseBuf = buf;
      } catch { this.ctx = null; return; }
    }
    if (this.ctx.state === 'suspended' && !this.hidden()) void this.ctx.resume().catch(() => undefined);
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 25);
    this.updateMusic();
  }

  private hidden() { try { return typeof document !== 'undefined' && document.hidden; } catch { return false; } }
  private onVisibility() {
    if (!this.ctx) return;
    try {
      if (this.hidden()) void this.ctx.suspend().catch(() => undefined);
      else void this.ctx.resume().catch(() => undefined);
    } catch { /* ignore */ }
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem('warteg-mute', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    try { localStorage.setItem('warteg-music', on ? '1' : '0'); } catch { /* ignore */ }
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? MUSIC_VOL : 0, this.ctx.currentTime, 0.05);
  }

  setRadio(r: RadioId) {
    this.radio = r;
    try { localStorage.setItem('warteg-radio', r); } catch { /* ignore */ }
  }
  /** the track the radio plays right now (rush = the koplo version of the dangdut channel) */
  radioTrack(rush: boolean): TrackId | null {
    if (this.radio === 'mati') return null;
    if (this.radio === 'dangdut') return rush ? 'koplo' : 'dangdut';
    return this.radio;
  }

  // ---------------------------------------------------------------- music control
  /** base track for the current scene/state (cheap to call every frame) */
  playMusic(id: TrackId | null) { if (this.want !== id) { this.want = id; this.updateMusic(); } }
  /** temporary track for a modal (award loop, or 'silent' for the rating reveal); null clears */
  setMusicOverride(id: TrackId | 'silent' | null) { if (this.override !== id) { this.override = id; this.updateMusic(); } }
  hasOverride() { return this.override !== null; }
  /** game paused (speed II): the loop fades out and holds its position */
  setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (!p) for (const pl of this.players) pl.nextTime = now + 0.06;
    this.applyLoopGain();
  }
  get musicTrack() { return this.current; }

  private updateMusic() {
    const target: TrackId | null = this.override === 'silent' ? null : (this.override ?? this.want);
    if (!this.ctx || !this.loopBus) return;
    if (target === this.current) return;
    this.current = target;
    const now = this.ctx.currentTime;
    const hadPrev = this.players.some((p) => p.endAt > now);
    for (const p of this.players) {
      if (p.endAt <= now) continue;
      p.bus.gain.cancelScheduledValues(now);
      p.bus.gain.setValueAtTime(p.bus.gain.value, now);
      p.bus.gain.linearRampToValueAtTime(0, now + 1.1);
      p.endAt = Math.min(p.endAt, now + 1.2);
    }
    if (!target) return;
    let tr = this.tracks.get(target);
    if (!tr) { tr = compile(SPECS[target]); this.tracks.set(target, tr); }
    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + (hadPrev ? 1.1 : 0.25));
    bus.connect(this.loopBus);
    this.players.push({ track: tr, bus, step: 0, nextTime: now + 0.08, endAt: Infinity });
  }

  private applyLoopGain() {
    if (!this.ctx || !this.loopBus) return;
    const now = this.ctx.currentTime;
    const g = this.loopBus.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    if (this.paused) g.linearRampToValueAtTime(0, now + 0.3);
    else if (this.duckUntil > now) { g.linearRampToValueAtTime(0.18, now + 0.08); g.setValueAtTime(0.18, this.duckUntil); g.linearRampToValueAtTime(1, this.duckUntil + 0.6); }
    else g.linearRampToValueAtTime(1, now + 0.3);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    this.players = this.players.filter((p) => {
      if (p.endAt <= now) { try { p.bus.disconnect(); } catch { /* ignore */ } return false; }
      return true;
    });
    this.stings = this.stings.filter((s) => { if (s.end <= now) { try { s.g.disconnect(); } catch { /* ignore */ } return false; } return true; });
    if (this.paused) return;
    const silent = this.muted || !this.musicOn;
    for (const p of this.players) {
      const tr = p.track;
      const stepDur = 60 / tr.bpm / 4;
      if (p.nextTime < now - 0.25) p.nextTime = now + 0.03; // after a stall, resync instead of bursting
      while (p.nextTime < now + 0.14 && p.nextTime < p.endAt) {
        if (!silent) for (const e of tr.steps[p.step]) {
          const v = e.vol * (0.92 + Math.random() * 0.12);
          if (e.drum) this.drumHit(e.inst, p.nextTime, v, p.bus);
          else this.voice(e.inst, e.midi, p.nextTime, e.len * stepDur, v, p.bus);
        }
        p.nextTime += stepDur;
        p.step++;
        if (p.step >= tr.total) p.step = tr.loopStart;
      }
    }
  }

  // ---------------------------------------------------------------- instruments
  private env(g: GainNode, t: number, a: number, peak: number, dur: number, rel: number, sus = 0.8) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(peak * sus, t + Math.max(a + 0.01, Math.min(dur, a + 0.12)));
    g.gain.setValueAtTime(peak * sus, t + Math.max(a + 0.02, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.03, dur) + rel);
  }
  private osc(type: Wave, f: number, t: number, end: number, dest: AudioNode, detune = 0) {
    const o = this.ctx!.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.setValueAtTime(detune, t);
    o.connect(dest); o.start(t); o.stop(end + 0.05);
    return o;
  }
  private vibrato(o: OscillatorNode, t: number, end: number, rate: number, depthHz: number, delay: number) {
    const ctx = this.ctx!;
    const l = ctx.createOscillator(); const lg = ctx.createGain();
    l.frequency.value = rate;
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + delay); lg.gain.linearRampToValueAtTime(depthHz, t + delay + 0.15);
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(end + 0.05);
  }
  private filt(type: BiquadFilterType, f: number, q: number, dest: AudioNode) {
    const b = this.ctx!.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b;
  }

  private voice(inst: string, midi: number, t: number, dur: number, vol: number, dest: AudioNode) {
    const ctx = this.ctx; if (!ctx) return;
    const f = mtof(midi);
    const g = ctx.createGain(); g.connect(dest);
    switch (inst) {
      case 'suling': { // bamboo flute: filtered triangle, pitch scoop + delayed vibrato, breath puff
        const rel = 0.09, end = t + dur + rel;
        this.env(g, t, 0.035, 0.34 * vol, dur, rel, 0.85);
        const lp = this.filt('lowpass', 2600, 1.5, g);
        const o = this.osc('triangle', f * 0.955, t, end, lp);
        o.frequency.linearRampToValueAtTime(f, t + 0.06);
        if (dur > 0.18) this.vibrato(o, t, end, 5.6, f * 0.013, 0.12);
        const g2 = ctx.createGain(); g2.gain.value = 0.12; g2.connect(lp);
        const o2 = this.osc('sine', f * 2, t, end, g2); o2.frequency.linearRampToValueAtTime(f * 2, t + 0.06);
        this.noiseHit(t, 0.06, 'bandpass', f * 2, 2, 0.05 * vol, g);
        break;
      }
      case 'pluck': { // plucked guitar: bright saw, fast decay through a closing lowpass
        const end = t + Math.min(0.45, Math.max(0.18, dur));
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, end);
        const lp = this.filt('lowpass', 3200, 2, g);
        lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.2);
        this.osc('sawtooth', f, t, end, lp); this.osc('triangle', f * 2, t, end, lp);
        break;
      }
      case 'chip': {
        const rel = 0.05, end = t + dur + rel;
        this.env(g, t, 0.005, 0.16 * vol, dur * 0.9, rel, 0.65);
        const o = this.osc('square', f, t, end, g);
        if (dur > 0.3) this.vibrato(o, t, end, 6, f * 0.008, 0.18);
        break;
      }
      case 'brass': {
        const rel = 0.12, end = t + dur + rel;
        this.env(g, t, 0.035, 0.2 * vol, dur, rel, 0.75);
        const lp = this.filt('lowpass', 500, 1.2, g);
        lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(3000, t + 0.06); lp.frequency.linearRampToValueAtTime(1500, t + 0.25);
        this.osc('sawtooth', f, t, end, lp, -7); this.osc('sawtooth', f, t, end, lp, 7);
        break;
      }
      case 'pad': {
        const rel = 0.35, end = t + dur + rel;
        this.env(g, t, Math.min(0.25, dur * 0.4), 0.055 * vol, dur, rel, 0.9);
        const lp = this.filt('lowpass', 1100, 0.7, g);
        this.osc('sawtooth', f, t, end, lp, -11); this.osc('sawtooth', f, t, end, lp, 11);
        break;
      }
      case 'bell': {
        const end = t + Math.max(0.5, dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1 * vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, end);
        this.osc('sine', f, t, end, g);
        const g2 = ctx.createGain(); g2.gain.value = 0.3; g2.connect(g); this.osc('sine', f * 3.01, t, end, g2);
        break;
      }
      case 'bass': {
        const rel = 0.06, end = t + dur + rel;
        this.env(g, t, 0.006, 0.42 * vol, dur * 0.85, rel, 0.6);
        this.osc('triangle', f, t, end, g);
        break;
      }
      case 'bassq': {
        const rel = 0.05, end = t + dur + rel;
        this.env(g, t, 0.005, 0.2 * vol, dur * 0.8, rel, 0.55);
        this.osc('square', f, t, end, this.filt('lowpass', 750, 1, g));
        break;
      }
      case 'stab': {
        const d = 0.07, end = t + d + 0.04;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045 * vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, end);
        this.osc('square', f, t, end, this.filt('bandpass', 1400, 0.8, g));
        break;
      }
      case 'timp': {
        const end = t + Math.max(0.45, dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, end);
        const o = this.osc('sine', f * 1.04, t, end, g); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
        break;
      }
      default: {
        this.env(g, t, 0.01, 0.12 * vol, dur, 0.05);
        this.osc('square', f, t, t + dur + 0.05, g);
      }
    }
  }

  private noiseHit(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, vol: number, dest: AudioNode) {
    const ctx = this.ctx; if (!ctx || !this.noiseBuf) return;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(this.filt(type, freq, q, g)); g.connect(dest);
    s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.02);
  }
  private tom(t: number, f0: number, f1: number, dur: number, vol: number, dest: AudioNode) {
    const ctx = this.ctx; if (!ctx) return;
    const g = ctx.createGain(); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = this.osc('sine', f0, t, t + dur, g); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
  }
  private drumHit(c: string, t: number, v: number, dest: AudioNode) {
    switch (c) {
      case 'D': this.tom(t, 175, 62, 0.3, 0.75 * v, dest); break; // kendang "dut"
      case 'd': this.tom(t, 175, 62, 0.2, 0.4 * v, dest); break;
      case 'T': this.tom(t, 340, 250, 0.13, 0.42 * v, dest); this.noiseHit(t, 0.02, 'bandpass', 3000, 1, 0.08 * v, dest); break; // "tung"
      case 't': this.noiseHit(t, 0.05, 'bandpass', 2600, 1.4, 0.5 * v, dest); this.tom(t, 520, 400, 0.04, 0.12 * v, dest); break; // "tak"
      case 'P': this.noiseHit(t, 0.08, 'bandpass', 1900, 1, 0.65 * v, dest); break;
      case 'k': this.noiseHit(t, 0.025, 'highpass', 5000, 0.7, 0.16 * v, dest); break;
      case 'c': this.noiseHit(t, 0.07, 'highpass', 7000, 0.7, 0.18 * v, dest); this.noiseHit(t + 0.02, 0.05, 'highpass', 8000, 0.7, 0.1 * v, dest); break; // kecrek
      case 'K': this.tom(t, 130, 45, 0.25, 0.8 * v, dest); break;
      case 'S': this.noiseHit(t, 0.13, 'bandpass', 1600, 0.8, 0.45 * v, dest); this.tom(t, 230, 170, 0.08, 0.2 * v, dest); break;
      case 'r': this.noiseHit(t, 0.05, 'bandpass', 1800, 0.8, 0.2 * v, dest); break;
      case 'h': this.noiseHit(t, 0.03, 'highpass', 8000, 0.7, 0.12 * v, dest); break;
      case 'o': this.noiseHit(t, 0.18, 'highpass', 7000, 0.7, 0.12 * v, dest); break;
      case 'C': this.noiseHit(t, 1.3, 'highpass', 5000, 0.5, 0.22 * v, dest); break;
      case 'B': this.tom(t, 100, 68, 0.7, 0.8 * v, dest); break;
    }
  }

  // ---------------------------------------------------------------- stingers
  /** one-shot musical sting on the music bus; ducks the loop. Falls back to plain SFX when music is off. */
  sting(id: StingId) {
    if (!this.ctx || !this.stingBus || this.muted) return;
    if (id !== 'roll' && id !== 'flop' && !STINGS[id]) return;
    if (!this.musicOn) {
      ({ roll: () => this.drum(), great: () => this.fanfare(), good: () => this.coin(), flop: () => this.sad(), drama: () => this.bad() })[id]?.();
      return;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.03;
    const g = ctx.createGain(); g.connect(this.stingBus);
    let len = 1;
    if (id === 'roll') {
      len = 1.45;
      for (let x = 0; x < len; x += 0.034) this.noiseHit(t + x, 0.05, 'bandpass', 1700, 0.8, 0.06 + 0.32 * (x / len), g);
      for (let x = 0; x < len; x += 0.07) this.tom(t + x, 92, 80, 0.12, 0.15 + 0.4 * (x / len), g);
    } else if (id === 'flop') {
      // sad trombone "wah wah wah waaah": detuned saws with a wah filter per note
      len = 2.9;
      const notes: [number, number, number][] = [[0, 58, 0.42], [0.46, 57, 0.42], [0.92, 56, 0.42], [1.38, 55, 1.3]];
      for (const [at, n, d] of notes) {
        const tt = t + at, f = mtof(n), end = tt + d + 0.12;
        const vg = ctx.createGain(); vg.connect(g);
        this.env(vg, tt, 0.04, 0.22, d, 0.12, 0.9);
        const lp = this.filt('lowpass', 350, 6, vg);
        lp.frequency.setValueAtTime(350, tt); lp.frequency.linearRampToValueAtTime(1500, tt + Math.min(0.2, d * 0.4)); lp.frequency.linearRampToValueAtTime(420, tt + d);
        const o1 = this.osc('sawtooth', f, tt, end, lp, -6), o2 = this.osc('sawtooth', f, tt, end, lp, 6);
        if (d > 1) {
          for (const o of [o1, o2]) { o.frequency.setValueAtTime(f, tt + 0.3); o.frequency.linearRampToValueAtTime(f * 0.97, tt + d); this.vibrato(o, tt, end, 5, f * 0.025, 0.25); }
          const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5; lg.gain.value = 500; l.connect(lg); lg.connect(lp.frequency); l.start(tt + 0.3); l.stop(end);
        }
      }
      this.tom(t + 1.38, 90, 55, 0.6, 0.3, g);
    } else {
      const s = STINGS[id];
      len = s.len;
      for (const [at, inst, note, d, v] of s.notes) this.voice(inst, noteNum(note), t + at, d, v ?? 1, g);
      for (const [at, c] of s.drums) this.drumHit(c, t + at, 1, g);
    }
    this.stings.push({ g, end: t + len + 1.5 });
    this.duckUntil = Math.max(this.duckUntil, t + len);
    this.applyLoopGain();
  }
  /** cut any playing stingers (e.g. rating reveal skipped) */
  stopStings() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const s of this.stings) {
      try { s.g.gain.cancelScheduledValues(now); s.g.gain.setValueAtTime(s.g.gain.value, now); s.g.gain.linearRampToValueAtTime(0, now + 0.08); } catch { /* ignore */ }
      s.end = Math.min(s.end, now + 0.12);
    }
    this.duckUntil = now;
    this.applyLoopGain();
  }

  // ---------------------------------------------------------------- SFX
  private tone(freq: number, dur: number, type: Wave = 'square', vol = 0.2, when = 0, slide = 0, dest?: AudioNode) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  private noise(dur: number, vol = 0.15, when = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    this.noiseHit(this.ctx.currentTime + when, dur, 'highpass', 400, 0.5, vol, this.master);
  }

  click() { this.tone(880, 0.05, 'square', 0.12); }
  back() { this.tone(520, 0.06, 'square', 0.1); }
  pop() { this.tone(1200 + Math.random() * 400, 0.04, 'triangle', 0.06); }
  coin() { this.tone(988, 0.07, 'square', 0.12); this.tone(1319, 0.14, 'square', 0.12, 0.07); }
  bad() { this.tone(300, 0.18, 'sawtooth', 0.12, 0, -120); this.tone(200, 0.25, 'sawtooth', 0.12, 0.16, -80); }
  blooper() { this.tone(400, 0.12, 'square', 0.08, 0, -250); }
  levelup() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1, 'square', 0.12, i * 0.07)); }
  event() { this.tone(784, 0.1, 'triangle', 0.18); this.tone(1047, 0.18, 'triangle', 0.18, 0.1); }
  phase() { this.tone(660, 0.08, 'square', 0.12); this.tone(880, 0.12, 'square', 0.12, 0.08); }
  score(n: number) { this.tone(400 + n * 60, 0.12, 'square', 0.14); this.noise(0.05, 0.06); }
  drum() { for (let i = 0; i < 14; i++) this.noise(0.06, 0.1 + i * 0.01, i * 0.08); }
  fanfare() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319];
    seq.forEach((f, i) => { this.tone(f, 0.16, 'square', 0.13, i * 0.11); this.tone(f / 2, 0.16, 'triangle', 0.12, i * 0.11); });
  }
  sad() { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.15, i * 0.18)); }
}

export const sfx = new Synth();
// exposed for tests (node-level checks of the sequencer output)
export const __music = { compile, SPECS, noteNum };
