import { Rng, fit, clamp, ease, space, TAU } from "../../core/index.js";

export const meta = {
  name: "Impact frame",
  desc: "An anime impact: two frames of white with black burst lines rushing at the hit, two frames inverted, then the lines pull out past the edges and vanish.",
  tags: ["impact", "hit", "anime", "manga", "flash", "speed-lines", "screen", "one-shot"],
  size: [320, 180],
  origin: [160, 90],
  duration: 0.3,
  loop: false,
  fps: 30,
  bg: "black",
  options: { palette: ["#000000", "#ffffff"], lines: 64, seed: 19 },
};

const FRAME = 1 / 30; // the beats are whole frames: 2 white, 2 inverted, 4 pulling out

// burst lines: wedges aimed at the hit from past the edges, each its own width and reach, in angle order
function burst(R, n) {
  return Array.from({ length: n }, (_, i) => {
    const thick = R.chance(0.18);
    return { a: ((i + R.range(0.1, 0.9)) / n) * TAU, inner: thick ? R.range(30, 48) : R.range(18, 70), w: thick ? R.range(5, 8) : R.range(1.2, 3.6) };
  });
}

// the jagged burst at the middle: a spiky star whose points shift every frame
const spikes = (a, ph) => 10 + 6 * Math.abs(Math.sin(a * 5 + ph)) + 4 * Math.abs(Math.sin(a * 11 + ph * 2.7)) + 2 * Math.sin(a * 23 + ph);

export function create(o) {
  const C = fit(o.palette, 3), R = new Rng(o.seed), INK = C[0], PAPER = C[2];
  const [W, H] = meta.size, [OX, OY] = meta.origin, x0 = -OX, y0 = -OY;
  const sets = [burst(R, o.lines), burst(R, o.lines)], jit = [[Math.round(R.range(-2, 2)), Math.round(R.range(-1, 1))], [Math.round(R.range(-2, 2)), Math.round(R.range(-1, 1))]];
  const ph = [R.range(0, TAU), R.range(0, TAU), R.range(0, TAU), R.range(0, TAU)];
  // every frame is fixed, so work each one out once: which pixels are ink (1) or paper (2), 0 for nothing
  const masks = [];
  for (let f = 0; f < 8; f++) {
    const m = new Uint8Array(W * H), set = sets[f % 2], n = set.length, [jx, jy] = f < 4 ? jit[f % 2] : [0, 0];
    const reach = f < 4 ? 0 : Math.pow((f - 3) / 4.5, 1.5), thin = f < 4 ? 1 : 1 - (f - 3) / 5.5;
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const X = x0 + i + 0.5 - jx, Y = y0 + j + 0.5 - jy, rho = Math.hypot(X, Y * 1.35), ang = Math.atan2(Y * 1.35, X);
        const slot = Math.floor((((ang % TAU) + TAU) % TAU) / (TAU / n));
        let line = false;
        for (let k = -1; k <= 1 && !line; k++) {
          const l = set[(slot + k + n) % n];
          let d = (((ang - l.a) % TAU) + TAU) % TAU;
          if (d > Math.PI) d = TAU - d;
          const inner = l.inner + reach * 150, hw = l.w * clamp((rho - inner) / 40) * thin;
          line = rho > inner && d * rho < Math.max(0.5, hw);
        }
        if (f < 4) {
          const r2 = Math.hypot(X, Y * 1.1), core = spikes(Math.atan2(Y * 1.1, X), ph[f]) * (f === 0 ? 0.85 : 1 + f * 0.08);
          m[j * W + i] = r2 < core ? (r2 < 4 + f ? 2 : 1) : line ? 1 : 2;
        } else m[j * W + i] = line ? 2 : 0;
      }
    masks.push(m);
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
    },
    draw(p) {
      const f = Math.floor(t / FRAME + 1e-6);
      if (f >= 8) return;
      // two frames of ink on paper, two inverted, then paper lines pulling out over the scene
      const m = masks[f], inv = f === 2 || f === 3, ink = inv ? PAPER : INK, paper = inv ? INK : PAPER;
      p.shade(x0, y0, x0 + W, y0 + H, (x, y) => {
        const i = Math.floor(x - x0), j = Math.floor(y - y0);
        if (i < 0 || j < 0 || i >= W || j >= H) return;
        const v = m[j * W + i];
        return v === 1 ? ink : v === 2 ? (f < 4 ? paper : PAPER) : 0;
      });
    },
  };
}

