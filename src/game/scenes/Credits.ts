import Phaser from 'phaser';
import { Controls } from '../input/Controls';
import { getManifests } from '../state';
import { parseCredits, summarize, type CreditSummary } from '../theme/credits';
import type { ThemeManifest } from '../theme/ThemeManifest';
import { FONT, text } from '../ui/ui';

export interface CreditsData { themeId: string }

const TOP = 150;
const BOTTOM_MARGIN = 80;
const WRAP = 1040;
const SCROLL_SPEED = 520;
const WHEEL_STEP = 0.6;

/**
 * Attribution for the selected Theme: every third-party author and licence from its CREDITS.csv,
 * which the CC-BY-SA / OGA-BY licences of the LPC art require us to show.
 */
export class Credits extends Phaser.Scene {
  private controls!: Controls;
  private body!: Phaser.GameObjects.Container;
  private bodyHeight = 0;
  private scrollY = 0;
  private readonly move = new Phaser.Math.Vector2();

  constructor() {
    super('Credits');
  }

  create(data: CreditsData): void {
    const { width: w, height: h } = this.scale;
    const manifest = getManifests(this).find((m) => m.id === data.themeId)!;
    this.controls = new Controls(this);
    this.scrollY = 0;
    this.body = this.add.container(w / 2, TOP);

    // Opaque header and footer bars hide the list as it scrolls past (cheaper than a mask).
    this.add.rectangle(0, 0, w, TOP - 10, 0x000000).setOrigin(0).setDepth(1);
    this.add.rectangle(0, h - BOTTOM_MARGIN + 10, w, BOTTOM_MARGIN, 0x000000).setOrigin(0).setDepth(1);
    text(this, w / 2, 60, 'CREDITS', 48, '#ffd24a').setDepth(2);
    text(this, w / 2, 110, manifest.name, 24, '#9aa4b2').setDepth(2);
    text(this, w / 2, h - 36, '↑/↓ or wheel to scroll · Esc / Enter / B to go back', 16, '#6b7380').setDepth(2);
    text(this, w - 70, 60, 'Back', 22, '#7bd88f').setDepth(2).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.back());
    const onWheel = (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollBy(dy * WHEEL_STEP);
    this.input.on('wheel', onWheel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('wheel', onWheel));

    const key = `credits.${manifest.id}`;
    if (!manifest.credits || this.cache.text.exists(key)) return this.render(manifest, key);
    this.load.text(key, manifest.credits);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.render(manifest, key));
    this.load.start();
  }

  update(_t: number, delta: number): void {
    const c = this.controls;
    c.update();
    if (c.backPressed || c.confirmPressed) return this.back();
    const dy = c.move(this.move).y;
    if (dy !== 0) this.scrollBy((dy * SCROLL_SPEED * delta) / 1000);
  }

  private render(manifest: ThemeManifest, key: string): void {
    let summary: CreditSummary | null = null;
    let error: string | null = null;
    if (manifest.credits) {
      try {
        summary = summarize(parseCredits(this.cache.text.get(key) as string));
      } catch (e) {
        error = `Could not read ${manifest.credits}: ${(e as Error).message}`;
      }
    }

    const blocks: Array<[string, number, string]> = [['Engine', 26, '#ffd24a'], ['Phaser 4 by Phaser Studio Inc., MIT License. https://phaser.io', 18, '#ffffff']];
    if (summary) {
      blocks.push(
        ['Character art', 26, '#ffd24a'],
        [`Assembled from ${summary.files} sprite sheets of the Liberated Pixel Cup (LPC) art collection, via the Universal LPC Spritesheet Character Generator.`, 18, '#ffffff'],
        ['Artists', 22, '#9ecbff'],
        [summary.authors.join(' · '), 18, '#ffffff'],
        ['Licences', 22, '#9ecbff'],
        [`${summary.licenses.join(' · ')}\nEach sheet is available under one or more of these licences. The full per-file list, with notes and links, ships with the game as ${manifest.credits}.`, 18, '#ffffff'],
        ['Sources', 22, '#9ecbff'],
        [summary.urls.join('\n'), 16, '#c7ccd4'],
      );
    } else if (error) {
      blocks.push(['Theme art', 26, '#ffd24a'], [error, 18, '#ff8080']);
    }
    blocks.push(['Everything else', 26, '#ffd24a'], [
      summary
        ? 'Game code, weapon effects, pickups, tileset, music, sound effects and placeholder Cutscenes were made for this project.'
        : 'All code, art, music, sound effects and Cutscenes in this Theme were made for this project.',
      18, '#ffffff',
    ]);

    let y = 0;
    for (const [s, size, color] of blocks) {
      const heading = size >= 22;
      if (heading && y > 0) y += size >= 26 ? 26 : 12;
      const t = this.add.text(0, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center', wordWrap: { width: WRAP }, lineSpacing: 4 }).setOrigin(0.5, 0);
      this.body.add(t);
      y += t.height + 8;
    }
    this.bodyHeight = y;
  }

  private scrollBy(dy: number): void {
    const viewport = this.scale.height - TOP - BOTTOM_MARGIN;
    this.scrollY = Phaser.Math.Clamp(this.scrollY + dy, 0, Math.max(0, this.bodyHeight - viewport));
    this.body.y = TOP - this.scrollY;
  }

  private back(): void {
    this.scene.start('MainMenu');
  }
}
