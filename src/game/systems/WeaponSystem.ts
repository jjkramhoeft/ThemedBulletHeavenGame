import type Phaser from 'phaser';
import type { SfxMarker } from '../theme/slots';
import { DEPTH } from '../config';
import type { Enemy } from '../entities/Enemy';
import type { WeaponArchetype } from '../rules/archetypes';
import type { Loadout } from '../rules/loadout';
import type { PlayerStats } from '../rules/passives';
import { weaponStats, type WeaponStats } from '../rules/weapons';
import type { ThemeContext } from '../theme/ThemeContext';
import { WEAPON_EFFECT_FRAME } from '../theme/slots';

/** Radius the debug art draws its round effects at (128 px frames); used to scale them to `area`. */
const EFFECT_FRAME_RADIUS = 62;
const SHOT_RANGE = 520;

export interface Lure { x: number; y: number; radius: number; untilMs: number }

/** What weapons can see and do. The Game scene implements it. */
export interface CombatWorld {
  /** The scene weapons add their effects to */
  readonly host: Phaser.Scene;
  readonly theme: ThemeContext;
  readonly nowMs: number;
  readonly player: { x: number; y: number; facingX: number; facingY: number };
  readonly lures: Lure[];
  enemiesWithin(x: number, y: number, radius: number): Enemy[];
  nearestEnemies(x: number, y: number, maxDist: number, n: number): Enemy[];
  damageEnemy(e: Enemy, damage: number, fromX?: number, fromY?: number, knockback?: number): void;
  fireShot(x: number, y: number, vx: number, vy: number, damage: number, pierce: number): void;
  sfx(marker: SfxMarker): void;
}

abstract class WeaponRuntime {
  protected cooldown = 0;
  constructor(protected readonly w: CombatWorld, public stats: WeaponStats) {}
  setStats(s: WeaponStats) { this.stats = s; }
  update(dtMs: number) {
    this.cooldown -= dtMs;
    if (this.cooldown <= 0 && this.fire()) this.cooldown = this.stats.cooldownMs;
  }
  /** Returns false to retry next frame (e.g. no target yet). */
  protected fire(): boolean { return true; }
  destroy() {}

  protected fx(frame: string, x: number, y: number) {
    return this.w.host.add.image(x, y, this.w.theme.sprites, frame).setDepth(DEPTH.effect);
  }
  protected fade(img: Phaser.GameObjects.Image, ms: number, extra: Phaser.Types.Tweens.TweenBuilderConfig | object = {}) {
    this.w.host.tweens.add({ targets: img, alpha: 0, duration: ms, onComplete: () => img.destroy(), ...extra });
  }
}

class Sweep extends WeaponRuntime {
  protected fire() {
    const { x, y, facingX, facingY } = this.w.player;
    const face = Math.atan2(facingY, facingX);
    const half = (this.stats.arcDeg * Math.PI) / 360;
    const arcs = this.stats.backArc ? [face, face + Math.PI] : [face];
    for (const a of arcs) {
      const img = this.fx(WEAPON_EFFECT_FRAME.sweep, x, y).setRotation(a).setScale(this.stats.area / EFFECT_FRAME_RADIUS);
      this.fade(img, 180);
    }
    for (const e of this.w.enemiesWithin(x, y, this.stats.area)) {
      const ea = Math.atan2(e.y - y, e.x - x);
      if (arcs.some((a) => Math.abs(wrapAngle(ea - a)) <= half)) this.w.damageEnemy(e, this.stats.damage, x, y, this.stats.knockback);
    }
    this.w.sfx('fire_sweep');
    return true;
  }
}

class Shot extends WeaponRuntime {
  protected fire() {
    const { x, y } = this.w.player;
    const targets = this.w.nearestEnemies(x, y, SHOT_RANGE, this.stats.count);
    if (targets.length === 0) return false;
    for (let i = 0; i < this.stats.count; i++) {
      const t = targets[i % targets.length]!;
      const a = Math.atan2(t.y - y, t.x - x) + (i >= targets.length ? (i - targets.length + 1) * 0.12 : 0);
      this.w.fireShot(x, y, Math.cos(a) * this.stats.speed, Math.sin(a) * this.stats.speed, this.stats.damage, this.stats.pierce);
    }
    this.w.sfx('fire_shot');
    return true;
  }
}

class Orbit extends WeaponRuntime {
  private angle = 0;
  private blades: Phaser.GameObjects.Image[] = [];
  update(dtMs: number) {
    while (this.blades.length < this.stats.count) this.blades.push(this.fx(WEAPON_EFFECT_FRAME.orbit, 0, 0).setDepth(DEPTH.projectile));
    while (this.blades.length > this.stats.count) this.blades.pop()!.destroy();
    this.angle += (this.stats.speed * dtMs) / 1000;
    const { x, y } = this.w.player;
    this.blades.forEach((b, i) => {
      const a = this.angle + (i * Math.PI * 2) / this.blades.length;
      b.setPosition(x + Math.cos(a) * this.stats.area, y + Math.sin(a) * this.stats.area).setRotation(a);
      for (const e of this.w.enemiesWithin(b.x, b.y, 14)) {
        if (this.w.nowMs - e.orbitHitAt < this.stats.cooldownMs) continue;
        e.orbitHitAt = this.w.nowMs;
        this.w.damageEnemy(e, this.stats.damage, x, y, 60);
      }
    });
  }
  destroy() { this.blades.forEach((b) => b.destroy()); }
}

