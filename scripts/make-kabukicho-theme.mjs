// Builds the Kabukicho Theme: LPC characters (composed from the pinned generator repo) with drawn-on
// yakuza tattoos, custom neon effect/pickup/tileset art, placeholder audio, credits, and placeholder
// Cutscenes if ffmpeg exists.
// Usage: npm run assets:kabukicho   (ULPC_DIR overrides the generator checkout, default .cache/ulpc)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioSprite, concat, hz, mix, noise, place, RATE, silence, tone, wav } from './lib/audio.mjs';
import { iconCard, writePlaceholderClips } from './lib/cutscenes.mjs';
import { creditsCsv, crowd, FRAME, Lpc, walkFrames } from './lib/lpc.mjs';
import { Canvas, hex, lcg, mixColor, packAtlas, tileNoise, withAlpha, writePng } from './lib/raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'kabukicho';
const OUT = join(ROOT, 'public/assets/themes', ID);
const CACHE = join(ROOT, '.cache');
mkdirSync(join(OUT, 'cut'), { recursive: true });
mkdirSync(CACHE, { recursive: true });

const WEAPONS = ['sweep', 'shot', 'orbit', 'aura', 'chain', 'pulse', 'lure'];

// ------------------------------------------------------------------ LPC characters

const skin = (item, color) => ({ item, color, material: 'body' });

/** Recipes for every actor slot. Items are sheet_definitions file names in the LPC generator. */
const RECIPES = {
  'lure-start': { // Host-club Host: bleached hair, sharp suit, silver chain
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male', 'light'),
      { item: 'legs_pants', color: 'black' }, { item: 'feet_shoes_revised', color: 'black' },
      { item: 'torso_clothes_longsleeve_formal', color: 'white' }, { item: 'torso_jacket_collared', color: 'navy' },
      { item: 'neck_necklace_chain', color: 'silver' }, { item: 'hair_idol', color: 'platinum' },
    ],
  },
  'sweep-start': { // Retired Yakuza: grey buzz cut, short sleeves over tattooed arms
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male_elderly', 'light'), skin('head_wrinkles', 'light'),
      { item: 'legs_pants', color: 'charcoal' }, { item: 'feet_shoes_revised', color: 'black' },
      { item: 'torso_clothes_shortsleeve', color: 'maroon' },
      { item: 'hair_buzzcut', color: 'gray' }, { item: 'beards_5oclock_shadow', color: 'gray' },
    ],
    tattoos: true,
  },
  swarmer: { // Drunk Salarymen: flushed face, tie round the head
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male_plump', 'light'), { ...skin('face_blush', 'light'), vars: { head: 'male' } },
      { item: 'legs_pants', color: 'charcoal' }, { item: 'feet_shoes_revised', color: 'black' },
      { item: 'torso_clothes_longsleeve_formal', color: 'white' }, { item: 'neck_necktie', color: 'navy' },
      { item: 'hair_parted', color: 'black' }, { item: 'hat_headband_tied', color: 'red' },
    ],
  },
  fragment: { // Lone Touts (the Tout Crew below is three of these)
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male', 'light'),
      { item: 'legs_pants', color: 'black' }, { item: 'feet_shoes_revised', color: 'black' },
      { item: 'torso_clothes_longsleeve_formal', color: 'white' }, { item: 'torso_jacket_collared', color: 'black' },
      { item: 'hair_spiked', color: 'gold' }, { item: 'facial_earring_left', color: 'silver' },
    ],
  },
  tank: { // Bouncer: black suit, shades, shaved head (scaled up in theme.json)
    body: 'male',
    layers: [
      { item: 'body', color: 'bronze' }, skin('heads_human_male', 'bronze'),
      { item: 'legs_pants', color: 'black' }, { item: 'feet_shoes_revised', color: 'black' },
      { item: 'torso_clothes_longsleeve_formal', color: 'white' }, { item: 'torso_jacket_collared', color: 'black' },
      { item: 'neck_necktie', color: 'black' }, { item: 'facial_glasses_shades', color: 'black' },
      { item: 'hair_buzzcut', color: 'black' },
    ],
  },
  ranged: { // Bottle-throwing Yakuza: punch perm, loud shirt, white slacks, tattoos
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male', 'light'),
      { item: 'legs_pants', color: 'white' }, { item: 'feet_shoes_revised', color: 'white' },
      { item: 'torso_clothes_shortsleeve', color: 'purple' }, { item: 'neck_necklace_chain', color: 'gold' },
      { item: 'hair_curly_short', color: 'black' }, { item: 'facial_glasses_shades', color: 'black' },
    ],
    tattoos: true,
  },
  boss: { // Yakuza Boss: white suit, jacket worn as a cape, gold chain, cane
    body: 'male',
    layers: [
      { item: 'body', color: 'light' }, skin('heads_human_male_elderly', 'light'), skin('head_wrinkles', 'light'),
      { item: 'legs_pants', color: 'white' }, { item: 'feet_shoes_revised', color: 'black' },
      { item: 'torso_clothes_longsleeve_formal', color: 'white' }, { item: 'torso_jacket_collared', color: 'white' },
      { item: 'cape_solid', color: 'black' }, { item: 'neck_necklace_chain', color: 'gold' },
      { item: 'hair_balding', color: 'white' }, { item: 'facial_glasses_shades', color: 'gold' },
      { item: 'weapon_polearm_cane', variant: 'cane' },
    ],
  },
};

