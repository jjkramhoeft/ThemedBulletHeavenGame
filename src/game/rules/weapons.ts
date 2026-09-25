import type { WeaponArchetype } from './archetypes';
import type { PlayerStats } from './passives';

export const MAX_WEAPONS = 4;
export const MAX_WEAPON_LEVEL = 5;

/**
 * One level's numbers for a Weapon. Every Weapon uses the same shape; each
 * Archetype only reads the fields its behaviour needs (see comments in WEAPON_LEVELS).
 */
export interface WeaponStats {
  damage: number;
  cooldownMs: number;
  /** Projectiles per volley, or blades for orbit */
  count: number;
  /** Radius of the effect, px */
  area: number;
  /** Projectile px/s, orbit rad/s, lure throw distance px */
  speed: number;
  pierce: number;
  durationMs: number;
  /** Knockback impulse, px/s */
  knockback: number;
  jumps: number;
  jumpRange: number;
  /** 0..1 fraction of enemy speed removed while inside */
  slow: number;
  arcDeg: number;
  /** Sweep also hits behind the player */
  backArc: boolean;
}

const BASE: WeaponStats = {
  damage: 0, cooldownMs: 1000, count: 1, area: 0, speed: 0, pierce: 1, durationMs: 0,
  knockback: 0, jumps: 0, jumpRange: 0, slow: 0, arcDeg: 0, backArc: false,
};

function levels(...ls: Partial<WeaponStats>[]): WeaponStats[] {
  if (ls.length !== MAX_WEAPON_LEVEL) throw new Error(`expected ${MAX_WEAPON_LEVEL} levels`);
  return ls.map((l) => ({ ...BASE, ...l }));
}

export const WEAPON_LEVELS: Record<WeaponArchetype, WeaponStats[]> = {
  // Melee arc in the facing direction: damage, cooldownMs, area, arcDeg, knockback, backArc
  sweep: levels(
    { damage: 12, cooldownMs: 1100, area: 80,  arcDeg: 110, knockback: 140 },
    { damage: 16, cooldownMs: 1050, area: 88,  arcDeg: 120, knockback: 150 },
    { damage: 20, cooldownMs: 1000, area: 96,  arcDeg: 130, knockback: 160 },
    { damage: 24, cooldownMs: 900,  area: 104, arcDeg: 140, knockback: 170 },
    { damage: 28, cooldownMs: 800,  area: 110, arcDeg: 150, knockback: 180, backArc: true },
  ),
  // Auto-aimed projectiles: damage, cooldownMs, count, speed, pierce
  shot: levels(
    { damage: 8,  cooldownMs: 900, count: 1, speed: 420, pierce: 1 },
    { damage: 9,  cooldownMs: 850, count: 2, speed: 420, pierce: 1 },
    { damage: 11, cooldownMs: 800, count: 2, speed: 450, pierce: 2 },
    { damage: 12, cooldownMs: 700, count: 3, speed: 450, pierce: 2 },
    { damage: 14, cooldownMs: 600, count: 3, speed: 480, pierce: 3 },
  ),
  // Circling blades: damage, count, area (orbit radius), speed (rad/s), cooldownMs = re-hit interval per enemy
  orbit: levels(
    { damage: 6,  cooldownMs: 500, count: 2, area: 70,  speed: 3.0 },
    { damage: 7,  cooldownMs: 500, count: 3, area: 76,  speed: 3.3 },
    { damage: 9,  cooldownMs: 450, count: 3, area: 84,  speed: 3.6 },
    { damage: 10, cooldownMs: 450, count: 4, area: 92,  speed: 4.0 },
    { damage: 12, cooldownMs: 400, count: 5, area: 100, speed: 4.5 },
  ),
  // Damage field around the player: damage per tick, cooldownMs = tick, area, slow
  aura: levels(
    { damage: 3, cooldownMs: 500, area: 60 },
    { damage: 4, cooldownMs: 500, area: 70 },
    { damage: 5, cooldownMs: 500, area: 80,  slow: 0.25 },
    { damage: 6, cooldownMs: 450, area: 90,  slow: 0.3 },
    { damage: 7, cooldownMs: 400, area: 100, slow: 0.35 },
  ),
  // First hit within area, then jumps: damage, cooldownMs, area (reach), jumps, jumpRange
  chain: levels(
    { damage: 10, cooldownMs: 1400, area: 300, jumps: 2, jumpRange: 120 },
    { damage: 12, cooldownMs: 1300, area: 300, jumps: 3, jumpRange: 130 },
    { damage: 14, cooldownMs: 1200, area: 320, jumps: 4, jumpRange: 140 },
    { damage: 16, cooldownMs: 1050, area: 320, jumps: 5, jumpRange: 155 },
    { damage: 18, cooldownMs: 900,  area: 340, jumps: 6, jumpRange: 170 },
  ),
  // Radial shockwave: damage, cooldownMs, area, knockback
  pulse: levels(
    { damage: 10, cooldownMs: 3000, area: 120, knockback: 300 },
    { damage: 12, cooldownMs: 2800, area: 140, knockback: 340 },
    { damage: 14, cooldownMs: 2600, area: 160, knockback: 380 },
    { damage: 17, cooldownMs: 2300, area: 180, knockback: 440 },
    { damage: 20, cooldownMs: 2000, area: 200, knockback: 500 },
  ),
  // Thrown bait that pulls enemies, then bursts: damage (burst), cooldownMs, area (pull radius), durationMs, speed (throw px)
  lure: levels(
    { damage: 20, cooldownMs: 6000, area: 140, durationMs: 2500, speed: 160 },
    { damage: 28, cooldownMs: 5600, area: 160, durationMs: 2800, speed: 170 },
    { damage: 38, cooldownMs: 5200, area: 180, durationMs: 3200, speed: 180 },
    { damage: 48, cooldownMs: 4800, area: 200, durationMs: 3600, speed: 190 },
    { damage: 60, cooldownMs: 4500, area: 220, durationMs: 4000, speed: 200 },
  ),
};

/** Stats for a Weapon at a given Weapon Level, with the player's Passive already applied. */
export function weaponStats(weapon: WeaponArchetype, level: number, player: PlayerStats): WeaponStats {
  if (level < 1 || level > MAX_WEAPON_LEVEL) throw new Error(`weapon level out of range: ${level}`);
  const s = WEAPON_LEVELS[weapon][level - 1]!;
  return {
    ...s,
    damage: s.damage * player.damageMul,
    cooldownMs: s.cooldownMs * (weapon === 'orbit' ? 1 : player.cooldownMul),
    area: s.area * player.areaMul,
  };
}
