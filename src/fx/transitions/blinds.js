// The dust drifting in the light and the light squeezing through follow Sprite Fusion's open-source holy light
// (https://www.spritefusion.com/pixel-art-vfx/holy-light), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, P, Rng, fit, hex, mix, clamp, ease, space, TAU, WHITE } from "../../core/index.js";
import { W, H, screenMeta, clipTo, glint, glint3, poly, rect } from "./_lib.js";

export const meta = screenMeta({
  name: "Blinds",
  desc: "Slats catch the light edge-on, then tilt shut top to bottom, lit rims glinting as warm light squeezes through the closing gaps with dust in it; then they tilt open and fade.",
  tags: ["blinds", "slats", "light", "wipe"],
  duration: 2.0,
  options: { palette: ["#1a120c", "#33241a", "#5a4030", "#8a6848", "#c09a6a", "#e8cc98", "#fff0cc", "#ffffff"], seed: 1 },
});

const N = 12, SH = H / N, SHUT0 = 0.08, OPEN0 = 1.02, STEP = 0.038, TURN = 0.42, OSTEP = 0.03, OTURN = 0.4, FADE0 = 1.72, FADE1 = 1.94;

// how far slat i has turned: 0 edge-on, π/2 flat and shut (a little past while it settles)
function angle(i, t) {
  if (t < OPEN0) return (Math.PI / 2) * ease.outBack(clamp((t - SHUT0 - i * STEP) / TURN), 1.6);
  return (Math.PI / 2) * (1 - ease.inOutCubic(clamp((t - OPEN0 - i * OSTEP) / OTURN)));
}

export function create(o) {
  const C = fit(o.palette, 8), ink = hex(o.color), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [WHITE, C[6], C[5], C[4]] });
  let t = 0;
  const end = meta.duration - 0.05;
  return {
    update(dt) {
      t += dt;
      // dust drifts in the light coming through
      if (t < FADE0 && R.chance(0.8)) {
        const i = R.int(0, N - 1), th = angle(i, t);
        if (th > 0.2 && th < 1.45) ps.spawn(P.EMBER, R.range(0, W), (i + 1) * SH + R.range(-2, 2), R.range(-8, 8), -R.range(2, 8), Math.min(R.range(0.5, 1), end - t), 0, 1);
      }
      ps.update(dt);
    },
    draw(p0) {
      const p = clipTo(p0), open = new Uint8Array(H).fill(1);
      for (let i = 0; i < N; i++) {
        const h = Math.max(1, (SH + 1) * Math.abs(Math.sin(angle(i, t)))), yc = (i + 0.5) * SH;
        for (let y = Math.max(0, Math.ceil(yc - h / 2 - 0.5)); y <= Math.min(H - 1, Math.floor(yc + h / 2 - 0.5)); y++) open[y] = 0;
      }
      // the dust is behind the slats: it only shows (and only shines) in the gaps
      for (const q of ps.list) {
        const y = Math.floor(q.y), k = q.life / q.max;
        if (q.delay > 0 || y < 0 || y >= H || !open[y] || q.x < 0 || q.x >= W) continue;
        // some catch the light as little twinkling crosses
        const tw = (q.seed % 1) < 0.3 && Math.sin(t * 14 + q.seed) > 0;
        p0.px(q.x, y, tw || k > 0.5 ? WHITE : C[5]);
        if (tw) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (open[y + dy]) p.px(q.x + dx, y + dy, C[6]);
        p0.light(q.x, y, C[6], (tw ? 0.7 : 0.4) * k);
      }
      const fade = 1 - clamp((t - FADE0) / (FADE1 - FADE0)), appear = clamp(t / SHUT0);
      for (let i = 0; i < N; i++) {
        const th = angle(i, t), s = Math.sin(th), c = Math.cos(th), yc = (i + 0.5) * SH;
        const h = Math.max(1, (SH + 1) * Math.abs(s)), y0 = Math.max(0, Math.ceil(yc - h / 2 - 0.5)), y1 = Math.min(H - 1, Math.floor(yc + h / 2 - 0.5));
        const under = th > Math.PI / 2; // turned past flat: the shadowed underside shows
        // edge-on, the slat is just its lit edge: it brightens in at the start and fades out at the end
        if (h < 2.5) {
          const k = Math.min(appear, fade);
          if (k <= 0) continue;
          const yy = Math.round(yc - 0.5);
          rect(p0, 0, yy, W, 1, k > 0.66 ? C[6] : k > 0.33 ? C[4] : C[2]);
          if (h >= 1.5 && yy + 1 < H) rect(p0, 0, yy + 1, W, 1, k > 0.5 ? C[3] : C[1]);
          for (let x = 0; x < W; x += 2) p0.light(x, yy, C[5], 0.18 * k);
          continue;
        }
        // tilted: a lit top rim, a sheen, a face that darkens as it turns flat to us, a shadowed underside
        const lit = under ? 0 : c;
        for (let y = y0; y <= y1; y++) {
          // the face is lit from above: brightest just under the rim, falling away down it
          const r = y - y0, last = y === y1, v = r / Math.max(1, y1 - y0), f = lit * (1 - v * 0.8);
          const col = r === 0 ? (lit > 0.55 ? WHITE : lit > 0.3 ? C[6] : lit > 0.12 ? C[4] : ink)
            : r === 1 ? (lit > 0.45 ? C[5] : lit > 0.2 ? C[3] : ink)
              : last ? ink
                : f > 0.55 ? C[3] : f > 0.35 ? C[2] : f > 0.15 ? C[1] : ink;
          rect(p0, 0, y, W, 1, col);
          if (r === 0 && lit > 0.12) for (let x = 0; x < W; x += 2) p0.light(x, y, C[5], 0.35 * lit);
        }
        // light squeezes through the gap under the slat, brighter as the gap narrows
        const gap = SH - h;
        if (gap > 0.5 && th > 0.12 && !under) {
          const k = (0.2 + 0.45 * (1 - gap / SH) ** 1.5) * Math.min(1, th / 0.4), gy = y1 + 1;
          for (let y = gy; y < Math.min(H, gy + Math.ceil(gap)); y++) {
            const v = (y - gy + 0.5) / gap, kk = k * (1 - Math.abs(v - 0.5) * 1.2);
            if (kk > 0.01) for (let x = 0; x < W; x += 1) p0.light(x, y, C[6], kk), p0.light(x, y, C[4], kk * 0.5);
          }
        }
        // a glint runs along the lit rim as the slat turns
        const u = t < OPEN0 ? clamp((t - SHUT0 - i * STEP) / TURN) : clamp((t - OPEN0 - i * OSTEP) / OTURN);
        if (lit > 0.3 && u > 0.05 && u < 0.95) glint(p, W * (t < OPEN0 ? u : 1 - u), y0, 6 * Math.sin(Math.PI * u), u * 3, C[6], C[5]);
      }
    },
  };
}

