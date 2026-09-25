import { describe, expect, it } from 'vitest';
import { characterStats, CHARACTERS } from './characters';
import { BASE_PLAYER } from './passives';
import { gainXp, heal, PLAYER_INVULNERABLE_MS, takeDamage, tickHealth, xpToNext } from './progression';
import { weaponStats } from './weapons';

describe('gainXp', () => {
  it('levels up when the bar fills and carries the remainder', () => {
    const { state, levelUps } = gainXp({ level: 1, xp: 0 }, xpToNext(1) + 2);
    expect(levelUps).toBe(1);
    expect(state).toEqual({ level: 2, xp: 2 });
  });

  it('can trigger several Level-ups at once', () => {
    expect(gainXp({ level: 1, xp: 0 }, xpToNext(1) + xpToNext(2)).levelUps).toBe(2);
  });

  it('needs more XP for each level', () => {
    for (let l = 1; l < 50; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });
});

describe('health', () => {
  it('ignores hits while invulnerable', () => {
    const hit = takeDamage({ hp: 100, maxHp: 100, invulnerableMs: 0 }, 10);
    expect(hit.hp).toBe(90);
    expect(takeDamage(hit, 10).hp).toBe(90);
    expect(takeDamage(tickHealth(hit, PLAYER_INVULNERABLE_MS), 10).hp).toBe(80);
  });

  it('never heals above max', () => {
    expect(heal({ hp: 90, maxHp: 100, invulnerableMs: 0 }, 50).hp).toBe(100);
  });
});

describe('characters and passives', () => {
  it('every Character has a distinct starting Weapon', () => {
    const weapons = Object.values(CHARACTERS).map((c) => c.startingWeapon);
    expect(new Set(weapons).size).toBe(weapons.length);
  });

  it('applies the Passive on top of the base stats', () => {
    expect(characterStats('aura-start').maxHp).toBeGreaterThan(BASE_PLAYER.maxHp);
    expect(characterStats('shot-start').cooldownMul).toBeLessThan(1);
  });

  it('damage Passive scales Weapon damage', () => {
    const plain = weaponStats('sweep', 1, BASE_PLAYER).damage;
    expect(weaponStats('sweep', 1, characterStats('sweep-start')).damage).toBeCloseTo(plain * 1.2);
  });
});
