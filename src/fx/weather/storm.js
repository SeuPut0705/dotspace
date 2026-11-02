// The bolt (a branching path, a stepped leader, strokes that flicker frame by frame, light along the channel) and
// the rain (streaks with lit heads, splashes that throw droplets) are adapted from Sprite Fusion's open-source
// lightning (https://www.spritefusion.com/pixel-art-vfx/lightning), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, P, Rng, fit, clamp, smooth, rand, wrap, TAU, WHITE, hex, mix, scale, space } from "../../core/index.js";
import { clip, pass, box, field, sample, trips, tree, wave, bayer, splash, splash3 } from "./_lib.js";

export const meta = {
  name: "Storm",
  desc: "Driving rain at two depths under a churning cloud deck; a forked bolt strikes in a double flash that lights the sky and the rain, then sheet lightning glows in the clouds.",
  tags: ["weather", "storm", "rain", "lightning", "thunder", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#09080f", "#121120", "#1b1a30", "#262541", "#363a5c", "#4f5d8c", "#7790c6", "#c2d6ff"],
    bolt: ["#2a1a6e", "#4835c2", "#6a6cff", "#78b8ff", "#c6ebff", "#ffffff"],
    seed: 5,
  },
};

const D = 10, SLANT = 0.42;
// the strike: a stepped leader feels its way down, the first stroke, a restrike down the same channel
const T_LEAD = 2.62, T1 = 3.0, T2 = 3.3, T_SHEET = 6.4, T_FAR = 8.6;
const BX0 = 62, BY0 = -136, BX1 = 52, BY1 = 3;
const F1 = [1, 0.62, 0.95, 0.4, 0.7, 0.22], F2 = [0.92, 0.5, 0.8, 0.3, 0.12];
const env = (t, t0, E) => {
  const i = Math.floor((t - t0) * 30 + 1e-3);
  return i >= 0 && i < E.length ? E[i] : 0;
};
const flashAt = (t) => Math.max(env(t, T1, F1), env(t, T2, F2));

// sheet lightning: light that swells inside the clouds with no bolt to see, twice; and a far flicker
function sheetAt(t) {
  const a = t - T_SHEET;
  if (a < 0 || a > 0.9) return 0;
  const p1 = Math.exp(-(((a - 0.08) / 0.05) ** 2)), p2 = Math.exp(-(((a - 0.3) / 0.09) ** 2)), tail = a > 0.3 ? Math.exp(-(a - 0.3) * 6) * 0.5 : 0;
  return Math.min(1, 0.7 * p1 + p2 + tail) * (Math.floor(a * 30) % 3 === 1 ? 0.75 : 1);
}
const blink = (a, k) => (a < 0 || a > 0.3 ? 0 : k * (Math.exp(-(((a - 0.06) / 0.04) ** 2)) + 0.65 * Math.exp(-(((a - 0.18) / 0.05) ** 2))));
const farAt = (t) => blink(t - T_FAR, 0.45), far2At = (t) => blink(t - 0.9, 0.3);

// times are snapped so a runtime's accumulated float time (2.9999999) lands on the frame it means
const snap = (t) => Math.round(t * 3e4) / 3e4;

export function drawBack(p, t, o) {
  t = snap(t);
  const q = clip(p, meta), B = box(meta), S = o.seed, C = fit(o.palette, 8), V = fit(o.bolt, 6);
  const f = flashAt(t), sh = sheetAt(t), far = farAt(t), lead = t > T_LEAD && t < T1 ? 0.25 + 0.2 * Math.sin(t * 70) : 0;
  const pre = t > T_LEAD - 0.5 && t < T_LEAD ? 0.12 * Math.max(0, Math.sin((t - T_LEAD) * 41)) : 0;
  // what lights the clouds from inside: the bolt's root, the sheet lightning, the far flicker
  const srcs = [];
  if (f + lead + pre > 0) srcs.push([BX0, BY0 - 6, 150, f + lead * 0.5 + pre]);
  if (sh > 0) srcs.push([-96, -146, 120, sh]);
  if (far > 0) srcs.push([128, -156, 80, far]);
  if (far2At(t) > 0) srcs.push([-40, -160, 70, far2At(t)]);
  const litAt = (x, y) => {
    let L = 0;
    for (const [sx, sy, R, k] of srcs) {
      const d = Math.hypot(x - sx, (y - sy) * 1.5) / R;
      if (d < 1) L += k * (1 - d) * (1 - d);
    }
    return Math.min(1, L);
  };
  sky(p, t, f, V);
  if (sh > 0.05) pass(p, meta, -170, 0, (x, y, out) => {
    const d = Math.hypot(x + 96, (y + 150) * 1.3) / 170;
    if (d < 1) (out.l = V[2]), (out.k = sh * 0.3 * (1 - d) * (1 - d));
  });
  veil(p, t, S, C, V, f);
  // far rain behind the bolt; the bolt's root disappears up into the cloud
  rain(q, t, S, C, V, f, 0);
  if (t > T_LEAD && t < T2 + 0.7) bolt(q, t, S, V);
  deck(q, B, t, S, C, V, litAt, srcs.length > 0);
  crawler(q, t, S, V);
  floor(q, B, t, S, C, V, f);
  strike(q, t, S, C, V);
}

export function draw(p, t, o) {
  t = snap(t);
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8), V = fit(o.bolt, 6), f = flashAt(t);
  rain(q, t, S, C, V, f, 1);
}

