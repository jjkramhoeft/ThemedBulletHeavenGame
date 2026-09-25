// Builds the Suburban Outbreak Theme: LPC characters (composed from the pinned generator repo, zombies from
// its zombie body) with a drawn Bloater body, legless Crawlers, riot gear, paramedic markings and the
// Mayor's mutations, custom effect/pickup/tileset art, placeholder audio, credits, and placeholder
// Cutscenes if ffmpeg exists.
// Usage: npm run assets:suburban   (ULPC_DIR overrides the generator checkout, default .cache/ulpc)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioSprite, bell, concat, hz, mix, noise, place, RATE, silence, tone, wav } from './lib/audio.mjs';
import { iconCard, writePlaceholderClips } from './lib/cutscenes.mjs';
import { creditsCsv, DIRS, FRAME, Lpc, walkFrames, WALK_FRAMES } from './lib/lpc.mjs';
import { eachFrame, setFrame, torsoBox } from './lib/props.mjs';
import { Canvas, hex, lcg, mixColor, packAtlas, tileNoise, withAlpha, writePng } from './lib/raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'suburban';
const OUT = join(ROOT, 'public/assets/themes', ID);
const CACHE = join(ROOT, '.cache');
mkdirSync(join(OUT, 'cut'), { recursive: true });
mkdirSync(CACHE, { recursive: true });

const WEAPONS = ['sweep', 'shot', 'orbit', 'aura', 'chain', 'pulse', 'lure'];

// ------------------------------------------------------------------ LPC characters

const skin = (item, color) => ({ item, color, material: 'body' });
const ZOMBIE = [{ item: 'body_zombie', variant: 'zombie' }, skin('heads_zombie', 'zombie')];

/**
 * Recipes for every actor slot. Items are sheet_definitions file names in the LPC generator.
 * `hiVis`, `riot`, `drool` and `mutations` are drawn on afterwards; `bloat` and `crawl` reshape the sheet.
 */
const RECIPES = {
  'aura-start': { // Paramedic: green uniform with reflective bands and a Star of Life
    body: 'female',
    layers: [
      { item: 'body', color: 'olive' }, skin('heads_human_female', 'olive'),
      { item: 'legs_pants', color: 'forest' }, { item: 'feet_boots_basic', color: 'black' },
      { item: 'torso_clothes_longsleeve', color: 'forest' }, { item: 'hair_ponytail', color: 'dark_brown' },
    ],
    hiVis: true,
  },
  'sweep-start': { // Hardware-store Clerk: polo shirt, orange apron, glasses
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male', 'light'),
      { item: 'legs_pants', color: 'blue' }, { item: 'feet_shoes_basic', color: 'brown' },
      { item: 'torso_clothes_shortsleeve_polo', color: 'red' }, { item: 'torso_aprons_apron', color: 'orange' },
      { item: 'hair_parted', color: 'light_brown' }, { item: 'beards_trimmed', color: 'light_brown' },
      { item: 'facial_glasses_nerd', color: 'black' },
    ],
  },
  swarmer: { // Shamblers: a dad in a T-shirt and shorts, bitten
    body: 'male',
    layers: [
      ...ZOMBIE, { item: 'legs_shorts', color: 'tan' }, { item: 'feet_shoes_basic', color: 'white' },
      { item: 'torso_clothes_tshirt', color: 'sky' }, { item: 'wound_arm', color: 'red' },
      { item: 'wound_eye_left', color: 'red' }, { item: 'hair_messy1', color: 'chestnut' },
    ],
  },
  fragment: { // Crawlers: legless, dragging themselves along
    body: 'female',
    layers: [
      ...ZOMBIE, { item: 'torso_clothes_blouse_longsleeve', color: 'pink' },
      { item: 'wound_mouth', color: 'red' }, { item: 'hair_bob', color: 'blonde' },
    ],
    crawl: true,
  },
  splitter: { // Bloater: stretched wide at the belly, covered in pustules
    body: 'male',
    layers: [
      ...ZOMBIE, { item: 'legs_pants', color: 'bluegray' }, { item: 'feet_shoes_basic', color: 'black' },
      { item: 'torso_clothes_tshirt', color: 'white' }, { item: 'wound_mouth', color: 'red' },
      { item: 'hair_balding', color: 'dark_gray' },
    ],
    bloat: true,
  },
  tank: { // Riot-gear Zombie: black kit, helmet and visor, clear shield (scaled up in theme.json)
    body: 'male',
    layers: [
      ...ZOMBIE, { item: 'legs_pants', color: 'black' }, { item: 'feet_boots_basic', color: 'black' },
      { item: 'torso_clothes_longsleeve', color: 'black' }, { item: 'torso_clothes_vest', color: 'charcoal' },
    ],
    riot: true,
  },
  ranged: { // Spitter: acid drools from her torn mouth
    body: 'female',
    layers: [
      ...ZOMBIE, { item: 'legs_pants', color: 'charcoal' }, { item: 'feet_shoes_basic', color: 'white' },
      { item: 'torso_clothes_tshirt_vneck', color: 'purple' }, { item: 'wound_mouth', color: 'red' },
      { item: 'hair_ponytail', color: 'redhead' },
    ],
    drool: true,
  },
  boss: { // The Mutated Mayor: suit, chain of office, and growths bursting from one shoulder (scaled up in theme.json)
    body: 'male',
    layers: [
      ...ZOMBIE, { item: 'legs_pants', color: 'charcoal' }, { item: 'feet_shoes_basic', color: 'black' },
      { item: 'torso_clothes_longsleeve_formal', color: 'white' }, { item: 'torso_jacket_collared', color: 'charcoal' },
      { item: 'neck_necktie', color: 'red' }, { item: 'neck_necklace_chain', color: 'gold' },
      { item: 'hair_balding', color: 'gray' }, { item: 'wound_brain', variant: 'red' },
    ],
    mutations: true,
  },
};

