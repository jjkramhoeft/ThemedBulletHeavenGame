// Builds the Dead Man's Gulch Theme: LPC characters (composed from the pinned generator repo) with drawn-on
// cowboy hats, face bandanas, a sheriff star, holsters and rifles, custom effect/pickup/tileset art,
// placeholder audio, credits, and placeholder Cutscenes if ffmpeg exists.
// Usage: npm run assets:gulch   (ULPC_DIR overrides the generator checkout, default .cache/ulpc)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioSprite, bell, concat, hz, mix, noise, place, pluck, RATE, silence, tone, wav } from './lib/audio.mjs';
import { iconCard, writePlaceholderClips } from './lib/cutscenes.mjs';
import { creditsCsv, crowd, FRAME, Lpc, walkFrames } from './lib/lpc.mjs';
import { eachFrame, setFrame, slingLongGun, torsoBox } from './lib/props.mjs';
import { Canvas, hex, lcg, mixColor, packAtlas, tileNoise, withAlpha, writePng } from './lib/raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'gulch';
const OUT = join(ROOT, 'public/assets/themes', ID);
const CACHE = join(ROOT, '.cache');
mkdirSync(join(OUT, 'cut'), { recursive: true });
mkdirSync(CACHE, { recursive: true });

const WEAPONS = ['sweep', 'shot', 'orbit', 'aura', 'chain', 'pulse', 'lure'];

// ------------------------------------------------------------------ LPC characters

const skin = (item, color) => ({ item, color, material: 'body' });
const HEAD = 'heads_human_male';

/**
 * Recipes for every actor slot. Items are sheet_definitions file names in the LPC generator.
 * `hat`, `bandana`, `star`, `holster` and `rifle` are drawn on afterwards (LPC has none of them).
 */
const RECIPES = {
  'shot-start': { // Bounty Hunter: long duster, stubble, neckerchief, holstered revolver
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin(HEAD, 'light'), { item: 'beards_5oclock_shadow', color: 'dark_brown' },
      { item: 'legs_pants', color: 'brown' }, { item: 'feet_boots_rim', color: 'brown' },
      { item: 'torso_clothes_longsleeve2_buttoned', color: 'tan' }, { item: 'torso_jacket_trench', color: 'dark gray' },
      { item: 'neck_scarf', color: 'red' }, { item: 'hair_plain', color: 'dark_brown' },
    ],
    hat: hex('#6b4a2e'), holster: true,
  },
  'aura-start': { // Snake-oil Doctor: top hat, frock coat, striped waistcoat, bow tie, monocle
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin(HEAD, 'light'),
      { item: 'legs_pants', color: 'gray' }, { item: 'feet_boots_basic', color: 'black' },
      { item: 'torso_clothes_longsleeve_formal', color: 'white' }, { item: 'torso_clothes_vest', color: 'green striped' },
      { item: 'torso_jacket_frock', color: 'purple' }, { item: 'neck_bowtie', color: 'red' },
      { item: 'hair_parted', color: 'black' }, { item: 'beards_chevron', color: 'black' },
      { item: 'facial_monocle_left', color: 'gold' }, { item: 'hat_formal_tophat', color: 'black' },
    ],
  },
  swarmer: { // Bandits: red bandana over the face, vest, battered hat
    body: 'male',
    layers: [
      { item: 'body', color: 'olive' }, skin(HEAD, 'olive'),
      { item: 'legs_pants', color: 'tan' }, { item: 'feet_boots_basic', color: 'brown' },
      { item: 'torso_clothes_longsleeve', color: 'maroon' }, { item: 'torso_clothes_vest', color: 'brown' },
      { item: 'hair_plain', color: 'black' },
    ],
    hat: hex('#8a6a44'), bandana: hex('#b8322a'),
  },
  fragment: { // Lone Outlaws (the Outlaw Posse below is three of these): all in black
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin(HEAD, 'light'),
      { item: 'legs_pants', color: 'black' }, { item: 'feet_boots_rim', color: 'black' },
      { item: 'torso_clothes_longsleeve2_buttoned', color: 'charcoal' }, { item: 'torso_clothes_vest', color: 'black' },
      { item: 'hair_plain', color: 'dark_brown' },
    ],
    hat: hex('#2a2426'), bandana: hex('#3a3a44'), holster: true,
  },
  tank: { // Hired Strongman: bald, handlebar moustache, suspenders (scaled up in theme.json)
    body: 'muscular',
    layers: [
      { item: 'body', color: 'light' }, skin(HEAD, 'light'),
      { item: 'legs_widepants', color: 'charcoal' }, { item: 'feet_boots_basic', color: 'black' },
      { item: 'torso_aprons_suspenders', color: 'red' }, { item: 'arms_bracers', color: 'iron' },
      { item: 'beards_handlebar', color: 'black' },
    ],
  },
  ranged: { // Rifleman on a Rooftop: rifle slung on the back
    body: 'male',
    layers: [
      { item: 'body', color: 'amber' }, skin(HEAD, 'amber'), { item: 'beards_mustache', color: 'sandy' },
      { item: 'legs_pants', color: 'tan' }, { item: 'feet_boots_rim', color: 'brown' },
      { item: 'torso_clothes_longsleeve2_buttoned', color: 'blue' }, { item: 'torso_clothes_vest', color: 'leather' },
      { item: 'hair_plain', color: 'sandy' },
    ],
    hat: hex('#c2a070'), rifle: true,
  },
  boss: { // The Undead Sheriff: a zombie in a duster with his star still pinned on (scaled up in theme.json)
    body: 'male',
    layers: [
      { item: 'body_zombie', variant: 'zombie' }, skin('heads_zombie', 'zombie'),
      { item: 'legs_pants', color: 'charcoal' }, { item: 'feet_boots_rim', color: 'black' },
      { item: 'torso_clothes_longsleeve2_buttoned', color: 'white' }, { item: 'torso_clothes_vest', color: 'black' },
      { item: 'torso_jacket_trench', color: 'gray' }, { item: 'hair_plain', color: 'gray' },
    ],
    hat: hex('#1e1a1c'), star: true, holster: true,
  },
};

