// Builds the Buccaneer Bay Theme: LPC characters (composed from the pinned generator repo) with drawn-on
// muskets and a spectral Ghost Admiral, custom effect/pickup/tileset art, placeholder audio, credits, and
// placeholder Cutscenes if ffmpeg exists.
// Usage: npm run assets:buccaneer   (ULPC_DIR overrides the generator checkout, default .cache/ulpc)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioSprite, bell, concat, hz, mix, noise, place, pluck, RATE, silence, tone, wav } from './lib/audio.mjs';
import { iconCard, writePlaceholderClips } from './lib/cutscenes.mjs';
import { creditsCsv, crowd, DIRS, FRAME, Lpc, walkFrames, WALK_FRAMES } from './lib/lpc.mjs';
import { Canvas, hex, lcg, mixColor, packAtlas, tileNoise, withAlpha, writePng } from './lib/raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'buccaneer';
const OUT = join(ROOT, 'public/assets/themes', ID);
const CACHE = join(ROOT, '.cache');
mkdirSync(join(OUT, 'cut'), { recursive: true });
mkdirSync(CACHE, { recursive: true });

const WEAPONS = ['sweep', 'shot', 'orbit', 'aura', 'chain', 'pulse', 'lure'];

// ------------------------------------------------------------------ LPC characters

const skin = (item, color) => ({ item, color, material: 'body' });

/** Recipes for every actor slot. Items are sheet_definitions file names in the LPC generator. */
const RECIPES = {
  'sweep-start': { // Privateer Captain: frock coat, tricorne, moustache, sabre as the cutlass
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male', 'light'),
      { item: 'legs_pants', color: 'black' }, { item: 'feet_boots_fold', color: 'brown' },
      { item: 'torso_clothes_longsleeve_laced', color: 'white' }, { item: 'torso_jacket_frock', color: 'maroon' },
      { item: 'torso_jacket_frock_buttons', color: 'gold' }, { item: 'belt_sash', color: 'black' },
      { item: 'hair_ponytail', color: 'dark_brown' }, { item: 'beards_handlebar', color: 'dark_brown' },
      { item: 'hat_tricorne_captain', color: 'black' }, { item: 'hat_tricorne_captain_trim', color: 'gold' },
      { item: 'weapon_sword_saber', variant: 'saber' },
    ],
  },
  'shot-start': { // Navy Gunner: blue jacket, white trousers, musket slung on the back
    body: 'male',
    layers: [
      { item: 'body', color: 'amber' }, skin('heads_human_male', 'amber'),
      { item: 'legs_pants', color: 'white' }, { item: 'feet_boots_basic', color: 'black' },
      { item: 'torso_clothes_longsleeve', color: 'white' }, { item: 'torso_jacket_frock', color: 'navy' },
      { item: 'torso_jacket_frock_buttons', color: 'gold' }, { item: 'neck_cravat', color: 'black' },
      { item: 'hair_buzzcut', color: 'black' }, { item: 'hat_tricorne', color: 'navy' },
    ],
    musket: true,
  },
  swarmer: { // Deckhands: striped shirt, rolled trousers, bandana, bare feet
    body: 'male',
    layers: [
      { item: 'body', color: 'taupe' }, skin('heads_human_male', 'taupe'),
      { item: 'legs_pantaloons', color: 'tan' }, { item: 'torso_clothes_sleeveless_striped', color: 'navy' },
      { item: 'hair_messy2', color: 'chestnut' }, { item: 'hat_bandana_pirate', color: 'red' },
    ],
  },
  fragment: { // Lone Boarders (the Boarding Party below is three of these)
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male', 'light'),
      { item: 'legs_pants', color: 'brown' }, { item: 'feet_boots_fold', color: 'black' },
      { item: 'torso_clothes_longsleeve_laced', color: 'tan' }, { item: 'torso_clothes_vest_open', color: 'brown' },
      { item: 'beards_winter', color: 'black' }, { item: 'facial_eyepatch_left', color: 'black' },
      { item: 'hat_bandana_pirate', color: 'black' }, { item: 'hat_bandana_pirate_skull', color: 'white' }, { item: 'weapon_sword_dagger', variant: 'dagger' },
    ],
  },
  tank: { // Brute Quartermaster: bare-chested, suspenders and sash (scaled up in theme.json)
    body: 'muscular',
    layers: [
      { item: 'body', color: 'bronze' }, skin('heads_human_male', 'bronze'),
      { item: 'legs_widepants', color: 'brown' }, { item: 'feet_boots_fold', color: 'black' },
      { item: 'torso_aprons_suspenders', color: 'leather' }, { item: 'belt_obi', color: 'red' },
      { item: 'arms_bracers', color: 'iron' }, { item: 'beards_winter', color: 'dark_brown' },
      { item: 'hair_shorthawk', color: 'dark_brown' }, { item: 'facial_earrings_stud', color: 'gold' },
    ],
  },
  ranged: { // Musketeer: red coat, tricorne, musket
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male', 'light'),
      { item: 'legs_pants', color: 'white' }, { item: 'feet_boots_basic', color: 'black' },
      { item: 'torso_clothes_longsleeve', color: 'white' }, { item: 'torso_jacket_frock', color: 'red' },
      { item: 'torso_jacket_frock_buttons', color: 'silver' }, { item: 'neck_cravat', color: 'white' },
      { item: 'hair_ponytail', color: 'white' }, { item: 'hat_tricorne', color: 'black' },
    ],
    musket: true,
  },
  boss: { // The Ghost Admiral: a skeleton in full dress, recoloured spectral (scaled up in theme.json)
    body: 'male',
    layers: [
      { item: 'body_skeleton' }, { item: 'heads_skeleton' },
      { item: 'legs_pants', color: 'white' }, { item: 'feet_boots_fold', color: 'black' },
      { item: 'torso_jacket_frock', color: 'navy' }, { item: 'torso_jacket_frock_lapel', color: 'gold' },
      { item: 'torso_jacket_frock_buttons', color: 'gold' }, { item: 'shoulders_epaulets', color: 'yellow' },
      { item: 'hat_bicorne_athwart_admiral', color: 'black' }, { item: 'hat_bicorne_athwart_admiral_trim', color: 'gold' },
      { item: 'weapon_sword_saber', variant: 'saber' },
    ],
    ghost: true,
  },
};