const INK = hex('#12100e');
const ACID = hex('#a8f03a'), ACID_DARK = hex('#4e7a1a'), FLESH = hex('#8a3a5e'), FLESH_LIGHT = hex('#c46a8a');
const HIVIS = hex('#e6f23a'), REFLECT = hex('#d8dce4'), LIFE = hex('#2a6ad8');

const layerItems = (recipe, prefix) => recipe.layers.map((l) => l.item).filter((item) => item.startsWith(prefix));

/** Paramedic markings: two reflective bands across the uniform (skin stays bare) and a Star of Life on the chest. */
function addHiVis(sheet, body) {
  eachFrame((dir, ox, oy) => {
    const box = torsoBox(body, ox, oy);
    if (!box) return;
    for (const [y, col] of [[box.y0 + 5, HIVIS], [box.y0 + 6, REFLECT], [box.y0 + 7, HIVIS], [box.y1 - 3, HIVIS], [box.y1 - 2, REFLECT]])
      for (let x = box.x0 - 3; x <= box.x1 + 3; x++) {
        const p = sheet.get(ox + x, oy + y), b = body.get(ox + x, oy + y);
        if (!p[3] || (b[3] && p[0] === b[0] && p[1] === b[1] && p[2] === b[2])) continue; // clothing only
        sheet.px.set([col[0], col[1], col[2]], ((oy + y) * sheet.w + ox + x) * 4);
      }
    if (dir === 'up') return;
    const sx = ox + (dir === 'down' ? box.cx - 4 : dir === 'right' ? box.x1 - 3 : box.x0 + 3), sy = oy + box.y0 + 10; // between the bands
    sheet.rect(sx - 1, sy - 2, 2, 5, LIFE); sheet.rect(sx - 2.5, sy - 0.5, 5, 2, LIFE); // the Star of Life, at 64 px a blue cross
  });
}

/** Riot gear: a black helmet with a smoked visor over the face, and a clear shield carried in front. */
function addRiotGear(sheet, head, body) {
  eachFrame((dir, ox, oy) => {
    const hb = head.crop(ox, oy, FRAME, FRAME).bbox(128), tb = torsoBox(body, ox, oy);
    if (!hb || !tb) return;
    const cx = (hb.x0 + hb.x1 + 1) / 2, h = hb.y1 - hb.y0;
    const shield = new Canvas(FRAME, FRAME), helmet = new Canvas(FRAME, FRAME);
    helmet.ellipse(cx, hb.y0 + h * 0.35, (hb.x1 - hb.x0) / 2 + 2, h * 0.45, hex('#1e2126'));
    helmet.ellipse(cx - 2, hb.y0 + h * 0.2, 3, 1.5, hex('#4a5058'));
    if (dir !== 'up') {
      const vx = dir === 'down' ? cx : cx + (dir === 'right' ? 3 : -3);
      helmet.rect(vx - (dir === 'down' ? 8 : 5), hb.y0 + h * 0.42, dir === 'down' ? 16 : 10, h * 0.34, withAlpha(hex('#5a88b0'), 170));
      helmet.rect(vx - (dir === 'down' ? 8 : 5), hb.y0 + h * 0.42, dir === 'down' ? 16 : 10, 1, withAlpha(hex('#d0e8ff'), 200));
    }
    helmet.outline(withAlpha(INK, 200));
    if (dir === 'down') {
      shield.rect(tb.cx - 10, tb.y0 + 2, 20, 24, withAlpha(hex('#b8d0e0'), 110));
      shield.rect(tb.cx - 10, tb.y0 + 2, 20, 1, withAlpha(hex('#e8f4ff'), 220));
      shield.rect(tb.cx - 7, tb.y0 + 8, 14, 3, withAlpha(hex('#f4f4f4'), 170)); // the lettering band
    } else if (dir !== 'up') {
      const sx = dir === 'right' ? tb.x1 + 2 : tb.x0 - 3;
      shield.rect(sx, tb.y0, 2, 26, withAlpha(hex('#b8d0e0'), 190));
    }
    setFrame(sheet, ox, oy, sheet.crop(ox, oy, FRAME, FRAME).draw(helmet).draw(shield));
  });
}

/** Acid drool: glowing green drips from the mouth, and a spatter on the chin. */
function addDrool(sheet, head) {
  eachFrame((dir, ox, oy) => {
    if (dir === 'up') return;
    const hb = head.crop(ox, oy, FRAME, FRAME).bbox(128);
    if (!hb) return;
    const mx = dir === 'down' ? Math.round((hb.x0 + hb.x1) / 2) : dir === 'right' ? hb.x1 - 3 : hb.x0 + 3, my = hb.y1 - 3;
    const drip = new Canvas(FRAME, FRAME);
    drip.rect(mx - 1, my, 3, 1, ACID); drip.rect(mx - 1, my + 1, 1, 4, ACID); drip.rect(mx + 1, my + 1, 1, 2, ACID_DARK);
    drip.rect(mx - 1, my + 5, 1, 1, withAlpha(ACID, 160));
    setFrame(sheet, ox, oy, sheet.crop(ox, oy, FRAME, FRAME).draw(drip));
  });
}

