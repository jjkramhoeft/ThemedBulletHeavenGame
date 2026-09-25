# Getting assets for a Theme

A Theme is a folder of files under `public/assets/themes/<id>/` that fills every slot in [themes.md](design/themes.md#1-slots). The exact frame names, SFX markers and pack keys are defined in [`src/game/theme/slots.ts`](../src/game/theme/slots.ts). Run `npm test` at any point: the completeness test lists every frame, marker, pack key, file and credit that is still missing.

Every Theme except the Debug Theme is built by a script, like [`scripts/make-plague-theme.mjs`](../scripts/make-plague-theme.mjs). Start a new Theme by copying that script, then replace pieces with real assets as you get them.

## 1. Characters (players and enemies): LPC

All characters come from the [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator). This is the Theme selection rule in themes.md.

1. **Design it in the web generator.** Open the [live generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/), build the character, and note each item and colour.
2. **Turn it into a recipe.** In the build script, each actor is a list of layers such as `{ item: 'torso_clothes_longsleeve', color: 'black' }`:
   - `item` is a file name from `sheet_definitions/` in the generator repo, without `.json`.
   - `color` is either one of the item's `variants` or a palette colour for its material, listed in `palette_definitions/<material>/<material>_ulpc.json`.
   - Heads need `material: 'body'` so they match the body colour. The script's `skin()` helper does this.
3. **Build.** `npm run assets:<id>`. The first run clones the generator (pinned in [`scripts/lib/lpc.mjs`](../scripts/lib/lpc.mjs)) into `.cache/ulpc`, then fetches only the sprite folders your recipes use. Each composed sheet is also written to `.cache/<id>-<actor>.png` so you can check it.
4. **Fill the gaps.** LPC has no firearms, no fat or oversized body, and no crawl animation. [themes.md §3](design/themes.md#3-lpc-notes) lists the gaps for each Theme. Draw missing parts as an overlay in the script (see `addBeaks`), or combine existing sprites (see `procession`).

What the game expects:
- **Walk animation only:** frames are 64×64, in 4 rows ordered up, left, down, right. Frame 0 is the standing pose, so set `"walk": { "frames": 9, "frameRate": 10, "loopFrom": 1 }` in `theme.json`.
- **Frame width can vary:** frames may be wider than 64 px (the Procession is 96 px wide). Hit-box sizes come from `rules/` and don't depend on the art.
- **Size changes go in `actorScale`,** e.g. `{ "boss": 2, "tank": 1.5 }`. Stick to integer or half-step scales, or the pixel art shimmers.

## 2. Effects, icons, pickups, decorations

These are custom art in every Theme. The build scripts draw placeholders. To use real art, draw the file in any pixel editor, load it in the script, and push it into `frames` under the slot's frame name. The atlas packer does the rest, and all gameplay art must fit in one atlas of 2048×2048 or less.

Keep these sizes and orientations, because the game scales and rotates the art on the assumption that they hold:

| Frame | Size | Rule |
|---|---|---|
| `sweep/arc`, `aura/field`, `pulse/ring`, `boss/telegraph_ring` | 128×128 | Centred; the effect's edge sits at radius **62 px** (scaled to the weapon's area) |
| `sweep/arc`, `shot/proj`, `ranged/proj`, `boss/proj`, `boss/charge` | any | Drawn **pointing right**; the game rotates them |
| `chain/bolt` | 64×8 | Stretched from its left edge to the target |
| `boss/telegraph_line` | **64×16** exactly | Stretched to the charge length and body width |
| `<weapon>/icon` | 32×32 | Shown on Level-up cards, the HUD, and the Cutscene title card |
| `pickup/*`, `orbit/blade`, `lure/bait` | about 12–28 px | Centred |
| `deco/0`…`deco/N-1` | about 32 px | `N` = `decorations` in `theme.json`; never blocks movement |

**Ground** (`ground.png`) must tile seamlessly. Use 512 px or larger so the repeat isn't obvious.

**Good sources:**
- LPC-compatible tilesets and props on [OpenGameArt](https://opengameart.org/art-search-advanced?keys=LPC).
- CC0 packs.

## 3. Audio

| Key | What |
|---|---|
| `sfx` | One audio sprite (`sfx.json` + audio). It must contain every marker in `SFX_MARKERS`: `hit`, `pickup`, `levelUp`, `chest`, `playerHurt`, `bossTelegraph`, `win`, `lose` and `fire_<weapon>` for all 7 weapons. |
| `music.menu`, `music.game` | Looping tracks |
| `cut.<weapon>.audio` | A soundtrack per Cutscene, as long as its clip |

The scripts synthesise placeholder WAVs. For release, ship `.ogg` plus `.m4a` (list both URLs in `pack.json`; the loader picks the first one the browser supports).

**Where to get audio:**
- [OpenGameArt](https://opengameart.org) and [Freesound](https://freesound.org). Filter by CC0 or CC-BY.

## 4. Cutscenes

There is one clip per weapon: `cut/<weapon>.mp4`. Each clip must be:
- **Encoding:** 1280×720, H.264 Main, `yuv420p`, at most 8 s.
- **Streamable:** encoded with `+faststart`.
- **Silent:** no audio track. The soundtrack is the separate `cut.<weapon>.audio` file ([ADR 0001](adr/0001-cutscenes-play-muted-with-separate-soundtrack.md)).

To convert a finished clip:

```bash
ffmpeg -i in.mov -t 8 -vf scale=1280:720 -r 30 -c:v libx264 -profile:v main -pix_fmt yuv420p -movflags +faststart -an cut/shot.mp4
ffmpeg -i in.mov -vn -c:a libvorbis cut/shot.ogg
```

If `ffmpeg` is on `PATH`, the build scripts write placeholder title-card clips (the weapon icon on a background).

## 5. Licences and credits

- **Web build:** CC-BY-SA and GPL LPC art is fine, as long as it's credited. A DRM store release (Steam, iOS) needs CC0 or OGA-BY only.
- **Check licences per file,** in `.cache/ulpc/CREDITS.csv`. The generator's licence filter passes an item if *any* of its files matches.
- **Credits file:** the LPC build writes `CREDITS.csv` (filename, notes, authors, licences, urls) and refuses to ship a file it can't credit. `theme.json` points to it (`"credits"`), and the Credits screen shows it. The test requires credits for every Theme that isn't dev-only.
- **Non-LPC assets need rows too.** Add a row for every other third-party file (tileset, SFX, music) in the same format. The Credits screen currently lists every row under "Character art", so update its wording in `src/game/scenes/Credits.ts` when you add non-LPC rows.
