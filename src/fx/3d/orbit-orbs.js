import { space, lit, fit, cycle, TAU, WHITE, PAL } from "../../core/index.js";

export const meta = {
  name: "Orbit orbs",
  desc: "Three shaded orbs circle the character on a tilted orbit, passing behind him and in front, trailing light and motes.",
  tags: ["3d", "aura", "buff", "orbit", "arcane", "shield", "loop"],
  size: [96, 80],
  origin: [48, 62],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  camera: { pitch: 0.3 },
  options: { palette: PAL.arcane, count: 3, radius: 19, height: 20, tilt: 0.38, seed: 4 },
};

export function draw(p, t, o) {
  const q = space(p, o), C = fit(o.palette, 8), ph = t / meta.duration, R = o.radius, H = -o.height, tl = o.tilt;
  const st = Math.sin(tl), ct = Math.cos(tl), shade = lit(C.slice(1));
  const at = (a) => [Math.cos(a) * R, H + Math.sin(a) * R * st, Math.sin(a) * R * ct];
  // how far behind the nearest orb a point of the orbit is, as a fraction of a turn
  const behind = (g) => {
    let near = 1;
    for (let i = 0; i < o.count; i++) {
      const lead = ph * TAU + (i * TAU) / o.count;
      near = Math.min(near, ((((lead - g) % TAU) + TAU) % TAU) / TAU);
    }
    return near;
  };
  // the orbit itself: a thin ring on the tilted plane, brighter where the orbs have just been
  q.ring(0, H, 0, R + 0.5, 1, (v, g) => {
    const b = behind(g);
    return b < 0.08 ? C[6] : b < 0.2 ? C[5] : C[3];
  }, (v, g) => {
    const b = behind(g);
    return b < 0.35 ? 1 - b * 1.6 : 0.3;
  }, [0, -ct, st]);
  // the orbs, nearest first so a glow behind one never lights the one in front; light goes on after
  const orbs = q.sort(Array.from({ length: o.count }, (_, i) => ph * TAU + (i * TAU) / o.count), at).reverse();
  for (const a of orbs) {
    const [x, y, z] = at(a);
    q.ball(x, y, z, 3.2, shade);
    // a glint on the face turned to us, whichever way the camera looks
    q.at(x, y, z, (pp) => ((pp.z -= 3.5), pp.px(-1, -1, WHITE)));
    // a trail: segments back along the orbit, thinning out
    for (let j = 1; j <= 8; j++) {
      const [x0, y0, z0] = at(a - (j - 1) * 0.12), [x1, y1, z1] = at(a - j * 0.12), u = j / 8;
      q.line(x0, y0, z0, x1, y1, z1, u < 0.35 ? C[6] : u < 0.7 ? C[5] : C[4], 1.15 - u);
    }
  }
  for (const a of orbs) {
    const [x, y, z] = at(a);
    for (let j = 1; j < 4; j++) q.glow(...at(a - j * 0.12), 5, C[5], 0.12 * (1 - j / 8));
    q.glow(x, y, z, 14, C[5], 0.4);
  }
  // motes shed along the orbit, drifting out and fading
  cycle(t, meta.duration, 18, o.seed, 0.9, (age, life, r) => {
    const k = age / life, [x, y, z] = at(r.range(0, TAU)), s = 1 + k * r.range(0.15, 0.4);
    q.dot(x * s, y - k * r.range(4, 10), z * s, k < 0.4 ? C[6] : C[4], 1.2 - k);
  });
}