/** The Mayor's mutations: a cluster of fleshy growths with yellow eyes on one shoulder, bulging through the suit. */
function addMutations(sheet, body) {
  eachFrame((dir, ox, oy) => {
    const tb = torsoBox(body, ox, oy);
    if (!tb) return;
    const side = { down: 1, up: -1, left: -1, right: 1 }[dir]; // his right shoulder facing down or up; the back one from the side
    const sx = dir === 'down' || dir === 'up' ? (side > 0 ? tb.x0 + 1 : tb.x1 - 1) : tb.cx - side * 3, sy = tb.y0 - 1;
    const growth = new Canvas(FRAME, FRAME);
    for (const [dx, dy, r] of [[0, 0, 5], [-side * 4, -4, 3.5], [-side * 1, -7, 2.5], [-side * 5, 3, 3]]) {
      growth.circle(sx + dx, sy + dy, r, FLESH);
      growth.circle(sx + dx - 1, sy + dy - 1, r * 0.5, FLESH_LIGHT);
    }
    if (dir !== 'up') for (const [dx, dy] of [[0, 0], [-side * 4, -4]]) { growth.rect(sx + dx - 1, sy + dy, 2, 2, hex('#ffe23a')); growth.rect(sx + dx, sy + dy, 1, 1, INK); }
    growth.outline(withAlpha(INK, 200));
    setFrame(sheet, ox, oy, sheet.crop(ox, oy, FRAME, FRAME).draw(growth));
  });
}

/**
 * LPC has no fat body. Stretch each frame sideways into a 96 px frame, most at the belly, least at the
 * head, sampling nearest-neighbour so the pixels stay crisp, then add pustules over the belly.
 */
function bloat(sheet, body) {
  const W = 96, out = new Canvas(W * WALK_FRAMES, FRAME * DIRS.length);
  eachFrame((dir, ox, oy) => {
    const tb = torsoBox(body, ox, oy);
    const belly = tb ? (tb.y0 + tb.y1) / 2 + 2 : 40, cx = tb ? tb.cx + 0.5 : 32;
    const bx = (ox / FRAME) * W;
    for (let y = 0; y < FRAME; y++) {
      const s = 1.12 + 0.6 * Math.exp(-(((y - belly) / 7) ** 2)); // the stretch for this row
      for (let x = 0; x < W; x++) {
        const src = Math.floor(cx + (x + 0.5 - W / 2) / s);
        if (src < 0 || src >= FRAME) continue;
        const p = sheet.get(ox + src, oy + y);
        if (p[3]) out.px.set(p, ((oy + y) * out.w + bx + x) * 4);
      }
    }
    if (dir === 'up') return;
    const r = lcg(7);
    for (let k = 0; k < 6; k++) {
      const px = bx + W / 2 + (r() * 2 - 1) * 12, py = oy + belly + (r() * 2 - 1) * 5;
      out.circle(px, py, 1 + r() * 1.5, ACID_DARK); out.rect(px - 0.5, py - 0.5, 1, 1, ACID);
    }
  });
  return { sheet: out, width: W };
}

/** The frame at (ox, oy) rotated a quarter turn: clockwise puts the head on the right. */
function rotateFrame(sheet, ox, oy, clockwise) {
  const out = new Canvas(FRAME, FRAME);
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const p = clockwise ? sheet.get(ox + y, oy + FRAME - 1 - x) : sheet.get(ox + FRAME - 1 - y, oy + x);
      if (p[3]) out.px.set(p, (y * FRAME + x) * 4);
    }
  return out;
}

/**
 * LPC has no crawl animation. From the side, the walk frame is laid flat (rotated a quarter turn, head
 * leading) and dropped to the ground, so the walk's arm and leg swing reads as clawing along. Facing down
 * or up, only the upper body shows, cut off at the hips and sunk to the ground. A smear trails behind.
 */
function crawl(sheet, body) {
  const out = new Canvas(sheet.w, sheet.h);
  eachFrame((dir, ox, oy) => {
    const tb = torsoBox(body, ox, oy);
    if (!tb) return;
    const bob = (ox / FRAME) % 2; // a pixel on alternate frames
    const back = { down: [0, -1], up: [0, 1], left: [1, 0], right: [-1, 0] }[dir];
    const frame = new Canvas(FRAME, FRAME);
    frame.ellipse(32 + back[0] * 14, FRAME - 6 + back[1] * 4, back[0] ? 16 : 7, back[1] ? 6 : 3, withAlpha(hex('#5a1a18'), 120));
    if (dir === 'left' || dir === 'right') frame.draw(rotateFrame(sheet, ox, oy, dir === 'right'), 0, 14 - bob);
    else { const hip = tb.y1 - 2; frame.draw(sheet.crop(ox, oy, FRAME, hip), 0, FRAME - 4 - hip + bob); }
    setFrame(out, ox, oy, frame);
  });
  return out;
}

