import Phaser from 'phaser';

export const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

export const text = (scene: Phaser.Scene, x: number, y: number, s: string, size = 24, color = '#ffffff') =>
  scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);

/** A dimmed full-screen backdrop for modal scenes. */
export const backdrop = (scene: Phaser.Scene, alpha = 0.7) =>
  scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, alpha).setOrigin(0).setInteractive();

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
