import type { WeaponArchetype } from '../rules/archetypes';
import type { CharacterId } from '../rules/characters';
import type { ThemeManifest } from './ThemeManifest';
import { PACK_KEYS, type Direction, type NamedSlot } from './slots';

export interface PackEntry { type: string; key: string }
export interface PackSection { prefix: string; path: string; files: PackEntry[] }

/** The loaded, active Theme. Game code asks it for keys and names instead of spelling them out. */
export class ThemeContext {
  /** Animation keys this Theme created, so unloading can remove them. */
  readonly animKeys: string[] = [];

  constructor(
    readonly manifest: ThemeManifest,
    readonly section: PackSection,
  ) {}

  get id() { return this.manifest.id; }

  /** Logical key -> namespaced key; matches the pack section's `prefix`. */
  key(logical: string) { return `${this.id}.${logical}`; }

  get sprites() { return this.key(PACK_KEYS.sprites); }
  get ground() { return this.key(PACK_KEYS.ground); }
  get sfxKey() { return this.key(PACK_KEYS.sfx); }
  get musicGame() { return this.key(PACK_KEYS.musicGame); }
  get musicMenu() { return this.key(PACK_KEYS.musicMenu); }

  walkAnim(actor: string, dir: Direction) { return `${this.id}.${actor}.walk.${dir}`; }

  cutscene(weapon: WeaponArchetype) {
    return { video: this.key(PACK_KEYS.cutVideo(weapon)), audio: this.key(PACK_KEYS.cutAudio(weapon)) };
  }

  name(slot: NamedSlot) { return this.manifest.names[slot]; }

  characterName(id: CharacterId) {
    return this.manifest.characters.find((c) => c.character === id)?.name ?? id;
  }

  scale(actor: string) {
    return (this.manifest.actorScale as Record<string, number> | undefined)?.[actor] ?? 1;
  }
}