// the whole sky lights up with each stroke, most near the bolt
function sky(p, t, f, V) {
  const k = f * 0.36;
  if (k <= 0.01) return;
  const c = mix(V[2], V[3], 0.6);
  pass(p, meta, -170, 9, (x, y, out) => {
    const d = Math.abs(x - (BX0 + BX1) / 2) / 230;
    out.l = c;
    out.k = k * (0.2 + 0.8 * Math.max(0, 1 - d) ** 2.2);
  });
}

// the cloud deck, seen from below in perspective: rows of rolls, the nearest and biggest at the top, each row
// further off hanging a little lower, smaller and hazier. Every roll swells, drifts on the wind and dissolves on
// its own clock (born once a loop), so the underside churns with no seam. Each row's lower edge catches a 1 px
// rim of light and throws a line of shadow on the row behind it.
const ROWS = [
  { base: -161, wob: 3, n: 18, rx: [16, 30], ry: 0.8, drift: 15, life: [4, 7], tone: [1, 2, 3, 4], tex: 1 },
  { base: -150, wob: 3, n: 22, rx: [10, 20], ry: 0.85, drift: 10, life: [3.5, 6.5], tone: [1, 2, 3, 5], tex: 1 },
  { base: -140, wob: 3, n: 26, rx: [7, 14], ry: 0.9, drift: 6, life: [3, 6], tone: [2, 2, 3, 5], tex: 0, haze: true },
];
// the storm cell hangs lowest over the strike
const sag = (x) => 9 * Math.exp(-(((x - 40) / 95) ** 2)) - 3;
// each roll pushes down out of its row, drifts on the wind and draws back up, on its own clock (born once a loop)
function rolls(S, t) {
  return ROWS.map((Rw, j) => {
    const out = [];
    for (let i = 0; i < Rw.n; i++) {
      const L = Rw.life[0] + rand(S, j, i, 1) * (Rw.life[1] - Rw.life[0]), age = wrap(t - rand(S, j, i, 2) * D, D);
      if (age >= L) continue;
      const u = age / L, g = Math.sin(Math.PI * u) ** 0.6;
      const rx = Rw.rx[0] + rand(S, j, i, 3) * (Rw.rx[1] - Rw.rx[0]), ry = rx * Rw.ry, x = -200 + rand(S, j, i, 4) * 400 + Rw.drift * (age - L / 2);
      out.push({ x, h: ry * g * (0.6 + 0.4 * rand(S, j, i, 5)), rx: rx * (0.8 + 0.2 * g) });
    }
    return out;
  });
}
// sheets of rain sweeping across on the gusts: a translucent haze, streaked along the rain, that hides the stars
// and catches the flash where it's thickest
function veil(p, t, S, C, V, f) {
  const F = field(S + 11, 256, 128, [4, 8, 16]), shift = (256 * 2 * t) / D, glow = mix(C[3], V[3], 0.5);
  pass(p, meta, -170, -0.5, (x, y, out) => {
    const n = sample(F, (x - y * SLANT) * 1.9 - shift, y * 0.16 + 7), dens = clamp(0.45 + (n - 0.5) * 2.6);
    out.c = f > 0.05 ? mix(C[1], glow, Math.min(1, f * dens * 0.7 * Math.max(0.25, 1 - Math.abs(x - BX1) / 220))) : C[1];
    out.a = 0.4 + 0.38 * dens;
    out.b = 1;
  });
}

function deck(q, B, t, S, C, V, litAt, lit) {
  const R = rolls(S, t), F = field(S * 3 + 1, 256, 128), drift = (256 * t) / D, n = ROWS.length, mo = Math.cos((Math.PI * t) / D) ** 2;
  const RAMP = [C[0], C[1], C[2], C[3], C[4], C[5], C[6], V[4], WHITE];
  const top = new Float32Array(n), bot = new Float32Array(n), bulge = new Float32Array(n);
  for (let x = B.x0; x < B.x1; x++) {
    const cx = x + 0.5;
    let low = -170;
    // each row hangs as a curtain: a wavy base with rolls bulging out of it
    for (let j = 0; j < n; j++) {
      const Rw = ROWS[j];
      const und = (sample(F, cx * 0.55 + j * 91, 3) * mo + sample(F, cx * 0.55 + j * 91, 60) * (1 - mo) - 0.5) * 2;
      const c = Rw.base + sag(cx) * (0.4 + j * 0.3) + 7 * und + Rw.wob * 2 * (sample(F, cx * 1.8 + j * 61 - drift * (0.5 - j * 0.1), 20 + j * 17) - 0.5);
      let bump = 0;
      for (const b of R[j]) {
        const dx = (cx - b.x) / b.rx;
        if (dx * dx < 1) bump = Math.max(bump, b.h * Math.sqrt(1 - dx * dx));
      }
      const y1 = c + bump;
      top[j] = -999;
      bot[j] = y1;
      bulge[j] = bump;
      low = Math.max(low, y1);
    }
    let prev = -1, prevBot = -999;
    for (let y = B.y0; y < low; y++) {
      const cy = y + 0.5;
      let j = 0;
      while (j < n && !(cy >= top[j] && cy < bot[j])) j++;
      if (j >= n) {
        prev = -1;
        continue;
      }
      if (j !== prev) {
        if (prev >= 0 && prev < j) prevBot = cy;
        prev = j;
      }
      const Rw = ROWS[j], d = bot[j] - cy, tone = Rw.tone, th = bayer(x, y);
      // light catches the lower edge of each row, most on the big bulges, and fades up into a dark core
      let i;
      if (d < 1) i = bulge[j] > 3 ? tone[3] : tone[3] - 1;
      else if (cy - prevBot < 1.5 && j > 0) i = Math.max(0, tone[0] - 1); // shadow under the row in front
      else if (d < 2 + bulge[j] * 0.25 + th * 2) i = tone[2];
      else if (d < 6 + bulge[j] * 0.4 + th * 3) i = tone[1];
      else {
        const nn = sample(F, cx * 0.9 + j * 77 - drift * (0.6 - j * 0.12), cy * 1.7 + j * 31);
        i = tone[0] + (Rw.tex && nn > 0.6 ? 1 : 0);
      }
      let lk = 0;
      if (lit) {
        const Lv = litAt(cx, cy);
        if (Lv > 0.02) {
          i = Math.min(8, i + Math.round(Lv * (d < 1 ? 4.4 : d < 4 ? 3.8 : 3.1)));
          lk = Lv;
        }
      }
      if (Rw.haze && !lk && d >= 1) q.blend(x, y, RAMP[i], 0.75);
      else q.px(x, y, RAMP[Math.max(0, i)]);
      if (lk > 0.03) q.light(x, y, V[3], lk * (d < 3 ? 0.4 : 0.22));
    }
  }
}

