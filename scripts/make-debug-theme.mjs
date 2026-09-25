// Generates the Debug Theme's programmer art, audio and (if ffmpeg is on PATH) placeholder Cutscenes.
// Usage: npm run assets:debug
// The frame and marker names must match src/game/theme/slots.ts; completeness.test.ts checks the result.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioSprite, concat, mix, silence, tone, wav } from './lib/audio.mjs';
import { iconCard, writePlaceholderClips } from './lib/cutscenes.mjs';
import { Canvas, hex, packAtlas, writePng } from './lib/raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/assets/themes/debug');
mkdirSync(join(OUT, 'cut'), { recursive: true });

const WEAPONS = ['sweep', 'shot', 'orbit', 'aura', 'chain', 'pulse', 'lure'];
const DIRS = ['up', 'left', 'down', 'right'];
const DIR_ANGLE = { up: -Math.PI / 2, left: Math.PI, down: Math.PI / 2, right: 0 };
const WALK_FRAMES = 4;
const DECORATIONS = 5;

// ---------------------------------------------------------------- sprites

const frames = [];
const frame = (name, w, h, paint) => { const c = new Canvas(w, h); paint(c); frames.push({ name, c }); };
const WHITE = hex('#ffffff'), DARK = hex('#1b1b24');

/** A direction marker so facing is visible without real art. */
function notch(c, cx, cy, r, dir) {
  const a = DIR_ANGLE[dir], tip = [cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6)];
  const l = [cx + Math.cos(a + 2.5) * (r - 4), cy + Math.sin(a + 2.5) * (r - 4)];
  const rr = [cx + Math.cos(a - 2.5) * (r - 4), cy + Math.sin(a - 2.5) * (r - 4)];
  c.poly([tip, l, rr], WHITE);
}

const ACTORS = {
  'shot-start':  (c, bob, dir, i) => { feet(c, i); c.circle(32, 38 + bob, 13, hex('#4aa3ff')); c.circle(32, 20 + bob, 9, hex('#f1d3b3')); notch(c, 32, 38 + bob, 13, dir); },
  'sweep-start': (c, bob, dir, i) => { feet(c, i); c.circle(32, 38 + bob, 13, hex('#5ad16b')); c.circle(32, 20 + bob, 9, hex('#f1d3b3')); notch(c, 32, 38 + bob, 13, dir); },
  swarmer:  (c, bob, dir) => { c.circle(32, 36 + bob, 12, hex('#e04848')); notch(c, 32, 36 + bob, 12, dir); },
  splitter: (c, bob, dir) => { c.rect(19, 23 + bob, 26, 26, hex('#f08a24')); c.line(19, 36 + bob, 45, 36 + bob, 2, DARK); c.line(32, 23 + bob, 32, 49 + bob, 2, DARK); notch(c, 32, 36 + bob, 13, dir); },
  fragment: (c, bob, dir) => { c.circle(32, 36 + bob, 10, hex('#f5b041')); notch(c, 32, 36 + bob, 10, dir); },
  tank:     (c, bob, dir) => { c.rect(14, 18 + bob, 36, 36, DARK); c.rect(17, 21 + bob, 30, 30, hex('#8a8f98')); notch(c, 32, 36 + bob, 18, dir); },
  ranged:   (c, bob, dir) => { c.poly([[32, 16 + bob], [50, 50 + bob], [14, 50 + bob]], hex('#a05ad6')); notch(c, 32, 38 + bob, 11, dir); },
  boss:     (c, bob, dir) => {
    c.circle(32, 38 + bob, 22, hex('#9b1c31'));
    c.poly([[16, 20 + bob], [22, 8 + bob], [27, 18 + bob], [32, 4 + bob], [37, 18 + bob], [42, 8 + bob], [48, 20 + bob]], hex('#ffd24a'));
    notch(c, 32, 38 + bob, 20, dir);
  },
};
function feet(c, i) { const s = i % 2 ? 3 : -3; c.rect(24 + s, 50, 6, 6, DARK); c.rect(34 - s, 50, 6, 6, DARK); }

for (const [actor, paint] of Object.entries(ACTORS))
  for (const dir of DIRS)
    for (let i = 0; i < WALK_FRAMES; i++) frame(`${actor}/walk_${dir}_${i}`, 64, 64, (c) => paint(c, i % 2 ? -2 : 0, dir, i));

