"""Synthesise in-between walk frames for the chibi sheet (v1.2).

The generated art has one walk pose per direction: `<k>_w` (walking towards the camera, facing down-right) and `<k>_b`
(walking away, facing up-right). A one-frame "walk" reads as sliding, so for every walker we add:
  <k>_w2 / <k>_b2  passing pose: the legs squeezed together under the hips, body 1 art px higher (the bob)
Cycle used by the game: w, w2, w, w2 (+ a 1 px bob), stride rate synced to the walking speed. (A mirrored-legs
"other foot" frame was tried and dropped: it cut through trays / hands / long skirts.)

Usable standalone on an existing atlas (idempotent):  python3 tools/walkframes.py src/assets
and called from tools/assets.py when the atlas is rebuilt.
"""
import json, os, sys
from PIL import Image

HIP = 0.68  # squeeze starts this far down the character's height (below the hands / trays)


def _bbox(cell):
    return cell.getchannel('A').getbbox()


def _legs(cell):
    bb = _bbox(cell)
    if not bb:
        return None
    x0, y0, x1, y1 = bb
    hy = y0 + int((y1 - y0) * HIP)
    return bb, hy


def passing(cell):
    """legs pulled together (horizontal squeeze of the leg block around its centre), whole body raised 1 px"""
    r = _legs(cell)
    if not r:
        return cell.copy()
    (x0, y0, x1, y1), hy = r
    W, H = cell.size
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    upper = cell.crop((0, 0, W, hy))
    legs = cell.crop((0, hy, W, H))
    lb = legs.getchannel('A').getbbox()
    out.paste(upper, (0, -1), upper)
    if lb:
        lx0, ly0, lx1, ly1 = lb
        blk = legs.crop(lb)
        bw, bh = blk.size
        # squeeze more at the feet than at the hips: rows scaled from 1.0 (top) to 0.62 (bottom)
        cx = (lx0 + lx1) / 2
        for yy in range(bh):
            f = 1.0 - 0.38 * (yy / max(1, bh - 1))
            nw = max(1, round(bw * f))
            row = blk.crop((0, yy, bw, yy + 1)).resize((nw, 1), Image.NEAREST)
            out.paste(row, (round(cx - nw / 2), hy + ly0 + yy - 1), row)
        # keep one row of feet on the ground line so the sprite does not float (shadow stays under the feet)
    return out


def add_walk_frames(atlas, frames, cell):
    """append _w2/_b2 for every key that has _w and _b; returns (atlas, frames)"""
    cw, chh = cell
    cols = atlas.size[0] // cw
    keys = sorted({k[:-2] for k in frames if k.endswith('_w')} & {k[:-2] for k in frames if k.endswith('_b')})
    todo = [(k, s) for k in keys for s in ('w', 'b') if f'{k}_{s}2' not in frames]
    if not todo:
        return atlas, frames
    n = max(frames.values()) + 1
    total = n + len(todo)
    rows = (total + cols - 1) // cols
    big = Image.new('RGBA', (cols * cw, rows * chh), (0, 0, 0, 0))
    big.paste(atlas, (0, 0))
    frames = dict(frames)
    def get(i):
        x, y = (i % cols) * cw, (i // cols) * chh
        return big.crop((x, y, x + cw, y + chh))
    def put(i, im):
        big.paste(im, ((i % cols) * cw, (i // cols) * chh))
    for k, s in todo:
        src = get(frames[f'{k}_{s}'])
        put(n, passing(src)); frames[f'{k}_{s}2'] = n; n += 1
    return big, frames


if __name__ == '__main__':
    d = sys.argv[1] if len(sys.argv) > 1 else 'src/assets'
    meta = json.load(open(os.path.join(d, 'meta.json')))
    atlas = Image.open(os.path.join(d, 'chars.png')).convert('RGBA')
    atlas2, fr = add_walk_frames(atlas, meta['chars']['frames'], meta['chars']['cell'])
    if fr == meta['chars']['frames']:
        print('walk frames already present'); sys.exit(0)
    atlas2.save(os.path.join(d, 'chars.png'), optimize=True)
    meta['chars']['frames'] = fr
    json.dump(meta, open(os.path.join(d, 'meta.json'), 'w'))
    print('ok', atlas2.size, len(fr), 'frames')