// the rain: far drops thin and dim, near drops long with bright heads; the flash lights every drop
function rain(q, t, S, C, V, f, near) {
  const litAt = (x) => {
    const L = f * (0.3 + 0.7 * Math.max(0, 1 - Math.abs(x - BX1) / 170));
    return L > 0.45 ? 2 : L > 0.15 ? 1 : 0;
  };
  if (!near) {
    const BODY = [C[4], C[4], C[5]], HEAD = [C[5], C[6], C[6]];
    trips(t, D, 300, S * 7 + 1, 22, 28, (u, k, m, i) => {
      const j = wrap(k, m), stop = -14 - rand(S, i, j, 1) * 90, y = -176 + (stop + 176) * u, x = -170 + rand(S, i, j, 2) * 360 - (stop - y) * SLANT;
      const L = 3 + rand(S, i, j, 3) * 2, ux = SLANT / Math.hypot(SLANT, 1), uy = 1 / Math.hypot(SLANT, 1), lit = litAt(x), body = BODY[lit], head = HEAD[lit];
      q.line(x - ux * L, y - uy * L, x - ux * L * 0.4, y - uy * L * 0.4, body);
      q.line(x - ux * L * 0.4, y - uy * L * 0.4, x, y, head);
    });
    return;
  }
  const BODY = [C[6], C[6], V[4]], HEAD = [C[7], WHITE, WHITE], TAIL = [C[4], C[5], V[3]];
  trips(t, D, 84, S * 7 + 2, 30, 38, (u, k, m, i) => {
    const j = wrap(k, m), z = 1 + rand(S, i, j, 1) * 4, y = -180 + (z + 180) * u, x = -175 + rand(S, i, j, 2) * 370 - (z - y) * SLANT;
    const L = 9 + rand(S, i, j, 3) * 5, ux = SLANT / Math.hypot(SLANT, 1), uy = 1 / Math.hypot(SLANT, 1), lit = litAt(x), body = BODY[lit], head = HEAD[lit], tail = TAIL[lit];
    q.line(x - ux * L, y - uy * L, x - ux * L * 0.55, y - uy * L * 0.55, tail);
    q.line(x - ux * L * 0.55, y - uy * L * 0.55, x - ux, y - uy, body);
    q.px(x, y, head);
    // the drop before this one landed: splash
    const dur = D / m, age = u * dur;
    if (age < 0.4) {
      const jp = wrap(k - 1, m), zp = 1 + rand(S, i, jp, 1) * 4, xp = -175 + rand(S, i, jp, 2) * 370;
      const lit = litAt(xp);
      splash(q, xp, zp, age, 0.25 + (zp - 1) / 5.3, { hot: lit ? WHITE : C[7], cool: [C[5], C[6], V[4]][lit] }, rand(S, i, jp, 4));
    }
  });
}

// the channel: a jagged trunk, three long forks peeling off it (alternating sides), each with twigs of its own
function channel(S) {
  const R = new Rng(S * 31 + 1), P = tree(R, BX0, BY0, BX1, BY1, 0.26, 0.18), pts = P[0].pts, side = R.sign();
  [0.2, 0.38, 0.55].forEach((u, i) => {
    const k = Math.floor(u * (pts.length - 1)), [ax, ay] = pts[k], [bx, by] = pts[Math.min(pts.length - 1, k + 3)];
    const a = Math.atan2(by - ay, bx - ax) + (i % 2 ? -side : side) * R.range(0.6, 1.0), l = R.range(36, 56) * (1 - u * 0.45);
    P.push(...tree(R, ax, ay, ax + Math.cos(a) * l, ay + Math.sin(a) * l, 0.3, 0.5, 0.6, 1));
  });
  return P;
}

