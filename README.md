# ThemedBulletHeavenGame

A bullet-heaven game built with Phaser 4. Every Theme plays the same game and only changes what it looks and sounds like. Start with [CONTEXT.md](CONTEXT.md) for the vocabulary, [docs/design/game-rules.md](docs/design/game-rules.md) for the rules and [docs/design/themes.md](docs/design/themes.md) for the Themes.

## Running

```bash
npm install
npm run dev          # http://localhost:8080
npm test             # rules/ unit tests and a completeness check for every Theme
npm run build        # typecheck + production build into dist/
```

The Debug Theme only appears in dev builds. To include it in a production build, set `VITE_DEBUG_THEME=true`.

## Dev shortcuts (dev builds only)

| Key | Effect |
|---|---|
| X | Gain one level of XP |
| C | Drop a Chest next to the player |
| B | Skip to 5 s before the Boss |
| K | Hit the Boss for 30 % of its HP |

The running game is also available as `window.game` in the browser console.

## Theme assets

See [docs/assets.md](docs/assets.md) for where each kind of asset comes from and the size rules for replacing placeholders.


`npm run assets:<id>` rebuilds one Theme: `plague` (Plague Village), `buccaneer` (Buccaneer Bay), `kabukicho` (Kabukicho), `gulch` (Dead Man's Gulch) or `suburban` (Suburban Outbreak). Their characters are assembled from the [Universal LPC Spritesheet Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) at a pinned commit. On first use the script clones the generator (blobless and sparse) into `.cache/ulpc` and then fetches only the sprite folders the recipes use; set `ULPC_DIR` to use a different checkout. The script also writes `CREDITS.csv` next to the Theme. That file lists every LPC author and licence the art depends on, and it must ship with the game. The Theme's `theme.json` points to it (`credits`), and the in-game Credits screen (C / gamepad Y in the menu) shows its authors, licences and source links. The effects, pickups, tileset and audio are drawn and synthesised by the script as placeholders.

### Debug Theme

`npm run assets:debug` regenerates the Debug Theme's programmer art, SFX, music and Cutscene soundtracks in `public/assets/themes/debug/`. Both generators also write placeholder Cutscene clips (`cut/*.mp4`) when `ffmpeg` is on `PATH`. Without ffmpeg, a Cutscene falls back to showing its caption over the soundtrack, but the completeness test fails for Themes that aren't dev-only, because they must ship their clips.

## Adding a Theme

1. Create `public/assets/themes/<id>/` containing `theme.json`, `pack.json` (one section named `<id>` with prefix `<id>.`) and the files the pack lists.
2. Add `<id>` to `public/assets/themes/index.json`.
3. If the Theme uses third-party art, set `credits` in `theme.json` to its CREDITS.csv. The test requires it for every Theme that isn't dev-only.
4. Run `npm test`. The completeness test lists every missing frame, SFX marker, pack key and file.
