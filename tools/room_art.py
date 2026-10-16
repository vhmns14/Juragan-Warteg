"""v1.4 room pieces for the procedural, size-adaptive warung rooms (src/room.ts):
cuts the furniture / kitchen out of the generated room bitmap (src/assets/bg.png, 2x art px) so the game can compose
rooms of any size: a procedural floor + walls (colours sampled from the same bitmap) with these pieces on top.
  src/assets/room.png   atlas: table sets (with their floor shadow), the back kitchen (warmer + cabinet, rice baskets,
                        stove counter, fridge), the menu board, the counter + etalase in three parts (left end, a
                        repeatable middle strip, right end) and derived pieces (prasmanan table, VIP sofa table, stairs)
  src/assets/room.json  frame rects + the bg px position each piece was cut from (its anchor in the original room)
Run: python3 tools/room_art.py   (Pillow, numpy, scipy)"""
import json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.normpath(os.path.join(HERE, '..', 'src', 'assets'))
bg = Image.open(os.path.join(A, 'bg.png')).convert('RGBA')
ba = np.array(bg).astype(np.int16)
H, W = ba.shape[:2]
ys, xs = np.mgrid[0:H, 0:W]
FA = ((xs - 15) + 2 * (ys - 440)) / 2.0   # floor-plane iso a (bg px)
FB = ((xs - 15) - 2 * (ys - 440)) / 2.0   # floor-plane iso b
rgb = ba[..., :3]
lum = rgb.sum(axis=2)

def poly_mask(poly):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255)
    return np.array(m) > 0

def near(c, tol):
    return (np.abs(rgb - np.array(c)).sum(axis=2) <= tol)

FLOOR = [(197, 136, 80), (191, 129, 77), (200, 137, 83), (198, 136, 82), (188, 128, 78), (194, 134, 83), (196, 134, 78), (203, 138, 83), (201, 134, 81), (196, 134, 82)]
def floorish():
    m = np.zeros((H, W), bool)
    for c in FLOOR: m |= near(c, 10)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    m |= (r >= 186) & (r <= 212) & (g >= 124) & (g <= 146) & (b >= 72) & (b <= 92)
    return m
WALL = [(202, 178, 147), (199, 181, 151), (231, 211, 179), (106, 141, 87), (107, 145, 88), (104, 142, 88), (105, 143, 91), (114, 142, 99), (116, 146, 102), (78, 100, 78), (155, 154, 122), (176, 171, 143), (195, 174, 146)]
def wallish():
    m = np.zeros((H, W), bool)
    for c in WALL: m |= near(c, 26)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    m |= (r > 205) & (g > 185) & (b > 150) & (r - b < 70) & (r - b > 30)   # light cream
    m |= (g > r + 18) & (g > b + 25) & (g > 110)                              # green band
    return m

pieces = {}
def cut(name, keep, pad=1):
    a = ba.copy(); a[~keep, 3] = 0
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
    bb = im.getbbox()
    pieces[name] = (im.crop(bb), [bb[0], bb[1]])

def cleanup(keep, minsize=12):
    lab, n = ndimage.label(keep)
    sizes = ndimage.sum(keep, lab, range(1, n + 1))
    small = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s < minsize])
    return keep & ~small

# ---- table sets: polygon around table + benches, then the floor around them flood-removed (the dark under-table
# shadow is kept with the piece)
def table(name, poly):
    pm = poly_mask(poly) & (ba[..., 3] > 0)
    fl = floorish() & pm
    # floor connected to the polygon border
    border = pm & ~ndimage.binary_erosion(pm, iterations=2)
    lab, n = ndimage.label(fl)
    ids = set(np.unique(lab[border & fl])) - {0}
    out = np.isin(lab, list(ids))
    keep = pm & ~out
    keep = ndimage.binary_opening(keep, iterations=1) | (keep & (lum < 300))
    keep = cleanup(keep, 30)
    cut(name, keep)

table('table_a', [(300, 548), (470, 452), (520, 470), (562, 494), (566, 536), (410, 620), (380, 612), (300, 572)])
table('table_b', [(505, 440), (650, 362), (700, 372), (770, 396), (775, 440), (620, 516), (590, 510), (505, 470)])

