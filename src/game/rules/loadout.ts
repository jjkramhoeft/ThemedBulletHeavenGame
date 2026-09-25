import { WEAPON_ARCHETYPES, type WeaponArchetype } from './archetypes';
import { type Rng, pick, shuffled } from './rng';
import { MAX_WEAPON_LEVEL, MAX_WEAPONS } from './weapons';

export interface OwnedWeapon {
  weapon: WeaponArchetype;
  level: number;
}

/** The Weapons a player holds during a Run, in the order they were gained. */
export type Loadout = readonly OwnedWeapon[];

export type Card =
  | { kind: 'new'; weapon: WeaponArchetype }
  | { kind: 'level'; weapon: WeaponArchetype; toLevel: number }
  | { kind: 'heal' };

export const LEVEL_UP_CARDS = 3;

export function startingLoadout(weapon: WeaponArchetype): Loadout {
  return [{ weapon, level: 1 }];
}

function levelCards(loadout: Loadout): Card[] {
  return loadout
    .filter((w) => w.level < MAX_WEAPON_LEVEL)
    .map((w) => ({ kind: 'level', weapon: w.weapon, toLevel: w.level + 1 }));
}

/** The cards a Level-up offers: up to 3 distinct new-Weapon or +1-level cards, or a single heal card. */
export function levelUpCards(loadout: Loadout, rng: Rng): Card[] {
  const owned = new Set(loadout.map((w) => w.weapon));
  const candidates: Card[] = levelCards(loadout);
  if (loadout.length < MAX_WEAPONS) {
    for (const weapon of WEAPON_ARCHETYPES) if (!owned.has(weapon)) candidates.push({ kind: 'new', weapon });
  }
  if (candidates.length === 0) return [{ kind: 'heal' }];
  return shuffled(rng, candidates).slice(0, LEVEL_UP_CARDS);
}

/** What a Chest grants: +1 level on a random owned Weapon that isn't maxed, or a heal. */
export function chestReward(loadout: Loadout, rng: Rng): Card {
  const options = levelCards(loadout);
  return options.length === 0 ? { kind: 'heal' } : pick(rng, options);
}

export function applyCard(loadout: Loadout, card: Card): Loadout {
  switch (card.kind) {
    case 'heal':
      return loadout;
    case 'new':
      if (loadout.length >= MAX_WEAPONS) throw new Error('no free weapon slot');
      if (loadout.some((w) => w.weapon === card.weapon)) throw new Error(`already own ${card.weapon}`);
      return [...loadout, { weapon: card.weapon, level: 1 }];
    case 'level':
      return loadout.map((w) => {
        if (w.weapon !== card.weapon) return w;
        if (w.level + 1 !== card.toLevel) throw new Error(`stale card for ${card.weapon}`);
        return { ...w, level: card.toLevel };
      });
  }
}
