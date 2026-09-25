import { describe, expect, it } from 'vitest';
import { WEAPON_ARCHETYPES } from './archetypes';
import { applyCard, chestReward, levelUpCards, startingLoadout, type Loadout } from './loadout';
import { seeded } from './rng';
import { MAX_WEAPON_LEVEL, MAX_WEAPONS } from './weapons';

const maxed = (...ws: (typeof WEAPON_ARCHETYPES)[number][]): Loadout => ws.map((weapon) => ({ weapon, level: MAX_WEAPON_LEVEL }));

describe('levelUpCards', () => {
  it('offers three distinct cards at the start of a Run', () => {
    const cards = levelUpCards(startingLoadout('shot'), seeded(1));
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => JSON.stringify(c))).size).toBe(3);
  });

  it('never offers a new Weapon once all slots are full', () => {
    const full: Loadout = [
      { weapon: 'shot', level: 1 }, { weapon: 'aura', level: 2 },
      { weapon: 'sweep', level: 1 }, { weapon: 'orbit', level: 4 },
    ];
    expect(full).toHaveLength(MAX_WEAPONS);
    for (let seed = 0; seed < 50; seed++) {
      for (const card of levelUpCards(full, seeded(seed))) expect(card.kind).toBe('level');
    }
  });

  it('never offers a level past max', () => {
    const loadout: Loadout = [{ weapon: 'shot', level: MAX_WEAPON_LEVEL }, { weapon: 'aura', level: 2 }];
    for (let seed = 0; seed < 50; seed++) {
      for (const card of levelUpCards(loadout, seeded(seed))) {
        expect(card).not.toEqual(expect.objectContaining({ kind: 'level', weapon: 'shot' }));
      }
    }
  });

  it('falls back to a single heal card when nothing is left to offer', () => {
    expect(levelUpCards(maxed('shot', 'aura', 'sweep', 'orbit'), seeded(3))).toEqual([{ kind: 'heal' }]);
  });

  it('offers fewer than three cards when fewer exist', () => {
    const loadout: Loadout = [...maxed('shot', 'aura', 'sweep'), { weapon: 'orbit', level: 4 }];
    expect(levelUpCards(loadout, seeded(0))).toEqual([{ kind: 'level', weapon: 'orbit', toLevel: 5 }]);
  });
});

describe('chestReward', () => {
  it('raises an owned Weapon that is not maxed', () => {
    const loadout: Loadout = [{ weapon: 'shot', level: MAX_WEAPON_LEVEL }, { weapon: 'aura', level: 2 }];
    expect(chestReward(loadout, seeded(9))).toEqual({ kind: 'level', weapon: 'aura', toLevel: 3 });
  });

  it('heals when every owned Weapon is maxed', () => {
    expect(chestReward(maxed('shot'), seeded(9))).toEqual({ kind: 'heal' });
  });
});

describe('applyCard', () => {
  it('adds a new Weapon at level 1', () => {
    expect(applyCard(startingLoadout('shot'), { kind: 'new', weapon: 'aura' })).toEqual([
      { weapon: 'shot', level: 1 }, { weapon: 'aura', level: 1 },
    ]);
  });

  it('raises the Weapon Level', () => {
    expect(applyCard(startingLoadout('shot'), { kind: 'level', weapon: 'shot', toLevel: 2 })).toEqual([{ weapon: 'shot', level: 2 }]);
  });

  it('rejects a card that no longer matches the loadout', () => {
    expect(() => applyCard(startingLoadout('shot'), { kind: 'level', weapon: 'shot', toLevel: 3 })).toThrow();
    expect(() => applyCard(startingLoadout('shot'), { kind: 'new', weapon: 'shot' })).toThrow();
  });
});
