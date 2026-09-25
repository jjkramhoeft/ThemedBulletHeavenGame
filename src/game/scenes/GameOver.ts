import Phaser from 'phaser';
import { Controls } from '../input/Controls';
import { isBetter, recordResult, type RunResult } from '../rules/save';
import { writeSave } from '../save/SaveStore';
import { getRun, getSave, getTheme, setSave } from '../state';
import { formatTime, text } from '../ui/ui';

/** Results screen. Records the best result per Theme and Character. */
export class GameOver extends Phaser.Scene {
  private controls!: Controls;
  private readyAt = 0;

  constructor() {
    super('GameOver');
  }

  create(result: RunResult): void {
    const theme = getTheme(this);
    const run = getRun(this)!;
    const { width: w, height: h } = this.scale;
    const key = `${theme.id}/${run.characterId}`;
    const prevBest = getSave(this).best[key];
    const save = recordResult(getSave(this), theme.id, run.characterId, result);
    setSave(this, save);
    writeSave(save);

    text(this, w / 2, h / 2 - 140, result.won ? 'VICTORY' : 'DEFEATED', 64, result.won ? '#ffd24a' : '#ff5a5a');
    text(this, w / 2, h / 2 - 50, `${theme.manifest.name} · ${theme.characterName(run.characterId)}`, 24, '#9aa4b2');
    text(this, w / 2, h / 2 + 10, `Survived ${formatTime(result.survivedMs)} · Level ${run.xp.level} · ${result.kills} kills`, 28);
    if (isBetter(result, prevBest)) text(this, w / 2, h / 2 + 60, 'New best!', 24, '#7bd88f');
    text(this, w / 2, h / 2 + 160, 'Click, Enter or A to continue', 20, '#6b7380');

    this.controls = new Controls(this);
    this.readyAt = this.time.now + 600; // don't let a held key skip the screen
    this.input.once('pointerdown', () => this.back());
  }

  update(): void {
    this.controls.update();
    if (this.time.now > this.readyAt && this.controls.confirmPressed) this.back();
  }

  private back(): void {
    this.scene.start('MainMenu');
  }
}
