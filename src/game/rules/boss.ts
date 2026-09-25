/**
 * The shared Boss pattern: approach, then alternate a telegraphed charge and a telegraphed
 * radial volley. Below half HP it also summons Swarmers on a timer.
 */
export const BOSS = {
  approachMs: 2500,
  telegraphMs: 1000,
  chargeMs: 700,
  /** Charge speed as a multiple of the Boss's walk speed */
  chargeSpeedMul: 6,
  recoverMs: 900,
  volleyCount: 16,
  volleyProjectileSpeed: 160,
  volleyProjectileDamage: 12,
  summonBelowHpFrac: 0.5,
  summonEveryMs: 5000,
  summonCount: 6,
} as const;

export type BossPhase = 'approach' | 'chargeTelegraph' | 'charge' | 'volleyTelegraph' | 'recover';

export type BossAction =
  | { type: 'telegraphCharge' }
  | { type: 'charge' }
  | { type: 'endCharge' }
  | { type: 'telegraphVolley' }
  | { type: 'volley'; count: number }
  | { type: 'summon'; count: number };

export class BossBrain {
  phase: BossPhase = 'approach';
  private phaseMs = 0;
  private nextAttack: 'charge' | 'volley' = 'charge';
  private summonMs = 0;

  /** Advances the pattern; the caller turns actions into movement, Telegraphs and spawns. */
  update(dtMs: number, hpFrac: number): BossAction[] {
    const actions: BossAction[] = [];
    this.phaseMs += dtMs;

    if (hpFrac < BOSS.summonBelowHpFrac) {
      this.summonMs += dtMs;
      if (this.summonMs >= BOSS.summonEveryMs) {
        this.summonMs -= BOSS.summonEveryMs;
        actions.push({ type: 'summon', count: BOSS.summonCount });
      }
    }

    switch (this.phase) {
      case 'approach':
        if (this.phaseMs >= BOSS.approachMs) {
          if (this.nextAttack === 'charge') {
            this.enter('chargeTelegraph');
            actions.push({ type: 'telegraphCharge' });
          } else {
            this.enter('volleyTelegraph');
            actions.push({ type: 'telegraphVolley' });
          }
        }
        break;
      case 'chargeTelegraph':
        if (this.phaseMs >= BOSS.telegraphMs) {
          this.enter('charge');
          actions.push({ type: 'charge' });
        }
        break;
      case 'charge':
        if (this.phaseMs >= BOSS.chargeMs) {
          this.enter('recover');
          this.nextAttack = 'volley';
          actions.push({ type: 'endCharge' });
        }
        break;
      case 'volleyTelegraph':
        if (this.phaseMs >= BOSS.telegraphMs) {
          this.enter('recover');
          this.nextAttack = 'charge';
          actions.push({ type: 'volley', count: BOSS.volleyCount });
        }
        break;
      case 'recover':
        if (this.phaseMs >= BOSS.recoverMs) this.enter('approach');
        break;
    }
    return actions;
  }

  /** The Boss walks toward the player only while approaching. */
  get walks(): boolean {
    return this.phase === 'approach';
  }

  private enter(phase: BossPhase) {
    this.phase = phase;
    this.phaseMs = 0;
  }
}