const lpc = new Lpc(process.env.ULPC_DIR ?? join(CACHE, 'ulpc'));
const frames = [];
for (const [actor, recipe] of Object.entries(RECIPES)) {
  let sheet = lpc.compose(recipe);
  const heads = () => lpc.composeOnly(recipe, layerItems(recipe, 'head'));
  const bodies = () => lpc.composeOnly(recipe, layerItems(recipe, 'body'));
  if (recipe.hiVis) addHiVis(sheet, bodies());
  if (recipe.riot) addRiotGear(sheet, heads(), bodies());
  if (recipe.drool) addDrool(sheet, heads());
  if (recipe.mutations) addMutations(sheet, bodies());
  if (recipe.crawl) sheet = crawl(sheet, bodies());
  let width = FRAME;
  if (recipe.bloat) ({ sheet, width } = bloat(sheet, bodies()));
  writePng(join(CACHE, `${ID}-${actor}.png`), sheet); // for inspection
  frames.push(...walkFrames(actor, sheet, width));
}

// ------------------------------------------------------------------ custom art (effects, pickups, tileset)

const art = (name, w, h, paint, outline = true) => {
  const c = new Canvas(w, h);
  paint(c);
  if (outline) c.outline(withAlpha(INK, 220));
  frames.push({ name, c });
  return c;
};

const STEEL = hex('#c4cad2'), STEEL_DARK = hex('#6e747c'), BLACK = hex('#24262a'), HAZARD = hex('#f2c230');
const RED = hex('#d8342a'), SPARK = hex('#e8f4ff'), ZAP = hex('#7ab8ff'), FOG = hex('#d8e8a0'), DIRT = hex('#6a4a2e');
const WOOD = hex('#b08050'), ORANGE = hex('#ff8a2a'), GRASS = hex('#5a9a3a'), GRASS_DARK = hex('#3e7a2a');
const MUTANT = hex('#c83a8a'), MUTANT_DARK = hex('#5a1a4a');

// Shovel swing: a dull steel crescent flecked with dirt, pointing right.
art('sweep/arc', 128, 128, (c) => {
  c.shade(0, 0, 127, 127, (x, y) => {
    const d = Math.hypot(x - 64, y - 64), a = Math.atan2(y - 64, x - 64);
    if (d < 38 || d > 62 || Math.abs(a) > 1.22) return null;
    const t = (d - 38) / 24, fade = Math.min(1, (1 - Math.abs(a) / 1.22) * 2.2);
    return withAlpha(mixColor(STEEL_DARK, STEEL, t), Math.round(220 * fade * (0.3 + 0.7 * t)));
  });
  const r = lcg(3);
  for (let i = 0; i < 20; i++) { const a = (r() * 2 - 1) * 1.1, d = 44 + r() * 18; c.rect(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2, 2, withAlpha(DIRT, 230)); }
}, false);
// Nail, pointing right.
art('shot/proj', 12, 4, (c) => { c.rect(0, 0, 2, 4, STEEL_DARK); c.rect(2, 1, 8, 2, STEEL); c.poly([[10, 1], [12, 2], [10, 3]], STEEL); c.rect(2, 1, 8, 1, hex('#ffffff')); });
// Lawn-mower blade, blurred as it spins.
art('orbit/blade', 24, 24, (c) => {
  c.ring(12, 12, 8, 11, withAlpha(STEEL, 70));
  c.line(3, 12, 21, 12, 3, STEEL_DARK); c.line(3, 11, 21, 11, 1, STEEL);
  c.poly([[1, 12], [4, 9], [5, 12]], STEEL); c.poly([[23, 12], [20, 15], [19, 12]], STEEL);
  c.circle(12, 12, 2, BLACK);
});
// Bug-spray Fogger: a pale chemical fog with a faint rim.
const fog = tileNoise(47, 6);
art('aura/field', 128, 128, (c) => c.radial(64, 64, 62, (t, x, y) => {
  const n = fog(x / 128, y / 128);
  return withAlpha(mixColor(hex('#b8cc80'), FOG, n), Math.round(t > 0.93 ? 130 : 30 + 80 * n * (1 - t * 0.5)));
}), false);
// Jumper Cables: a red cable with a blue-white arc jumping along it.
art('chain/bolt', 64, 8, (c) => {
  c.line(0, 5, 64, 5, 2, withAlpha(RED, 200));
  const r = lcg(19);
  let y = 3;
  for (let x = 0; x < 64; x += 4) { const ny = 1 + r() * 5; c.line(x, y, x + 4, ny, 2, withAlpha(ZAP, 170)); c.line(x, y, x + 4, ny, 1, SPARK); y = ny; }
}, false);
// Car Alarm Subwoofer: a thumping bass ring with an orange hazard-light flash.
art('pulse/ring', 128, 128, (c) => {
  c.ring(64, 64, 52, 62, withAlpha(BLACK, 150));
  c.ring(64, 64, 55, 59, withAlpha(ORANGE, 210));
  c.ring(64, 64, 42, 45, withAlpha(ORANGE, 110));
}, false);
// Boombox.
const boombox = (c, x, y, w = 24, h = 14) => {
  c.rect(x, y + 3, w, h - 3, BLACK); c.rect(x + 3, y, w - 6, 2, STEEL_DARK); c.rect(x + 3, y, 1, 4, STEEL_DARK); c.rect(x + w - 4, y, 1, 4, STEEL_DARK);
  for (const sx of [x + 5, x + w - 5]) { c.circle(sx, y + 3 + (h - 3) / 2, (h - 3) / 2 - 1.5, STEEL_DARK); c.circle(sx, y + 3 + (h - 3) / 2, 1.5, BLACK); }
  c.rect(x + w / 2 - 3, y + 5, 6, 3, hex('#3a8ad8'));
};
art('lure/bait', 26, 16, (c) => boombox(c, 1, 1));

