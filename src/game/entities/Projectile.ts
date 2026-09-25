import Phaser from 'phaser';
import { DEPTH } from '../config';

/** A pooled projectile, used both for the player's Shots and for enemy/Boss projectiles. */
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;
  pierce = 1;
  lifeMs = 0;
  /** Enemies already hit, so a piercing shot damages each only once */
  readonly hit = new Set<Phaser.GameObjects.GameObject>();

  fire(texture: string, frame: string, x: number, y: number, vx: number, vy: number, damage: number, pierce: number, radius: number, lifeMs = 2500): this {
    this.setTexture(texture, frame);
    this.enableBody(true, x, y, true, true);
    this.setDepth(DEPTH.projectile).setRotation(Math.atan2(vy, vx));
    this.body!.setCircle(radius, this.frame.width / 2 - radius, this.frame.height / 2 - radius);
    this.setVelocity(vx, vy);
    this.damage = damage;
    this.pierce = pierce;
    this.lifeMs = lifeMs;
    this.hit.clear();
    return this;
  }

  tick(dtMs: number): void {
    this.lifeMs -= dtMs;
    if (this.lifeMs <= 0) this.despawn();
  }

  despawn(): void {
    this.disableBody(true, true);
  }
}