const INK = hex('#1a0f08');
const GOLD = hex('#f0c040'), GOLD_DARK = hex('#a8791c');
const LEATHER = hex('#5a3a1e'), GUNMETAL = hex('#34373e');

/**
 * A cowboy hat (the cavalier is LPC's nearest), drawn over the head in every frame: a pinched crown over
 * a wide brim, seen edge-on from the side. `head` is a sheet of only the head layer, which locates it.
 */
function addHats(sheet, head, color) {
  const band = mixColor(color, INK, 0.55), light = mixColor(color, hex('#ffffff'), 0.25);
  eachFrame((dir, ox, oy) => {
    const box = head.crop(ox, oy, FRAME, FRAME).bbox(128);
    if (!box) return;
    const cx = (box.x0 + box.x1 + 1) / 2, top = box.y0;
    const hat = new Canvas(FRAME, FRAME);
    if (dir === 'down' || dir === 'up') {
      hat.ellipse(cx, top + 6, 15, 3.5, color); // brim
      hat.poly([[cx - 7, top + 6], [cx - 6, top - 3], [cx - 1, top - 1], [cx + 1, top - 1], [cx + 6, top - 3], [cx + 7, top + 6]], color); // pinched crown
      hat.rect(cx - 7, top + 3, 14, 2, band);
      hat.line(cx - 5, top - 1, cx - 5, top + 2, 1, light);
    } else {
      const s = dir === 'right' ? 1 : -1;
      hat.ellipse(cx + s * 1, top + 6, 14, 2.5, color);
      hat.poly([[cx - 6, top + 6], [cx - 6 + s * 1, top - 2], [cx + 6 + s * 1, top - 3], [cx + 6, top + 6]], color);
      hat.rect(cx - 6, top + 3, 13, 2, band);
    }
    hat.outline(withAlpha(INK, 210));
    setFrame(sheet, ox, oy, sheet.crop(ox, oy, FRAME, FRAME).draw(hat));
  });
}

/**
 * A bandana over the lower face: every visible head pixel below the eyes is recoloured to `color` with
 * a dotted print, plus a point that hangs over the neck. Facing up only the knot shows.
 */
function addBandanas(sheet, head, color) {
  const dark = mixColor(color, INK, 0.35), dot = mixColor(color, hex('#ffffff'), 0.55);
  eachFrame((dir, ox, oy) => {
    const box = head.crop(ox, oy, FRAME, FRAME).bbox(128);
    if (!box) return;
    const from = box.y0 + Math.round((box.y1 - box.y0) * 0.68);
    const cx = Math.round((box.x0 + box.x1) / 2);
    if (dir === 'up') {
      sheet.rect(ox + cx - 1, oy + from, 3, 2, dark);
      return;
    }
    for (let y = from; y <= box.y1; y++)
      for (let x = box.x0; x <= box.x1; x++) {
        const p = sheet.get(ox + x, oy + y), h = head.get(ox + x, oy + y);
        if (!h[3] || p[0] !== h[0] || p[1] !== h[1] || p[2] !== h[2]) continue; // only where the face shows
        const shade = y === from ? dark : x % 3 === 0 && y % 3 === 0 ? dot : color;
        sheet.px.set([shade[0], shade[1], shade[2], 255], ((oy + y) * sheet.w + ox + x) * 4);
      }
    const tip = dir === 'down' ? cx : cx + (dir === 'right' ? 2 : -2);
    const point = new Canvas(FRAME, FRAME);
    point.poly([[tip - 3, box.y1], [tip + 3, box.y1], [tip, box.y1 + 4]], color);
    setFrame(sheet, ox, oy, sheet.crop(ox, oy, FRAME, FRAME).draw(point));
  });
}

