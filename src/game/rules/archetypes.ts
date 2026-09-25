// Archetype keys match docs/design/themes.md. Nothing here may know about Themes (ADR 0002).

export const WEAPON_ARCHETYPES = ['sweep', 'shot', 'orbit', 'aura', 'chain', 'pulse', 'lure'] as const;
export type WeaponArchetype = (typeof WEAPON_ARCHETYPES)[number];

export const ENEMY_ARCHETYPES = ['swarmer', 'splitter', 'fragment', 'tank', 'ranged', 'boss'] as const;
export type EnemyArchetype = (typeof ENEMY_ARCHETYPES)[number];

export const PICKUP_ARCHETYPES = ['xp', 'heal', 'magnet', 'chest'] as const;
export type PickupArchetype = (typeof PICKUP_ARCHETYPES)[number];

export interface EnemyStats {
  hp: number;
  /** px/s */
  speed: number;
  /** Physics body radius, px */
  radius: number;
  xp: number;
  contactDamage: number;
  /** 0 = full knockback, 1 = immune */
  knockbackResist: number;
}

export const ENEMIES: Record<EnemyArchetype, EnemyStats> = {
  swarmer:  { hp: 6,    speed: 95,  radius: 12, xp: 1,  contactDamage: 5,  knockbackResist: 0 },
  splitter: { hp: 22,   speed: 60,  radius: 14, xp: 2,  contactDamage: 8,  knockbackResist: 0.2 },
  fragment: { hp: 4,    speed: 115, radius: 10, xp: 1,  contactDamage: 4,  knockbackResist: 0 },
  tank:     { hp: 70,   speed: 40,  radius: 18, xp: 4,  contactDamage: 14, knockbackResist: 0.85 },
  ranged:   { hp: 14,   speed: 55,  radius: 12, xp: 2,  contactDamage: 5,  knockbackResist: 0.1 },
  boss:     { hp: 2500, speed: 45,  radius: 30, xp: 0,  contactDamage: 25, knockbackResist: 1 },
};

export const SPLITTER_FRAGMENTS = { min: 2, max: 3 } as const;

export const RANGED = {
  /** Preferred distance to the player, px */
  range: 260,
  fireCooldownMs: 2200,
  projectileSpeed: 180,
  projectileDamage: 8,
} as const;

export const ELITE = { hpMultiplier: 6, scale: 1.5, xpMultiplier: 5 } as const;

/** Drop chances for a normal (non-Elite, non-Boss) kill. Elites and the Boss always drop a Chest. */
export const DROPS = { heal: 0.008, magnet: 0.004 } as const;

export const HEAL_PICKUP_AMOUNT = 30;

/** Player body radius, px */
export const PLAYER_RADIUS = 12;
