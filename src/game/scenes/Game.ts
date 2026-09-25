import Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { CAMERA_ZOOM, DEPTH, POOL } from '../config';
import { dirOf, Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Controls } from '../input/Controls';
import { DROPS, ELITE, ENEMIES, HEAL_PICKUP_AMOUNT, PLAYER_RADIUS, RANGED, SPLITTER_FRAGMENTS, type EnemyArchetype, type PickupArchetype } from '../rules/archetypes';
import { BOSS } from '../rules/boss';
import type { CharacterId } from '../rules/characters';
import { chestReward, levelUpCards, type Card } from '../rules/loadout';
import { heal, takeDamage, tickHealth, xpToNext } from '../rules/progression';
import { randInt, type Rng } from '../rules/rng';
import { collectXp, createRun, takeCard, type RunState } from '../rules/run';
import { BOSS_AT_MS, WaveDirector, type SpawnOrder } from '../rules/waveScript';
import { getPrefs, getTheme, setRun } from '../state';
import { Decorations } from '../systems/Decorations';
import { PickupField } from '../systems/PickupField';
import { WeaponSystem, type CombatWorld, type Lure } from '../systems/WeaponSystem';
import type { ThemeContext } from '../theme/ThemeContext';
import { walkFrame, WEAPON_EFFECT_FRAME, type Direction, type SfxMarker } from '../theme/slots';

export interface GameData { characterId: CharacterId }

/** Frame deltas above this are hitches (tab switch, GC) and are not simulated. */
const MAX_DT = 50;
const KNOCKBACK_DECAY_MS = 110;

/** The Run simulation. Mechanics come from rules/; this scene moves bodies and draws Skins. */
export class Game extends Phaser.Scene implements CombatWorld {
  theme!: ThemeContext;
  run!: RunState;
  nowMs = 0;
  lures: Lure[] = [];

  private hero!: Phaser.Physics.Arcade.Sprite;
  private heroDir: Direction = 'down';
  private readonly facing = new Phaser.Math.Vector2(0, 1);
  private readonly moveVec = new Phaser.Math.Vector2();
  private enemies!: Phaser.Physics.Arcade.Group;
  private shots!: Phaser.Physics.Arcade.Group;
  private enemyShots!: Phaser.Physics.Arcade.Group;
  private pickups!: PickupField;
  private decorations!: Decorations;
  private ground!: Phaser.GameObjects.TileSprite;
  private weapons!: WeaponSystem;
  private director!: WaveDirector;
  private controls!: Controls;
  private sounds!: Sfx;
  private music: Phaser.Sound.BaseSound | null = null;
  private boss: Enemy | null = null;
  private telegraph: Phaser.GameObjects.Image | null = null;
  /** Spawns requested mid-physics-step (e.g. Fragments), applied at the start of the next update */
  private queued: Array<{ archetype: EnemyArchetype; x: number; y: number }> = [];
  private ended = false;
  private readonly rng: Rng = Math.random;

  constructor() {
    super('Game');
  }

  get host(): Phaser.Scene {
    return this;
  }

  get player() {
    return { x: this.hero.x, y: this.hero.y, facingX: this.facing.x, facingY: this.facing.y };
  }

