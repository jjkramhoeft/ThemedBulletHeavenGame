/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  const n = level - 1;
  return Math.floor(5 + 5 * n + 0.35 * n * n);
}

export interface XpState {
  level: number;
  /** XP collected towards the next level */
  xp: number;
}

/** Adds XP and reports how many Level-ups it triggered. */
export function gainXp(state: XpState, amount: number): { state: XpState; levelUps: number } {
  let { level, xp } = state;
  xp += amount;
  let levelUps = 0;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    levelUps++;
  }
  return { state: { level, xp }, levelUps };
}

export const PLAYER_INVULNERABLE_MS = 500;

export interface Health {
  hp: number;
  maxHp: number;
  /** Remaining invulnerability after a hit */
  invulnerableMs: number;
}

export function takeDamage(h: Health, amount: number): Health {
  if (h.invulnerableMs > 0 || h.hp <= 0) return h;
  return { ...h, hp: Math.max(0, h.hp - amount), invulnerableMs: PLAYER_INVULNERABLE_MS };
}

export function heal(h: Health, amount: number): Health {
  return { ...h, hp: Math.min(h.maxHp, h.hp + amount) };
}

export function tickHealth(h: Health, dtMs: number): Health {
  return h.invulnerableMs > 0 ? { ...h, invulnerableMs: Math.max(0, h.invulnerableMs - dtMs) } : h;
}