const INK = hex('#0b0710');
const TATTOO = [hex('#27347a'), hex('#c02a33'), hex('#1f7a66')]; // irezumi indigo ground, red and teal motifs
const tattooNoise = tileNoise(41, 36);

/**
 * LPC has no tattoos. Recolour the bare skin below the head (the arms) in an irezumi pattern:
 * an indigo ground with red and teal patches. Bare skin is where the finished sheet still shows the
 * body layer and the head doesn't cover it; the bottom two skin pixels of each arm (the hands) stay bare.
 */
function addTattoos(sheet, bodySheet, headSheet) {
  const same = (a, b) => a[3] && b[3] && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  const bare = (x, y) => y < sheet.h && same(sheet.get(x, y), bodySheet.get(x, y)) && !headSheet.get(x, y)[3];
  for (let y = 0; y < sheet.h; y++)
    for (let x = 0; x < sheet.w; x++) {
      if (y % FRAME < 30 || !bare(x, y) || !bare(x, y + 1) || !bare(x, y + 2)) continue;
      const n = tattooNoise((x % FRAME) / FRAME, (y % FRAME) / FRAME);
      const ink = n > 0.68 ? TATTOO[1] : n < 0.3 ? TATTOO[2] : TATTOO[0];
      const c = mixColor(sheet.get(x, y), ink, 0.7);
      sheet.px.set([c[0], c[1], c[2]], (y * sheet.w + x) * 4); // rows below are still untouched, so `bare` stays valid
    }
}

const lpc = new Lpc(process.env.ULPC_DIR ?? join(CACHE, 'ulpc'));
const frames = [];
for (const [actor, recipe] of Object.entries(RECIPES)) {
  const sheet = lpc.compose(recipe);
  if (recipe.tattoos) {
    const heads = recipe.layers.map((l) => l.item).filter((item) => item.startsWith('head'));
    addTattoos(sheet, lpc.composeOnly(recipe, ['body']), lpc.composeOnly(recipe, heads));
  }
  writePng(join(CACHE, `${ID}-${actor}.png`), sheet); // for inspection
  frames.push(...walkFrames(actor, sheet));
  if (actor === 'fragment') { const c = crowd(sheet); frames.push(...walkFrames('splitter', c.sheet, c.width)); } // the Tout Crew
}

// ------------------------------------------------------------------ custom art (effects, pickups, tileset)

const art = (name, w, h, paint, outline = true) => {
  const c = new Canvas(w, h);
  paint(c);
  if (outline) c.outline(withAlpha(INK, 220));
  frames.push({ name, c });
  return c;
};

const PINK = hex('#ff3ea5'), CYAN = hex('#35f0ff'), VIOLET = hex('#9b5cff'), AMBER = hex('#ffb13b'), RED = hex('#ff2d3f');
const WHITE = hex('#fff6fb'), CHROME = hex('#d7dce6'), CHROME_DARK = hex('#7c8494'), GUNMETAL = hex('#3a3f4a');
const WOOD = hex('#d9a766'), WOOD_DARK = hex('#9a6a34'), SMOKE = hex('#9aa3b8'), BILL = hex('#d8cfae'), BILL_INK = hex('#8a6e4a');
const GOLD = hex('#f2c14e'), GOLD_DARK = hex('#a97c1e'), GLASS = hex('#3f8a4a'), GLASS_LIGHT = hex('#9ee0a0');