  create(data: GameData): void {
    // Scene instances are reused between Runs, so reset everything here.
    this.theme = getTheme(this);
    this.run = createRun(data.characterId);
    setRun(this, this.run);
    this.nowMs = 0;
    this.lures = [];
    this.boss = null;
    this.telegraph = null;
    this.queued = [];
    this.ended = false;
    this.heroDir = 'down';
    this.facing.set(0, 1);

    const cam = this.cameras.main.setZoom(CAMERA_ZOOM).setBackgroundColor('#000000');
    this.ground = this.add.tileSprite(0, 0, cam.width / CAMERA_ZOOM + 2, cam.height / CAMERA_ZOOM + 2, this.theme.ground)
      .setOrigin(0).setDepth(DEPTH.ground);

    const heroScale = this.theme.scale('player');
    this.hero = this.physics.add.sprite(0, 0, this.theme.sprites, walkFrame(data.characterId, 'down', 0))
      .setDepth(DEPTH.player).setScale(heroScale);
    const r = PLAYER_RADIUS / heroScale;
    this.hero.body!.setCircle(r, this.hero.frame.width / 2 - r, this.hero.frame.height / 2 - r);
    cam.startFollow(this.hero, true);

    this.enemies = this.physics.add.group({ classType: Enemy, maxSize: POOL.enemies, runChildUpdate: false });
    this.shots = this.physics.add.group({ classType: Projectile, maxSize: POOL.shots, runChildUpdate: false });
    this.enemyShots = this.physics.add.group({ classType: Projectile, maxSize: POOL.enemyShots, runChildUpdate: false });
    this.physics.add.overlap(this.shots, this.enemies, (s, e) => this.onShotHit(s as Projectile, e as Enemy));
    this.physics.add.overlap(this.hero, this.enemies, (_h, e) => this.hurtPlayer(ENEMIES[(e as Enemy).archetype].contactDamage));
    this.physics.add.overlap(this.hero, this.enemyShots, (_h, s) => {
      const p = s as Projectile;
      if (!p.active) return;
      this.hurtPlayer(p.damage);
      p.despawn();
    });

    this.pickups = new PickupField(this, this.theme, POOL.pickups);
    this.decorations = new Decorations(this, this.theme, 1337);
    this.director = new WaveDirector(this.rng);
    this.controls = new Controls(this);
    this.sounds = new Sfx(this);
    this.weapons = new WeaponSystem(this);
    this.weapons.sync(this.run.loadout, this.run.stats);

    this.music = this.sound.add(this.theme.musicGame, { loop: true, volume: getPrefs(this).musicVol });
    this.music.play();

    this.scene.launch('HUD');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    if (import.meta.env.DEV) this.devShortcuts();
  }

