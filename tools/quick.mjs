// quick look: node tools/quick.mjs WxH out.png [ticks]
import { launch, serve, helpers, openGame } from './lib.mjs';
const [wh = '1920x1080', out = '/tmp/q.png', ticks = '0'] = process.argv.slice(2);
const [w, h] = wh.split('x').map(Number);
const { server, port } = await serve('dist');
const { browser, page, errors, csp } = await launch(w, h, 1);
const H = helpers(page, '/tmp');
await openGame(page, `http://localhost:${port}/`);
await page.screenshot({ path: out.replace('.png', '-title.png') });
await H.click('title_main_baru'); await H.click('title_mulai', 1200);
await H.tryClick('welcome_skip');
await H.ev((n) => { const w = window.__warteg; w.scene.stepTicks(n); }, Number(ticks));
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
console.log('errors', errors.length, errors.slice(0, 5).join('\n'), 'csp', csp.length);
await browser.close(); server.close();