const INK = hex('#140d08');
const WOOD = hex('#8a5a2e'), WOOD_DARK = hex('#56361b'), WOOD_LIGHT = hex('#b07a44');
const IRON = hex('#6d717a'), IRON_DARK = hex('#3d4048'), STEEL = hex('#c9d0da');

/**
 * LPC has no firearms. Sling a musket across each frame's back, anchored to the torso so it bobs
 * with the walk. Facing down it hangs behind the body, so only the muzzle above the shoulder and the
 * strap across the chest are drawn over it; from the side and behind it is drawn over the back.
 */
function addMuskets(sheet, bodySheet) {
  const STRAP = hex('#5a3a1e');
  DIRS.forEach((dir, row) => {
    for (let i = 0; i < WALK_FRAMES; i++) {
      const ox = i * FRAME, oy = row * FRAME;
      const box = bodySheet.crop(ox, oy + 30, FRAME, 16).bbox(128); // shoulders to hips
      if (!box) continue;
      const cx = (box.x0 + box.x1) / 2, top = box.y0 + 30;
      // butt end low, muzzle high over the shoulder
      const [[bx, by], [mx, my]] = {
        down: [[cx - 12, top + 13], [cx + 13, top - 11]],
        up: [[cx + 11, top + 13], [cx - 10, top - 13]],
        left: [[box.x1 - 1, top + 14], [box.x1 - 4, top - 14]],
        right: [[box.x0 + 1, top + 14], [box.x0 + 4, top - 14]],
      }[dir];
      const gun = new Canvas(FRAME, FRAME);
      const k = 0.4, sx = bx + (mx - bx) * k, sy = by + (my - by) * k; // where the stock meets the barrel
      gun.line(bx, by, sx, sy, 3, WOOD);
      gun.line(sx, sy, mx, my, 1.6, IRON_DARK);
      gun.line(sx, sy, sx + (mx - sx) * 0.3, sy + (my - sy) * 0.3, 2, WOOD_DARK);
      gun.outline(withAlpha(INK, 200));
      const frame = sheet.crop(ox, oy, FRAME, FRAME);
      const out = dir === 'down' ? gun.draw(frame) : frame.draw(gun);
      if (dir === 'down') {
        out.draw(gun, 0, 0, 0, 0, FRAME, Math.floor(top)); // the muzzle shows above the shoulder
        out.line(cx - 5, top + 11, cx + 5, top + 1, 1, STRAP);
      }
      for (let y = 0; y < FRAME; y++) sheet.px.set(out.px.subarray(y * FRAME * 4, (y + 1) * FRAME * 4), ((oy + y) * sheet.w + ox) * 4);
    }
  });
}

/** Recolours every pixel into a translucent sea-green spectre, lighter where the art was lighter, with a glow. */
function ghostify(sheet) {
  const p = sheet.px;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const lum = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
    const c = mixColor(hex('#0f3b3a'), hex('#c8fff0'), Math.min(1, lum * 1.25));
    p.set([c[0], c[1], c[2], Math.round(p[i + 3] * 0.82)], i);
  }
  sheet.outline(hex('#5affc8', 110));
}

