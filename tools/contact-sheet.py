# v1.4: stage-progression contact sheets from tools/shot-stages.mjs output.
#   python3 tools/contact-sheet.py ../shots/stages
# -> progression.png (desktop 1920x1080 shots, room view cropped) and progression-phone.png (390x844 shots).
import os, sys
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1] if len(sys.argv) > 1 else '../shots/stages'
HERE = os.path.dirname(os.path.abspath(__file__))
STAGES = [('1', 'gerobak', '1 · Gerobak'), ('2', 'warteg-kecil', '2 · Warteg Kecil'), ('3', 'warteg', '3 · Warteg'),
          ('4', 'warteg-besar', '4 · Warteg Besar'), ('5', 'rumah-makan', '5 · Rumah Makan'),
          ('6', 'restoran-besar', '6 · Restoran Besar (Lt 1)'), ('6b', 'restoran-lantai2', '6 · Restoran Besar (Lt 2)'),
          ('map', 'peta-nasional', 'Franchise · Peta Nasional')]
BG, INK, PAPER, ACC = (43, 26, 16), (74, 34, 8), (255, 243, 214), (232, 112, 26)


def font(size, bold=True):
    for p in [os.path.join(HERE, '..', 'node_modules', '@fontsource', 'baloo-2', 'files', 'baloo-2-latin-800-normal.woff'),
              '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def sheet(size, crop, cell_w, cols, out, title, suffix=''):
    items = []
    for st, slug, label in STAGES:
        p = os.path.join(D, f'stage-{st}-{slug}-{size}{suffix}.png')
        if not os.path.exists(p) and st == 'map':
            p = os.path.join(D, f'stage-{st}-{slug}-{size}.png')
        if os.path.exists(p):
            items.append((p, label))
    if not items:
        print('no shots for', size); return
    im0 = Image.open(items[0][0])
    sc = im0.size[0] / int(size.split('x')[0])  # device pixel ratio of the shots
    box = tuple(int(v * sc) for v in crop) if crop else (0, 0) + im0.size
    cw = cell_w; ch = round(cw * (box[3] - box[1]) / (box[2] - box[0]))
    lab_h, pad, head = 44, 18, 70
    rows = (len(items) + cols - 1) // cols
    W = cols * cw + (cols + 1) * pad
    H = head + rows * (ch + lab_h) + (rows + 1) * pad
    S = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(S)
    f1, f2 = font(34), font(24)
    d.text((pad, 16), title, font=f1, fill=PAPER)
    for i, (p, label) in enumerate(items):
        r, c = divmod(i, cols)
        x = pad + c * (cw + pad); y = head + pad + r * (ch + lab_h + pad)
        src = Image.open(p).convert('RGB')
        if 'map' in os.path.basename(p) and crop:
            # the Peta Nasional dialog: fit the whole dialog into the cell (letterboxed)
            mb = tuple(int(v * sc) for v in ((366, 34, 1554, 1030) if size.startswith('1920') else (8, 200, 382, 632)))
            m = src.crop(mb)
            if size.startswith('1920'):
                # hide the HUD bar peeking out beside the dialog's title tab (dialog body starts at y 58, tab x 846-1074)
                dm = ImageDraw.Draw(m); t = int((58 - 34) * sc)
                dm.rectangle([0, 0, int((846 - 366) * sc), t], fill=BG); dm.rectangle([int((1074 - 366) * sc), 0, m.size[0], t], fill=BG)
            k = min(cw / m.size[0], ch / m.size[1])
            m = m.resize((round(m.size[0] * k), round(m.size[1] * k)), Image.LANCZOS)
            im = Image.new('RGB', (cw, ch), BG); im.paste(m, ((cw - m.size[0]) // 2, (ch - m.size[1]) // 2))
        else:
            im = src.crop(box).resize((cw, ch), Image.LANCZOS)
        d.rectangle([x - 3, y - 3, x + cw + 2, y + lab_h + ch + 2], fill=ACC if 'map' not in p else (58, 122, 216))
        d.rectangle([x, y, x + cw - 1, y + lab_h - 1], fill=PAPER)
        d.text((x + 12, y + lab_h / 2), label, font=f2, fill=INK, anchor='lm')
        S.paste(im, (x, y + lab_h))
    S.save(out, optimize=True)
    print(out, S.size)


# progression sheets: every stage at the same world scale (shot-stages.mjs with FIXED=1), so the growth is obvious;
# plus the in-game view (the camera fits each room) for reference
sheet('1920x1080', (425, 84, 1497, 962), 600, 4, os.path.join(D, 'progression.png'), 'Juragan Warteg v1.4 · dari gerobak ke Restoran Besar (skala sama, desktop)', '-fixed')
sheet('390x844', (0, 160, 390, 494), 300, 4, os.path.join(D, 'progression-phone.png'), 'Juragan Warteg v1.4 · progression (skala sama, phone)', '-fixed')
sheet('1920x1080', (425, 84, 1497, 962), 600, 4, os.path.join(D, 'progression-ingame.png'), 'Juragan Warteg v1.4 · tampilan in-game per tahap (kamera menyesuaikan ruangan)')
sheet('390x844', None, 300, 4, os.path.join(D, 'progression-ingame-phone.png'), 'Juragan Warteg v1.4 · in-game per tahap (phone)')
