import type Phaser from 'phaser';
import { getPrefs, getTheme } from '../state';
import type { SfxMarker } from '../theme/slots';

/** Minimum gap between two plays of the same marker, so hundreds of hits don't stack. */
const MIN_GAP_MS: Partial<Record<SfxMarker, number>> = { hit: 60, pickup: 40 };
const DEFAULT_GAP_MS = 30;

/** Plays the active Theme's SFX markers with per-marker throttling. */
export class Sfx {
  private readonly last = new Map<SfxMarker, number>();

  constructor(private readonly scene: Phaser.Scene) {}

  play(marker: SfxMarker, volume = 1): void {
    const now = this.scene.game.getTime();
    if (now - (this.last.get(marker) ?? -Infinity) < (MIN_GAP_MS[marker] ?? DEFAULT_GAP_MS)) return;
    this.last.set(marker, now);
    this.scene.sound.playAudioSprite(getTheme(this.scene).sfxKey, marker, { volume: volume * getPrefs(this.scene).sfxVol });
  }
}
