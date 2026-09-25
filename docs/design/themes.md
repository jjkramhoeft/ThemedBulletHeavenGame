# Themes

All themes share **one** game: the same weapons, enemies, pickups, balance numbers and player progression.
A theme is a *skin*. It supplies art, names, audio and cutscenes for every archetype slot below, and nothing else.

> Rule: a theme may never add, remove or change a mechanic. If a theme idea needs a new behaviour, that behaviour is added as a new archetype and **every** theme must then provide a skin for it.

## 1. Archetypes

### 1.1 Weapons (7)

| Key | Archetype | Behaviour | Upgrade axis (examples) |
|---|---|---|---|
| `sweep` | Sweep | Melee arc in the facing direction | Arc width, damage, second arc behind |
| `shot` | Shot | Projectile auto-aimed at the nearest enemy | Count, pierce, fire rate |
| `orbit` | Orbit | Blades circling the player | Count, radius, rotation speed |
| `aura` | Aura | Constant damage in a radius around the player | Radius, tick damage, slow effect |
| `chain` | Chain | Hits one target, then jumps to nearby enemies | Jump count, jump range |
| `pulse` | Pulse | Periodic radial shockwave with knockback | Radius, knockback, cooldown |
| `lure` | Lure | Thrown object; enemies gather at that spot for a few seconds | Duration, pull radius, damage at the end |

### 1.2 Enemies (5)

| Key | Archetype | Behaviour |
|---|---|---|
| `swarmer` | Swarmer | Fast, weak, spawns in large numbers |
| `splitter` | Splitter | Splits into 2–3 smaller copies on death |
| `tank` | Tank | Slow, high HP, resists knockback |
| `ranged` | Ranged | Keeps its distance and fires projectiles |
| `boss` | Boss | Stage finale; big HP pool and a telegraphed attack pattern |

### 1.3 Pickups (4)

| Key | Archetype | Behaviour |
|---|---|---|
| `xp` | XP | Dropped by enemies; fills the level-up bar |
| `heal` | Heal | Restores HP |
| `magnet` | Magnet | Pulls every XP pickup on screen to the player |
| `chest` | Chest | Dropped by elites or bosses; grants a weapon upgrade (plays an upgrade cutscene) |

### 1.4 Player characters (2 per theme)

Characters in a theme differ **only by starting weapon** (and optionally one passive stat bonus, drawn from a shared list).
The same pair of starting weapons does not have to be used in every theme, but the list of possible passives is shared.

## 2. Theme catalogue

**Selection rule:** a theme is only accepted if the [LPC generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) can plausibly produce nearly all of its characters: both players and every enemy, including the boss. In practice that means every enemy is a human or a humanoid (zombies, skeletons). Weapon effects, pickups and props are custom art in every theme. The fit is an estimate; check what the generator actually offers before committing to a theme.

### 2.1 Kabukicho, Tokyo at Night — Adult nightlife

The player characters are adults, and enemies are the people who run or prowl the district, not the people exploited in it.

| Slot | Skin |
|---|---|
| Player A | Host-club Host (starts with `lure`) |
| Player B | Retired Yakuza (starts with `sweep`) |
| `sweep` | Baseball Bat |
| `shot` | Handgun |
| `orbit` | Spinning Pachinko Balls |
| `aura` | Cigarette Smoke |
| `chain` | Shorted Neon Sign |
| `pulse` | Karaoke Mic Scream |
| `lure` | Cash |
| `swarmer` | Drunk Salarymen |
| `splitter` | Tout Crew (scatters into individual touts) |
| `tank` | Bouncer |
| `ranged` | Bottle-throwing Yakuza |
| `boss` | Yakuza Boss |
| Pickups | Yen coins / energy drink / lucky cat / hostess-club gift box |

### 2.2 Plague Village — Medieval

The theme LPC fits best: its core assets are medieval.