  /** Dev builds only: X = one level of XP, C = drop a Chest, B = skip to 5 s before the Boss, K = hit the Boss for 30%. */
  private devShortcuts(): void {
    const kb = this.input.keyboard!;
    kb.on('keydown-X', () => collectXp(this.run, xpToNext(this.run.xp.level) - this.run.xp.xp));
    kb.on('keydown-C', () => this.pickups.spawn('chest', this.hero.x + 40, this.hero.y));
    kb.on('keydown-B', () => this.director.skipTo(BOSS_AT_MS - 5000));
    kb.on('keydown-K', () => { if (this.boss) this.damageEnemy(this.boss, this.boss.maxHp * 0.3); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => ['keydown-X', 'keydown-C', 'keydown-B', 'keydown-K'].forEach((e) => kb.off(e)));
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    const dt = Math.min(delta, MAX_DT);
    this.nowMs += dt;

    for (const q of this.queued.splice(0)) this.spawnEnemy(q.archetype, q.x, q.y, false);

    this.controls.update();
    this.moveHero(dt);

    for (const order of this.director.update(dt)) this.spawnOrder(order);
    this.run.elapsedMs = this.director.elapsedMs;

    this.updateEnemies(dt);
    this.tickProjectiles(this.shots, dt);
    this.tickProjectiles(this.enemyShots, dt);
    this.weapons.update(dt);
    this.pickups.update(dt, this.hero.x, this.hero.y, this.run.stats.pickupRadius, (k, v) => this.collect(k, v));

    const view = this.cameras.main.worldView;
    this.decorations.update(view);
    this.ground.setPosition(view.x - 1, view.y - 1).setTilePosition(view.x, view.y);

    if (this.run.health.hp <= 0) return this.endRun(false);
    if (this.run.pendingChests > 0) this.openChest();
    else if (this.run.pendingLevelUps > 0) this.openLevelUp();
  }

  // ------------------------------------------------------------------ player

  private moveHero(dt: number): void {
    const m = this.controls.move(this.moveVec);
    const speed = this.run.stats.moveSpeed;
    this.hero.setVelocity(m.x * speed, m.y * speed);
    const charId = this.run.characterId;
    if (m.lengthSq() > 0.01) {
      this.facing.copy(m).normalize();
      const dir = dirOf(m.x, m.y);
      if (dir !== this.heroDir || !this.hero.anims.isPlaying) {
        this.heroDir = dir;
        this.hero.play(this.theme.walkAnim(charId, dir), true);
      }
    } else if (this.hero.anims.isPlaying) {
      this.hero.anims.stop();
      this.hero.setFrame(walkFrame(charId, this.heroDir, 0));
    }
    this.run.health = tickHealth(this.run.health, dt);
    this.hero.setAlpha(this.run.health.invulnerableMs > 0 && Math.floor(this.nowMs / 60) % 2 === 0 ? 0.4 : 1);
  }

  private hurtPlayer(amount: number): void {
    if (this.ended) return;
    const before = this.run.health.hp;
    this.run.health = takeDamage(this.run.health, amount);
    if (this.run.health.hp < before) {
      this.sfx('playerHurt');
      this.cameras.main.shake(80, 0.004);
    }
  }

  private collect(kind: PickupArchetype, value: number): void {
    switch (kind) {
      case 'xp': collectXp(this.run, value); this.sfx('pickup'); break;
      case 'heal': this.run.health = heal(this.run.health, HEAL_PICKUP_AMOUNT); this.sfx('pickup'); break;
      case 'magnet': this.pickups.magnetise(); this.sfx('pickup'); break;
      case 'chest': this.run.pendingChests++; this.sfx('chest'); break;
    }
  }

  // ------------------------------------------------------------------ spawning

  private spawnOrder(o: SpawnOrder): void {
    const view = this.cameras.main.worldView;
    const ring = Math.hypot(view.width, view.height) / 2 + 40;
    for (let i = 0; i < o.count; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = o.archetype === 'boss' ? 420 : ring + this.rng() * 60;
      this.spawnEnemy(o.archetype, this.hero.x + Math.cos(a) * d, this.hero.y + Math.sin(a) * d, o.elite);
    }
  }

  private spawnEnemy(archetype: EnemyArchetype, x: number, y: number, elite: boolean): Enemy | null {
    let e = this.enemies.get(x, y) as Enemy | null;
    if (!e && archetype === 'boss') {
      e = this.farthestEnemy(); // the Boss must always appear, even with a full pool
      e?.despawn();
    }
    if (!e) return null;
    e.spawn(this.theme, archetype, x, y, elite);
    if (archetype === 'boss') {
      this.boss = e;
      this.run.bossHpFrac = 1;
      this.sfx('bossTelegraph');
    }
    return e;
  }

  private farthestEnemy(): Enemy | null {
    let best: Enemy | null = null, bd = -1;
    for (const e of this.activeEnemies()) {
      const d = Phaser.Math.Distance.Squared(e.x, e.y, this.hero.x, this.hero.y);
      if (e !== this.boss && d > bd) { bd = d; best = e; }
    }
    return best;
  }

  // ------------------------------------------------------------------ enemies

  private activeEnemies(): Enemy[] {
    return (this.enemies.getChildren() as Enemy[]).filter((e) => e.active);
  }

  private updateEnemies(dt: number): void {
    const px = this.hero.x, py = this.hero.y;
    const view = this.cameras.main.worldView;
    const recycleDist = Math.hypot(view.width, view.height) * 0.9;
    const decay = Math.exp(-dt / KNOCKBACK_DECAY_MS);

    for (const e of this.activeEnemies()) {
      const stats = ENEMIES[e.archetype];
      const speed = stats.speed * (e.slowUntil > this.nowMs ? 1 - e.slowFrac : 1);
      let tx = px, ty = py, lured = false;
      if (e.archetype !== 'boss') {
        for (const l of this.lures) {
          if (Phaser.Math.Distance.Squared(e.x, e.y, l.x, l.y) < l.radius * l.radius) { tx = l.x; ty = l.y; lured = true; break; }
        }
      }
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
      let vx = (dx / d) * speed, vy = (dy / d) * speed;

      if (e.archetype === 'boss') {
        [vx, vy] = this.updateBoss(e, dt, vx, vy);
      } else if (e.archetype === 'ranged' && !lured) {
        if (d < RANGED.range * 0.7) { vx = -vx; vy = -vy; }
        else if (d < RANGED.range) { vx = 0; vy = 0; }
        e.fireMs -= dt;
        if (e.fireMs <= 0 && d < RANGED.range * 1.3) {
          e.fireMs = RANGED.fireCooldownMs;
          this.fireEnemyShot('ranged/proj', e.x, e.y, (dx / d) * RANGED.projectileSpeed, (dy / d) * RANGED.projectileSpeed, RANGED.projectileDamage);
        }
      } else if (lured && d < 12) {
        vx = 0; vy = 0;
      }

      e.knockX *= decay;
      e.knockY *= decay;
      e.setVelocity(vx + e.knockX, vy + e.knockY);
      e.tickVisuals(this.theme, dt, vx, vy);

      // Enemies left far behind are moved back into play ahead of the player.
      if (e.archetype !== 'boss' && Math.hypot(px - e.x, py - e.y) > recycleDist) {
        const a = Math.atan2(this.facing.y, this.facing.x) + (this.rng() - 0.5) * 1.6;
        const r = Math.hypot(view.width, view.height) / 2 + 40;
        e.body!.reset(px + Math.cos(a) * r, py + Math.sin(a) * r);
      }
    }
  }

  /** Turns the shared Boss pattern into movement, Telegraphs and attacks. Returns the Boss velocity. */
  private updateBoss(e: Enemy, dt: number, walkVx: number, walkVy: number): [number, number] {
    const brain = e.brain!;
    const speed = ENEMIES.boss.speed;
    for (const a of brain.update(dt, e.hp / e.maxHp)) {
      switch (a.type) {
        case 'telegraphCharge': {
          const ang = Math.atan2(this.hero.y - e.y, this.hero.x - e.x);
          e.chargeX = Math.cos(ang);
          e.chargeY = Math.sin(ang);
          const length = (speed * BOSS.chargeSpeedMul * BOSS.chargeMs) / 1000 + e.radius;
          this.showTelegraph('boss/telegraph_line', e.x, e.y).setOrigin(0, 0.5).setRotation(ang)
            .setScale(length / 64, (e.radius * 2) / 16);
          this.sfx('bossTelegraph');
          break;
        }
        case 'charge':
          this.clearTelegraph();
          this.effect('boss/charge', e.x, e.y, Math.atan2(e.chargeY, e.chargeX), 300);
          break;
        case 'telegraphVolley':
          this.showTelegraph('boss/telegraph_ring', e.x, e.y).setScale((e.radius * 2.5) / 62);
          this.sfx('bossTelegraph');
          break;
        case 'volley':
          this.clearTelegraph();
          for (let i = 0; i < a.count; i++) {
            const ang = (i / a.count) * Math.PI * 2;
            this.fireEnemyShot('boss/proj', e.x, e.y, Math.cos(ang) * BOSS.volleyProjectileSpeed, Math.sin(ang) * BOSS.volleyProjectileSpeed, BOSS.volleyProjectileDamage);
          }
          break;
        case 'summon':
          for (let i = 0; i < a.count; i++) {
            const ang = (i / a.count) * Math.PI * 2;
            this.queued.push({ archetype: 'swarmer', x: e.x + Math.cos(ang) * 90, y: e.y + Math.sin(ang) * 90 });
          }
          break;
        case 'endCharge':
          break;
      }
    }
    this.run.bossHpFrac = e.hp / e.maxHp;
    if (this.telegraph && brain.phase === 'volleyTelegraph') this.telegraph.setPosition(e.x, e.y);
    if (brain.phase === 'charge') return [e.chargeX * speed * BOSS.chargeSpeedMul, e.chargeY * speed * BOSS.chargeSpeedMul];
    return brain.walks ? [walkVx, walkVy] : [0, 0];
  }

  private showTelegraph(frame: string, x: number, y: number): Phaser.GameObjects.Image {
    this.clearTelegraph();
    this.telegraph = this.add.image(x, y, this.theme.sprites, frame).setDepth(DEPTH.telegraph);
    this.tweens.add({ targets: this.telegraph, alpha: { from: 0.4, to: 1 }, duration: 250, yoyo: true, repeat: -1 });
    return this.telegraph;
  }

  private clearTelegraph(): void {
    this.telegraph?.destroy();
    this.telegraph = null;
  }

  private effect(frame: string, x: number, y: number, rotation: number, ms: number): void {
    const img = this.add.image(x, y, this.theme.sprites, frame).setDepth(DEPTH.effect).setRotation(rotation);
    this.tweens.add({ targets: img, alpha: 0, duration: ms, onComplete: () => img.destroy() });
  }

  // ------------------------------------------------------------------ combat (CombatWorld)

  enemiesWithin(x: number, y: number, radius: number): Enemy[] {
    const bodies = this.physics.overlapCirc(x, y, radius, true, false) as Phaser.Physics.Arcade.Body[];
    const out: Enemy[] = [];
    for (const b of bodies) if (b.gameObject instanceof Enemy && b.gameObject.active) out.push(b.gameObject);
    return out;
  }

  nearestEnemies(x: number, y: number, maxDist: number, n: number): Enemy[] {
    const max2 = maxDist * maxDist;
    return this.activeEnemies()
      .map((e) => ({ e, d: Phaser.Math.Distance.Squared(x, y, e.x, e.y) }))
      .filter((c) => c.d <= max2)
      .sort((a, b) => a.d - b.d)
      .slice(0, n)
      .map((c) => c.e);
  }

  damageEnemy(e: Enemy, damage: number, fromX?: number, fromY?: number, knockback = 0): void {
    if (!e.active || this.ended) return;
    e.hp -= damage;
    e.flash();
    if (knockback > 0 && fromX !== undefined && fromY !== undefined) {
      const a = Math.atan2(e.y - fromY, e.x - fromX);
      const k = knockback * (1 - ENEMIES[e.archetype].knockbackResist);
      e.knockX += Math.cos(a) * k;
      e.knockY += Math.sin(a) * k;
    }
    this.sfx('hit');
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    const { x, y, archetype, elite } = e;
    e.despawn();
    this.run.kills++;
    const xp = ENEMIES[archetype].xp * (elite ? ELITE.xpMultiplier : 1);
    if (xp > 0) this.pickups.spawn('xp', x, y, xp);
    if (elite || archetype === 'boss') this.pickups.spawn('chest', x + 12, y);
    else if (this.rng() < DROPS.heal) this.pickups.spawn('heal', x, y + 10);
    else if (this.rng() < DROPS.magnet) this.pickups.spawn('magnet', x, y + 10);
    if (archetype === 'splitter') {
      const n = randInt(this.rng, SPLITTER_FRAGMENTS.min, SPLITTER_FRAGMENTS.max);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.queued.push({ archetype: 'fragment', x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14 });
      }
    }
    if (archetype === 'boss') {
      this.boss = null;
      this.run.bossHpFrac = null;
      this.clearTelegraph();
      this.endRun(true);
    }
  }

