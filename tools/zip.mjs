// Packs dist/ into ../juragan-warteg-pwa.zip (uses the system `zip`, falls back to python)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const out = new URL('../../juragan-warteg-pwa.zip', import.meta.url).pathname;
try { fs.rmSync(out); } catch { /* none */ }
try { execSync(`cd dist && zip -qr ${JSON.stringify(out)} .`); }
catch { execSync(`python3 -c "import shutil; shutil.make_archive(${JSON.stringify(out.replace(/\.zip$/, ''))}, 'zip', 'dist')"`); }
console.log('zip:', out, fs.statSync(out).size, 'bytes');
