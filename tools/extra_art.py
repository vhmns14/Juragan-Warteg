#!/usr/bin/env python3
"""v1.3 extra pixel art, derived from the generated sheets (no new model art needed):
  src/assets/extra.png  64x80 cells: street figuran (hansip, tukang parkir, pengamen, pedagang asongan, satpol PP)
                        recoloured / accessorised from chars.png, plus the warteg cat (drawn here)
  src/assets/dishx.png  52x52 cells: kolak, es buah (from the lodeh bowl / es teh glass), minyak goreng bottle
  src/assets/extra.json frame names
Run: python3 tools/extra_art.py   (also run by tools/assets.py when present)"""
import colorsys, json, math, os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, '..', 'src', 'assets')
meta = json.load(open(os.path.join(A, 'meta.json')))
chars = Image.open(os.path.join(A, 'chars.png')).convert('RGBA')
CW, CHH = meta['chars']['cell']
COLS = chars.size[0] // CW
OUTL = (34, 22, 14, 255)


def frame(name):
    f = meta['chars']['frames'][name]
    x, y = (f % COLS) * CW, (f // COLS) * CHH
    return chars.crop((x, y, x + CW, y + CHH)).copy()


def bbox_rows(im):
    b = im.getbbox() or (0, 0, CW, CHH)
    return b[1], b[3]


def recolor(im, hue_rng, sat_rng, new_h, new_s=None, vmul=1.0, rows=None):
    px = im.load()
    top, bot = bbox_rows(im)
    for y in range(CHH):
        if rows:
            r0, r1 = top + rows[0] * (bot - top), top + rows[1] * (bot - top)
            if y < r0 or y > r1:
                continue
        for x in range(CW):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hd = h * 360
            lo, hi = hue_rng
            inside = (lo <= hd <= hi) if lo <= hi else (hd >= lo or hd <= hi)
            if inside and sat_rng[0] <= s <= sat_rng[1] and v > 0.12:
                ns = new_s if new_s is not None else s
                nv = min(1, v * vmul)
                rr, gg, bb = colorsys.hsv_to_rgb(new_h / 360, ns, nv)
                px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    return im


def guitar(im, kind):
    d = ImageDraw.Draw(im)
    top, bot = bbox_rows(im)
    hgt = bot - top
    cx = 32
    ty = top + int(hgt * 0.55)
    if kind == 'back':
        # guitar on the back: body behind the shoulders, neck up past the head on the left
        d.line([(cx - 9, ty - 22), (cx + 2, ty - 2)], fill=OUTL, width=3)
        d.line([(cx - 9, ty - 22), (cx + 2, ty - 2)], fill=(120, 72, 32, 255), width=1)
        d.ellipse([cx - 3, ty - 6, cx + 9, ty + 8], fill=(178, 104, 44, 255), outline=OUTL)
        d.ellipse([cx + 1, ty - 1, cx + 5, ty + 3], fill=(60, 34, 16, 255))
        return im
    # held across the belly: body lower-left, neck up to the right shoulder
    d.line([(cx - 2, ty + 2), (cx + 12, ty - 12)], fill=OUTL, width=3)
    d.line([(cx - 2, ty + 2), (cx + 12, ty - 12)], fill=(150, 96, 44, 255), width=1)
    d.rectangle([cx + 11, ty - 15, cx + 14, ty - 11], fill=(90, 54, 24, 255), outline=OUTL)
    d.ellipse([cx - 11, ty - 3, cx + 1, ty + 9], fill=(200, 122, 52, 255), outline=OUTL)
    d.ellipse([cx - 8, ty - 4, cx - 1, ty + 3], fill=(212, 136, 62, 255))
    d.ellipse([cx - 7, ty + 1, cx - 3, ty + 5], fill=(60, 34, 16, 255))
    return im


def tray(im, kind):
    d = ImageDraw.Draw(im)
    top, bot = bbox_rows(im)
    hgt = bot - top
    ty = top + int(hgt * 0.56)
    if kind == 'back':
        d.line([(25, ty - 16), (39, ty - 16)], fill=(90, 60, 30, 255), width=1)
        d.rectangle([20, ty - 2, 24, ty + 6], fill=(150, 96, 50, 255), outline=OUTL)
        d.rectangle([40, ty - 2, 44, ty + 6], fill=(150, 96, 50, 255), outline=OUTL)
        return im
    d.line([(26, ty - 17), (22, ty)], fill=(90, 60, 30, 255), width=1)
    d.line([(38, ty - 17), (43, ty)], fill=(90, 60, 30, 255), width=1)
    d.rectangle([19, ty, 45, ty + 9], fill=(170, 112, 58, 255), outline=OUTL)
    d.rectangle([20, ty + 1, 44, ty + 2], fill=(200, 140, 76, 255))
    cols = [(220, 60, 50), (60, 140, 210), (240, 200, 60), (70, 170, 80), (230, 120, 40), (180, 70, 160)]
    for i in range(6):
        x = 21 + i * 4
        d.rectangle([x, ty - 4, x + 2, ty], fill=cols[i] + (255,), outline=OUTL)
    return im


def whistle(im):
    d = ImageDraw.Draw(im)
    top, bot = bbox_rows(im)
    y = top + int((bot - top) * 0.36)
    d.rectangle([33, y, 35, y + 1], fill=(250, 220, 60, 255))
    return im


def stripes(im, color):
    """reflective strips across the torso (rompi parkir)"""
    px = im.load()
    top, bot = bbox_rows(im)
    for frac in (0.5, 0.6):
        y = int(top + frac * (bot - top))
        for x in range(CW):
            r, g, b, a = px[x, y]
            if a and (r > 150 and g < 150):
                px[x, y] = color
    return im


# ---------------------------------------------------------------- figuran
SUFFIX = ['f', 'w', 'w2', 'b', 'b2']
people = {}
for sfx in SUFFIX:
    back = sfx.startswith('b')
    people[f'hansip_{sfx}'] = recolor(frame(f'mandor_{sfx}'), (36, 70), (0.18, 0.6), 100, 0.42, 0.78)
    pk = recolor(frame(f'mhs_{sfx}'), (205, 235), (0.25, 0.6), 24, 0.9, 2.3, rows=(0.3, 0.68))
    pk = stripes(pk, (236, 236, 210, 255))
    people[f'parkir_{sfx}'] = pk if back else whistle(pk)
    people[f'pengamen_{sfx}'] = guitar(recolor(frame(f'mhs_{sfx}'), (205, 235), (0.25, 0.6), 352, 0.62, 1.45, rows=(0.3, 0.68)), 'back' if back else 'front')
    people[f'asongan_{sfx}'] = tray(recolor(frame(f'buruh_{sfx}'), (20, 45), (0.5, 1.0), 2, 0.55, 0.7, rows=(0.0, 0.2)), 'back' if back else 'front')
    people[f'satpol_{sfx}'] = recolor(frame(f'dinkes_{sfx}'), (200, 240), (0.25, 0.6), 48, 0.38, 1.55, rows=(0.28, 0.66))
# the pengamen playing: front frame with the guitar
people['pengamen_x'] = people['pengamen_f']


# ---------------------------------------------------------------- the cat (drawn here, side view facing right)
def cat_frame(pose):
    S = 3  # draw big, then shrink with nearest for chunky pixels? no: draw 1:1 at art resolution
    im = Image.new('RGBA', (CW, CHH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    O = (232, 140, 48, 255)   # orange
    D = (190, 96, 30, 255)    # stripes
    W = (250, 240, 222, 255)  # white chest / paws
    base = CHH - 3
    if pose == 'sleep':
        d.ellipse([20, base - 11, 44, base], fill=O)
        d.ellipse([36, base - 12, 47, base - 2], fill=O)            # head tucked
        d.polygon([(38, base - 10), (40, base - 15), (42, base - 10)], fill=O)
        d.polygon([(43, base - 10), (45, base - 14), (46, base - 9)], fill=O)
        for x in (25, 29, 33):
            d.line([(x, base - 11), (x + 1, base - 6)], fill=D)
        d.arc([16, base - 9, 30, base + 1], 90, 250, fill=O, width=3)  # tail around
        d.line([(40, base - 6), (42, base - 6)], fill=OUTL)           # closed eye
        d.line([(44, base - 6), (45, base - 6)], fill=OUTL)
    else:
        sit = pose == 'sit'
        if sit:
            d.ellipse([24, base - 15, 40, base], fill=O)               # body upright
            d.ellipse([33, base - 10, 39, base - 1], fill=W)           # chest
            hx, hy = 31, base - 24
            d.arc([14, base - 12, 30, base + 2], 150, 300, fill=O, width=3)  # tail curled on the floor
            d.rectangle([33, base - 2, 36, base], fill=W)
        else:
            step = pose == 'walk2'
            d.ellipse([18, base - 13, 42, base - 4], fill=O)          # body horizontal
            d.ellipse([33, base - 10, 41, base - 4], fill=W)
            for i, x in enumerate((21, 25, 35, 39)):
                off = (1 if (i % 2 == 0) == step else -1)
                d.rectangle([x + off, base - 6, x + 2 + off, base], fill=O if i < 2 else W)
            d.line([(19, base - 10), (12, base - 17)], fill=O, width=3)  # tail up
            d.line([(12, base - 17), (12, base - 21)], fill=O, width=3)
            hx, hy = 38, base - 20
            for x in (24, 28):
                d.line([(x, base - 13), (x + 1, base - 8)], fill=D)
        d.ellipse([hx, hy, hx + 12, hy + 11], fill=O)                 # head
        d.polygon([(hx + 1, hy + 3), (hx + 2, hy - 3), (hx + 5, hy + 1)], fill=O)
        d.polygon([(hx + 7, hy + 1), (hx + 10, hy - 3), (hx + 11, hy + 3)], fill=O)
        d.point((hx + 2, hy - 1), fill=(240, 150, 150, 255))
        d.line([(hx + 4, hy + 2), (hx + 5, hy + 4)], fill=D)
        d.rectangle([hx + 8, hy + 4, hx + 9, hy + 5], fill=OUTL)      # eye
        d.ellipse([hx + 8, hy + 6, hx + 13, hy + 10], fill=W)         # muzzle
        d.point((hx + 12, hy + 7), fill=(220, 110, 120, 255))
        if pose == 'fish':
            d.polygon([(hx + 11, hy + 8), (hx + 20, hy + 6), (hx + 20, hy + 11)], fill=(150, 170, 190, 255))
            d.polygon([(hx + 20, hy + 8), (hx + 24, hy + 5), (hx + 24, hy + 11)], fill=(120, 140, 160, 255))
    # 1 px dark outline around everything
    src = im.copy(); sp = src.load(); p = im.load()
    for y in range(CHH):
        for x in range(CW):
            if sp[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < CW and 0 <= yy < CHH and sp[xx, yy][3]:
                    p[x, y] = OUTL
                    break
    return im


for pose in ('sit', 'walk', 'walk2', 'sleep', 'fish'):
    people[f'cat_{pose}'] = cat_frame(pose)

# ---------------------------------------------------------------- v1.4 staff roles (kepala dapur, manajer, kasir shift)
def toque(im, back=False, side=False):
    """taller chef hat + a red neckerchief (collar band + knot at the front) so the kepala dapur reads at a glance"""
    d = ImageDraw.Draw(im)
    top, bot = bbox_rows(im)
    px = im.load()
    xs = [x for x in range(CW) if px[x, top + 1][3]]
    if xs:
        x0, x1 = min(xs) + 1, max(xs) - 1
        d.rectangle([x0, top - 7, x1, top + 1], fill=(250, 250, 246, 255), outline=OUTL)
        d.line([(x0 + 2, top - 5), (x0 + 2, top)], fill=(214, 214, 210, 255))
    y = top + 7 + int((bot - top - 7) * 0.355)
    RED, DRK = (206, 38, 34, 255), (130, 20, 22, 255)
    row = [x for x in range(CW) if px[x, y][3] and px[x, y][:3] != OUTL[:3]]
    if not row:
        return im
    cx = (min(row) + max(row)) // 2 + (2 if side else 0)
    # collar band: 3 rows over the white jacket around the neck
    for yy in (y - 1, y, y + 1):
        for x in range(cx - 7, cx + 8):
            if 0 <= x < CW:
                r, g, b, a = px[x, yy]
                if a and r > 140 and g > 140 and b > 140:
                    px[x, yy] = RED if yy < y + 1 else DRK
    if not back:
        d.polygon([(cx - 3, y + 1), (cx + 3, y + 1), (cx, y + 6)], fill=RED, outline=DRK)
        d.point((cx, y + 2), fill=(240, 90, 80, 255))
    return im
for sfx in ['f', 'w', 'w2', 'b', 'b2', 'x']:
    people[f'kepala_{sfx}'] = toque(frame(f'cookm_{sfx}'), back=sfx in ('b', 'b2'), side=sfx in ('w', 'w2', 'x'))
    people[f'manajer_{sfx}'] = recolor(frame(f'kasir_{sfx}'), (0, 360), (0.42, 1.0), 222, 0.55, 0.62, rows=(0.36, 0.74))
    people[f'shift_{sfx}'] = recolor(frame(f'kasir_{sfx}'), (0, 360), (0.42, 1.0), 352, 0.6, 0.9, rows=(0.36, 0.74))

names = list(people.keys())
cols = 10
rows = math.ceil(len(names) / cols)
sheet = Image.new('RGBA', (cols * CW, rows * CHH), (0, 0, 0, 0))
frames = {}
for i, n in enumerate(names):
    sheet.paste(people[n], ((i % cols) * CW, (i // cols) * CHH))
    frames[n] = i
sheet.save(os.path.join(A, 'extra.png'), optimize=True)

# ---------------------------------------------------------------- dishes
DC = meta['dishCell']
dishes = Image.open(os.path.join(A, 'dishes.png')).convert('RGBA')
dcols = dishes.size[0] // DC


def dframe(i):
    return dishes.crop(((i % dcols) * DC, (i // dcols) * DC, (i % dcols) * DC + DC, (i // dcols) * DC + DC)).copy()


def kolak():
    im = dframe(3)  # sayur lodeh bowl
    px = im.load()
    for y in range(DC):
        for x in range(DC):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # soup + veg inside the bowl (warm / green, not the grey bowl rim)
            if y < DC * 0.62 and s > 0.12 and 0.25 < v < 0.98:
                rr, gg, bb = colorsys.hsv_to_rgb(28 / 360, min(1, 0.55 + s * 0.3), v * 0.8)
                px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    d = ImageDraw.Draw(im)
    for (x, y) in ((16, 17), (26, 14), (34, 19), (22, 23), (31, 25)):
        d.ellipse([x, y, x + 6, y + 4], fill=(246, 214, 92, 255), outline=(150, 100, 30, 255))
    d.ellipse([28, 20, 31, 23], fill=(120, 60, 30, 255))
    return im


def esbuah():
    im = dframe(16)  # es teh glass
    px = im.load()
    for y in range(DC):
        for x in range(DC):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 10 / 360 < h < 50 / 360 and s > 0.3:
                rr, gg, bb = colorsys.hsv_to_rgb(350 / 360, min(1, s * 0.85), min(1, v * 1.25))
                px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    d = ImageDraw.Draw(im)
    cols = [(90, 190, 80), (250, 220, 70), (240, 120, 40), (250, 250, 240), (120, 200, 90), (250, 200, 60)]
    pts = [(20, 22), (27, 26), (23, 31), (30, 33), (21, 38), (28, 40)]
    for c, (x, y) in zip(cols, pts):
        d.rectangle([x, y, x + 3, y + 3], fill=c + (255,), outline=(90, 40, 40, 255))
    return im


def minyak():
    im = Image.new('RGBA', (DC, DC), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([10, 40, 42, 48], fill=(60, 170, 60, 110))
    d.rectangle([22, 6, 30, 11], fill=(220, 60, 40, 255), outline=OUTL)            # cap
    d.polygon([(21, 12), (31, 12), (36, 20), (36, 44), (16, 44), (16, 20)], fill=(246, 200, 50, 255), outline=OUTL)
    d.rectangle([19, 18, 22, 40], fill=(255, 236, 140, 255))                        # shine
    d.rectangle([17, 25, 35, 35], fill=(250, 246, 230, 255), outline=(150, 100, 30, 255))  # label
    d.rectangle([20, 28, 32, 29], fill=(220, 90, 40, 255))
    d.rectangle([20, 31, 29, 32], fill=(90, 150, 60, 255))
    return im


def hue(i, h, smul=1.0, vmul=1.0, only=None):
    """recolour the food (saturated pixels, not the grey plate) of dish icon i"""
    im = dframe(i)
    px = im.load()
    for y in range(DC):
        for x in range(DC):
            r, g, b, a = px[x, y]
            if not a:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if ss < 0.18 or (only and not (only[0] <= hh * 360 <= only[1])):
                continue
            rr, gg, bb = colorsys.hsv_to_rgb(h / 360, min(1, ss * smul), min(1, vv * vmul))
            px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    return im
def dots(im, pts, col):
    d = ImageDraw.Draw(im)
    for (x, y) in pts:
        d.ellipse([x, y, x + 5, y + 4], fill=col + (255,), outline=(90, 50, 30, 255))
    return im
# v1.4 dishes 103..116 (icons derived from the generated ones)
dx14 = [
    hue(5, 46, 1.1, 1.2),                      # telur dadar
    hue(6, 120, 1.0, 0.7),                     # daun singkong
    hue(16, 30, 1.2, 1.15),                    # es jeruk
    hue(19, 40, 1.3, 1.05),                    # gulai ayam
    hue(4, 36, 0.45, 1.25),                    # ayam pop (pale)
    hue(0, 4, 1.1, 0.95),                      # dendeng balado
    dots(hue(3, 34, 1.2, 0.95), [(18, 18), (28, 16), (24, 24)], (230, 214, 170)),  # gulai tunjang (kikil)
    hue(3, 50, 1.1, 1.05),                     # gulai nangka
    hue(2, 10, 1.1, 0.8),                      # ikan bakar rica
    hue(7, 22, 1.1, 0.7),                      # paru goreng
    hue(14, 105, 1.0, 1.0),                    # sambal ijo
    hue(0, 22, 0.95, 1.1),                     # kalio daging
    dots(hue(11, 12, 1.2, 1.1), [(17, 20), (27, 18), (22, 26)], (250, 140, 90)),  # udang balado
    hue(2, 44, 1.2, 1.1),                      # gulai kepala ikan
]
dx = [kolak(), esbuah(), minyak()] + dx14
dsheet = Image.new('RGBA', (DC * len(dx), DC), (0, 0, 0, 0))
for i, im in enumerate(dx):
    dsheet.paste(im, (i * DC, 0))
dsheet.save(os.path.join(A, 'dishx.png'), optimize=True)

json.dump({'cell': [CW, CHH], 'frames': frames, 'dishx': ['kolak', 'esbuah', 'minyak', 'dadar', 'singkong', 'esjeruk', 'gulaiayam', 'ayampop', 'dendeng', 'gulaitunjang', 'nangka', 'ikanbakar', 'paru', 'sambalijo', 'kalio', 'udang', 'kepalaikan']}, open(os.path.join(A, 'extra.json'), 'w'), indent=0)
print('extra.png', sheet.size, len(names), 'frames; dishx.png', dsheet.size)
