// Bitmap assets (generated pixel art processed by tools/assets.py). All drawn at 0.5 scale (authored at 2x).
import Phaser from 'phaser';
import bgUrl from './assets/bg.png';
import ovCounterUrl from './assets/ov_counter.png';
import ovT1Url from './assets/ov_t1.png';
import ovT2Url from './assets/ov_t2.png';
import charsUrl from './assets/chars.png';
import dishesUrl from './assets/dishes.png';
import iconsUrl from './assets/icons.png';
import propsUrl from './assets/props.png';
import petaUrl from './assets/peta.png';
import meta from './assets/meta.json';
import extraUrl from './assets/extra.png';
import dishxUrl from './assets/dishx.png';
import extraMeta from './assets/extra.json';
import roomUrl from './assets/room.png';
import roomMeta from './assets/room.json';

export const HI = 0.5;
/** character sprites: drawn 1.75x the furniture scale so people match the benches / etalase (counter ~chest high on a
 *  standing adult). The art is authored at 2x, so 0.875 maps one art pixel to 1.75 logical px (nearest, crisp). */
export const CH = 0.875;
/** height of a standing character above its feet, logical px (62 art rows) */
export const CHAR_H = Math.round(62 * CH);
export const META = meta as unknown as {
  ov_counter: [number, number]; ov_t1: [number, number]; ov_t2: [number, number];
  chars: { cell: [number, number]; frames: Record<string, number> }; dishCell: number; icons: string[]; iconCell: number;
  props: Record<string, [number, number, number, number]>;
};

export function preloadAssets(sc: Phaser.Scene) {
  sc.load.image('bg', bgUrl);
  sc.load.image('ov_counter', ovCounterUrl);
  sc.load.image('ov_t1', ovT1Url);
  sc.load.image('ov_t2', ovT2Url);
  sc.load.spritesheet('chars', charsUrl, { frameWidth: META.chars.cell[0], frameHeight: META.chars.cell[1] });
  sc.load.spritesheet('dishes', dishesUrl, { frameWidth: META.dishCell, frameHeight: META.dishCell });
  sc.load.spritesheet('icons', iconsUrl, { frameWidth: META.iconCell, frameHeight: META.iconCell });
  sc.load.image('props', propsUrl);
  sc.load.image('peta', petaUrl);
  sc.load.spritesheet('extra', extraUrl, { frameWidth: EXTRA.cell[0], frameHeight: EXTRA.cell[1] });
  sc.load.spritesheet('dishx', dishxUrl, { frameWidth: META.dishCell, frameHeight: META.dishCell });
  sc.load.image('room', roomUrl);
}
/** after load: named frames on the props sheet */
export function setupAssets(sc: Phaser.Scene) {
  const t = sc.textures.get('props');
  for (const [k, [x, y, w, h]] of Object.entries(META.props)) if (!t.has(k)) t.add(k, 0, x, y, w, h);
  // v1.4 room pieces (room.ts draws from the source image; the overlays use these named frames)
  const r = sc.textures.get('room');
  for (const [k, f] of Object.entries(roomMeta as unknown as Record<string, { r: [number, number, number, number] }>)) if (!r.has(k)) r.add(k, 0, ...f.r);
}
export const charFrame = (name: string) => META.chars.frames[name] ?? 0;
/** v1.3 extra sheet (street figuran + the cat), same cell size as chars */
export const EXTRA = extraMeta as unknown as { cell: [number, number]; frames: Record<string, number>; dishx: string[] };
export const hasChar = (name: string) => META.chars.frames[name] !== undefined || EXTRA.frames[name] !== undefined;
/** texture + frame for a character frame name on either sheet */
export function charTex(name: string): [string, number] {
  if (META.chars.frames[name] !== undefined) return ['chars', META.chars.frames[name]];
  if (EXTRA.frames[name] !== undefined) return ['extra', EXTRA.frames[name]];
  return ['chars', 0];
}
/** texture + frame for a dish / ingredient icon number (>= 100 lives in dishx.png) */
export function dishTex(icon: number): [string, number] { return icon >= 100 ? ['dishx', icon - 100] : ['dishes', icon]; }
export const iconFrame = (name: string) => Math.max(0, META.icons.indexOf(name));
