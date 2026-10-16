// Backup save: export to a JSON file (download) or a copyable text code (fallback for sandboxed iframes where
// downloads are blocked), import from a file or pasted text. Validated + migrated on a COPY, never touches the live
// save until the player confirms. DOM overlay because a canvas can't host a file picker or a text box.
import { normalizeSave, dateOf, fmtMoney, SAVE_VERSION, type GameState } from './state';
import { sfx } from './audio';
import { MAX_BACKUP_CHARS } from './sanitize';

export const BACKUP_PREFIX = 'WARTEG:';
const APP = 'juragan-warteg';

function b64enc(str: string) { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); }
function b64dec(b: string) { const bin = atob(b.replace(/\s+/g, '')); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }

export function exportJSON(s: GameState): string { return JSON.stringify({ app: APP, v: 5, exported: new Date().toISOString(), save: s }); }
export function exportCode(s: GameState): string { return BACKUP_PREFIX + b64enc(exportJSON(s)); }
export function backupFileName(s: GameState) { const d = dateOf(s.absDay); return `juragan-warteg-backup-th${d.year}-bln${d.month}.json`; }

export interface ImportResult { ok: boolean; error?: string; state?: GameState; summary?: string }
/** decode a backup (file JSON, raw save JSON or SINETRON: code), validate, migrate a COPY */
export function parseBackup(text: string): ImportResult {
  // size limit on the raw input (before trim) so a huge paste / file is refused without further work
  if ((text ?? '').length > MAX_BACKUP_CHARS) return { ok: false, error: 'File/kode kegedean, bukan backup Juragan Warteg.' };
  const t = (text ?? '').trim();
  if (!t) return { ok: false, error: 'Kodenya kosong.' };
  if (t.length > MAX_BACKUP_CHARS) return { ok: false, error: 'File/kode kegedean, bukan backup Juragan Warteg.' };
  let raw: unknown;
  try {
    // plain JSON.parse only (never eval); base64 must be clean base64
    const b64 = t.startsWith(BACKUP_PREFIX) ? t.slice(BACKUP_PREFIX.length) : t.startsWith('{') ? null : t;
    if (b64 !== null && !/^[A-Za-z0-9+/=\s]+$/.test(b64)) throw new Error('not base64');
    const json = b64 === null ? t : b64dec(b64);
    if (json.length > MAX_BACKUP_CHARS) throw new Error('too big');
    raw = JSON.parse(json);
  } catch { return { ok: false, error: 'File/kode rusak atau bukan backup Juragan Warteg.' }; }
  const w = raw as { app?: string; save?: unknown };
  if (!w || typeof w !== 'object' || Array.isArray(w)) return { ok: false, error: 'Ini bukan save Juragan Warteg.' };
  if (typeof w.app === 'string' && w.app !== APP) return { ok: false, error: 'Ini backup game lain, bukan Juragan Warteg.' };
  const save = w && typeof w === 'object' && w.app === APP ? w.save : raw;
  const sv = save as { version?: number } | null;
  if (!sv || typeof sv !== 'object') return { ok: false, error: 'Ini bukan save Juragan Warteg.' };
  if (typeof sv.version === 'number' && sv.version > SAVE_VERSION) return { ok: false, error: 'Save dari versi game yang lebih baru. Update dulu game-nya ya.' };
  let st: GameState | null = null;
  // normalizeSave works on a sanitized deep copy (no __proto__ / constructor keys, clamped numbers, checked ids)
  try { st = normalizeSave(save); } catch { st = null; }
  if (!st) return { ok: false, error: 'Data save nggak lengkap / rusak.' };
  const d = dateOf(st.absDay);
  return { ok: true, state: st, summary: `${st.name}\nTahun ${d.year} Bulan ${d.month}  ·  ${fmtMoney(st.money)}\n${st.staff.length} staf  ·  ${st.cabang.length} cabang` };
}

