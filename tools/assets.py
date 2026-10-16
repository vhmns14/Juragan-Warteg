"""Asset pipeline: generated source art in ../art/gen -> game-ready PNGs in src/assets (+ PWA icons).
Run: python3 tools/assets.py  (Pillow, numpy, scipy; optipng optional)
Textures are authored at 2x logical resolution and drawn with setScale(0.5)."""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', '..', 'art', 'gen'))
OUT = os.path.normpath(os.path.join(HERE, '..', 'src', 'assets'))
ICO = os.path.normpath(os.path.join(HERE, '..', 'public', 'icons'))
os.makedirs(OUT, exist_ok=True); os.makedirs(ICO, exist_ok=True)
meta = {}

def save(im, name, d=OUT):
    p = os.path.join(d, name); im.save(p, optimize=True)
    subprocess.run(['optipng', '-quiet', '-o2', p], check=False)

def key(im):
    """remove the chroma-green background only (keeps green jackets / helmets)"""
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (g > 200) & (r < 100) & (b < 100)
    # fringe: bright, strongly green pixels touching the background
    near = ndimage.binary_dilation(bg, iterations=2)
    fr = near & (g > 150) & (g > r + 70) & (g > b + 70)
    a[bg | fr, 3] = 0
    edge = ndimage.binary_dilation(bg | fr, iterations=1) & ~(bg | fr)
    a[..., 1] = np.where(edge & (g > np.maximum(r, b) + 30), np.maximum(r, b) + 20, g)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')

def comps(im, min_area=600, dilate=5, rowh=120):
    al = np.array(im)[..., 3] > 60
    lab, n = ndimage.label(ndimage.binary_dilation(al, iterations=dilate))
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if sl is None: continue
        ys, xs = sl
        if int((al[sl] & (lab[sl] == i + 1)).sum()) < min_area: continue
        out.append((xs.start, ys.start, xs.stop, ys.stop))
    out.sort(key=lambda b: (round(((b[1] + b[3]) / 2) / rowh), b[0]))
    return out

def tight(im):
    bb = im.getbbox(); return im.crop(bb) if bb else im

def harden(im):
    a = np.array(im); a[..., 3] = np.where(a[..., 3] > 120, 255, 0); return Image.fromarray(a, 'RGBA')

def scale(im, f):
    w, h = max(1, round(im.width * f)), max(1, round(im.height * f))
    return harden(im.resize((w, h), Image.LANCZOS))

# ---------------------------------------------------------------- background + overlays
bg_full = Image.open(os.path.join(SRC, 'bg_warteg.png')).convert('RGBA')
BX, BY = 290, 50
bg = bg_full.crop((BX, BY, BX + 796, BY + 642))
a = np.array(bg).astype(np.int16)
lum = a[..., :3].sum(axis=2)
dark = lum < 150
lab, _ = ndimage.label(dark)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
mask = np.isin(lab, list(border))
# also kill the thin panel-edge strips at the far left / right / bottom
mask[:, :6] = True; mask[:, -8:] = True; mask[-4:, :] = True; mask[:5, :] = True
a[mask, 3] = 0
bg = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
save(bg, 'bg.png')

def overlay(poly, name):
    m = Image.new('L', bg.size, 0); ImageDraw.Draw(m).polygon(poly, fill=255)
    o = Image.new('RGBA', bg.size, (0, 0, 0, 0)); o.paste(bg, (0, 0), m)
    bb = o.getbbox(); o = o.crop(bb); save(o, name + '.png')
    meta[name] = [bb[0], bb[1]]

overlay([(92, 412), (128, 360), (500, 203), (522, 212), (552, 292), (550, 354), (192, 530), (90, 474)], 'ov_counter')
overlay([(530, 427), (680, 350), (740, 379), (740, 392), (596, 466), (588, 462)], 'ov_t1')
overlay([(325, 537), (480, 455), (538, 486), (538, 500), (390, 584), (384, 580)], 'ov_t2')

# ---------------------------------------------------------------- characters
CH = 62  # standing height at 2x
CELL = (64, 80)
def sheet(f, dil=5):
    im = key(Image.open(os.path.join(SRC, f)))
    return im, comps(im, 600, dil)
