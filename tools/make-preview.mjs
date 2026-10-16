// Builds ../juragan-warteg-preview.html from ../juragan-warteg-single.html:
// the inline <script type="module"> becomes a classic IIFE script placed right before </body>.
import fs from 'node:fs';
import vm from 'node:vm';
const SRC = new URL('../../juragan-warteg-single.html', import.meta.url);
const OUT = new URL('../../juragan-warteg-preview.html', import.meta.url);
let html = fs.readFileSync(SRC, 'utf8');
const re = /<script type="module"[^>]*>([\s\S]*?)<\/script>/;
const m = re.exec(html);
if (!m) throw new Error('no module script found');
let code = m[1];
html = html.replace(re, () => '');
if (re.test(html)) throw new Error('more than one module script');
if (code.includes('</script')) throw new Error('script body contains </script');
// verify it is valid as a classic script (import/export statements or import.meta are syntax errors here)
const wrapped = '(function(){"use strict";\n' + code + '\n})();';
new vm.Script(wrapped, { filename: 'preview-inline.js' });
if (/(^|[;\n}])\s*(import\s*[\w{*"']|export\s*[\w{*])/.test(code)) throw new Error('import/export statement found');
if (/import\.meta/.test(code)) throw new Error('import.meta found');
const end = html.lastIndexOf('</body>');
if (end < 0) throw new Error('no </body>');
html = html.slice(0, end) + '<script>' + wrapped + '</script>' + html.slice(end);
if (/type="module"/.test(html)) throw new Error('type="module" still present');
fs.writeFileSync(OUT, html);
console.log('preview written:', OUT.pathname, html.length, 'bytes; classic script parses OK');
