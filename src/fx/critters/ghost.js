import { fit, clamp, wrap, lerp, rng, cycle, space, TAU } from "../../core/index.js";
import { Grid, shift, shadow, mirrored, floorShadow, floorPool } from "./_lib.js";

export const meta = {
  name: "Ghost",
  desc: "A sheet ghost bobs over the floor: its scalloped hem ripples and trails its drift, little arms flutter, it glances about and blinks, motes trickle off its hem.",
  tags: ["critter", "ghost", "spirit", "undead", "spooky", "float", "loop"],
  size: [96, 100],
  origin: [48, 90],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#10142a", "#232c52", "#3e4f86", "#6b84bb", "#a3b8e2", "#d8e4ff", "#ffffff"], hover: 14, seed: 1 },
};

const D = meta.duration, GRID = new Grid(-20, -40, 40, 46), R = 10.5;

// where the ghost is: a lazy drift side to side and a bob, both looping
function at(t, hover) {
  const a = (t / D) * TAU;
  return { x: 4 * Math.sin(a), y: -hover - 3 * Math.sin(2 * a + 0.8) };
}

// the sheet's half-width v px above the hem (0 hem .. 1 crown): a dome over a body that flares toward the hem
function halfW(h) {
  const top = 2 * R + 9;
  if (h > top || h < -1) return -1;
  if (h > top - R) return Math.sqrt(Math.max(0, R * R - (h - (top - R)) ** 2));
  return lerp(R + 2.2, R, (h / (top - R)) ** 0.7);
}

function sheet(g, C, t, o, lagX) {
  g.clear();
  const top = 2 * R + 9, ph = (t / D) * TAU * 2, NL = 4, HW = R + 2.2, LW = (2 * HW) / NL;
  // the lower sheet trails behind the head as it drifts
  const off = (h) => lagX * (1 - clamp(h / top)) ** 1.4;
  // four rounded lobes along the hem, lifting one after another in a ripple
  const lobe = (X) => {
    const j = clamp(Math.floor((X + HW) / LW), 0, NL - 1), c = -HW + (j + 0.5) * LW, u = (X - c) / (LW / 2);
    return { j, u, d: (2.2 + 1.1 * Math.sin(ph - j * 1.5)) * Math.sqrt(Math.max(0, 1 - u * u)) };
  };
  const inside = (x, y) => {
    const h = -y, X = x - off(h);
    if (h < 0 && -h > lobe(X).d) return false;
    const hw = halfW(Math.max(0, h));
    return hw >= 0 && Math.abs(X) <= hw;
  };
  // little arms: rounded nubs that flutter
  const arm = (x, y) => {
    for (const s of [-1, 1]) {
      const ax = s * (R + 1.2) + off(13), ay = -13 + 1.6 * Math.sin(ph + s * 1.3);
      if (((x - ax) / 3) ** 2 + ((y - ay) / 2.2) ** 2 <= 1) return true;
    }
    return false;
  };
  const any = (x, y) => inside(x, y) || arm(x, y);
  const lx = -9, ly = -top - 1;
  const lit = (x, y, k) => any(lx + (x - lx) / k, ly + (y - ly) / k);
  g.shade(-19, -top - 2, 19, 5, (x, y, o2) => {
    if (!any(x, y)) return 0;
    const h = -y, X = x - off(h);
    let i = lit(x, y, 0.62) ? 5 : 4;
    if (!any(x + 2.4, y + 1.8)) i = 3;
    if (!any(x + 1.2, y + 1) && X > 2) i = 2;
    // the gloss: a thin bright arc just inside the top-left of the dome
    if (h > top - R - 2 && X < 1 && !any(x - 1.5, y - 1.5) && any(x - 0.6, y - 0.6)) i = 6;
    // the hem: each lobe darker underneath and to its right, a crease where two lobes meet
    if (h < 1) {
      const L = lobe(X);
      if (L.u > 0.1 || -h > L.d - 1.2) i = Math.min(i, 3);
    }
    // folds: short creases running down into the notches between the lobes, lit on their left
    if (h < 7 && h >= -0.5) {
      for (let j = 1; j < NL; j++) {
        const cx = -HW + j * LW + 0.6 * Math.sin(ph - j), w = (7 - h) * 0.09;
        if (Math.abs(X - cx) <= w + 0.3) i = Math.min(i, 3);
        else if (cx - X > w + 0.3 && cx - X < w + 1.3 && i === 4) i = 5;
      }
    }
    o2.a = h < 2 ? 0.86 : 0.95;
    return C[i];
  });
  return { inside, off, top };
}

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 7), S = at(t, o.hover), lagX = at(t - 0.3, o.hover).x - S.x;
  const g = GRID;
  const sh = sheet(g, C, t, o, lagX), top = sh.top;
  // the face: two eyes that glance about and blink, a little mouth that oohs
  const look = wrap(t, D) < 0.7 ? 0 : wrap(t, D) < 1.3 ? 1 : wrap(t, D) < 1.9 ? -1 : 0, blink = wrap(t, D) > 1.95 && wrap(t, D) < 2.03;
  const ey = -top + R - 1, mo = 0.5 + 0.5 * Math.sin((t / D) * TAU * 2);
  for (const s of [-1, 1]) {
    const ex = s * 4 - (s > 0 ? 1 : 0) + look;
    if (blink) g.set(ex, ey + 2, C[1]), g.set(ex + 1, ey + 2, C[1]);
    else {
      for (let k = 0; k < 4; k++) g.set(ex, ey + k, C[0]), g.set(ex + 1, ey + k, C[0]);
      g.set(ex + (look < 0 ? 0 : 1), ey, C[2]);
    }
  }
  const my = ey + 6;
  g.set(look - 1, my, C[1]); g.set(look, my, C[1]);
  if (mo > 0.4) g.set(look - 1, my + 1, C[0]), g.set(look, my + 1, C[0]);
  g.outline((x, y, nx, ny) => (ny > 0 ? C[2] : C[1]), 0.95);
  g.draw(p, 1, S.x, S.y);
  // motes trickle off the hem and fade as they sink and drift
  cycle(t, D, 12, o.seed * 3 + 1, (r) => r.range(1, 1.7), (age, L, r, i) => {
    const S0 = at(wrap(t - age, D), o.hover), k = age / L, x0 = S0.x + r.range(-10, 10), y0 = S0.y + 1.5;
    const x = x0 + Math.sin(age * 2.2 + i) * 2.4, y = y0 + r.range(5, 11) * age - 3 * age * age;
    const a = Math.min(1, k * 6) * Math.min(1, (1 - k) * 2.2), tw = 0.6 + 0.4 * Math.sin(age * 8 + i * 1.7);
    p.dot(x, y, tw > 0.8 ? C[6] : C[5], a);
    if (r.chance(0.3)) p.dot(x, y - 1, C[4], a * 0.7);
    p.glow(x, y, 7, C[4], 0.42 * a * tw);
  });
  // a cold glow round it
  p.glow(S.x, S.y - top * 0.55, 54, C[3], 0.3);
  p.glow(S.x - 3, S.y - top * 0.72, 14, C[5], 0.12);
}