const lpc = new Lpc(process.env.ULPC_DIR ?? join(CACHE, 'ulpc'));
const frames = [];
for (const [actor, recipe] of Object.entries(RECIPES)) {
  const sheet = lpc.compose(recipe);
  if (recipe.musket) addMuskets(sheet, lpc.composeOnly(recipe, ['body']));
  if (recipe.ghost) ghostify(sheet);
  writePng(join(CACHE, `${ID}-${actor}.png`), sheet); // for inspection
  frames.push(...walkFrames(actor, sheet));
  if (actor === 'fragment') { const c = crowd(sheet); frames.push(...walkFrames('splitter', c.sheet, c.width)); } // the Boarding Party
}

// ------------------------------------------------------------------ custom art (effects, pickups, tileset)

const art = (name, w, h, paint, outline = true) => {
  const c = new Canvas(w, h);
  paint(c);
  if (outline) c.outline(withAlpha(INK, 220));
  frames.push({ name, c });
  return c;
};

const GOLD = hex('#f0c040'), GOLD_DARK = hex('#a8791c'), BRASS = hex('#c9a13a'), ROPE = hex('#c8a86a'), ROPE_DARK = hex('#8c7040');
const FIRE = hex('#ff8a2a'), FLAME = hex('#ffd36a'), POWDER = hex('#d8d2c4'), ELMO = hex('#7fb6ff'), ELMO_CORE = hex('#e8f4ff');
const SPECTRE = hex('#5affc8'), SPECTRE_DARK = hex('#0f5a4a'), SEA = hex('#1e5d7a'), RUM = hex('#6a3a14');

// Cutlass slash: a steel-blue crescent with a bright edge, pointing right.
art('sweep/arc', 128, 128, (c) => c.shade(0, 0, 127, 127, (x, y) => {
  const d = Math.hypot(x - 64, y - 64), a = Math.atan2(y - 64, x - 64);
  if (d < 36 || d > 62 || Math.abs(a) > 1.22) return null;
  const t = (d - 36) / 26, fade = Math.min(1, (1 - Math.abs(a) / 1.22) * 2.2);
  return withAlpha(mixColor(hex('#6f8aa8'), hex('#ffffff'), t), Math.round(230 * fade * (0.35 + 0.65 * t)));
}), false);
// Flintlock ball with a puff of smoke behind it, pointing right.
art('shot/proj', 14, 8, (c) => { c.circle(3, 4, 2.5, withAlpha(POWDER, 120)); c.circle(6, 4, 2, withAlpha(POWDER, 150)); c.circle(10, 4, 3, IRON_DARK); c.circle(9, 3, 1, STEEL); });
// Swinging anchor.
art('orbit/blade', 22, 22, (c) => {
  c.line(11, 3, 11, 17, 2, IRON); c.ring(11, 3, 1.5, 3, IRON); c.line(7, 6, 15, 6, 2, IRON);
  c.sector(11, 11, 6, 8, 0.25, Math.PI - 0.25, IRON);
  c.poly([[3, 13], [2, 9], [6, 12]], IRON); c.poly([[19, 13], [20, 9], [16, 12]], IRON);
  c.line(12, 4, 12, 16, 1, STEEL);
});
// Gunpowder smoke: dirty white clouds with a few embers and a faint rim.
const smoke = tileNoise(19, 6), embers = lcg(4);
art('aura/field', 128, 128, (c) => {
  c.radial(64, 64, 62, (t, x, y) => {
    const n = smoke(x / 128, y / 128);
    return withAlpha(mixColor(hex('#8a8478'), POWDER, n), Math.round(t > 0.93 ? 140 : 35 + 85 * n * (1 - t * 0.5)));
  });
  for (let i = 0; i < 18; i++) { const a = embers() * Math.PI * 2, r = embers() * 55; c.circle(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1, withAlpha(FIRE, 200)); }
}, false);
// St. Elmo's Fire: a jagged pale-blue plasma segment.
art('chain/bolt', 64, 8, (c) => {
  const r = lcg(11);
  let y = 4;
  for (let x = 0; x < 64; x += 4) {
    const ny = 2 + r() * 4;
    c.line(x, y, x + 4, ny, 3, withAlpha(ELMO, 150));
    c.line(x, y, x + 4, ny, 1, ELMO_CORE);
    y = ny;
  }
}, false);
// Cannon Broadside: a fiery blast ring inside a smoke ring.
art('pulse/ring', 128, 128, (c) => {
  c.ring(64, 64, 50, 62, withAlpha(POWDER, 120));
  c.ring(64, 64, 54, 60, withAlpha(FIRE, 200));
  c.ring(64, 64, 56, 58, withAlpha(FLAME, 240));
}, false);
// Barrel of rum.
const barrel = (c, x, y, w, h) => {
  c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, WOOD); c.rect(x + 1, y + 2, w - 2, h - 4, WOOD);
  c.ellipse(x + w / 2, y + 2, w / 2 - 1, 2, WOOD_LIGHT); c.circle(x + w / 2, y + 2, 1, RUM);
  for (const f of [0.25, 0.75]) c.rect(x, y + h * f - 1, w, 2, IRON_DARK);
  c.line(x + w * 0.35, y + 3, x + w * 0.35, y + h - 2, 1, WOOD_DARK); c.line(x + w * 0.7, y + 3, x + w * 0.7, y + h - 2, 1, WOOD_DARK);
};
art('lure/bait', 20, 24, (c) => barrel(c, 2, 1, 16, 22));

