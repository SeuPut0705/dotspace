// The streaks falling in (a dim body, a bright head) follow Sprite Fusion's open-source rain
// (https://www.spritefusion.com/pixel-art-vfx/rain), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, cycle, clamp, smooth, rand, mix, space, TAU, WHITE } from "../../core/index.js";
import { WATER, bead, ring, ring3, rock } from "./_lib.js";

export const meta = {
  name: "Rain splash",
  desc: "A low close-up on one puddle in the rain: big drops land in crowns that throw beads and a rebound jet, rings spread and interfere, a lamp's reflection wobbles on the water.",
  tags: ["water", "rain", "splash", "puddle", "close-up", "ambient", "loop"],
  size: [176, 80],
  origin: [88, 50],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: WATER, seed: 9 },
};

const D = meta.duration, SY = 0.3, RX = 92, G = 640, N = 8, LAMP = 34;

// the big drops: where each lands on the puddle (x across, z into it), when, how tall its crown stands
function drops(S) {
  return Array.from({ length: N }, (_, i) => ({
    x: (rand(i, S) - 0.5) * 120, z: (rand(i, S + 1) - 0.5) * 50, t0: ((i + 0.25 * rand(i, S + 2)) / N) * D,
    H: 10 + 4 * rand(i, S + 3), J: 7 + 4 * rand(i, S + 4), spin: rand(i, S + 5) * TAU, i,
  }));
}
const ageOf = (t, t0) => (((t - t0) % D) + D) % D;
// a ring's radius and strength at age a
const ringR = (a) => 3 + 34 * Math.pow(a / 1.8, 0.7);
const ringK = (a) => (a < 1.8 ? 1.3 * Math.pow(1 - a / 1.8, 1.3) * Math.min(1, a / 0.06) : 0);
// the crown at age a: how high its walls stand and how wide its foot is
const crownH = (a, H) => H * Math.pow(Math.sin(Math.PI * clamp(a / 0.3)), 0.8) * (a < 0.3 ? 1 : 0);
const crownR = (a) => 1.5 + 4.5 * Math.sqrt(clamp(a / 0.3));
// the rebound jet: up and back down after the crown has fallen
const jetH = (a, J) => (a > 0.26 && a < 0.56 ? J * Math.sin((Math.PI * (a - 0.26)) / 0.3) : 0);

// the water's height at a point: every ring's swell summed, so where two cross they add and cancel
function field(x, z, list) {
  let h = 0;
  for (const q of list) {
    const dx = x - q.x;
    if (dx > q.R + 10 || dx < -q.R - 10) continue;
    const d = Math.hypot(dx, z - q.z) - q.R, w = 3.6 + q.a * 3;
    if (d > 2 * w || d < -3 * w) continue;
    h += q.k * Math.cos(d * 1.1) * Math.exp(-((d / w) ** 2));
  }
  return h;
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), S = o.seed, ry = RX * SY, ph = t / D;
  const list = drops(S).map((q) => ({ ...q, a: ageOf(t, q.t0) })).filter((q) => q.a < 1.8).map((q) => ({ ...q, R: ringR(q.a), k: ringK(q.a) }));
  for (let Y = Math.floor(-ry); Y < ry; Y++) {
    const y = Y + 0.5, z = y / SY, act = list.filter((q) => Math.abs(z - q.z) <= q.R + 12), far = (y + ry) / (2 * ry);
    // the lamp's reflection on this row: a dash of light, its width shimmering, pushed about by the swell
    const dashW = (1.5 + far * 4) * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(Y * 1.73 + ph * TAU * 3 + Math.sin(Y * 0.61) * 3)));
    let hPrev = 0;
    for (let X = -88; X < 88; X++) {
      const x = X + 0.5, d = (x / RX) ** 2 + (y / ry) ** 2;
      if (d > 1) continue;
      const edge = Math.min(1, (1 - d) * 6);
      // the puddle: dark see-through water, the far part holding a little of the sky
      p.blend(x, y, C[0], (0.62 + 0.2 * far) * edge);
      if (far < 0.45) p.blend(x, y, C[2], 0.3 * (1 - far / 0.45) * edge);
      // its swell: every ring summed, so crests catch the light, troughs go dark, and crossings beat
      const h = act.length ? field(x, z, act) : 0, hx = h - hPrev;
      hPrev = h;
      if (h > 0.24) p.blend(x, y, h > 0.75 ? C[5] : C[4], Math.min(0.95, (h - 0.24) * 2.2) * edge);
      else if (h < -0.4) p.blend(x, y, C[0], Math.min(0.85, (-h - 0.4) * 1.8) * edge);
      if (x < LAMP - 14 || x > LAMP + 14) continue;
      const lx = Math.abs(x - LAMP - hx * 9 - Math.sin(y * 0.8 + ph * TAU * 2) * 1.4);
      if (lx < dashW) {
        const k = (1 - lx / dashW) * edge;
        p.px(X, Y, k > 0.72 ? WHITE : k > 0.35 ? C[6] : C[5]);
        p.light(x, y, C[5], 0.2 * k);
      }
    }
  }
  // the far rim of the puddle catches the light
  for (let X = -82; X < 82; X++) {
    const x = X + 0.5, y = -Math.sqrt(Math.max(0, 1 - (x / RX) ** 2)) * ry;
    p.px(X, y + 0.5, Math.abs(x - LAMP) < 10 ? C[6] : C[3]);
  }
  // the back halves of the crowns, behind their own front walls
  for (const q of drops(S)) crown(p, C, q, ageOf(t, q.t0), true);
}

