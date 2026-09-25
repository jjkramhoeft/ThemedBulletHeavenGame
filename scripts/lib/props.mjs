// Custom character props drawn onto composed LPC walk sheets, for things the generator lacks (firearms).
import { DIRS, FRAME, WALK_FRAMES } from './lpc.mjs';
import { Canvas, hex, withAlpha } from './raster.mjs';

/** Calls `fn(dir, ox, oy)` for every walk frame, with the frame's top-left corner in the sheet. */
export function eachFrame(fn) {
  DIRS.forEach((dir, row) => {
    for (let i = 0; i < WALK_FRAMES; i++) fn(dir, i * FRAME, row * FRAME);
  });
}

/** Replaces the 64 px frame at (ox, oy) in `sheet` with `frame`. */
export function setFrame(sheet, ox, oy, frame) {
  for (let y = 0; y < FRAME; y++) sheet.px.set(frame.px.subarray(y * FRAME * 4, (y + 1) * FRAME * 4), ((oy + y) * sheet.w + ox) * 4);
}

/** Bounding box of the torso (shoulders to hips) in one frame of a body-only sheet, in frame coordinates. */
export function torsoBox(bodySheet, ox, oy) {
  const box = bodySheet.crop(ox, oy + 30, FRAME, 16).bbox(128);
  return box && { ...box, y0: box.y0 + 30, y1: box.y1 + 30, cx: (box.x0 + box.x1) / 2 };
}

/**
 * LPC has no firearms. Sling a long gun (musket, rifle) across each frame's back, anchored to the torso so it
 * bobs with the walk. Facing down it hangs behind the body, so only the muzzle above the shoulder and the
 * strap across the chest are drawn over it; from the side and behind it is drawn over the back.
 */
export function slingLongGun(sheet, bodySheet, {
  stock = hex('#8a5a2e'), stockDark = hex('#56361b'), barrel = hex('#3d4048'), strap = hex('#5a3a1e'), ink = hex('#140d08'),
} = {}) {
  eachFrame((dir, ox, oy) => {
    const box = torsoBox(bodySheet, ox, oy);
    if (!box) return;
    const { cx, y0: top } = box;
    // butt end low, muzzle high over the shoulder
    const [[bx, by], [mx, my]] = {
      down: [[cx - 12, top + 13], [cx + 13, top - 11]],
      up: [[cx + 11, top + 13], [cx - 10, top - 13]],
      left: [[box.x1 - 1, top + 14], [box.x1 - 4, top - 14]],
      right: [[box.x0 + 1, top + 14], [box.x0 + 4, top - 14]],
    }[dir];
    const gun = new Canvas(FRAME, FRAME);
    const k = 0.4, sx = bx + (mx - bx) * k, sy = by + (my - by) * k; // where the stock meets the barrel
    gun.line(bx, by, sx, sy, 3, stock);
    gun.line(sx, sy, mx, my, 1.6, barrel);
    gun.line(sx, sy, sx + (mx - sx) * 0.3, sy + (my - sy) * 0.3, 2, stockDark);
    gun.outline(withAlpha(ink, 200));
    const frame = sheet.crop(ox, oy, FRAME, FRAME);
    const out = dir === 'down' ? gun.draw(frame) : frame.draw(gun);
    if (dir === 'down') {
      out.draw(gun, 0, 0, 0, 0, FRAME, Math.floor(top)); // the muzzle shows above the shoulder
      out.line(cx - 5, top + 11, cx + 5, top + 1, 1, strap);
    }
    setFrame(sheet, ox, oy, out);
  });
}