/** A five-pointed tin star on the chest, or a holstered revolver on the hip, anchored to the torso. */
function addChestAndHip(sheet, body, { star, holster }) {
  eachFrame((dir, ox, oy) => {
    const box = torsoBox(body, ox, oy);
    if (!box) return;
    const overlay = new Canvas(FRAME, FRAME);
    if (star && dir !== 'up') {
      const sx = dir === 'down' ? box.cx - 4 : dir === 'right' ? box.x1 - 3 : box.x0 + 3, sy = box.y0 + 5;
      const pts = [];
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 1.3 : 3.2; pts.push([sx + Math.cos(a) * r, sy + Math.sin(a) * r]); }
      overlay.poly(pts, GOLD);
      overlay.rect(sx - 0.5, sy - 0.5, 1, 1, GOLD_DARK);
    }
    if (holster) {
      const side = { down: 1, up: -1, left: 0, right: 0 }[dir];
      const hx = side ? box.cx + side * 8 : box.cx + (dir === 'right' ? -1 : 1), hy = box.y1 - 2;
      overlay.rect(hx - 1, hy, 3, 6, LEATHER);
      overlay.rect(hx - 1, hy - 2, 3, 2, GUNMETAL); // the grip
    }
    overlay.outline(withAlpha(INK, 180));
    setFrame(sheet, ox, oy, sheet.crop(ox, oy, FRAME, FRAME).draw(overlay));
  });
}

const lpc = new Lpc(process.env.ULPC_DIR ?? join(CACHE, 'ulpc'));
const frames = [];
for (const [actor, recipe] of Object.entries(RECIPES)) {
  const sheet = lpc.compose(recipe);
  const heads = recipe.layers.map((l) => l.item).filter((item) => item.startsWith('head'));
  const bodies = recipe.layers.map((l) => l.item).filter((item) => item.startsWith('body'));
  if (recipe.bandana) addBandanas(sheet, lpc.composeOnly(recipe, heads), recipe.bandana);
  if (recipe.star || recipe.holster) addChestAndHip(sheet, lpc.composeOnly(recipe, bodies), recipe);
  if (recipe.rifle) slingLongGun(sheet, lpc.composeOnly(recipe, bodies), { stock: hex('#7a4a26'), stockDark: hex('#4a2c14'), barrel: GUNMETAL, strap: LEATHER, ink: INK });
  if (recipe.hat) addHats(sheet, lpc.composeOnly(recipe, heads), recipe.hat);
  writePng(join(CACHE, `${ID}-${actor}.png`), sheet); // for inspection
  frames.push(...walkFrames(actor, sheet));
  if (actor === 'fragment') { const c = crowd(sheet); frames.push(...walkFrames('splitter', c.sheet, c.width)); } // the Outlaw Posse
}

// ------------------------------------------------------------------ custom art (effects, pickups, tileset)

const art = (name, w, h, paint, outline = true) => {
  const c = new Canvas(w, h);
  paint(c);
  if (outline) c.outline(withAlpha(INK, 220));
  frames.push({ name, c });
  return c;
};

const ROPE = hex('#c9a468'), ROPE_DARK = hex('#8a6a3a'), DUST = hex('#c89a64'), DUST_LIGHT = hex('#ecd2a4');
const IRON = hex('#7a7e86'), IRON_DARK = hex('#44474e'), STEEL = hex('#c9ced6'), BRASS = hex('#d4a640');
const FIRE = hex('#ff7a22'), FLAME = hex('#ffd060'), COPPER = hex('#c8743a'), SPARK = hex('#fff3a0');
const WHISKEY = hex('#b8641c'), GLASS = hex('#e8b060'), BONE = hex('#eee4cc'), BONE_SHADE = hex('#b8a888');
const SAGE = hex('#7c8a5a'), SAGE_DARK = hex('#4e5a36'), CACTUS = hex('#5a8a4a'), CACTUS_DARK = hex('#3a5e32');
const UNDEAD = hex('#b6f25a'), UNDEAD_DARK = hex('#3f5d22'), WOOD = hex('#8a5a2e'), WOOD_DARK = hex('#56361b');