// a crown: a ring of fingers thrown up round the drop's hole, a bead on each tip until they tear away
function crown(p, C, q, a, back) {
  const h = crownH(a, q.H);
  if (h < 1) return;
  const r0 = crownR(a), cy = q.z * SY;
  for (let f = 0; f < 10; f++) {
    const ang = q.spin + (f / 10) * TAU, s = Math.sin(ang);
    if (s < 0 !== back) continue;
    const tip = h * (0.75 + 0.25 * rand(q.i, f, 7)), lean = 0.35 * tip, x0 = q.x + Math.cos(ang) * r0, y0 = cy + s * r0 * SY;
    const x1 = q.x + Math.cos(ang) * (r0 + lean), y1 = cy + s * (r0 + lean) * SY - tip;
    p.line(x0, y0, x1, y1, back ? (u) => (u > 0.7 ? C[5] : C[3]) : (u) => (u > 0.75 ? WHITE : u > 0.35 ? C[6] : C[5]));
    if (a > 0.08 && a < 0.17) p.px(x1, y1 - 1, back ? C[5] : WHITE);
  }
  if (!back) p.glow(q.x, cy - h * 0.6, 6 + h * 0.6, C[5], 0.3 * (h / q.H));
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), S = o.seed;
  for (const q of drops(S)) {
    const a = ageOf(t, q.t0), cy = q.z * SY;
    // falling in: a streak dropping into the frame just before it lands
    const pre = D - a;
    if (pre < 0.14 && cy - pre * 520 - 10 > -48) {
      const y = cy - pre * 520;
      p.line(q.x, y - 10, q.x, y - 4, C[4]);
      p.line(q.x, y - 4, q.x, y, C[6]);
    }
    // the hit: a white fleck and a flash of light, then the crown
    if (a < 0.05) {
      p.px(q.x, cy, WHITE);
      p.glow(q.x, cy - 2, 12, C[5], 0.5 * (1 - a / 0.05));
    }
    crown(p, C, q, a, false);
    // beads torn off the crown's tips arc out and fall back, each with a fleck and a little ring
    if (a > 0.16 && a < 0.8)
      for (let f = 0; f < 10; f += 2) {
        const ang = q.spin + (f / 10) * TAU, tip = crownH(0.16, q.H) * (0.75 + 0.25 * rand(q.i, f, 7)), r0 = crownR(0.16) + tip * 0.35;
        const v = 22 + 18 * rand(q.i, f, 8), vh = 40 + 30 * rand(q.i, f, 9), tt = a - 0.16, hh = tip + vh * tt - 0.5 * G * tt * tt;
        const bx = q.x + Math.cos(ang) * (r0 + v * tt), bz = q.z + Math.sin(ang) * (r0 + v * tt), by = bz * SY;
        if (hh > 0) bead(p, bx, by - hh, Math.cos(ang) * v, -(vh - G * tt) + Math.sin(ang) * v * SY, rand(q.i, f, 10) < 0.4 ? 2 : 1, C);
        else {
          const land = (vh + Math.sqrt(vh * vh + 2 * G * tip)) / G, since = tt - land;
          if (since < 0.05) p.px(bx, by, WHITE);
          if (since < 0.35) ring(p, bx, by, 1 + since * 12, SY, 1 - since / 0.35, C, { n: 1, half: 1, seed: q.i * 10 + f });
        }
      }
    // the rebound jet, with a bead that pinches off its top and drops back
    const jh = jetH(a, q.J);
    if (jh > 0.8) {
      p.line(q.x, cy - 1, q.x, cy - jh, (u) => (u > 0.6 ? WHITE : C[6]));
      p.px(q.x + 1, cy - 1, C[5]);
      if (a < 0.41) p.circle(q.x, cy - jh - 0.5, 1.2, C[6]);
      p.glow(q.x, cy - jh * 0.6, 6, C[5], 0.3);
    }
    const ba = a - 0.41, bh = q.J + 1 + 24 * ba - 0.5 * G * ba * ba;
    if (ba > 0 && bh > 0) {
      p.circle(q.x, cy - bh, 1.1, C[6]);
      p.px(q.x, cy - bh - 1, WHITE);
    }
  }
  // the near halves of the main rings, crisp, so each splash has its own edge in the swell
  for (const q of drops(S)) {
    const a = ageOf(t, q.t0);
    if (a < 1.8) ring(p, q.x, q.z * SY, ringR(a), SY, 0.75 * ringK(a), C, { n: 1, half: 1, hot: a < 0.1, seed: q.i, wob: 0.5 + a });
  }
  // finer rain dimpling the water, and a few streaks falling past
  cycle(t, D, 16, S + 20, 0.5, (age, life, r) => {
    const x = r.range(-80, 80), z = r.range(-26, 26), y = z * SY, s = age - 0.1;
    if (s < 0) {
      const yy = y - (0.1 - age) * 600;
      if (yy - 6 < -48) return;
      p.line(x, yy - 6, x, yy, (u) => (u > 0.6 ? C[5] : C[3]));
    } else if (s < 0.4 && (x / RX) ** 2 + (y / (RX * SY)) ** 2 < 0.9) {
      if (s < 0.04) p.px(x, y, C[6]);
      ring(p, x, y, 1 + s * 9, SY, 0.8 * (1 - s / 0.4), C, { n: 1, half: 1, seed: 40 });
    }
  });
  // the lamp's glow on the water
  p.glow(LAMP, -6, 30, C[4], 0.16);
}