const WEAPON_COLOR = { sweep: '#e8e8e8', shot: '#ffe066', orbit: '#5ce1e6', aura: '#7bd88f', chain: '#9ecbff', pulse: '#ffffff', lure: '#ffc233' };
// Effects are drawn pointing right / centred; the game scales and rotates them.
frame('sweep/arc', 128, 128, (c) => c.sector(64, 64, 34, 62, -1.22, 1.22, hex(WEAPON_COLOR.sweep, 200)));
frame('shot/proj', 16, 16, (c) => { c.circle(8, 8, 6, hex(WEAPON_COLOR.shot)); c.circle(8, 8, 3, WHITE); });
frame('orbit/blade', 24, 24, (c) => c.poly([[12, 1], [23, 12], [12, 23], [1, 12]], hex(WEAPON_COLOR.orbit)));
frame('aura/field', 128, 128, (c) => { c.circle(64, 64, 62, hex(WEAPON_COLOR.aura, 60)); c.ring(64, 64, 58, 62, hex(WEAPON_COLOR.aura, 160)); });
frame('chain/bolt', 64, 8, (c) => { c.rect(0, 2, 64, 4, hex(WEAPON_COLOR.chain)); c.rect(0, 3, 64, 2, WHITE); });
frame('pulse/ring', 128, 128, (c) => c.ring(64, 64, 54, 62, hex(WEAPON_COLOR.pulse, 220)));
frame('lure/bait', 24, 24, (c) => { c.circle(12, 12, 10, hex(WEAPON_COLOR.lure)); c.circle(12, 12, 6, hex('#b8860b')); });
for (const w of WEAPONS) frame(`${w}/icon`, 32, 32, (c) => { c.rect(0, 0, 32, 32, DARK); c.rect(2, 2, 28, 28, hex(WEAPON_COLOR[w])); c.rect(10, 10, 12, 12, DARK); });

frame('ranged/proj', 12, 12, (c) => c.circle(6, 6, 5, hex('#c38cf0')));
frame('boss/proj', 16, 16, (c) => { c.circle(8, 8, 7, hex('#ff4d4d')); c.circle(8, 8, 3, DARK); });
frame('boss/telegraph_line', 64, 16, (c) => c.rect(0, 0, 64, 16, hex('#ff2020', 90)));
frame('boss/telegraph_ring', 128, 128, (c) => c.ring(64, 64, 50, 62, hex('#ff2020', 110)));
frame('boss/charge', 64, 32, (c) => c.poly([[0, 16], [64, 0], [64, 32]], hex('#ffb3b3', 150)));

frame('pickup/xp', 12, 12, (c) => c.poly([[6, 0], [12, 6], [6, 12], [0, 6]], hex('#4fc3f7')));
frame('pickup/heal', 20, 20, (c) => { c.rect(7, 1, 6, 18, hex('#ff5a5a')); c.rect(1, 7, 18, 6, hex('#ff5a5a')); });
frame('pickup/magnet', 24, 24, (c) => { c.sector(12, 12, 5, 10, -Math.PI, 0, hex('#e04848')); c.rect(2, 12, 5, 8, hex('#e04848')); c.rect(17, 12, 5, 8, hex('#e04848')); c.rect(2, 18, 5, 3, hex('#cccccc')); c.rect(17, 18, 5, 3, hex('#cccccc')); });
frame('pickup/chest', 28, 24, (c) => { c.rect(0, 4, 28, 20, hex('#7a4a1e')); c.rect(0, 10, 28, 3, hex('#ffd24a')); c.rect(12, 8, 4, 8, hex('#ffd24a')); });

const DECO = [
  (c) => c.circle(16, 18, 11, hex('#6b6f78')),
  (c) => { c.circle(11, 18, 8, hex('#3f7d4a')); c.circle(21, 17, 9, hex('#468c52')); },
  (c) => { c.circle(16, 16, 3, hex('#ffd24a')); for (let a = 0; a < 5; a++) c.circle(16 + Math.cos(a * 1.26) * 6, 16 + Math.sin(a * 1.26) * 6, 3, hex('#f7f7f7')); },
  (c) => { c.line(4, 8, 16, 18, 2, hex('#20222a')); c.line(16, 18, 28, 12, 2, hex('#20222a')); c.line(16, 18, 14, 28, 2, hex('#20222a')); },
  (c) => { c.circle(16, 16, 10, hex('#6d4c2f')); c.ring(16, 16, 4, 6, hex('#8b6844')); },
];
for (let i = 0; i < DECORATIONS; i++) frame(`deco/${i}`, 32, 32, DECO[i]);

