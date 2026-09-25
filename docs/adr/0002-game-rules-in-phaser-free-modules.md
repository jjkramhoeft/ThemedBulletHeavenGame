# Game rules live in Phaser-free TypeScript modules

The game rules live in plain TypeScript modules under `src/game/rules/`, which never import Phaser or anything from `theme/`, and are unit-tested with Vitest. They cover Level-up card offers, Weapon stats per Weapon Level, damage, Chest resolution, the Wave Script schedule and save migrations. Phaser scenes and Arcade Physics still handle movement, overlap and rendering, and they call into these modules for decisions. The split does two jobs. It makes the rule "Themes never change mechanics" enforceable by the import graph, because rule code cannot see a Theme. It also makes balance logic testable without a browser.

## Considered Options

- **Everything in Phaser scenes, tested by hand.** This is quicker to start, but nothing would stop Theme data from leaking into mechanics, and every balance change would need a manual playthrough to check.
