// v5.1 (runs after `vite build`): fills the CSP style-src placeholder in dist/_headers with the sha256 of every
// inline <style> in dist/index.html, so the policy needs no 'unsafe-inline'. Fails if index.html has an inline
// <script> (script-src is 'self' only) or the placeholder is missing.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const dir = process.argv[2] ?? 'dist';
const html = fs.readFileSync(`${dir}/index.html`, 'utf8');
if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) throw new Error('inline <script> in index.html would be blocked by script-src');
const hashes = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
const hf = `${dir}/_headers`;
const h = fs.readFileSync(hf, 'utf8');
if (!h.includes('__STYLE_HASHES__')) throw new Error('placeholder __STYLE_HASHES__ missing in ' + hf);
fs.writeFileSync(hf, h.replaceAll('__STYLE_HASHES__', hashes.join(' ')));
console.log('csp-headers:', hashes.length, 'inline style hash(es) ->', hf);
