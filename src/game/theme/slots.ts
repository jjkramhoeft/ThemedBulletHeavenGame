// Every slot a Theme must fill (docs/design/themes.md §1). The frame, sound and key names here
// are the contract between theme files and game code; completeness.test.ts checks each Theme against it.
import { ENEMY_ARCHETYPES, PICKUP_ARCHETYPES, WEAPON_ARCHETYPES, type WeaponArchetype } from '../rules/archetypes';

/** LPC row order. */
export const DIRECTIONS = ['up', 'left', 'down', 'right'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Effect frame per Weapon, besides its `<weapon>/icon`. */
export const WEAPON_EFFECT_FRAME: Record<WeaponArchetype, string> = {
  sweep: 'sweep/arc',
  shot: 'shot/proj',
  orbit: 'orbit/blade',
  aura: 'aura/field',
  chain: 'chain/bolt',
  pulse: 'pulse/ring',
  lure: 'lure/bait',
};

export const ENEMY_EXTRA_FRAMES = ['ranged/proj', 'boss/proj', 'boss/telegraph_line', 'boss/telegraph_ring', 'boss/charge'] as const;

export const pickupFrame = (p: string) => `pickup/${p}`;
export const walkFrame = (actor: string, dir: Direction, i: number) => `${actor}/walk_${dir}_${i}`;
export const decorationFrame = (i: number) => `deco/${i}`;

export const SFX_MARKERS = [
  'hit', 'pickup', 'levelUp', 'chest', 'playerHurt', 'bossTelegraph', 'win', 'lose',
  ...WEAPON_ARCHETYPES.map((w) => `fire_${w}` as const),
] as const;
export type SfxMarker = (typeof SFX_MARKERS)[number];

/** Logical (un-prefixed) loader keys every Theme pack must provide. */
export const PACK_KEYS = {
  sprites: 'sprites',
  ground: 'ground',
  sfx: 'sfx',
  musicMenu: 'music.menu',
  musicGame: 'music.game',
  cutVideo: (w: WeaponArchetype) => `cut.${w}`,
  cutAudio: (w: WeaponArchetype) => `cut.${w}.audio`,
} as const;

/** Names every Theme must give (the text half of a Skin). */
export const NAMED_SLOTS = [...WEAPON_ARCHETYPES, ...ENEMY_ARCHETYPES, ...PICKUP_ARCHETYPES] as const;
export type NamedSlot = (typeof NAMED_SLOTS)[number];

export interface WalkSpec {
  /** Frames per direction; frame 0 is also the standing pose */
  frames: number;
  frameRate: number;
  /** First frame of the walking loop (LPC: 1, because frame 0 is the standing pose). Default 0. */
  loopFrom?: number;
}

/** Every atlas frame a Theme needs, given its Characters, walk spec and decoration count. */
export function requiredFrames(characters: readonly string[], walk: WalkSpec, decorations: number): string[] {
  const frames: string[] = [];
  for (const actor of [...characters, ...ENEMY_ARCHETYPES]) {
    for (const dir of DIRECTIONS) for (let i = 0; i < walk.frames; i++) frames.push(walkFrame(actor, dir, i));
  }
  for (const w of WEAPON_ARCHETYPES) frames.push(`${w}/icon`, WEAPON_EFFECT_FRAME[w]);
  frames.push(...ENEMY_EXTRA_FRAMES);
  frames.push(...PICKUP_ARCHETYPES.map(pickupFrame));
  for (let i = 0; i < decorations; i++) frames.push(decorationFrame(i));
  return frames;
}
