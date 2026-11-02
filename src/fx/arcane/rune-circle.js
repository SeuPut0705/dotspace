// The floor glow and the specks rising off it follow Sprite Fusion's open-source mana heal
// (https://www.spritefusion.com/pixel-art-vfx/heal), MIT License, Copyright (c) 2026 Hugo Duprez.
import { PAL, fit, cycle, smooth, ease, sparkle, space, TAU, WHITE } from "../../core/index.js";
import { floorRing, glyph, mote, facing, moteAt } from "./_lib.js";

// turning a quarter a loop keeps every part seamless: 16 ticks, a square, and 12 runes in a pattern of three
const D = 4, R = 46, RR = 39, RI = 23, RC = 7, SY = 0.3, NR = 12;

export const meta = {
  name: "Rune circle",
  desc: "A rune circle turns on the floor in perspective: a carousel of runes lit by chasing light, a turning square, ticks, motes rising off it.",
  tags: ["arcane", "rune", "circle", "magic", "aura", "ground", "loop"],
  size: [136, 100],
  origin: [68, 80],
  duration: D,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.arcane, seed: 8 },
};

const at = (g, r) => [Math.cos(g) * r, Math.sin(g) * r * SY];
const gap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function circle(p, C, t, far) {
  const ph = t / D, spin = (ph * TAU) / 4, keep = far ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0;
  // two sparks of light chase round the outer ring, twice a loop
  const chase = ph * TAU * 2, lit = (g, w) => gap(g, chase) < w || gap(g, chase + Math.PI) < w;
  const tone = (g, hi, lo) => (Math.sin(g) < 0 ? lo : hi);
  floorRing(p, 0, 0, R, SY, (g) => (lit(g, 0.22) ? WHITE : lit(g, 0.5) ? C[6] : tone(g, C[6], C[5])), 1, keep);
  floorRing(p, 0, 0, RI, SY, (g) => tone(g, C[5], C[4]), 1, keep);
  floorRing(p, 0, 0, RC, SY, (g) => tone(g, C[6], C[5]), 1, keep);
  // studs set round the outside of the ring, turning with it
  for (let j = 0; j < 16; j++) {
    const g = spin + ((j + 0.5) * TAU) / 16;
    if (Math.sin(g) < 0 !== far) continue;
    const [x, y] = at(g, R + 3.5), hot = lit(g, 0.3);
    p.px(x, y, hot ? WHITE : tone(g, j % 2 ? C[5] : C[6], C[4]));
    if (j % 2 === 0) for (const [dx, dy] of [[1, 0], [-1, 0]]) p.px(x + dx, y + dy, hot ? C[6] : tone(g, C[4], C[3]));
  }
  // a square turning the other way inside the inner ring, its corners touching it
  const pts = [0, 1, 2, 3].map((k) => at(-spin + (k * TAU) / 4 + Math.PI / 4, RI));
  for (let k = 0; k < 4; k++) {
    let [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % 4];
    if ((ay < 0) !== (by < 0)) {
      const u = ay / (ay - by), mx = ax + (bx - ax) * u;
      if ((ay < 0) === far) (bx = mx), (by = 0);
      else (ax = mx), (ay = 0);
    } else if ((ay < 0) !== far) continue;
    p.line(ax, ay, bx, by, far ? C[4] : C[5]);
  }
  // the runes stand in the band, riding round; bright at the front, dim behind, flaring as the light passes
  const gs = [...Array(NR).keys()].map((k) => [k, spin + ((k + 0.5) * TAU) / NR]).filter(([, g]) => Math.sin(g) < 0 === far);
  gs.sort((a, b) => Math.sin(a[1]) - Math.sin(b[1]));
  for (const [k, g] of gs) {
    const [x, y] = at(g, RR), hot = lit(g, 0.2), bob = Math.sin(ph * TAU * 4 + 4 * g) * 0.5;
    glyph(p, [0, 3, 5][k % 3], x, y - 1 + bob, hot ? WHITE : far ? C[5] : C[6], 1, hot ? C[5] : far ? C[2] : C[3]);
    p.glow(x, y - 3, hot ? 10 : 6, C[5], hot ? 0.5 : far ? 0.12 : 0.22);
    p.glow(x, y, 5, C[4], 0.15);
  }
}

