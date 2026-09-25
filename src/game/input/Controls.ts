import Phaser from 'phaser';

const STICK_DEADZONE = 0.2;

type Action = 'confirm' | 'back' | 'secondary' | 'left' | 'right' | 'up' | 'down' | 'one' | 'two' | 'three';

const KEY_ACTIONS: Record<string, Action> = {
  Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm', Escape: 'back', KeyC: 'secondary',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Digit1: 'one', Numpad1: 'one', Digit2: 'two', Numpad2: 'two', Digit3: 'three', Numpad3: 'three',
};

type PadState = Record<'confirm' | 'back' | 'secondary' | 'left' | 'right' | 'up' | 'down', boolean>;
const NO_PAD: PadState = { confirm: false, back: false, secondary: false, left: false, right: false, up: false, down: false };

/**
 * Keyboard + gamepad input for one scene: a held movement vector and per-frame menu actions.
 * Key presses are latched from keydown events, so a tap shorter than a frame is never lost
 * (Phaser's `JustDown` is cleared when the key-up lands in the same frame).
 */
export class Controls {
  private readonly held: Record<string, Phaser.Input.Keyboard.Key>;
  private latched = new Set<Action>();
  private thisFrame = new Set<Action>();
  private prevPad: PadState = NO_PAD;

  constructor(private readonly scene: Phaser.Scene) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = scene.input.keyboard!;
    this.held = kb.addKeys({ w: K.W, a: K.A, s: K.S, d: K.D, up: K.UP, left: K.LEFT, down: K.DOWN, right: K.RIGHT }) as Record<string, Phaser.Input.Keyboard.Key>;
    const onKey = (e: KeyboardEvent) => { const a = KEY_ACTIONS[e.code]; if (a && !e.repeat) this.latched.add(a); };
    kb.on('keydown', onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKey));
  }

  private get pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    return this.scene.input.gamepad?.pad1 ?? undefined;
  }

  /** Call once per frame before reading the `*Pressed` getters. */
  update(): void {
    this.thisFrame = this.latched;
    this.latched = new Set();
    const p = this.pad;
    const now: PadState = p ? {
      confirm: p.A, back: p.B, secondary: p.Y,
      left: p.left || p.leftStick.x < -0.6, right: p.right || p.leftStick.x > 0.6,
      up: p.up || p.leftStick.y < -0.6, down: p.down || p.leftStick.y > 0.6,
    } : NO_PAD;
    for (const k of Object.keys(now) as (keyof PadState)[]) if (now[k] && !this.prevPad[k]) this.thisFrame.add(k);
    this.prevPad = now;
  }

  /** Normalised movement direction, or (0, 0). */
  move(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const k = this.held;
    let x = (k.d!.isDown || k.right!.isDown ? 1 : 0) - (k.a!.isDown || k.left!.isDown ? 1 : 0);
    let y = (k.s!.isDown || k.down!.isDown ? 1 : 0) - (k.w!.isDown || k.up!.isDown ? 1 : 0);
    const p = this.pad;
    if (p && x === 0 && y === 0) {
      const sx = p.leftStick.x, sy = p.leftStick.y;
      if (Math.hypot(sx, sy) > STICK_DEADZONE) { x = sx; y = sy; }
      else { x = (p.right ? 1 : 0) - (p.left ? 1 : 0); y = (p.down ? 1 : 0) - (p.up ? 1 : 0); }
    }
    out.set(x, y);
    if (out.lengthSq() > 1) out.normalize();
    return out;
  }

  get confirmPressed() { return this.thisFrame.has('confirm'); }
  get backPressed() { return this.thisFrame.has('back'); }
  /** C key or gamepad Y: a screen's secondary action (e.g. Credits in the menu) */
  get secondaryPressed() { return this.thisFrame.has('secondary'); }
  get leftPressed() { return this.thisFrame.has('left'); }
  get rightPressed() { return this.thisFrame.has('right'); }
  get upPressed() { return this.thisFrame.has('up'); }
  get downPressed() { return this.thisFrame.has('down'); }
  /** 0-based index for keys 1-3, or -1 */
  get numberPressed(): number {
    return this.thisFrame.has('one') ? 0 : this.thisFrame.has('two') ? 1 : this.thisFrame.has('three') ? 2 : -1;
  }
}