// Baseball Bat swing: a pale motion-blur crescent with a pink neon leading edge, pointing right.
art('sweep/arc', 128, 128, (c) => c.shade(0, 0, 127, 127, (x, y) => {
  const d = Math.hypot(x - 64, y - 64), a = Math.atan2(y - 64, x - 64);
  if (d < 30 || d > 62 || Math.abs(a) > 1.22) return null;
  const t = (d - 30) / 32, fade = Math.min(1, (1 - Math.abs(a) / 1.22) * 2.2);
  return t > 0.86 ? withAlpha(PINK, Math.round(230 * fade)) : withAlpha(mixColor(WOOD, WHITE, t), Math.round(200 * fade * (0.3 + 0.7 * t)));
}), false);
// Handgun round with a short tracer, pointing right.
art('shot/proj', 16, 8, (c) => {
  c.line(0, 4, 9, 4, 2, withAlpha(AMBER, 140));
  c.rect(8, 2, 5, 4, GOLD);
  c.ellipse(13, 4, 2.5, 2, hex('#c98a3a'));
  c.rect(8, 2, 5, 1, hex('#fff0b0'));
});
// Pachinko ball: a chrome sphere reflecting pink neon.
art('orbit/blade', 14, 14, (c) => {
  c.radial(7, 7, 6, (t, x, y) => mixColor(y > 8 ? mixColor(CHROME, PINK, 0.35) : WHITE, CHROME_DARK, t * 0.9));
  c.circle(5, 5, 1.5, WHITE);
});
// Cigarette Smoke: drifting grey-blue haze with a faint rim.
const smoke = tileNoise(13, 6);
art('aura/field', 128, 128, (c) => c.radial(64, 64, 62, (t, x, y) => {
  const n = smoke(x / 128, y / 128);
  const a = t > 0.93 ? 140 : 30 + 80 * n * (1 - t * 0.5);
  return withAlpha(mixColor(SMOKE, hex('#cfc4e0'), n), Math.round(a));
}), false);
// Shorted Neon Sign: a jagged pink arc with a white-and-cyan core.
art('chain/bolt', 64, 8, (c) => {
  const r = lcg(5);
  let y = 4;
  for (let x = 0; x < 64; x += 4) {
    const ny = 2 + r() * 4;
    c.line(x, y, x + 4, ny, 3, withAlpha(PINK, 160));
    c.line(x, y, x + 4, ny, 1, x % 8 ? WHITE : CYAN);
    y = ny;
  }
}, false);
// Karaoke Mic Scream: a magenta sound ring with a cyan inner echo.
art('pulse/ring', 128, 128, (c) => {
  c.ring(64, 64, 52, 62, withAlpha(PINK, 190));
  c.ring(64, 64, 56, 59, withAlpha(WHITE, 230));
  c.ring(64, 64, 44, 46, withAlpha(CYAN, 150));
}, false);
// Cash: a banded stack of banknotes.
const bill = (c, x, y, w, h) => {
  c.rect(x, y, w, h, BILL);
  c.rect(x + 1, y + 1, w - 2, 1, BILL_INK);
  c.circle(x + w - 5, y + h / 2, 2, BILL_INK);
  c.rect(x + 2, y + h - 3, 5, 1, BILL_INK);
};
const BAND = hex('#c0392b');
art('lure/bait', 24, 20, (c) => { bill(c, 1, 9, 20, 9); bill(c, 2, 5, 20, 9); bill(c, 3, 1, 20, 9); c.rect(10, 1, 3, 17, BAND); });

