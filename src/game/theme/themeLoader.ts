import Phaser from 'phaser';
import { ENEMY_ARCHETYPES } from '../rules/archetypes';
import { ThemeContext, type PackSection } from './ThemeContext';
import type { ThemeManifest } from './ThemeManifest';
import { DIRECTIONS } from './slots';

const loaded = new Map<string, ThemeContext>();

const packCacheKey = (id: string) => `pack.${id}`;

/** Loads a Theme's pack section (namespaced by its prefix) and builds its animations. No-op if already loaded. */
export async function loadTheme(scene: Phaser.Scene, manifest: ThemeManifest, onProgress?: (p: number) => void): Promise<ThemeContext> {
  const existing = loaded.get(manifest.id);
  if (existing) return existing;

  await new Promise<void>((resolve, reject) => {
    const failures: string[] = [];
    const onError = (file: Phaser.Loader.File) => failures.push(file.key);
    const onProg = (p: number) => onProgress?.(p);
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    scene.load.on(Phaser.Loader.Events.PROGRESS, onProg);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      scene.load.off(Phaser.Loader.Events.PROGRESS, onProg);
      if (failures.length) reject(new Error(`Theme ${manifest.id}: failed to load ${failures.join(', ')}`));
      else resolve();
    });
    scene.load.pack(packCacheKey(manifest.id), manifest.pack, manifest.id);
    scene.load.start();
  });

  const pack = scene.cache.json.get(packCacheKey(manifest.id)) as Record<string, PackSection>;
  const ctx = new ThemeContext(manifest, pack[manifest.id]!);

  const actors = [...manifest.characters.map((c) => c.character), ...ENEMY_ARCHETYPES];
  for (const actor of actors) {
    for (const dir of DIRECTIONS) {
      const key = ctx.walkAnim(actor, dir);
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNames(ctx.sprites, { prefix: `${actor}/walk_${dir}_`, start: 0, end: manifest.walk.frames - 1 }),
        frameRate: manifest.walk.frameRate,
        repeat: -1,
      });
      ctx.animKeys.push(key);
    }
  }
  loaded.set(manifest.id, ctx);
  return ctx;
}

/**
 * Removes everything a Theme loaded. Scenes that used it must already be stopped:
 * textures go last, because objects still using them would throw on the next render.
 */
export function unloadTheme(game: Phaser.Game, id: string): void {
  const ctx = loaded.get(id);
  if (!ctx) return;
  for (const k of ctx.animKeys) game.anims.remove(k);
  const textures: string[] = [];
  for (const f of ctx.section.files) {
    const key = ctx.section.prefix + f.key;
    switch (f.type) {
      case 'audio':
        game.sound.removeByKey(key);
        game.cache.audio.remove(key);
        break;
      case 'audioSprite':
        game.sound.removeByKey(key);
        game.cache.audio.remove(key);
        game.cache.json.remove(key);
        break;
      case 'video':
        game.cache.video.remove(key);
        break;
      case 'atlas':
      case 'image':
        textures.push(key);
        break;
    }
  }
  for (const key of textures) if (game.textures.exists(key)) game.textures.remove(key);
  game.cache.json.remove(packCacheKey(id));
  loaded.delete(id);
}

export function unloadAllExcept(game: Phaser.Game, keepId: string): void {
  for (const id of [...loaded.keys()]) if (id !== keepId) unloadTheme(game, id);
}