// 3D: a round puddle in the rain with a street lamp standing by it. Drops fall through the air in real streaks and
// land all over the disc: each throws a crown of fingers (a true ring of them, far ones dimmer), beads arc out in
// every direction and plink with their own rings, and every ring is a true circle summed into the swell of the
// water, so the lamp's reflection (a column of light running toward the viewer from the lamp's mirror image)
// is pushed about by the waves and turns with the camera.
const PR = 80, LX = 30, LZ = -86, LH = 50;
function drops3(S) {
  return drops(S).map((q) => {
    const x = (rand(q.i, S) - 0.5) * 136, z = (rand(q.i, S + 1) - 0.5) * 136, k = Math.min(1, 62 / Math.hypot(x, z));
    return { ...q, x: x * k, z: z * k };
  });
}
// one crown of fingers round the drop's hole, drawn in space
function crown3(q, C, d, a) {
  const h = crownH(a, d.H);
  if (h < 1) return;
  const r0 = crownR(a), n = 14, yaw = q.camera.yaw, tips = [];
  for (let f = 0; f < n; f++) {
    const ang = d.spin + (f / n) * TAU, far = Math.sin(ang + yaw) < 0, tip = h * (0.75 + 0.25 * rand(d.i, f, 7)), lean = 0.35 * tip;
    const ca = Math.cos(ang), sa = Math.sin(ang), x1 = d.x + ca * (r0 + lean), z1 = d.z + sa * (r0 + lean);
    q.line(d.x + ca * r0, 0, d.z + sa * r0, x1, -tip, z1, far ? (u) => (u > 0.7 ? C[5] : C[3]) : (u) => (u > 0.75 ? WHITE : u > 0.35 ? C[6] : C[5]));
    if (a > 0.08 && a < 0.17) q.px(x1, -tip - 1, z1, far ? C[5] : WHITE);
    tips.push([x1, -tip, z1]);
  }
  // the lip joining the finger tips, thin and see-through
  for (let f = 0; f < n; f++) q.line(...tips[f], ...tips[(f + 1) % n], C[6], 0.45);
  q.glow(d.x, -h * 0.6, d.z, 6 + h * 0.6, C[5], 0.3 * (h / d.H));
}

