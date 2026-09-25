// Composes Universal LPC Spritesheet Generator layers into walk sheets, the same way the generator does:
// layers are sorted by zPos; "variants" items load `<path><anim>/<variant>.png`; "recolors" items load
// `<path><anim>.png` drawn in the material's base palette and swap colours index-for-index.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Canvas, readPng } from './raster.mjs';

export const ULPC_URL = 'https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator.git';
/** Pinned so a rebuild produces the same art and credits. */
export const ULPC_COMMIT = '4963a69795255fb15a934c47f478a8bdcf3668f5';

export const FRAME = 64;
export const WALK_FRAMES = 9;
/** LPC row order, matching src/game/theme/slots.ts DIRECTIONS. */
export const DIRS = ['up', 'left', 'down', 'right'];

const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** A blobless, sparse clone at the pinned commit; image blobs are fetched only for the layers a Theme uses. */
export function ensureRepo(dir) {
  if (!existsSync(join(dir, '.git'))) {
    console.log(`LPC: cloning ${ULPC_URL} (blobless, sparse) into ${dir}`);
    execFileSync('git', ['clone', '--filter=blob:none', '--no-checkout', ULPC_URL, dir], { stdio: 'inherit' });
    git(dir, 'sparse-checkout', 'init', '--cone');
    git(dir, 'sparse-checkout', 'set', 'sheet_definitions', 'palette_definitions');
  }
  if (git(dir, 'rev-parse', 'HEAD').trim() !== ULPC_COMMIT) git(dir, 'fetch', '--filter=blob:none', 'origin', ULPC_COMMIT);
  // Always (re)populate the working tree: a fresh --no-checkout clone has none yet.
  if (!existsSync(join(dir, 'CREDITS.csv')) || git(dir, 'rev-parse', 'HEAD').trim() !== ULPC_COMMIT) {
    git(dir, 'checkout', '--quiet', '--detach', ULPC_COMMIT);
  }
  return dir;
}

function walkJson(dir, out = new Map()) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkJson(p, out);
    else if (e.endsWith('.json') && !e.startsWith('meta_')) out.set(e.slice(0, -5), JSON.parse(readFileSync(p, 'utf8')));
  }
  return out;
}

/** Minimal CSV reader for CREDITS.csv (quoted fields, stray spaces after closing quotes). */
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = [...line.matchAll(/"((?:[^"]|"")*)"\s*(?:,|$)/g)].map((m) => m[1].replace(/""/g, '"'));
    rows.push(fields);
  }
  return rows;
}

export class Lpc {
  constructor(dir) {
    this.dir = ensureRepo(dir);
    this.defs = walkJson(join(dir, 'sheet_definitions'));
    this.tracked = new Set(git(dir, 'ls-files', 'spritesheets').split('\n').filter(Boolean));
    const [, ...rows] = parseCsv(readFileSync(join(dir, 'CREDITS.csv'), 'utf8'));
    this.credits = new Map(rows.map(([file, notes, authors, licenses, urls]) => [file, { file, notes, authors, licenses, urls }]));
    this.palettes = new Map();
    this.used = new Set();
  }

  palette(material) {
    if (!this.palettes.has(material)) {
      const base = JSON.parse(readFileSync(join(this.dir, `palette_definitions/${material}/meta_${material}.json`), 'utf8')).base;
      const colors = JSON.parse(readFileSync(join(this.dir, `palette_definitions/${material}/${material}_ulpc.json`), 'utf8'));
      this.palettes.set(material, { base, colors });
    }
    return this.palettes.get(material);
  }

  /**
   * Resolves one recipe layer, e.g. `{ item: 'torso_clothes_longsleeve', color: 'black' }`, to files.
   * `color` picks a variant when the item has variants, otherwise a palette colour for its material.
   * `material` overrides the recolour material (heads follow the body palette).
   */
  resolve(spec, bodyType, anim = 'walk') {
    const def = this.defs.get(spec.item);
    if (!def) throw new Error(`LPC: unknown item "${spec.item}"`);
    const out = [];
    for (let n = 1; n < 10; n++) {
      const layer = def[`layer_${n}`];
      if (!layer) break;
      if (layer.custom_animation) continue;
      const base = layer[bodyType];
      if (!base) continue;
      const variant = spec.variant ?? (def.variants?.includes(spec.color) ? spec.color : undefined);
      const file = variant ? `${base}${anim}/${variant}.png` : `${base}${anim}.png`;
      if (!this.tracked.has(`spritesheets/${file}`)) continue; // e.g. back/front layers only drawn for attack animations
      const material = spec.material ?? def.recolors?.material;
      const recolor = !variant && spec.color && material ? { material, to: spec.color } : null;
      out.push({ zPos: layer.zPos ?? 0, file, recolor, item: spec.item });
    }
    if (out.length === 0) throw new Error(`LPC: "${spec.item}" has no ${anim} sheet for body type ${bodyType}`);
    return out;
  }

