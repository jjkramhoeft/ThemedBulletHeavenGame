import { describe, expect, it } from 'vitest';
import { freshSave, isBetter, markCutsceneSeen, migratePrefs, migrateSave, recordResult } from './save';

describe('migrateSave', () => {
  it('starts fresh from garbage', () => {
    expect(migrateSave(null)).toEqual(freshSave());
    expect(migrateSave('nope')).toEqual(freshSave());
    expect(migrateSave({ v: 99 })).toEqual(freshSave());
  });

  it('keeps valid entries and drops malformed ones', () => {
    const raw = { v: 1, best: { 'plague/aura-start': { won: true, survivedMs: 600000, kills: 900 }, bad: { won: 'yes' } }, perTheme: { plague: { seen: ['shot', 3] } } };
    expect(migrateSave(raw)).toEqual({ v: 1, best: { 'plague/aura-start': { won: true, survivedMs: 600000, kills: 900 } }, perTheme: { plague: { seen: ['shot'] } } });
  });

  it('round-trips through JSON', () => {
    const s = markCutsceneSeen(recordResult(freshSave(), 'debug', 'shot-start', { won: false, survivedMs: 1000, kills: 3 }), 'debug', 'aura');
    expect(migrateSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});

describe('migratePrefs', () => {
  it('fills defaults', () => {
    expect(migratePrefs({ v: 1, theme: 'plague' }).theme).toBe('plague');
    expect(migratePrefs({ v: 1, theme: 'plague' }).musicVol).toBeGreaterThan(0);
  });
});

describe('results', () => {
  it('a win beats a longer loss', () => {
    expect(isBetter({ won: true, survivedMs: 600000, kills: 1 }, { won: false, survivedMs: 599000, kills: 9999 })).toBe(true);
  });

  it('keeps only the best result per Theme and Character', () => {
    let s = recordResult(freshSave(), 'debug', 'shot-start', { won: false, survivedMs: 5000, kills: 10 });
    s = recordResult(s, 'debug', 'shot-start', { won: false, survivedMs: 3000, kills: 50 });
    expect(s.best['debug/shot-start']!.survivedMs).toBe(5000);
  });

  it('records each Cutscene once', () => {
    const s = markCutsceneSeen(markCutsceneSeen(freshSave(), 'debug', 'shot'), 'debug', 'shot');
    expect(s.perTheme.debug!.seen).toEqual(['shot']);
  });
});