  fireShot(x: number, y: number, vx: number, vy: number, damage: number, pierce: number): void {
    (this.shots.get(x, y) as Projectile | null)?.fire(this.theme.sprites, WEAPON_EFFECT_FRAME.shot, x, y, vx, vy, damage, pierce, 6);
  }

  private fireEnemyShot(frame: string, x: number, y: number, vx: number, vy: number, damage: number): void {
    (this.enemyShots.get(x, y) as Projectile | null)?.fire(this.theme.sprites, frame, x, y, vx, vy, damage, 1, 5, 4000);
  }

  private onShotHit(s: Projectile, e: Enemy): void {
    if (!s.active || !e.active || s.hit.has(e)) return;
    s.hit.add(e);
    const v = s.body!.velocity;
    this.damageEnemy(e, s.damage, e.x - v.x, e.y - v.y, 60);
    if (--s.pierce <= 0) s.despawn();
  }

  private tickProjectiles(group: Phaser.Physics.Arcade.Group, dt: number): void {
    for (const p of group.getChildren() as Projectile[]) if (p.active) p.tick(dt);
  }

  sfx(marker: SfxMarker): void {
    this.sounds.play(marker);
  }

  // ------------------------------------------------------------------ Level-up, Chest, end

  private openLevelUp(): void {
    this.run.pendingLevelUps--;
    const cards = levelUpCards(this.run.loadout, this.rng);
    this.sfx('levelUp');
    this.scene.pause();
    this.scene.launch('LevelUp', { cards });
  }

  private openChest(): void {
    this.run.pendingChests--;
    this.scene.pause();
    this.scene.launch('ChestReveal');
  }

  /** Called by the LevelUp scene with the card the player picked. */
  applyCard(card: Card): void {
    takeCard(this.run, card);
    this.weapons.sync(this.run.loadout, this.run.stats);
  }

  /** Called by the ChestReveal scene on confirm. */
  resolveChest(): Card {
    const card = chestReward(this.run.loadout, this.rng);
    this.applyCard(card);
    return card;
  }

  private endRun(won: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.physics.pause();
    this.hero.setVelocity(0, 0);
    this.music?.stop();
    this.sfx(won ? 'win' : 'lose');
    const result = { won, survivedMs: this.run.elapsedMs, kills: this.run.kills };
    this.time.delayedCall(1500, () => {
      this.scene.stop('HUD');
      this.scene.start('GameOver', result);
    });
  }

  private cleanup(): void {
    this.weapons.destroy();
    this.clearTelegraph();
    this.music?.destroy();
    this.music = null;
    // No physics.resume(): Arcade has already destroyed its world on SHUTDOWN and builds a fresh one on start.
  }
}