/** 32 px neon-sign icon: a dark panel with a pink tube border and a picture inside. */
const icon = (weapon, paint) => art(`${weapon}/icon`, 32, 32, (c) => {
  c.rect(1, 1, 30, 30, PINK);
  c.rect(2, 2, 28, 28, hex('#1c1028'));
  paint(c);
});
icon('sweep', (c) => { c.line(8, 25, 24, 7, 4, WOOD); c.line(8, 25, 12, 20.5, 2, WOOD_DARK); c.line(11, 22, 23, 8, 1, hex('#f2d09a')); });
icon('shot', (c) => {
  c.rect(7, 11, 18, 5, GUNMETAL); c.rect(7, 11, 18, 1, CHROME_DARK);
  c.poly([[10, 16], [15, 16], [13, 25], [8, 25]], GUNMETAL); c.rect(15, 16, 3, 3, CHROME_DARK); c.rect(25, 12, 2, 3, AMBER);
});
icon('orbit', (c) => {
  for (const [x, y] of [[11, 12], [21, 12], [16, 21]]) { c.circle(x, y, 4.5, CHROME_DARK); c.circle(x, y, 3.5, CHROME); c.circle(x - 1, y - 1, 1.2, WHITE); }
});
icon('aura', (c) => {
  c.line(6, 24, 20, 17, 3, WHITE); c.line(20, 17, 24, 15, 3, AMBER); c.circle(25, 14.5, 1.5, RED);
  c.circle(20, 9, 3, withAlpha(SMOKE, 200)); c.circle(24, 6, 2.5, withAlpha(SMOKE, 160)); c.circle(15, 7, 2, withAlpha(SMOKE, 140));
});
icon('chain', (c) => {
  c.line(6, 9, 15, 9, 2, CYAN); c.line(6, 9, 6, 20, 2, CYAN); c.line(6, 20, 12, 20, 2, CYAN); c.line(18, 16, 25, 23, 2, withAlpha(CYAN, 110));
  c.line(15, 9, 18, 13, 1, WHITE); c.line(18, 13, 14, 15, 1, AMBER); c.line(14, 15, 19, 19, 1, WHITE);
});
icon('pulse', (c) => {
  c.circle(13, 11, 5, CHROME_DARK); c.circle(13, 11, 4, CHROME); c.line(13, 16, 13, 27, 3, GUNMETAL);
  for (const r of [7, 10]) c.sector(13, 11, r, r + 1, -0.9, 0.9, PINK);
});
icon('lure', (c) => { bill(c, 5, 16, 22, 10); bill(c, 6, 11, 22, 10); bill(c, 7, 6, 20, 10); c.rect(15, 6, 3, 20, BAND); });

// Enemy and Boss effects.
// Thrown beer bottle, pointing right.
art('ranged/proj', 16, 8, (c) => {
  c.rect(1, 2, 9, 5, GLASS); c.poly([[10, 2], [13, 3], [13, 6], [10, 7]], GLASS); c.rect(13, 3, 2, 3, GOLD);
  c.rect(2, 3, 7, 1, GLASS_LIGHT); c.rect(3, 4, 4, 2, hex('#e8e0c8'));
});
art('boss/proj', 16, 16, (c) => c.radial(8, 8, 7, (t) => withAlpha(mixColor(hex('#ffe3a0'), RED, t), 255 - t * 60)));
art('boss/telegraph_line', 64, 16, (c) => c.shade(0, 0, 63, 15, (x, y) => (Math.floor((x + y) / 4) % 2 ? withAlpha(RED, 120) : withAlpha(AMBER, 70))), false);
art('boss/telegraph_ring', 128, 128, (c) => { c.ring(64, 64, 50, 62, withAlpha(RED, 90)); c.ring(64, 64, 58, 60, withAlpha(hex('#ffc0c8'), 200)); }, false);
art('boss/charge', 64, 32, (c) => c.shade(0, 0, 63, 31, (x, y) => {
  const half = (x / 64) * 16;
  return Math.abs(y - 16) <= half ? withAlpha(mixColor(RED, WHITE, x / 64), Math.round(170 * (x / 64))) : null;
}), false);