cus, cb = sheet('chars_customers.png')
stf, sb = sheet('chars_staff.png')
ext, eb = sheet('chars_extra.png')
def cut(im, boxes, i):
    c = tight(im.crop(boxes[i]))
    a = np.array(c).astype(np.int16)
    h = a.shape[0]; y0 = int(h * 0.86)
    r, g, b = a[y0:, :, 0], a[y0:, :, 1], a[y0:, :, 2]
    gr = (g > r + 25) & (g > b + 25)
    a[y0:, :, 3] = np.where(gr, 0, a[y0:, :, 3])
    return tight(Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA'))
chars = {
    # name: (sheet, boxes, front, walk, back, sit, sitTopFrac)
    'buruh': (cus, cb, 0, 1, 2, 3), 'kantor': (cus, cb, 4, 12, 5, 7), 'mhs': (cus, cb, 8, 9, 10, 11),
    'mandor': (cus, cb, 16, 20, 18, 7), 'hijab': (cus, cb, 24, 29, 30, 15),
    'ojol': (ext, eb, 0, 1, 2, 3), 'belanja': (ext, eb, 8, 9, 10, 15), 'dinkes': (ext, eb, 16, 17, 18, 23), 'vlog': (ext, eb, 24, 25, 26, 31),
    'cookf': (stf, sb, 0, 2, 3, 2), 'cookm': (stf, sb, 4, 6, 7, 6), 'kasir': (stf, sb, 8, 10, 11, 8), 'pelayan': (stf, sb, 12, 13, 15, 14),
}
frames = []
for name, (im, bx, fi, wi, bi, si) in chars.items():
    front = cut(im, bx, fi); f = CH / front.height
    frames.append((name + '_f', scale(front, f)))
    frames.append((name + '_w', scale(cut(im, bx, wi), f)))
    back = scale(cut(im, bx, bi), f); frames.append((name + '_b', back))
    s = cut(im, bx, si)
    if name in ('buruh', 'kantor', 'mhs', 'mandor', 'hijab'):
        s = s.crop((0, 0, s.width, int(s.height * 0.6))); s = tight(s)
        frames.append((name + '_s', scale(s, f)))
        frames.append((name + '_bs', tight(back.crop((0, 0, back.width, int(back.height * 0.62))))))
    else:
        frames.append((name + '_x', scale(s, f)))
cols = 10
rows = (len(frames) + cols - 1) // cols
atlas = Image.new('RGBA', (cols * CELL[0], rows * CELL[1]), (0, 0, 0, 0))
fr = {}
for i, (n, im) in enumerate(frames):
    if im.width > CELL[0]: im = scale(im, CELL[0] / im.width)
    x = (i % cols) * CELL[0]; y = (i // cols) * CELL[1]
    # bottom-centred in the cell
    atlas.alpha_composite(im, (x + (CELL[0] - im.width) // 2, y + CELL[1] - im.height))
    fr[n] = i
# v1.2: synthesised passing-pose walk frames (<k>_w2 / <k>_b2), see tools/walkframes.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walkframes import add_walk_frames
atlas, fr = add_walk_frames(atlas, fr, CELL)
save(atlas, 'chars.png'); meta['chars'] = {'cell': CELL, 'frames': fr}

# ---------------------------------------------------------------- dishes (fixed grid, labels cut off)
dimg = Image.open(os.path.join(SRC, 'dishes.png'))
rowsY = [(26, 178), (214, 364), (398, 548), (584, 732)]
colsX = [193, 443, 693, 943, 1193]
DW = 52
dat = Image.new('RGBA', (DW * 20, DW), (0, 0, 0, 0))
k = 0
for r0, r1 in rowsY:
    for cx in colsX:
        c = key(dimg.crop((cx - 125, r0, cx + 125, r1)))
        c = tight(c); c = scale(c, (DW - 4) / max(c.width, c.height))
        dat.alpha_composite(c, (k * DW + (DW - c.width) // 2, (DW - c.height) // 2)); k += 1
save(dat, 'dishes.png'); meta['dishCell'] = DW

# ---------------------------------------------------------------- UI icons
iimg = key(Image.open(os.path.join(SRC, 'icons.png')))
ib = comps(iimg, 1500, 3)
want = {'menu': 0, 'masak': 1, 'staf': 2, 'belanja': 3, 'promosi': 4, 'info': 5, 'cabang': 6, 'peta': 7, 'money': 8, 'star': 9,
        'bulb': 10, 'heart': 11, 'trophy': 12, 'cal': 22, 'rice': 23, 'piggy': 27, 'meat': 28, 'book': 31}
IW = 56
iat = Image.new('RGBA', (IW * len(want), IW), (0, 0, 0, 0))
names = []
for j, (n, i) in enumerate(want.items()):
    c = tight(iimg.crop(ib[i]))
    if n == 'cabang':  # blank out the English sign text
        d = ImageDraw.Draw(c); w = c.width
        d.rectangle((int(w * 0.18), int(c.height * 0.07), int(w * 0.82), int(c.height * 0.24)), fill=(240, 228, 196, 255))
    c = scale(c, (IW - 4) / max(c.width, c.height))
    iat.alpha_composite(c, (j * IW + (IW - c.width) // 2, (IW - c.height) // 2)); names.append(n)
save(iat, 'icons.png'); meta['icons'] = names; meta['iconCell'] = IW

# ---------------------------------------------------------------- props
pimg = key(Image.open(os.path.join(SRC, 'props.png')))
pb = comps(pimg, 1500, 4)
pw = {'fan': (0, 46), 'tv': (1, 54), 'ac': (3, 70), 'plant': (4, 50), 'gerobak': (6, 150), 'warmer': (7, 52), 'basket': (8, 40),
      'plates': (9, 34), 'sign': (10, 120), 'banner': (11, 56), 'clock': (12, 30), 'lights': (13, 110)}
props = {}
x = 0; parts = []
for n, (i, w) in pw.items():
    c = tight(pimg.crop(pb[i])); c = scale(c, w / c.width); parts.append((n, c))
H = max(c.height for _, c in parts)
pat = Image.new('RGBA', (sum(c.width + 2 for _, c in parts), H), (0, 0, 0, 0))
for n, c in parts:
    pat.alpha_composite(c, (x, 0)); props[n] = [x, 0, c.width, c.height]; x += c.width + 2
save(pat, 'props.png'); meta['props'] = props

with open(os.path.join(OUT, 'meta.json'), 'w') as f: json.dump(meta, f)

# ---------------------------------------------------------------- PWA icons: the gerobak on a warm wooden tile
g = dict(parts)['gerobak']
def app_icon(size, pad):
    im = Image.new('RGBA', (size, size), (138, 82, 40, 255))
    d = ImageDraw.Draw(im)
    for yy in range(0, size, max(4, size // 12)): d.line([(0, yy), (size, yy)], fill=(160, 98, 50, 255), width=max(1, size // 96))
    d.ellipse((size * 0.12, size * 0.12, size * 0.88, size * 0.88), fill=(251, 236, 200, 255))
    s = (size * (1 - 2 * pad)) / max(g.width, g.height)
    gi = g.resize((round(g.width * s), round(g.height * s)), Image.NEAREST)
    im.alpha_composite(gi, ((size - gi.width) // 2, (size - gi.height) // 2 + size // 40))
    return im
for sz in (192, 512):
    save(app_icon(sz, 0.2), f'icon-{sz}.png', ICO); save(app_icon(sz, 0.28), f'icon-maskable-{sz}.png', ICO)
save(app_icon(180, 0.2).convert('RGB'), 'apple-touch-icon.png', ICO)
print('ok', len(frames), 'frames', meta['ov_counter'], meta['ov_t1'], meta['ov_t2'])

# ---------------------------------------------------------------- town map (Peta & Cabang)
pm = Image.open(os.path.join(SRC, 'peta.png')).convert('RGB').resize((688, 384), Image.LANCZOS)
save(pm.quantize(colors=200, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE), 'peta.png')
# background: palette-reduce (keeps the look, much smaller file)
bgq = Image.open(os.path.join(OUT, 'bg.png'))
al = bgq.getchannel('A')
q = bgq.convert('RGB').quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
q.putalpha(al)
save(q, 'bg.png')
print('map + bg ok')
