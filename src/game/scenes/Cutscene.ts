import Phaser from 'phaser';
import { Controls } from '../input/Controls';
import type { WeaponArchetype } from '../rules/archetypes';
import { getPrefs, getTheme } from '../state';
import { text } from '../ui/ui';

export interface CutsceneData { weapon: WeaponArchetype; toLevel: number }

/** Give up on a clip that hasn't started by then (missing file, stalled network). */
const START_TIMEOUT_MS = 4000;
/** Hard cap so a broken clip can never trap the player. */
const MAX_MS = 20_000;

/**
 * Plays a Weapon's Cutscene above the paused Game. The video is always muted and its soundtrack
 * plays through Web Audio, so no user gesture is needed (ADR 0001).
 */
export class Cutscene extends Phaser.Scene {
  private controls!: Controls;
  private finished = false;
  private video: Phaser.GameObjects.Video | null = null;
  private track: Phaser.Sound.BaseSound | null = null;
  private started = false;

  constructor() {
    super('Cutscene');
  }

  create(data: CutsceneData): void {
    const theme = getTheme(this);
    const { width: w, height: h } = this.scale;
    const keys = theme.cutscene(data.weapon);
    this.finished = false;
    this.started = false;
    this.video = null;
    this.controls = new Controls(this);

    this.add.rectangle(0, 0, w, h, 0x000000).setOrigin(0).setInteractive().on('pointerdown', () => this.finish());
    const caption = text(this, w / 2, h - 50, `${theme.name(data.weapon)} · Level ${data.toLevel}`, 28, '#ffd24a').setDepth(2);
    text(this, w - 20, 20, 'Skip ▸', 20, '#9aa4b2').setOrigin(1, 0).setDepth(2);

    const music = this.sound.get(theme.musicGame);
    music?.pause();
    const track = (this.track = this.cache.audio.exists(keys.audio) ? this.sound.add(keys.audio, { volume: getPrefs(this).musicVol }) : null);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { track?.destroy(); music?.resume(); });

    if (!this.cache.video.exists(keys.video)) return this.soundOnly(track, caption);

    // Start detection is polled in update(): for a muted clip the browser fires `playing` before Phaser
    // attaches its listeners (after the play() promise resolves), so VIDEO_PLAYING never arrives.
    const video = (this.video = this.add.video(w / 2, h / 2, keys.video).setDepth(1).setVisible(false));
    video.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, () => this.finish());
    video.once(Phaser.GameObjects.Events.VIDEO_ERROR, () => this.soundOnly(track, caption));
    video.once(Phaser.GameObjects.Events.VIDEO_UNSUPPORTED, () => this.soundOnly(track, caption));
    this.time.delayedCall(START_TIMEOUT_MS, () => { if (!this.started) this.soundOnly(track, caption); });
    this.time.delayedCall(MAX_MS, () => this.finish());
    video.play(false);
  }

  update(): void {
    const v = this.video;
    if (v && !this.started && !this.finished && v.isPlaying() && v.getCurrentTime() > 0 && v.width > 0) {
      this.started = true;
      // The size was 0 when the Video was created, so recompute the origin now that it is known.
      v.setOrigin(0.5).setScale(Math.min(this.scale.width / v.width, this.scale.height / v.height)).setVisible(true);
      this.track?.play();
    }
    this.controls.update();
    if (this.controls.confirmPressed || this.controls.backPressed) this.finish();
  }

  /** Fallback when the clip can't play: show the caption over the soundtrack, then continue. */
  private soundOnly(track: Phaser.Sound.BaseSound | null, caption: Phaser.GameObjects.Text): void {
    if (this.finished) return;
    caption.setY(this.scale.height / 2).setFontSize(44);
    if (track && !track.isPlaying) {
      track.play();
      track.once(Phaser.Sound.Events.COMPLETE, () => this.finish());
    } else if (!track) this.time.delayedCall(1500, () => this.finish());
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.scene.resume('Game');
    this.scene.stop();
  }
}
