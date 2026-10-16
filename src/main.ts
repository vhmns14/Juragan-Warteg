import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/silkscreen/latin-400.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { BootScene } from './scenes/Boot';
import { TitleScene } from './scenes/Title';
import { GameScene } from './scenes/Game';
import { ZOOM, GW, GH, setGW, setGH, layoutFor } from './ui';

declare global {
  interface Window { __installPrompt?: { prompt: () => void } | null; __game?: Phaser.Game }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e as unknown as { prompt: () => void };
});

async function boot() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('12px "Pixelify Sans"'),
        document.fonts.load('bold 12px "Pixelify Sans"'),
        document.fonts.load('12px Silkscreen'),
        document.fonts.load('600 12px "Baloo 2"'),
        document.fonts.load('800 12px "Baloo 2"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fonts optional */ }
  const dpr = window.devicePixelRatio || 1;
  // v5 responsive: phones / narrow windows keep the 360-wide portrait layout; wide screens get a wider logical width
  // v5.1: short landscape windows also get a smaller logical height (layoutFor) instead of a uniform downscale
  const vw = window.innerWidth || 360, vh = window.innerHeight || 640;
  const L = layoutFor(vw, vh);
  setGH(L.gh); setGW(L.gw);
  let Z: number;
  if (GW <= 360) Z = dpr >= 2.5 ? 3 : 2; // phones: unchanged
  else {
    // wide: one logical px = (viewport height / 640) device px, so text and art map ~1:1 to the screen (crisp, no
    // nearest-neighbour downscale of a 2x canvas); 1..3, plus a cap on the canvas size for 4K / retina
    Z = Math.max(0.75, Math.min(3, (vh * dpr) / GH));
    if (GW * Z * GH * Z > 6.5e6) Z = Math.max(1, Math.sqrt(6.5e6 / (GW * GH)));
  }
  ZOOM.z = Z;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: Math.round(GW * Z),
    height: Math.round(GH * Z),
    backgroundColor: '#1a120c',
    pixelArt: true,
    roundPixels: true,
    // #game is a full-screen flex box that already centres the canvas (CENTER_BOTH on top of it pushed the canvas
    // off-centre on wide screens)
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
    input: { activePointers: 2 },
    callbacks: { preBoot: (g) => { g.registry.set('zoom', Z); } },
    scene: [BootScene, TitleScene, GameScene],
  });
  window.__game = game;
  // live resize / orientation change: re-pick the logical width and let the running scene re-lay itself out (state kept)
  let timer = 0;
  const onResize = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const L2 = layoutFor(window.innerWidth || 360, window.innerHeight || 640);
      if (L2.gw === GW && L2.gh === GH) { game.scale.refresh(); return; }
      const old = GW, oldH = GH; setGH(L2.gh); setGW(L2.gw);
      game.scale.setGameSize(Math.round(GW * Z), Math.round(GH * Z));
      for (const sc of game.scene.getScenes(true)) (sc as unknown as { relayout?: (o: number, oh: number) => void }).relayout?.(old, oldH);
    }, 180);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  const loading = document.getElementById('loading');
  if (loading) loading.remove();
}

void boot();

try {
  // autoUpdate: a new deploy installs in the background and the page reloads into it once; long sessions also re-check
  // every 30 min so returning players never stay on an old cached build
  if ('serviceWorker' in navigator) registerSW({ immediate: true, onRegisteredSW: (_u: string, r?: ServiceWorkerRegistration) => { if (r) setInterval(() => { void r.update().catch(() => undefined); }, 30 * 60 * 1000); } });
} catch { /* ignore */ }