function bolt(q, t, S, V) {
  const P1 = channel(S);
  if (t < T1) {
    const reach = BY0 + (BY1 - BY0) * Math.pow(Math.floor(((t - T_LEAD) / (T1 - T_LEAD)) * 9) / 9, 1.25);
    for (const p of P1)
      for (let i = 0; i < p.pts.length - 1; i++) {
        const [ax, ay] = p.pts[i], [bx, by] = p.pts[i + 1];
        if (by > reach) break;
        q.line(ax, ay, bx, by, p.w >= 1 ? V[2] : V[1]);
        if (i % 4 === 0) q.glow(ax, ay, 6, V[3], 0.22 * p.w);
      }
    return;
  }
  // the restrike runs down the same channel, with fewer, shorter forks
  const P2 = [P1[0], ...tree(new Rng(S * 31 + 2), BX0, BY0, BX1, BY1, 0.3, 0.3).slice(1).filter((_, i) => i < 2)];
  const s = t >= T2 ? 2 : 1, a = t - (s === 2 ? T2 : T1), k = env(t, s === 2 ? T2 : T1, s === 2 ? F2 : F1), paths = s === 2 ? P2 : P1;
  if (k > 0) stroke(q, paths, k, V);
  else if (a < 0.5) {
    const g = 1 - a / 0.5;
    for (const p of paths) if (p.w >= 1) for (const [x, y] of p.pts) q.dot(x, y, V[1], g * 0.9);
  }
}

// spider lightning crawling along the cloud base while the sheet lightning glows: drawn a frame at a time, the
// crawl reaching a little further each frame, then gone
function crawler(q, t, S, V) {
  const a = t - T_SHEET - 0.22;
  if (a < 0 || a > 0.17) return;
  const P = tree(new Rng(S * 7 + 3), -150, -138, -26, -134, 0.2, 0.7), reach = -150 + 130 * Math.min(1, (Math.floor(a * 30) + 1) / 3), k = a < 0.1 ? 1 : 0.5;
  for (const p of P)
    for (let i = 0; i < p.pts.length - 1; i++) {
      const [ax, ay] = p.pts[i], [bx, by] = p.pts[i + 1];
      if (ax > reach) break;
      q.line(ax, ay, bx, by, p.w >= 1 && k > 0.6 ? V[4] : V[3]);
      if (p.w >= 1) q.dot(ax, ay + 1, V[2], k);
      if (i % 3 === 0) q.glow(ax, ay, 10, V[3], 0.35 * k * p.w);
    }
}

// a stroke: a violet sheath, a pale blue body, a white-hot core (two pixels wide at the peak), light all along
function stroke(q, paths, k, V) {
  for (const pass of [0, 1, 2])
    for (const p of paths) {
      const trunk = p.w >= 1;
      if (!trunk && (k < 0.4 || (pass === 0 && p.w < 0.5))) continue;
      for (let i = 0; i < p.pts.length - 1; i++) {
        const [ax, ay] = p.pts[i], [bx, by] = p.pts[i + 1], l = Math.max(1, Math.hypot(bx - ax, by - ay));
        for (let d = 0; d <= l; d += 0.5) {
          const x = ax + ((bx - ax) * d) / l, y = ay + ((by - ay) * d) / l;
          if (pass === 0) q.circle(x, y, trunk ? (k > 0.6 ? 2.3 : 1.7) : 1.2, k > 0.6 ? V[2] : V[1]);
          else if (pass === 1) q.circle(x, y, trunk ? (k > 0.6 ? 1.4 : 0.9) : 0.6, trunk ? V[4] : V[3]);
          else if (trunk) {
            q.px(x, y, k > 0.3 ? WHITE : V[4]);
            if (k > 0.85) q.px(x + 1, y, WHITE);
          } else if (p.w > 0.4 && k > 0.6) q.px(x, y, V[4]);
        }
        if (pass === 0 && i % 3 === 0) q.glow(ax, ay, trunk ? 18 : 8, V[3], (trunk ? 0.5 : 0.3) * k * p.w);
      }
    }
}

// where the bolt lands: a blinding hit, sparks that skip off the wet floor, steam, a glow that cools
function strike(q, t, S, C, V) {
  const a = t - T1;
  if (a < 0 || a > 1.8) return; // the last spray is gone by 1.6 s
  const k = flashAt(t);
  if (k > 0) {
    // arcs skitter out along the wet floor, new ones every frame
    const fr = Math.floor(t * 30 + 1e-3), Rc = new Rng(S * 977 + fr);
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1, l = Rc.range(10, 30) * (0.6 + 0.4 * k);
      for (const p of tree(Rc, BX1 + side, BY1 - 1, BX1 + side * l, BY1 + Rc.range(-2, 3), 0.35, 0.5, 0.6, 1)) {
        q.polyline(p.pts, k > 0.6 && p.w > 0.5 ? V[4] : V[3]);
        q.glow(p.pts[p.pts.length >> 1][0], p.pts[p.pts.length >> 1][1], 8, V[3], 0.3 * k);
      }
    }
    q.circle(BX1, BY1 - 1, 2 + 3 * k, V[4]);
    q.circle(BX1, BY1 - 1, 1 + 2 * k, WHITE);
    q.glow(BX1, BY1 - 12, 95, V[2], 0.55 * k);
    q.glow(BX1, BY1 - 4, 40, V[3], 0.5 * k);
    q.glow(BX1, BY1 - 2, 14, WHITE, 0.6 * k);
  }
  const ps = new Particles({ rng: new Rng(S * 13 + 5), ground: () => 4, sparks: [WHITE, V[4], V[3], V[2]], haze: V[2] }), R = ps.R, steam = mix(C[4], V[3], 0.3);
  const burst = (n, pow) => {
    for (let i = 0; i < n; i++) {
      const an = -Math.PI / 2 + R.range(-1.35, 1.35), sp = R.range(110, 420) * pow;
      ps.spawn(P.SPARK, BX1, BY1 - 1, Math.cos(an) * sp, Math.sin(an) * sp, R.range(0.18, 0.6));
    }
    // a skirt of spray and steam blown out along the floor
    for (let i = 0; i < 6 * pow; i++) {
      const sd = R.sign();
      ps.spawn(P.VAPOUR, BX1 + sd * R.range(2, 8), BY1 - R.range(1, 3), sd * R.range(30, 90), -R.range(4, 16), R.range(0.6, 1.2), steam, R.range(2.5, 4.5), R.range(0, 0.08));
    }
  };
  burst(48, 1);
  let tt = 0, second = false;
  for (const dt = 1 / 120; tt + dt <= a; tt += dt) {
    if (!second && tt >= T2 - T1) (second = true), burst(16, 0.7);
    ps.update(dt);
  }
  ps.draw(q);
  if (a < 1.6) q.glow(BX1, BY1, 16, V[2], 0.4 * (1 - a / 1.6) ** 2);
}

