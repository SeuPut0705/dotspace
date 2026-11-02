// Particles and bands that pass behind and in front of a centre (dim far half drawn back, bright near half
// drawn front) follow the recipe in Sprite Fusion's open-source black hole
// (https://www.spritefusion.com/pixel-art-vfx/black-hole), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, cycle, clamp, rand, TAU, WHITE, mix, space } from "../../core/index.js";
import { cone3 } from "./_lib.js";

export const meta = {
  name: "Blizzard vortex",
  desc: "A swirling snow tornado: wind bands spin up a leaning funnel, flakes and ice crystals orbit in front and behind, snow boils at its foot and cold light fills its throat.",
  tags: ["ice", "snow", "blizzard", "tornado", "vortex", "wind", "loop"],
  size: [128, 116],
  origin: [64, 102],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"], height: 80, seed: 17 },
};

const TILT = 0.24; // how flat the funnel's rings look

// the funnel: radius by height (narrow foot, wide mouth) and an axis that sways (one full sway a loop)
const radius = (h, H) => 4 + 28 * Math.pow(clamp(h / H), 1.35);
const axis = (h, H, ph) => (5 * Math.sin(TAU * ph + h * 0.05) + 1.5 * Math.sin(TAU * ph * 2 - h * 0.11)) * (h / H) - 2 * (h / H);

// wind streaks: arcs of snow-laden air swirling round the funnel and climbing it, a bright head and a fading
// tail, faster low down; the far half of each arc goes behind, the near half in front
function streaks(p, C, t, o, front) {
  const D = meta.duration, H = o.height, ph = t / D;
  cycle(t, D, 58, o.seed + 9, (g) => g.range(0.5, 0.9), (age, life, r) => {
    const h0 = r.range(2, H), w = r.range(8, 12) * (1.45 - h0 / H), th = r.range(0, TAU) + age * w, k = age / life;
    const fade = Math.min(1, age / 0.08) * (k > 0.7 ? (1 - k) / 0.3 : 1), L = r.range(0.7, 1.5), m = Math.ceil(L / 0.07);
    for (let j = 0; j <= m; j++) {
      const a = th - j * 0.07, s = Math.sin(a);
      if (s >= 0 !== front) continue;
      const h = Math.min(H + 4, h0 + age * 16 - j * 0.25), R = radius(Math.min(h, H), H) * (1 + Math.min(0.3, Math.max(0, h - H * 0.84) * 0.03)), u = j / m;
      const x = axis(Math.min(h, H), H, ph) + Math.cos(a) * R, y = -h + s * R * TILT;
      const c = front ? (u < 0.15 ? WHITE : u < 0.5 ? C[6] : C[5]) : u < 0.3 ? C[5] : u < 0.6 ? C[4] : C[3];
      p.dot(x, y, c, fade * (u < 0.6 ? 1 : 1.5 - u * 1.2) * (front ? 1 : 0.85));
    }
  });
}

// the body: a translucent column of snow-filled air, densest at the edges where you look through more of it
function body(p, C, ph, H) {
  p.each(-44, -H - 6, 44, 2, (x, y, sx, sy) => {
    const h = -y;
    if (h < 0 || h > H + 4) return;
    const R = radius(h, H), dx = x - axis(h, H, ph), u = dx / R;
    if (u * u >= 1) return;
    const k = h / H, rim = Math.pow(Math.abs(u), 3), swirl = Math.sin(Math.asin(u) * 3 - TAU * ph * 2 + h * 0.2) * 0.5 + 0.5;
    const a = (0.07 + 0.24 * rim + 0.12 * swirl) * clamp((1 - Math.abs(u)) / 0.18) * (k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1) * (h < 4 ? h / 4 : 1);
    if (a < 0.03) return;
    p.blendPx(sx, sy, rim > 0.5 ? C[6] : swirl > 0.6 ? C[5] : C[4], a);
    if (rim > 0.3 || swirl > 0.75) p.add(sx, sy, C[5], 0.16 * Math.max(rim, swirl - 0.5) * (1 - k * 0.5));
  });
}