// motes rising off the circle on a slow helix round its axis, swaying in; twinkles hanging over it
function motes(p, C, t, S, far) {
  cycle(t, D, 76, S * 5 + 1, (g) => g.range(1.1, 1.9), (age, life, r) => {
    const g0 = r.range(0, TAU), r0 = r.pick([R, R, RR, RR, RI]), q = age / life, g = g0 + q * r.range(0.6, 1.4);
    if (Math.sin(g) < 0 !== far) return;
    const rr = r0 * (1 - 0.35 * q), h = 2 + ease.outQuad(q) * r.range(26, 52), x = Math.cos(g) * rr, y = Math.sin(g) * rr * SY - h;
    const a = Math.min(1, q * 5) * (1 - smooth(0.65, 1, q)), big = r.chance(0.2);
    mote(p, x, y, -Math.sin(g) * rr * 0.8, -36 * (1 - q) - 10, r.chance(0.3) ? WHITE : r.chance(0.6) ? C[6] : C[5], big ? 1.1 : r.range(0.55, 0.9), a, big ? 0.5 : 0.3);
  });
  cycle(t, D, 14, S * 5 + 2, 0.45, (age, life, r) => {
    const g = r.range(0, TAU);
    if (Math.sin(g) < 0 !== far) return;
    const rr = r.range(8, R), x = Math.cos(g) * rr, y = Math.sin(g) * rr * SY - r.range(6, 34), k = Math.sin((age / life) * Math.PI);
    sparkle(p, x, y, 1 + 2.4 * k, C[6], C[5], 0.35 * k);
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), pulse = 0.85 + 0.15 * Math.sin((t / D) * TAU * 4);
  // the floor glows under the circle, and a soft light stands over it
  p.glow(0, 0, R * 1.4, C[4], 0.24 * pulse);
  for (const s of [-1, 1]) p.glow(s * R * 0.55, 1, R * 0.7, C[5], 0.12 * pulse);
  // a soft column of light standing over it, fading as it rises
  for (let h = 0; h < 66; h += 6) p.glow(0, -h, 26, C[4], 0.11 * pulse * (1 - h / 80));
  circle(p, C, t, true);
  motes(p, C, t, o.seed, true);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), chase = (t / D) * TAU * 2;
  circle(p, C, t, false);
  motes(p, C, t, o.seed, false);
  // the two sparks of light running round the ring
  for (const g of [chase, chase + Math.PI]) {
    const [x, y] = at(g, R);
    sparkle(p, x, y, 2.5 + Math.sin(t * 30) * 0.8, C[6], C[5], 0.5);
    p.glow(x, y, 14, C[5], 0.4);
  }
}