// 3D: a louvred cage. Eight panels of slats stand round the stage in an octagon (posts at the corners, a rail on top),
// every slat hinged on its own axis. They catch the light edge-on, then tilt shut top to bottom, lit rims glinting
// as warm light squeezes through the closing gaps with dust drifting in it inside; then they tilt open and fade.
const SP3 = 6, A3 = 52, TIP = A3 / Math.cos(Math.PI / 8), PW = 2 * A3 * Math.tan(Math.PI / 8), HT = N * SP3;
const PANELS = Array.from({ length: 8 }, (_, k) => {
  const a = Math.PI / 2 + (k * Math.PI) / 4;
  return { nx: Math.cos(a), nz: Math.sin(a), tx: -Math.sin(a), tz: Math.cos(a), lit: 0.5 + 0.5 * Math.max(0, -0.6 * Math.cos(a) + 0.8 * Math.sin(a)) };
});

export const three = {
  meta: { size: [144, 124], origin: [72, 100], bg: "ground", camera: { pitch: 0.34 } },
  create(o) {
    const C = fit(o.palette, 8), ink = hex(o.color), R = new Rng(o.seed), IRON = [C[1], C[2], C[3]], EDGE = mix(ink, C[1], 0.7);
    const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] });
    let t = 0;
    const end = meta.duration - 0.05, yOf = (i) => -(N - i - 0.5) * SP3;
    return {
      update(dt) {
        t += dt;
        // dust drifts in the light coming through
        if (t < FADE0 && R.chance(0.8)) {
          const i = R.int(0, N - 1), th = angle(i, t);
          if (th > 0.2 && th < 1.45) {
            const a = R.range(0, TAU), d = Math.sqrt(R.next()) * (A3 - 8);
            ps.spawn3(P.EMBER, Math.cos(a) * d, yOf(i) + SP3 / 2 + R.range(-1, 1), Math.sin(a) * d, R.range(-5, 5), -R.range(1, 4), R.range(-5, 5), Math.min(R.range(0.5, 1), end - t), 0, 1);
          }
        }
        ps.update(dt);
      },
      draw(p) {
        const q = space(p, o), fade = 1 - clamp((t - FADE0) / (FADE1 - FADE0)), appear = clamp(t / SHUT0), al = Math.min(fade, appear);
        if (al <= 0) return;
        // the frame: posts at the corners, a rail round the top, a plinth round the foot
        for (let k = 0; k < 8; k++) {
          const a = Math.PI / 2 + (k * Math.PI) / 4 + Math.PI / 8, x = Math.cos(a) * TIP, z = Math.sin(a) * TIP;
          q.beam(x, 1, z, x, -HT - 2, z, 2.6, (u, v) => (v > 0.6 ? IRON[0] : u < 0.5 ? IRON[2] : IRON[1]), al);
        }
        const ring = (y, r, c, w) => q.ring(0, y, 0, r, w, c, al);
        ring(-HT - 2, TIP + 1.5, IRON[1], 2);
        ring(-HT - 3, TIP + 1.5, IRON[2], 1);
        ring(0, TIP + 1.5, IRON[0], 3);
        // the slats
        const open = [];
        for (let i = 0; i < N; i++) {
          const th = angle(i, t), s = Math.sin(th), c = Math.cos(th), under = th > Math.PI / 2, yc = yOf(i);
          const u = t < OPEN0 ? clamp((t - SHUT0 - i * STEP) / TURN) : clamp((t - OPEN0 - i * OSTEP) / OTURN);
          for (let k = 0; k < 8; k++) {
            const Pn = PANELS[k], lit = under ? 0 : c * Pn.lit, cx = Pn.nx * A3, cz = Pn.nz * A3;
            // the slat's width runs from its inner top rim, up and in, to its outer lower rim; edge-on it lies along the normal
            const hw = (SP3 + 1) / 2, wx = Pn.nx * c, wy = s, wz = Pn.nz * c, tw = (PW - 0.5) / 2;
            const A = [cx + Pn.tx * tw - wx * hw, yc - wy * hw, cz + Pn.tz * tw - wz * hw], B = [cx - Pn.tx * tw - wx * hw, yc - wy * hw, cz - Pn.tz * tw - wz * hw];
            const Cc = [cx - Pn.tx * tw + wx * hw, yc + wy * hw, cz - Pn.tz * tw + wz * hw], D = [cx + Pn.tx * tw + wx * hw, yc + wy * hw, cz + Pn.tz * tw + wz * hw];
            poly(q, [A, B, Cc, D], (x, y, z) => {
              // v: 0 at the lit top rim, 1 at the lower one
              const v = (((x - cx) * wx + (y - yc) * wy + (z - cz) * wz) / hw) * 0.5 + 0.5;
              const f = lit * (1 - v * 0.8);
              return v < 0.14 ? (lit > 0.55 ? WHITE : lit > 0.3 ? C[6] : lit > 0.12 ? C[4] : EDGE)
                : v < 0.3 ? (lit > 0.45 ? C[5] : lit > 0.2 ? C[3] : ink)
                  : v > 0.9 ? ink
                    : f > 0.55 ? C[3] : f > 0.35 ? C[2] : f > 0.15 ? C[1] : ink;
            }, al);
            // light squeezes through the gap under the slat, brighter as it narrows
            const gap = SP3 - (SP3 + 1) * Math.abs(s);
            if (gap > 0.5 && th > 0.12 && !under && al > 0.5) {
              const kk = (0.2 + 0.45 * (1 - gap / SP3) ** 1.5) * Math.min(1, th / 0.4) * 0.5;
              q.glowLine(A[0], A[1] + SP3 / 2, A[2], B[0], B[1] + SP3 / 2, B[2], 4, C[6], kk);
            }
            // a glint runs along the lit rim as the slat turns, one panel at a time
            if (k === i % 8 && lit > 0.3 && u > 0.05 && u < 0.95) open.push([A[0] + (B[0] - A[0]) * (t < OPEN0 ? u : 1 - u), A[1], A[2] + (B[2] - A[2]) * (t < OPEN0 ? u : 1 - u), 4 * Math.sin(Math.PI * u), u * 3]);
          }
        }
        // inside: a column of light, a pool on the floor, the dust in it; shown only through the gaps
        const lightK = al * Math.min(1, t / 0.3);
        q.glowLine(0, -2, 0, 0, -HT + 2, 0, 20, C[5], 0.12 * lightK);
        q.glow(0, -2, 0, 40, C[5], 0.18 * lightK);
        for (const e of ps.list) {
          const k = e.life / e.max, tw = e.seed % 1 < 0.3 && Math.sin(t * 14 + e.seed) > 0;
          q.at(e.x, e.y, e.z, (pp) => {
            pp.px(0, 0, tw || k > 0.5 ? WHITE : C[5]);
            if (tw) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pp.px(dx, dy, C[6]);
          });
          q.glow(e.x, e.y, e.z, 4, C[6], (tw ? 0.7 : 0.4) * k * 0.5);
        }
        for (const [x, y, z, L, ang] of open) glint3(q, x, y, z, L, ang, C[6], C[5]);
      },
    };
  },
};
