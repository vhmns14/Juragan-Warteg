// tiny static server + browser helpers shared by e2e / soak / shots
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
export const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
/** v5.1: parse a Cloudflare-style _headers file -> [{ re, headers }] (so the tests run under the real CSP) */
export function loadHeaders(root) {
  const f = path.join(path.resolve(root), '_headers');
  if (!fs.existsSync(f)) return [];
  const rules = []; let cur = null;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = { re: new RegExp('^' + line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'), headers: {} }; rules.push(cur); continue; }
    const i = line.indexOf(':'); if (cur && i > 0) cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return rules;
}
export function headersFor(rules, urlPath) { const h = {}; for (const r of rules) if (r.re.test(urlPath)) Object.assign(h, r.headers); return h; }
export async function serve(root, index = 'index.html') {
  const ROOT = path.resolve(root);
  const RULES = process.env.NO_HEADERS ? [] : loadHeaders(ROOT);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (p.endsWith('/')) p += index;
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
    const urlPath = (req.url ?? '/').split('?')[0];
    // the local test server is plain http: drop HSTS / upgrade-insecure-requests (would break http://localhost)
    const hh = headersFor(RULES, urlPath);
    delete hh['Strict-Transport-Security'];
    if (hh['Content-Security-Policy']) hh['Content-Security-Policy'] = hh['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests/, '');
    res.writeHead(200, { ...hh, 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  return { server, port: server.address().port, rules: RULES };
}
export async function launch() {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: Number(process.env.VW ?? 390), height: Number(process.env.VH ?? 780) }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + e.stack));
  return { browser, page, errors };
}
export function helpers(page, shotsDir) {
  fs.mkdirSync(shotsDir, { recursive: true });
  const box = async () => page.locator('canvas').boundingBox();
  return {
    box,
    tap: async (x, y, wait = 350) => { const b = await box(); const lw = await page.evaluate(() => window.__game ? window.__game.scale.gameSize.width / window.__game.registry.get("zoom") : 360); const s = b.width / lw; await page.mouse.click(b.x + x * s, b.y + y * s); await page.waitForTimeout(wait); },
    shot: async (name) => { const b = await box(); await page.screenshot({ path: path.join(shotsDir, name), clip: b }); console.log('shot', name); },
    ev: (fn, arg) => page.evaluate(fn, arg),
  };
}
