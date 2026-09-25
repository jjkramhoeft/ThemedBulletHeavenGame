import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { PickupArchetype } from '../rules/archetypes';
import type { ThemeContext } from '../theme/ThemeContext';
import { pickupFrame } from '../theme/slots';

const COLLECT_RADIUS = 18;
const ATTRACT_SPEED = 260;
const ATTRACT_ACCEL = 900;

interface Pickup {
  img: Phaser.GameObjects.Image;
  kind: PickupArchetype;
  value: number;
  attracted: boolean;
  speed: number;
}

/**
 * Pickups without physics bodies (docs/research §3.2): a distance check per frame is cheaper than
 * hundreds of Arcade bodies. XP inside the pickup radius, or everything after a Magnet, flies to the player.
 */
export class PickupField {
  private readonly active: Pickup[] = [];
  private readonly free: Pickup[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly theme: ThemeContext, private readonly max: number) {}

  get count() { return this.active.length; }

  spawn(kind: PickupArchetype, x: number, y: number, value = 1): void {
    if (this.active.length >= this.max) {
      // Merge surplus XP into the oldest gem rather than dropping it.
      if (kind === 'xp') { const oldest = this.active.find((p) => p.kind === 'xp'); if (oldest) oldest.value += value; }
      return;
    }
    const p = this.free.pop() ?? { img: this.scene.add.image(0, 0, this.theme.sprites, pickupFrame(kind)), kind, value, attracted: false, speed: 0 };
    p.kind = kind;
    p.value = value;
    p.attracted = false;
    p.speed = ATTRACT_SPEED;
    p.img.setFrame(pickupFrame(kind)).setPosition(x, y).setVisible(true).setActive(true).setDepth(DEPTH.pickup);
    this.active.push(p);
  }

  /** Pulls every XP pickup to the player (the Magnet pickup). */
  magnetise(): void {
    for (const p of this.active) if (p.kind === 'xp') p.attracted = true;
  }

  update(dtMs: number, px: number, py: number, pickupRadius: number, collect: (kind: PickupArchetype, value: number) => void): void {
    const dt = dtMs / 1000;
    const r2 = pickupRadius * pickupRadius;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;
      const dx = px - p.img.x, dy = py - p.img.y, d2 = dx * dx + dy * dy;
      if (d2 <= COLLECT_RADIUS * COLLECT_RADIUS) {
        this.release(i);
        collect(p.kind, p.value);
        continue;
      }
      if (!p.attracted && d2 <= r2) p.attracted = true;
      if (p.attracted) {
        const d = Math.sqrt(d2);
        p.speed += ATTRACT_ACCEL * dt;
        const step = Math.min(d, p.speed * dt);
        p.img.x += (dx / d) * step;
        p.img.y += (dy / d) * step;
      }
    }
  }

  private release(i: number): void {
    const p = this.active[i]!;
    this.active[i] = this.active[this.active.length - 1]!;
    this.active.pop();
    p.img.setVisible(false).setActive(false);
    this.free.push(p);
  }
}
