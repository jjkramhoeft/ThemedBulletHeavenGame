# Game rules

These rules are identical in every Theme. Terms are defined in [CONTEXT.md](../../CONTEXT.md), and the Archetypes and their Skins are listed in [themes.md](themes.md).

## Target

- **v1 target:** desktop web browsers, published on itch.io or self-hosted. Phone browsers should keep working but are not tuned for.
- **Licensing:** CC-BY-SA and GPL LPC assets are acceptable. Ship the generator's credits file.
- **Store releases:** a DRM store release (Steam, iOS) would require a CC0/OGA-BY-only asset audit first. See [themes.md §3](themes.md#3-lpc-notes).

## Run

- **Setup:** the player picks a Theme and one of that Theme's two Characters. Prefs remember the last pick.
- **Length:** a Run lasts **10 minutes**. The Boss spawns at 10:00. Killing it wins the Run; dying loses it.
- **Wave Script:** one shared Wave Script drives every spawn, with an Elite every 60 s.
- **Map:** an endless field. The ground tiles and follows the camera. Decorations are placed deterministically from a seed and never block movement.
- **Screen:** internal resolution is 1280×720 with 1:1 pixel art (`pixelArt: true`) and FIT scaling. Camera zoom is set in one place so it can be tuned during playtests.

## Weapons and Level-ups

- **Slots:** the player holds at most **4 Weapons**. The Character's starting Weapon takes one slot.
- **Weapon Level:** max is **5**.
- **Level-up:** offers **3 cards**. Each card is either a new Weapon (only while a slot is free) or +1 Weapon Level on an owned Weapon. If no valid card exists, the Level-up offers a single "Heal to full" card.
- **Chest:**
  1. Picking it up starts the **Chest Reveal**: the game pauses and waits for the player to confirm.
  2. The Chest then gives +1 Weapon Level to a random owned Weapon that isn't at max, and that Weapon's **Cutscene** plays.
  3. If every owned Weapon is at max, the Chest heals instead and no Cutscene plays.

## Passives

- **Shared list:** max HP, move speed, pickup radius, cooldown reduction, damage and area.
- **In v1:** a Passive comes only from a Character, which has exactly one. Passives do not appear as Level-up cards. Revisit this after the first playtest.

## Enemies

- **Splitter:** releases 2–3 **Fragments** on death. A Fragment is fast and weak, and never splits further.
- **Elite:** a modifier on any non-Boss enemy. It gets ×HP, a larger scale and an outline or tint, and it always drops a Chest.
- **Boss:** loops two attacks, and each is **Telegraphed** about 1 s before it lands:
  - **Charge:** a line Telegraph, then a dash along it.
  - **Radial volley:** a ring of projectiles.

  Below 50 % HP it also summons Swarmers.

## Input

- **Movement:** keyboard (WASD or arrow keys) or gamepad. All Weapons fire automatically.
- **Level-up cards and the Chest Reveal:** mouse, keys 1–3 / Enter, or gamepad.
- **Touch:** no touch controls in v1.

## Persistence

v1 has no meta-progression. The save stores only:
- **Prefs:** last Theme, last Character, volumes, subtitles.
- **Best result** per Theme and Character.
- **Cutscenes seen,** per Theme.

## Milestones

1. **M1:** the whole loop (menu → Run → Level-up → Chest Reveal → Cutscene → Boss → results) in two Themes: the **Debug Theme** and **Plague Village**. The Debug Theme is available in dev builds only.
2. Buccaneer Bay.
3. Kabukicho.
4. Dead Man's Gulch.
5. Suburban Outbreak, which needs the most custom art.
