import Phaser from 'phaser';
import { ELITE, ENEMIES, type EnemyArchetype } from '../rules/archetypes';
import { BossBrain } from '../rules/boss';
import type { ThemeContext } from '../theme/ThemeContext';
import { walkFrame, type Direction } from '../theme/slots';
import { DEPTH } from '../config';

const FLASH_MS = 80;
const ELITE_TINT = 0xffd24a;

export function dirOf(vx: number, vy: number): Direction {
  return Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
}

/** A pooled enemy. All per-kind numbers come from rules/; the Theme only supplies frames and scale. */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  archetype: EnemyArchetype = 'swarmer';
  elite = false;
  hp = 1;
  maxHp = 1;
  knockX = 0;
  knockY = 0;
  slowFrac = 0;
  slowUntil = 0;
  /** Last time an Orbit blade hit this enemy (per-enemy re-hit gate) */
  orbitHitAt = -Infinity;
  fireMs = 0;
  flashMs = 0;
  facing: Direction = 'down';
  brain: BossBrain | null = null;
  chargeX = 0;
  chargeY = 0;

  spawn(theme: ThemeContext, archetype: EnemyArchetype, x: number, y: number, elite: boolean): this {
    const stats = ENEMIES[archetype];
    this.archetype = archetype;
    this.elite = elite;
    this.maxHp = this.hp = stats.hp * (elite ? ELITE.hpMultiplier : 1);
    this.knockX = this.knockY = 0;
    this.slowFrac = 0;
    this.slowUntil = 0;
    this.orbitHitAt = -Infinity;
    this.fireMs = Math.random() * 1000;
    this.flashMs = 0;
    this.brain = archetype === 'boss' ? new BossBrain() : null;

    this.setTexture(theme.sprites, walkFrame(archetype, 'down', 0));
    this.enableBody(true, x, y, true, true);
    const scale = theme.scale(archetype) * (elite ? ELITE.scale : 1);
    this.setScale(scale).setDepth(DEPTH.enemy);
    // Body radius is a mechanic; convert it into source pixels so sprite scale doesn't change it.
    const r = stats.radius * (elite ? ELITE.scale : 1) / scale;
    this.body!.setCircle(r, this.frame.width / 2 - r, this.frame.height / 2 - r);
    this.clearTint();
    if (elite) this.setTint(ELITE_TINT);
    this.facing = 'down';
    this.play(theme.walkAnim(archetype, 'down'));
    return this;
  }

  /** Radius in world px, from rules. */
  get radius(): number {
    return ENEMIES[this.archetype].radius * (this.elite ? ELITE.scale : 1);
  }

  flash(): void {
    this.flashMs = FLASH_MS;
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }

  /** Per-frame visuals: hit flash and facing animation. */
  tickVisuals(theme: ThemeContext, dtMs: number, vx: number, vy: number): void {
    if (this.flashMs > 0) {
      this.flashMs -= dtMs;
      if (this.flashMs <= 0) {
        this.setTintMode(Phaser.TintModes.MULTIPLY);
        if (this.elite) this.setTint(ELITE_TINT); else this.clearTint();
      }
    }
    if (vx * vx + vy * vy > 1) {
      const dir = dirOf(vx, vy);
      if (dir !== this.facing) {
        this.facing = dir;
        this.play(theme.walkAnim(this.archetype, dir), true);
      }
    }
  }

  despawn(): void {
    this.brain = null;
    this.disableBody(true, true);
  }
}
