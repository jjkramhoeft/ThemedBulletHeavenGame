import type { EnemyArchetype } from './archetypes';
import { type Rng, pick } from './rng';

export const RUN_LENGTH_MS = 10 * 60_000;
export const BOSS_AT_MS = RUN_LENGTH_MS;
export const ELITE_EVERY_MS = 60_000;

/** Enemies the Wave Script spawns directly. Fragments come from Splitters, the Boss from the timer. */
export type WaveArchetype = Exclude<EnemyArchetype, 'boss' | 'fragment'>;

export interface WaveSegment {
  fromMs: number;
  /** For each archetype: spawn `group` enemies every `everyMs` */
  spawns: Partial<Record<WaveArchetype, { everyMs: number; group: number }>>;
}

const min = (m: number) => m * 60_000;

/** The single shared Wave Script. Segments must be sorted by `fromMs` and start at 0. */
export const WAVE_SCRIPT: readonly WaveSegment[] = [
  { fromMs: min(0), spawns: { swarmer: { everyMs: 1000, group: 3 } } },
  { fromMs: min(1), spawns: { swarmer: { everyMs: 800, group: 3 }, splitter: { everyMs: 5000, group: 1 } } },
  { fromMs: min(2), spawns: { swarmer: { everyMs: 700, group: 4 }, splitter: { everyMs: 4000, group: 1 }, ranged: { everyMs: 6000, group: 1 } } },
  { fromMs: min(3), spawns: { swarmer: { everyMs: 650, group: 4 }, splitter: { everyMs: 3500, group: 2 }, ranged: { everyMs: 5000, group: 1 }, tank: { everyMs: 8000, group: 1 } } },
  { fromMs: min(4), spawns: { swarmer: { everyMs: 600, group: 5 }, splitter: { everyMs: 3000, group: 2 }, ranged: { everyMs: 4500, group: 2 }, tank: { everyMs: 7000, group: 1 } } },
  { fromMs: min(5), spawns: { swarmer: { everyMs: 550, group: 5 }, splitter: { everyMs: 2800, group: 2 }, ranged: { everyMs: 4000, group: 2 }, tank: { everyMs: 6000, group: 2 } } },
  { fromMs: min(6), spawns: { swarmer: { everyMs: 500, group: 6 }, splitter: { everyMs: 2500, group: 3 }, ranged: { everyMs: 3500, group: 2 }, tank: { everyMs: 5000, group: 2 } } },
  { fromMs: min(7), spawns: { swarmer: { everyMs: 450, group: 6 }, splitter: { everyMs: 2200, group: 3 }, ranged: { everyMs: 3000, group: 3 }, tank: { everyMs: 4500, group: 2 } } },
  { fromMs: min(8), spawns: { swarmer: { everyMs: 400, group: 7 }, splitter: { everyMs: 2000, group: 3 }, ranged: { everyMs: 2800, group: 3 }, tank: { everyMs: 4000, group: 3 } } },
  { fromMs: min(9), spawns: { swarmer: { everyMs: 350, group: 8 }, splitter: { everyMs: 1800, group: 4 }, ranged: { everyMs: 2500, group: 3 }, tank: { everyMs: 3500, group: 3 } } },
];

export interface SpawnOrder {
  archetype: EnemyArchetype;
  count: number;
  elite: boolean;
}

/** A frame delta above this is treated as a hitch (e.g. a hidden tab), not as elapsed Run time. */
const MAX_STEP_MS = 100;

export function segmentAt(script: readonly WaveSegment[], elapsedMs: number): WaveSegment {
  let current = script[0]!;
  for (const s of script) if (s.fromMs <= elapsedMs) current = s;
  return current;
}

/** Turns elapsed Run time into spawn orders. Advance it with the Game scene's delta only. */
export class WaveDirector {
  elapsedMs = 0;
  private readonly timers = new Map<WaveArchetype, number>();
  private nextEliteMs = ELITE_EVERY_MS;
  private bossSpawned = false;

  constructor(
    private readonly rng: Rng,
    private readonly script: readonly WaveSegment[] = WAVE_SCRIPT,
  ) {}

  /** Jumps the Run clock forward without replaying the skipped spawns (dev shortcut). */
  skipTo(ms: number): void {
    this.elapsedMs = Math.max(this.elapsedMs, ms);
    while (this.nextEliteMs <= this.elapsedMs) this.nextEliteMs += ELITE_EVERY_MS;
  }

  update(dtMs: number): SpawnOrder[] {
    const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS);
    this.elapsedMs += dt;
    const orders: SpawnOrder[] = [];
    const segment = segmentAt(this.script, this.elapsedMs);
    const active = Object.keys(segment.spawns) as WaveArchetype[];

    for (const archetype of this.timers.keys()) if (!(archetype in segment.spawns)) this.timers.delete(archetype);
    for (const archetype of active) {
      const { everyMs, group } = segment.spawns[archetype]!;
      let t = (this.timers.get(archetype) ?? 0) + dt;
      while (t >= everyMs) {
        orders.push({ archetype, count: group, elite: false });
        t -= everyMs;
      }
      this.timers.set(archetype, t);
    }

    if (this.elapsedMs >= this.nextEliteMs && this.nextEliteMs < BOSS_AT_MS) {
      orders.push({ archetype: pick(this.rng, active), count: 1, elite: true });
      this.nextEliteMs += ELITE_EVERY_MS;
    }

    if (!this.bossSpawned && this.elapsedMs >= BOSS_AT_MS) {
      orders.push({ archetype: 'boss', count: 1, elite: false });
      this.bossSpawned = true;
    }
    return orders;
  }
}
