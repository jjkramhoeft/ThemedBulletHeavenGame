// Generates the Debug Theme's programmer art, audio and (if ffmpeg is on PATH) placeholder Cutscenes.
// Usage: npm run assets:debug
// The frame and marker names must match src/game/theme/slots.ts; completeness.test.ts checks the result.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/assets/themes/debug');
mkdirSync(join(OUT, 'cut'), { recursive: true });

const WEAPONS = ['sweep', 'shot', 'orbit', 'aura', 'chain', 'pulse', 'lure'];
const DIRS = ['up', 'left', 'down', 'right'];
const DIR_ANGLE = { up: -Math.PI / 2, left: Math.PI, down: Math.PI / 2, right: 0 };
const WALK_FRAMES = 4;
const DECORATIONS = 5;

// ---------------------------------------------------------------- raster helpers

const hex = (h, a = 255) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];

class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Uint8Array(w * h * 4); }
  blend(x, y, [r, g, b, a]) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4, p = this.px, sa = a / 255, da = p[i + 3] / 255, oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    p[i] = (r * sa + p[i] * da * (1 - sa)) / oa;
    p[i + 1] = (g * sa + p[i + 1] * da * (1 - sa)) / oa;
    p[i + 2] = (b * sa + p[i + 2] * da * (1 - sa)) / oa;
    p[i + 3] = oa * 255;
  }
  /** Fills every pixel whose centre satisfies `inside(x, y)` within the bounding box. */
  shape(x0, y0, x1, y1, col, inside) {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (inside(x + 0.5, y + 0.5)) this.blend(x, y, col);
  }
  rect(x, y, w, h, col) { this.shape(x, y, x + w - 1, y + h - 1, col, (px, py) => px >= x && px < x + w && py >= y && py < y + h); }
  circle(cx, cy, r, col) { this.shape(cx - r, cy - r, cx + r, cy + r, col, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r); }
  ring(cx, cy, r0, r1, col) {
    this.shape(cx - r1, cy - r1, cx + r1, cy + r1, col, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d >= r0 && d <= r1; });
  }
  sector(cx, cy, r0, r1, a0, a1, col) {
    this.shape(cx - r1, cy - r1, cx + r1, cy + r1, col, (x, y) => {
      const d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
      return d >= r0 && d <= r1 && a >= a0 && a <= a1;
    });
  }
  poly(pts, col) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    this.shape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), col, (x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
  }
  line(x0, y0, x1, y1, width, col) {
    const r = width / 2, dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1;
    this.shape(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, col, (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
      return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)) <= r;
    });
  }
  /** Copies another canvas in at (ox, oy). */
  draw(src, ox, oy) {
    for (let y = 0; y < src.h; y++) this.px.set(src.px.subarray(y * src.w * 4, (y + 1) * src.w * 4), ((oy + y) * this.w + ox) * 4);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(c) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0); ihdr.writeUInt32BE(c.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h);
  for (let y = 0; y < c.h; y++) Buffer.from(c.px.buffer, y * c.w * 4, c.w * 4).copy(raw, y * (c.w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

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

// Shelf-pack into a power-of-two atlas with 2 px spacing.
const PAD = 2, ATLAS_W = 1024;
frames.sort((a, b) => b.c.h - a.c.h || b.c.w - a.c.w);
let x = PAD, y = PAD, rowH = 0;
for (const f of frames) {
  if (x + f.c.w + PAD > ATLAS_W) { x = PAD; y += rowH + PAD; rowH = 0; }
  f.x = x; f.y = y; x += f.c.w + PAD; rowH = Math.max(rowH, f.c.h);
}
let atlasH = 64; while (atlasH < y + rowH + PAD) atlasH *= 2;
const atlas = new Canvas(ATLAS_W, atlasH);
const json = { frames: {}, meta: { app: 'make-debug-theme', image: 'sprites.png', size: { w: ATLAS_W, h: atlasH }, scale: '1' } };
for (const f of frames) {
  atlas.draw(f.c, f.x, f.y);
  json.frames[f.name] = { frame: { x: f.x, y: f.y, w: f.c.w, h: f.c.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.c.w, h: f.c.h }, sourceSize: { w: f.c.w, h: f.c.h } };
}
writeFileSync(join(OUT, 'sprites.png'), png(atlas));
writeFileSync(join(OUT, 'sprites.json'), JSON.stringify(json, null, 1) + '\n');

// Seamless ground tile: flat colour, soft noise, grid lines on the tile edges.
const ground = new Canvas(256, 256);
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let gy = 0; gy < 256; gy++) for (let gx = 0; gx < 256; gx++) { const n = rnd() * 10; ground.blend(gx, gy, [38 + n, 46 + n, 40 + n, 255]); }
for (let i = 0; i < 256; i++) { ground.blend(i, 0, [60, 72, 62, 255]); ground.blend(0, i, [60, 72, 62, 255]); ground.blend(i, 128, [50, 60, 52, 255]); ground.blend(128, i, [50, 60, 52, 255]); }
writeFileSync(join(OUT, 'ground.png'), png(ground));

// ---------------------------------------------------------------- audio

const RATE = 22050;
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const WAVES = {
  sine: (p) => Math.sin(p * 2 * Math.PI),
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  saw: (p) => 2 * (p % 1) - 1,
  noise: () => Math.random() * 2 - 1,
};
/** A single note gliding from f0 to f1 with a linear decay envelope. */
function tone(f0, f1, dur, wave = 'square', vol = 0.3) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n); let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n; phase += (f0 + (f1 - f0) * t) / RATE;
    out[i] = WAVES[wave](phase) * vol * Math.min(1, i / 60) * (1 - t);
  }
  return out;
}
const concat = (...parts) => { const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const silence = (dur) => new Float32Array(Math.floor(dur * RATE));
const arp = (notes, step, wave = 'square', vol = 0.25) => concat(...notes.map((f) => tone(f, f, step, wave, vol)));
const mix = (a, b) => { const out = new Float32Array(Math.max(a.length, b.length)); for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0); return out; };

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
const spritemap = {}; const parts = []; let cursor = 0;
for (const [name, s] of Object.entries(SFX)) {
  spritemap[name] = { start: +(cursor / RATE).toFixed(4), end: +((cursor + s.length) / RATE).toFixed(4), loop: false };
  parts.push(s, silence(0.05)); cursor += s.length + Math.floor(0.05 * RATE);
}
writeFileSync(join(OUT, 'sfx.wav'), wav(concat(...parts)));
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

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
if (hasFfmpeg) {
  for (const w of WEAPONS) {
    const out = join(OUT, `cut/${w}.mp4`);
    const common = ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i'];
    const enc = ['-t', String(CUT_SECONDS), '-r', '30', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out];
    const label = `drawtext=text='${w.toUpperCase()} LEVEL UP':fontsize=96:fontcolor=white:x=(w-tw)/2:y=(h-th)/2`;
    try {
      execFileSync('ffmpeg', [...common, `color=c=0x22324a:s=1280x720:d=${CUT_SECONDS}`, '-vf', label, ...enc]);
    } catch {
      execFileSync('ffmpeg', [...common, `testsrc2=s=1280x720:d=${CUT_SECONDS}`, ...enc]); // no fontconfig: plain test pattern
    }
  }
  console.log('Cutscenes: wrote cut/*.mp4');
} else {
  console.warn('Cutscenes: ffmpeg not found on PATH, skipped cut/*.mp4 (the game skips missing Cutscenes).');
}

console.log(`Debug Theme: ${frames.length} frames in ${ATLAS_W}x${atlasH} atlas, ${Object.keys(SFX).length} SFX markers.`);