/** 32 px icon on a hardware-store price tag: a white card with a yellow-and-black hazard border. */
const icon = (weapon, paint) => art(`${weapon}/icon`, 32, 32, (c) => {
  c.shade(1, 1, 30, 30, (x, y) => (Math.floor((x + y) / 3) % 2 ? HAZARD : BLACK));
  c.rect(4, 4, 24, 24, hex('#f4f2ea'));
  paint(c);
});
icon('sweep', (c) => { c.line(9, 24, 21, 10, 2, WOOD); c.poly([[19, 9], [23, 5], [27, 9], [23, 13]], STEEL); c.rect(7, 23, 5, 2, BLACK); });
icon('shot', (c) => { c.rect(7, 10, 17, 6, ORANGE); c.rect(7, 10, 17, 2, hex('#ffb070')); c.rect(10, 16, 5, 9, BLACK); c.rect(24, 12, 3, 2, STEEL); c.rect(4, 17, 3, 1, STEEL_DARK); });
icon('orbit', (c) => { c.line(6, 16, 26, 16, 3, STEEL_DARK); c.line(6, 15, 26, 15, 1, STEEL); c.poly([[4, 16], [7, 12], [8, 16]], STEEL); c.poly([[28, 16], [25, 20], [24, 16]], STEEL); c.circle(16, 16, 2.5, BLACK); });
icon('aura', (c) => { c.rect(9, 12, 8, 14, hex('#3a8a3a')); c.rect(10, 9, 6, 3, STEEL_DARK); c.rect(11, 15, 4, 5, HAZARD); for (const [x, y, r] of [[21, 9, 3], [25, 13, 2.5], [22, 16, 2]]) c.circle(x, y, r, withAlpha(hex('#9ab870'), 180)); });
icon('chain', (c) => { c.line(6, 24, 12, 12, 2, RED); c.line(26, 24, 20, 12, 2, BLACK); c.rect(10, 8, 5, 5, RED); c.rect(17, 8, 5, 5, BLACK); c.line(15, 10, 17, 7, 1, ZAP); c.line(17, 7, 16, 12, 1, SPARK); });
icon('pulse', (c) => { c.rect(7, 8, 18, 18, BLACK); c.circle(16, 17, 6, STEEL_DARK); c.circle(16, 17, 2.5, BLACK); c.circle(10, 11, 1.5, ORANGE); c.sector(16, 17, 8, 9, -0.7, 0.7, ORANGE); });
icon('lure', (c) => boombox(c, 4, 10));

// Enemy and Boss effects.
art('ranged/proj', 12, 8, (c) => { c.ellipse(4, 4, 3, 2, withAlpha(ACID, 120)); c.circle(8, 4, 3, ACID); c.circle(7, 3, 1, hex('#f4ffc0')); c.rect(9, 6, 1, 2, ACID_DARK); });
art('boss/proj', 16, 16, (c) => c.radial(8, 8, 7, (t) => withAlpha(mixColor(hex('#ffd0e8'), MUTANT_DARK, t), 255 - t * 60)));
art('boss/telegraph_line', 64, 16, (c) => c.shade(0, 0, 63, 15, (x, y) => withAlpha(MUTANT, 55 + 55 * Math.abs(Math.sin(x / 4)) * (1 - Math.abs(y - 8) / 8))), false);
art('boss/telegraph_ring', 128, 128, (c) => { c.ring(64, 64, 50, 62, withAlpha(MUTANT, 90)); c.ring(64, 64, 58, 60, withAlpha(hex('#ffd0e8'), 180)); }, false);
art('boss/charge', 64, 32, (c) => c.shade(0, 0, 63, 31, (x, y) => {
  const half = (x / 64) * 16;
  return Math.abs(y - 16) <= half ? withAlpha(mixColor(MUTANT_DARK, hex('#ffd0e8'), x / 64), Math.round(170 * (x / 64))) : null;
}), false);

// Pickups: supply token / medkit / fridge magnet / supply drop.
art('pickup/xp', 12, 12, (c) => { c.circle(6, 6, 5, hex('#3a8ad8')); c.ring(6, 6, 3.5, 4.2, hex('#1e5aa0')); c.rect(4, 5, 4, 2, HAZARD); c.rect(3, 3, 1, 1, hex('#d0e8ff')); });
art('pickup/heal', 18, 16, (c) => { c.rect(1, 3, 16, 12, hex('#f4f4f4')); c.rect(6, 1, 6, 2, STEEL_DARK); c.rect(7, 5, 4, 8, RED); c.rect(5, 7, 8, 4, RED); c.rect(1, 13, 16, 2, hex('#c8c8c8')); });
art('pickup/magnet', 22, 22, (c) => { // a banana fridge magnet
  c.sector(4, 2, 12, 17, 0.25, 1.35, hex('#f8d838')); c.sector(4, 2, 12, 13.5, 0.25, 1.35, hex('#d8a818'));
  c.rect(15, 5, 2, 3, hex('#6a4a1a')); c.circle(8, 17, 1, hex('#6a4a1a'));
});
art('pickup/chest', 28, 28, (c) => { // a supply crate under a parachute
  c.sector(14, 10, 0, 12, -Math.PI, 0, hex('#e8e0c8')); c.sector(14, 10, 0, 12, -Math.PI * 0.66, -Math.PI * 0.33, hex('#d05a2a'));
  for (const x of [3, 14, 25]) c.line(x, 10, 14, 16, 1, STEEL_DARK);
  c.rect(6, 16, 16, 11, hex('#6a7a3a')); c.rect(6, 16, 16, 2, hex('#8a9a4a')); c.rect(13, 16, 2, 11, hex('#4a5a2a')); c.rect(9, 20, 10, 3, HAZARD);
});

