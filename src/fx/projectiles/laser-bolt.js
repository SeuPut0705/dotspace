// The banded body, travelling pulses and spiralling sparks follow Sprite Fusion's open-source energy beam
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, rand, sparkle, space, TAU, WHITE } from "../../core/index.js";
import { beat, shadow3 } from "./_lib.js";

export const meta = {
  name: "Laser bolt",
  desc: "A red laser bolt: a white-hot core in a rounded head, red bands tapering back, pulses racing down it, a tail that shimmers apart into wavering dashes.",
  tags: ["projectile", "laser", "energy", "sci-fi", "directional", "loop"],
  size: [128, 32],
  origin: [108, 16],
  duration: 0.5,
  loop: true,
  fps: 30,
  bg: "sky",
  options: { palette: ["#2a0610", "#5c0d1c", "#9a1428", "#d8243a", "#ff4d5e", "#ff8a94", "#ffd0d4", "#ffffff"], length: 40, seed: 2 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 8), L = o.length, S = o.seed, D = meta.duration, ph = t / D, fr = Math.floor(t * 30 + 1e-6);
  const left = -meta.origin[0] + 2;

  // the shimmering tail: dashes shed off the bolt's end, wavering, flickering and cooling as they fall behind
  beat(t, D, 14, S, (r) => r.range(0.18, 0.3), (age, life, r) => {
    const k = age / life, x0 = -L * 0.8 - age * r.range(150, 230), len = r.range(3, 7) * (1 - k * 0.5), y = 0.5 + Math.sin(x0 * 0.25 + ph * TAU * 2) * (0.5 + k * 1.5) + r.range(-0.6, 0.6) * k;
    if (x0 - len < left || rand(fr, r.int(0, 999)) < k * 0.5) return;
    p.line(x0, y, x0 - len, y, k < 0.3 ? C[5] : k < 0.6 ? C[4] : C[3]);
    if (k < 0.4) p.glow(x0 - len / 2, y, 4, C[4], 0.3 * (1 - k));
  });

  // the body: bands round a white core, thickest just behind the rounded head and tapering to a thread, a
  // pulse running back down it every so often; the edge breaks up a little as the light shimmers
  p.shade(-L - 1, -5, 4, 6, (x, y) => {
    const d = -x + 3, u = d / (L + 3);
    if (u < 0 || u > 1) return;
    const head = d < 3 ? Math.sqrt(Math.max(0, 1 - ((3 - d) / 3) ** 2)) : 1;
    const w = (3.4 * Math.pow(1 - u, 0.9) + 0.5) * head * (1 + 0.08 * Math.sin(d * 0.9 - ph * TAU * 4)), v = Math.abs(y - 0.5) / w;
    if (v > 1.2) return;
    if (v > 1 && (u > 0.5 || rand(Math.floor(x), fr) > 0.6)) return;
    const pulse = ((d * 0.05 - ph * 3) % 1 + 1) % 1 < 0.12 ? 1 : 0;
    const lvl = v < 0.22 ? (u < 0.6 ? 7 : 6) : v < 0.45 ? 6 - (u > 0.5 ? 1 : 0) : v < 0.72 ? 4 : v <= 1 ? 3 : 2;
    return C[Math.min(7, lvl + (v < 0.72 ? pulse : 0))];
  });
  // sparks spiralling round the core, a bright one on the near side and a dim one behind
  for (const s of [0, Math.PI]) {
    for (let d = 2; d < L * 0.7; d += 1) {
      const a = d * 0.45 - ph * TAU * 3 + s, y = 0.5 + Math.sin(a) * (2.2 * (1 - d / L) + 0.6);
      if (Math.cos(a) > 0.3) p.dot(-d, y, Math.cos(a) > 0.8 ? WHITE : C[6]);
    }
  }
  // the head's glint, flickering, and the light
  const g = 0.75 + 0.25 * Math.sin(ph * TAU * 2);
  sparkle(p, 1, 0.5, 3 + Math.round(g * 2), C[6], C[4], 0.5);
  p.glowLine(1, 0.5, -L, 0.5, 9, C[3], 0.4);
  p.glow(-2, 0.5, 20, C[3], 0.5 * g);
  p.glow(1, 0.5, 6, WHITE, 0.25);
}

