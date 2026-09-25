// Builds the Plague Village Theme: LPC characters (composed from the pinned generator repo),
// custom effect/pickup/tileset art, placeholder audio, credits, and placeholder Cutscenes if ffmpeg exists.
// Usage: npm run assets:plague   (ULPC_DIR overrides the generator checkout, default .cache/ulpc)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioSprite, bell, concat, hz, mix, noise, place, pluck, RATE, silence, tone, wav } from './lib/audio.mjs';
import { iconCard, writePlaceholderClips } from './lib/cutscenes.mjs';
import { creditsCsv, crowd, DIRS, FRAME, Lpc, walkFrames, WALK_FRAMES } from './lib/lpc.mjs';
import { Canvas, hex, lcg, mixColor, packAtlas, tileNoise, withAlpha, writePng } from './lib/raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'plague';
const OUT = join(ROOT, 'public/assets/themes', ID);
const CACHE = join(ROOT, '.cache');
mkdirSync(join(OUT, 'cut'), { recursive: true });
mkdirSync(CACHE, { recursive: true });

const WEAPONS = ['sweep', 'shot', 'orbit', 'aura', 'chain', 'pulse', 'lure'];

// ------------------------------------------------------------------ LPC characters

const skin = (item, color) => ({ item, color, material: 'body' });

/** Recipes for every actor slot. Items are sheet_definitions file names in the LPC generator. */
const RECIPES = {
  'aura-start': { // Plague Doctor
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male', 'light'),
      { item: 'legs_pants', color: 'black' }, { item: 'feet_boots_basic', color: 'black' },
      { item: 'torso_clothes_longsleeve', color: 'black' }, { item: 'cape_solid', color: 'black' },
      { item: 'facial_mask_plain', color: 'white' }, { item: 'hat_cap_cavalier', color: 'black' },
    ],
    beak: true,
  },
  'sweep-start': { // Village Blacksmith
    body: 'male',
    layers: [
      { item: 'body', color: 'amber' }, skin('heads_human_male', 'amber'),
      { item: 'legs_pants', color: 'brown' }, { item: 'feet_boots_basic', color: 'brown' },
      { item: 'torso_clothes_sleeveless', color: 'charcoal' }, { item: 'torso_aprons_apron', color: 'leather' },
      { item: 'hair_balding', color: 'dark_brown' }, { item: 'beards_beard', color: 'dark_brown' },
      { item: 'tool_hammer' },
    ],
  },
  swarmer: { // Plague-maddened Peasants
    body: 'male',
    layers: [
      { item: 'body', color: 'pale_green' }, skin('heads_human_male_gaunt', 'pale_green'),
      { item: 'legs_pants', color: 'tan' }, { item: 'torso_clothes_longsleeve', color: 'walnut' },
      { item: 'torso_bandages', color: 'white' }, { item: 'cape_tattered', color: 'brown' },
      { item: 'hat_hood_sack_cloth', color: 'tan' },
    ],
  },
  fragment: { // Lone Flagellants (the Procession below is three of these)
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male_gaunt', 'light'),
      { item: 'legs_pants', color: 'charcoal' }, { item: 'torso_jacket_tabard', color: 'gray' },
      { item: 'hat_hood_cloth', color: 'white' },
    ],
  },
  tank: { // Inquisitor Knight
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male', 'light'),
      { item: 'legs_armour', color: 'iron' }, { item: 'feet_boots_basic', color: 'black' },
      { item: 'torso_jacket_tabard', color: 'white' }, { item: 'torso_armour_plate', color: 'steel' },
      { item: 'arms_armour', color: 'steel' }, { item: 'cape_solid', color: 'maroon' },
      { item: 'hat_helmet_greathelm', color: 'steel' },
    ],
  },
  ranged: { // Crossbow Mercenary
    body: 'male',
    layers: [
      { item: 'body', color: 'taupe' }, skin('heads_human_male', 'taupe'),
      { item: 'legs_pants', color: 'brown' }, { item: 'feet_boots_basic', color: 'brown' },
      { item: 'torso_clothes_longsleeve', color: 'forest' }, { item: 'torso_armour_leather' },
      { item: 'hat_helmet_kettle' }, { item: 'weapon_ranged_crossbow', variant: 'crossbow' },
    ],
  },
  boss: { // The Plague King
    body: 'male',
    layers: [
      { item: 'body_skeleton' }, { item: 'heads_skeleton' },
      { item: 'cape_solid', color: 'purple' }, { item: 'cape_trim', color: 'yellow' },
      { item: 'hat_formal_crown', color: 'crown_gold' }, { item: 'weapon_polearm_scythe', variant: 'scythe' },
    ],
  },
};

