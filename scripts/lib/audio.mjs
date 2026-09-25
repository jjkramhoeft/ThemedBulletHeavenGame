// Small offline synth for placeholder theme audio: WAV output, tones, plucked strings, bells, noise.
export const RATE = 22050;

export function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const WAVES = {
  sine: (p) => Math.sin(p * 2 * Math.PI),
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  saw: (p) => 2 * (p % 1) - 1,
  tri: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  noise: () => Math.random() * 2 - 1,
};

/** One note gliding from f0 to f1 with a linear decay. */
export function tone(f0, f1, dur, wave = 'square', vol = 0.3) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    phase += (f0 + (f1 - f0) * t) / RATE;
    out[i] = WAVES[wave](phase) * vol * Math.min(1, i / 60) * (1 - t);
  }
  return out;
}

/** Karplus-Strong plucked string: a lute-like note. */
export function pluck(freq, dur, vol = 0.35, damping = 0.996) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  const period = Math.max(2, Math.round(RATE / freq));
  const buf = Float32Array.from({ length: period }, () => Math.random() * 2 - 1);
  for (let i = 0; i < n; i++) {
    const j = i % period, k = (i + 1) % period;
    out[i] = buf[j] * vol;
    buf[j] = ((buf[j] + buf[k]) / 2) * damping;
  }
  return out;
}

/** Inharmonic partials with exponential decay: a church-bell-like strike. */
export function bell(freq, dur, vol = 0.3) {
  const partials = [[0.5, 0.35], [1, 1], [1.19, 0.5], [1.56, 0.4], [2, 0.35], [2.51, 0.25], [2.66, 0.2], [3.01, 0.15]];
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let s = 0;
    for (const [m, a] of partials) s += Math.sin(2 * Math.PI * freq * m * t) * a * Math.exp(-t * (1.2 + m * 1.1));
    out[i] = (s / 2.5) * vol * Math.min(1, i / 30);
  }
  return out;
}

/** Filtered noise burst (thuds, whooshes, hisses). `cutoff` 0..1: higher is brighter. */
export function noise(dur, vol = 0.3, cutoff = 0.2, attack = 0.005) {
  const n = Math.floor(dur * RATE), out = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    y += cutoff * (Math.random() * 2 - 1 - y);
    const t = i / n;
    out[i] = y * vol * Math.min(1, i / (attack * RATE + 1)) * (1 - t) ** 2;
  }
  return out;
}

export const silence = (dur) => new Float32Array(Math.floor(dur * RATE));

export function concat(...parts) {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function mix(...tracks) {
  const out = new Float32Array(Math.max(...tracks.map((t) => t.length)));
  for (const t of tracks) for (let i = 0; i < t.length; i++) out[i] += t[i];
  return out;
}

/** Places `clip` into `track` starting at `atSec`. */
export function place(track, clip, atSec) {
  const o = Math.floor(atSec * RATE);
  for (let i = 0; i < clip.length && o + i < track.length; i++) track[o + i] += clip[i];
  return track;
}

/** Packs named clips into one buffer plus a Phaser audio-sprite spritemap. */
export function audioSprite(clips, gap = 0.05) {
  const spritemap = {}, parts = [];
  let cursor = 0;
  for (const [name, s] of Object.entries(clips)) {
    spritemap[name] = { start: +(cursor / RATE).toFixed(4), end: +((cursor + s.length) / RATE).toFixed(4), loop: false };
    parts.push(s, silence(gap));
    cursor += s.length + Math.floor(gap * RATE);
  }
  return { samples: concat(...parts), spritemap };
}

/** Note name (e.g. "D4") to Hz. */
export function hz(note) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(note);
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((semis + (Number(m[3]) - 4) * 12) / 12);
}
