import { CHARACTERS, characterStats, type CharacterId } from './characters';
import { applyCard, startingLoadout, type Card, type Loadout } from './loadout';
import type { PlayerStats } from './passives';
import { gainXp, heal, type Health, type XpState } from './progression';

/** Everything that changes during one Run. The Game scene owns it; the HUD only reads it. */
export interface RunState {
  characterId: CharacterId;
  stats: PlayerStats;
  loadout: Loadout;
  xp: XpState;
  health: Health;
  elapsedMs: number;
  kills: number;
  pendingLevelUps: number;
  pendingChests: number;
  /** 0..1 while the Boss is alive, otherwise null */
  bossHpFrac: number | null;
}

export function createRun(characterId: CharacterId): RunState {
  const stats = characterStats(characterId);
  return {
    characterId,
    stats,
    loadout: startingLoadout(CHARACTERS[characterId].startingWeapon),
    xp: { level: 1, xp: 0 },
    health: { hp: stats.maxHp, maxHp: stats.maxHp, invulnerableMs: 0 },
    elapsedMs: 0,
    kills: 0,
    pendingLevelUps: 0,
    pendingChests: 0,
    bossHpFrac: null,
  };
}

export function collectXp(run: RunState, amount: number): void {
  const r = gainXp(run.xp, amount);
  run.xp = r.state;
  run.pendingLevelUps += r.levelUps;
}

/** Applies a Level-up or Chest card; a heal card restores full HP. */
export function takeCard(run: RunState, card: Card): void {
  if (card.kind === 'heal') run.health = heal(run.health, run.health.maxHp);
  else run.loadout = applyCard(run.loadout, card);
}