const BONE = hex('#e9dfc4'), BONE_SHADE = hex('#b9a77f'), INK = hex('#1c1418');

/**
 * LPC has no plague-doctor beak. Draw one per frame, anchored to where the mask sits in that
 * frame (the head bobs while walking). Facing up shows the back of the head, so no beak.
 */
function addBeaks(sheet, maskSheet) {
  DIRS.forEach((dir, row) => {
    if (dir === 'up') return;
    for (let i = 0; i < WALK_FRAMES; i++) {
      const box = maskSheet.crop(i * FRAME, row * FRAME, FRAME, FRAME).bbox(128);
      if (!box) continue;
      const ox = i * FRAME, oy = row * FRAME;
      const midY = oy + Math.round((box.y0 + box.y1) / 2) + 1;
      const beak = new Canvas(FRAME, FRAME);
      if (dir === 'down') {
        const cx = Math.round((box.x0 + box.x1) / 2) + 0.5, top = box.y1 - 1;
        beak.poly([[cx - 3, top], [cx + 3, top], [cx, top + 7]], BONE);
        beak.line(cx, top, cx, top + 6, 1, BONE_SHADE);
      } else {
        const s = dir === 'left' ? -1 : 1, base = dir === 'left' ? box.x0 + 1 : box.x1;
        const y = midY - oy;
        beak.poly([[base, y - 2], [base, y + 2], [base + s * 8, y + 4]], BONE);
        beak.line(base, y + 1, base + s * 7, y + 3.5, 1, BONE_SHADE);
      }
      beak.outline(INK);
      sheet.draw(beak, ox, oy);
    }
  });
}

const lpc = new Lpc(process.env.ULPC_DIR ?? join(CACHE, 'ulpc'));
const frames = [];
for (const [actor, recipe] of Object.entries(RECIPES)) {
  const sheet = lpc.compose(recipe);
  if (recipe.beak) addBeaks(sheet, lpc.composeOnly(recipe, ['facial_mask_plain']));
  writePng(join(CACHE, `${ID}-${actor}.png`), sheet); // for inspection
  frames.push(...walkFrames(actor, sheet));
  if (actor === 'fragment') { const p = crowd(sheet); frames.push(...walkFrames('splitter', p.sheet, p.width)); } // the Flagellant Procession
}

// ------------------------------------------------------------------ custom art (effects, pickups, tileset)

const art = (name, w, h, paint, outline = true) => {
  const c = new Canvas(w, h);
  paint(c);
  if (outline) c.outline(withAlpha(INK, 220));
  frames.push({ name, c });
  return c;
};

const WOOD = hex('#7a5230'), WOOD_DARK = hex('#4e3320'), IRON = hex('#8d939c'), IRON_DARK = hex('#565b63'), STEEL = hex('#c9ced6');
const GOLD = hex('#e8b33a'), GOLD_DARK = hex('#a8761c'), BREAD = hex('#c98e4a'), BREAD_DARK = hex('#8d5a28');
const MIASMA = hex('#7fae4a'), MIASMA_DARK = hex('#3f5d22'), INCENSE = hex('#b7a6c9');