// the wet floor: a dark sheen, a broken lip of light, pools that reflect the sky and flash with it, mist kicked
// up by the rain drifting along the ground
function floor(q, B, t, S, C, V, f) {
  const F = field(S + 3, 256, 128), M = field(S + 4, 256, 128, [4, 8, 16]), wind = (256 * 3 * t) / D;
  pass(q, meta, -14, -0.5, (x, y, out) => {
    const m = sample(M, x * 1.1 - wind, y * 4 + 9) - 0.4;
    if (m <= 0) return;
    out.c = f > 0.1 ? mix(C[4], V[3], f) : C[4];
    out.a = Math.min(0.3, m * 0.9) * (1 + y / 14);
    out.b = 1;
  });
  pass(q, meta, 0, 9, (x, y, out) => {
    const pool = (yy) => sample(F, x * 1.3 + 31, yy * 9) > 0.6 - yy * 0.006;
    const wet = pool(y), lip = wet && !pool(y - 1);
    out.b = 1;
    out.c = C[1];
    out.a = 0.5;
    if (y < 1) {
      out.c = sample(F, x * 2, 50) > 0.5 ? C[4] : C[3];
      out.a = 1;
      out.b = 0;
    } else if (wet) {
      const d = Math.abs(x - BX1) / 150;
      if (f > 0.06) {
        out.c = (d < 0.25 && f > 0.5) || lip ? V[4] : V[3];
        out.a = clamp(f * (1.35 - d) * (lip ? 1.4 : 1));
        out.b = 0;
      } else {
        out.c = lip ? C[5] : C[3];
        out.a = lip ? 1 : 0.7;
      }
      out.l = V[3];
      out.k = f * 0.25 * Math.max(0, 1 - d);
    }
  });
  // the bolt's reflection in the pools, broken by ripples
  if (f > 0.2) for (let y = 1; y < 10; y++) if (rand(y, Math.floor(t * 30), 3) < 0.8) q.dot(BX1 + Math.sin(y * 1.7 + t * 40) * 1.2, y, y < 4 ? WHITE : V[4], f * (1.1 - y / 12));
}

// ---- 3D: a cylinder of storm (radius R3, height H3, origin at the floor's center). The rain falls through it from a
// cloud canopy that rolls overhead; the bolt is a real path in x, y and z whose forks reach towards and away from
// the viewer; the strike lights the floor, the rain, the pools and the canopy, and the thunder keeps the 2D timing.
const R3 = 96, H3 = 112, BK = 0.8, XS = 16, ZS = 12, SL3 = 0.42;
const edge3 = (x, z, r = R3) => clamp((r - 5 - Math.sqrt(x * x + z * z)) / 14);
// the 2D bolt's (x, y) in the volume: the same shape, 0.8 the size, a weaving z that forks follow by where they are
function lift(x2, y2) {
  const x = XS + (x2 - BX1) * BK, y = (y2 - BY1) * BK, xl = XS + (-y / (-(BY0 - BY1) * BK)) * (BX0 - BX1) * BK;
  return [x, y, ZS + 18 * (Math.sin(0.07 * y + 0.9) - Math.sin(0.9)) + 0.7 * (x - xl) + 5 * Math.sin(0.23 * x + 0.31 * y) - 5 * Math.sin(0.23 * XS)];
}
const HIT = lift(BX1, BY1), ROOT = lift(BX0, BY0);
const lifted = (paths) => paths.map((pp) => ({ w: pp.w, pts2: pp.pts, pts: pp.pts.map(([x, y]) => lift(x, y)) }));
const litAt3 = (f, x, z) => {
  const L = f * (0.3 + 0.7 * Math.max(0, 1 - Math.hypot(x - HIT[0], z - HIT[2]) / 150));
  return L > 0.45 ? 2 : L > 0.15 ? 1 : 0;
};