/** 32 px icon on a weathered sea-chart square with a rope border. */
const icon = (weapon, paint) => art(`${weapon}/icon`, 32, 32, (c) => {
  c.rect(1, 1, 30, 30, ROPE);
  for (let i = 1; i < 31; i += 3) { c.rect(i, 1, 1, 1, ROPE_DARK); c.rect(i, 30, 1, 1, ROPE_DARK); c.rect(1, i, 1, 1, ROPE_DARK); c.rect(30, i, 1, 1, ROPE_DARK); }
  c.rect(3, 3, 26, 26, hex('#e8d9ad'));
  c.line(3, 22, 28, 18, 1, withAlpha(SEA, 60));
  paint(c);
});
icon('sweep', (c) => { c.sector(6, 26, 16, 19, -1.45, -0.2, STEEL); c.line(6, 26, 10, 22, 2, BRASS); c.sector(8, 24, 3, 5, -2.8, 0.2, BRASS); });
icon('shot', (c) => {
  c.line(6, 20, 14, 15, 4, WOOD); c.line(13, 15, 26, 11, 2, IRON_DARK); c.circle(15, 18, 2, IRON);
  c.line(14, 13, 17, 10, 1, IRON_DARK); c.circle(27, 10, 1.5, withAlpha(POWDER, 220));
});
icon('orbit', (c) => {
  c.line(16, 6, 16, 23, 2, IRON_DARK); c.ring(16, 6, 1.5, 3, IRON_DARK); c.line(11, 10, 21, 10, 2, IRON_DARK);
  c.sector(16, 15, 8, 10, 0.25, Math.PI - 0.25, IRON_DARK); c.poly([[5, 19], [5, 14], [9, 18]], IRON_DARK); c.poly([[27, 19], [27, 14], [23, 18]], IRON_DARK);
});
icon('aura', (c) => { for (const [x, y, r] of [[11, 18, 6], [19, 14, 7], [21, 22, 5], [13, 11, 4]]) c.circle(x, y, r, withAlpha(hex('#9a9488'), 190)); c.circle(17, 18, 2, FIRE); c.circle(12, 14, 1, FLAME); });
icon('chain', (c) => {
  c.line(16, 28, 16, 8, 2, WOOD_DARK); c.line(9, 12, 23, 12, 1, WOOD_DARK);
  c.circle(16, 6, 3.5, withAlpha(ELMO, 200)); c.circle(9, 11, 2.5, withAlpha(ELMO, 180)); c.circle(23, 11, 2.5, withAlpha(ELMO, 180));
  c.circle(16, 6, 1.5, ELMO_CORE);
});
icon('pulse', (c) => {
  c.poly([[6, 14], [22, 11], [22, 19], [6, 18]], IRON_DARK); c.ellipse(22, 15, 2, 4, IRON); c.circle(10, 20, 4, WOOD); c.circle(10, 20, 1.5, WOOD_DARK);
  c.circle(26, 15, 3, FIRE); c.circle(26, 15, 1.5, FLAME);
});
icon('lure', (c) => barrel(c, 9, 6, 14, 20));