// Forge Hammer swing: a glowing, heat-graded crescent, pointing right.
art('sweep/arc', 128, 128, (c) => c.shade(0, 0, 127, 127, (x, y) => {
  const d = Math.hypot(x - 64, y - 64), a = Math.atan2(y - 64, x - 64);
  if (d < 34 || d > 62 || Math.abs(a) > 1.22) return null;
  const t = (d - 34) / 28, edge = 1 - Math.abs(a) / 1.22;
  return withAlpha(mixColor(hex('#fff1a8'), hex('#d8431c'), t), Math.round(230 * Math.min(1, edge * 2.2)));
}), false);
// Crossbow bolt, pointing right.
art('shot/proj', 16, 16, (c) => {
  c.line(2, 8, 11, 8, 2, WOOD);
  c.poly([[11, 5], [15, 8], [11, 11]], STEEL);
  c.poly([[1, 5], [4, 8], [1, 11]], hex('#d8d0c0'));
});
// Whirling sickle.
art('orbit/blade', 24, 24, (c) => {
  c.sector(12, 12, 7, 10, -Math.PI, 0.6, STEEL);
  c.sector(12, 12, 7, 8, -Math.PI, 0.6, hex('#ffffff'));
  c.line(12, 12, 6, 20, 3, WOOD);
});
// Incense Censer haze: soft lilac smoke with a faint rim.
const smoke = tileNoise(11, 6);
art('aura/field', 128, 128, (c) => c.radial(64, 64, 62, (t, x, y) => {
  const n = smoke(x / 128, y / 128);
  const a = t > 0.93 ? 150 : 40 + 70 * n * (1 - t * 0.5);
  return withAlpha(mixColor(INCENSE, hex('#e8e0f0'), n), Math.round(a));
}), false);
// Alchemist's Spark: a jagged green-gold bolt segment.
art('chain/bolt', 64, 8, (c) => {
  const r = lcg(3);
  let y = 4;
  for (let x = 0; x < 64; x += 4) { const ny = 2 + r() * 4; c.line(x, y, x + 4, ny, 2, hex('#b6f25a')); c.line(x, y, x + 4, ny, 1, hex('#fffbd0')); y = ny; }
}, false);
// Church Bell Toll: a bronze sound ring.
art('pulse/ring', 128, 128, (c) => { c.ring(64, 64, 52, 62, withAlpha(GOLD, 200)); c.ring(64, 64, 56, 59, withAlpha(hex('#fff4c4'), 230)); }, false);
// Loaf of Bread.
art('lure/bait', 24, 24, (c) => {
  c.ellipse(12, 13, 10, 7, BREAD);
  c.ellipse(12, 11, 8, 4, hex('#dca868'));
  for (const x of [7, 12, 17]) c.line(x - 2, 9, x + 1, 14, 1, BREAD_DARK);
});

/** 32 px parchment icon with a picture inside. */
const icon = (weapon, paint) => art(`${weapon}/icon`, 32, 32, (c) => {
  c.rect(1, 1, 30, 30, hex('#e6d3a3'));
  c.rect(1, 1, 30, 2, hex('#c9b27a'));
  c.rect(1, 29, 30, 2, hex('#b39a60'));
  paint(c);
});
icon('sweep', (c) => { c.line(9, 24, 21, 11, 3, WOOD); c.rect(16, 5, 11, 8, IRON); c.rect(16, 5, 11, 3, STEEL); });
icon('shot', (c) => { c.line(7, 16, 25, 16, 2, WOOD_DARK); c.sector(12, 16, 9, 10, -1.4, 1.4, WOOD); c.line(21, 7, 21, 25, 1, hex('#f0e8d8')); c.line(8, 16, 27, 16, 1, STEEL); });
icon('orbit', (c) => { c.sector(16, 15, 8, 11, -Math.PI, 0.5, STEEL); c.line(16, 15, 9, 25, 3, WOOD); });
icon('aura', (c) => { c.line(16, 3, 16, 10, 1, IRON_DARK); c.circle(16, 15, 6, GOLD); c.rect(10, 15, 13, 3, GOLD_DARK); c.circle(10, 25, 4, withAlpha(INCENSE, 200)); c.circle(21, 23, 5, withAlpha(INCENSE, 180)); });
icon('chain', (c) => { c.ellipse(16, 21, 6, 6, hex('#5a8f3a')); c.rect(14, 8, 5, 8, hex('#8fbf6a')); c.line(23, 6, 19, 12, 2, hex('#fffbd0')); c.line(19, 12, 25, 14, 2, hex('#b6f25a')); });
icon('pulse', (c) => { c.poly([[16, 5], [24, 22], [8, 22]], GOLD); c.ellipse(16, 22, 9, 3, GOLD_DARK); c.circle(16, 25, 2, IRON_DARK); c.ring(16, 15, 12, 13, withAlpha(GOLD_DARK, 150)); });
icon('lure', (c) => { c.ellipse(16, 18, 11, 7, BREAD); c.ellipse(16, 16, 9, 4, hex('#dca868')); for (const x of [11, 16, 21]) c.line(x - 2, 14, x + 1, 19, 1, BREAD_DARK); });

