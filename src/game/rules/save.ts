import type { WeaponArchetype } from './archetypes';

export interface RunResult {
  won: boolean;
  survivedMs: number;
  kills: number;
}

export interface SaveV1 {
  v: 1;
  /** Keyed `${themeId}/${characterId}` */
  best: Record<string, RunResult>;
  perTheme: Record<string, { seen: WeaponArchetype[] }>;
}

export interface PrefsV1 {
  v: 1;
  theme: string | null;
  character: string | null;
  musicVol: number;
  sfxVol: number;
  subtitles: boolean;
}

export const freshSave = (): SaveV1 => ({ v: 1, best: {}, perTheme: {} });
export const freshPrefs = (): PrefsV1 => ({ v: 1, theme: null, character: null, musicVol: 0.6, sfxVol: 0.8, subtitles: false });

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Accepts whatever was stored and returns a valid current-version save. Unknown or corrupt data starts fresh. */
export function migrateSave(raw: unknown): SaveV1 {
  if (!isObject(raw) || raw.v !== 1) return freshSave();
  const out = freshSave();
  if (isObject(raw.best)) {
    for (const [k, r] of Object.entries(raw.best)) {
      if (isObject(r) && typeof r.won === 'boolean' && typeof r.survivedMs === 'number' && typeof r.kills === 'number') {
        out.best[k] = { won: r.won, survivedMs: r.survivedMs, kills: r.kills };
      }
    }
  }
  if (isObject(raw.perTheme)) {
    for (const [k, t] of Object.entries(raw.perTheme)) {
      if (isObject(t) && Array.isArray(t.seen)) out.perTheme[k] = { seen: t.seen.filter((s): s is WeaponArchetype => typeof s === 'string') };
    }
  }
  return out;
}

export function migratePrefs(raw: unknown): PrefsV1 {
  const out = freshPrefs();
  if (!isObject(raw) || raw.v !== 1) return out;
  if (typeof raw.theme === 'string') out.theme = raw.theme;
  if (typeof raw.character === 'string') out.character = raw.character;
  if (typeof raw.musicVol === 'number') out.musicVol = raw.musicVol;
  if (typeof raw.sfxVol === 'number') out.sfxVol = raw.sfxVol;
  if (typeof raw.subtitles === 'boolean') out.subtitles = raw.subtitles;
  return out;
}

/** True if `a` is a better result than `b`: a win beats a loss, then longer survival, then more kills. */
export function isBetter(a: RunResult, b: RunResult | undefined): boolean {
  if (!b) return true;
  if (a.won !== b.won) return a.won;
  if (a.survivedMs !== b.survivedMs) return a.survivedMs > b.survivedMs;
  return a.kills > b.kills;
}

export function recordResult(save: SaveV1, themeId: string, characterId: string, result: RunResult): SaveV1 {
  const key = `${themeId}/${characterId}`;
  if (!isBetter(result, save.best[key])) return save;
  return { ...save, best: { ...save.best, [key]: result } };
}

export function markCutsceneSeen(save: SaveV1, themeId: string, weapon: WeaponArchetype): SaveV1 {
  const seen = save.perTheme[themeId]?.seen ?? [];
  if (seen.includes(weapon)) return save;
  return { ...save, perTheme: { ...save.perTheme, [themeId]: { seen: [...seen, weapon] } } };
}