// the rain: far drops thin and dim, near drops long with bright heads that splash on the floor; the flash lights every drop
function rain3(q, t, S, C, V, f, near) {
  const ux = SL3 / Math.hypot(SL3, 1), uy = 1 / Math.hypot(SL3, 1), sd = S * 7 + 1 + near;
  const at = (i, j) => {
    const g = rand(sd, i, j, 6) * TAU, r = (R3 - 12) * Math.sqrt(rand(sd, i, j, 2));
    return [Math.cos(g) * r, Math.sin(g) * r];
  };
  const BODY = near ? [C[6], C[6], V[4]] : [C[4], C[4], C[5]], HEAD = near ? [C[7], WHITE, WHITE] : [C[5], C[6], C[6]], TAIL = [C[4], C[5], V[3]];
  trips(t, D, near ? 72 : 300, sd, near ? 40 : 30, near ? 48 : 38, (u, k, m, i) => {
    const j = wrap(k, m), [xm, zm] = at(i, j), L = near ? 9 + rand(sd, i, j, 3) * 5 : 3 + rand(sd, i, j, 3) * 2, y = (-H3 - L) * (1 - u);
    const x = xm - (-H3 / 2 - y) * SL3, fa = edge3(x, zm) * smooth(-H3, -H3 + 16, y);
    if (fa > 0.02) {
      const dk = clamp((q.depth(x, y, zm) + R3) / (2 * R3)), a = fa * (1 - 0.5 * dk), lit = litAt3(f, x, zm);
      if (near) {
        q.line(x - ux * L, y - uy * L, zm, x - ux * L * 0.55, y - uy * L * 0.55, zm, TAIL[lit], a);
        q.line(x - ux * L * 0.55, y - uy * L * 0.55, zm, x - ux, y - uy, zm, BODY[lit], a);
        q.dot(x, y, zm, HEAD[lit], a);
      } else {
        q.line(x - ux * L, y - uy * L, zm, x - ux * L * 0.4, y - uy * L * 0.4, zm, BODY[lit], a);
        q.line(x - ux * L * 0.4, y - uy * L * 0.4, zm, x, y, zm, HEAD[lit], a);
      }
    }
    if (!near) return;
    // the drops before this one landed: splash
    const dur = D / m;
    for (let back = 1; back < 4; back++) {
      const age = u * dur + (back - 1) * dur;
      if (age > 0.4) break;
      const jp = wrap(k - back, m), [xp0, zp] = at(i, jp), xp = xp0 + (H3 / 2) * SL3, fl = edge3(xp, zp), lit = litAt3(f, xp, zp);
      if (fl > 0.02) splash3(q, xp, zp, age, 0.25 + rand(sd, i, jp, 8) * 0.65, { hot: lit ? WHITE : C[7], cool: [C[5], C[6], V[4]][lit] }, rand(sd, i, jp, 4), fl);
    }
  });
}

// the bolt, drawn as in 2D a stroke at a time, but each point of the channel sits in space
function leader3(q, t, P1, V) {
  const reach = BY0 + (BY1 - BY0) * Math.pow(Math.floor(((t - T_LEAD) / (T1 - T_LEAD)) * 9) / 9, 1.25);
  for (const p of P1)
    for (let i = 0; i < p.pts.length - 1; i++) {
      if (p.pts2[i + 1][1] > reach) break;
      q.line(...p.pts[i], ...p.pts[i + 1], p.w >= 1 ? V[2] : V[1]);
      if (i % 4 === 0) q.glow(...p.pts[i], 6, V[3], 0.22 * p.w);
    }
}

// a stroke: a violet sheath, a pale blue body, a white-hot core (two pixels wide at the peak), light all along
function stroke3(q, paths, k, V) {
  for (const pass of [0, 1, 2])
    for (const p of paths) {
      const trunk = p.w >= 1;
      if (!trunk && (k < 0.4 || (pass === 0 && p.w < 0.5))) continue;
      for (let i = 0; i < p.pts.length - 1; i++) {
        const A = p.pts[i], B = p.pts[i + 1], l = Math.max(1, Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]));
        for (let d = 0; d <= l; d += 0.6) {
          const s = d / l;
          q.at(A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s, A[2] + (B[2] - A[2]) * s, (pp) => {
            if (pass === 0) pp.circle(0, 0, trunk ? (k > 0.6 ? 2.3 : 1.7) : 1.2, k > 0.6 ? V[2] : V[1]);
            else if (pass === 1) pp.circle(0, 0, trunk ? (k > 0.6 ? 1.4 : 0.9) : 0.6, trunk ? V[4] : V[3]);
            else if (trunk) {
              pp.px(0, 0, k > 0.3 ? WHITE : V[4]);
              if (k > 0.85) pp.px(1, 0, WHITE);
            } else if (p.w > 0.4 && k > 0.6) pp.px(0, 0, V[4]);
          });
        }
        if (pass === 0 && i % 3 === 0) q.glow(...A, trunk ? 18 : 8, V[3], (trunk ? 0.5 : 0.3) * k * p.w);
      }
    }
}

function bolt3(q, t, S, V) {
  const P1 = lifted(channel(S));
  if (t < T1) return leader3(q, t, P1, V);
  // the restrike runs down the same channel, with fewer, shorter forks
  const P2 = [P1[0], ...lifted(tree(new Rng(S * 31 + 2), BX0, BY0, BX1, BY1, 0.3, 0.3).slice(1).filter((_, i) => i < 2))];
  const s = t >= T2 ? 2 : 1, a = t - (s === 2 ? T2 : T1), k = env(t, s === 2 ? T2 : T1, s === 2 ? F2 : F1), paths = s === 2 ? P2 : P1;
  if (k > 0) stroke3(q, paths, k, V);
  else if (a < 0.5) {
    const g = 1 - a / 0.5;
    for (const p of paths) if (p.w >= 1) for (const [x, y, z] of p.pts) q.dot(x, y, z, V[1], g * 0.9);
  }
}