// ---- 3D: the circle lies on the floor as a true circle, the runes stand on it, the motes climb a real helix round its axis
export const three = {
  meta: { size: [136, 100], origin: [68, 76], bg: "ground", camera: { pitch: 0.34 } },
  draw(p, t, o) {
    const C = fit(o.palette, 8), q = space(p, o), ph = t / D, spin = (ph * TAU) / 4, chase = ph * TAU * 2, pulse = 0.85 + 0.15 * Math.sin(ph * TAU * 4);
    const lit = (g, w) => gap(g, chase) < w || gap(g, chase + Math.PI) < w;
    // dim on the half turned away from the camera, whichever way it looks
    const tone = (g, hi, lo) => (facing(q, g) < 0 ? lo : hi);
    const pos = (g, r, y = 0) => [Math.cos(g) * r, y, Math.sin(g) * r];

    // the floor: rings, studs and the square drawn flat, then laid down as one decal
    q.decal(0, 0, 0, null, R + 6, (pp) => {
      floorRing(pp, 0, 0, R, 1, (g) => (lit(g, 0.22) ? WHITE : lit(g, 0.5) ? C[6] : tone(g, C[6], C[5])));
      floorRing(pp, 0, 0, RI, 1, (g) => tone(g, C[5], C[4]));
      floorRing(pp, 0, 0, RC, 1, (g) => tone(g, C[6], C[5]));
      for (let j = 0; j < 16; j++) {
        const g = spin + ((j + 0.5) * TAU) / 16, x = Math.cos(g) * (R + 3.5), y = Math.sin(g) * (R + 3.5), hot = lit(g, 0.3);
        pp.px(x, y, hot ? WHITE : tone(g, j % 2 ? C[5] : C[6], C[4]));
        if (j % 2 === 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pp.px(x + dx, y + dy, hot ? C[6] : tone(g, C[4], C[3]));
      }
      const pts = [0, 1, 2, 3].map((k) => [Math.cos(-spin + (k * TAU) / 4 + Math.PI / 4) * RI, Math.sin(-spin + (k * TAU) / 4 + Math.PI / 4) * RI]);
      for (let k = 0; k < 4; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % 4];
        pp.line(ax, ay, bx, by, C[5]);
      }
    });

    // the runes stand in the band, riding round: bright on the near side, dim behind, flaring as the light passes
    for (let k = 0; k < NR; k++) {
      const g = spin + ((k + 0.5) * TAU) / NR, far = facing(q, g) < 0, hot = lit(g, 0.2), bob = Math.sin(ph * TAU * 4 + 4 * g) * 0.5, [x, , z] = pos(g, RR);
      q.at(x, -1 + bob, z, (pp) => glyph(pp, [0, 3, 5][k % 3], 0, 0, hot ? WHITE : far ? C[5] : C[6], 1, hot ? C[5] : far ? C[2] : C[3]));
    }

    // motes rising off the circle on a slow helix round its axis, swaying in
    cycle(t, D, 76, o.seed * 5 + 1, (g) => g.range(1.1, 1.9), (age, life, r) => {
      const g0 = r.range(0, TAU), r0 = r.pick([R, R, RR, RR, RI]), k = age / life, g = g0 + k * r.range(0.6, 1.4);
      const rr = r0 * (1 - 0.35 * k), h = 2 + ease.outQuad(k) * r.range(26, 52), a = Math.min(1, k * 5) * (1 - smooth(0.65, 1, k)), big = r.chance(0.2);
      const c = r.chance(0.3) ? WHITE : r.chance(0.6) ? C[6] : C[5], sz = big ? 1.1 : r.range(0.55, 0.9);
      moteAt(q, Math.cos(g) * rr, -h, Math.sin(g) * rr, -Math.sin(g) * rr * 0.8, -36 * (1 - k) - 10, Math.cos(g) * rr * 0.8, c, sz, a, big ? 0.5 : 0.3);
    });
    // twinkles hanging over it
    cycle(t, D, 14, o.seed * 5 + 2, 0.45, (age, life, r) => {
      const g = r.range(0, TAU), rr = Math.sqrt(r.range(0.03, 1)) * R, k = Math.sin((age / life) * Math.PI);
      q.at(Math.cos(g) * rr, -r.range(6, 34), Math.sin(g) * rr, (pp) => sparkle(pp, 0, 0, 1 + 2.4 * k, C[6], C[5], 0.35 * k));
    });
    // halos of light lifting off the circle and drawing in, true circles one above the other
    for (let i = 0; i < 3; i++) {
      const k = (ph * 2 + i / 3) % 1, rr = RR * (1 - 0.32 * k), a = Math.sin(k * Math.PI) * 0.55;
      q.decal(0, -(3 + k * 44), 0, null, rr + 2, (pp) => floorRing(pp, 0, 0, rr, 1, k < 0.5 ? C[6] : C[5], a));
    }
    // the two sparks of light running round the ring
    for (const g of [chase, chase + Math.PI]) {
      const [x, y, z] = pos(g, R);
      q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 2.5 + Math.sin(t * 30) * 0.8, C[6], C[5], 0.5));
    }

    // light: a pool on the floor under the circle, a soft column standing over it, a glow on every rune and spark
    q.plane(0, 0, 0, null, R * 1.4, (u, v, out) => {
      const f = 1 - Math.hypot(u, v) / (R * 1.4);
      if (f <= 0) return;
      out.l = C[4];
      out.k = f * f * 0.5 * pulse;
    });
    for (let h = 0; h < 66; h += 6) q.glow(0, -h, 0, 26, C[4], 0.11 * pulse * (1 - h / 80));
    for (let k = 0; k < NR; k++) {
      const g = spin + ((k + 0.5) * TAU) / NR, far = facing(q, g) < 0, hot = lit(g, 0.2), [x, , z] = pos(g, RR);
      q.glow(x, -3, z, hot ? 10 : 6, C[5], hot ? 0.5 : far ? 0.12 : 0.22);
      q.glow(x, 0, z, 5, C[4], 0.15);
    }
    for (const g of [chase, chase + Math.PI]) {
      const [x, y, z] = pos(g, R);
      q.glow(x, -1, z, 14, C[5], 0.4);
    }
  },
};