// Lasso Crack: a rope crescent with a white snap at the tip, pointing right.
art('sweep/arc', 128, 128, (c) => {
  c.shade(0, 0, 127, 127, (x, y) => {
    const d = Math.hypot(x - 64, y - 64), a = Math.atan2(y - 64, x - 64);
    if (Math.abs(a) > 1.22) return null;
    const fade = Math.min(1, (1 - Math.abs(a) / 1.22) * 2.5);
    if (d >= 58 && d <= 62) return withAlpha(d > 60 ? ROPE : ROPE_DARK, Math.round(240 * fade));
    if (d >= 40 && d < 58) return withAlpha(DUST_LIGHT, Math.round(50 * fade * ((d - 40) / 18))); // motion blur
    return null;
  });
  c.circle(125, 64, 2.5, SPARK); c.line(118, 60, 126, 56, 1, hex('#ffffff')); c.line(118, 68, 126, 72, 1, hex('#ffffff'));
}, false);
// Revolver round, pointing right.
art('shot/proj', 12, 6, (c) => { c.line(0, 3, 5, 3, 1, withAlpha(FLAME, 140)); c.rect(5, 1, 4, 4, BRASS); c.ellipse(9, 3, 2.5, 2, hex('#8a8e96')); c.rect(5, 1, 4, 1, hex('#fff0b0')); });
// Spinning horseshoe.
art('orbit/blade', 18, 18, (c) => {
  c.sector(9, 8, 4, 7.5, -Math.PI, 0, IRON); c.rect(1.5, 8, 3.5, 7, IRON); c.rect(13, 8, 3.5, 7, IRON);
  for (const [x, y] of [[3, 11], [15, 11], [4, 5], [14, 5], [9, 2]]) c.rect(x - 0.5, y - 0.5, 1, 1, IRON_DARK);
  c.sector(9, 8, 6, 7.5, -Math.PI * 0.9, -Math.PI * 0.55, STEEL);
});
// Dust Devil: a swirl of tan dust with spiral streaks and a faint rim.
const dust = tileNoise(29, 6);
art('aura/field', 128, 128, (c) => c.radial(64, 64, 62, (t, x, y) => {
  const a = Math.atan2(y - 64, x - 64), spiral = Math.sin(a * 3 + t * 14) * 0.5 + 0.5, n = dust(x / 128, y / 128);
  const alpha = t > 0.93 ? 130 : 25 + 75 * (spiral * 0.6 + n * 0.4) * (1 - t * 0.4);
  return withAlpha(mixColor(DUST, DUST_LIGHT, spiral), Math.round(alpha));
}), false);
// Telegraph-wire Spark: a copper wire with a jagged yellow arc along it.
art('chain/bolt', 64, 8, (c) => {
  c.line(0, 4, 64, 4, 1, COPPER);
  const r = lcg(17);
  let y = 4;
  for (let x = 0; x < 64; x += 4) { const ny = 1.5 + r() * 5; c.line(x, y, x + 4, ny, 2, withAlpha(FLAME, 170)); c.line(x, y, x + 4, ny, 1, SPARK); y = ny; }
}, false);
// Dynamite Blast: a fire ring inside a dust ring, with flying debris.
art('pulse/ring', 128, 128, (c) => {
  c.ring(64, 64, 49, 62, withAlpha(DUST, 120));
  c.ring(64, 64, 54, 60, withAlpha(FIRE, 210));
  c.ring(64, 64, 56, 58, withAlpha(FLAME, 240));
  const r = lcg(23);
  for (let i = 0; i < 16; i++) { const a = r() * Math.PI * 2, d = 44 + r() * 16; c.rect(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2, 2, withAlpha(WOOD_DARK, 220)); }
}, false);
// Whiskey bottle.
const bottle = (c, x, y, s = 1) => {
  c.rect(x + 3 * s, y, 2 * s, 5 * s, GLASS); c.rect(x + 3 * s, y, 2 * s, 1.5 * s, hex('#6a4a2a')); // neck and cork
  c.rect(x, y + 5 * s, 8 * s, 12 * s, WHISKEY); c.rect(x + 1 * s, y + 8 * s, 6 * s, 5 * s, hex('#efe4c4')); // body and label
  c.rect(x + 2 * s, y + 10 * s, 4 * s, 1 * s, hex('#8a2a1a')); c.rect(x + 1 * s, y + 6 * s, 1 * s, 10 * s, withAlpha(hex('#ffe0a0'), 160));
};
art('lure/bait', 12, 20, (c) => bottle(c, 2, 1));

/** 32 px icon on a WANTED-poster square: aged paper, a dark frame and a nail at the top. */
const icon = (weapon, paint) => art(`${weapon}/icon`, 32, 32, (c) => {
  c.rect(1, 1, 30, 30, hex('#6a4a2a'));
  c.rect(3, 3, 26, 26, hex('#e6cf9c'));
  c.rect(3, 26, 26, 3, hex('#cdb07a')); c.rect(3, 3, 3, 3, hex('#cdb07a'));
  c.circle(16, 4, 1.2, IRON_DARK);
  paint(c);
});
icon('sweep', (c) => { c.ring(13, 15, 5, 7, ROPE); c.ring(13, 15, 5.5, 6, ROPE_DARK); c.line(19, 17, 27, 24, 2, ROPE); c.circle(27, 24, 1.5, SPARK); });
icon('shot', (c) => {
  c.rect(8, 11, 15, 4, IRON_DARK); c.rect(8, 11, 15, 1, IRON); c.circle(13, 14, 3.5, IRON); c.circle(13, 14, 1.5, IRON_DARK); // barrel and cylinder
  c.poly([[8, 14], [12, 16], [10, 24], [6, 23]], WOOD); c.line(12, 17, 14, 19, 1, IRON_DARK);
});
icon('orbit', (c) => { c.sector(16, 14, 5, 9, -Math.PI, 0, IRON); c.rect(7, 14, 4, 8, IRON); c.rect(21, 14, 4, 8, IRON); c.sector(16, 14, 7.5, 9, -Math.PI * 0.9, -Math.PI * 0.55, STEEL); });
icon('aura', (c) => { for (let k = 0; k < 5; k++) c.ellipse(16 + (k % 2 ? 2 : -2), 8 + k * 4, 9 - k * 1.4, 2, withAlpha(k % 2 ? DUST : hex('#a07a4a'), 220)); });
icon('chain', (c) => {
  c.rect(8, 6, 2, 22, WOOD); c.rect(5, 9, 8, 2, WOOD); c.rect(22, 6, 2, 22, WOOD); c.rect(19, 9, 8, 2, WOOD);
  c.line(9, 10, 23, 12, 1, COPPER); c.line(13, 11, 16, 15, 1, SPARK); c.line(16, 15, 18, 12, 1, SPARK); c.circle(16, 15, 1.5, withAlpha(FLAME, 200));
});
icon('pulse', (c) => { for (const x of [11, 15, 19]) { c.rect(x - 1.5, 11, 3.5, 14, hex('#c0392b')); c.rect(x - 1.5, 13, 3.5, 1, hex('#e8d0a0')); } c.line(15, 11, 19, 6, 1, hex('#3a2a1a')); c.circle(19, 5, 1.8, FLAME); });
icon('lure', (c) => bottle(c, 12, 6, 1.1));