// Enemy and Boss effects.
art('ranged/proj', 12, 12, (c) => { c.line(1, 6, 8, 6, 2, WOOD_DARK); c.poly([[8, 3], [11, 6], [8, 9]], IRON); });
art('boss/proj', 16, 16, (c) => c.radial(8, 8, 7, (t) => withAlpha(mixColor(hex('#d6f58a'), MIASMA_DARK, t), 255 - t * 60)));
art('boss/telegraph_line', 64, 16, (c) => c.shade(0, 0, 63, 15, (x, y) => withAlpha(MIASMA, 60 + 50 * Math.abs(Math.sin(x / 5)) * (1 - Math.abs(y - 8) / 8))), false);
art('boss/telegraph_ring', 128, 128, (c) => { c.ring(64, 64, 50, 62, withAlpha(MIASMA, 110)); c.ring(64, 64, 58, 60, withAlpha(hex('#d6f58a'), 170)); }, false);
art('boss/charge', 64, 32, (c) => c.shade(0, 0, 63, 31, (x, y) => {
  const half = (x / 64) * 16;
  return Math.abs(y - 16) <= half ? withAlpha(mixColor(MIASMA_DARK, hex('#d6f58a'), x / 64), Math.round(170 * (x / 64))) : null;
}), false);

// Pickups: silver penny / healing herbs / holy relic / tithe chest.
art('pickup/xp', 12, 12, (c) => { c.circle(6, 6, 5, hex('#c8ccd4')); c.circle(6, 6, 3.5, hex('#e8ebf0')); c.rect(5, 4, 2, 4, hex('#9aa0aa')); });
art('pickup/heal', 20, 20, (c) => {
  for (const [x, a] of [[6, -0.5], [10, 0], [14, 0.5]]) { c.line(10, 18, x + a * 4, 5, 2, hex('#4f8f3a')); c.ellipse(x + a * 4, 6, 3, 4, hex('#78c060')); }
  c.rect(7, 13, 6, 2, hex('#c9a45c'));
});
art('pickup/magnet', 24, 24, (c) => { c.rect(10, 2, 4, 20, GOLD); c.rect(4, 7, 16, 4, GOLD); c.rect(11, 3, 2, 18, hex('#ffe08a')); c.circle(12, 9, 2, hex('#c0392b')); });
art('pickup/chest', 28, 24, (c) => {
  c.rect(1, 6, 26, 17, WOOD); c.rect(1, 4, 26, 5, hex('#8e6440'));
  c.rect(1, 11, 26, 2, IRON_DARK); c.rect(6, 4, 2, 19, IRON_DARK); c.rect(20, 4, 2, 19, IRON_DARK);
  c.rect(12, 10, 4, 6, GOLD); c.rect(13, 13, 2, 2, INK);
});

// Tileset decorations: hay bale, barrel, cart wheel, grave cross, rocks.
const DECO = [
  (c) => { c.ellipse(16, 18, 13, 10, hex('#caa24a')); for (const y of [12, 17, 22]) c.line(5, y, 27, y, 1, hex('#9c7a2e')); c.line(10, 9, 10, 27, 1, hex('#7a5a1e')); c.line(22, 9, 22, 27, 1, hex('#7a5a1e')); },
  (c) => { c.ellipse(16, 17, 11, 13, WOOD); c.ellipse(16, 8, 9, 3.5, hex('#9a6c40')); for (const y of [11, 23]) c.rect(5, y, 22, 2, IRON_DARK); c.line(12, 6, 12, 29, 1, WOOD_DARK); c.line(20, 6, 20, 29, 1, WOOD_DARK); },
  (c) => { c.ring(16, 16, 11, 14, WOOD); c.circle(16, 16, 3, WOOD_DARK); for (let a = 0; a < 6; a++) c.line(16, 16, 16 + Math.cos(a * 1.047) * 12, 16 + Math.sin(a * 1.047) * 12, 2, WOOD); },
  (c) => { c.ellipse(16, 27, 9, 3, hex('#3b2c22')); c.rect(14, 5, 4, 22, hex('#8a6a4a')); c.rect(8, 10, 16, 4, hex('#8a6a4a')); c.rect(14, 5, 1, 22, hex('#a88a66')); },
  (c) => { c.ellipse(12, 19, 9, 7, hex('#7b7b73')); c.ellipse(21, 22, 7, 5, hex('#6a6a63')); c.ellipse(10, 16, 4, 2, hex('#9a9a90')); },
];
DECO.forEach((paint, i) => art(`deco/${i}`, 32, 32, paint));

