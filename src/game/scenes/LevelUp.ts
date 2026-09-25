import Phaser from 'phaser';
import { Controls } from '../input/Controls';
import type { Card } from '../rules/loadout';
import { getTheme } from '../state';
import { backdrop, text } from '../ui/ui';
import type { Game } from './Game';

export interface LevelUpData { cards: Card[] }

/** Modal Level-up: pick one of up to three cards. Game stays paused until a card is chosen. */
export class LevelUp extends Phaser.Scene {
  private cards: Card[] = [];
  private selected = 0;
  private panels: Phaser.GameObjects.Rectangle[] = [];
  private controls!: Controls;
  private done = false;

  constructor() {
    super('LevelUp');
  }

  create(data: LevelUpData): void {
    const theme = getTheme(this);
    const { width: w, height: h } = this.scale;
    this.cards = data.cards;
    this.selected = 0;
    this.done = false;
    this.controls = new Controls(this);
    backdrop(this);
    text(this, w / 2, 140, 'LEVEL UP', 48, '#ffd24a');

    const cw = 300, gap = 30, x0 = w / 2 - ((cw + gap) * this.cards.length - gap) / 2 + cw / 2;
    this.panels = this.cards.map((card, i) => {
      const x = x0 + i * (cw + gap), y = h / 2 + 20;
      const panel = this.add.rectangle(x, y, cw, 300, 0x1b1b24).setStrokeStyle(3, 0x5c6470).setInteractive({ useHandCursor: true });
      panel.on('pointerover', () => { this.selected = i; this.highlight(); });
      panel.on('pointerdown', () => this.choose(i));
      if (card.kind === 'heal') {
        text(this, x, y - 30, '♥', 64, '#ff5a5a');
        text(this, x, y + 60, 'Heal to full', 24);
      } else {
        this.add.image(x, y - 60, theme.sprites, `${card.weapon}/icon`).setScale(2);
        text(this, x, y + 20, theme.name(card.weapon), 28);
        text(this, x, y + 70, card.kind === 'new' ? 'New weapon' : `Level ${card.toLevel}`, 20, card.kind === 'new' ? '#7bd88f' : '#9ecbff');
      }
      text(this, x, y + 125, `[${i + 1}]`, 16, '#6b7380');
      return panel;
    });
    this.highlight();
  }

  update(): void {
    const c = this.controls;
    c.update();
    if (c.leftPressed) { this.selected = (this.selected + this.cards.length - 1) % this.cards.length; this.highlight(); }
    if (c.rightPressed) { this.selected = (this.selected + 1) % this.cards.length; this.highlight(); }
    const n = c.numberPressed;
    if (n >= 0 && n < this.cards.length) this.choose(n);
    else if (c.confirmPressed) this.choose(this.selected);
  }

  private highlight(): void {
    this.panels.forEach((p, i) => p.setStrokeStyle(3, i === this.selected ? 0xffd24a : 0x5c6470));
  }

  private choose(i: number): void {
    if (this.done) return;
    this.done = true;
    (this.scene.get('Game') as Game).applyCard(this.cards[i]!);
    this.scene.resume('Game');
    this.scene.stop();
  }
}
