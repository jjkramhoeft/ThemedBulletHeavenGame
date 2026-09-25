import Phaser from 'phaser';
import { Controls } from '../input/Controls';
import { CHARACTERS } from '../rules/characters';
import { writePrefs } from '../save/SaveStore';
import { getManifests, getPrefs, getSave, setPrefs } from '../state';
import type { ThemeManifest } from '../theme/ThemeManifest';
import { formatTime, text } from '../ui/ui';

/**
 * Run setup: pick a Theme and one of its two Characters. The click or key press that starts
 * the Run is also the first user gesture, which unlocks Web Audio.
 */
export class MainMenu extends Phaser.Scene {
  private manifests: ThemeManifest[] = [];
  private themeIdx = 0;
  private charIdx = 0;
  private controls!: Controls;
  private themeText!: Phaser.GameObjects.Text;
  private charTexts: Phaser.GameObjects.Text[] = [];
  private bestText!: Phaser.GameObjects.Text;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.manifests = getManifests(this);
    const prefs = getPrefs(this);
    this.themeIdx = Math.max(0, this.manifests.findIndex((m) => m.id === prefs.theme));
    this.charIdx = Math.max(0, this.theme.characters.findIndex((c) => c.character === prefs.character));
    this.controls = new Controls(this);

    text(this, w / 2, 110, 'THEMED BULLET HEAVEN', 56, '#ffd24a');
    text(this, w / 2, 250, 'Theme', 20, '#9aa4b2');
    text(this, w / 2 - 300, 300, '◀', 40).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.cycleTheme(-1));
    text(this, w / 2 + 300, 300, '▶', 40).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.cycleTheme(1));
    this.themeText = text(this, w / 2, 300, '', 40);
    text(this, w / 2, 390, 'Character', 20, '#9aa4b2');
    this.charTexts = [0, 1].map((i) =>
      text(this, w / 2 + (i === 0 ? -220 : 220), 440, '', 26).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.charIdx = i; this.refresh(); }),
    );
    this.bestText = text(this, w / 2, 520, '', 18, '#9aa4b2');
    text(this, w / 2, 610, 'START', 36, '#7bd88f').setInteractive({ useHandCursor: true }).on('pointerdown', () => this.start());
    text(this, w / 2, h - 40, '←/→ theme · ↑/↓ character · Enter / A to start · WASD or stick to move', 16, '#6b7380');
    this.refresh();
  }

  update(): void {
    const c = this.controls;
    c.update();
    if (c.leftPressed) this.cycleTheme(-1);
    if (c.rightPressed) this.cycleTheme(1);
    if (c.upPressed || c.downPressed) { this.charIdx = 1 - this.charIdx; this.refresh(); }
    if (c.confirmPressed) this.start();
  }

  private get theme() { return this.manifests[this.themeIdx]!; }

  private cycleTheme(d: number): void {
    this.themeIdx = (this.themeIdx + d + this.manifests.length) % this.manifests.length;
    this.refresh();
  }

  private refresh(): void {
    const t = this.theme;
    this.themeText.setText(t.name);
    t.characters.forEach((c, i) => {
      const weapon = t.names[CHARACTERS[c.character].startingWeapon];
      this.charTexts[i]!.setText(`${c.name}\nstarts with ${weapon}`).setColor(i === this.charIdx ? '#ffffff' : '#5c6470');
    });
    const best = getSave(this).best[`${t.id}/${t.characters[this.charIdx]!.character}`];
    this.bestText.setText(best ? `Best: ${best.won ? 'Won' : `survived ${formatTime(best.survivedMs)}`} · ${best.kills} kills` : '');
  }

  private start(): void {
    const t = this.theme;
    const character = t.characters[this.charIdx]!.character;
    const prefs = { ...getPrefs(this), theme: t.id, character };
    setPrefs(this, prefs);
    writePrefs(prefs);
    this.scene.start('Loading', { themeId: t.id, characterId: character });
  }
}