# ---- back kitchen (against the left wall): everything that is not wall / floor in the band behind the counter
kpoly = [(18, 330), (300, 190), (300, 120), (404, 100), (404, 300), (330, 330), (128, 420), (96, 470), (40, 470), (18, 450)]
def big(m, n):
    lab, k = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, k + 1))
    return np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v >= n])
kp = poly_mask(kpoly)
km = kp & (ba[..., 3] > 0) & ~big(wallish() & kp, 300)
# the counter + etalase in front is cut separately (ov_counter polygon)
cpoly = [(92, 412), (128, 360), (500, 203), (522, 212), (552, 292), (550, 354), (192, 530), (90, 474)]
km &= ~poly_mask(cpoly)
km &= ~big(floorish() & kp, 60)
km = cleanup(ndimage.binary_closing(km, iterations=1) & poly_mask(kpoly), 40)
# the fridge's light reflections match the cream wall: keep its whole silhouette; drop the dome sitting on the etalase
km |= poly_mask([(303, 128), (368, 106), (397, 122), (397, 242), (352, 266), (303, 252)]) & (ba[..., 3] > 0)
km &= xs < 398
cut('kitchen', km)

# ---- wall fans (left wall + right wall), wall removed around them
def wallpiece(name, poly):
    pm = poly_mask(poly) & (ba[..., 3] > 0)
    k = pm & ~big(wallish() & pm, 40)
    cut(name, cleanup(k, 20))
wallpiece('fan_l', [(104, 186), (168, 166), (170, 262), (104, 270)])
wallpiece('fan_r', [(580, 150), (650, 150), (652, 250), (580, 250)])

# ---- menu board on the left wall
cut('menu', poly_mask([(176, 228), (176, 172), (278, 124), (282, 126), (282, 186), (178, 236)]) & (ba[..., 3] > 0))

# ---- counter + etalase (same polygon as ov_counter), split into left end / repeatable middle / right end
cm = poly_mask(cpoly) & (ba[..., 3] > 0)
# the polygon catches a bit of the wall / floor around the ends: drop them (the room behind is procedural now)
cm &= ~(big(wallish() & cm, 8) & ((xs > 470) | (xs < 140)))
cm &= ~(big(floorish() & cm, 8) & (xs < 200))
cut('counter', cleanup(cm, 10))

# ---- table variants (dark wood for the Restoran Besar hall, VIP: white cloth + red velvet benches), each with the
# matching front overlay (the ov_t2 polygon: table top + front bench, drawn over people on the back bench) and a
# buffet table (table top only, steel trays of lauk on it) for the prasmanan line
tim, torg = pieces['table_a']
ta = np.array(tim).astype(np.float32)
OVP = [(325 - torg[0], 537 - torg[1]), (480 - torg[0], 455 - torg[1]), (538 - torg[0], 486 - torg[1]), (538 - torg[0], 500 - torg[1]), (390 - torg[0], 584 - torg[1]), (384 - torg[0], 580 - torg[1])]
def pm2(poly, size):
    m = Image.new('L', size, 0); ImageDraw.Draw(m).polygon(poly, fill=255); return np.array(m) > 0
TW, TH = tim.size
FRONT_BENCH = [(84, 136), (240, 54), (266, 62), (266, 80), (110, 162), (84, 156)]
STOOL = [(0, 88), (30, 76), (32, 130), (12, 140), (0, 132)]
TOP = [(22, 80), (180, -1), (239, 29), (239, 41), (88, 122), (22, 92)]
bench = pm2(FRONT_BENCH, (TW, TH)) | pm2(STOOL, (TW, TH))
def mkimg(a): return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
def variant(name, arr):
    im = mkimg(arr); pieces[name] = (im, torg)
    ov = arr.copy(); ov[~pm2(OVP, (TW, TH)), 3] = 0
    o = mkimg(ov); bb = o.getbbox(); pieces['ov_' + name] = (o.crop(bb), [torg[0] + bb[0], torg[1] + bb[1]])
