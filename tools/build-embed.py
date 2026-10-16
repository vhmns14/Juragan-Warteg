# Regenerates deploy-embed/worker.js from dist. Run after `npm run build`, then `npx wrangler deploy -c wrangler.embed.jsonc`.
import os,base64,json
MT={'.js':'application/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.webmanifest':'application/manifest+json','.json':'application/json','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.webp':'image/webp','.mp3':'audio/mpeg','.ogg':'audio/ogg'}
# v5.1: the Worker sends the same security headers as dist/_headers (CSP with the style hash, nosniff, ...);
# Cache-Control stays per path (cc() below). _headers itself is never served.
SEC={}
cur=None
for line in open('dist/_headers').read().split('\n'):
  if not line.strip() or line.strip().startswith('#'):continue
  if not line[0].isspace():cur=line.strip();continue
  if cur=='/*' and ':' in line:
    k,v=line.split(':',1);SEC[k.strip().lower()]=v.strip()
assert 'content-security-policy' in SEC and '__STYLE_HASHES__' not in SEC['content-security-policy'],'run npm run build first (CSP hash missing)'
files={}
for d,_,fs in os.walk('dist'):
  for f in fs:
    p=os.path.join(d,f);rel='/'+os.path.relpath(p,'dist')
    if rel=='/_headers':continue
    files[rel]=[MT.get(os.path.splitext(f)[1],'application/octet-stream'),base64.b64encode(open(p,'rb').read()).decode()]
TAIL="\nconst cache=new Map();\nfunction bytes(b){const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}\nfunction cc(p){if(p==='/'||p==='/index.html'||p==='/sw.js'||p==='/manifest.webmanifest')return 'no-cache';if(p.startsWith('/assets/')||p.startsWith('/workbox-'))return 'public, max-age=31536000, immutable';if(p.startsWith('/icons/'))return 'public, max-age=86400';return 'public, max-age=3600';}\nexport default{async fetch(req){const u=new URL(req.url);let p;try{p=decodeURIComponent(u.pathname);}catch{return new Response('Bad request',{status:400,headers:{'content-type':'text/plain'}});}if(p==='/')p='/index.html';let f=F[p];if(!f&&!p.includes('.')&&F[p+'/index.html'])f=F[p+'/index.html'];\nif(!f)return new Response('Not found',{status:404,headers:{'content-type':'text/plain'}});\nif(!cache.has(p))cache.set(p,bytes(f[1]));\nconst h={...SEC,'content-type':f[0],'cache-control':cc(u.pathname==='/'?'/':p)};\nif(req.method==='HEAD')return new Response(null,{headers:h});\nreturn new Response(cache.get(p),{headers:h});}};\n"
os.makedirs('deploy-embed',exist_ok=True)
open('deploy-embed/worker.js','w').write('const F='+json.dumps(files)+';\nconst SEC='+json.dumps(SEC)+';\n'+TAIL)
print(len(files),'files embedded')
