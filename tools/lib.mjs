// shared browser helpers for e2e / shots / soak (uses tools/serve.mjs: static server applying dist/_headers)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
export { serve } from './serve.mjs';

export async function launch(w = 390, h = 844, dpr = 2) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const errors = [], csp = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to/i.test(t)) csp.push(t);
    if (m.type() === 'error') errors.push('[console] ' + t);
  });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack ?? '').split('\n').slice(0, 4).join('\n')));
  return { browser, ctx, page, errors, csp };
}

export function helpers(page, shotsDir) {
  fs.mkdirSync(shotsDir, { recursive: true });
  const scene = () => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
  /** page coords of a named game object in the top active scene (search into containers); null if not found */
  const where = (name) => page.evaluate((nm) => {
    const g = window.__game; const sc = g.scene.getScenes(true).slice(-1)[0];
    let found = null;
    const walk = (list) => { for (const o of list) { if (o.name === nm && o.visible !== false && o.active) found = o; if (o.list) walk(o.list); } };
    walk(sc.children.list);
    if (!found) return null;
    // buttons: use their hit zone (container bounds can include graphics offsets)
    const zone = found.list ? found.list.find((c) => c.type === 'Zone') : null;
    const b = (zone ?? found).getBounds();
    const cv = g.canvas.getBoundingClientRect();
    const Z = g.registry.get('zoom');
    const s = cv.width / (g.scale.gameSize.width);
    return { x: cv.left + (b.centerX * Z) * s, y: cv.top + (b.centerY * Z) * s };
  }, name);
  const click = async (name, wait = 300) => {
    const p = await where(name);
    if (!p) throw new Error('not found: ' + name);
    await page.mouse.move(p.x, p.y); await page.waitForTimeout(40);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(wait);
  };
  const tryClick = async (name, wait = 300) => { const p = await where(name); if (!p) return false; await page.mouse.move(p.x, p.y); await page.waitForTimeout(40); await page.mouse.click(p.x, p.y); await page.waitForTimeout(wait); return true; };
  const shot = async (name) => { await page.screenshot({ path: path.join(shotsDir, name) }); console.log('shot', name); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const closeModals = () => page.evaluate(() => { const w = window.__warteg; if (w) for (const m of [...w.scene.modals]) m.close(); });
  return { scene, where, click, tryClick, shot, ev, closeModals };
}

/** open the page and wait for the title scene */
export async function openGame(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
}
