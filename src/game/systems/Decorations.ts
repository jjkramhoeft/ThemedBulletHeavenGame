import type Phaser from 'phaser';
import { DEPTH } from '../config';
import { randInt, seeded } from '../rules/rng';
import type { ThemeContext } from '../theme/ThemeContext';
import { decorationFrame } from '../theme/slots';

const CHUNK = 384;
const MAX_PER_CHUNK = 3;

/** Cosmetic Tileset decorations, placed deterministically per chunk from a seed. They never block movement. */
export class Decorations {
  private readonly chunks = new Map<string, Phaser.GameObjects.Image[]>();

  constructor(private readonly scene: Phaser.Scene, private readonly theme: ThemeContext, private readonly seed: number) {}

  update(view: Phaser.Geom.Rectangle): void {
    if (this.theme.manifest.decorations === 0) return;
    const x0 = Math.floor(view.x / CHUNK) - 1, x1 = Math.floor(view.right / CHUNK) + 1;
    const y0 = Math.floor(view.y / CHUNK) - 1, y1 = Math.floor(view.bottom / CHUNK) + 1;
    const keep = new Set<string>();
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const key = `${cx},${cy}`;
        keep.add(key);
        if (!this.chunks.has(key)) this.chunks.set(key, this.build(cx, cy));
      }
    }
    for (const [key, imgs] of this.chunks) {
      if (!keep.has(key)) { imgs.forEach((i) => i.destroy()); this.chunks.delete(key); }
    }
  }

  private build(cx: number, cy: number): Phaser.GameObjects.Image[] {
    const rng = seeded((this.seed ^ Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0);
    const n = randInt(rng, 0, MAX_PER_CHUNK);
    const imgs: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < n; i++) {
      const frame = decorationFrame(randInt(rng, 0, this.theme.manifest.decorations - 1));
      imgs.push(this.scene.add.image(cx * CHUNK + rng() * CHUNK, cy * CHUNK + rng() * CHUNK, this.theme.sprites, frame).setDepth(DEPTH.decoration));
    }
    return imgs;
  }
}