class Aura extends WeaponRuntime {
  private readonly field = this.fx(WEAPON_EFFECT_FRAME.aura, 0, 0).setDepth(DEPTH.field);
  update(dtMs: number) {
    this.field.setPosition(this.w.player.x, this.w.player.y).setScale(this.stats.area / EFFECT_FRAME_RADIUS);
    super.update(dtMs);
  }
  protected fire() {
    const { x, y } = this.w.player;
    const hits = this.w.enemiesWithin(x, y, this.stats.area);
    for (const e of hits) {
      if (this.stats.slow > 0) { e.slowFrac = this.stats.slow; e.slowUntil = this.w.nowMs + this.stats.cooldownMs + 50; }
      this.w.damageEnemy(e, this.stats.damage);
    }
    if (hits.length) this.w.sfx('fire_aura');
    return true;
  }
  destroy() { this.field.destroy(); }
}

class Chain extends WeaponRuntime {
  protected fire() {
    const { x, y } = this.w.player;
    let from = { x, y };
    let target = this.w.nearestEnemies(x, y, this.stats.area, 1)[0];
    if (!target) return false;
    const hit = new Set<Enemy>();
    for (let j = 0; j <= this.stats.jumps && target; j++) {
      hit.add(target);
      this.bolt(from.x, from.y, target.x, target.y);
      from = { x: target.x, y: target.y };
      this.w.damageEnemy(target, this.stats.damage);
      target = this.w.nearestEnemies(from.x, from.y, this.stats.jumpRange, hit.size + 1).find((e) => !hit.has(e));
    }
    this.w.sfx('fire_chain');
    return true;
  }
  private bolt(x0: number, y0: number, x1: number, y1: number) {
    const img = this.fx(WEAPON_EFFECT_FRAME.chain, x0, y0).setOrigin(0, 0.5).setRotation(Math.atan2(y1 - y0, x1 - x0));
    img.setScale(Math.hypot(x1 - x0, y1 - y0) / img.width, 1);
    this.fade(img, 160);
  }
}

class Pulse extends WeaponRuntime {
  protected fire() {
    const { x, y } = this.w.player;
    const img = this.fx(WEAPON_EFFECT_FRAME.pulse, x, y).setScale(0.2);
    this.fade(img, 280, { scale: this.stats.area / EFFECT_FRAME_RADIUS });
    for (const e of this.w.enemiesWithin(x, y, this.stats.area)) this.w.damageEnemy(e, this.stats.damage, x, y, this.stats.knockback);
    this.w.sfx('fire_pulse');
    return true;
  }
}

class LureWeapon extends WeaponRuntime {
  protected fire() {
    const { x, y, facingX, facingY } = this.w.player;
    const tx = x + facingX * this.stats.speed, ty = y + facingY * this.stats.speed;
    const s = this.stats;
    const bait = this.fx(WEAPON_EFFECT_FRAME.lure, x, y).setDepth(DEPTH.pickup);
    const lure: Lure = { x: tx, y: ty, radius: s.area, untilMs: this.w.nowMs + s.durationMs };
    this.w.host.tweens.add({ targets: bait, x: tx, y: ty, duration: 250, ease: 'Quad.easeOut' });
    this.w.lures.push(lure);
    this.w.host.time.delayedCall(s.durationMs, () => {
      this.w.lures.splice(this.w.lures.indexOf(lure), 1);
      for (const e of this.w.enemiesWithin(tx, ty, s.area)) this.w.damageEnemy(e, s.damage, tx, ty, 200);
      const burst = this.fx(WEAPON_EFFECT_FRAME.pulse, tx, ty).setScale(0.2);
      this.fade(burst, 250, { scale: s.area / EFFECT_FRAME_RADIUS });
      bait.destroy();
      this.w.sfx('fire_pulse');
    });
    this.w.sfx('fire_lure');
    return true;
  }
}

/** Wrap an angle to (-PI, PI]. */
function wrapAngle(a: number): number {
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

const RUNTIMES: Record<WeaponArchetype, new (w: CombatWorld, s: WeaponStats) => WeaponRuntime> = {
  sweep: Sweep, shot: Shot, orbit: Orbit, aura: Aura, chain: Chain, pulse: Pulse, lure: LureWeapon,
};

/** Keeps one runtime per owned Weapon in step with the Run's Loadout. */
export class WeaponSystem {
  private readonly runtimes = new Map<WeaponArchetype, WeaponRuntime>();

  constructor(private readonly world: CombatWorld) {}

  sync(loadout: Loadout, player: PlayerStats): void {
    for (const { weapon, level } of loadout) {
      const stats = weaponStats(weapon, level, player);
      const rt = this.runtimes.get(weapon);
      if (rt) rt.setStats(stats);
      else this.runtimes.set(weapon, new RUNTIMES[weapon](this.world, stats));
    }
  }

  update(dtMs: number): void {
    for (const rt of this.runtimes.values()) rt.update(dtMs);
  }

  destroy(): void {
    for (const rt of this.runtimes.values()) rt.destroy();
    this.runtimes.clear();
  }
}