// Tileset decorations: garden gnome, fire hydrant, knocked-over bin, lawn flamingo, hedge, car tyre.
const DECO = [
  (c) => { c.ellipse(16, 28, 6, 2, hex('#2a3a1a')); c.rect(12, 16, 8, 11, hex('#3a6ad8')); c.circle(16, 14, 3.5, hex('#f0c0a0')); c.poly([[11, 13], [21, 13], [16, 2]], RED); c.poly([[13, 16], [19, 16], [16, 22]], hex('#f4f4f4')); },
  (c) => { c.ellipse(16, 28, 7, 2.5, hex('#2a2a2a')); c.rect(11, 12, 10, 16, RED); c.ellipse(16, 12, 6, 3, hex('#e84a3a')); c.rect(14, 6, 4, 5, RED); c.rect(7, 16, 4, 4, RED); c.rect(21, 16, 4, 4, RED); c.rect(9, 25, 14, 3, hex('#a8281e')); },
  (c) => { c.rect(4, 12, 20, 12, hex('#4a5a6a')); c.ellipse(24, 18, 3, 6, hex('#2a3440')); for (const y of [15, 21]) c.rect(4, y, 20, 1, hex('#3a4a5a')); for (const [x, y] of [[27, 22], [29, 26], [25, 27]]) c.rect(x, y, 3, 2, hex('#d8d0b0')); },
  (c) => { c.line(15, 18, 15, 30, 1, BLACK); c.line(17, 18, 18, 30, 1, BLACK); c.ellipse(16, 14, 7, 5, hex('#ff78b8')); c.line(20, 12, 24, 4, 2, hex('#ff78b8')); c.circle(24, 4, 2.5, hex('#ff78b8')); c.poly([[26, 4], [29, 6], [26, 6]], BLACK); },
  (c) => { for (const [x, y, r] of [[10, 18, 8], [20, 17, 9], [15, 11, 7], [24, 22, 6]]) c.circle(x, y, r, GRASS_DARK); for (const [x, y] of [[9, 14], [18, 12], [22, 19], [13, 20]]) c.circle(x, y, 2, GRASS); },
  (c) => { c.ring(16, 18, 5, 11, BLACK); c.ring(16, 18, 5, 7, hex('#44474c')); for (let a = 0; a < 12; a++) c.rect(16 + Math.cos(a * 0.52) * 9.5, 18 + Math.sin(a * 0.52) * 9.5, 1, 1, hex('#3a3c40')); },
];
DECO.forEach((paint, i) => art(`deco/${i}`, 32, 32, paint));

const { atlas, json } = packAtlas(frames, 'sprites.png', 2048);
writePng(join(OUT, 'sprites.png'), atlas);
writeFileSync(join(OUT, 'sprites.json'), JSON.stringify(json, null, 1) + '\n');