// Enemy and Boss effects.
art('ranged/proj', 10, 6, (c) => { c.circle(2, 3, 1.5, withAlpha(POWDER, 140)); c.circle(6, 3, 2.5, IRON_DARK); c.circle(5.5, 2.5, 0.8, STEEL); });
art('boss/proj', 16, 16, (c) => c.radial(8, 8, 7, (t) => withAlpha(mixColor(hex('#e0fff4'), SPECTRE_DARK, t), 255 - t * 70)));
art('boss/telegraph_line', 64, 16, (c) => c.shade(0, 0, 63, 15, (x, y) => withAlpha(SPECTRE, 50 + 50 * Math.abs(Math.sin(x / 4)) * (1 - Math.abs(y - 8) / 8))), false);
art('boss/telegraph_ring', 128, 128, (c) => { c.ring(64, 64, 50, 62, withAlpha(SPECTRE, 90)); c.ring(64, 64, 58, 60, withAlpha(hex('#e0fff4'), 180)); }, false);
art('boss/charge', 64, 32, (c) => c.shade(0, 0, 63, 31, (x, y) => {
  const half = (x / 64) * 16;
  return Math.abs(y - 16) <= half ? withAlpha(mixColor(SPECTRE_DARK, hex('#e0fff4'), x / 64), Math.round(170 * (x / 64))) : null;
}), false);

// Pickups: doubloon / grog / compass / treasure chest.
art('pickup/xp', 12, 12, (c) => { c.circle(6, 6, 5, GOLD); c.ring(6, 6, 3.5, 4.2, GOLD_DARK); c.rect(5, 3, 2, 6, GOLD_DARK); c.rect(3, 5, 6, 2, GOLD_DARK); c.rect(3, 3, 1, 1, hex('#fff2b0')); });
art('pickup/heal', 18, 18, (c) => {
  c.rect(3, 4, 10, 13, IRON); c.rect(3, 4, 10, 2, STEEL); c.ring(14, 10, 2, 4, IRON); // pewter tankard and handle
  c.ellipse(8, 4, 5, 2, hex('#f2e6c8')); c.rect(4, 8, 1, 7, STEEL); c.rect(3, 15, 10, 2, IRON_DARK);
});
art('pickup/magnet', 22, 22, (c) => {
  c.circle(11, 11, 10, BRASS); c.circle(11, 11, 8, hex('#f4ecd4'));
  c.poly([[11, 4], [13, 11], [11, 18], [9, 11]], hex('#b9322a')); c.poly([[11, 11], [13, 11], [11, 18], [9, 11]], IRON_DARK);
  c.circle(11, 11, 1, BRASS); c.rect(10, 0, 2, 2, BRASS);
});
art('pickup/chest', 28, 24, (c) => {
  c.rect(1, 9, 26, 14, WOOD); c.ellipse(14, 9, 13, 6, hex('#9a6a3a')); c.rect(1, 9, 26, 3, WOOD_DARK);
  for (const x of [4, 22]) c.rect(x, 4, 2, 19, BRASS);
  c.rect(1, 15, 26, 2, BRASS); c.rect(12, 11, 4, 5, GOLD); c.rect(13, 13, 2, 2, INK);
  c.circle(8, 5, 1.5, GOLD); c.circle(19, 4, 1.5, GOLD); c.circle(14, 3, 1.5, hex('#fff2b0'));
});

// Tileset decorations: coiled rope, cargo crate, cannonball stack, starfish, mooring bollard, seaweed.
const DECO = [
  (c) => { for (let r = 12; r >= 3; r -= 3) { c.ring(16, 17, r - 2, r, ROPE); c.ring(16, 17, r - 1, r - 0.5, ROPE_DARK); } c.line(28, 17, 31, 26, 2, ROPE); },
  (c) => { c.rect(4, 6, 24, 22, WOOD_LIGHT); c.rect(4, 6, 24, 3, WOOD); c.line(5, 9, 27, 27, 2, WOOD); c.line(27, 9, 5, 27, 2, WOOD); c.rect(4, 6, 2, 22, WOOD_DARK); c.rect(26, 6, 2, 22, WOOD_DARK); },
  (c) => { for (const [x, y] of [[9, 23], [16, 23], [23, 23], [12.5, 17], [19.5, 17], [16, 11]]) { c.circle(x, y, 4, IRON_DARK); c.circle(x - 1, y - 1, 1.2, IRON); } },
  (c) => { const pts = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 5 : 13; pts.push([16 + Math.cos(a) * r, 17 + Math.sin(a) * r]); } c.poly(pts, hex('#e8743a')); c.circle(16, 17, 2, hex('#f6a36a')); },
  (c) => { c.ellipse(16, 26, 9, 4, hex('#2a2620')); c.rect(9, 10, 14, 16, IRON_DARK); c.ellipse(16, 10, 9, 4, IRON); c.ellipse(16, 10, 6, 2.5, IRON_DARK); c.rect(10, 12, 2, 13, IRON); c.line(24, 16, 31, 20, 2, ROPE); },
  (c) => { for (const [x, a] of [[10, -0.4], [15, 0.1], [21, 0.5]]) { c.line(x, 28, x + a * 10, 8, 2, hex('#3e6a2e')); c.line(x + a * 5, 18, x + a * 5 + 4, 15, 1, hex('#5e8a3a')); } c.ellipse(15, 28, 9, 2.5, hex('#2e4a22')); },
];
DECO.forEach((paint, i) => art(`deco/${i}`, 32, 32, paint));