// Pickups: five-yen coin / energy drink / lucky cat / hostess-club gift box.
art('pickup/xp', 12, 12, (c) => { c.ring(6, 6, 1.8, 5, GOLD); c.ring(6, 6, 3.4, 4, GOLD_DARK); c.rect(3, 3, 2, 1, hex('#fff0b0')); });
art('pickup/heal', 12, 20, (c) => {
  c.rect(2, 2, 8, 17, hex('#2656c9')); c.rect(2, 1, 8, 2, CHROME); c.rect(2, 18, 8, 1, CHROME_DARK);
  c.poly([[7, 5], [4, 11], [6, 11], [5, 16], [8, 9], [6, 9]], hex('#ffe23a'));
  c.rect(3, 3, 1, 14, withAlpha(WHITE, 120));
});
art('pickup/magnet', 24, 24, (c) => {
  c.ellipse(12, 16, 8, 7, WHITE); c.circle(12, 9, 6.5, WHITE); // body, head
  c.poly([[6, 5], [7, 0], [10, 4]], WHITE); c.poly([[14, 4], [17, 0], [18, 5]], WHITE); // ears
  c.ellipse(20, 6, 2.5, 5, WHITE); // raised paw
  c.rect(8, 8, 2, 1, INK); c.rect(14, 8, 2, 1, INK); c.rect(11, 11, 2, 1, PINK);
  c.rect(6, 14, 12, 2, RED); c.circle(12, 17, 2, GOLD); // collar and bell
  c.ellipse(12, 20, 4, 2.5, GOLD); // koban coin
});
art('pickup/chest', 28, 24, (c) => {
  c.rect(2, 8, 24, 15, PINK); c.rect(1, 5, 26, 5, hex('#ff7cc4'));
  c.rect(12, 5, 4, 18, GOLD); c.rect(1, 12, 26, 3, GOLD);
  c.ellipse(9, 4, 5, 3, GOLD); c.ellipse(19, 4, 5, 3, GOLD); c.circle(14, 4, 2, GOLD_DARK);
});

// Tileset decorations: traffic cone, rubbish bags, beer crate, manhole cover, dropped umbrella, cigarette butts.
const DECO = [
  (c) => { c.ellipse(16, 27, 10, 3, hex('#222222')); c.poly([[16, 4], [22, 26], [10, 26]], hex('#ff6a1a')); c.rect(12, 14, 8, 3, WHITE); c.rect(8, 25, 16, 3, hex('#e2530f')); },
  (c) => {
    c.ellipse(11, 20, 9, 8, hex('#262a36')); c.ellipse(21, 22, 8, 7, hex('#2f3f7a')); c.ellipse(16, 13, 7, 6, hex('#30343f'));
    c.ellipse(9, 17, 3, 2, hex('#4a5060')); c.ellipse(19, 19, 3, 2, hex('#5a6fb0')); c.line(16, 6, 16, 9, 1, hex('#8a8a8a'));
  },
  (c) => {
    c.rect(4, 12, 24, 15, hex('#f2c230')); c.rect(4, 12, 24, 2, hex('#ffe070'));
    for (const x of [8, 14, 20]) { c.rect(x, 5, 4, 8, GLASS); c.rect(x + 1, 3, 2, 2, GOLD); c.rect(x + 1, 6, 1, 5, GLASS_LIGHT); }
    for (const x of [9, 17]) c.rect(x, 18, 6, 4, hex('#c79a1a'));
  },
  (c) => { c.circle(16, 16, 13, hex('#3b3e45')); c.ring(16, 16, 11, 13, hex('#23252b')); for (let y = 8; y <= 24; y += 4) c.line(7, y, 25, y, 1, hex('#565a63')); c.circle(16, 16, 3, hex('#2b2d33')); },
  (c) => {
    c.sector(15, 18, 0, 12, -Math.PI, 0, withAlpha(hex('#dfe8f0'), 150));
    for (let a = -Math.PI; a <= 0.01; a += Math.PI / 4) c.line(15, 18, 15 + Math.cos(a) * 12, 18 + Math.sin(a) * 12, 1, hex('#aab4c0'));
    c.line(15, 18, 26, 27, 1, hex('#555566')); c.line(26, 27, 24, 29, 2, hex('#222233'));
  },
  (c) => {
    const r = lcg(9);
    for (let i = 0; i < 6; i++) {
      const x = 6 + r() * 20, y = 8 + r() * 18, a = r() * Math.PI;
      c.line(x, y, x + Math.cos(a) * 5, y + Math.sin(a) * 5, 2, WHITE); c.line(x, y, x + Math.cos(a) * 2, y + Math.sin(a) * 2, 2, hex('#d99a4a'));
    }
  },
];
DECO.forEach((paint, i) => art(`deco/${i}`, 32, 32, paint));

