import { describe, expect, it } from 'vitest';
import { BOSS, BossBrain, type BossAction } from './boss';

function run(brain: BossBrain, ms: number, hpFrac = 1, stepMs = 10): BossAction[] {
  const actions: BossAction[] = [];
  for (let t = 0; t < ms; t += stepMs) actions.push(...brain.update(stepMs, hpFrac));
  return actions;
}

describe('BossBrain', () => {
  it('Telegraphs every attack before it happens', () => {
    const types = run(new BossBrain(), 30_000).map((a) => a.type);
    types.forEach((t, i) => {
      if (t === 'charge') expect(types[i - 1]).toBe('telegraphCharge');
      if (t === 'volley') expect(types[i - 1]).toBe('telegraphVolley');
    });
    expect(types).toContain('charge');
    expect(types).toContain('volley');
  });

  it('alternates charge and volley', () => {
    const attacks = run(new BossBrain(), 40_000).filter((a) => a.type === 'charge' || a.type === 'volley').map((a) => a.type);
    attacks.forEach((t, i) => { if (i > 0) expect(t).not.toBe(attacks[i - 1]); });
  });

  it('waits the Telegraph time before charging', () => {
    const b = new BossBrain();
    run(b, BOSS.approachMs + 10);
    expect(b.phase).toBe('chargeTelegraph');
    expect(run(b, BOSS.telegraphMs - 20).some((a) => a.type === 'charge')).toBe(false);
    expect(run(b, 30).some((a) => a.type === 'charge')).toBe(true);
  });

  it('only summons below half HP', () => {
    expect(run(new BossBrain(), 20_000, 0.6).some((a) => a.type === 'summon')).toBe(false);
    expect(run(new BossBrain(), 20_000, 0.4).filter((a) => a.type === 'summon')).toHaveLength(Math.floor(20_000 / BOSS.summonEveryMs));
  });
});