  /** Fetches the image blobs for these files (adds their folders to the sparse checkout). */
  fetch(files) {
    const missing = [...new Set(files.filter((f) => !existsSync(join(this.dir, 'spritesheets', f))).map((f) => `spritesheets/${dirname(f)}`))];
    if (missing.length) {
      console.log(`LPC: fetching ${missing.length} sprite folders`);
      for (let i = 0; i < missing.length; i += 40) git(this.dir, 'sparse-checkout', 'add', ...missing.slice(i, i + 40));
    }
  }

  recolor(c, { material, to }) {
    const { base, colors } = this.palette(material);
    const from = colors[base], target = colors[to];
    if (!from || !target) throw new Error(`LPC: unknown ${material} colour "${to}" (have ${Object.keys(colors).join(', ')})`);
    const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const src = from.map(parse), dst = target.map(parse);
    const p = c.px;
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const k = src.findIndex(([r, g, b]) => Math.abs(p[i] - r) <= 1 && Math.abs(p[i + 1] - g) <= 1 && Math.abs(p[i + 2] - b) <= 1);
      if (k >= 0) [p[i], p[i + 1], p[i + 2]] = dst[k];
    }
    return c;
  }

  /** Composes an actor's layers into one sheet (9 x 4 frames of 64 px for walk). */
  compose(recipe, anim = 'walk') {
    const layers = recipe.layers.flatMap((spec, order) => this.resolve(spec, recipe.body, anim).map((l) => ({ ...l, order })));
    layers.sort((a, b) => a.zPos - b.zPos || a.order - b.order);
    this.fetch(layers.map((l) => l.file));
    const sheet = new Canvas(FRAME * WALK_FRAMES, FRAME * DIRS.length);
    for (const l of layers) {
      const img = readPng(join(this.dir, 'spritesheets', l.file));
      if (l.recolor) this.recolor(img, l.recolor);
      if (img.w !== sheet.w || img.h !== sheet.h) {
        console.warn(`LPC: skipping ${l.file}: ${img.w}x${img.h}, expected ${sheet.w}x${sheet.h}`);
        continue;
      }
      sheet.draw(img);
      this.used.add(l.file);
    }
    return sheet;
  }

  /** Composes only the named layer items (used to locate e.g. a mask for a custom overlay). */
  composeOnly(recipe, items, anim = 'walk') {
    return this.compose({ ...recipe, layers: recipe.layers.filter((l) => items.includes(l.item)) }, anim);
  }

  /** CREDITS.csv rows for every file composed so far (per-animation rows cover their colour variants). */
  usedCredits() {
    const rows = new Map();
    for (const f of this.used) {
      const row = this.credits.get(f) ?? this.credits.get(f.replace(/\/([^/]+)\/[^/]+\.png$/, '/$1.png'));
      if (!row) throw new Error(`LPC: no credits entry for ${f}; refusing to ship unattributed art`);
      rows.set(row.file, row);
    }
    return [...rows.values()].sort((a, b) => a.file.localeCompare(b.file));
  }
}

export function creditsCsv(rows) {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  return ['filename,notes,authors,licenses,urls', ...rows.map((r) => [r.file, r.notes, r.authors, r.licenses, r.urls].map(q).join(','))].join('\n') + '\n';
}

/** Splits a composed walk sheet into frames named `<actor>/walk_<dir>_<i>`. */
export function walkFrames(actor, sheet) {
  const frames = [];
  DIRS.forEach((dir, row) => {
    for (let i = 0; i < WALK_FRAMES; i++) frames.push({ name: `${actor}/walk_${dir}_${i}`, c: sheet.crop(i * FRAME, row * FRAME, FRAME, FRAME) });
  });
  return frames;
}