| Slot | Skin |
|---|---|
| Player A | Plague Doctor (starts with `aura`) |
| Player B | Village Blacksmith (starts with `sweep`) |
| `sweep` | Forge Hammer |
| `shot` | Crossbow |
| `orbit` | Whirling Sickles |
| `aura` | Incense Censer |
| `chain` | Alchemist's Spark |
| `pulse` | Church Bell Toll |
| `lure` | Loaf of Bread |
| `swarmer` | Plague-maddened Peasants |
| `splitter` | Flagellant Procession |
| `tank` | Inquisitor Knight |
| `ranged` | Crossbow Mercenary |
| `boss` | The Plague King |
| Pickups | Silver pennies / healing herbs / holy relic / tithe chest |

### 2.3 Dead Man's Gulch — Wild West

| Slot | Skin |
|---|---|
| Player A | Bounty Hunter (starts with `shot`) |
| Player B | Snake-oil Doctor (starts with `aura`) |
| `sweep` | Lasso Crack |
| `shot` | Revolver |
| `orbit` | Spinning Horseshoes |
| `aura` | Dust Devil |
| `chain` | Telegraph-wire Spark |
| `pulse` | Dynamite Blast |
| `lure` | Whiskey Bottle |
| `swarmer` | Bandits |
| `splitter` | Outlaw Posse |
| `tank` | Hired Strongman |
| `ranged` | Rifleman on a Rooftop |
| `boss` | The Undead Sheriff |
| Pickups | Gold nuggets / can of beans / horseshoe magnet / strongbox |

### 2.4 Buccaneer Bay — Pirates

| Slot | Skin |
|---|---|
| Player A | Privateer Captain (starts with `sweep`) |
| Player B | Navy Gunner (starts with `shot`) |
| `sweep` | Cutlass |
| `shot` | Flintlock Pistol |
| `orbit` | Swinging Anchors |
| `aura` | Gunpowder Smoke |
| `chain` | St. Elmo's Fire |
| `pulse` | Cannon Broadside |
| `lure` | Barrel of Rum |
| `swarmer` | Deckhands |
| `splitter` | Boarding Party |
| `tank` | Brute Quartermaster |
| `ranged` | Musketeer |
| `boss` | The Ghost Admiral |
| Pickups | Doubloons / grog / compass / treasure chest |

### 2.5 Suburban Outbreak — Zombies

LPC has zombie body variants, so the undead enemies can reuse human animations.

| Slot | Skin |
|---|---|
| Player A | Paramedic (starts with `aura`) |
| Player B | Hardware-store Clerk (starts with `sweep`) |
| `sweep` | Shovel |
| `shot` | Nail Gun |
| `orbit` | Lawn-mower Blades |
| `aura` | Bug-spray Fogger |
| `chain` | Jumper Cables |
| `pulse` | Car Alarm Subwoofer |
| `lure` | Boombox |
| `swarmer` | Shamblers |
| `splitter` | Bloater (bursts into crawlers) |
| `tank` | Riot-gear Zombie |
| `ranged` | Spitter |
| `boss` | The Mutated Mayor |
| Pickups | Supply tokens / medkit / fridge magnet / supply drop |

## 3. LPC notes

- **What it covers:** humanoid bodies (several body types, including zombies and skeletons), era clothing, and walk / slash / thrust / shoot / spellcast / hurt animations in 4 directions.
- **What it doesn't:** props and effects: weapon projectiles, clouds, arcs, pickups and map tiles. These need other sources or custom art. Creature enemies are not covered either, which is why every theme above uses human or humanoid enemies only.
- **Mapping to archetypes:** `sweep` → slash animation, `shot` → shoot, `aura` / `pulse` / `chain` → spellcast, damage → hurt. The weapon effects themselves (projectiles, clouds, arcs) are separate sprites.
- **Licensing:** most assets are CC-BY-SA or GPL, which means crediting every author and releasing modified art under the same license. The generator exports a credits file. For a DRM-protected store release (Steam, iOS), restrict the build to CC0 / OGA-BY assets.

## 4. Open questions

1. 4-direction LPC sprites or left/right flipping only?
2. Is a single passive stat bonus per character enough to make the two characters in a theme feel different?
3. Which themes ship first? Suggestion: Plague Village, since medieval is LPC's core asset set; then Kabukicho and Suburban Outbreak.
4. Should themes be purely cosmetic (the player picks any theme) or tied to stages (each theme is a map)?