// Suburban lawns and cracked asphalt: a street runs east-west through the tile with a dashed centre line,
// kerbs and concrete sidewalks, between front lawns with mowing stripes. Cracks, a pothole and oil stains
// scar the road. A large seamless tile so repeats aren't obvious.
const G = 512, ROAD0 = 200, ROAD1 = 312, WALK = 28;
const ground = new Canvas(G, G);
const grain = tileNoise(11, 64), patch = tileNoise(27, 8);
ground.shade(0, 0, G - 1, G - 1, (px, py) => {
  const x = Math.floor(px), y = Math.floor(py); // pixel centres arrive as n + 0.5
  const u = x / G, v = y / G;
  if (y >= ROAD0 && y < ROAD1) {
    let col = mixColor(hex('#34363a'), hex('#4a4c50'), grain(u, v) * 0.6 + patch(u, v) * 0.4);
    const mid = (ROAD0 + ROAD1) / 2;
    if (Math.abs(y - mid) < 2 && x % 64 < 36) col = mixColor(hex('#e8c040'), col, 0.25); // centre line
    return col;
  }
  const inWalk = (y >= ROAD0 - WALK && y < ROAD0) || (y >= ROAD1 && y < ROAD1 + WALK);
  if (inWalk) {
    if (y === ROAD0 - 1 || y === ROAD1) return hex('#8a8a86'); // kerb edge
    if (x % 32 === 0 || (y - (y < ROAD0 ? ROAD0 - WALK : ROAD1)) % WALK === 0) return hex('#7a7870'); // slab joints
    return mixColor(hex('#b4b2aa'), hex('#cac8c0'), grain(u, v));
  }
  const stripe = Math.floor(x / 32) % 2 ? 0.12 : 0; // mowing stripes
  return mixColor(mixColor(GRASS_DARK, GRASS, patch(u, v) * 0.5 + grain(u, v) * 0.5), hex('#8ac85a'), stripe);
});
const scatter = lcg(97);
for (let i = 0; i < 4; i++) { // oil stains on the road
  const cx = scatter() * G, cy = ROAD0 + 12 + scatter() * (ROAD1 - ROAD0 - 24), r = 8 + scatter() * 8;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r * 1.4; dx <= r * 1.4; dx++) if ((dx / 1.4) ** 2 + dy * dy < r * r) ground.blendWrap(cx + dx, cy + dy, hex('#1a1a20', 60));
}
/** A jagged crack wandering from (x, y) in direction `a`, forking now and then. */
function crack(r, x, y, a, len, depth = 0) {
  for (let i = 0; i < len; i++) {
    a += (r() - 0.5) * 0.9;
    x += Math.cos(a); y += Math.sin(a);
    if (y < ROAD0 + 3 || y > ROAD1 - 3) return; // cracks stay on the road
    ground.blendWrap(x, y, hex('#18191c', 230));
    if (depth < 2 && r() < 0.03) crack(r, x, y, a + (r() < 0.5 ? 1 : -1) * (0.6 + r()), len / 3, depth + 1);
  }
}
const crackRng = lcg(53);
for (let i = 0; i < 9; i++) crack(crackRng, crackRng() * G, ROAD0 + 6 + crackRng() * (ROAD1 - ROAD0 - 12), crackRng() * Math.PI * 2, 40 + crackRng() * 60);
{ // one pothole, with cracks radiating from it
  const cx = 380, cy = ROAD0 + 30;
  for (let dy = -9; dy <= 9; dy++) for (let dx = -13; dx <= 13; dx++) { const d = (dx / 13) ** 2 + (dy / 9) ** 2; if (d < 1) ground.blendWrap(cx + dx, cy + dy, d > 0.7 ? hex('#5a5c60') : hex('#18181c')); }
  for (let k = 0; k < 4; k++) crack(crackRng, cx, cy, (k / 4) * Math.PI * 2 + 0.4, 30);
}
for (let i = 0; i < 300; i++) { // clover and dandelions in the lawns
  const x = scatter() * G, y = scatter() * G;
  if (y > ROAD0 - WALK - 2 && y < ROAD1 + WALK + 2) continue;
  ground.blendWrap(x, y, scatter() < 0.2 ? hex('#f8e040') : withAlpha(hex('#2e6a1e'), 200));
}
writePng(join(OUT, 'ground.png'), ground);

// ------------------------------------------------------------------ audio (placeholder)

/** A sustained, low-passed detuned saw with attack and release: an 80s horror synth pad or bass. */
function synth(freq, dur, vol = 0.12, cutoff = 0.08, attack = 0.05, release = 0.25) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  let p1 = 0, p2 = 0, y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    p1 += freq / RATE; p2 += (freq * 1.007) / RATE;
    y += cutoff * ((p1 % 1) + (p2 % 1) - 1 - y);
    out[i] = y * vol * Math.min(1, t / attack, (dur - t) / release);
  }
  return out;
}

const kick = () => tone(120, 40, 0.18, 'sine', 0.6);
const snare = () => mix(noise(0.12, 0.35, 0.6), tone(220, 160, 0.08, 'tri', 0.2));
const hat = () => noise(0.03, 0.1, 0.9);

const SFX = {
  hit: mix(noise(0.08, 0.5, 0.12), tone(140, 80, 0.06, 'sine', 0.3)), // a wet thud
  pickup: concat(tone(hz('E6'), hz('E6'), 0.05, 'square', 0.1), tone(hz('A6'), hz('A6'), 0.15, 'square', 0.1)),
  levelUp: concat(...['A4', 'C5', 'E5'].map((n) => synth(hz(n), 0.14, 0.3, 0.2, 0.005, 0.05)), synth(hz('A5'), 0.6, 0.3, 0.2, 0.005, 0.4)),
  chest: mix(noise(0.6, 0.15, 0.05, 0.3), place(silence(1.1), mix(tone(90, 40, 0.3, 'sine', 0.6), noise(0.2, 0.3, 0.2)), 0.6)), // parachute whoosh, crate thud
  playerHurt: mix(noise(0.15, 0.5, 0.08), tone(200, 90, 0.18, 'tri', 0.3)),
  bossTelegraph: concat(tone(500, 900, 0.5, 'saw', 0.15), tone(900, 500, 0.5, 'saw', 0.15)), // air-raid siren
  win: concat(...['A4', 'C#5', 'E5'].map((n) => synth(hz(n), 0.22, 0.3, 0.2, 0.005, 0.05)), mix(synth(hz('A5'), 1.5, 0.3, 0.15, 0.005, 1), synth(hz('E5'), 1.5, 0.2, 0.15, 0.005, 1))),
  lose: concat(...['E4', 'C4', 'A3'].map((n) => synth(hz(n), 0.4, 0.25, 0.06, 0.01, 0.1)), synth(hz('F3'), 1.4, 0.25, 0.04, 0.01, 0.8)),
  fire_sweep: mix(noise(0.14, 0.25, 0.4, 0.03), place(silence(0.3), bell(700, 0.2, 0.15), 0.1)), // swing and clang
  fire_shot: concat(noise(0.05, 0.4, 0.5), tone(1600, 1600, 0.015, 'square', 0.15)), // pneumatic pfft and tick
  fire_orbit: tone(180, 200, 0.2, 'saw', 0.08),
  fire_aura: noise(0.3, 0.18, 0.5, 0.05),
  fire_chain: mix(tone(60, 60, 0.2, 'square', 0.15), noise(0.1, 0.3, 0.9)),
  fire_pulse: mix(tone(70, 35, 0.4, 'sine', 0.7), tone(900, 1300, 0.35, 'square', 0.06)), // bass thump and alarm whoop
  fire_lure: concat(kick(), silence(0.05), snare()),
};
const sprite = audioSprite(SFX);
writeFileSync(join(OUT, 'sfx.wav'), wav(sprite.samples));
writeFileSync(join(OUT, 'sfx.json'), JSON.stringify({ resources: ['sfx.wav'], spritemap: sprite.spritemap }, null, 2) + '\n');

