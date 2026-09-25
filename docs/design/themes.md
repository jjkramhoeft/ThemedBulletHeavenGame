# Themes

All themes share **one** game: the same weapons, enemies, pickups, balance numbers and Wave Script (see [game-rules.md](game-rules.md)).
A theme is a *skin*. It supplies art, names, audio, cutscenes and a tileset for every slot below, and nothing else. The player picks a theme at the start of each Run. Terms are defined in [CONTEXT.md](../../CONTEXT.md).

> Rule: a theme may never add, remove or change a mechanic. If a theme idea needs a new behaviour, that behaviour is added as a new archetype and **every** theme must then provide a skin for it.
>
> The one exception is **which Characters a theme offers**. A Character (starting weapon + passive) is defined theme-agnostically, and each theme picks two to offer and skin. So the starting weapons you can choose from depend on the theme. This is deliberate: it lets characters fit the theme (the Plague Doctor starts with `aura`). Every other mechanic is identical in every theme.

## 1. Slots

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

Each weapon Skin includes a name, an icon, its effect sprites, its SFX and one **Cutscene**. The Cutscene is a clip of ≤ 8 s with a separate soundtrack.

### 1.2 Enemies (5 + Fragment)

| Key | Archetype | Behaviour |
|---|---|---|
| `swarmer` | Swarmer | Fast, weak, spawns in large numbers |
| `splitter` | Splitter | Releases 2–3 Fragments on death |
| `fragment` | Fragment | Released by a Splitter; fast, weak, never splits further |
| `tank` | Tank | Slow, high HP, resists knockback |
| `ranged` | Ranged | Keeps its distance and fires projectiles (the projectile is part of its Skin) |
| `boss` | Boss | Run finale; big HP pool and the shared telegraphed attack pattern (charge, radial volley, summons) |

The Boss Skin includes its Telegraph marker, its volley projectile and its charge effect.
**Elite** is a modifier on any non-Boss enemy and has no Skin of its own. It is drawn as a tint or outline plus a larger scale.

### 1.3 Pickups (4)

| Key | Archetype | Behaviour |
|---|---|---|
| `xp` | XP | Dropped by enemies; fills the level-up bar |
| `heal` | Heal | Restores HP |
| `magnet` | Magnet | Pulls every XP pickup on screen to the player |
| `chest` | Chest | Dropped by Elites and the Boss. Starts the Chest Reveal, then gives +1 Weapon Level to a random owned weapon and plays that weapon's Cutscene (heals if every owned weapon is at max) |

### 1.4 Characters (2 per theme)

