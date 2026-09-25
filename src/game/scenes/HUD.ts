import Phaser from 'phaser';
import { xpToNext } from '../rules/progression';
import { RUN_LENGTH_MS } from '../rules/waveScript';
import { getRun, getTheme } from '../state';
import { FONT, formatTime } from '../ui/ui';

/** Runs beside Game and keeps drawing while Game is paused. Read-only view of the RunState. */
export class HUD extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private icons: Phaser.GameObjects.Image[] = [];
  private iconLevels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('HUD');
  }

  create(): void {
    const style = { fontFamily: FONT, fontSize: '20px', color: '#ffffff' };
    this.g = this.add.graphics();
    this.levelText = this.add.text(16, 26, '', style);
    this.timerText = this.add.text(this.scale.width / 2, 26, '', { ...style, fontSize: '28px' }).setOrigin(0.5, 0);
    this.killsText = this.add.text(this.scale.width - 16, 26, '', style).setOrigin(1, 0);
    this.bossText = this.add.text(this.scale.width / 2, this.scale.height - 58, '', { ...style, fontSize: '16px' }).setOrigin(0.5, 1);
    this.icons = [];
    this.iconLevels = [];
  }

  update(): void {
    const run = getRun(this);
    if (!run) return;
    const theme = getTheme(this);
    const w = this.scale.width, h = this.scale.height;
    const g = this.g.clear();

    // XP bar across the top
    g.fillStyle(0x1b1b24).fillRect(0, 0, w, 14);
    g.fillStyle(0x4fc3f7).fillRect(0, 0, (w * run.xp.xp) / xpToNext(run.xp.level), 14);
    this.levelText.setText(`LV ${run.xp.level}`);

    const left = RUN_LENGTH_MS - run.elapsedMs;
    this.timerText.setText(left > 0 ? formatTime(left) : 'BOSS');
    this.killsText.setText(`${run.kills} kills`);

    // HP bar bottom-left
    const hpW = 260;
    g.fillStyle(0x1b1b24).fillRect(16, h - 34, hpW, 18);
    g.fillStyle(0xe04848).fillRect(16, h - 34, (hpW * run.health.hp) / run.health.maxHp, 18);

    // Boss bar
    if (run.bossHpFrac !== null) {
      g.fillStyle(0x1b1b24).fillRect(w / 2 - 300, h - 50, 600, 16);
      g.fillStyle(0x9b1c31).fillRect(w / 2 - 300, h - 50, 600 * run.bossHpFrac, 16);
      this.bossText.setText(theme.name('boss'));
    } else this.bossText.setText('');

    // Weapon icons bottom-right
    run.loadout.forEach((wpn, i) => {
      const x = w - 30 - (run.loadout.length - 1 - i) * 44, y = h - 30;
      if (!this.icons[i]) {
        this.icons[i] = this.add.image(x, y, theme.sprites, `${wpn.weapon}/icon`);
        this.iconLevels[i] = this.add.text(x + 14, y + 14, '', { fontFamily: FONT, fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(1);
      }
      this.icons[i]!.setFrame(`${wpn.weapon}/icon`).setPosition(x, y);
      this.iconLevels[i]!.setText(String(wpn.level)).setPosition(x + 14, y + 14);
    });
  }
}
