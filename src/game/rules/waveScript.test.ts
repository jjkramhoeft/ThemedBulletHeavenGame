import { describe, expect, it } from 'vitest';
import { seeded } from './rng';
import { BOSS_AT_MS, ELITE_EVERY_MS, WAVE_SCRIPT, WaveDirector, type SpawnOrder } from './waveScript';

function runFor(director: WaveDirector, ms: number, stepMs = 16): SpawnOrder[] {
  const orders: SpawnOrder[] = [];
  for (let t = 0; t < ms; t += stepMs) orders.push(...director.update(stepMs));
  return orders;
}

describe('WAVE_SCRIPT', () => {
  it('starts at 0 and is sorted', () => {
    expect(WAVE_SCRIPT[0]!.fromMs).toBe(0);
    for (let i = 1; i < WAVE_SCRIPT.length; i++) expect(WAVE_SCRIPT[i]!.fromMs).toBeGreaterThan(WAVE_SCRIPT[i - 1]!.fromMs);
  });
});

describe('WaveDirector', () => {
  it('spawns Swarmers from the first second', () => {
    const orders = runFor(new WaveDirector(seeded(1)), 1100);
    expect(orders).toContainEqual({ archetype: 'swarmer', count: 3, elite: false });
  });

  it('spawns one Elite per minute before the Boss', () => {
    const orders = runFor(new WaveDirector(seeded(1)), BOSS_AT_MS - 1);
    expect(orders.filter((o) => o.elite)).toHaveLength(BOSS_AT_MS / ELITE_EVERY_MS - 1);
  });

  it('spawns exactly one Boss, at the end of the timer', () => {
    const d = new WaveDirector(seeded(1));
    const before = runFor(d, BOSS_AT_MS - 100);
    expect(before.some((o) => o.archetype === 'boss')).toBe(false);
    const after = runFor(d, 60_000);
    expect(after.filter((o) => o.archetype === 'boss')).toHaveLength(1);
  });

  it('treats a huge frame delta as a hitch, not elapsed time', () => {
    const d = new WaveDirector(seeded(1));
    d.update(60_000);
    expect(d.elapsedMs).toBeLessThanOrEqual(100);
  });

  it('skipTo jumps ahead without a burst of Elites', () => {
    const d = new WaveDirector(seeded(1));
    d.skipTo(BOSS_AT_MS - 1000);
    const orders = runFor(d, 2000);
    expect(orders.filter((o) => o.elite)).toHaveLength(0);
    expect(orders.filter((o) => o.archetype === 'boss')).toHaveLength(1);
  });

  it('never spawns Fragments directly', () => {
    const orders = runFor(new WaveDirector(seeded(2)), BOSS_AT_MS, 50);
    expect(orders.some((o) => o.archetype === 'fragment')).toBe(false);
  });
});