const { atlas, json } = packAtlas(frames, 'sprites.png', 2048);
writePng(join(OUT, 'sprites.png'), atlas);
writeFileSync(join(OUT, 'sprites.json'), JSON.stringify(json, null, 1) + '\n');

// Dock planks and beach sand: a boardwalk runs north-south through the middle half of the tile, over
// rippled sand with pebbles and shells. The tile repeats, so the field reads as piers across a beach.
const G = 512, DOCK_X0 = 144, DOCK_X1 = 368, BOARD_H = 16;
const ground = new Canvas(G, G);
const sandNoise = tileNoise(7, 16), fine = tileNoise(13, 64), grain = tileNoise(3, 128), boardTone = lcg(21);
const boards = Array.from({ length: G / BOARD_H }, () => ({ tone: boardTone(), joint: DOCK_X0 + 20 + boardTone() * (DOCK_X1 - DOCK_X0 - 40), worn: boardTone() < 0.15 }));
ground.shade(0, 0, G - 1, G - 1, (x, y) => {
  if (x >= DOCK_X0 && x < DOCK_X1) {
    const b = boards[Math.floor(y / BOARD_H)];
    if (y % BOARD_H < 1 || Math.abs(x - b.joint) < 1) return hex('#3b2816'); // gaps and butt joints between boards
    if (x < DOCK_X0 + 6 || x >= DOCK_X1 - 6) return mixColor(hex('#4a3220'), hex('#5a3e28'), grain(x / G, y / G)); // edge beams
    const nail = ((x - DOCK_X0 - 14) % 48 < 2 || Math.abs(x - b.joint) < 4 && Math.abs(x - b.joint) > 2) && (y % BOARD_H === 7 || y % BOARD_H === 8);
    if (nail) return hex('#3a3632');
    const streak = fine(x / G, y / G * 0.25) * 0.4 + grain(x / G, y / G * 0.25) * 0.3;
    const wood = mixColor(hex('#6e4a2c'), hex('#a57a4c'), b.tone * 0.5 + streak);
    return b.worn ? mixColor(wood, hex('#9a9282'), 0.35) : wood; // a few sun-bleached boards
  }
  const ripple = Math.sin(((y + sandNoise(x / G, y / G) * 40) * Math.PI) / 8) * 0.5 + 0.5; // period 16 divides the tile, so it wraps
  const shade = (x < DOCK_X0 ? DOCK_X0 - x : x - DOCK_X1) < 10 ? 0.25 : 0; // the dock's shadow on the sand
  return mixColor(mixColor(hex('#cdb07a'), hex('#e6d2a0'), sandNoise(x / G, y / G) * 0.6 + ripple * 0.3 + fine(x / G, y / G) * 0.25), hex('#6a5436'), shade);
});
const scatter = lcg(55);
for (let i = 0; i < 180; i++) {
  const x = scatter() * G, y = scatter() * G, k = scatter();
  if (x >= DOCK_X0 - 2 && x < DOCK_X1 + 2) continue;
  if (k < 0.6) ground.blendWrap(x, y, hex('#8a7a60', 200)); // pebble
  else if (k < 0.85) { ground.blendWrap(x, y, hex('#f4ece0')); ground.blendWrap(x + 1, y, hex('#e0c8b8')); } // shell fragment
  else for (let t = 0; t < 4; t++) ground.blendWrap(x + t, y + (t % 2), hex('#4e6a34', 200)); // seaweed strand
}
writePng(join(OUT, 'ground.png'), ground);

// ------------------------------------------------------------------ audio (placeholder)

/** A squeezebox note: two detuned reedy squares with bellows swell and slight vibrato. */
function squeeze(freq, dur, vol = 0.1) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  let p1 = 0, p2 = 0, y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, f = freq * (1 + 0.004 * Math.sin(2 * Math.PI * 5 * t));
    p1 += f / RATE; p2 += (f * 1.005) / RATE;
    y += 0.2 * ((p1 % 1 < 0.5 ? 1 : -1) + (p2 % 1 < 0.5 ? 1 : -1) - y);
    out[i] = y * 0.5 * vol * Math.min(1, t / 0.04, (dur - t) / 0.08);
  }
  return out;
}

/** Waves on the shore: slow swells of low-passed noise. */
function surf(dur, vol = 0.12) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    y += 0.03 * (Math.random() * 2 - 1 - y);
    out[i] = y * vol * 6 * (0.35 + 0.65 * Math.sin((Math.PI * t) / 3.2) ** 2);
  }
  return out;
}

