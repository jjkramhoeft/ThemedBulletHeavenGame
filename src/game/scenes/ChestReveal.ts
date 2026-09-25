import Phaser from 'phaser';
import { Controls } from '../input/Controls';
import { markCutsceneSeen } from '../rules/save';
import { writeSave } from '../save/SaveStore';
import { getSave, getTheme, setSave } from '../state';
import { pickupFrame } from '../theme/slots';
import { backdrop, text } from '../ui/ui';
import type { Game } from './Game';

/** The paused beat after picking up a Chest. Confirming opens it and starts the Cutscene. */
export class ChestReveal extends Phaser.Scene {
  private controls!: Controls;
  private opened = false;

  constructor() {
    super('ChestReveal');
  }

  create(): void {
    const theme = getTheme(this);
    const { width: w, height: h } = this.scale;
    this.opened = false;
    this.controls = new Controls(this);
    backdrop(this).on('pointerdown', () => this.open());
    const chest = this.add.image(w / 2, h / 2 - 20, theme.sprites, pickupFrame('chest')).setScale(4);
    this.tweens.add({ targets: chest, y: chest.y - 10, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    text(this, w / 2, h / 2 - 150, theme.name('chest'), 44, '#ffd24a');
    text(this, w / 2, h / 2 + 110, 'Click, Enter or A to open', 22, '#9aa4b2');
  }

  update(): void {
    this.controls.update();
    if (this.controls.confirmPressed) this.open();
  }

  private open(): void {
    if (this.opened) return;
    this.opened = true;
    const game = this.scene.get('Game') as Game;
    const card = game.resolveChest();
    if (card.kind === 'level') {
      const theme = getTheme(this);
      const save = markCutsceneSeen(getSave(this), theme.id, card.weapon);
      setSave(this, save);
      writeSave(save);
      this.scene.launch('Cutscene', { weapon: card.weapon, toLevel: card.toLevel });
    } else {
      this.scene.resume('Game'); // every Weapon is maxed: the Chest healed instead
    }
    this.scene.stop();
  }
}