const { atlas, json } = packAtlas(frames, 'sprites.png', 2048);
writePng(join(OUT, 'sprites.png'), atlas);
writeFileSync(join(OUT, 'sprites.json'), JSON.stringify(json, null, 1) + '\n');

// Wet neon-lit alley pavement: dark paving slabs in running bond, puddles that mirror the signs as
// vertical pink, cyan, violet and amber smears, and scattered litter. A large seamless tile so repeats aren't obvious.
const G = 512, SLAB_W = 64, SLAB_H = 32;
const ground = new Canvas(G, G);
const grain = tileNoise(5, 64), damp = tileNoise(17, 8), slabTone = lcg(31);
const tones = Array.from({ length: (G / SLAB_W) * (G / SLAB_H) }, () => slabTone());
ground.shade(0, 0, G - 1, G - 1, (x, y) => {
  const row = Math.floor(y / SLAB_H), sx = (x + (row % 2) * (SLAB_W / 2)) % G, col = Math.floor(sx / SLAB_W);
  if (y % SLAB_H < 2 || sx % SLAB_W < 2) return hex('#0c0c12'); // joints
  const base = mixColor(hex('#1b1b24'), hex('#2a2a36'), tones[row * (G / SLAB_W) + col] * 0.6 + grain(x / G, y / G) * 0.4);
  return mixColor(base, hex('#3a3050'), Math.max(0, damp(x / G, y / G) - 0.55) * 1.6); // damp patches catch a little light
});
const scatter = lcg(88);
const NEON = [PINK, CYAN, VIOLET, AMBER];
const wobble = tileNoise(23, 16), signLight = tileNoise(29, 3);
for (let i = 0; i < 6; i++) { // puddles: irregular, soft-edged, with streaky sign reflections that fade toward the viewer
  const cx = scatter() * G, cy = scatter() * G, rx = 28 + scatter() * 30, ry = rx * (0.45 + scatter() * 0.2);
  const tint = NEON[i % NEON.length], streaks = Array.from({ length: 4 }, () => [(scatter() * 2 - 1) * rx * 0.8, 2 + scatter() * 5]);
  for (let dy = -ry * 1.3; dy <= ry * 1.3; dy++)
    for (let dx = -rx * 1.3; dx <= rx * 1.3; dx++) {
      const u = (((cx + dx) % G) + G) % G / G, v = (((cy + dy) % G) + G) % G / G;
      const d = Math.hypot(dx / rx, dy / ry) / (0.75 + 0.5 * wobble(u, v));
      if (d > 1) continue;
      const glow = Math.max(...streaks.map(([sx, w]) => Math.max(0, 1 - Math.abs(dx - sx) / w))) * (0.4 + 0.6 * (1 - (dy / ry + 1) / 2));
      ground.blendWrap(cx + dx, cy + dy, withAlpha(mixColor(hex('#0b0b14'), tint, glow * 0.65), Math.round(215 * Math.min(1, (1 - d) * 4))));
    }
}
// Spill from the signs overhead: broad, faint pink and cyan washes.
for (let y = 0; y < G; y++)
  for (let x = 0; x < G; x++) {
    const n = signLight(x / G, y / G);
    if (n > 0.62) ground.blend(x, y, withAlpha(PINK, Math.round((n - 0.62) * 90)));
    else if (n < 0.3) ground.blend(x, y, withAlpha(CYAN, Math.round((0.3 - n) * 70)));
  }
for (let i = 0; i < 140; i++) { // litter: flyers, bottle caps, neon-lit wet spots
  const x = scatter() * G, y = scatter() * G, k = scatter();
  if (k < 0.3) for (let t = 0; t < 3; t++) ground.blendWrap(x + t, y, hex('#e8e0d0', 200));
  else if (k < 0.5) { ground.blendWrap(x, y, withAlpha(GOLD, 220)); ground.blendWrap(x + 1, y, withAlpha(GOLD_DARK, 220)); }
  else if (k < 0.58) for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 5; dx++) ground.blendWrap(x + dx, y + dy, withAlpha(NEON[i % 4], 90));
}
writePng(join(OUT, 'ground.png'), ground);

// ------------------------------------------------------------------ audio (placeholder)

/** Electric-piano-like note: a sine with a soft octave partial and an exponential decay. */
function ep(freq, dur, vol = 0.25) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    out[i] = (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t) * Math.exp(-t * 6)) * vol * Math.exp(-t * 2.2) * Math.min(1, i / 40);
  }
  return out;
}