export const three = {
  meta: { size: [196, 140], origin: [98, 92], camera: { pitch: 0.4 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), S = o.seed, ph = t / D, ST = rock(), Q = drops3(S);
    const list = Q.map((d) => ({ ...d, a: ageOf(t, d.t0) })).filter((d) => d.a < 1.8).map((d) => ({ ...d, R: ringR(d.a), k: ringK(d.a) }));
    const fld = (x, z) => {
      let h = 0;
      for (const d of list) {
        const dx = x - d.x, dz = z - d.z;
        if (dx > d.R + 10 || dx < -d.R - 10 || dz > d.R + 10 || dz < -d.R - 10) continue;
        const e = Math.hypot(dx, dz) - d.R, w = 3.6 + d.a * 3;
        if (e > 2 * w || e < -3 * w) continue;
        h += d.k * Math.cos(e * 1.1) * Math.exp(-((e / w) ** 2));
      }
      return h;
    };
    // the lamp's mirror image on the water: where its reflection stands on screen
    q.project(LX, LH, LZ);
    const lampSX = q.x, st = { c: 0, a: 0 }, lay = (c, a) => {
      if (a <= 0) return;
      const na = st.a + a * (1 - st.a);
      (st.c = st.a ? mix(st.c, c, a / na) : c), (st.a = na);
    };
    q.plane(0, 0, 0, null, PR, (u, v, out) => {
      const d = (u * u + v * v) / (PR * PR);
      if (d > 1) return;
      const edge = Math.min(1, (1 - d) * 6), tw = u * q.sy + v * q.cy, near = clamp(0.5 + tw / (2 * PR));
      st.a = 0;
      // dark see-through water, the far part holding a little of the sky
      lay(C[0], (0.62 + 0.2 * near) * edge);
      if (near < 0.45) lay(C[2], 0.3 * (1 - near / 0.45) * edge);
      // its swell: every ring summed, so crests catch the light, troughs go dark, and crossings beat
      const h = list.length ? fld(u, v) : 0;
      if (h > 0.24) lay(h > 0.75 ? C[5] : C[4], Math.min(0.95, (h - 0.24) * 2.2) * edge);
      else if (h < -0.4) lay(C[0], Math.min(0.85, (-h - 0.4) * 1.8) * edge);
      // the far rim catches the light in a fine line
      if (d > 0.955 && Math.sin(Math.atan2(v, u) + q.camera.yaw) < 0) lay(Math.abs(u * q.cy - v * q.sy - lampSX) < 10 ? C[6] : C[3], 1);
      // the lamp's reflection: a column of light toward the viewer, its width shimmering, pushed about by the swell
      const sx = u * q.cy - v * q.sy, Y = Math.floor(tw * q.sp), hx = h - (list.length ? fld(u + 0.8 * q.cy, v - 0.8 * q.sy) : 0);
      const dashW = (1 + near * 3.2) * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(Y * 1.73 + ph * TAU * 3 + Math.sin(Y * 0.61) * 3)));
      const lx = Math.abs(sx - lampSX - hx * 9 - Math.sin(Y * 0.8 + ph * TAU * 2) * 1.4);
      if (lx < dashW) {
        const k = (1 - lx / dashW) * edge;
        lay(k > 0.88 ? WHITE : k > 0.4 ? C[6] : C[5], 0.5 + 0.4 * k);
        out.l = C[5];
        out.k = 0.14 * k;
      }
      out.c = st.c;
      out.a = Math.min(1, st.a);
      out.blend = true;
    });
    // the lamp post: a dark iron pole, a lit bulb
    q.beam(LX, 0, LZ, LX, -LH + 4, LZ, 2.4, (uu, vv) => (vv > 0.55 ? ST[0] : uu < 0.5 ? ST[3] : ST[2]));
    q.ball(LX, 0, LZ, 3.6, (nx, ny) => (ny < -0.2 ? ST[3] : ST[1]));
    q.ball(LX, -LH, LZ, 4.2, (nx, ny, nz) => (nz > 0.25 ? (nx < -0.1 && ny < -0.1 ? WHITE : C[6]) : C[5]));
    // drops falling into the frame just before they land
    for (const d of Q) {
      const a = ageOf(t, d.t0), pre = D - a;
      if (pre < 0.1) {
        const y = pre * 520;
        q.line(d.x, -y - 10, d.z, d.x, -y - 4, d.z, C[4]);
        q.line(d.x, -y - 4, d.z, d.x, -y, d.z, C[6]);
      }
      // the hit: a white fleck and a flash of light, then the crown
      if (a < 0.05) {
        q.px(d.x, 0, d.z, WHITE);
        q.glow(d.x, -2, d.z, 12, C[5], 0.5 * (1 - a / 0.05));
      }
      crown3(q, C, d, a);
      // beads torn off the crown's tips arc out and fall back, each with a fleck and a little ring
      if (a > 0.16 && a < 0.8)
        for (let f = 0; f < 10; f++) {
          const ang = d.spin + (f / 10) * TAU, tip = crownH(0.16, d.H) * (0.75 + 0.25 * rand(d.i, f, 7)), r0 = crownR(0.16) + tip * 0.35;
          const v = 22 + 18 * rand(d.i, f, 8), vh = 40 + 30 * rand(d.i, f, 9), tt = a - 0.16, hh = tip + vh * tt - 0.5 * G * tt * tt;
          const bx = d.x + Math.cos(ang) * (r0 + v * tt), bz = d.z + Math.sin(ang) * (r0 + v * tt);
          if (hh > 0) {
            const [vx, vy] = q.view(Math.cos(ang) * v, -(vh - G * tt), Math.sin(ang) * v), s = rand(d.i, f, 10) < 0.4 ? 2 : 1;
            q.at(bx, -hh, bz, (pp) => bead(pp, 0, 0, vx, vy, s, C));
          } else {
            const land = (vh + Math.sqrt(vh * vh + 2 * G * tip)) / G, since = tt - land;
            if (since < 0.05) q.px(bx, 0, bz, WHITE);
            if (since < 0.35) ring3(q, bx, bz, 1 + since * 12, 1 - since / 0.35, C, { n: 1, seed: d.i * 10 + f });
          }
        }
      // the rebound jet, with a bead that pinches off its top and drops back
      const jh = jetH(a, d.J);
      if (jh > 0.8) {
        q.beam(d.x, -1, d.z, d.x, -jh, d.z, 1.3, (u) => (u > 0.6 ? WHITE : C[6]));
        if (a < 0.41) q.ball(d.x, -jh - 0.5, d.z, 1.3, (nx, ny) => (ny < -0.3 ? WHITE : C[6]));
        q.glow(d.x, -jh * 0.6, d.z, 6, C[5], 0.3);
      }
      const ba = a - 0.41, bh = d.J + 1 + 24 * ba - 0.5 * G * ba * ba;
      if (ba > 0 && bh > 0) {
        q.ball(d.x, -bh, d.z, 1.2, (nx, ny) => (ny < -0.3 ? WHITE : C[6]));
      }
    }
    // the main rings, crisp, so each splash has its own edge in the swell
    for (const d of Q) {
      const a = ageOf(t, d.t0);
      if (a < 1.8) ring3(q, d.x, d.z, ringR(a), 0.75 * ringK(a), C, { n: 1, hot: a < 0.1, seed: d.i, wob: 0.5 + a });
    }
    // finer rain dimpling the water, and streaks falling through the air to it
    cycle(t, D, 30, S + 20, 0.5, (age, life, r) => {
      const ang = r.range(0, TAU), rr = Math.sqrt(r.next()) * (PR - 8), x = Math.cos(ang) * rr, z = Math.sin(ang) * rr, s = age - 0.1;
      if (s < 0) {
        const y = (0.1 - age) * 600;
        if (y > 52) return;
        q.line(x, -y - 6, z, x, -y, z, (u) => (u > 0.6 ? C[5] : C[3]));
      } else if (s < 0.4) {
        if (s < 0.04) q.px(x, 0, z, C[6]);
        ring3(q, x, z, 1 + s * 9, 0.8 * (1 - s / 0.4), C, { n: 1, seed: 40 });
      }
    });
    // the lamp's light on the air and the water
    q.glow(LX, -LH, LZ, 46, C[4], 0.22);
    q.glow(LX, -LH, LZ, 12, C[6], 0.3);
  },
};