// 3D, in the world and not on the screen: the hit is a spiky burst in the air and the burst lines are real wedges
// rushing at it from every direction (above, below, in front, behind), with a haze of paper or of ink round it.
// Two beats of ink on paper (a white haze, a black burst and black lines, each edged in white), two inverted, then the
// lines pull out through the volume, thinning, and vanish. Same fixed frames as the 2D one.
export const three = {
  meta: {
    size: [152, 152],
    origin: [76, 76],
    bg: "black",
    camera: { pitch: 0.3 },
    desc: "An anime impact in space: a spiky burst in a haze of paper, black lines rushing at it from every side, two frames inverted, then the lines pull out through the air and vanish.",
    tags: ["impact", "hit", "anime", "manga", "flash", "speed-lines", "3d", "one-shot"],
  },
  create(o) {
    const C = fit(o.palette, 3), R = new Rng(o.seed), INK = C[0], PAPER = C[2], ROUT = 66, N = o.lines * 0.7 | 0;
    // a spread of directions over the sphere, jittered
    const dirs = (n) => {
      const g0 = R.range(0, TAU);
      return Array.from({ length: n }, (_, i) => {
        const y = 1 - (2 * (i + R.range(0.15, 0.85))) / n, r = Math.sqrt(1 - y * y), g = g0 + i * 2.39996 + R.range(-0.2, 0.2);
        return [Math.cos(g) * r, y, Math.sin(g) * r];
      });
    };
    const burst = () =>
      dirs(N).map((d) => {
        const thick = R.chance(0.18);
        return { d, inner: (thick ? R.range(30, 48) : R.range(18, 70)) * 0.55, w: thick ? R.range(4, 6.5) : R.range(1.2, 3.2) };
      });
    const sets = [burst(), burst()];
    const jit = [[Math.round(R.range(-2, 2)), Math.round(R.range(-2, 2))], [Math.round(R.range(-2, 2)), Math.round(R.range(-2, 2))]];
    const ph = [R.range(0, TAU), R.range(0, TAU), R.range(0, TAU), R.range(0, TAU)];
    const cores = dirs(26);
    // the jagged burst: each spike as long as the 2D burst's outline is at that angle, which changes every frame
    const reach = (d, p) => {
      const a = Math.atan2(d[2], d[0]), e = Math.asin(d[1]);
      return 10 + 6 * Math.abs(Math.sin(a * 5 + p)) + 4 * Math.abs(Math.sin(e * 11 + p * 2.7)) + 2 * Math.sin(a * 23 + e * 7 + p);
    };
    const spike = (q, x, y, d, L, fill, rim) => {
      const n = Math.max(2, Math.ceil(L / 3));
      for (let i = 0; i < n; i++) {
        const f0 = i / n, f1 = (i + 1) / n, wd = Math.max(1.6, 7 * (1 - (f0 + f1) / 2)), vr = 1 - 1 / (wd / 2), a = 3 + (L - 3) * f0, b = 3 + (L - 3) * f1;
        q.beam(x + d[0] * a, y + d[1] * a, d[2] * a, x + d[0] * b, y + d[1] * b, d[2] * b, wd, (u, v) => (v > vr ? rim : fill));
      }
    };
    // a speed line: a point at from, fattest a little over half way, thinning again into the distance
    const streak = (q, x, y, d, from, L, W, fill, rim) => {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const f0 = i / n, f1 = (i + 1) / n, fm = (f0 + f1) / 2, prof = fm < 0.55 ? fm / 0.55 : 1 - ((fm - 0.55) / 0.45) * 0.85, wd = Math.max(1.6, W * prof + 1.8), vr = 1 - 0.9 / (wd / 2);
        q.beam(x + d[0] * (from + L * f0), y + d[1] * (from + L * f0), d[2] * (from + L * f0), x + d[0] * (from + L * f1), y + d[1] * (from + L * f1), d[2] * (from + L * f1), wd, (u, v) => (v > vr ? rim : fill));
      }
    };
    let t = 0;
    return {
      update(dt) {
        t += dt;
      },
      draw(p) {
        const f = Math.floor(t / FRAME + 1e-6);
        if (f >= 8) return;
        const q = space(p, o), set = sets[f % 2], inv = f === 2 || f === 3;
        const [jx, jy] = f < 4 ? jit[f % 2] : [0, 0];
        const pull = f < 4 ? 0 : Math.pow((f - 3) / 4.5, 1.5), thin = f < 4 ? 1 : 1 - (f - 3) / 5.5;
        // ink lines (or paper lines when inverted, and on the way out), each edged in the other colour
        const fill = f >= 4 ? PAPER : inv ? PAPER : INK, rim = f >= 4 ? PAPER : inv ? INK : PAPER;
        // the haze, behind the burst: paper round an ink burst, ink round a paper one
        if (f === 2 || f === 3) q.disc(0, 0, 0, 60, INK, (d) => 0.3 * (1 - d * d * 0.6));
        else if (f < 4) q.disc(0, 0, 0, 60, PAPER, (d) => 0.42 * (1 - d * d * 0.5));
        for (const l of set) {
          const inner = l.inner + pull * 150 * 0.55, L = ROUT - inner;
          if (L < 2) continue;
          streak(q, jx, jy, l.d, inner, L, l.w * 2 * thin, fill, rim);
        }
        if (f < 4) {
          // the burst and its bright heart
          const sc = f === 0 ? 0.85 : 1 + f * 0.08, p0 = ph[f];
          for (const d of cores) spike(q, jx, jy, d, reach(d, p0) * sc, fill, rim);
          const r = 4 + f;
          q.ball(jx, jy, 0, r, (nx, ny) => (Math.hypot(nx, ny) > 0.85 ? fill : rim));
        }
      },
    };
  },
};
