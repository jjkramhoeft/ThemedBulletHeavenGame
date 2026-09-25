import type { WeaponArchetype } from './archetypes';
import { applyPassive, BASE_PLAYER, type Passive, type PlayerStats } from './passives';

/** The theme-agnostic Character roster. Each Theme offers two of these and gives each a Skin. */
export const CHARACTERS = {
  'aura-start':  { startingWeapon: 'aura',  passive: 'maxHp' },
  'sweep-start': { startingWeapon: 'sweep', passive: 'damage' },
  'shot-start':  { startingWeapon: 'shot',  passive: 'cooldown' },
  'lure-start':  { startingWeapon: 'lure',  passive: 'moveSpeed' },
} as const satisfies Record<string, { startingWeapon: WeaponArchetype; passive: Passive }>;

export type CharacterId = keyof typeof CHARACTERS;

export function isCharacterId(id: string): id is CharacterId {
  return Object.hasOwn(CHARACTERS, id);
}

export function characterStats(id: CharacterId): PlayerStats {
  return applyPassive(BASE_PLAYER, CHARACTERS[id].passive);
}
