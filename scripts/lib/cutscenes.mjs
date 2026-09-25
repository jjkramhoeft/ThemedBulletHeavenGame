// Placeholder Cutscene clips via ffmpeg (optional). Real clips are produced externally (docs/design/game-rules.md).
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Canvas, writePng } from './raster.mjs';

export const hasFfmpeg = () => spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

/**
 * Writes `<outDir>/<weapon>.mp4` for each entry: a still title card (PNG) held for `seconds`,
 * H.264 Main, yuv420p, +faststart, no audio track (the soundtrack is a separate file, ADR 0001).
 */
export function writePlaceholderClips(outDir, cards, seconds = 4) {
  if (!hasFfmpeg()) {
    console.warn('Cutscenes: ffmpeg not found on PATH, skipped cut/*.mp4.');
    return false;
  }
  for (const { weapon, png } of cards) {
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-loop', '1', '-i', png, '-t', String(seconds), '-r', '30',
      '-vf', "zoompan=z='min(zoom+0.0008,1.08)':d=1:s=1280x720:fps=30",
      '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
      join(outDir, `${weapon}.mp4`),
    ]);
  }
  console.log(`Cutscenes: wrote ${cards.length} clips to ${outDir}`);
  return true;
}

/**
 * A 1280x720 title card: `paintBackground(card)`, then the weapon icon blown up with nearest-neighbour
 * scaling. No text, so it needs no fonts (ffmpeg's drawtext needs fontconfig, missing on Windows builds).
 */
export function iconCard(icon, pngPath, paintBackground, scale = 14) {
  const card = new Canvas(1280, 720);
  paintBackground(card);
  for (let y = 0; y < icon.h; y++)
    for (let x = 0; x < icon.w; x++) {
      const px = icon.get(x, y);
      if (px[3]) card.rect(640 - (icon.w * scale) / 2 + x * scale, 360 - (icon.h * scale) / 2 + y * scale, scale, scale, px);
    }
  writePng(pngPath, card);
  return pngPath;
}
