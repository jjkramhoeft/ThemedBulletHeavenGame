# Phaser multi-theme bullet heaven: technical foundations

Research date: 2026-09-25. Pinned to **Phaser v4.2.1**. Source links point at the `v4.2.1` tag of `phaserjs/phaser` unless stated otherwise.

Labels used in this file:
- **[source]** means the claim is stated in, or read directly from, the cited primary source.
- **[inference]** means it is my conclusion from the cited sources. It is not stated there verbatim.
- **[secondary]** means no primary source was found, so the claim comes from another source.

> **Updated 2026-09-25 after a design review.** Where this file originally left a choice open, it now uses the chosen design, marked **Decision**. The terms come from [CONTEXT.md](../../CONTEXT.md), and the rules from [game-rules.md](../design/game-rules.md). See also [ADR 0001](../adr/0001-cutscenes-play-muted-with-separate-soundtrack.md) (muted Cutscenes with a separate soundtrack) and [ADR 0002](../adr/0002-game-rules-in-phaser-free-modules.md) (Phaser-free rule modules).

---

## TL;DR

- **Version.** Phaser 4 is current. The latest release is **v4.2.1 (2026-07-09)**. Earlier releases were v4.0.0 (2026-04-10), v4.1.0 (2026-04-30) and v4.2.0 (2026-06-19). The last 3.x release is v3.90.0 (2025-05-23). ([releases](https://github.com/phaserjs/phaser/releases), [v4.2.1](https://github.com/phaserjs/phaser/releases/tag/v4.2.1), [v3.90.0](https://github.com/phaserjs/phaser/releases/tag/v3.90.0)). docs.phaser.io currently documents **v4.1.0**, not 4.2.1. newdocs.phaser.io did not resolve (DNS) when I checked.
- **Tooling.** Start from the official `phaserjs/template-vite-ts` template (Vite 6 and TypeScript 5.7), then bump `phaser` from the pinned `4.0.0` to `^4.2.1`. Phaser ships its own `.d.ts` types.
- **Themes.** Keep all mechanics in theme-agnostic data keyed by *archetype* (enemy archetypes such as `swarmer` and `tank`, weapon archetypes such as `sweep` and `shot`, plus `player`; see [docs/design/themes.md](../design/themes.md)). The player picks a theme at the start of each Run. For each theme, load one Asset Pack section. Give each section its own loader **`prefix`** so every theme's keys are namespaced (`plague.sprites`, `western.sprites`). Use **identical frame names** in every theme's atlas, so switching theme only changes the texture key. To unload, destroy the objects that use the theme first, then remove anims, textures, cache entries and sounds.
- **Performance.** Pool with `Group` using `maxSize`, `get()` and, for physics objects, `disableBody(true, true)`. `killAndHide` does not disable the physics body. Use Arcade `overlap` with circle bodies. Arcade's dynamic RTree is fine well below the source's "~5,000 bodies" guidance. Put all gameplay sprites for a theme in one atlas, because by default Phaser uses **1 texture per batch on iOS/Android** (`autoMobileTextures`). Use WebGL. Canvas is deprecated in v4.
- **Cutscenes.** `this.load.video()` downloads nothing. It only resolves a URL; the `Video` game object fetches the file itself when it loads it. Audible video needs a user gesture (sticky activation on Chrome; a gesture handler is the safe choice on WebKit). The most robust pattern is to start playback **synchronously inside the pointer handler of the upgrade-choice UI**. An alternative is to play the video muted (`noAudio: true`) and play its soundtrack through the already-unlocked Web Audio Sound Manager. Pause the Game scene with `scene.pause('Game')`, which stops physics, timers, tweens, anims and input updates but keeps rendering. **Decision:** Cutscenes play only after a Chest Reveal, one clip per weapon per theme. They always play muted, and the soundtrack plays through Web Audio ([ADR 0001](../adr/0001-cutscenes-play-muted-with-separate-soundtrack.md)).
- **Codecs.** Ship MP4 (H.264 High/Main, AAC-LC, `+faststart`) as the baseline. Optionally add a VP9 WebM *first* in the URL list, gated with `{ type: 'vp9' }`. Serve videos **same-origin**, because `load.video` never sets `crossOrigin`. Also serve them with byte-range support. Keep the resolution modest (720p), since every frame is uploaded to a WebGL texture.
- **Save data.** Store one versioned JSON blob in `localStorage` (5 MiB limit). v1 has no meta-progression: the save holds the best result per theme and Character, plus the Cutscenes seen per theme. Put the last theme and Character in a separate preferences key. Wrap every access in try/catch (`SecurityError`, `QuotaExceededError`). Safari can erase script-written storage after 7 days without interaction, so offer export/import.

---

## 1. Version, template, tooling, project structure

### Version facts
- The npm/GitHub latest is `4.2.1`. The `package.json` at the tag says `"version": "4.2.1"`. [source] ([package.json](https://github.com/phaserjs/phaser/blob/v4.2.1/package.json), [releases](https://github.com/phaserjs/phaser/releases))
- The docs site header reads "Version: Phaser v4.1.0" (checked 2026-09-25). API pages follow `https://docs.phaser.io/api-documentation/class/<namespace>-<class>`, for example [gameobjects-video](https://docs.phaser.io/api-documentation/class/gameobjects-video). [source] Because the docs lag 4.2.1, **treat the GitHub source and JSDoc at the tag as authoritative**. [inference]
- The repo ships official topic guides under `skills/` (for example [loading-assets](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/loading-assets/SKILL.md) and [v3-to-v4-migration](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/v3-to-v4-migration/SKILL.md)) and design docs under `docs/`, such as [Phaser 4 Rendering Concepts](https://github.com/phaserjs/phaser/blob/v4.2.1/docs/Phaser%204%20Rendering%20Concepts/Phaser%204%20Rendering%20Concepts.md). They are first-party and I use them below.
- The package exposes ESM (`dist/phaser.esm.js`) and types (`types/phaser.d.ts`) via `exports`. [source] ([package.json](https://github.com/phaserjs/phaser/blob/v4.2.1/package.json))

### v3 vs v4 differences relevant here (flagged)
Source: [v3-to-v4 migration guide](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/v3-to-v4-migration/SKILL.md).
- The **renderer was rewritten**. Pipelines became RenderNodes. Custom v3 pipelines do not port.
- **The Canvas renderer is deprecated.** WebGL is recommended for all new projects ([section 2](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/v3-to-v4-migration/SKILL.md?plain=1#L65-L69)).
- FX and BitmapMask were replaced by **Filters**. `setTintFill` became `setTint().setTintMode(Phaser.TintModes.FILL)`.
- `Geom.Point` became `Vector2`. `Phaser.Struct.Set/Map` became native `Set/Map`. `Math.TAU` is now 2π.
- **`roundPixels` now defaults to `false`**. It was `true` in v3 ([section 16](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/v3-to-v4-migration/SKILL.md?plain=1#L332-L345)).
- Video: v4 added **MOV detection** in `Device.Video` ([issue #6931 comment](https://github.com/phaserjs/phaser/issues/6931)). The rVFC-based Video object dates from the v3.60 rewrite ([#6192](https://github.com/phaserjs/phaser/issues/6192)). Groups, the Arcade API, the Loader and Sound are API-compatible with late v3 for everything used in this doc. [inference from reading the v4.2.1 sources and changelogs, which show no breaking changes in these areas]
- New in v4: `SpriteGPULayer`, which can draw up to millions of quads in a single draw call but is intended for mostly static content (see §3).

### Recommended template
- Scaffold with `npm create @phaserjs/game@latest`. This CLI offers the official templates ([README](https://github.com/phaserjs/phaser/blob/v4.2.1/README.md#create-phaser-game-app), [tutorial](https://phaser.io/tutorials/create-game-app)). Alternatively, clone [phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts).
- What the template contains, as of commit `d1d7d58`, 2026-04-21 [source] ([package.json](https://github.com/phaserjs/template-vite-ts/blob/main/package.json), [README](https://github.com/phaserjs/template-vite-ts/blob/main/README.md)):
  - `phaser: "4.0.0"` (pinned, so **bump to 4.2.1**), `vite ^6.3.1`, `typescript ~5.7.2`, and `terser`. The package `description` still says "Phaser 3". That is stale metadata.
  - Scenes `Boot`, `Preloader`, `MainMenu`, `Game` and `GameOver` under `src/game/scenes`. The config is in `src/game/main.ts`. Static assets go in `public/assets`, which is copied to `dist/assets` on build.
  - The production Vite config sets `base: './'`, puts Phaser in its own chunk via `manualChunks: { phaser: ['phaser'] }`, and minifies with terser ([config.prod.mjs](https://github.com/phaserjs/template-vite-ts/blob/main/vite/config.prod.mjs)).
  - `npm run dev` / `build` run `log.js`, which makes one anonymous call to `gryzor.co` (template name, dev/prod, Phaser version). Use `dev-nolog` / `build-nolog` to opt out. [source] (README "About log.js")
- Recommendation: put theme media (atlases, audio, MP4) in `public/assets/themes/<id>/` and load it by URL through the Loader, not through Vite `import`s. That keeps the bundle small and lets the Loader choose formats. [inference, based on the template README's split between imported and static assets]

---

## 2. Theme architecture

### 2.1 Data-driven, theme-agnostic mechanics
Principle: gameplay code never mentions a theme. It talks about **archetypes** and **ids**, and a theme manifest maps archetypes to asset keys. **Decision:** these modules live in `src/game/rules/`, never import Phaser or `theme/`, and are unit-tested with Vitest ([ADR 0002](../adr/0002-game-rules-in-phaser-free-modules.md)). [inference/design]

```ts
// src/game/rules/archetypes.ts  (theme-agnostic, no Phaser imports)
// Archetype keys match docs/design/themes.md
export type EnemyArchetype  = 'swarmer' | 'splitter' | 'fragment' | 'tank' | 'ranged' | 'boss';
export type WeaponArchetype = 'sweep' | 'shot' | 'orbit' | 'aura' | 'chain' | 'pulse' | 'lure';
export type PickupArchetype = 'xp' | 'heal' | 'magnet' | 'chest';

export const ENEMIES: Record<EnemyArchetype, { hp: number; speed: number; radius: number; xp: number }> = {
  swarmer:  { hp: 5,   speed: 110, radius: 8,  xp: 1 },
  splitter: { hp: 12,  speed: 60,  radius: 12, xp: 2 },
  fragment: { hp: 3,   speed: 120, radius: 7,  xp: 1 },
  tank:     { hp: 30,  speed: 40,  radius: 16, xp: 3 },
  ranged:   { hp: 10,  speed: 50,  radius: 10, xp: 2 },
  boss:     { hp: 500, speed: 35,  radius: 32, xp: 50 },
};
export const MAX_WEAPONS = 4;
export const MAX_WEAPON_LEVEL = 5;
export const WEAPONS: Record<WeaponArchetype, { cooldownMs: number; damage: number }> = { /* ... */ };
```

```ts
// src/game/theme/ThemeContext.ts
export interface ThemeManifest {
  id: string;                 // 'plague' | 'western' | 'pirate' | 'zombie' | 'kabuki' ...
  packUrl: string;            // shared pack file
  packSection: string;        // section name inside it (== id)
  anims: Record<string, { frames: string; frameRate: number; repeat: number; end: number }>;
  characters: Array<{ character: string; name: string }>;   // the two theme-agnostic Character ids this theme offers
}
export class ThemeContext {
  constructor(public readonly m: ThemeManifest) {}
  /** logical key -> namespaced key, matches the pack section "prefix" */
  key(logical: string) { return `${this.m.id}.${logical}`; }
  anim(archetype: string, action: string) { return `${this.m.id}.${archetype}.${action}`; }
  /** One Cutscene per weapon: muted video plus a separate soundtrack (ADR 0001) */
  cutscene(weapon: string) { return { video: this.key(`cut.${weapon}`), audio: this.key(`cut.${weapon}.audio`) }; }
}
```

Keep the active `ThemeContext` in the global registry (`this.registry.set('theme', ctx)`). The registry is a DataManager shared by all scenes ([scenes skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/scenes/SKILL.md?plain=1#L186-L220)). [source for the registry]

### 2.2 Logical keys mapped to per-theme files, via Asset Pack sections plus `prefix`
Relevant Loader facts, all [source]:
- `this.load.pack(key, url, dataKey)`. For pack files, the third argument selects **one section** of the pack. `PackFile.onProcess` passes it to `LoaderPlugin.addPack(pack, packKey)`, which loads only `pack[packKey]` ([PackFile.js#L59](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/PackFile.js#L59), [LoaderPlugin.addPack#L634](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/LoaderPlugin.js#L634)).
- Each section may set `baseURL`, `path`, `prefix` and `defaultType`. These apply only to that section and are restored afterwards ([addPack#L634](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/LoaderPlugin.js#L634)).
- A loader `prefix` is prepended to every file key: `this.key = loader.prefix + loadKey` ([File.js#L82](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/File.js#L82)).
- Entries use the same config shapes as the loader methods. `type` is the loader method name (`atlas` with `textureURL`/`atlasURL`, `audioSprite` with `jsonURL`/`audioURL`, and so on) ([PackFile docs](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/PackFile.js), [AtlasJSONFile.js#L53](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/AtlasJSONFile.js#L53), [AudioSpriteFile.js#L49](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/AudioSpriteFile.js#L49)).
- All caches are **global** to the game, not per scene. A key that is already present is skipped with a warning, so you must remove it before reloading ([loading-assets skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/loading-assets/SKILL.md), [LoaderPlugin.keyExists#L571](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/LoaderPlugin.js#L571)).
- Outside `preload()`, you must call `this.load.start()` and wait for `complete` ([loading-assets skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/loading-assets/SKILL.md)).
- A Scene can declare a `pack` in its constructor, and that pack loads *before* `preload()`. Use it for the loading-bar art ([loading-assets skill, "Scene Payload"](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/loading-assets/SKILL.md)).

Why use a prefix per theme instead of identical keys: identical keys force a full unload before the next theme can load, because duplicate keys are ignored. Prefixed keys let two themes coexist briefly, for example when preloading the next theme during a menu, and they make "which theme owns this asset" explicit, so unloading reduces to filtering by prefix. [inference]

Recommended: **use the same frame names in every theme's atlas** (`player/walk_0001`, `swarmer/walk_0001`, `shot/proj_0001`, `shot/icon`, and so on). Then archetype code only swaps the texture key: `this.add.sprite(x, y, theme.key('sprites'), 'swarmer/walk_0001')`. [inference/design]

```ts
// Loading a theme at runtime (e.g. from a ThemeLoader scene)
async function loadTheme(scene: Phaser.Scene, t: ThemeManifest): Promise<void> {
  await new Promise<void>((resolve) => {
    scene.load.pack(`pack.${t.id}`, t.packUrl, t.packSection);  // loads only this section
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
  // Build animations from the theme-agnostic anim spec, namespaced by theme.
  const ctx = new ThemeContext(t);
  for (const [name, a] of Object.entries(t.anims)) {
    scene.anims.create({
      key: `${t.id}.${name}`,
      frames: scene.anims.generateFrameNames(ctx.key('sprites'), { prefix: a.frames, end: a.end, zeroPad: 4 }),
      frameRate: a.frameRate, repeat: a.repeat,
    });
  }
}
```
Keep the pack JSON under a key like `pack.<id>` (it lands in the JSON cache). If you want to reload it later, remove it from the JSON cache first. [inference from the duplicate-key rule]

Animations are global. `load.animation()` passes its JSON to `anims.fromJSON`, and the loader prefix is **not** applied to the animation keys inside that JSON ([AnimationJSONFile.js](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/AnimationJSONFile.js)). For that reason I recommend creating anims in code from a shared spec, as shown above. [source + inference]

### 2.3 Unloading a theme
All of the following are [source]:
- `textures.remove(key)` destroys the Texture and its WebGLTexture and emits `removetexture`. Game Objects that still use it "will start throwing errors the next time they try to render", so it must be the **last** step ([TextureManager.js#L282-L299](https://github.com/phaserjs/phaser/blob/v4.2.1/src/textures/TextureManager.js#L282-L299)).
- `anims.remove(key)` is global. After it, no object can use the animation ([AnimationManager.js#L972](https://github.com/phaserjs/phaser/blob/v4.2.1/src/animations/AnimationManager.js#L972)).
- `cache.<type>.remove(key)` does no dependency checks ([BaseCache.js#L121-L135](https://github.com/phaserjs/phaser/blob/v4.2.1/src/cache/BaseCache.js#L121-L135)).
- `sound.removeByKey(key)` destroys every sound instance with that key ([BaseSoundManager.js#L431](https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/BaseSoundManager.js#L431)). The decoded buffer lives in `cache.audio`.

```ts
function unloadTheme(game: Phaser.Game, id: string) {
  const p = `${id}.`;
  // 1. Scenes that used the theme must already be stopped (objects destroyed).
  game.sound.getAll().filter(s => s.key.startsWith(p)).forEach(s => game.sound.remove(s));
  game.anims.toJSON().anims.map(a => a.key).filter(k => k.startsWith(p)).forEach(k => game.anims.remove(k));
  for (const c of [game.cache.audio, game.cache.json, game.cache.video]) {
    c.getKeys().filter(k => k.startsWith(p)).forEach(k => c.remove(k));
  }
  game.textures.getTextureKeys().filter(k => k.startsWith(p)).forEach(k => game.textures.remove(k)); // last
  game.cache.json.remove(`pack.${id}`);
}
```
(`getKeys`, `getTextureKeys` and `anims.toJSON` exist on BaseCache, TextureManager and AnimationManager respectively. Check the exact TS signatures against `types/phaser.d.ts`.)

### 2.4 Scene structure
Facts, all [source] ([scenes skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/scenes/SKILL.md), [Systems.js#L410](https://github.com/phaserjs/phaser/blob/v4.2.1/src/scene/Systems.js#L410)):
- `start()` shuts down the calling scene, while `launch()` runs another scene in parallel.
- `pause()` stops update but **still renders**. `sleep()` stops both update and render.
- Scenes render in list order.

Proposed layout [inference/design]:

| Scene | Role |
|---|---|
| `Boot` | Loads only the loading-bar art and the `themes/index.json` manifest (via the constructor `pack`). |
| `Preloader` | Loads the shared (theme-independent) UI atlas and fonts, then the **selected theme** section. Shows progress. |
| `MainMenu` | Run setup: pick a theme and one of its two Characters. This is also the **first user gesture**, which unlocks Web Audio (§5). Picking a different theme than last time runs `unloadTheme(old)` and then `loadTheme(new)`. |
| `Game` | Simulation: physics, pools, spawns. Calls `rules/` for decisions. Asks `ThemeContext` for keys. |
| `HUD` | Launched in parallel with `Game`. It keeps running while `Game` is paused. |
| `LevelUp` | Modal chooser with 3 cards. `Game` is paused. Plays no Cutscene. |
| `ChestReveal` | Pause after picking up a Chest. On confirm, applies the Chest result and launches `Cutscene` for the chosen weapon (or resumes `Game` if the Chest healed). |
| `Cutscene` | Muted video with its soundtrack, above `Game`. Resumes `Game` on `complete`, `error`, `unsupported` or skip. |
| `GameOver` | Results. Persists progression (§6). |

---

## 3. Performance for hundreds of enemies and projectiles

### 3.1 Pooling with Groups
All of the following are [source] ([Group.js](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/group/Group.js), [groups skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/groups-and-containers/SKILL.md)):
- `maxSize` defaults to `-1` (no limit) ([#L170](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/group/Group.js#L170)). When the group is full, `create()` returns `null` ([#L308](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/group/Group.js#L308)), so `get()` can return `null`. Always null-check.
- `get(x, y, key, frame, visible)` is `getFirst(false, true, ...)`: it returns the first **inactive** member, or creates one ([#L1041](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/group/Group.js#L1041)).
- `killAndHide(go)` **only** sets `active=false` and `visible=false` ([#L1682](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/group/Group.js#L1682)). It does not touch a physics body. For Arcade objects use `disableBody(true, true)`, which zeroes velocity, removes the body from collision checks and deactivates and hides the object ([Enable.js#L87-L106](https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/components/Enable.js#L87-L106)). Use `enableBody(true, x, y, true, true)` to revive.
- The UpdateList skips `preUpdate` for inactive objects, so dead pool members cost no animation updates ([UpdateList.js#L145](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/UpdateList.js#L145)).
- Official examples: [pools/](https://github.com/phaserjs/examples/tree/master/public/src/pools) (bullets, max size, custom class, multi pools) and [recycle physics body](https://github.com/phaserjs/examples/blob/master/public/src/physics/arcade/recycle%20physics%20body.js). The examples repo README calls itself "Phaser 4 Examples" ([README](https://github.com/phaserjs/examples/blob/master/README.md)).

```ts
this.enemies = this.physics.add.group({ classType: Enemy, maxSize: 600, runChildUpdate: false });
this.shots   = this.physics.add.group({ classType: Projectile, maxSize: 800, allowGravity: false });
// spawn
const e = this.enemies.get(x, y, theme.key('sprites'), 'swarmer/walk_0001') as Enemy | null;
if (e) { e.enableBody(true, x, y, true, true); e.body!.setCircle(ENEMIES.swarmer.radius); e.play(theme.anim('swarmer','walk')); }
// despawn
e.disableBody(true, true);
```

### 3.2 Arcade Physics vs manual collision; spatial partitioning
All of the following are [source]:
- By default Arcade keeps an **RTree for dynamic bodies** (`useTree: true`) and rebuilds it every physics step (`tree.clear(); tree.load(bodies)`). The JSDoc says "a conservative estimate of around 5,000 bodies should be considered the max before disabling it". Static bodies always use their own RTree ([World.js#L336-L357](https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/World.js#L336-L357), [World.update#L939](https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/World.js#L939)).
- Group-vs-group collision iterates group 1 and, for each body, **searches the RTree** with its bounds, skipping bodies with `enable === false` ([collideSpriteVsGroup#L2048](https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/World.js#L2048)). Disabled pooled bodies are therefore cheap.
- `overlap` detects without separating. `collide` separates bodies. Collision categories and masks (`nextCategory`, `setCollidesWith`, up to 32 categories) filter pairs before separation ([physics-arcade skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/physics-arcade/SKILL.md)).
- Physics runs at a fixed step (`fps: 60`, `fixedStep: true` by default). `customUpdate: true` lets you drive `world.update()` yourself ([physics-arcade skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/physics-arcade/SKILL.md)).
- Official stress examples exist for [10000 world bodies](https://github.com/phaserjs/examples/blob/master/public/src/physics/arcade/10000%20world%20bodies.js), 40000 world bodies and "500 colliding bodies" in [physics/arcade](https://github.com/phaserjs/examples/tree/master/public/src/physics/arcade).

Recommendations [inference]:
- Use `physics.add.overlap(shots, enemies, onHit)` and `overlap(player, enemies, onTouch)` with **circle bodies** and categories. Do **not** add `collider(enemies, enemies)` for crowd separation. That runs an RTree search and separation for every enemy every step, and physical pushing is rarely wanted in this genre. Use a cheap custom soft-separation pass (or none).
- Move enemies by setting velocity toward the player (`physics.moveToObject`), not by using forces.
- If profiling shows Arcade as the bottleneck with many hundreds of projectiles, replace projectile bodies with a manual **uniform-grid spatial hash**. Keep each projectile as a pooled `Image` without a body, bucket enemies by cell each step and test circle-vs-circle. Phaser has no built-in spatial hash (only the RTree), so this is custom code. [inference, from absence in `src/physics/arcade`]
- XP gems, which there can be many of, can also skip physics. Test distance to the player (magnet radius) in a manual loop.

### 3.3 Texture atlases, batching, WebGL vs Canvas
All of the following are [source] ([Rendering Concepts](https://github.com/phaserjs/phaser/blob/v4.2.1/docs/Phaser%204%20Rendering%20Concepts/Phaser%204%20Rendering%20Concepts.md?plain=1#L316-L406), [Config.js](https://github.com/phaserjs/phaser/blob/v4.2.1/src/core/Config.js#L350-L476)):
- The "Performance Cheat Sheet" says: "Draw calls are expensive. Don't use more than a few hundred". It also says to group similar items to batch, and that Filters and Dynamic/RenderTextures cost draw calls.
- Image, Sprite, BitmapText, Text, Particles, Blitter and **Video** are all in the **Quad** batch family. Batches break on a different shader, blend mode, lighting setting, round-pixel mode, filters, or when the batch is full (**16,384 quads** by default, `render.batchSize`).
- Phaser can bind several textures per batch. `maxTextures` defaults to `-1` (all units, WebGL1 guarantees at least 8). But **`autoMobileTextures` defaults to `true`: "If iOS or Android detected, automatically restrict WebGL to use 1 texture per batch"** ([Config.js#L350-L352](https://github.com/phaserjs/phaser/blob/v4.2.1/src/core/Config.js#L350-L352)). On phones, every texture switch in draw order starts a new batch.
- Add at least 1 px of padding in atlases to avoid bleeding.
- `SpriteGPULayer` (new in v4, WebGL-only) renders huge numbers of quads in one draw call from a static GPU buffer. However, buffer edits are expensive, it uses one texture, and multi-atlas is not supported ([SpriteGPULayer.js](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/spritegpulayer/SpriteGPULayer.js)). It suits **backgrounds and decoration**, not constantly moving pooled enemies. [inference from those constraints]
- Canvas is deprecated in v4 (§1). WebGL is recommended.

Recommendations [inference]:
- Per theme, put **one gameplay atlas** (2 players, 5 enemies, 7 weapons' effects, 4 pickups, hit FX) at 2048² or smaller, plus a **shared UI atlas**.
- Keep gameplay sprites contiguous in the display list, for example in one `Layer`, so that on mobile (1 texture per batch) enemies, projectiles and pickups batch together.
- Avoid per-sprite filters and lighting on pooled objects.
- Use `type: Phaser.AUTO` (WebGL with Canvas fallback).

---

## 4. MP4 cutscenes

### 4.1 Phaser `Video` game object and `load.video`
All of the following are [source] ([Video.js](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js), [VideoFile.js](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/VideoFile.js), [device/Video.js](https://github.com/phaserjs/phaser/blob/v4.2.1/src/device/Video.js)):
- **`this.load.video(key, urls, noAudio)` does not download the video.** `VideoFile.load()` resolves the URL and immediately marks the file loaded. "The actual video content is fetched later by the Video Game Object" ([VideoFile.js#L94-L113](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/VideoFile.js#L94-L113)). The video cache stores only `{ url, noAudio, crossOrigin }` ([#L83](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/VideoFile.js#L83)). A loading bar therefore does *not* cover video bytes.
- Format choice: pass an array of URLs, and the Loader picks the **first** entry the browser supports. Entries may be `{ url, type }`. `getVideoURL` uses `type`, or else the file extension, as a lookup into the `Device.Video` flags `mp4/h264`, `webm`, `vp9`, `mov`, `m4v`, `ogg`, `hls` ([device/Video.js#L108](https://github.com/phaserjs/phaser/blob/v4.2.1/src/device/Video.js#L108)). The flags come from `canPlayType` probes: `video/mp4; codecs="avc1.42E01E"` for mp4/h264, `video/webm; codecs="vp8, vorbis"` for webm and `video/webm; codecs="vp9"` for vp9 ([#L65-L92](https://github.com/phaserjs/phaser/blob/v4.2.1/src/device/Video.js#L65-L92)).
  - Consequence [inference]: a plain `.webm` URL is chosen whenever the browser supports **VP8+Vorbis**, not your actual codec. If you ship VP9 WebM, write `{ url: 'x.webm', type: 'vp9' }` so the probe matches the codec.
- The element is created with `playsinline`, `preload="auto"`, `disablePictureInPicture` and `controls=false`. With `noAudio=true` it sets `muted`, `defaultMuted` and `autoplay` ([loadHandler#L757](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L757)). `noAudio: true` may be used even when the file has audio. It then plays immediately, but silently ([class docs](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L61-L90)).
- Playback: "Playback is handled entirely via the Request Video Frame API" (a polyfill is provided). Each frame is copied into a WebGL texture ([Video.js#L58](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L58)). `requestVideoFrameCallback` has been Baseline since Oct 2024 ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)).
- Autoplay handling in `play()`: if the play promise rejects with `NotAllowedError`, the object sets `touchLocked`, emits **`locked`**, and retries every `retryInterval` (500 ms) in `preUpdate`. On success it emits **`unlocked`**. `NotSupportedError` emits `unsupported`, and other failures emit `error` ([playError#L1491](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L1491), [preUpdate#L1669](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L1669)). Other events: `play`, `playing`, `complete`, `stop`, `stalled`, `metadata`, `created`, `textureready`, `seeking`/`seeked` ([events](https://github.com/phaserjs/phaser/tree/v4.2.1/src/gameobjects/events)).
- `load(key)`, `changeSource(key)` and `loadURL(urls)` reuse the existing `<video>` element. "videos that require interaction to unlock, remain in an unlocked state, even if you change the source" ([#L630-L650](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L630-L650)).
- `stop()` does not abort a download. `destroy()` calls `removeVideoElement()`, which removes `src` ([#L2270-L2350](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L2270-L2350)).
- When the game is hidden, `Game.onHidden` pauses the loop and emits `PAUSE`, and the Video pauses via `globalPause` ([Game.js#L570](https://github.com/phaserjs/phaser/blob/v4.2.1/src/core/Game.js#L570), [Video.js#L1943](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L1943)).
- If the Sound Manager is globally muted when playback starts, the Video mutes itself ([playSuccess](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L1442-L1480)).
- Official examples: [game objects/video](https://github.com/phaserjs/examples/tree/master/public/src/game%20objects/video) ("play video", "change video source", "on complete event", and others).

### 4.2 Browser autoplay rules and user gestures
All of the following are [source]:
- WHATWG: `play()` returns a promise rejected with `NotAllowedError` if the element is not "allowed to play". The UA may, for example, allow playback only with transient activation and make an exception for muted playback ([HTML media](https://html.spec.whatwg.org/multipage/media.html#dom-media-play)). Activation-triggering events are `keydown` (not Esc or reserved shortcuts), `mousedown`, `pointerdown` (mouse), `pointerup` (non-mouse) and `touchend`. **Gamepad input is not in the list** ([HTML user activation](https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event)).
- MDN: inaudible media (no audio track, or muted) is not subject to autoplay blocking. Audible playback needs user interaction, an allowlist, or a Permissions Policy (`allow="autoplay"` for iframes). `navigator.getAutoplayPolicy("mediaelement")` returns `allowed`, `allowed-muted` or `disallowed` ([MDN Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)).
- Chrome: autoplay with sound is allowed once the user has interacted with the domain, when the desktop Media Engagement Index is high enough, or for an installed PWA. An AudioContext created before a gesture starts `suspended` and must be `resume()`d after one. Cross-origin iframes need `allow="autoplay"` ([Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)).
- WebKit on iOS: muted, or audio-track-less, `<video autoplay>` plays without a gesture. `playsinline` allows inline playback on iPhone. **If a video gains audio or is un-muted without a gesture, playback pauses.** Autoplaying videos pause when not visible ([WebKit: New video policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/)). WHATWG likewise runs "internal pause steps" when volume or mute changes on an element that is not allowed to play ([HTML media](https://html.spec.whatwg.org/multipage/media.html)).
- WebKit on macOS: audible autoplay is blocked by default on most sites. Check the `play()` promise and show controls or a button when it is rejected ([WebKit: Auto-play policy changes for macOS](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/)).

How Phaser delivers input events, [source], which matters for "play inside the gesture":
- **Mouse and touch** DOM handlers call `InputManager.onMouseDown` and friends, which call `updateInputPlugins` **synchronously**. A Phaser `pointerdown` or `pointerup` handler therefore runs inside the DOM event dispatch ([MouseManager.js#L380](https://github.com/phaserjs/phaser/blob/v4.2.1/src/input/mouse/MouseManager.js#L380), [InputManager.js#L727](https://github.com/phaserjs/phaser/blob/v4.2.1/src/input/InputManager.js#L727)).
- **Keyboard** events are **queued** and processed later, in the scene update ([KeyboardManager.js#L186-L194](https://github.com/phaserjs/phaser/blob/v4.2.1/src/input/keyboard/KeyboardManager.js#L186-L194), [KeyboardPlugin.update](https://github.com/phaserjs/phaser/blob/v4.2.1/src/input/keyboard/KeyboardPlugin.js#L731)). Calling `video.play()` from a Phaser key handler is therefore *not* inside the native event handler. This is harmless where sticky activation suffices (Chrome), but it is a risk on WebKit. [inference]

Recommended cutscene start pattern [inference]:
1. Show the upgrade-choice UI (the `LevelUp` scene). The player taps or clicks a choice. In that Phaser `pointerup` handler, **synchronously** create or `load()` the Video and call `play()`.
2. For keyboard or gamepad selection, either (a) add a native `keydown` listener on `window` that calls `play()`, or (b) use the **muted-video + Web Audio soundtrack** approach. Encode the cutscene audio as a separate file in the theme's audio, load the video with `noAudio: true`, and start `this.sound.play(theme.key('cut.shot.audio'))` when the video emits `playing`. Muted video is inaudible, so it is exempt from autoplay blocking, and the Web Audio context is already unlocked by the menu gesture (§5). The trade-off is A/V sync drift on long clips. That is acceptable for short cutscenes.
3. Always handle `locked` by showing a "Tap to play" overlay and a **Skip** button. Also handle `error` and `unsupported` by skipping straight to the resume path.

**Decision:** option 2(b) for every Cutscene. The trigger is a Chest pickup, which is not a gesture, and input can be a keyboard or gamepad. A Chest Reveal pause comes before each clip for pacing. Keep the `locked` handler from step 3 as a safety net ([ADR 0001](../adr/0001-cutscenes-play-muted-with-separate-soundtrack.md)).

### 4.3 Pausing gameplay during a cutscene and resuming
All of the following are [source]:
- `Systems.pause()`: "A paused Scene still renders, it just doesn't run any of its update handlers or systems" ([Systems.js#L410](https://github.com/phaserjs/phaser/blob/v4.2.1/src/scene/Systems.js#L410)). The SceneManager only calls `sys.step()` for RUNNING scenes ([SceneManager.update#L558](https://github.com/phaserjs/phaser/blob/v4.2.1/src/scene/SceneManager.js#L558)).
- Arcade World (`UPDATE`), TweenManager (`UPDATE`), Clock (`PRE_UPDATE`/`UPDATE`), InputPlugin (`PRE_UPDATE`) and the UpdateList (`preUpdate`, which drives sprite animations) all hang off scene step events. They all stop when the scene is paused ([ArcadePhysics.js#L142](https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/ArcadePhysics.js#L142), [TweenManager.js#L243](https://github.com/phaserjs/phaser/blob/v4.2.1/src/tweens/TweenManager.js#L243), [Clock.js#L175](https://github.com/phaserjs/phaser/blob/v4.2.1/src/time/Clock.js#L175)).
- Timers and physics advance by **delta**, not wall time ("Use delta time to increase elapsed. Avoids needing to adjust for pause / resume"), so a resume causes no jump ([Clock.update#L368](https://github.com/phaserjs/phaser/blob/v4.2.1/src/time/Clock.js#L368), [World.update#L939](https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/World.js#L939)). If you compute spawn schedules from `this.time.now` or `Date.now()` yourself, they **will** jump. Accumulate delta instead. [inference]
- `this.physics.world.pause()` / `resume()` pauses only physics ([physics-arcade skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/physics-arcade/SKILL.md)).
- The Video's own `preUpdate`, which runs the unlock retry, only runs while its scene is running. **Do not put the Video in the paused Game scene.** Put it in a separate running `Cutscene` scene. [source for preUpdate; placement is inference]

```ts
// In ChestReveal scene, when the player confirms (pointer, key or gamepad; any works, since the video is muted):
const result = resolveChest(run);            // rules/: +1 Weapon Level on a random non-maxed weapon, or heal
if (result.kind === 'level') {
  this.scene.launch('Cutscene', { ...theme.cutscene(result.weapon), resume: 'Game' });
} else {
  this.scene.resume('Game');
}
this.scene.stop(); // ChestReveal done; Game stays paused until Cutscene finishes

// Cutscene.ts
create(data: { video: string; audio: string; resume: string }) {
  const music = this.sound.get(theme.key('music.game'));  music?.pause();
  const v = this.add.video(this.scale.width / 2, this.scale.height / 2, data.video);  // pack entry has noAudio: true
  const track = this.sound.add(data.audio);
  const done = () => { v.destroy(); track.destroy(); music?.resume(); this.scene.resume(data.resume); this.scene.stop(); };
  v.once(Phaser.GameObjects.Events.VIDEO_PLAYING, () => track.play());
  v.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, done);
  v.once(Phaser.GameObjects.Events.VIDEO_ERROR, done);
  v.once(Phaser.GameObjects.Events.VIDEO_UNSUPPORTED, done);
  v.on(Phaser.GameObjects.Events.VIDEO_LOCKED, () => this.showTapToPlay());
  v.once(Phaser.GameObjects.Events.VIDEO_METADATA, () => v.setDisplaySize(this.scale.width, this.scale.height)); // or fit/letterbox
  this.addSkipButton(done);
  v.play(false);   // muted, so no gesture is needed; the soundtrack starts on VIDEO_PLAYING
}
```
(This note applies only to *audible* video, which the Decision in §4.2 avoids. Note: `scene.launch` is queued and processed at the start of the next game step, so `create()`, and therefore `play()`, runs *after* the gesture handler returns ([ScenePlugin.launch → queueOp](https://github.com/phaserjs/phaser/blob/v4.2.1/src/scene/ScenePlugin.js), [SceneManager.update → processQueue](https://github.com/phaserjs/phaser/blob/v4.2.1/src/scene/SceneManager.js#L558)). This is fine on Chrome (sticky activation). On WebKit, if `locked` fires, create the Video in the handler itself, or use the muted + Web Audio pattern. **Open question: verify on iOS Safari.**) [source for queueing, inference for impact]

Alternative: render the cutscene as a plain DOM `<video playsinline>` positioned above the canvas instead of a Phaser `Video`. This avoids the per-frame WebGL texture upload that Phaser maintainers cite as the cause of lag on older iOS and Android WebView. The maintainer recommended a DOM-based approach for those devices ([#6726](https://github.com/phaserjs/phaser/issues/6726), [#7075](https://github.com/phaserjs/phaser/issues/7075)). [source for the issues; the choice is a trade-off]

### 4.4 Codecs, containers, encoding
All of the following are [source]:
- MDN recommends **WebM (AV1 + Opus)** first, with **MP4 (AVC/H.264 + AAC)** as the fallback. MP4 with H.264 and AAC is supported "by every major browser" ([MDN video codecs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)). Firefox's AVC support "is dependent upon the operating system's built-in or preinstalled codecs". AVC and HEVC carry patent/licensing obligations. AV1 in Safari needs a hardware decoder (M3 Macs, iPhone 15 Pro, iPhone 16 and later). VP9 is supported broadly, but "Safari does not support alpha transparency" ([same page](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs), [MDN containers](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)).
- Phaser advises against relying on HEVC alpha ([Video.js#L49-L56](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L49-L56)). A Firefox + MP4 failure report was closed out with the advice to also ship WebM ([#6917](https://github.com/phaserjs/phaser/issues/6917), open).
- MP4 `moov` placement: the "moov" atom is written at the end by default, and "it can be moved to the start for better playback by adding +faststart to the -movflags" ([FFmpeg formats: mov/mp4](https://ffmpeg.org/ffmpeg-formats.html#mov_002c-mp4_002c-ismv)).
- Apple: servers hosting media "must support byte-range requests" (archived doc, last updated 2016) ([Apple: Creating Video for Safari on iPhone](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/CreatingVideoforSafarioniPhone/CreatingVideoforSafarioniPhone.html)).

Recommendation [inference]:
- Baseline: **MP4, H.264 (High or Main profile), AAC-LC stereo, `-movflags +faststart`**, 1280×720, 24 or 30 fps, served same-origin with `Accept-Ranges: bytes`.
- Optional: a **VP9/Opus WebM** listed first as `{ url, type: 'vp9' }`, for Firefox on systems without OS H.264 decoders. Adding AV1 WebM is only worthwhile once you have measured a need for it, because Phaser has no AV1 probe flag. You would have to set `type` to one that is true (for example `webm`) and accept the risk of mis-detection.
- Do not rely on alpha video.

### 4.5 File size and preload strategy
All of the following are [source]:
- `load.video` does not fetch. `preload="auto"` is set on the element, and the WHATWG `preload` attribute is only a hint ("Hints how much buffering the media resource will likely need") ([HTML media](https://html.spec.whatwg.org/multipage/media.html#attr-media-preload)).
- Apple's archived iOS doc says "preload and autoplay are disabled. No data is loaded until the user initiates it" ([Apple archive, 2012](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html)). Its autoplay statement is superseded by the 2016 WebKit policy. Whether current iOS honours `preload` is an **open question**.
- `getVideoURL` accepts `blob:` URLs ([device/Video.js#L108-L125](https://github.com/phaserjs/phaser/blob/v4.2.1/src/device/Video.js#L108-L125)).

Strategy [inference]:
- Default to **streaming**: progressive MP4 with faststart and byte ranges. Create the Video only when it is needed, and destroy it afterwards.
- For a guaranteed instant start, **prefetch the next likely cutscene** into memory during calm gameplay (`fetch(url) → blob → URL.createObjectURL`), then `video.loadURL(blobUrl, noAudio)`. Revoke the object URL afterwards. This costs RAM equal to the file size, so budget it (for example, keep at most 1 or 2 clips of ≤ 5–8 MB each in memory). Verify blob playback on iOS Safari.
- Keep clips short (≤ 10–15 s) and moderate in resolution. Every frame is uploaded to a GPU texture, and performance problems on older devices scale with resolution ([#6726](https://github.com/phaserjs/phaser/issues/6726)).
- Register cutscene URLs in each theme's pack (type `video`). This costs nothing, because no download happens, and it gives you format selection and a cache key per theme.

### 4.6 Mobile and iOS specifics
- Phaser already sets `playsinline`, so iPhone does not force fullscreen [source] ([loadHandler](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L757), [WHATWG playsinline](https://html.spec.whatwg.org/multipage/media.html#attr-video-playsinline), [WebKit iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/)).
- iOS: un-muting a muted autoplaying video without a gesture pauses it [source] ([WebKit iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/)). Do not start muted and later call `setMute(false)` outside a gesture.
- Cross-origin video in WebGL throws `SecurityError: ... texImage2D ... cross-origin data` ([#7026](https://github.com/phaserjs/phaser/issues/7026), open). `VideoFile` never propagates `LoaderPlugin.crossOrigin`: `File#crossOrigin` stays `undefined` for videos and is passed straight into the cache entry ([VideoFile.js#L83-L91](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/VideoFile.js#L83-L91), [File.js#L191-L199](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/File.js#L191-L199)). Serve videos **same-origin**, or use `loadURL(url, noAudio, 'anonymous')` with CORS headers. [source] The docs.phaser.io Video page says the same ([concept page](https://docs.phaser.io/phaser/concepts/gameobjects/video)).
- Touch input stopping after video playback on mobile, a pre-`playsinline` issue from 2019, was worked around with `input: { windowEvents: false }` ([#4846](https://github.com/phaserjs/phaser/issues/4846), [#7214](https://github.com/phaserjs/phaser/issues/7214)). Re-test on current iOS. [source]

---

## 5. Audio per theme

All of the following are [source] ([audio-and-sound skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/audio-and-sound/SKILL.md), [WebAudioSoundManager.js](https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/webaudio/WebAudioSoundManager.js), [BaseSoundManager.js](https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/BaseSoundManager.js)):
- There is **one global Sound Manager** per game. Web Audio is preferred, with HTML5 Audio as the fallback. Sounds are not cleaned up on scene shutdown, and looping music continues across scenes unless you stop it.
- Unlocking: the Web Audio manager starts `locked` if `context.state === 'suspended'` ([#L89](https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/webaudio/WebAudioSoundManager.js#L89)). It then listens on `document.body` for `touchstart`, `touchend`, `mousedown`, `mouseup` and `keydown`, and calls `context.resume()` ([unlock#L348](https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/webaudio/WebAudioSoundManager.js#L348)). The next update emits **`unlocked`** ([BaseSoundManager.js#L663-L676](https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/BaseSoundManager.js#L663-L676)). No manual unlock is required. Gate music on `this.sound.locked` or `once('unlocked')`. Chrome documents the same resume-after-gesture requirement ([Chrome autoplay](https://developer.chrome.com/blog/autoplay)).
- Visibility: the manager suspends and resumes the context on game `VISIBLE`/`HIDDEN`, which handles iOS interruptions. `pauseOnBlur` defaults to `true` ([WebAudioSoundManager.js#L105](https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/webaudio/WebAudioSoundManager.js#L105), [BaseSoundManager.js#L103](https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/BaseSoundManager.js#L103)).
- Audio sprites: `load.audioSprite(key, jsonURL, audioURL[])`, then `sound.playAudioSprite(key, name)` or `addAudioSprite`. JSON `spritemap` entries become markers.
- Cleanup: `sound.remove(sound)`, `removeByKey(key)` and `removeAll()` destroy instances ([#L377-L431](https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/BaseSoundManager.js#L377-L431)). Decoded data lives in `cache.audio`, so remove that too.
- Formats: pass multiple URLs, and the first supported one is used. MDN lists MP3 as supported by all major browsers, AAC as supported via MP4 (Firefox through platform decoders), and Vorbis as "Safari: No" ([MDN audio codecs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs)).

Per-theme pattern [inference]:
- Each theme section provides the same logical sounds under its prefix: `<id>.sfx` (one audio sprite containing `hit`, `pickup`, `levelup`, `shot_fire`, and so on, with **identical marker names in every theme**), `<id>.music.game`, `<id>.music.menu`, and one `<id>.cut.<weapon>.audio` soundtrack per weapon. The soundtracks are required, because Cutscenes play muted ([ADR 0001](../adr/0001-cutscenes-play-muted-with-separate-soundtrack.md)).
- Game code calls `this.sound.playAudioSprite(theme.key('sfx'), 'hit')`. Use `['*.ogg', '*.m4a']`, or MP3 only, as the URL list.
- Throttle SFX for hundreds of hits, for example with at most N concurrent `hit` instances or a per-frame cooldown. [inference]

---

## 6. Save data and progression persistence

All of the following are [source]:
- `localStorage` stores **UTF-16 strings** and is per-origin (and per protocol). It is synchronous. It is cleared when the last private tab closes. It throws `SecurityError` for invalid origins or blocked storage, and `file:` behaviour is undefined ([MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)).
- Web Storage allows **5 MiB for localStorage** (10 MiB total with sessionStorage) and throws `QuotaExceededError` when exceeded. Safari, with tracking prevention, deletes script-created data after **7 days of browser use without user interaction** with the origin ([MDN quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).
- Phaser has **no built-in save system**. It only feature-detects `device.features.localStorage` ([Features.js#L26](https://github.com/phaserjs/phaser/blob/v4.2.1/src/device/Features.js#L26)). The registry (a DataManager) is in-memory only.

Design [inference]:
- Store ids, not file names. **Decision:** v1 has no meta-progression (no currency, no permanent upgrades, no unlocks). The save holds the best result per theme and Character, plus the Cutscenes seen per theme, keyed by weapon id (`shot`). The last theme and Character are a separate `prefs` record. The schema is versioned, so meta-progression can be added later with a migration.
- Use one key per record with a schema version and migrations:

```ts
const KEY = 'tbh.save';           // single JSON blob
interface RunBest { won: boolean; survivedMs: number; kills: number }
interface SaveV1 { v: 1;
                   best: Record<string, RunBest>;          // key `${themeId}/${characterId}`
                   perTheme: Record<string, { seen: string[] }> }   // weapon ids whose Cutscene was seen
interface Prefs  { v: 1; theme: string; character: string; musicVol: number; sfxVol: number; subtitles: boolean }

export function loadSave(): SaveV1 {
  try { const raw = localStorage.getItem(KEY); return raw ? migrate(JSON.parse(raw)) : fresh(); }
  catch { return fresh(); }                    // SecurityError, corrupt JSON
}
export function writeSave(s: SaveV1) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); }
  catch (e) { /* QuotaExceededError / SecurityError: keep in memory, warn */ }
}
```
- Write at safe points: Run end, after a Cutscene, and when the menu changes. Do not write every frame.
- Mirror the save in `this.registry` during play.
- Offer **Export/Import** of the JSON string as a manual backup, as mitigation against Safari's 7-day eviction and private mode.

---

## 7. Pitfalls and open questions

Pitfalls, each verified in the source or in issues:
1. **`load.video` does not preload bytes.** The progress bar will show 100% while cutscenes are still unfetched ([VideoFile.js#L94-L113](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/VideoFile.js#L94-L113)).
2. **The WebM probe tests VP8+Vorbis**, not your codec. Use a `{ type: 'vp9' }` URL config for VP9 files ([device/Video.js#L82-L90](https://github.com/phaserjs/phaser/blob/v4.2.1/src/device/Video.js#L82-L90)).
3. **Cross-origin video fails in WebGL** (`SecurityError` in `texImage2D`), and `load.video` never sets `crossOrigin` ([#7026](https://github.com/phaserjs/phaser/issues/7026), [VideoFile.js#L83](https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/VideoFile.js#L83)). This matters if assets go on a separate CDN host.
4. **WebGL video frame upload is slow** on older iOS and in Android WebView. Canvas mode or a DOM video was reported as smooth ([#6726](https://github.com/phaserjs/phaser/issues/6726) closed, [#7075](https://github.com/phaserjs/phaser/issues/7075) open).
5. **Firefox and MP4**: some devices fail. The community advice is to also ship WebM ([#6917](https://github.com/phaserjs/phaser/issues/6917), open). This is consistent with MDN's note that Firefox H.264 depends on OS codecs.
6. Tab switching before `play()` used to cause audio without video. The maintainers say this is fixed via `getFirstFrame` ([#6695](https://github.com/phaserjs/phaser/issues/6695)). `VIDEO_COMPLETE` not firing was fixed by the 3.60 rewrite ([#6192](https://github.com/phaserjs/phaser/issues/6192)).
7. HEVC or MOV alpha is unreliable across devices, and detection is not dependable ([#6931](https://github.com/phaserjs/phaser/issues/6931), [Video.js#L49-L56](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js#L49-L56)).
8. **`killAndHide` leaves the physics body enabled.** Use `disableBody(true, true)` for Arcade pool members ([Group.js#L1682](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/group/Group.js#L1682), [Enable.js#L106](https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/components/Enable.js#L106)).
9. **`textures.remove` while sprites still reference the texture** makes them throw on the next render ([TextureManager.js#L282-L299](https://github.com/phaserjs/phaser/blob/v4.2.1/src/textures/TextureManager.js#L282-L299)). Stop the scenes first.
10. **Duplicate loader keys are silently skipped.** You must remove the old entry before reloading ([loading-assets skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/loading-assets/SKILL.md)).
11. **Mobile uses 1 texture per batch by default** (`autoMobileTextures: true`). Mixed atlases in draw order therefore multiply draw calls ([Config.js#L350-L352](https://github.com/phaserjs/phaser/blob/v4.2.1/src/core/Config.js#L350-L352)).
12. **Keyboard events are queued, and gamepad is not an activation-triggering input.** Neither is a reliable trigger for audible `play()` on strict browsers ([KeyboardManager.js#L186](https://github.com/phaserjs/phaser/blob/v4.2.1/src/input/keyboard/KeyboardManager.js#L186), [HTML spec](https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event)).
13. **The docs site lags the release** (v4.1.0 vs v4.2.1), and the template pins `phaser@4.0.0` with "Phaser 3" in its package description (§1).

Open questions (need device testing, no authoritative answer found):
- Does current iOS Safari honour `preload="auto"` for a Phaser-created `<video>` before any gesture, and do `blob:` URLs play reliably there?
- Does `play()` from a scene launched on the *next frame* after a tap (`scene.launch` is queued) count as gesture-initiated on iOS and macOS Safari, or must the Video be created and played inside the handler?
- What resolution and bitrate gives acceptable WebGL video upload cost on the lowest target phone? This needs benchmarking against [#6726](https://github.com/phaserjs/phaser/issues/6726) and [#7075](https://github.com/phaserjs/phaser/issues/7075).
- AV1 WebM: Phaser has no `av1` flag in `Device.Video`. Is it worth adding a custom `canPlayType('video/webm; codecs="av01..."')` check before calling `loadURL`?
- Licensing: MDN notes that commercial use of AVC media may require a licence ([MDN video codecs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)). Confirm this for the distribution model.

---

## Proposed architecture sketch

### Folder layout
```
ThemedBulletHeavenGame/
├─ index.html
├─ vite/ config.dev.mjs, config.prod.mjs          # from template-vite-ts
├─ public/
│  └─ assets/
│     ├─ common/ ui.png, ui.json, fonts/…          # theme-independent UI atlas
│     └─ themes/
│        ├─ index.json                              # list of ThemeManifest entries
│        ├─ packs.json                              # Asset Pack, one section per theme
│        ├─ debug/   (same file names; programmer art, ffmpeg title-card clips; dev builds only)
│        ├─ plague/  sprites.png|json, ground.png, sfx.json|ogg|m4a, music-*.ogg|m4a,
│        │           cut/<weapon>.mp4|webm + cut/<weapon>.ogg|m4a
│        ├─ western/ (same file names)
│        ├─ pirate/  (same file names)
│        ├─ zombie/  (same file names)
│        └─ kabuki/  (same file names)
├─ src/
│  ├─ main.ts
│  └─ game/
│     ├─ main.ts                                    # Phaser.Game config (AUTO, arcade, scenes)
│     ├─ rules/       archetypes.ts, characters.ts, passives.ts, weapons.ts, levelUp.ts,
│     │               chest.ts, damage.ts, waveScript.ts, boss.ts, saveMigrations.ts
│     │               # no Phaser or theme/ imports; *.test.ts beside each (Vitest), ADR 0002
│     ├─ theme/       ThemeManifest.ts, ThemeContext.ts, loadTheme.ts, unloadTheme.ts
│     ├─ systems/     Spawner.ts, WeaponSystem.ts, CollisionSystem.ts, XpSystem.ts, SpatialHash.ts
│     ├─ entities/    Enemy.ts, Projectile.ts, Pickup.ts                         # pooled classes
│     ├─ save/        SaveStore.ts, Prefs.ts                                     # localStorage I/O only
│     └─ scenes/      Boot.ts, Preloader.ts, MainMenu.ts, Game.ts, HUD.ts,
│                     LevelUp.ts, ChestReveal.ts, Cutscene.ts, GameOver.ts
└─ docs/research/phaser-multi-theme-bullet-heaven.md
```

### Theme manifest (`public/assets/themes/index.json`, one entry shown)
```json
{
  "version": 1,
  "themes": [
    {
      "id": "plague",
      "packUrl": "assets/themes/packs.json",
      "packSection": "plague",
      "anims": {
        "player.walk":   { "frames": "player/walk_",   "end": 7, "frameRate": 12, "repeat": -1 },
        "swarmer.walk":  { "frames": "swarmer/walk_",  "end": 5, "frameRate": 14, "repeat": -1 },
        "splitter.walk": { "frames": "splitter/walk_", "end": 3, "frameRate": 10, "repeat": -1 },
        "tank.walk":     { "frames": "tank/walk_",     "end": 5, "frameRate": 8,  "repeat": -1 },
        "shot.proj":     { "frames": "shot/proj_",     "end": 3, "frameRate": 20, "repeat": -1 }
      },
      "characters": [
        { "character": "aura-start", "name": "Plague Doctor" },
        { "character": "sweep-start", "name": "Village Blacksmith" }
      ]
    }
  ]
}
```

### Asset Pack (`public/assets/themes/packs.json`, one section shown)
```json
{
  "plague": {
    "prefix": "plague.",
    "path": "assets/themes/plague/",
    "files": [
      { "type": "atlas", "key": "sprites", "textureURL": "sprites.png", "atlasURL": "sprites.json" },
      { "type": "audioSprite", "key": "sfx", "jsonURL": "sfx.json", "audioURL": ["sfx.ogg", "sfx.m4a"] },
      { "type": "image", "key": "ground", "url": "ground.png" },
      { "type": "audio", "key": "music.game", "url": ["music-game.ogg", "music-game.m4a"] },
      { "type": "video", "key": "cut.shot", "noAudio": true,
        "url": [ { "url": "cut/shot.webm", "type": "vp9" }, { "url": "cut/shot.mp4", "type": "mp4" } ] },
      { "type": "audio", "key": "cut.shot.audio", "url": ["cut/shot.ogg", "cut/shot.m4a"] }
    ]
  }
}
```
There is one `cut.<weapon>` video and one `cut.<weapon>.audio` entry for each of the 7 weapons. This yields the keys `plague.sprites`, `plague.sfx`, `plague.music.game`, `plague.cut.shot`, `plague.cut.shot.audio`, and so on. Other themes use identical logical keys under their own prefix. Video entries only register URLs (no download), per §4.1.

### Game config essentials
```ts
new Phaser.Game({
  type: Phaser.AUTO,                                  // WebGL, Canvas fallback (deprecated)
  parent: 'game-container', width: 1280, height: 720,
  pixelArt: true,                                     // LPC art at 1:1; camera zoom tuned in one place
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  render: { /* autoMobileTextures: true (default), batchSize: 16384 (default) */ },
  scene: [Boot, Preloader, MainMenu, Game, HUD, LevelUp, ChestReveal, Cutscene, GameOver],
});
```

---

## Sources

Phaser (primary, tag v4.2.1 unless noted)
- Releases: https://github.com/phaserjs/phaser/releases · v4.2.1: https://github.com/phaserjs/phaser/releases/tag/v4.2.1 · v3.90.0: https://github.com/phaserjs/phaser/releases/tag/v3.90.0
- README / create-game: https://github.com/phaserjs/phaser/blob/v4.2.1/README.md · https://phaser.io/tutorials/create-game-app
- package.json: https://github.com/phaserjs/phaser/blob/v4.2.1/package.json
- API docs (v4.1.0 at time of writing): https://docs.phaser.io/api-documentation/class/gameobjects-video · Video concept: https://docs.phaser.io/phaser/concepts/gameobjects/video
- Migration guide: https://github.com/phaserjs/phaser/blob/v4.2.1/skills/v3-to-v4-migration/SKILL.md
- Skills: loading-assets https://github.com/phaserjs/phaser/blob/v4.2.1/skills/loading-assets/SKILL.md · groups-and-containers https://github.com/phaserjs/phaser/blob/v4.2.1/skills/groups-and-containers/SKILL.md · physics-arcade https://github.com/phaserjs/phaser/blob/v4.2.1/skills/physics-arcade/SKILL.md · audio-and-sound https://github.com/phaserjs/phaser/blob/v4.2.1/skills/audio-and-sound/SKILL.md · scenes https://github.com/phaserjs/phaser/blob/v4.2.1/skills/scenes/SKILL.md
- Rendering Concepts: https://github.com/phaserjs/phaser/blob/v4.2.1/docs/Phaser%204%20Rendering%20Concepts/Phaser%204%20Rendering%20Concepts.md
- Source: Video.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/video/Video.js · VideoFile.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/VideoFile.js · device/Video.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/device/Video.js · PackFile.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/filetypes/PackFile.js · LoaderPlugin.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/LoaderPlugin.js · File.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/loader/File.js · TextureManager.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/textures/TextureManager.js · AnimationManager.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/animations/AnimationManager.js · BaseCache.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/cache/BaseCache.js · Group.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/group/Group.js · UpdateList.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/UpdateList.js · Arcade World.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/World.js · Enable.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/components/Enable.js · SpriteGPULayer.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/spritegpulayer/SpriteGPULayer.js · Config.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/core/Config.js · Game.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/core/Game.js · Systems.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/scene/Systems.js · SceneManager.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/scene/SceneManager.js · Clock.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/time/Clock.js · WebAudioSoundManager.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/webaudio/WebAudioSoundManager.js · BaseSoundManager.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/sound/BaseSoundManager.js · MouseManager.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/input/mouse/MouseManager.js · KeyboardManager.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/input/keyboard/KeyboardManager.js · Features.js https://github.com/phaserjs/phaser/blob/v4.2.1/src/device/Features.js
- Issues: #7214 https://github.com/phaserjs/phaser/issues/7214 · #7075 https://github.com/phaserjs/phaser/issues/7075 · #7026 https://github.com/phaserjs/phaser/issues/7026 · #6931 https://github.com/phaserjs/phaser/issues/6931 · #6917 https://github.com/phaserjs/phaser/issues/6917 · #6726 https://github.com/phaserjs/phaser/issues/6726 · #6695 https://github.com/phaserjs/phaser/issues/6695 · #6192 https://github.com/phaserjs/phaser/issues/6192 · #4846 https://github.com/phaserjs/phaser/issues/4846
- Template: https://github.com/phaserjs/template-vite-ts (package.json, README, vite/config.prod.mjs)
- Examples: https://github.com/phaserjs/examples (pools, physics/arcade, game objects/video)

Web platform (primary)
- WHATWG HTML media elements: https://html.spec.whatwg.org/multipage/media.html
- WHATWG HTML user activation: https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event
- MDN Autoplay guide: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- MDN Video codecs: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs
- MDN Media containers: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers
- MDN Audio codecs: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs
- MDN requestVideoFrameCallback: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
- MDN localStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- MDN Storage quotas and eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Chrome autoplay policy: https://developer.chrome.com/blog/autoplay
- WebKit iOS video policies: https://webkit.org/blog/6784/new-video-policies-for-ios/
- WebKit macOS autoplay policy: https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/
- Apple archived docs (dated, used with caution): https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/CreatingVideoforSafarioniPhone/CreatingVideoforSafarioniPhone.html · https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html
- FFmpeg formats (mov/mp4 faststart; primary for the tool): https://ffmpeg.org/ffmpeg-formats.html#mov_002c-mp4_002c-ismv

Not reachable at time of research: newdocs.phaser.io (DNS failure) and the Mozilla SUMO autoplay page (did not render). No secondary sources were needed.
