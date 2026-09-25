import { isCharacterId, type CharacterId } from '../rules/characters';
import type { EnemyArchetype } from '../rules/archetypes';
import { NAMED_SLOTS, type NamedSlot, type WalkSpec } from './slots';

/** One Theme's `theme.json`. Everything here is presentation; mechanics never read it. */
export interface ThemeManifest {
  id: string;
  name: string;
  /** Shown only in dev builds (the Debug Theme) */
  devOnly?: boolean;
  /** URL of this Theme's Asset Pack; its section key equals `id` */
  pack: string;
  characters: Array<{ character: CharacterId; name: string }>;
  names: Record<NamedSlot, string>;
  walk: WalkSpec;
  decorations: number;
  /** Display scale per actor, since LPC frames are all 64 px. Visual only. */
  actorScale?: Partial<Record<EnemyArchetype | 'player', number>>;
}

export interface ThemeIndex {
  version: 1;
  themes: string[];
}

/** Validates parsed JSON; throws with a readable message so a broken Theme fails loudly at boot. */
export function parseManifest(raw: unknown): ThemeManifest {
  const m = raw as Partial<ThemeManifest> | null;
  const fail = (msg: string): never => { throw new Error(`theme.json${m?.id ? ` (${m.id})` : ''}: ${msg}`); };
  if (!m || typeof m !== 'object') fail('not an object');
  if (typeof m!.id !== 'string' || !/^[a-z0-9-]+$/.test(m!.id)) fail('id must be lowercase letters, digits, dashes');
  if (typeof m!.name !== 'string') fail('missing name');
  if (typeof m!.pack !== 'string') fail('missing pack');
  if (!Array.isArray(m!.characters) || m!.characters.length !== 2) fail('must offer exactly two characters');
  for (const c of m!.characters!) if (!isCharacterId(c.character)) fail(`unknown character ${c.character}`);
  if (!m!.names) fail('missing names');
  for (const slot of NAMED_SLOTS) if (typeof m!.names![slot] !== 'string') fail(`missing name for ${slot}`);
  if (!m!.walk || !(m!.walk.frames > 0) || !(m!.walk.frameRate > 0)) fail('walk needs frames and frameRate');
  if (typeof m!.decorations !== 'number') fail('missing decorations');
  return m as ThemeManifest;
}