A Character is a theme-agnostic pair: one starting weapon and one Passive from the shared list in [game-rules.md](game-rules.md#passives). Each theme offers two Characters and gives each a Skin.

### 1.5 Theme-wide slots

| Slot | Contents |
|---|---|
| Tileset | One seamless ground texture plus 4–6 decoration sprites (these never block movement) |
| Music | Menu track and Run track |
| SFX | One audio sprite; marker names are identical in every theme |

## 2. Theme catalogue

**Selection rule:** a theme is only accepted if the [LPC generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) can plausibly produce nearly all of its characters: both players and every enemy, including the boss. In practice that means every enemy is a human or a humanoid (zombies, skeletons). Weapon effects, pickups, props and tilesets are custom art in every theme. §3 lists the custom parts each theme needs, based on a check of the generator repo.

**Build order:** the Debug Theme and Plague Village (M1), then Buccaneer Bay, Kabukicho, Dead Man's Gulch and Suburban Outbreak.

### 2.1 Kabukicho, Tokyo at Night: Adult nightlife

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
| `splitter` | Tout Crew |
| `fragment` | Lone Touts |
| `tank` | Bouncer |
| `ranged` | Bottle-throwing Yakuza (throws bottles) |
| `boss` | Yakuza Boss |
| Pickups | Yen coins / energy drink / lucky cat / hostess-club gift box |
| Tileset | Wet neon-lit alley pavement |

### 2.2 Plague Village: Medieval

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
| `fragment` | Lone Flagellants |
| `tank` | Inquisitor Knight |
| `ranged` | Crossbow Mercenary (fires bolts) |
| `boss` | The Plague King |
| Pickups | Silver pennies / healing herbs / holy relic / tithe chest |
| Tileset | Muddy village lane |

### 2.3 Dead Man's Gulch: Wild West

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
| `fragment` | Lone Outlaws |
| `tank` | Hired Strongman |
| `ranged` | Rifleman on a Rooftop (fires bullets) |
| `boss` | The Undead Sheriff |
| Pickups | Gold nuggets / can of beans / horseshoe magnet / strongbox |
| Tileset | Desert dirt with scrub and cattle skulls |

### 2.4 Buccaneer Bay: Pirates

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
| `fragment` | Lone Boarders |
| `tank` | Brute Quartermaster |
| `ranged` | Musketeer (fires musket balls) |
| `boss` | The Ghost Admiral |
| Pickups | Doubloons / grog / compass / treasure chest |
| Tileset | Dock planks and beach sand |

### 2.5 Suburban Outbreak: Zombies

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
| `splitter` | Bloater |
| `fragment` | Crawlers |
| `tank` | Riot-gear Zombie |
| `ranged` | Spitter (spits acid) |
| `boss` | The Mutated Mayor |
| Pickups | Supply tokens / medkit / fridge magnet / supply drop |
| Tileset | Suburban lawns and cracked asphalt |

## 3. LPC notes

These notes come from a check of the generator repo at commit `4963a69` (2026-09-20).

- **What it covers:**
  - Frames are 64×64.
  - Body types: male, female, teen, child, muscular and pregnant, plus zombie and skeleton.
  - Era clothing.
  - Animations: walk (9 frames), slash (6), thrust (8), shoot (13, a bow pose), spellcast (7), idle, run and combat idle, all in 4 directions. **Hurt has only 1 direction** (6 frames).
- **What it doesn't:**
  - **No firearms.** The shoot animation is a bow pose.
  - **No fat or oversized body.** Muscular is the largest and is still a 64 px frame.
  - Props and effects: projectiles, clouds, arcs, pickups and tilesets.
  - Creature enemies.
- **Engine work these gaps cause:**
  - Guns are separate sprites held over a thrust or shoot pose.
  - Tanks and Bosses are scaled in the engine.
  - Hit feedback uses a flash or tint, not directional hurt frames.
- **Mapping to archetypes:** `sweep` → slash animation, `shot` → shoot (or thrust with a gun sprite), `aura` / `pulse` / `chain` → spellcast, damage → hurt plus a flash. The weapon effects themselves are separate sprites.
- **Custom character parts each theme needs:**
  - **Plague Village:** Plague Doctor beak mask. Built: `scripts/make-plague-theme.mjs` draws the beak onto every frame, positioned from the LPC mask layer. The Flagellant Procession is composed from three Lone Flagellant sprites in one 96 px frame.
  - **Buccaneer Bay:** musket and cannon props.
  - **Kabukicho:**
    - bottle projectile;
    - yakuza tattoos;
    - a suited *large* bouncer (the muscular body has no suit).
  - **Dead Man's Gulch:**
    - cowboy hat (the cavalier hat is a stand-in);
    - face bandana;
    - sheriff star;
    - rifle and revolver.
  - **Suburban Outbreak:**
    - Bloater body;
    - crawl animation for Crawlers;
    - modern riot gear;
    - paramedic markings;
    - mutation parts for the Mayor.
- **Licensing:**
  - Most assets are CC-BY-SA or GPL, which means crediting every author and releasing modified art under the same licence. The generator exports a credits file.
  - For a DRM-protected store release (Steam, iOS), restrict the build to CC0 / OGA-BY assets. That looks feasible for Plague Village, Buccaneer Bay and Suburban Outbreak, and mostly feasible for Dead Man's Gulch. It is weak for Kabukicho, because the suits, neckties and sunglasses are CC-BY-SA only.
  - The generator's licence filter passes an item if *any* of its files matches, so check licences **per file** in `CREDITS.csv`. For example, the muscular body is CC-BY-SA/GPL only.

## 4. Resolved questions

1. **Facing:** 4-direction LPC sprites.
2. **Characters:** one Passive per Character is enough, because Characters also differ by starting weapon. Revisit after the first playtest.
3. **Ship order:** Debug Theme and Plague Village, then Buccaneer Bay, Kabukicho, Dead Man's Gulch and Suburban Outbreak.
4. **Theme choice:** chosen per Run at Run setup. The map layout (an endless field) and the Wave Script are shared, and only the Tileset is themed.