const clink = (seed, count) => {
  const r = lcg(seed);
  return concat(...Array.from({ length: count }, () => concat(bell(2200 + r() * 1200, 0.08, 0.12), silence(0.02 + r() * 0.04))));
};
const SFX = {
  hit: noise(0.08, 0.5, 0.15),
  pickup: bell(2600, 0.25, 0.14),
  levelUp: concat(...['D5', 'F5', 'A5'].map((n) => squeeze(hz(n), 0.14, 0.15)), squeeze(hz('D6'), 0.5, 0.15)),
  chest: mix(bell(hz('D5'), 1.2, 0.25), place(silence(1.2), clink(5, 8), 0.2)),
  playerHurt: mix(noise(0.15, 0.5, 0.08), tone(200, 90, 0.18, 'tri', 0.3)),
  bossTelegraph: mix(tone(hz('D3'), hz('C#3'), 1, 'saw', 0.12), tone(hz('A3'), hz('G#3'), 1, 'sine', 0.2)), // a ghostly, sagging horn
  win: concat(...['D4', 'F#4', 'A4', 'D5'].map((n) => squeeze(hz(n), 0.3, 0.16)), mix(squeeze(hz('D5'), 1.4, 0.16), squeeze(hz('A4'), 1.4, 0.12))),
  lose: concat(...['A4', 'F4', 'E4'].map((n) => squeeze(hz(n), 0.4, 0.14)), squeeze(hz('D4'), 1.4, 0.14)),
  fire_sweep: noise(0.14, 0.3, 0.55, 0.02),
  fire_shot: mix(noise(0.25, 0.55, 0.35), tone(140, 45, 0.15, 'sine', 0.5)),
  fire_orbit: concat(noise(0.03, 0.2, 0.7), silence(0.03), noise(0.03, 0.2, 0.7)), // chain links
  fire_aura: noise(0.25, 0.14, 0.06, 0.08),
  fire_chain: mix(tone(hz('E6'), hz('B5'), 0.3, 'sine', 0.1), concat(noise(0.03, 0.25, 0.9), noise(0.05, 0.2, 0.8))),
  fire_pulse: mix(tone(90, 30, 0.7, 'sine', 0.7), noise(0.6, 0.6, 0.12, 0.002)),
  fire_lure: mix(tone(180, 70, 0.12, 'sine', 0.4), place(silence(0.4), noise(0.3, 0.15, 0.1, 0.05), 0.1)), // thunk and slosh
};
const sprite = audioSprite(SFX);
writeFileSync(join(OUT, 'sfx.wav'), wav(sprite.samples));
writeFileSync(join(OUT, 'sfx.json'), JSON.stringify({ resources: ['sfx.wav'], spritemap: sprite.spritemap }, null, 2) + '\n');

/** A shanty: squeezebox melody over a plucked bass and chord on each beat, optionally over surf. `notes` are [name, beats]. */
function shanty(notes, chords, beat, withSurf) {
  const total = notes.reduce((s, [, b]) => s + b, 0) * beat;
  const track = new Float32Array(Math.ceil(total * RATE));
  let t = 0;
  for (const [n, b] of notes) { if (n !== '-') place(track, squeeze(hz(n), b * beat * 0.92, 0.13), t); t += b * beat; }
  const barLen = beat * 4;
  for (let bar = 0; bar * barLen < total - 0.01; bar++) {
    const [bass, ...chord] = chords[bar % chords.length];
    for (let k = 0; k < 4; k++) {
      const at = bar * barLen + k * beat;
      if (k % 2 === 0) place(track, pluck(hz(bass), beat, 0.35, 0.995), at);
      else for (const c of chord) place(track, pluck(hz(c), beat * 0.8, 0.12, 0.99), at);
    }
  }
  return withSurf ? mix(track, surf(total)) : track;
}
// "What Shall We Do with the Drunken Sailor?" (traditional) for the Run, an original lament for the menu.
const SAILOR = [
  ['A4', 1], ['A4', 0.5], ['A4', 0.5], ['A4', 1], ['A4', 0.5], ['A4', 0.5], ['A4', 1], ['D4', 1], ['F4', 1], ['A4', 1],
  ['G4', 1], ['G4', 0.5], ['G4', 0.5], ['G4', 1], ['G4', 0.5], ['G4', 0.5], ['G4', 1], ['C4', 1], ['E4', 1], ['G4', 1],
  ['A4', 1], ['A4', 0.5], ['A4', 0.5], ['A4', 1], ['A4', 0.5], ['A4', 0.5], ['A4', 1], ['B4', 1], ['C5', 1], ['D5', 1],
  ['C5', 1], ['A4', 1], ['G4', 1], ['E4', 1], ['D4', 2], ['D4', 2],
];
const SAILOR_CHORDS = [['D3', 'F4', 'A4'], ['D3', 'F4', 'A4'], ['C3', 'E4', 'G4'], ['C3', 'E4', 'G4'], ['D3', 'F4', 'A4'], ['D3', 'F4', 'A4'], ['A2', 'C#4', 'E4'], ['D3', 'F4', 'A4']];
const LAMENT = [['D4', 2], ['F4', 1], ['G4', 1], ['A4', 3], ['G4', 1], ['F4', 2], ['E4', 1], ['C4', 1], ['D4', 4],
  ['A4', 2], ['C5', 1], ['A4', 1], ['G4', 3], ['F4', 1], ['E4', 2], ['F4', 1], ['E4', 1], ['D4', 4]];