export function drawBack(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 7), S = at(t, o.hover), hgt = clamp((-S.y - 8) / 16);
  // its shadow on the floor, and the floor lit cold under it
  shadow(p, S.x, 0, 11 - 3 * hgt, 1.6, C[0], 0.55 - 0.2 * hgt);
  for (let x = -24; x <= 24; x += 6) p.glow(S.x + x, -1, 16, C[4], 0.14 * (1 - Math.abs(x) / 34) * (1 - 0.4 * hgt));
}

// ---- 3D: the ghost drifts round the floor in a lazy ring, bobbing, its sheet trailing behind; its wail goes out as
// true rings (one round its mouth, one rippling over the floor) and its motes and mist hang in the air round it
const DRIFT = 26, WAIL = [0.15, 1.35];
function at3(t, hover) {
  const a = (t / D) * TAU, r = DRIFT + 4 * Math.sin(2 * a + 0.5);
  return { x: r * Math.sin(a), z: r * Math.cos(a), y: -hover - 3 * Math.sin(2 * a + 0.8) };
}

export const three = {
  meta: { size: [150, 124], origin: [75, 100], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, time, o) {
    const t = shift(time, D, o.seed), C = fit(o.palette, 7), q = space(p, o), S = at3(t, o.hover), g = GRID;
    const B = at3(t - 0.04, o.hover), flip = mirrored(q, S.x - B.x, S.z - B.z);
    // the lower sheet trails behind the head: how far, as the camera sees it (the sprite is mirrored back to it)
    const L0 = at3(t - 0.3, o.hover), lag = clamp(((L0.x - S.x) * q.cy - (L0.z - S.z) * q.sy) * 0.3, -5, 5), lagX = flip ? -lag : lag;
    const sh = sheet(g, C, t, o, lagX), top = sh.top;
    const look = wrap(t, D) < 0.7 ? 0 : wrap(t, D) < 1.3 ? 1 : wrap(t, D) < 1.9 ? -1 : 0, blink = wrap(t, D) > 1.95 && wrap(t, D) < 2.03;
    const ey = -top + R - 1, mo = 0.5 + 0.5 * Math.sin((t / D) * TAU * 2);
    for (const s of [-1, 1]) {
      const ex = s * 4 - (s > 0 ? 1 : 0) + look;
      if (blink) g.set(ex, ey + 2, C[1]), g.set(ex + 1, ey + 2, C[1]);
      else {
        for (let k = 0; k < 4; k++) g.set(ex, ey + k, C[0]), g.set(ex + 1, ey + k, C[0]);
        g.set(ex + (look < 0 ? 0 : 1), ey, C[2]);
      }
    }
    const my = ey + 6;
    g.set(look - 1, my, C[1]); g.set(look, my, C[1]);
    if (mo > 0.4) g.set(look - 1, my + 1, C[0]), g.set(look, my + 1, C[0]);
    g.outline((x, y, nx, ny) => (ny > 0 ? C[2] : C[1]), 0.95);

    // the floor: its shadow, a cold pool of light under it, and the wail rippling out over it
    const hgt = clamp((-S.y - 8) / 16);
    floorShadow(q, S.x, S.z, 11 - 3 * hgt, C[0], 0.55 - 0.2 * hgt);
    floorPool(q, S.x, S.z, 28, C[4], 0.32 * (1 - 0.4 * hgt));
    const wails = [];
    for (const t0 of WAIL) {
      const k = wrap(t - t0, D) / 0.9;
      if (k >= 1) continue;
      const E = at3(t0, o.hover), kk = 1 - (1 - k) ** 2;
      wails.push([E, k, kk]);
      q.ring(E.x, 0, E.z, 3 + 24 * kk, 1.8, C[4], 0.8 * (1 - k) ** 1.3);
    }

    // translucent things, far to near: the sheet itself, the mist it leaves, motes off the hem, motes in the air
    const items = [{ x: S.x, y: S.y - top * 0.5, z: S.z, fn: () => q.at(S.x, S.y, S.z, (pp) => g.draw(pp, 1, 0, 0, flip)) }], lights = [];
    for (let k = 1; k <= 9; k++) {
      const P = at3(t - k * 0.08, o.hover), x = P.x + Math.sin(k * 1.3 + (t / D) * TAU) * 1.8, z = P.z + Math.cos(k * 1.1 + (t / D) * TAU) * 1.8;
      const y = P.y - 9 - k * 0.5, rr = 6 - 0.4 * k, a = 0.34 * (1 - k / 10);
      items.push({ x, y, z, fn: () => q.disc(x, y, z, rr, C[4], a) });
    }
    cycle(t, D, 12, o.seed * 3 + 1, (r) => r.range(1, 1.7), (age, L, r, i) => {
      const S0 = at3(wrap(t - age, D), o.hover), k = age / L, ang = r.range(0, TAU), rad = Math.sqrt(r.next()) * 10;
      const x = S0.x + Math.cos(ang) * rad + Math.sin(age * 2.2 + i) * 2.4, z = S0.z + Math.sin(ang) * rad + Math.cos(age * 1.9 + i) * 2.4;
      const y = S0.y + 1.5 + r.range(5, 11) * age - 3 * age * age, big = r.chance(0.3);
      const a = Math.min(1, k * 6) * Math.min(1, (1 - k) * 2.2), tw = 0.6 + 0.4 * Math.sin(age * 8 + i * 1.7);
      items.push({ x, y, z, fn: () => (q.dot(x, y, z, tw > 0.8 ? C[6] : C[5], a), big && q.dot(x, y - 1, z, C[4], a * 0.7)) });
      lights.push([x, y, z, 7, C[4], 0.42 * a * tw]);
    });
    cycle(t, D, 10, o.seed * 3 + 2, D, (age, L, r) => {
      const ang = r.range(0, TAU), rad = Math.sqrt(r.next()) * 50, ph = r.next() * 6;
      const x = Math.cos(ang) * rad + Math.sin(age * 1.1 + ph) * 3, z = Math.sin(ang) * rad, y = r.range(-70, -6) + age * r.range(-2, 3);
      const tw = Math.sin(age * 2.6 + ph), a = Math.min(1, age * 2, (L - age) * 2) * (0.35 + 0.5 * tw);
      items.push({ x, y, z, fn: () => q.dot(x, y, z, tw > 0.7 ? C[6] : C[5], a) });
      if (tw > 0.5) lights.push([x, y, z, 4, C[5], 0.18 * a]);
    });
    for (const it of q.sort(items, (it) => [it.x, it.y, it.z])) it.fn();

    // the wail: a ring flung out round its mouth, level, from where it cried
    for (const [E, k, kk] of wails) q.ring(E.x, E.y - top + R + 5, E.z, 4 + 22 * kk, 1.6, C[5], 0.85 * (1 - k) ** 1.2);
    // light: a cold glow round it, the motes' glints, a faint streak down the path it took
    for (let k = 1; k <= 10; k++) {
      const P = at3(t - (k - 1) * 0.06, o.hover), Q = at3(t - k * 0.06, o.hover);
      q.glowLine(P.x, P.y - 9, P.z, Q.x, Q.y - 9, Q.z, 6, C[4], 0.1 * (1 - k / 11));
    }
    for (const l of lights) q.glow(...l);
    q.glow(S.x, S.y - top * 0.55, S.z, 48, C[3], 0.3);
    q.glow(S.x - 3, S.y - top * 0.72, S.z, 14, C[5], 0.12);
  },
};