// Enemy and Boss effects.
art('ranged/proj', 10, 5, (c) => { c.line(0, 2.5, 4, 2.5, 1, withAlpha(FLAME, 130)); c.rect(4, 1, 3, 3, BRASS); c.ellipse(7, 2.5, 2, 1.5, IRON); });
art('boss/proj', 16, 16, (c) => c.radial(8, 8, 7, (t) => withAlpha(mixColor(hex('#f4ffc8'), UNDEAD_DARK, t), 255 - t * 60)));
art('boss/telegraph_line', 64, 16, (c) => c.shade(0, 0, 63, 15, (x, y) => withAlpha(UNDEAD, 55 + 50 * Math.abs(Math.sin(x / 5)) * (1 - Math.abs(y - 8) / 8))), false);
art('boss/telegraph_ring', 128, 128, (c) => { c.ring(64, 64, 50, 62, withAlpha(UNDEAD, 90)); c.ring(64, 64, 58, 60, withAlpha(hex('#f4ffc8'), 170)); }, false);
art('boss/charge', 64, 32, (c) => c.shade(0, 0, 63, 31, (x, y) => {
  const half = (x / 64) * 16;
  return Math.abs(y - 16) <= half ? withAlpha(mixColor(DUST, hex('#f4ffc8'), x / 64), Math.round(170 * (x / 64))) : null; // a cloud of grave dust
}), false);

// Pickups: gold nugget / can of beans / horseshoe magnet / strongbox.
art('pickup/xp', 12, 12, (c) => { c.poly([[2, 7], [4, 3], [8, 2], [10, 5], [9, 9], [5, 10]], hex('#e8b830')); c.poly([[4, 4], [7, 3], [6, 6]], hex('#fff0a0')); c.rect(7, 7, 2, 2, hex('#b08018')); });
art('pickup/heal', 16, 18, (c) => {
  c.rect(2, 2, 12, 14, hex('#b8bcc4')); c.ellipse(8, 2, 6, 1.5, STEEL); c.ellipse(8, 16, 6, 1.5, IRON);
  c.rect(2, 6, 12, 7, hex('#c0392b')); c.ellipse(8, 9.5, 3, 2, hex('#e8a040')); c.rect(3, 3, 1, 12, withAlpha(hex('#ffffff'), 110));
});
art('pickup/magnet', 22, 22, (c) => { // a horseshoe painted as a magnet
  c.sector(11, 10, 5, 9, -Math.PI, 0, hex('#c0392b')); c.rect(2, 10, 4, 7, hex('#c0392b')); c.rect(16, 10, 4, 7, hex('#c0392b'));
  c.rect(2, 16, 4, 4, STEEL); c.rect(16, 16, 4, 4, STEEL);
  for (const [x, y] of [[4, 12], [18, 12], [5, 5], [17, 5]]) c.rect(x - 0.5, y - 0.5, 1, 1, hex('#7a1a14'));
});
art('pickup/chest', 28, 22, (c) => { // an express-company strongbox
  c.rect(1, 5, 26, 16, hex('#3e5a3a')); c.rect(1, 3, 26, 5, hex('#4e6e48'));
  c.rect(1, 7, 26, 2, IRON_DARK); for (const x of [3, 23]) c.rect(x, 3, 2, 18, IRON_DARK);
  c.rect(11, 9, 6, 7, BRASS); c.rect(13, 12, 2, 2, INK); c.rect(7, 16, 14, 2, hex('#c9a13a'));
});