/**
 * 80s horror synth: a pad chord and a repeating arpeggio per bar, and optionally a bass and drum
 * machine. `chords` are [bass, ...arpeggio notes] per four-beat bar.
 */
function horrorSynth(chords, beat, drums) {
  const bar = beat * 4, track = new Float32Array(Math.ceil(chords.length * bar * RATE));
  chords.forEach(([bass, ...arp], i) => {
    const at = i * bar;
    for (const n of arp.slice(0, 3)) place(track, synth(hz(n) / 2, bar, 0.04, 0.03, 0.4, 0.5), at);
    for (let k = 0; k < 8; k++) place(track, synth(hz(arp[k % arp.length]), beat * 0.45, 0.1, 0.25, 0.005, 0.15), at + k * (beat / 2));
    if (drums) for (let k = 0; k < 8; k++) place(track, synth(hz(bass), beat * 0.4, 0.25, 0.06, 0.005, 0.05), at + k * (beat / 2));
    else place(track, synth(hz(bass), bar, 0.2, 0.04, 0.2, 0.5), at);
  });
  if (drums) for (let b = 0; b < chords.length * 4; b++) { place(track, b % 2 ? snare() : kick(), b * beat); place(track, hat(), (b + 0.5) * beat); }
  return track;
}
const MENU_CHORDS = [['A1', 'A4', 'C5', 'E5', 'B4'], ['A1', 'A4', 'C5', 'E5', 'B4'], ['F1', 'F4', 'A4', 'C5', 'E5'], ['F1', 'F4', 'A4', 'C5', 'E5'],
  ['D2', 'D4', 'F4', 'A4', 'C5'], ['D2', 'D4', 'F4', 'A4', 'C5'], ['E2', 'E4', 'G#4', 'B4', 'D5'], ['E2', 'E4', 'G#4', 'B4', 'D5']];
const GAME_CHORDS = [['A1', 'A4', 'C5', 'E5'], ['F1', 'F4', 'A4', 'C5'], ['C2', 'C5', 'E5', 'G5'], ['G1', 'G4', 'B4', 'D5']];
writeFileSync(join(OUT, 'music-menu.wav'), wav(horrorSynth(MENU_CHORDS, 0.45, false)));
writeFileSync(join(OUT, 'music-game.wav'), wav(horrorSynth(GAME_CHORDS, 0.42, true)));

const CUT_SECONDS = 4;
const CUT_ROOTS = { sweep: 'A3', shot: 'B3', orbit: 'C4', aura: 'D4', chain: 'E4', pulse: 'F3', lure: 'G3' };
for (const w of WEAPONS) {
  const r = hz(CUT_ROOTS[w]);
  const clip = mix(synth(r / 2, CUT_SECONDS, 0.2, 0.04, 0.3, 1), synth(r, CUT_SECONDS, 0.08, 0.05, 0.6, 1),
    place(silence(CUT_SECONDS), synth(r * 1.5, CUT_SECONDS - 0.5, 0.1, 0.2, 0.005, 1.5), 0.5));
  writeFileSync(join(OUT, `cut/${w}.wav`), wav(clip));
}

// ------------------------------------------------------------------ Cutscene title cards (placeholder clips need ffmpeg)

const nightStreet = (card) => {
  card.shade(0, 0, 1279, 719, (x, y) => mixColor(hex('#0e1430'), hex('#3a2a4a'), y / 720));
  card.circle(1060, 150, 50, hex('#e8e4c8')); // moon
  for (const [x, w, h] of [[60, 220, 180], [340, 260, 150], [680, 200, 200], [940, 280, 160]]) { // houses
    card.rect(x, 560 - h, w, h, hex('#161a2a'));
    card.poly([[x - 16, 560 - h], [x + w / 2, 480 - h], [x + w + 16, 560 - h]], hex('#161a2a'));
    card.rect(x + 30, 560 - h + 40, 40, 34, hex('#e8b050'));
  }
  card.rect(0, 560, 1280, 160, hex('#1e2024'));
  card.shade(0, 0, 1279, 30, (x, y) => (Math.floor((x + y) / 30) % 2 ? HAZARD : BLACK));
  card.shade(0, 690, 1279, 719, (x, y) => (Math.floor((x + y) / 30) % 2 ? HAZARD : BLACK));
};
const titleCard = (weapon) => ({
  weapon,
  png: iconCard(frames.find((f) => f.name === `${weapon}/icon`).c, join(CACHE, `${ID}-card-${weapon}.png`), nightStreet),
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
console.log(`Suburban Outbreak: ${frames.length} frames (${json.meta.size.w}x${json.meta.size.h} atlas), ${credits.length} LPC credit rows.`);