// spider lightning crawling along the underside of the canopy while the sheet lightning glows, a little further each frame
function crawler3(q, t, S, V) {
  const a = t - T_SHEET - 0.22;
  if (a < 0 || a > 0.17) return;
  const Q = tree(new Rng(S * 7 + 3), -150, -138, -26, -134, 0.2, 0.7), reach = -150 + 130 * Math.min(1, (Math.floor(a * 30) + 1) / 3), k = a < 0.1 ? 1 : 0.5;
  const to = ([x, y]) => [(x + 88) * 0.85, -H3 + 8, (y + 136) * 2.5 - 25];
  for (const p of Q)
    for (let i = 0; i < p.pts.length - 1; i++) {
      if (p.pts[i][0] > reach) break;
      const A = to(p.pts[i]), B = to(p.pts[i + 1]);
      q.line(...A, ...B, p.w >= 1 && k > 0.6 ? V[4] : V[3]);
      if (p.w >= 1) q.dot(A[0], A[1] + 1, A[2], V[2], k);
      if (i % 3 === 0) q.glow(...A, 10, V[3], 0.35 * k * p.w);
    }
}

// where the bolt lands: a blinding hit, arcs skittering along the wet floor, sparks, steam, a glow that cools
function strike3(q, t, S, C, V) {
  const a = t - T1;
  if (a < 0 || a > 1.8) return;
  const k = flashAt(t), [hx, , hz] = HIT;
  if (k > 0) {
    const fr = Math.floor(t * 30 + 1e-3), Rc = new Rng(S * 977 + fr);
    for (let i = 0; i < 5; i++) {
      const phi = (i / 5) * TAU + Rc.range(-0.5, 0.5), l = Rc.range(14, 34) * (0.6 + 0.4 * k), cs = Math.cos(phi), sn = Math.sin(phi);
      for (const p of tree(Rc, 0, 0, l, Rc.range(-3, 3), 0.35, 0.5, 0.6, 1)) {
        const pts = p.pts.map(([x, y]) => [hx + x * cs - y * sn, -0.8, hz + x * sn + y * cs]);
        q.polyline(pts, k > 0.6 && p.w > 0.5 ? V[4] : V[3]);
        const m = pts[pts.length >> 1];
        q.glow(m[0], -1, m[2], 8, V[3], 0.3 * k);
      }
    }
    q.ball(hx, -1, hz, 2 + 3 * k, V[4]);
    q.ball(hx, -1, hz, 1 + 2 * k, WHITE);
    q.glow(hx, -12, hz, 95, V[2], 0.55 * k);
    q.glow(hx, -4, hz, 40, V[3], 0.5 * k);
    q.glow(hx, -2, hz, 14, WHITE, 0.6 * k);
  }
  const ps = new Particles({ rng: new Rng(S * 13 + 5), ground: () => 0, sparks: [WHITE, V[4], V[3], V[2]], haze: V[2] }), R = ps.R, steam = mix(C[4], V[3], 0.3);
  const burst = (n, pow) => {
    for (let i = 0; i < n; i++) {
      const phi = R.range(0, TAU), off = R.range(0, 1.3), sp = R.range(100, 340) * pow, h = Math.sin(off) * sp;
      ps.spawn3(P.SPARK, hx, -1, hz, Math.cos(phi) * h, -Math.cos(off) * sp, Math.sin(phi) * h, R.range(0.18, 0.6));
    }
    // a skirt of spray and steam blown out along the floor
    for (let i = 0; i < 8 * pow; i++) {
      const phi = R.range(0, TAU), c = Math.cos(phi), s = Math.sin(phi), v = R.range(30, 90);
      ps.spawn3(P.VAPOUR, hx + c * R.range(2, 8), -R.range(1, 3), hz + s * R.range(2, 8), c * v, -R.range(4, 16), s * v, R.range(0.6, 1.2), steam, R.range(2.5, 4.5), R.range(0, 0.08));
    }
  };
  burst(60, 1);
  let tt = 0, second = false;
  for (const dt = 1 / 120; tt + dt <= a; tt += dt) {
    if (!second && tt >= T2 - T1) (second = true), burst(20, 0.7);
    ps.update(dt);
  }
  ps.draw(q);
  if (a < 1.6) q.glow(hx, -3, hz, 16, V[2], 0.4 * (1 - a / 1.6) ** 2);
}