// Tileset decorations: tumbleweed, cattle skull, small cactus, sagebrush, rocks, half-buried wagon wheel.
const DECO = [
  (c) => {
    const r = lcg(31);
    c.circle(16, 17, 11, withAlpha(hex('#a0804a'), 90));
    for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, b = a + 1 + r() * 2; c.line(16 + Math.cos(a) * 11, 17 + Math.sin(a) * 11, 16 + Math.cos(b) * 10, 17 + Math.sin(b) * 10, 1, i % 3 ? hex('#a0804a') : hex('#6e5430')); }
  },
  (c) => {
    c.ellipse(16, 18, 7, 8, BONE); c.ellipse(16, 24, 4, 3, BONE_SHADE); // skull and snout
    c.poly([[10, 13], [2, 9], [1, 5], [5, 9], [11, 11]], BONE); c.poly([[22, 13], [30, 9], [31, 5], [27, 9], [21, 11]], BONE); // horns
    c.circle(13, 17, 1.8, INK); c.circle(19, 17, 1.8, INK); c.rect(15, 24, 1, 2, INK); c.rect(17, 24, 1, 2, INK);
  },
  (c) => {
    c.ellipse(16, 28, 7, 2, hex('#8a6a44'));
    c.rect(13, 6, 6, 22, CACTUS); c.circle(16, 6, 3, CACTUS); c.rect(6, 12, 4, 8, CACTUS); c.rect(6, 18, 8, 3, CACTUS); c.rect(22, 9, 4, 8, CACTUS); c.rect(18, 15, 8, 3, CACTUS);
    c.rect(15, 7, 1, 20, CACTUS_DARK); c.circle(16, 4, 1.5, hex('#e85a8a'));
  },
  (c) => { const r = lcg(41); for (let i = 0; i < 14; i++) c.ellipse(6 + r() * 20, 12 + r() * 12, 4, 3, i % 2 ? SAGE : SAGE_DARK); c.line(14, 26, 14, 30, 1, hex('#6e5430')); c.line(18, 26, 19, 30, 1, hex('#6e5430')); },
  (c) => { c.ellipse(12, 20, 9, 7, hex('#9a7a5a')); c.ellipse(22, 23, 7, 5, hex('#86684a')); c.ellipse(10, 17, 4, 2, hex('#bca080')); c.ellipse(21, 21, 3, 1.5, hex('#a88a6a')); },
  (c) => {
    c.ring(16, 16, 11, 14, WOOD); c.circle(16, 16, 3.5, WOOD_DARK); c.ring(16, 16, 13, 14, IRON_DARK);
    for (let a = 0; a < 7; a++) c.line(16, 16, 16 + Math.cos(a * 0.9 + 0.3) * 12, 16 + Math.sin(a * 0.9 + 0.3) * 12, 2, WOOD);
    c.rect(3, 22, 12, 4, hex('#b88a58')); // sand drifted over it
  },
];
DECO.forEach((paint, i) => art(`deco/${i}`, 32, 32, paint));

const { atlas, json } = packAtlas(frames, 'sprites.png', 2048);
writePng(join(OUT, 'sprites.png'), atlas);
writeFileSync(join(OUT, 'sprites.json'), JSON.stringify(json, null, 1) + '\n');

// Desert dirt: sun-baked, with dry-lake patches cracked into plates (a wrapped Voronoi), two faint wagon
// ruts, stones and scrub tufts. A large seamless tile so repeats aren't obvious.
const G = 512;
const ground = new Canvas(G, G);
const soil = tileNoise(9, 8), fine = tileNoise(15, 64), lakes = tileNoise(33, 4);
const seeds = lcg(61), CELLS = Array.from({ length: 140 }, () => [seeds() * G, seeds() * G]);
const wrapDelta = (d) => ((d + G * 1.5) % G) - G / 2; // shortest offset across the tile's wrap
/** Distance from (x, y) to the nearest edge between two cracked plates: the bisector of the two nearest seeds. */
function crackDistance(x, y) {
  let a = null, b = null;
  for (const [cx, cy] of CELLS) {
    const dx = wrapDelta(cx - x), dy = wrapDelta(cy - y), d = dx * dx + dy * dy;
    if (!a || d < a.d) { b = a; a = { dx, dy, d }; } else if (!b || d < b.d) b = { dx, dy, d };
  }
  return (b.d - a.d) / (2 * Math.hypot(b.dx - a.dx, b.dy - a.dy));
}
ground.shade(0, 0, G - 1, G - 1, (x, y) => {
  const u = x / G, v = y / G, lake = lakes(u, v);
  const col = mixColor(hex('#b07a48'), hex('#d4a468'), soil(u, v) * 0.65 + fine(u, v) * 0.35);
  if (lake <= 0.55) return col;
  const strength = Math.min(1, (lake - 0.55) * 5);
  const dried = mixColor(col, hex('#e0c49a'), strength * 0.6); // pale, dried mud
  return crackDistance(x, y) < 0.9 ? mixColor(dried, hex('#6a4426'), strength) : dried; // cracks between plates
});
const scatter = lcg(73);
for (let i = 0; i < 220; i++) {
  const x = scatter() * G, y = scatter() * G, k = scatter();
  if (k < 0.55) ground.blendWrap(x, y, withAlpha(hex('#7a5a3a'), 200)); // pebble
  else if (k < 0.7) { ground.blendWrap(x, y, hex('#e8d4b0')); ground.blendWrap(x + 1, y, hex('#c8a880')); } // pale stone
  else if (k < 0.9) for (let t = 0; t < 5; t++) ground.blendWrap(x + t - 2, y - Math.abs(t - 2), withAlpha(t % 2 ? SAGE : SAGE_DARK, 220)); // scrub tuft
}
for (const rx of [100, 124]) // wagon ruts, winding once per tile so they wrap
  for (let y = 0; y < G; y++)
    for (let w = 0; w < 5; w++) ground.blendWrap(rx + w + Math.sin((y / G) * Math.PI * 2) * 10, y, withAlpha(hex('#8a5e36'), w === 0 || w === 4 ? 30 : 60));