const { atlas, json } = packAtlas(frames, 'sprites.png');
writePng(join(OUT, 'sprites.png'), atlas);
writeFileSync(join(OUT, 'sprites.json'), JSON.stringify(json, null, 1) + '\n');

// Seamless ground tile: flat colour, soft noise, grid lines on the tile edges.
const ground = new Canvas(256, 256);
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let gy = 0; gy < 256; gy++) for (let gx = 0; gx < 256; gx++) { const n = rnd() * 10; ground.blend(gx, gy, [38 + n, 46 + n, 40 + n, 255]); }
for (let i = 0; i < 256; i++) { ground.blend(i, 0, [60, 72, 62, 255]); ground.blend(0, i, [60, 72, 62, 255]); ground.blend(i, 128, [50, 60, 52, 255]); ground.blend(128, i, [50, 60, 52, 255]); }
writePng(join(OUT, 'ground.png'), ground);

// ---------------------------------------------------------------- audio

const arp = (notes, step, wave = 'square', vol = 0.25) => concat(...notes.map((f) => tone(f, f, step, wave, vol)));

const SFX = {
  hit: tone(300, 120, 0.06, 'noise', 0.25),
  pickup: tone(880, 1320, 0.08, 'sine', 0.3),
  levelUp: arp([523, 659, 784, 1047], 0.09),
  chest: arp([392, 523, 659, 784, 1047, 1319], 0.08),
  playerHurt: tone(220, 90, 0.2, 'square', 0.3),
  bossTelegraph: concat(tone(110, 110, 0.15, 'saw', 0.35), silence(0.05), tone(110, 110, 0.15, 'saw', 0.35)),
  win: arp([523, 659, 784, 1047, 1319, 1568], 0.15),
  lose: arp([440, 392, 330, 262, 196], 0.18),
  fire_sweep: tone(900, 200, 0.12, 'noise', 0.2),
  fire_shot: tone(660, 440, 0.07, 'square', 0.18),
  fire_orbit: tone(500, 700, 0.05, 'sine', 0.2),
  fire_aura: tone(200, 240, 0.1, 'sine', 0.15),
  fire_chain: tone(1200, 300, 0.15, 'saw', 0.2),
  fire_pulse: tone(140, 50, 0.3, 'sine', 0.45),
  fire_lure: tone(300, 600, 0.15, 'sine', 0.25),
};
const { samples, spritemap } = audioSprite(SFX);
writeFileSync(join(OUT, 'sfx.wav'), wav(samples));
writeFileSync(join(OUT, 'sfx.json'), JSON.stringify({ resources: ['sfx.wav'], spritemap }, null, 2) + '\n');

const bars = (roots, step, wave, vol) => concat(...roots.map((r) => arp([r, r * 1.25, r * 1.5, r * 2], step, wave, vol)));
writeFileSync(join(OUT, 'music-menu.wav'), wav(bars([220, 196, 175, 196, 220, 196, 175, 165], 0.25, 'sine', 0.12)));
writeFileSync(join(OUT, 'music-game.wav'), wav(mix(bars([110, 110, 98, 98, 87, 87, 98, 104], 0.125, 'square', 0.07), bars([220, 220, 196, 196, 175, 175, 196, 208], 0.125, 'sine', 0.05))));

const CUT_SECONDS = 4;
WEAPONS.forEach((w, i) => {
  const root = 196 * 2 ** (i / 7);
  const chord = mix(mix(tone(root, root, CUT_SECONDS, 'sine', 0.2), tone(root * 1.25, root * 1.25, CUT_SECONDS, 'sine', 0.15)), tone(root * 1.5, root * 1.5, CUT_SECONDS, 'sine', 0.12));
  writeFileSync(join(OUT, `cut/${w}.wav`), wav(chord));
});

// ---------------------------------------------------------------- placeholder Cutscenes (optional)

const CACHE = join(ROOT, '.cache');
mkdirSync(CACHE, { recursive: true });
const cards = WEAPONS.map((w) => ({
  weapon: w,
  png: iconCard(frames.find((f) => f.name === `${w}/icon`).c, join(CACHE, `debug-card-${w}.png`), (card) => card.rect(0, 0, 1280, 720, hex('#22324a'))),
}));
writePlaceholderClips(join(OUT, 'cut'), cards, CUT_SECONDS);

console.log(`Debug Theme: ${frames.length} frames in ${json.meta.size.w}x${json.meta.size.h} atlas, ${Object.keys(SFX).length} SFX markers.`);
