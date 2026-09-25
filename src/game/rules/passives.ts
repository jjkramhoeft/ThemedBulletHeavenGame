export const PASSIVES = ['maxHp', 'moveSpeed', 'pickupRadius', 'cooldown', 'damage', 'area'] as const;
export type Passive = (typeof PASSIVES)[number];

export interface PlayerStats {
  maxHp: number;
  /** px/s */
  moveSpeed: number;
  /** px; XP inside this radius flies to the player */
  pickupRadius: number;
  /** Multiplies weapon cooldowns (lower is faster) */
  cooldownMul: number;
  damageMul: number;
  areaMul: number;
}

export const BASE_PLAYER: Readonly<PlayerStats> = {
  maxHp: 100,
  moveSpeed: 150,
  pickupRadius: 70,
  cooldownMul: 1,
  damageMul: 1,
  areaMul: 1,
};

export function applyPassive(base: Readonly<PlayerStats>, passive: Passive): PlayerStats {
  const s = { ...base };
  switch (passive) {
    case 'maxHp':        s.maxHp = Math.round(s.maxHp * 1.3); break;
    case 'moveSpeed':    s.moveSpeed *= 1.15; break;
    case 'pickupRadius': s.pickupRadius *= 1.5; break;
    case 'cooldown':     s.cooldownMul *= 0.85; break;
    case 'damage':       s.damageMul *= 1.2; break;
    case 'area':         s.areaMul *= 1.2; break;
  }
  return s;
}