const LAMENT_CHORDS = [['D3', 'F4', 'A4'], ['C3', 'E4', 'G4'], ['A2', 'C#4', 'E4'], ['D3', 'F4', 'A4']];
writeFileSync(join(OUT, 'music-menu.wav'), wav(shanty(LAMENT, LAMENT_CHORDS, 0.5, true)));
writeFileSync(join(OUT, 'music-game.wav'), wav(shanty(SAILOR, SAILOR_CHORDS, 0.27, false)));

const CUT_SECONDS = 4;
const CUT_ROOTS = { sweep: 'D4', shot: 'E4', orbit: 'F4', aura: 'G4', chain: 'A4', pulse: 'C4', lure: 'Bb3' };
for (const w of WEAPONS) {
  const r = hz(CUT_ROOTS[w]);
  const clip = mix(surf(CUT_SECONDS, 0.1), squeeze(r, CUT_SECONDS, 0.1), place(silence(CUT_SECONDS), squeeze(r * 1.5, CUT_SECONDS - 0.4, 0.08), 0.4), place(silence(CUT_SECONDS), bell(r * 2, CUT_SECONDS - 0.8, 0.15), 0.8));
  writeFileSync(join(OUT, `cut/${w}.wav`), wav(clip));
}

// ------------------------------------------------------------------ Cutscene title cards (placeholder clips need ffmpeg)

const seaChart = (card) => {
  const n = tileNoise(43, 10), waves = lcg(8);
  card.shade(0, 0, 1279, 719, (x, y) => mixColor(hex('#e4d3a2'), hex('#b8995e'), n(x / 1280, y / 720)));
  for (let i = 0; i < 60; i++) { const x = waves() * 1280, y = 80 + waves() * 560; card.sector(x, y + 10, 8, 10, -Math.PI * 0.85, -Math.PI * 0.15, withAlpha(SEA, 90)); }
  for (const y of [40, 672]) for (let x = 40; x < 1240; x += 16) { card.rect(x, y, 12, 8, ROPE); card.rect(x + 12, y, 4, 8, ROPE_DARK); }
};
const titleCard = (weapon) => ({
  weapon,
  png: iconCard(frames.find((f) => f.name === `${weapon}/icon`).c, join(CACHE, `${ID}-card-${weapon}.png`), seaChart),
});
writePlaceholderClips(join(OUT, 'cut'), WEAPONS.map(titleCard), CUT_SECONDS);

// ------------------------------------------------------------------ pack, credits

const files = [
  { type: 'atlas', key: 'sprites', textureURL: 'sprites.png', atlasURL: 'sprites.json' },
  { type: 'image', key: 'ground', url: 'ground.png' },
  { type: 'audioSprite', key: 'sfx', jsonURL: 'sfx.json', audioURL: ['sfx.wav'] },
  { type: 'audio', key: 'music.menu', url: ['music-menu.wav'] },
  { type: 'audio', key: 'music.game', url: ['music-game.wav'] },
  ...WEAPONS.flatMap((w) => [
    { type: 'video', key: `cut.${w}`, url: [{ url: `cut/${w}.mp4`, type: 'mp4' }], noAudio: true },
    { type: 'audio', key: `cut.${w}.audio`, url: [`cut/${w}.wav`] },
  ]),
];
writeFileSync(join(OUT, 'pack.json'), JSON.stringify({ [ID]: { prefix: `${ID}.`, path: `assets/themes/${ID}/`, files } }, null, 2) + '\n');

const credits = lpc.usedCredits();
writeFileSync(join(OUT, 'CREDITS.csv'), creditsCsv(credits));
console.log(`Buccaneer Bay: ${frames.length} frames (${json.meta.size.w}x${json.meta.size.h} atlas), ${credits.length} LPC credit rows.`);