export function download(text: string, name: string): boolean {
  if ((window as unknown as { __wartegNoDownload?: boolean }).__wartegNoDownload) return false;
  try {
    const a = document.createElement('a');
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch { return false; }
}

// ================================================================== DOM overlay
export interface DomPanel { close: () => void; setMsg: (t: string, err?: boolean) => void; area: HTMLTextAreaElement | null; root: HTMLDivElement }
export interface DomOpts { title: string; text: string; code?: string; input?: boolean; buttons: { label: string; id: string; primary?: boolean; fn: (p: DomPanel) => void }[]; file?: (text: string, p: DomPanel) => void }
export function domPanel(o: DomOpts): DomPanel {
  document.getElementById('warteg-dom')?.remove();
  const root = document.createElement('div'); root.id = 'warteg-dom';
  root.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(26,14,6,.6);font-family:"Baloo 2","Pixelify Sans",sans-serif;font-weight:600;touch-action:auto;user-select:text;-webkit-user-select:text;';
  const box = document.createElement('div');
  box.style.cssText = 'width:min(330px,92vw);background:#fbecc8;border:4px solid #4a2508;border-radius:12px;box-shadow:0 0 0 3px #b8783c inset,0 6px 0 rgba(0,0,0,.35);padding:14px;color:#4a2208;box-sizing:border-box;';
  const h = document.createElement('div'); h.textContent = o.title;
  h.style.cssText = 'font-family:Silkscreen,monospace;font-size:15px;color:#fff8e8;background:#c0392b;border:2px solid #5a1a0a;border-radius:8px;text-align:center;padding:3px 6px;margin:-4px 0 10px;';
  const p = document.createElement('div'); p.textContent = o.text; p.style.cssText = 'font-size:14px;line-height:1.3;margin-bottom:8px;white-space:pre-line;';
  box.append(h, p);
  let area: HTMLTextAreaElement | null = null;
  if (o.code !== undefined || o.input) {
    area = document.createElement('textarea'); area.id = 'warteg-code';
    area.value = o.code ?? ''; area.readOnly = !o.input; area.placeholder = o.input ? 'Tempel kode backup (WARTEG:...) atau isi file .json di sini' : '';
    area.style.cssText = 'width:100%;box-sizing:border-box;height:110px;font:10px monospace;border:2px solid #8a5a2a;border-radius:6px;background:#fffaf0;color:#3a1c08;resize:none;word-break:break-all;';
    box.append(area);
  }
  const msg = document.createElement('div'); msg.id = 'warteg-msg'; msg.style.cssText = 'min-height:18px;font-size:13px;margin:6px 0;'; box.append(msg);
  const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;';
  // the canvas must not see clicks on the overlay (Phaser also listens on window and would press the button under it)
  const game = (window as unknown as { __game?: { input: { enabled: boolean } } }).__game;
  if (game) game.input.enabled = false;
  for (const t of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'wheel']) root.addEventListener(t, (e) => e.stopPropagation());
  const panel: DomPanel = { close: () => { root.remove(); if (game) setTimeout(() => { if (!document.getElementById('warteg-dom')) game.input.enabled = true; }, 60); }, setMsg: (t, err) => { msg.textContent = t; msg.style.color = err ? '#c0392b' : '#2e8b3a'; }, area, root };
  const mkBtn = (label: string, id: string, primary: boolean, fn: () => void) => {
    const b = document.createElement('button'); b.textContent = label; b.id = id; b.type = 'button';
    b.style.cssText = `flex:1 1 40%;min-height:38px;font-family:"Baloo 2",sans-serif;font-weight:800;font-size:14px;border:2px solid #4a2508;border-radius:8px;color:${primary ? '#fff8e8' : '#4a2208'};background:${primary ? '#e8701a' : '#f6dca8'};box-shadow:0 3px 0 #4a2508;cursor:pointer;`;
    b.onclick = () => { sfx.click(); fn(); };
    row.append(b);
  };
  if (o.file) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,.txt,application/json,text/plain'; inp.id = 'warteg-file'; inp.style.display = 'none';
    inp.onchange = () => {
      const f = inp.files?.[0]; if (!f) return;
      if (f.size > MAX_BACKUP_CHARS) { panel.setMsg('File kegedean, bukan backup Juragan Warteg.', true); inp.value = ''; return; }
      const fr = new FileReader(); fr.onload = () => o.file!(String(fr.result ?? ''), panel); fr.readAsText(f); };
    box.append(inp);
    mkBtn('Pilih File', 'warteg-pick', false, () => inp.click());
  }
  for (const b of o.buttons) mkBtn(b.label, b.id, !!b.primary, () => b.fn(panel));
  box.append(row);
  root.append(box);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) panel.close(); }, true);
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.close(); e.stopPropagation(); });
  document.body.append(root);
  return panel;
}

/** export panel: download a file + a copyable code (works inside sandboxed iframes where downloads are blocked) */
export function exportPanel(s: GameState, onDone?: () => void) {
  const code = exportCode(s);
  return domPanel({
    title: 'EKSPOR BACKUP', text: 'Unduh file backup (.json), atau salin kodenya lalu simpan di chat sendiri / catatan. Bisa diimpor lagi kapan saja.', code,
    buttons: [
      { label: 'Unduh File', id: 'warteg-dl', primary: true, fn: (p) => { const ok = download(exportJSON(s), backupFileName(s)); p.setMsg(ok ? 'File backup diunduh! (kalau nggak muncul, pakai Salin Kode)' : 'Unduhan diblokir di sini. Pakai Salin Kode ya.', !ok); onDone?.(); } },
      { label: 'Salin Kode', id: 'warteg-copy', fn: (p) => {
        const fallback = () => { try { p.area?.select(); const ok = document.execCommand('copy'); p.setMsg(ok ? 'Kode tersalin!' : 'Tekan lama kodenya, lalu Salin.', !ok); } catch { p.setMsg('Tekan lama kodenya, lalu Salin.', true); } };
        try { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(() => p.setMsg('Kode tersalin!'), fallback); else fallback(); } catch { fallback(); }
        onDone?.();
      } },
      { label: 'Tutup', id: 'warteg-close', fn: (p) => p.close() },
    ],
  });
}
/** import panel (file or pasted code): onOk gets the validated + migrated state and a summary for the confirmation */
export function importPanel(onOk: (st: GameState, summary: string) => void) {
  const tryIt = (text: string, p: DomPanel) => {
    const r = parseBackup(text);
    if (!r.ok || !r.state) { p.setMsg(r.error ?? 'Gagal', true); sfx.sting('flop'); return; }
    p.close(); onOk(r.state, r.summary ?? '');
  };
  return domPanel({
    title: 'IMPOR BACKUP', text: 'Pilih file backup (.json) atau tempel kode backup. Nanti dikonfirmasi dulu sebelum progres sekarang diganti.', input: true,
    file: (text, p) => tryIt(text, p),
    buttons: [{ label: 'Impor', id: 'warteg-import', primary: true, fn: (p) => tryIt(p.area?.value ?? '', p) }, { label: 'Batal', id: 'warteg-cancel', fn: (p) => p.close() }],
  });
}