// 3D: the bolt is a rod of light flying down +x: a rounded head, bands round a white core tapering to a thread, a pulse
// racing back, and two strands of sparks winding round it so the spiral reads in depth. The tail shimmers apart into dashes
// scattered in a ring round the axis.
const FLY = -24;
export const three = {
  meta: { size: [114, 62], origin: [57, 46], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const C = fit(o.palette, 8), L = o.length, S = o.seed, D = meta.duration, ph = t / D, fr = Math.floor(t * 30 + 1e-6), q = space(p, o);
    const left = -L - 36, SH = L / 2 + 4, X = (x) => x + SH;
    shadow3(q, X(-L / 2 + 2), 0, L / 2 + 8, 2.4, 0.5);
    // the half width of the body d px behind the head's front
    const half = (d) => {
      const u = d / (L + 3), head = d < 3 ? Math.sqrt(Math.max(0, 1 - ((3 - d) / 3) ** 2)) : 1;
      return (3.4 * Math.pow(1 - u, 0.9) + 0.5) * head * (1 + 0.08 * Math.sin(d * 0.9 - ph * TAU * 4));
    };

    // the body: bands round a white core, a pulse running back down it every so often
    const N = Math.ceil(L / 2.5);
    for (let i = 0; i < N; i++) {
      const d0 = 0.2 + ((L + 2) * i) / N, d1 = 0.2 + ((L + 2) * (i + 1)) / N, wm = half((d0 + d1) / 2);
      q.beam(X(3 - d0), FLY, 0, X(3 - d1), FLY, 0, Math.max(1, wm * 2), (u, v) => {
        const d = d0 + (d1 - d0) * u, uu = d / (L + 3), pulse = (((d * 0.05 - ph * 3) % 1) + 1) % 1 < 0.12 ? 1 : 0;
        const lvl = v < 0.22 ? (uu < 0.6 ? 7 : 6) : v < 0.45 ? 6 - (uu > 0.5 ? 1 : 0) : v < 0.72 ? 4 : v <= 1 ? 3 : 2;
        return C[Math.min(7, lvl + (v < 0.72 ? pulse : 0))];
      });
    }
    // sparks spiralling round the body, a bright strand and a pale one; the body hides the far side of each turn
    for (const s of [0, Math.PI])
      for (let d = 2; d < L * 0.7; d += 1) {
        const a = d * 0.45 - ph * TAU * 3 + s, rr = half(d + 3) + 1.1;
        q.dot(X(-d), FLY + Math.sin(a) * rr, Math.cos(a) * rr, Math.cos(a) > 0.8 ? WHITE : C[6]);
      }
    // the shimmering tail: dashes shed off the bolt's end, wavering, flickering and cooling as they fall behind
    beat(t, D, 14, S, (r) => r.range(0.18, 0.3), (age, life, r) => {
      const k = age / life, x0 = -L * 0.8 - age * r.range(150, 230), len = r.range(3, 7) * (1 - k * 0.5), az = r.range(0, TAU), rad = 0.5 + k * 1.5 + r.range(0, 0.6);
      const w = Math.sin(x0 * 0.25 + ph * TAU * 2) * (0.5 + k * 1.5), y = FLY + Math.cos(az) * rad + w, z = Math.sin(az) * rad + Math.cos(x0 * 0.25 + ph * TAU * 2) * (0.5 + k * 1.5);
      if (x0 - len < left || rand(fr, r.int(0, 999)) < k * 0.5) return;
      q.line(X(x0), y, z, X(x0 - len), y, z, k < 0.3 ? C[5] : k < 0.6 ? C[4] : C[3]);
      if (k < 0.4) q.glow(X(x0 - len / 2), y, z, 4, C[4], 0.3 * (1 - k));
    });
    // the head's glint, flickering, and the light
    const g = 0.75 + 0.25 * Math.sin(ph * TAU * 2);
    q.at(X(1.5), FLY, 1.5, (pp) => sparkle(pp, 0, 0, 3 + Math.round(g * 2), C[6], C[4], 0.5));
    q.glowLine(X(1), FLY, 0, X(-L), FLY, 0, 9, C[3], 0.4);
    q.glow(X(-2), FLY, 0, 20, C[3], 0.5 * g);
    q.glow(X(1), FLY, 0, 6, WHITE, 0.25);
  },
};
