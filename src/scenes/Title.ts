import Phaser from 'phaser';
import { GW, GH, PW, COL, DISPLAY, ROUND, txt, button, Modal } from '../ui';
import { hasSave, loadGame, newGame, deleteSave, saveGame, type GameState } from '../state';
import { exportPanel, importPanel } from '../backup';
import { HI, charFrame } from '../assets';
import { sfx } from '../audio';
import { TIPS, WARUNG_NAMES } from '../data';

export class TitleScene extends Phaser.Scene {
  private modal: Modal | null = null;
  private pendingName = '';
  constructor() { super('Title'); }

  relayout() {
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    document.getElementById('warteg-dom')?.remove();
    this.scene.restart();
  }

  create() {
    (window as unknown as { __newGameForTests?: () => unknown }).__newGameForTests = () => newGame();
    const cam = this.cameras.main;
    cam.setZoom(this.registry.get('zoom') as number).centerOn(GW / 2, GH / 2);
    cam.setBackgroundColor('#1a120c');
    this.modal = null;
    const short = GH < 560 && GW >= 610;
    // the warung as a backdrop
    const bgScale = Math.max(GW / 398, GH / 321) * HI * (short ? 1 : 0.95);
    const bg = this.add.image(GW / 2, GH / 2 + (short ? 0 : 40), 'bg').setScale(bgScale).setAlpha(0.9);
    void bg;
    const shade = this.add.graphics();
    shade.fillStyle(0x1a0e06, 0.5); shade.fillRect(0, 0, GW, GH);
    // walking customers at the bottom
    const walkers = ['buruh', 'mhs', 'kantor', 'ojol', 'hijab', 'mandor'];
    walkers.forEach((k, i) => {
      const y = GH - 36 - (i % 2) * 14;
      const dir = i % 2 === 0 ? 1 : -1;
      const im = this.add.image(dir > 0 ? -30 - i * 90 : GW + 30 + i * 90, y, 'chars', charFrame(k + '_f')).setOrigin(0.5, 1).setScale(HI).setDepth(800 + y);
      im.setFlipX(dir < 0);
      let f = 0;
      this.time.addEvent({ delay: 200, loop: true, callback: () => { f ^= 1; im.setFrame(charFrame(k + (f ? '_w' : '_f'))); } });
      this.tweens.add({ targets: im, x: dir > 0 ? GW + 40 : -40, duration: (10000 + i * 1500) * (GW / 360) ** 0.6, repeat: -1, delay: i * 500 });
    });
    // logo
    const cx = short ? Math.round(GW / 2 - 170) : GW / 2;
    const ly = short ? Math.round(GH / 2 - 130) : 34;
    const lg = this.add.graphics().setDepth(900);
    const lw = 320, lh = 150;
    lg.fillStyle(0x000000, 0.35); lg.fillRoundedRect(cx - lw / 2 + 4, ly + 6, lw, lh, 16);
    lg.fillStyle(0x4a2508, 1); lg.fillRoundedRect(cx - lw / 2, ly, lw, lh, 16);
    lg.fillStyle(0xfbecc8, 1); lg.fillRoundedRect(cx - lw / 2 + 4, ly + 4, lw - 8, lh - 8, 13);
    lg.fillStyle(0x2e8b3a, 1); lg.fillRoundedRect(cx - lw / 2 + 16, ly + 12, lw - 32, 6, 3);
    const t1 = txt(this, cx, ly + 52, 'JURAGAN', 36, '#f6c440', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#4a1e0a', strokeW: 6 }).setDepth(901);
    txt(this, cx, ly + 92, 'WARTEG', 34, '#e8601a', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#4a1e0a', strokeW: 6 }).setDepth(901);
    txt(this, cx, ly + 126, 'Dari Gerobak Jadi Franchise', 13, COL.text, { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' }).setDepth(901);
    txt(this, cx, ly + lh + 16, 'by KodeKecil', 11, '#f6d9a8', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#2b1a10', strokeW: 3 }).setDepth(901).setName('creditKK');
    // dish icons around the logo
    [[-150, 30, 0], [150, 30, 4], [-150, 110, 5], [150, 110, 1]].forEach(([dx, dy, f], i) => {
      const im = this.add.image(cx + dx, ly + dy, 'dishes', f).setScale(0.75).setDepth(902);
      this.tweens.add({ targets: im, y: im.y - 4, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.tweens.add({ targets: t1, y: ly + 48, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // buttons
    const save = hasSave();
    const nBtn = 4 + (save ? 1 : 0) + (window.__installPrompt ? 1 : 0);
    const step = short ? 42 : 46, bh = short ? 36 : 38;
    let y = short ? Math.max(12, Math.round((GH - 20 - nBtn * step) / 2)) : ly + lh + 40;
    const bx = short ? Math.round(GW / 2 + 40) : Math.round(GW / 2 - 120);
    const mk = (label: string, fn: () => void, kind: 'primary' | 'btn' | 'green' = 'btn') => {
      const b = button(this, bx, y, 240, bh, label, () => { sfx.unlock(); fn(); }, { kind, size: 14 });
      b.setDepth(1000).setName('title_' + label.split(':')[0].toLowerCase().replace(/ /g, '_'));
      y += step;
      return b;
    };
    if (save) mk('Lanjutkan', () => this.continueGame(), 'primary');
    mk('Main Baru', () => this.newGameConfirm(save), save ? 'btn' : 'primary');
    mk('Backup Save', () => this.backupMenu(save), 'green');
    mk('Cara Main', () => this.tips());
    const soundBtn = mk('Suara: ' + (sfx.muted ? 'MATI' : 'NYALA'), () => { sfx.setMuted(!sfx.muted); soundBtn.setLabel?.('Suara: ' + (sfx.muted ? 'MATI' : 'NYALA')); });
    if (window.__installPrompt) mk('Pasang di HP', () => { try { window.__installPrompt?.prompt(); window.__installPrompt = null; } catch { /* ignore */ } }, 'green');
    txt(this, GW / 2, GH - 10, 'v1  ·  Game tycoon warteg ala Kairosoft  ·  Dibuat oleh KodeKecil', 9, '#d8c8a8', { ox: 0.5, oy: 0.5 }).setDepth(1000);
    this.input.once('pointerdown', () => sfx.unlock());
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && this.modal && !this.modal.closed && this.modal.closeBtn) this.modal.close(); });
    sfx.setPaused(false);
    sfx.setMusicOverride(null);
    sfx.playMusic('title');
    void PW;
  }

  continueGame() {
    const s = loadGame();
    this.scene.start('Game', { state: s ?? newGame() });
  }
  private m(o: ConstructorParameters<typeof Modal>[2]) { this.modal?.close(); this.modal = new Modal(this, 2000, o); return this.modal; }

  newGameConfirm(save: boolean) {
    this.pendingName = WARUNG_NAMES[Math.floor(Math.random() * WARUNG_NAMES.length)];
    const m = this.m({ w: 320, h: 250, title: 'WARUNG BARU', closable: true });
    m.build((mm) => {
      mm.text(160, 34, 'Kasih nama warungmu:', 12, COL.text, { ox: 0.5, font: ROUND, weight: '800' });
      mm.panel(20, 56, 280, 40, 'paper');
      mm.text(160, 76, this.pendingName, 15, '#b04a1a', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' });
      mm.btn(70, 104, 180, 30, 'Acak Nama Lain', () => {
        const others = WARUNG_NAMES.filter((n) => n !== this.pendingName);
        this.pendingName = others[Math.floor(Math.random() * others.length)];
        mm.rebuild();
      }, { size: 12 }).setName('title_acak');
      mm.text(160, 146, save ? 'Progres lama bakal ketimpa!\nBackup dulu kalau sayang.' : 'Modal awal Rp 6 juta + 1 juru masak.\nMulai dari gerobak di pinggir pasar.', 11, save ? COL.red : COL.muted, { ox: 0.5, align: 'center', font: ROUND, weight: '600' });
      mm.btn(40, 196, 240, 38, 'Buka Warung!', () => {
        if (save) deleteSave();
        const s = newGame(this.pendingName);
        saveGame(s);
        this.scene.start('Game', { state: s });
      }, { kind: 'primary', size: 14 }).setName('title_mulai');
    });
  }

  backupMenu(save: boolean) {
    const m = this.m({ w: 300, h: 190, title: 'BACKUP SAVE', closable: true });
    m.build((mm) => {
      mm.text(150, 30, 'Simpan progres ke file / kode,\natau pulihkan dari backup.', 11, COL.text, { ox: 0.5, align: 'center', font: ROUND, weight: '600' });
      mm.btn(30, 76, 240, 36, 'Ekspor Backup', () => { const s = loadGame(); if (s) exportPanel(s); }, { kind: 'green', size: 13, disabled: !save }).setName('title_ekspor');
      mm.btn(30, 122, 240, 36, 'Impor Backup', () => importPanel((st, summary) => this.confirmImport(st, summary)), { size: 13 }).setName('title_impor');
    });
  }
  confirmImport(st: GameState, summary: string) {
    const m = this.m({ w: 300, h: 210, title: 'PULIHKAN SAVE?', closable: true });
    m.build((mm) => {
      mm.text(150, 30, summary, 12, COL.text, { ox: 0.5, align: 'center', font: ROUND, weight: '800' });
      mm.text(150, 104, 'Progres sekarang bakal diganti.', 11, COL.red, { ox: 0.5, font: ROUND, weight: '600' });
      mm.btn(30, 140, 240, 38, 'Ya, pulihkan', () => { saveGame(st); this.scene.start('Game', { state: st }); }, { kind: 'primary', size: 13 }).setName('title_pulihkan');
    });
  }
  tips() {
    const m = this.m({ w: 330, h: 420, title: 'CARA MAIN', closable: true });
    m.build((mm) => {
      const lines = [
        'Pagi: bahan dibelanjakan otomatis & lauk dimasak sesuai rencana di MASAK.',
        'Siang: jam makan siang paling rame. Antrian panjang = pelanggan kabur.',
        'Malam: laporan untung-rugi + ulasan pelanggan.',
        ...TIPS.slice(0, 6),
      ];
      let yy = 30;
      for (const l of lines) { const t = mm.text(18, yy, '• ' + l, 11, COL.text, { wrap: 294, font: ROUND, weight: '600' }); yy += t.height + 6; }
    });
  }
}
