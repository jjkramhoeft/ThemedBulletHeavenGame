import { migratePrefs, migrateSave, type PrefsV1, type SaveV1 } from '../rules/save';

const SAVE_KEY = 'tbh.save';
const PREFS_KEY = 'tbh.prefs';

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // SecurityError (blocked storage) or corrupt JSON
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Could not persist ${key}; keeping it in memory only.`, e); // QuotaExceededError / SecurityError
  }
}

export const loadSave = (): SaveV1 => migrateSave(read(SAVE_KEY));
export const writeSave = (s: SaveV1) => write(SAVE_KEY, s);
export const loadPrefs = (): PrefsV1 => migratePrefs(read(PREFS_KEY));
export const writePrefs = (p: PrefsV1) => write(PREFS_KEY, p);