const { atlas, json } = packAtlas(frames, 'sprites.png', 2048);
writePng(join(OUT, 'sprites.png'), atlas);
writeFileSync(join(OUT, 'sprites.json'), JSON.stringify(json, null, 1) + '\n');

// Muddy village lane: a large seamless tile (so repeats aren't obvious) with a few wet patches and straw.
const G = 512;
const ground = new Canvas(G, G);
const mud = tileNoise(5, 8), fine = tileNoise(9, 48), wobble = tileNoise(21, 12);
ground.shade(0, 0, G - 1, G - 1, (x, y) => mixColor(hex('#3d2e22'), hex('#65503a'), mud(x / G, y / G) * 0.7 + fine(x / G, y / G) * 0.3));
const scatter = lcg(77);
for (let i = 0; i < 3; i++) { // wet patches: irregular blobs, darker mud with a faint sheen
  const cx = scatter() * G, cy = scatter() * G, r = 26 + scatter() * 22;
  for (let dy = -r * 1.4; dy <= r * 1.4; dy++)
    for (let dx = -r * 1.4; dx <= r * 1.4; dx++) {
      const x = cx + dx, y = cy + dy, w = r * (0.75 + 0.5 * wobble(((x % G) + G) % G / G, ((y % G) + G) % G / G));
      const d = Math.hypot(dx, dy * 1.3);
      if (d < w) ground.blendWrap(x, y, d > w - 2 ? hex('#6f6a5e', 110) : withAlpha(mixColor(hex('#261c16'), hex('#3a3430'), fine(x / G, y / G)), 200));
    }
}
for (let i = 0; i < 260; i++) {
  const x = scatter() * G, y = scatter() * G, a = scatter() * Math.PI, l = 3 + scatter() * 5;
  for (let t = 0; t < l; t++) ground.blendWrap(x + Math.cos(a) * t, y + Math.sin(a) * t, hex('#c2a45a', 170));
}
writePng(join(OUT, 'ground.png'), ground);

// ------------------------------------------------------------------ audio (placeholder)

const SFX = {
  hit: noise(0.07, 0.5, 0.15),
  pickup: bell(1800, 0.25, 0.15),
  levelUp: concat(bell(hz('D5'), 0.18, 0.25), bell(hz('F5'), 0.18, 0.25), bell(hz('A5'), 0.5, 0.3)),
  chest: mix(bell(hz('D5'), 1.2, 0.25), place(silence(1.2), bell(hz('A5'), 1, 0.2), 0.12), place(silence(1.2), bell(hz('D6'), 0.9, 0.18), 0.24)),
  playerHurt: mix(noise(0.15, 0.5, 0.08), tone(180, 90, 0.18, 'tri', 0.3)),
  bossTelegraph: bell(hz('D3'), 1.2, 0.45),
  win: concat(...['D4', 'F4', 'A4', 'D5'].map((n) => bell(hz(n), 0.35, 0.3)), bell(hz('D5'), 1.6, 0.35)),
  lose: concat(...['A3', 'F3', 'E3'].map((n) => pluck(hz(n), 0.4, 0.4, 0.99)), pluck(hz('D3'), 1.4, 0.4, 0.995)),
  fire_sweep: noise(0.16, 0.35, 0.45, 0.03),
  fire_shot: mix(pluck(hz('A3'), 0.15, 0.4, 0.97), noise(0.05, 0.2, 0.6)),
  fire_orbit: noise(0.08, 0.2, 0.7, 0.02),
  fire_aura: noise(0.2, 0.12, 0.05, 0.05),
  fire_chain: concat(noise(0.03, 0.3, 0.9), noise(0.04, 0.25, 0.8), noise(0.06, 0.2, 0.7)),
  fire_pulse: bell(hz('G3'), 0.9, 0.4),
  fire_lure: mix(noise(0.08, 0.35, 0.1), tone(140, 70, 0.1, 'sine', 0.3)),
};
const sprite = audioSprite(SFX);
writeFileSync(join(OUT, 'sfx.wav'), wav(sprite.samples));
writeFileSync(join(OUT, 'sfx.json'), JSON.stringify({ resources: ['sfx.wav'], spritemap: sprite.spritemap }, null, 2) + '\n');

