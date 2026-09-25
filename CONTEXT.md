# Themed Bullet Heaven

One bullet-heaven game whose mechanics are fixed and shared, presented through interchangeable Themes that change only how it looks and sounds.

## Language

### Themes and skins

**Theme**:
A complete presentation of the game (art, names, audio, cutscenes, tileset, music) chosen by the player at the start of each Run.
_Avoid_: Stage, world, level, map

**Skin**:
A Theme's rendition of one Archetype or other slot: its sprite, name, sounds and effects. A Theme is complete only when every slot has a Skin.
_Avoid_: Variant, reskin, asset set

**Archetype**:
A theme-agnostic mechanical slot (a Weapon, Enemy or Pickup kind) whose behaviour and numbers are identical in every Theme.
_Avoid_: Role, type, class

**Tileset**:
The Skin slot for the ground: one seamless ground texture and a few decoration sprites scattered over the endless field. Decorations never block movement.
_Avoid_: Map, level, background

**Debug Theme**:
A complete Theme made of programmer art and placeholder Cutscenes. It exists to prove that every slot can be skinned and that switching Themes works.
_Avoid_: Test theme, default theme

### Player

**Character**:
A theme-agnostic pairing of one starting Weapon and one passive stat bonus. Each Theme offers exactly two Characters and gives each a Skin.
_Avoid_: Hero, player class

**Passive**:
A stat bonus taken from one shared list, such as move speed or pickup radius. In v1 a Passive comes only from a Character and never from a Level-up card.
_Avoid_: Perk, trait, buff

**Run**:
One timed play session in one Theme with one Character, which is won by killing the Boss at the end of the timer and lost by dying.
_Avoid_: Game, match, stage

**Wave Script**:
The single shared schedule that decides when each enemy Archetype spawns during a Run, including Elites and the Boss. It is the same in every Theme.
_Avoid_: Level design, spawn table

### Enemies

**Fragment**:
The smaller enemy a Splitter releases on death. It is a sub-Archetype of the Splitter, with its own Skin slot, and is not a copy of its parent.
_Avoid_: Child, copy, splitling

**Elite**:
A modifier applied to any non-Boss enemy that gives it more HP, a larger scale and a visual marker, and guarantees a Chest drop. It has no Skin of its own.
_Avoid_: Champion, miniboss

**Boss**:
The Enemy Archetype that appears at the end of a Run's timer. Its attack pattern is the same in every Theme, and killing it wins the Run.

**Telegraph**:
The ground marker that shows where and when a Boss attack will land, shortly before it hits.
_Avoid_: Warning, indicator

### Progression within a Run

**Level-up**:
The moment the XP bar fills, when the player picks one of three cards. Each card is either a new Weapon or +1 Weapon Level on an owned Weapon.
_Avoid_: Upgrade

**Weapon Level**:
How far one owned Weapon has been improved during the current Run.
_Avoid_: Upgrade, rank, tier

**Chest**:
A Pickup that grants +1 Weapon Level to a random owned Weapon that isn't at max level, and plays that Weapon's Cutscene. If every owned Weapon is maxed, it heals instead.
_Avoid_: Treasure, loot box

**Chest Reveal**:
The paused moment after picking up a Chest, which ends when the player confirms and the Cutscene starts.

**Cutscene**:
A short, skippable video clip, one per Weapon per Theme, played when a Chest raises that Weapon's level. Its soundtrack is a separate sound, not the video's own audio.
_Avoid_: Movie, cinematic, FMV
