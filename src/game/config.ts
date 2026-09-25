export const WIDTH = 1280;
export const HEIGHT = 720;

/** Single place to tune how much of the field is visible (docs/design/game-rules.md, Screen). */
export const CAMERA_ZOOM = 1;

/** Draw order, lowest first. Gameplay sprites share one atlas, so these stay batched. */
export const DEPTH = {
  ground: 0,
  decoration: 1,
  pickup: 2,
  field: 3,
  enemy: 4,
  /** Above enemies so a Boss attack warning is never hidden by the crowd */
  telegraph: 5,
  player: 6,
  projectile: 7,
  effect: 8,
} as const;

/** Pool sizes (docs/research §3.1). */
export const POOL = { enemies: 600, shots: 400, enemyShots: 300, pickups: 800 } as const;

/** Show the Debug Theme (dev builds only, or VITE_DEBUG_THEME=true). */
export const SHOW_DEV_THEMES = import.meta.env.DEV || import.meta.env.VITE_DEBUG_THEME === 'true';
