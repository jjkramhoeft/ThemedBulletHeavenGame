// Tiny RGBA raster used by the theme generators: shape drawing, PNG I/O and atlas packing.
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

export const hex = (h, a = 255) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
export const withAlpha = ([r, g, b], a) => [r, g, b, a];
export const mixColor = (c1, c2, t) => c1.map((v, i) => Math.round(v + (c2[i] - v) * t));

export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 4);
  }

  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.px[i], this.px[i + 1], this.px[i + 2], this.px[i + 3]];
  }

  /** Alpha-blends one pixel (source-over). */
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

  /** Blends with wrap-around, for seamless tiles. */
  blendWrap(x, y, col) {
    this.blend(((Math.floor(x) % this.w) + this.w) % this.w, ((Math.floor(y) % this.h) + this.h) % this.h, col);
  }

  /** Paints every pixel whose centre satisfies `colorAt(x, y)` (returns a colour or null) inside the box. */
  shade(x0, y0, x1, y1, colorAt) {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const c = colorAt(x + 0.5, y + 0.5);
        if (c) this.blend(x, y, c);
      }
  }
  shape(x0, y0, x1, y1, col, inside) { this.shade(x0, y0, x1, y1, (x, y) => (inside(x, y) ? col : null)); }

  rect(x, y, w, h, col) { this.shape(x, y, x + w - 1, y + h - 1, col, (px, py) => px >= x && px < x + w && py >= y && py < y + h); }
  circle(cx, cy, r, col) { this.shape(cx - r, cy - r, cx + r, cy + r, col, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r); }
  ellipse(cx, cy, rx, ry, col) { this.shape(cx - rx, cy - ry, cx + rx, cy + ry, col, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1); }
  ring(cx, cy, r0, r1, col) {
    this.shape(cx - r1, cy - r1, cx + r1, cy + r1, col, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d >= r0 && d <= r1; });
  }
  /** Annular sector between angles a0..a1 (radians, atan2 convention). */
  sector(cx, cy, r0, r1, a0, a1, col) {
    this.shape(cx - r1, cy - r1, cx + r1, cy + r1, col, (x, y) => {
      const d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
      return d >= r0 && d <= r1 && a >= a0 && a <= a1;
    });
  }
  /** Radial fill: `colorAt(t)` with t = distance / r in 0..1. */
  radial(cx, cy, r, colorAt) {
    this.shade(cx - r, cy - r, cx + r, cy + r, (x, y) => { const t = Math.hypot(x - cx, y - cy) / r; return t <= 1 ? colorAt(t, x, y) : null; });
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
  /** Draws a 1 px dark outline around every opaque pixel (classic pixel-art readability). */
  outline(col) {
    const src = new Uint8Array(this.px);
    const opaque = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && src[(y * this.w + x) * 4 + 3] > 40;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!opaque(x, y) && (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1))) this.blend(x, y, col);
    return this;
  }
  /** Copies `src` in at (ox, oy), alpha-blended. `sx, sy, sw, sh` select a source rectangle. */
  draw(src, ox = 0, oy = 0, sx = 0, sy = 0, sw = src.w, sh = src.h) {
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const i = ((sy + y) * src.w + (sx + x)) * 4;
        if (src.px[i + 3]) this.blend(ox + x, oy + y, [src.px[i], src.px[i + 1], src.px[i + 2], src.px[i + 3]]);
      }
    return this;
  }
  crop(x, y, w, h) { return new Canvas(w, h).draw(this, 0, 0, x, y, w, h); }
  /** Opaque bounding box, or null. */
  bbox(alphaMin = 1) {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.px[(y * this.w + x) * 4 + 3] >= alphaMin) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }
}

export function readPng(path) {
  const png = PNG.sync.read(readFileSync(path));
  const c = new Canvas(png.width, png.height);
  c.px.set(png.data);
  return c;
}

export function writePng(path, c) {
  const png = new PNG({ width: c.w, height: c.h });
  png.data = Buffer.from(c.px);
  writeFileSync(path, PNG.sync.write(png, { colorType: 6 }));
}

/** Tileable value noise in 0..1 with the given integer period (cells across the tile). */
export function tileNoise(seed, period) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const grid = Array.from({ length: period * period }, rnd);
  const at = (x, y) => grid[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = u * period, y = v * period, xi = Math.floor(x), yi = Math.floor(y), tx = smooth(x - xi), ty = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

export function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/**
 * Shelf-packs named canvases into one atlas and returns it with Phaser JSON-Hash frame data.
 * Frames are sorted tallest first; 2 px spacing prevents bleeding.
 */
export function packAtlas(frames, imageName, width = 1024, pad = 2) {
  const sorted = [...frames].sort((a, b) => b.c.h - a.c.h || b.c.w - a.c.w);
  let x = pad, y = pad, rowH = 0;
  for (const f of sorted) {
    if (x + f.c.w + pad > width) { x = pad; y += rowH + pad; rowH = 0; }
    f.x = x; f.y = y; x += f.c.w + pad; rowH = Math.max(rowH, f.c.h);
  }
  let height = 64;
  while (height < y + rowH + pad) height *= 2;
  const atlas = new Canvas(width, height);
  const json = { frames: {}, meta: { app: 'themed-bullet-heaven scripts', image: imageName, size: { w: width, h: height }, scale: '1' } };
  for (const f of sorted) {
    atlas.draw(f.c, f.x, f.y);
    json.frames[f.name] = { frame: { x: f.x, y: f.y, w: f.c.w, h: f.c.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.c.w, h: f.c.h }, sourceSize: { w: f.c.w, h: f.c.h } };
  }
  return { atlas, json };
}