// pools on the wet floor: they hold the sky, and flash with it
function pools3(S) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = rand(S, i, 64) * TAU, d = (R3 - 30) * Math.sqrt(rand(S, i, 65));
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, r: 9 + rand(S, i, 63) * 10, sx: 1 + rand(S, i, 66) * 0.7 };
  });
}
function floor3(q, t, S, C, V, f) {
  const F = field(S + 3, 256, 128), P = pools3(S), [hx, , hz] = HIT;
  q.plane(0, 0, 0, null, R3 + 1, (u, v, o) => {
    const d = Math.hypot(u, v) / R3;
    if (d > 1) return;
    if (d > 0.975) return void ((o.c = d > 0.99 ? C[3] : C[4]), (o.l = V[3]), (o.k = 0.04 + f * 0.2));
    const wet = sample(F, u * 1.2 + 31, v * 1.2 + 9), near = Math.hypot(u - hx, v - hz) / 150;
    o.c = wet > 0.55 ? C[2] : C[1];
    o.a = 0.5 + 0.3 * smooth(0.5, 0.95, wet);
    o.blend = true;
    if (f > 0.04) (o.l = V[3]), (o.k = f * 0.28 * Math.max(0, 1 - near) ** 2);
  });
  for (const pp of P)
    q.plane(pp.x, 0, pp.z, null, pp.r * pp.sx + 1, (u, v, o) => {
      const d = Math.hypot(u / pp.sx, v);
      if (d > pp.r) return;
      const rim = d > pp.r - 1.6, near = Math.hypot(pp.x + u - hx, pp.z + v - hz) / 150, g = clamp(f * (1.35 - near));
      o.c = g > 0.06 ? mix(C[4], rim || (g > 0.7 && d < pp.r * 0.35) ? V[4] : V[3], 0.45 + 0.55 * g) : rim ? C[5] : d < pp.r * 0.5 ? C[4] : C[3];
      o.l = V[3];
      o.k = g * 0.25;
    });
}

// the cloud canopy over the volume: two rolling layers of cloud, lit from inside by every flash
function canopy3(q, t, S, C, V, lights) {
  const F = field(S * 3 + 1, 256, 128), RAMP = [C[0], C[1], C[2], C[3], C[4], C[5], C[6], V[4], WHITE];
  const litAt = (x, z) => {
    let L = 0;
    for (const [sx, sz, R, k] of lights) {
      const d = Math.hypot(x - sx, z - sz) / R;
      if (d < 1) L += k * (1 - d) * (1 - d);
    }
    return Math.min(1, L);
  };
  [[-H3 + 6, 0.9, 0], [-H3 - 3, 0.65, 1]].forEach(([y, base, up]) => {
    const shift = (256 * (1 + up) * t) / D;
    q.plane(0, y, 0, null, R3, (u, v, o) => {
      const d = Math.hypot(u, v) / R3;
      if (d > 1) return;
      const U = u * 1.7 + shift + up * 77, W = v * 1.7 + 20 + up * 33, n = sample(F, U, W), a = clamp((n - 0.33) * 3.6) * (1 - smooth(0.78, 1, d)) * base;
      if (a < 0.04) return;
      const gx = sample(F, U - 1.2, W - 1.2) - n, L = litAt(u, v);
      o.c = RAMP[Math.min(8, 2 + (n > 0.5 ? 1 : 0) + (gx > 0.008 ? 1 : 0) + (gx > 0.03 ? 1 : 0) + Math.round(L * 3.8))];
      o.a = a;
      o.blend = true;
      if (L > 0.03) (o.l = V[3]), (o.k = L * 0.3);
    });
  });
}

// mist kicked up by the rain, drifting low along the ground, tinted by the flash
const RM = 76;
function mist3(q, t, S, C, V, f) {
  const items = [], tint = f > 0.05 ? mix(C[4], V[3], f) : C[4];
  for (let i = 0; i < 14; i++) {
    const z = (rand(S, i, 81) * 2 - 1) * (RM - 12), half = Math.sqrt(RM * RM - z * z), g = (rand(S, i, 82) + (3 * t) / D) % 1;
    items.push({ x: half * (1 - 2 * g), y: -(3 + rand(S, i, 83) * 7), z, r: 9 + rand(S, i, 84) * 8, a: Math.sin(Math.PI * g) });
  }
  for (const m of q.sort(items, (e) => [e.x, e.y, e.z]))
    q.disc(m.x, m.y, m.z, m.r, (d, g) => (g < -0.4 && d > 0.45 ? tint : mix(C[3], tint, 0.4)), (d) => (1 - d) ** 1.2 * 0.5 * m.a * edge3(m.x, m.z, RM + 4));
}

export const three = {
  meta: { size: [224, 180], origin: [112, 144], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    t = snap(t);
    const q = space(p, o), S = o.seed, C = fit(o.palette, 8), V = fit(o.bolt, 6), f = flashAt(t), sh = sheetAt(t), far = farAt(t);
    const lead = t > T_LEAD && t < T1 ? 0.25 + 0.2 * Math.sin(t * 70) : 0, pre = t > T_LEAD - 0.5 && t < T_LEAD ? 0.12 * Math.max(0, Math.sin((t - T_LEAD) * 41)) : 0;
    const Lc = f + lead * 0.5 + pre, lights = [];
    if (Lc > 0) lights.push([ROOT[0], ROOT[2], 150, Lc]);
    if (sh > 0) lights.push([-45, -30, 120, sh]);
    if (far > 0) lights.push([50, -50, 80, far]);
    if (far2At(t) > 0) lights.push([-10, 55, 70, far2At(t)]);
    floor3(q, t, S, C, V, f);
    rain3(q, t, S, C, V, f, 0);
    rain3(q, t, S, C, V, f, 1);
    if (t > T_LEAD && t < T2 + 0.7) bolt3(q, t, S, V);
    crawler3(q, t, S, V);
    strike3(q, t, S, C, V);
    for (const [x, z, R, k] of lights) q.glow(x, -H3 + 10, z, R * 0.7, V[2], 0.3 * Math.min(1, k));
    canopy3(q, t, S, C, V, lights);
    mist3(q, t, S, C, V, f);
  },
};