// snow and ice carried round: rising on a spiral, faster low down, flung out at the top
function orbiters(p, C, t, o, front) {
  const D = meta.duration, H = o.height, ph = t / D;
  cycle(t, D, 76, o.seed, (g) => g.range(0.9, 1.6), (age, life, r, i) => {
    const h0 = r.range(0, H * 0.6), h = h0 + age * r.range(14, 30), k = age / life;
    if (h > H + 8) return;
    const w = r.range(7, 11) * (1.5 - h / H), th = r.range(0, TAU) + age * w, out = 1 + r.range(0.05, 0.3) + Math.min(0.35, Math.max(0, h - H * 0.82) * 0.04);
    const R = radius(Math.min(h, H), H) * out, s = Math.sin(th);
    if (s >= 0 !== front) return;
    const x = axis(Math.min(h, H), H, ph) + Math.cos(th) * R, y = -h + s * R * TILT, big = i % 5 === 0;
    const fade = Math.min(1, age / 0.1) * (k > 0.8 ? (1 - k) / 0.2 : 1);
    if (fade <= 0) return;
    // a streak back along its path, a bright head
    const th2 = th - 0.25, x2 = axis(Math.min(h, H), H, ph) + Math.cos(th2) * R, y2 = -h + 2 + Math.sin(th2) * R * TILT;
    if (front) {
      p.line(x2, y2, x, y, (u) => (u > 0.6 ? C[6] : C[4]), (u) => u * fade);
      p.dot(x, y, big ? WHITE : r.chance(0.5) ? WHITE : C[6], fade);
      if (big) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.dot(x + dx, y + dy, C[6], fade);
        p.glow(x, y, 5, C[5], 0.35 * fade);
      }
    } else {
      p.line(x2, y2, x, y, C[3], (u) => u * fade * 0.8);
      p.dot(x, y, big ? C[5] : C[4], fade);
    }
  });
}

// snow boiling at the foot: soft puffs spinning round the base, lit on top
function foot(p, C, t, o, front) {
  const D = meta.duration, ph = t / D;
  cycle(t, D, 12, o.seed + 5, (g) => g.range(0.8, 1.2), (age, life, r) => {
    const th = r.range(0, TAU) + age * r.range(4, 6), R = 9 + age * r.range(8, 16), s = Math.sin(th), k = age / life;
    if (s >= 0 !== front) return;
    const x = axis(0, 1, ph) + Math.cos(th) * R, y = -2 - age * r.range(4, 10) + s * R * 0.2, rad = 2 + 4 * k, a = 0.5 * (1 - k) ** 1.2 * Math.min(1, age / 0.1);
    p.disc(x, y, rad, front ? C[6] : C[5], (d) => a * (1 - d * d));
    p.disc(x - rad * 0.25, y - rad * 0.3, rad * 0.5, WHITE, (d) => a * 0.5 * (1 - d * d) * (1 - k));
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), H = o.height, ph = t / meta.duration;
  // a snow drift on the floor, swept round
  for (let x = -30; x <= 30; x++) {
    const d = Math.abs(x) / 30, hgt = Math.round((1 - d * d) * (1.5 + rand(x, 3) * 1.5));
    for (let j = 0; j < hgt; j++) p.px(x, -j, j === hgt - 1 ? WHITE : C[5]);
    p.dot(x, 0, C[6], 1 - d * 0.5);
    p.dot(x, 1, C[4], 0.8 - d * 0.6);
  }
  p.glow(0, -2, 40, C[4], 0.22);
  foot(p, C, t, o, false);
  streaks(p, C, t, o, false);
  orbiters(p, C, t, o, false);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), H = o.height, ph = t / meta.duration;
  body(p, C, ph, H);
  // cold light in its throat
  p.glow(axis(H * 0.45, H, ph), -H * 0.45, 40, C[4], 0.3);
  p.glow(axis(H * 0.15, H, ph), -H * 0.15, 18, C[5], 0.4 + 0.1 * Math.sin(TAU * ph * 4));
  p.glow(axis(H * 0.05, H, ph), -3, 10, WHITE, 0.3);
  streaks(p, C, t, o, true);
  orbiters(p, C, t, o, true);
  foot(p, C, t, o, true);
  // snow thrown off the mouth, spreading into a thin cloud
  cycle(t, meta.duration, 10, o.seed + 3, (g) => g.range(0.9, 1.3), (age, life, r) => {
    const th = r.range(0, TAU), R = radius(H, H) * (0.6 + age * 0.9), k = age / life, rad = 3 + 6 * k;
    const Rc = Math.min(R, 36), x = axis(H, H, ph) + Math.cos(th) * Rc, y = -H - 2 - age * 4 + Math.sin(th) * Rc * TILT, a = 0.24 * (1 - k) * Math.min(1, age / 0.15);
    p.disc(x, y, rad * 0.8, C[6], (d) => a * (1 - d * d));
    p.glow(x, y, rad * 1.5, C[4], 0.08 * (1 - k));
  });
}