/** A lute tune in D dorian over a drone; `notes` are [name, beats]. */
function lute(notes, beat, drone, vol = 0.3) {
  const total = notes.reduce((s, [, b]) => s + b, 0) * beat;
  const track = new Float32Array(Math.ceil(total * RATE));
  let t = 0;
  for (const [n, b] of notes) { if (n !== '-') place(track, pluck(hz(n), b * beat + 0.3, vol, 0.997), t); t += b * beat; }
  for (let s = 0; s < total; s += beat * 4) place(track, pluck(hz(drone), beat * 4, vol * 0.6, 0.999), s);
  return track;
}
const MENU = [['D4', 2], ['F4', 1], ['G4', 1], ['A4', 2], ['G4', 1], ['F4', 1], ['E4', 2], ['C4', 1], ['D4', 1], ['E4', 2], ['-', 2],
  ['A4', 2], ['C5', 1], ['B4', 1], ['A4', 2], ['G4', 1], ['E4', 1], ['F4', 2], ['E4', 1], ['C4', 1], ['D4', 4]];
const GAME = [['D4', 1], ['A4', 1], ['F4', 1], ['A4', 1], ['D4', 1], ['B4', 1], ['G4', 1], ['B4', 1], ['C4', 1], ['G4', 1], ['E4', 1], ['G4', 1], ['D4', 1], ['A4', 1], ['F4', 1], ['A4', 1],
  ['D5', 1], ['C5', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['G4', 1], ['A4', 1], ['C5', 1], ['B4', 1], ['G4', 1], ['E4', 1], ['C4', 1], ['D4', 2], ['A3', 2]];
writeFileSync(join(OUT, 'music-menu.wav'), wav(lute(MENU, 0.42, 'D3')));
writeFileSync(join(OUT, 'music-game.wav'), wav(lute(GAME, 0.22, 'D3', 0.25)));

const CUT_SECONDS = 4;
const CUT_ROOTS = { sweep: 'D4', shot: 'E4', orbit: 'F4', aura: 'G4', chain: 'A4', pulse: 'C4', lure: 'Bb3' };
for (const w of WEAPONS) {
  const r = hz(CUT_ROOTS[w]);
  const clip = mix(bell(r, CUT_SECONDS, 0.3), place(silence(CUT_SECONDS), bell(r * 1.5, CUT_SECONDS - 0.4, 0.2), 0.4), place(silence(CUT_SECONDS), bell(r * 2, CUT_SECONDS - 0.8, 0.15), 0.8));
  writeFileSync(join(OUT, `cut/${w}.wav`), wav(clip));
}

// ------------------------------------------------------------------ Cutscene title cards (placeholder clips need ffmpeg)

const parchment = (card) => {
  const n = tileNoise(31, 10);
  card.shade(0, 0, 1279, 719, (x, y) => mixColor(hex('#d9c190'), hex('#b89660'), n(x / 1280, y / 720)));
  card.rect(40, 40, 1200, 8, hex('#6b4a28'));
  card.rect(40, 672, 1200, 8, hex('#6b4a28'));
};
const titleCard = (weapon) => ({
  weapon,
  png: iconCard(frames.find((f) => f.name === `${weapon}/icon`).c, join(CACHE, `${ID}-card-${weapon}.png`), parchment),
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
console.log(`Plague Village: ${frames.length} frames (${json.meta.size.w}x${json.meta.size.h} atlas), ${credits.length} LPC credit rows.`);