writePng(join(OUT, 'ground.png'), ground);

// ------------------------------------------------------------------ audio (placeholder)

/** A whistled note: a sine with delayed vibrato and a breathy edge. */
function whistle(freq, dur, vol = 0.18) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, vib = 1 + 0.012 * Math.sin(2 * Math.PI * 6 * t) * Math.min(1, t / 0.3);
    p += (freq * vib) / RATE;
    out[i] = (Math.sin(2 * Math.PI * p) + (Math.random() - 0.5) * 0.04) * vol * Math.min(1, t / 0.05, (dur - t) / 0.1);
  }
  return out;
}

/** A harmonica note: a reedy pulse wave that bends up into pitch. */
function harmonica(freq, dur, vol = 0.1) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  let p = 0, y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    p += (freq * (1 - 0.02 * Math.max(0, 1 - t / 0.08))) / RATE;
    y += 0.25 * ((p % 1 < 0.3 ? 1 : -0.43) - y);
    out[i] = y * vol * Math.min(1, t / 0.03, (dur - t) / 0.06);
  }
  return out;
}

const coins = (freqs) => concat(...freqs.map((f) => concat(bell(f, 0.1, 0.1), silence(0.05))));
const SFX = {
  hit: noise(0.07, 0.5, 0.18),
  pickup: concat(bell(2400, 0.08, 0.12), bell(3000, 0.2, 0.12)),
  levelUp: concat(...['A3', 'C#4', 'E4'].map((n) => pluck(hz(n), 0.14, 0.4, 0.995)), pluck(hz('A4'), 0.7, 0.45, 0.998)),
  chest: mix(tone(120, 60, 0.15, 'sine', 0.6), noise(0.1, 0.3, 0.3), place(silence(1.2), coins([2600, 2900, 2400, 3100, 2700]), 0.25)),
  playerHurt: mix(noise(0.15, 0.5, 0.08), tone(190, 90, 0.18, 'tri', 0.3)),
  bossTelegraph: bell(hz('C3'), 1.2, 0.45), // the toll of a ghost-town bell
  win: concat(...['A3', 'C#4', 'E4', 'A4'].map((n) => harmonica(hz(n), 0.25, 0.12)), mix(harmonica(hz('A4'), 1.4, 0.12), pluck(hz('A2'), 1.4, 0.4, 0.998))),
  lose: concat(tone(hz('E3'), hz('Eb3'), 0.4, 'saw', 0.15), tone(hz('D3'), hz('Db3'), 0.4, 'saw', 0.15), tone(hz('C3'), hz('A2'), 1.4, 'saw', 0.15)), // a sad trombone
  fire_sweep: mix(noise(0.12, 0.2, 0.3, 0.05), place(silence(0.14), noise(0.02, 0.6, 0.95), 0.11)), // swish and crack
  fire_shot: mix(noise(0.14, 0.6, 0.7), tone(150, 50, 0.1, 'sine', 0.5), place(silence(0.4), tone(2200, 1300, 0.25, 'sine', 0.06), 0.12)), // bang and ricochet
  fire_orbit: bell(1500, 0.12, 0.12),
  fire_aura: noise(0.3, 0.14, 0.05, 0.12),
  fire_chain: concat(tone(900, 900, 0.03, 'square', 0.1), silence(0.03), tone(900, 900, 0.03, 'square', 0.1), noise(0.08, 0.3, 0.9)), // telegraph clicks and a zap
  fire_pulse: mix(tone(80, 28, 0.8, 'sine', 0.7), noise(0.7, 0.6, 0.1, 0.002)),
  fire_lure: concat(bell(1800, 0.1, 0.1), noise(0.25, 0.12, 0.1, 0.05)), // glass clink and slosh
};
const sprite = audioSprite(SFX);
writeFileSync(join(OUT, 'sfx.wav'), wav(sprite.samples));
writeFileSync(join(OUT, 'sfx.json'), JSON.stringify({ resources: ['sfx.wav'], spritemap: sprite.spritemap }, null, 2) + '\n');

/**
 * A western: a lead line over guitar. With `gallop` the guitar plays boom-chicka-chicka on every beat,
 * otherwise it picks a slow arpeggio. `chords` are [bass, ...chord] per four-beat bar; `melody` is [name, beats].
 */