/** Sustained, low-passed detuned saw with attack and release: a synth pad or bass. */
function synth(freq, dur, vol = 0.12, cutoff = 0.08, attack = 0.05, release = 0.25) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  let p1 = 0, p2 = 0, y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    p1 += freq / RATE; p2 += (freq * 1.006) / RATE;
    y += cutoff * ((p1 % 1) + (p2 % 1) - 1 - y);
    out[i] = y * vol * Math.min(1, t / attack, (dur - t) / release);
  }
  return out;
}

const kick = () => tone(130, 40, 0.18, 'sine', 0.6);
const hat = () => noise(0.04, 0.12, 0.9);

const pings = (count, seed) => { // pachinko balls rattling down the pins
  const r = lcg(seed);
  return concat(...Array.from({ length: count }, () => concat(tone(2600 + r() * 1400, 2400, 0.025, 'tri', 0.2), silence(0.015 + r() * 0.02))));
};
const SFX = {
  hit: noise(0.07, 0.5, 0.2),
  pickup: concat(tone(hz('B5'), hz('B5'), 0.06, 'square', 0.12), tone(hz('E6'), hz('E6'), 0.22, 'square', 0.12)),
  levelUp: concat(...['A4', 'C5', 'E5'].map((n) => ep(hz(n), 0.14, 0.3)), ep(hz('A5'), 0.6, 0.35)),
  chest: mix(ep(hz('E5'), 1.3, 0.3), place(silence(1.3), ep(hz('G#5'), 1.1, 0.25), 0.12), place(silence(1.3), ep(hz('B5'), 1, 0.25), 0.24), place(silence(1.3), pings(6, 3), 0.3)),
  playerHurt: mix(noise(0.15, 0.5, 0.1), tone(220, 90, 0.2, 'saw', 0.2)),
  bossTelegraph: concat(tone(420, 880, 0.45, 'saw', 0.18), tone(880, 420, 0.45, 'saw', 0.18)),
  win: concat(...['A4', 'C#5', 'E5', 'A5'].map((n) => ep(hz(n), 0.25, 0.3)), mix(ep(hz('A5'), 1.6, 0.3), ep(hz('E5'), 1.6, 0.2), ep(hz('C#5'), 1.6, 0.2))),
  lose: concat(...['E4', 'C4', 'A3'].map((n) => synth(hz(n), 0.4, 0.2, 0.05, 0.01, 0.1)), synth(hz('F3'), 1.4, 0.2, 0.04, 0.01, 0.8)),
  fire_sweep: mix(noise(0.14, 0.3, 0.4, 0.03), place(silence(0.14), tone(1300, 500, 0.06, 'tri', 0.4), 0.08)),
  fire_shot: mix(noise(0.12, 0.6, 0.7), tone(160, 50, 0.1, 'sine', 0.5)),
  fire_orbit: pings(3, 7),
  fire_aura: noise(0.25, 0.15, 0.08, 0.08),
  fire_chain: mix(tone(120, 120, 0.22, 'square', 0.12), concat(noise(0.03, 0.35, 0.9), silence(0.04), noise(0.05, 0.3, 0.85), silence(0.03), noise(0.06, 0.25, 0.8))),
  fire_pulse: mix(tone(1800, 2500, 0.5, 'sine', 0.18), noise(0.3, 0.3, 0.3)),
  fire_lure: concat(noise(0.03, 0.3, 0.6), silence(0.02), noise(0.03, 0.3, 0.6), silence(0.02), noise(0.05, 0.3, 0.5)),
};
const sprite = audioSprite(SFX);
writeFileSync(join(OUT, 'sfx.wav'), wav(sprite.samples));
writeFileSync(join(OUT, 'sfx.json'), JSON.stringify({ resources: ['sfx.wav'], spritemap: sprite.spritemap }, null, 2) + '\n');

/**
 * Late-night city pop: a pad chord and bass per bar, an electric-piano line, and optionally a drum
 * machine. `chords` are [bass note, ...pad notes]; `melody` is [name, beats].
 */
