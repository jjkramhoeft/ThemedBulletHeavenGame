// A Theme is complete only when every slot has a Skin (CONTEXT.md). This checks every Theme on disk.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEAPON_ARCHETYPES } from '../rules/archetypes';
import { parseManifest, type ThemeIndex } from './ThemeManifest';
import { PACK_KEYS, requiredFrames, SFX_MARKERS } from './slots';

const PUBLIC = join(import.meta.dirname, '../../../public');
const readJson = (rel: string) => JSON.parse(readFileSync(join(PUBLIC, rel), 'utf8'));

interface PackEntry { type: string; key: string; url?: unknown; textureURL?: string; atlasURL?: string; jsonURL?: string; audioURL?: string[] }
interface PackSection { prefix: string; path: string; files: PackEntry[] }

/** Every URL a pack entry points at, relative to the section path. */
function entryUrls(e: PackEntry): string[] {
  const urls: string[] = [];
  const add = (u: unknown) => {
    if (typeof u === 'string') urls.push(u);
    else if (Array.isArray(u)) u.forEach(add);
    else if (u && typeof u === 'object' && 'url' in u) add((u as { url: unknown }).url);
  };
  add(e.url); add(e.textureURL); add(e.atlasURL); add(e.jsonURL); add(e.audioURL);
  return urls;
}

const index = readJson('assets/themes/index.json') as ThemeIndex;

describe.each(index.themes)('Theme %s', (id) => {
  const manifest = parseManifest(readJson(`assets/themes/${id}/theme.json`));
  const section = (readJson(manifest.pack) as Record<string, PackSection>)[id]!;
  const byKey = new Map(section?.files.map((f) => [f.key, f]) ?? []);

  it('has a manifest whose id matches its folder', () => {
    expect(manifest.id).toBe(id);
  });

  it('has a pack section named after the Theme, prefixed with its id', () => {
    expect(section).toBeDefined();
    expect(section.prefix).toBe(`${id}.`);
  });

  it('provides every pack key', () => {
    const keys = [PACK_KEYS.sprites, PACK_KEYS.ground, PACK_KEYS.sfx, PACK_KEYS.musicMenu, PACK_KEYS.musicGame,
      ...WEAPON_ARCHETYPES.flatMap((w) => [PACK_KEYS.cutVideo(w), PACK_KEYS.cutAudio(w)])];
    for (const k of keys) expect(byKey.has(k), `missing pack key ${k}`).toBe(true);
    for (const w of WEAPON_ARCHETYPES) expect(byKey.get(PACK_KEYS.cutVideo(w)), `cut.${w} must be muted (ADR 0001)`).toMatchObject({ type: 'video', noAudio: true });
  });

  it('points only at files that exist', () => {
    const missing: string[] = [];
    for (const e of section.files) {
      for (const u of entryUrls(e)) {
        if (existsSync(join(PUBLIC, section.path, u))) continue;
        // Placeholder Cutscenes need ffmpeg; the Debug Theme may run without them.
        if (e.type === 'video' && manifest.devOnly) continue;
        missing.push(u);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has every atlas frame', () => {
    const atlas = readJson(join(section.path, byKey.get(PACK_KEYS.sprites)!.atlasURL!));
    const have = new Set(Object.keys(atlas.frames));
    const need = requiredFrames(manifest.characters.map((c) => c.character), manifest.walk, manifest.decorations);
    expect(need.filter((f) => !have.has(f))).toEqual([]);
  });

  it('has every SFX marker', () => {
    const sfx = readJson(join(section.path, byKey.get(PACK_KEYS.sfx)!.jsonURL!));
    expect(SFX_MARKERS.filter((m) => !(m in sfx.spritemap))).toEqual([]);
  });
});