function western(melody, chords, beat, lead, gallop) {
  const track = new Float32Array(Math.ceil(chords.length * beat * 4 * RATE));
  chords.forEach(([bass, ...chord], bar) => {
    for (let b = 0; b < 4; b++) {
      const at = (bar * 4 + b) * beat;
      if (gallop) {
        place(track, pluck(hz(bass), beat, 0.4, 0.99), at);
        for (const f of [0.5, 0.75]) for (const n of chord) place(track, pluck(hz(n), beat * 0.25, 0.1, 0.97), at + f * beat);
      } else {
        if (b === 0) place(track, pluck(hz(bass), beat * 4, 0.35, 0.998), at);
        place(track, pluck(hz(chord[b % chord.length]), beat * 2, 0.16, 0.997), at);
        place(track, pluck(hz(chord[(b + 1) % chord.length]), beat * 1.5, 0.12, 0.997), at + beat / 2);
      }
    }
  });
  let t = 0;
  for (const [n, b] of melody) { if (n !== '-') place(track, lead(hz(n), b * beat * 0.95), t); t += b * beat; }
  return track;
}
const MENU_CHORDS = [['A2', 'A3', 'C4', 'E4'], ['A2', 'A3', 'C4', 'E4'], ['G2', 'G3', 'B3', 'D4'], ['F2', 'F3', 'A3', 'C4'],
  ['E2', 'E3', 'G#3', 'B3'], ['E2', 'E3', 'G#3', 'B3'], ['A2', 'A3', 'C4', 'E4'], ['A2', 'A3', 'C4', 'E4']];
const MENU = [['A4', 1], ['E5', 3], ['D5', 1], ['C5', 1], ['B4', 1], ['A4', 1], ['G4', 3], ['D5', 1], ['C5', 3], ['A4', 1],
  ['G#4', 4], ['B4', 2], ['E5', 2], ['A4', 6], ['-', 2]];
const GAME_CHORDS = [['A2', 'A3', 'C4', 'E4'], ['D3', 'D4', 'F4', 'A4'], ['E2', 'E3', 'G#3', 'B3'], ['A2', 'A3', 'C4', 'E4']];
const GAME = [['E4', 0.5], ['A4', 0.5], ['C5', 1], ['B4', 0.5], ['A4', 0.5], ['D5', 1.5], ['C5', 0.5], ['A4', 1], ['F4', 1],
  ['E4', 0.5], ['G#4', 0.5], ['B4', 1], ['E5', 1], ['D5', 0.5], ['B4', 0.5], ['A4', 3]];
writeFileSync(join(OUT, 'music-menu.wav'), wav(western(MENU, MENU_CHORDS, 0.5, whistle, false)));
writeFileSync(join(OUT, 'music-game.wav'), wav(western(GAME, GAME_CHORDS, 0.36, harmonica, true)));

const CUT_SECONDS = 4;
const CUT_ROOTS = { sweep: 'A3', shot: 'B3', orbit: 'C4', aura: 'D4', chain: 'E4', pulse: 'F3', lure: 'G3' };
for (const w of WEAPONS) {
  const r = hz(CUT_ROOTS[w]);
  const clip = mix(
    pluck(r / 2, CUT_SECONDS, 0.4, 0.9995),
    place(silence(CUT_SECONDS), whistle(r * 2, CUT_SECONDS - 0.6, 0.14), 0.3),
    place(silence(CUT_SECONDS), pluck(r * 1.5, CUT_SECONDS - 1, 0.25, 0.999), 0.9),
    noise(CUT_SECONDS, 0.04, 0.03, 1), // desert wind
  );
  writeFileSync(join(OUT, `cut/${w}.wav`), wav(clip));
}

// ------------------------------------------------------------------ Cutscene title cards (placeholder clips need ffmpeg)

const sunset = (card) => {
  card.shade(0, 0, 1279, 719, (x, y) => (y < 470 ? mixColor(hex('#3a1e4a'), hex('#f0a040'), y / 470) : mixColor(hex('#b06a38'), hex('#6a3a20'), (y - 470) / 250)));
  card.circle(640, 470, 120, withAlpha(hex('#ffd070'), 200));
  for (const [x0, x1, h] of [[0, 330, 90], [880, 1280, 130], [300, 460, 50]]) card.rect(x0, 470 - h, x1 - x0, h + 2, hex('#4a2418')); // mesas
  for (const y of [36, 668]) { card.rect(36, y, 1208, 16, WOOD); card.rect(36, y + 6, 1208, 2, WOOD_DARK); }
};
const titleCard = (weapon) => ({
  weapon,
  png: iconCard(frames.find((f) => f.name === `${weapon}/icon`).c, join(CACHE, `${ID}-card-${weapon}.png`), sunset),
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
console.log(`Dead Man's Gulch: ${frames.length} frames (${json.meta.size.w}x${json.meta.size.h} atlas), ${credits.length} LPC credit rows.`);