function cityPop(chords, melody, beat, drums) {
  const bar = beat * 4, total = chords.length * bar;
  const track = new Float32Array(Math.ceil(total * RATE));
  chords.forEach(([bass, ...pad], i) => {
    for (const n of pad) place(track, synth(hz(n), bar, 0.05, 0.05, 0.3, 0.4), i * bar);
    for (let b = 0; b < 4; b += drums ? 0.5 : 2) place(track, synth(hz(bass), beat * (drums ? 0.45 : 1.8), 0.22, 0.06, 0.01, 0.08), i * bar + b * beat);
  });
  let t = 0;
  for (const [n, b] of melody) { if (n !== '-') place(track, ep(hz(n), b * beat + 0.4, 0.22), t); t += b * beat; }
  if (drums) for (let b = 0; b < total / beat; b++) { place(track, kick(), b * beat); place(track, hat(), (b + 0.5) * beat); }
  return track;
}
const MENU_CHORDS = [['A2', 'C4', 'E4', 'G4', 'B4'], ['F2', 'A3', 'C4', 'E4'], ['D2', 'F3', 'A3', 'C4', 'E4'], ['E2', 'G#3', 'B3', 'D4']];
const MENU = [['E5', 1.5], ['D5', 0.5], ['C5', 1], ['A4', 1], ['C5', 2], ['E5', 1], ['G5', 1], ['F5', 1.5], ['E5', 0.5], ['C5', 2],
  ['D5', 1], ['E5', 1], ['B4', 1], ['G#4', 1]];
const GAME_CHORDS = [['A2', 'C4', 'E4', 'A4'], ['F2', 'A3', 'C4', 'F4'], ['C3', 'E4', 'G4', 'C5'], ['G2', 'B3', 'D4', 'G4']];
const GAME = [['A4', 0.5], ['C5', 0.5], ['E5', 0.5], ['A5', 0.5], ['G5', 1], ['E5', 1], ['F5', 0.5], ['E5', 0.5], ['C5', 0.5], ['A4', 0.5], ['C5', 2],
  ['E5', 0.5], ['G5', 0.5], ['C6', 1], ['B5', 0.5], ['G5', 0.5], ['E5', 1], ['D5', 0.5], ['B4', 0.5], ['G4', 1], ['D5', 1], ['B4', 1]];
writeFileSync(join(OUT, 'music-menu.wav'), wav(cityPop(MENU_CHORDS, MENU, 0.72, false)));
writeFileSync(join(OUT, 'music-game.wav'), wav(cityPop(GAME_CHORDS, GAME, 0.46, true)));

const CUT_SECONDS = 4;
const CUT_ROOTS = { sweep: 'A3', shot: 'B3', orbit: 'C4', aura: 'D4', chain: 'E4', pulse: 'F3', lure: 'G3' };
for (const w of WEAPONS) {
  const r = hz(CUT_ROOTS[w]);
  const hum = tone(120, 120, CUT_SECONDS, 'square', 0.03); // the buzz of neon tubes
  const clip = mix(hum, synth(r / 2, CUT_SECONDS, 0.15, 0.05, 0.4, 1), ep(r, CUT_SECONDS, 0.25), place(silence(CUT_SECONDS), ep(r * 1.5, CUT_SECONDS - 0.4, 0.2), 0.4), place(silence(CUT_SECONDS), ep(r * 2, CUT_SECONDS - 0.8, 0.18), 0.8));
  writeFileSync(join(OUT, `cut/${w}.wav`), wav(clip));
}

// ------------------------------------------------------------------ Cutscene title cards (placeholder clips need ffmpeg)

const nightStreet = (card) => {
  const haze = tileNoise(37, 10), rain = lcg(12);
  card.shade(0, 0, 1279, 719, (x, y) => mixColor(mixColor(hex('#0d0a1a'), hex('#2a1238'), y / 720), hex('#123046'), haze(x / 1280, y / 720) * 0.35));
  for (let i = 0; i < 220; i++) { const x = rain() * 1280, y = rain() * 720; card.line(x, y, x - 6, y + 28, 1, hex('#9fb4d8', 60)); }
  card.rect(40, 40, 1200, 6, PINK);
  card.rect(40, 674, 1200, 6, CYAN);
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
console.log(`Kabukicho: ${frames.length} frames (${json.meta.size.w}x${json.meta.size.h} atlas), ${credits.length} LPC credit rows.`);
