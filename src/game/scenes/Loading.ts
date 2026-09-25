import Phaser from 'phaser';
import type { CharacterId } from '../rules/characters';
import { getManifests, setTheme } from '../state';
import { loadTheme, unloadAllExcept } from '../theme/themeLoader';
import { text } from '../ui/ui';

export interface LoadingData { themeId: string; characterId: CharacterId }

/** Swaps the loaded Theme: unloads any other Theme, loads the chosen one, then starts the Run. */
export class Loading extends Phaser.Scene {
  constructor() {
    super('Loading');
  }

  async create(data: LoadingData): Promise<void> {
    const { width: w, height: h } = this.scale;
    const manifest = getManifests(this).find((m) => m.id === data.themeId)!;
    text(this, w / 2, h / 2 - 40, `Loading ${manifest.name}…`, 28);
    const bar = this.add.rectangle(w / 2 - 300, h / 2 + 10, 0, 12, 0xffd24a).setOrigin(0, 0.5);
    this.add.rectangle(w / 2, h / 2 + 10, 604, 16).setStrokeStyle(2, 0x5c6470);

    unloadAllExcept(this.game, manifest.id);
    try {
      const ctx = await loadTheme(this, manifest, (p) => bar.setSize(600 * p, 12));
      setTheme(this, ctx);
      this.scene.start('Game', { characterId: data.characterId });
    } catch (e) {
      console.error(e);
      text(this, w / 2, h / 2 + 80, (e as Error).message, 18, '#ff8080');
    }
  }
}