variant('kayu', ta.copy())
g = ta.copy(); g[..., 0] *= 0.66; g[..., 1] *= 0.5; g[..., 2] *= 0.46; variant('gelap', g)
v = ta.copy()
lumv = v[..., :3].mean(axis=2)
# red velvet benches
v[bench, 0] = np.clip(lumv[bench] * 1.25 + 30, 0, 255); v[bench, 1] = lumv[bench] * 0.28; v[bench, 2] = lumv[bench] * 0.32
# white cloth over the top, a red runner down the middle, darker hem
top = pm2(TOP, (TW, TH)) & (v[..., 3] > 0)
L0, L1, Ri, Bo = np.array([22, 80.0]), np.array([180, -1.0]), np.array([239, 29.0]), np.array([88, 122.0])
yy, xx = np.mgrid[0:TH, 0:TW]
# param t across the table (0 back edge .. 1 front edge): distance from the back edge line L0-L1 vs the front edge Bo-Ri
def side(p0, p1):
    d = p1 - p0; return ((xx - p0[0]) * d[1] - (yy - p0[1]) * d[0]) / np.hypot(*d)
db_, df_ = side(L0, L1), side(Bo, Ri)
t = np.abs(db_) / (np.abs(db_) + np.abs(df_) + 1e-6)
cloth = np.stack([236 + (lumv - 150) * 0.12, 230 + (lumv - 150) * 0.12, 214 + (lumv - 150) * 0.12], -1)
run = (t > 0.4) & (t < 0.6)
cloth[run] = np.stack([186 + (lumv[run] - 150) * 0.1, 40 + 0 * lumv[run], 46 + 0 * lumv[run]], -1)
hem = top & ~ndimage.binary_erosion(top, iterations=2)
cloth[hem] *= 0.78
for c in range(3): v[..., c] = np.where(top, cloth[..., c], v[..., c])
variant('vip', v)
# buffet: table top without benches + steel trays with lauk (dish icons)
bf = ta.copy(); bf[ndimage.binary_dilation(bench, iterations=2) & ~pm2(TOP, (TW, TH)), 3] = 0
bfi = mkimg(bf)
dsh = Image.open(os.path.join(A, 'dishes.png')).convert('RGBA'); DC = 52
d = ImageDraw.Draw(bfi)
icons = [0, 4, 5, 2, 9, 11, 3, 6, 14, 1]
for i in range(5):
    for j in range(2):
        tt = (i + 0.6) / 5.4; u = 0.3 + j * 0.4
        # point on the top: along the long axis (L0 -> L1 at the back, Bo -> Ri at the front), across by u
        pb = L0 + (L1 - L0) * tt; pf = Bo + (Ri - Bo) * tt; c = pb + (pf - pb) * u
        x0, y0 = int(c[0]), int(c[1])
        d.polygon([(x0 - 15, y0 + 1), (x0 + 1, y0 - 7), (x0 + 15, y0 - 1), (x0 - 1, y0 + 7)], fill=(150, 156, 160, 255), outline=(70, 74, 78, 255))
        k = icons[(i * 2 + j) % len(icons)]
        ic = dsh.crop((k * DC, 0, (k + 1) * DC, DC)).resize((20, 20), Image.NEAREST)
        bfi.alpha_composite(ic, (x0 - 10, y0 - 13))
pieces['buffet'] = (bfi, torg)
bfa = np.array(bfi).astype(np.float32); bfa[~pm2(OVP, (TW, TH)), 3] = 0; o = mkimg(bfa); bb = o.getbbox()
pieces['ov_buffet'] = (o.crop(bb), [torg[0] + bb[0], torg[1] + bb[1]])
del pieces['table_a']; del pieces['table_b']

json_out = {}
SHEET_W = 1024
x = y = rowh = 0
parts = []
for n, (im, org) in pieces.items():
    if x + im.width > SHEET_W: x = 0; y += rowh + 2; rowh = 0
    parts.append((n, im, (x, y), org)); x += im.width + 2; rowh = max(rowh, im.height)
sheet = Image.new('RGBA', (SHEET_W, y + rowh), (0, 0, 0, 0))
for n, im, (px, py), org in parts:
    sheet.alpha_composite(im, (px, py)); json_out[n] = {'r': [px, py, im.width, im.height], 'o': org}
sheet.save(os.path.join(A, 'room.png'), optimize=True)
json.dump(json_out, open(os.path.join(A, 'room.json'), 'w'))
print(json.dumps(json_out))