// 3D: the same funnel round a vertical axis that sways in x and z. Wind streaks and flakes are real helices that
// climb it (the depth buffer puts each side in front or behind), the body is a lattice of translucent points on
// the funnel's wall so the far wall shows through the near, snow boils on the floor in a true circle and is
// thrown off the mouth in a ring, cold light fills the throat and pools on the floor.
const azis = (h, H, ph) => (5 * Math.cos(TAU * ph + h * 0.05) + 1.5 * Math.cos(TAU * ph * 2 - h * 0.11)) * (h / H);

export const three = {
  meta: { size: [132, 130], origin: [66, 114], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), H = o.height, D = meta.duration, ph = t / D;
    const cx = (h) => axis(Math.min(h, H), H, ph), cz = (h) => azis(Math.min(h, H), H, ph);
    const Dw = [q.cp * q.sy, -q.sp, q.cp * q.cy]; // from the funnel towards the camera, in the world
    const face = (a) => q.view(Math.cos(a), 0, Math.sin(a)); // a point round the axis: [right, down, towards the viewer]

    // snow lying round the foot: a swept drift in a true circle, swirling with the wind
    q.plane(0, 0, 0, null, 38, (u, v, out) => {
      const r = Math.hypot(u, v) / 38;
      if (r > 1) return;
      const a = Math.atan2(v, u), sw = 0.5 + 0.5 * Math.sin(a * 3 + r * 6 - TAU * ph * 2), d = (1 - r * r) * (0.45 + 0.6 * sw);
      const h = rand(Math.floor(u / 1.4), Math.floor(v / 1.4), 3);
      out.blend = true;
      if (h < d * 0.9) {
        out.c = h < d * 0.25 ? WHITE : h < d * 0.55 ? C[6] : C[5];
        out.a = 0.55 + 0.4 * (1 - r);
      } else if (r < 0.85) {
        out.c = C[4];
        out.a = 0.22 * (1 - r);
      }
    });

    // wind streaks: helices of snow-laden air climbing the funnel, a bright head and a fading tail
    cycle(t, D, 58, o.seed + 9, (g) => g.range(0.5, 0.9), (age, life, r) => {
      const h0 = r.range(2, H), w = r.range(8, 12) * (1.45 - h0 / H), th = r.range(0, TAU) + age * w, k = age / life;
      const fade = Math.min(1, age / 0.08) * (k > 0.7 ? (1 - k) / 0.3 : 1), L = r.range(0.7, 1.5), m = Math.ceil(L / 0.1);
      let prev = null;
      for (let j = 0; j <= m; j++) {
        const a = th - j * 0.1, h = Math.min(H + 4, h0 + age * 16 - j * 0.35), R = radius(Math.min(h, H), H) * (1 + Math.min(0.3, Math.max(0, h - H * 0.84) * 0.03)), u = j / m;
        const front = face(a)[2] >= 0, pt = [cx(h) + Math.cos(a) * R, -h, cz(h) + Math.sin(a) * R];
        const c = front ? (u < 0.15 ? WHITE : u < 0.5 ? C[6] : C[5]) : u < 0.3 ? C[5] : u < 0.6 ? C[4] : C[3];
        const al = fade * (u < 0.6 ? 1 : 1.5 - u * 1.2) * (front ? 1 : 0.85);
        if (prev) q.line(...prev, ...pt, c, al);
        prev = pt;
      }
    });

    // snow and ice carried round on a spiral; the big ones are little tumbling shards with a glint
    cycle(t, D, 76, o.seed, (g) => g.range(0.9, 1.6), (age, life, r, i) => {
      const h0 = r.range(0, H * 0.6), h = h0 + age * r.range(14, 30), k = age / life;
      if (h > H + 8) return;
      const w = r.range(7, 11) * (1.5 - h / H), th = r.range(0, TAU) + age * w, out = 1 + r.range(0.05, 0.3) + Math.min(0.35, Math.max(0, h - H * 0.82) * 0.04);
      const R = radius(Math.min(h, H), H) * out, big = i % 5 === 0, fade = Math.min(1, age / 0.1) * (k > 0.8 ? (1 - k) / 0.2 : 1);
      if (fade <= 0) return;
      const at = (a) => [cx(h) + Math.cos(a) * R, -h + (th - a) * 0.8, cz(h) + Math.sin(a) * R];
      const [x, y, z] = at(th), front = face(th)[2] >= 0, white = r.chance(0.5);
      const [x2, y2, z2] = at(th - 0.25);
      q.line(x2, y2, z2, x, y, z, front ? (u) => (u > 0.6 ? C[6] : C[4]) : C[3], front ? (u) => u * fade : (u) => u * fade * 0.8);
      if (big) {
        const tn = [-Math.sin(th), -0.2, Math.cos(th)], tum = age * 7 + i;
        const e = [tn[0] * 2.6 * Math.cos(tum) , tn[1] * 2.6 + Math.sin(tum) * 1.2, tn[2] * 2.6 * Math.cos(tum)];
        cone3(q, [x, y, z], [x + e[0], y + e[1], z + e[2]], 1.1, 0, C, { sides: 4, a: fade });
        cone3(q, [x, y, z], [x - e[0], y - e[1], z - e[2]], 1.1, 0, C, { sides: 4, a: fade });
        q.at(x, y, z, (pp, kk) => {
          pp.z -= 1.5;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pp.dot(dx, dy, C[6], fade * 0.9);
        });
      } else q.dot(x, y, z, front ? (white ? WHITE : C[6]) : C[4], fade);
    });

    // light: the throat and a pool on the floor
    q.glow(cx(H * 0.45), -H * 0.45, cz(H * 0.45), 40, C[4], 0.3);
    q.glow(cx(H * 0.15), -H * 0.15, cz(H * 0.15), 18, C[5], 0.4 + 0.1 * Math.sin(TAU * ph * 4));
    q.glow(cx(H * 0.05), -3, cz(H * 0.05), 10, WHITE, 0.3);
    q.glow(0, -2, 0, 40, C[4], 0.22);

    // everything translucent, far to near: the two halves of the wall, boiling puffs at the foot and the mouth
    const T = [];
    const body = (frontHalf) => {
      const HS = 0.95;
      for (let h = 1; h <= H + 3; h += HS) {
        const k = h / H, R = radius(Math.min(h, H), H), x0 = cx(h), z0 = cz(h), n = Math.ceil((TAU * R) / HS), top = k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1, bot = h < 4 ? h / 4 : 1;
        if (top <= 0) continue;
        const off = rand(Math.floor(h * 10), 5, 7) * TAU;
        for (let i = 0; i < n; i++) {
          const a = ((i + rand(i, Math.floor(h * 10), 9) * 0.8) / n) * TAU + off, v = face(a), nz = v[2];
          if (nz >= 0 !== frontHalf) continue;
          const rim = Math.pow(Math.abs(v[0]), 3), swirl = Math.sin(a * 3 - TAU * ph * 2 + h * 0.2) * 0.5 + 0.5;
          const al = (0.07 + 0.22 * rim + 0.12 * swirl) * (0.4 + 0.6 * Math.abs(nz)) * Math.max(top, 0.3 * top ** 0.5) * bot;
          if (al < 0.02) continue;
          const x = x0 + Math.cos(a) * R, z = z0 + Math.sin(a) * R;
          q.blend(x, -h, z, rim > 0.5 ? C[6] : swirl > 0.6 ? C[5] : C[4], al);
          if (rim > 0.3 || swirl > 0.75) q.light(x, -h, z, C[5], 0.16 * Math.max(rim, swirl - 0.5) * (1 - k * 0.5));
        }
      }
    };
    const mid = [cx(H * 0.5), -H * 0.5, cz(H * 0.5)];
    T.push({ pos: mid.map((v, i) => v - Dw[i] * 18), fn: () => body(false) });
    T.push({ pos: mid.map((v, i) => v + Dw[i] * 18), fn: () => body(true) });
    // the lip of the funnel: a ragged ring of pale air turning with the wind
    const lip = H * 0.93;
    T.push({
      pos: [cx(lip), -lip, cz(lip)],
      fn: () => {
        const Rl = radius(lip, H) + 1;
        q.plane(cx(lip), -lip, cz(lip), null, Rl, (u, v, out) => {
          const d = Math.hypot(u, v), w = (d - (Rl - 2.4)) / 2.4;
          if (w < 0) return;
          out.c = w > 0.6 ? C[6] : C[5];
          out.a = (0.2 + 0.4 * (0.5 + 0.5 * Math.sin(Math.atan2(v, u) * 3 - TAU * ph * 2))) * (1 - w * 0.5);
          out.blend = true;
        });
      },
    });
    cycle(t, D, 18, o.seed + 5, (g) => g.range(0.8, 1.2), (age, life, r) => {
      const th = r.range(0, TAU) + age * r.range(4, 6), R = 9 + age * r.range(8, 16), k = age / life;
      const x = Math.cos(th) * R, y = -2 - age * r.range(4, 10), z = Math.sin(th) * R, rad = 2.5 + 5 * k, a = 0.75 * (1 - k) ** 1.2 * Math.min(1, age / 0.1);
      T.push({
        pos: [x, y, z],
        fn: () => {
          q.disc(x, y, z, rad, C[6], (d) => a * (1 - d * d));
          q.at(x, y - rad * 0.3, z, (pp) => ((pp.z -= rad * 0.6), pp.disc(-rad * 0.1, 0, rad * 0.5, WHITE, (d) => a * 0.5 * (1 - d * d) * (1 - k))));
        },
      });
    });
    cycle(t, D, 14, o.seed + 3, (g) => g.range(0.9, 1.3), (age, life, r) => {
      const th = r.range(0, TAU), R = radius(H, H) * (0.6 + age * 0.9), k = age / life, rad = 3 + 6 * k;
      const Rc = Math.min(R, 36), x = cx(H) + Math.cos(th) * Rc, y = -H - 2 - age * 4, z = cz(H) + Math.sin(th) * Rc, a = 0.24 * (1 - k) * Math.min(1, age / 0.15);
      T.push({
        pos: [x, y, z],
        fn: () => {
          q.disc(x, y, z, rad * 0.8, C[6], (d) => a * (1 - d * d));
          q.glow(x, y, z, rad * 1.5, C[4], 0.08 * (1 - k));
        },
      });
    });
    for (const it of q.sort(T, (it) => it.pos)) it.fn();
  },
};
