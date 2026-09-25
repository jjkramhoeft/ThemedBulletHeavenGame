import Phaser from 'phaser';
import { SHOW_DEV_THEMES } from '../config';
import { loadPrefs, loadSave } from '../save/SaveStore';
import { setManifests, setPrefs, setSave } from '../state';
import { parseManifest, type ThemeIndex } from '../theme/ThemeManifest';
import { text } from '../ui/ui';

const INDEX_URL = 'assets/themes/index.json';

/** Loads the Theme index and every Theme's small `theme.json` (not its assets), plus save and prefs. */
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.json('themes.index', INDEX_URL);
    this.load.once(Phaser.Loader.Events.FILE_KEY_COMPLETE + 'json-themes.index', () => {
      const index = this.cache.json.get('themes.index') as ThemeIndex;
      for (const id of index.themes) this.load.json(`theme.${id}`, `assets/themes/${id}/theme.json`);
    });
  }

  create(): void {
    try {
      const index = this.cache.json.get('themes.index') as ThemeIndex;
      const manifests = index.themes
        .map((id) => parseManifest(this.cache.json.get(`theme.${id}`)))
        .filter((m) => SHOW_DEV_THEMES || !m.devOnly);
      if (manifests.length === 0) throw new Error('no playable themes');
      setManifests(this, manifests);
      setSave(this, loadSave());
      setPrefs(this, loadPrefs());
      this.scene.start('MainMenu');
    } catch (e) {
      console.error(e);
      text(this, this.scale.width / 2, this.scale.height / 2, `Could not start:\n${(e as Error).message}`, 22, '#ff8080');
    }
  }
}
