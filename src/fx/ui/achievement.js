import { Particles, Bits, Lights, P, B as BIT, Rng, fit, space, sparkle, star, clamp, seg, ease, rand, TAU, WHITE, hex } from "../../core/index.js";
import { spell, drawWord, panel } from "./_lib.js";

export const meta = {
  name: "Achievement",
  desc: "A toast slides in on speed lines and settles; a gold medal pops onto it in a burst of sparkles, a shine sweeps the whole toast, then it slides away.",
  tags: ["ui", "achievement", "toast", "medal", "reward", "text", "one-shot"],
  size: [220, 72],
  origin: [110, 36],
  duration: 2.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff"],
    ribbon: ["#0c1430", "#1f3a7a", "#2f66c4", "#5aa0f0", "#a6d4ff"],
    title: "ACHIEVEMENT",
    text: "UNLOCKED",
    seed: 9,
  },
};

const PW = 130, PH = 34, PX = -PW / 2, PY = -PH / 2, IN = 0.2, MEDAL = 0.26, SHINE = 0.95, OUT = 1.92;
const MX = PX + 17, MY = 2;
const INK = { outline: hex("#0d0a14"), rim: hex("#5a4f74"), top: hex("#2a2338"), body: hex("#211b2d"), low: hex("#15111c") };

// the medal: ribbon straps behind it, a scalloped-free gold disc with a lit rim and a raised star
function medal(p, G, B, x, y, s, white, shine) {
  const r = 10 * s;
  for (const sd of [-1, 1]) {
    // a strap from the medal up to the toast's top edge
    p.poly([[x + sd * 2 * s, y - r + 2], [x + sd * 7 * s, y - r + 2], [x + sd * 9 * s, PY + 1], [x + sd * 4 * s, PY + 1]], (px) => (Math.abs(px - x) < 4.5 * s ? B[2] : B[3]));
    p.line(x + sd * 2 * s, y - r + 2, x + sd * 4 * s, PY + 1, B[0]);
    p.line(x + sd * 7 * s, y - r + 2, x + sd * 9 * s, PY + 1, B[0]);
  }
  const st = star(x, y + 0.5, 2.8 * s, 6.5 * s, 5);
  const inStar = (px, py) => {
    let inside = false;
    for (let i = 0, j = st.length - 1; i < st.length; j = i++) {
      const [xi, yi] = st[i], [xj, yj] = st[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  p.shade(x - r - 1, y - r - 1, x + r + 1, y + r + 1, (px, py) => {
    const dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
    if (d > r) return;
    if (white) return r - d < 1 ? G[6] : WHITE;
    if (r - d < 1) return G[0];
    const l = -(dx * 0.6 + dy * 0.8) / r;
    if (shine !== null && Math.abs(dx - dy * 0.6 - shine) < 1.2) return WHITE;
    if (r - d < 2.5) return l > 0.2 ? G[6] : l > -0.3 ? G[4] : G[3];
    // the raised star: a dark edge, a lit upper-left face, a shaded lower-right one
    if (inStar(px, py)) return !inStar(px + 1, py) || !inStar(px - 1, py) || !inStar(px, py + 1) || !inStar(px, py - 1) ? G[2] : dx + dy < 0 ? G[7] : G[6];
    return l > 0.4 ? G[5] : l > -0.2 ? G[4] : G[3];
  });
}

export function create(o) {
  const G = fit(o.palette, 8), B = fit(o.ribbon, 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [G[7], G[6], G[5], G[3]] }), lights = new Lights();
  const title = spell(o.title, "mini"), sub = spell(o.text, "mini"), TX = PX + 34;
  let t = 0, popped = false;
  const end = meta.duration - 0.05;
  // the toast slides in from the right, overshoots and settles; at the end it eases back and slides off
  const xAt = (t) => (t < IN ? 30 * Math.pow(1 - t / IN, 3) : t < OUT ? -3 * Math.exp(-(t - IN) * 12) * Math.sin((t - IN) * 30) : seg(t, OUT, OUT + 0.06) < 1 ? -3 * seg(t, OUT, OUT + 0.06) : -3 + 33 * ease.inQuad(seg(t, OUT + 0.06, OUT + 0.24)));
  return {
    update(dt) {
      t += dt;
      if (!popped && t >= MEDAL + 0.06) {
        popped = true;
        lights.add(MX, MY, 36, G[5], 0.7, 0.4);
        for (let i = 0; i < 12; i++) {
          const an = (i / 12) * TAU + R.range(-0.2, 0.2), sp = R.range(40, 90);
          ps.spawn(P.STAR, MX + Math.cos(an) * 9, MY + Math.sin(an) * 9, Math.cos(an) * sp, Math.sin(an) * sp * 0.6, R.range(0.25, 0.45), R.pick([G[7], G[6], G[5]]), i % 3 ? 0.6 : R.range(1.2, 1.8));
        }
      }
      if (t > 0.5 && t < OUT && R.chance(0.05)) ps.spawn(P.STAR, MX + R.range(-11, 11), MY + R.range(-11, 9), 0, -R.range(4, 10), Math.min(R.range(0.3, 0.5), end - t), G[6], R.chance(0.3) ? 1.4 : 0.6);
      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      const x = xAt(t), out = t > OUT + 0.06, a = t < 0.05 ? 0.5 : out ? 1 - seg(t, OUT + 0.12, OUT + 0.24) : 1;
      if (a <= 0) return;
      // speed lines trail it while it moves
      const moving = t < IN * 0.8 || out;
      if (moving)
        for (let i = 0; i < 8; i++) {
          const y = PY + 3 + rand(Math.floor(t * 30), i, 1) * (PH - 6), L = 10 + rand(Math.floor(t * 30), i, 2) * 26, x0 = x + PW / 2 + 2 + rand(i, 3) * 6;
          p.line(x0, y, Math.min(106, x0 + L), y, (u) => (u < 0.3 ? WHITE : u < 0.6 ? G[6] : G[4]), (u) => a * (1.1 - u));
        }
      // the plate and its gold edge; a shine sweeps the whole toast
      const sh = seg(t, SHINE, SHINE + 0.36), shine = sh > 0 && sh < 1 ? PX - 12 + (PW + 30) * ease.inOutSine(sh) : null;
      panel(p, PX + x, PY, PW, PH, INK, { r: 4, a, shine: shine === null ? null : shine + x });
      p.line(PX + x + 4, PY + 1, PX + x + PW - 5, PY + 1, G[4], a);
      p.px(PX + x + 3, PY + 1, G[2]);
      // the words: a gold title, a white line under it
      const ti = title.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: TX + x + L.x * 2, y: PY + 5, sx: 2, sy: 2, a }));
      drawWord(p, ti, { fill: [G[4], G[5], G[6]], edge: G[7], under: G[3], outline: INK.outline, shadow: 0, shine: shine === null ? null : shine + x, shineY: PY, glint: G[7] });
      const si = sub.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: TX + x + L.x * 2, y: PY + 19, sx: 2, sy: 2, a }));
      drawWord(p, si, { fill: [hex("#9a94b0"), hex("#d8d4e6"), WHITE], edge: WHITE, under: hex("#6e6886"), outline: INK.outline, shadow: 0, shine: shine === null ? null : shine + x, shineY: PY });
      // the medal pops onto it: big and white for a frame, then springs to size
      const mk = t - MEDAL;
      if (mk > 0) {
        const s = mk < 0.035 ? 1.5 : 1 + 0.35 * Math.exp(-mk * 16) * Math.cos(mk * 28);
        medal(p, G, B, MX + x, MY, s, mk < 0.07, shine === null ? null : shine - MX + 4);
        p.glow(MX + x, MY, 20, G[5], 0.3 * a + (mk < 0.15 ? 0.5 * (1 - mk / 0.15) : 0));
        const g = ((t - 1.5) % 0.9) / 0.9;
        if (t > 1.5 && g < 0.25) sparkle(p, MX + x - 4, MY - 4, 4 * Math.sin((g / 0.25) * Math.PI), G[7], G[6], 0.5);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// ---- 3D: the toast floats in the world and slides in through depth -------------------------------------------------

// a billboard faces the camera: its screen-right and its way back to the camera, in world space
function frame3(c = {}) {
  const yaw = c.yaw ?? 0, pit = c.pitch ?? 0.3, cp = Math.cos(pit);
  return { rx: Math.cos(yaw), rz: -Math.sin(yaw), tx: Math.sin(yaw) * cp, ty: -Math.sin(pit), tz: Math.cos(yaw) * cp, cp };
}
// the world point u px right and v px down of P on the toast's own screen plane, w towards the camera
const onToast = (V, P, u, v, w = 0) => [P[0] + V.rx * u + V.tx * w, P[1] + v / V.cp + V.ty * w, P[2] + V.rz * u + V.tz * w];
const sphere = (R) => {
  const a = R.range(0, TAU), c = R.range(-1, 1), s = Math.sqrt(1 - c * c);
  return [Math.cos(a) * s, c, Math.sin(a) * s];
};

const H3 = -38, SLIDE = 1.25, DIR = [0.75, -0.66], LIFT = 7;

export const three = {
  meta: { size: [304, 120], origin: [152, 82], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const G = fit(o.palette, 8), Bn = fit(o.ribbon, 5), R = new Rng(o.seed), floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [G[7], G[6], G[5], G[3]] }), bits = new Bits({ ground: floor }), lights = new Lights();
    const title = spell(o.title, "mini"), sub = spell(o.text, "mini"), TX = PX + 34;
    let t = 0, popped = false;
    const end = meta.duration - 0.05;
    // the same slide as the 2D toast, run along a path through depth; it bobs a little once it has settled
    const xAt = (t) => (t < IN ? 30 * Math.pow(1 - t / IN, 3) : t < OUT ? -3 * Math.exp(-(t - IN) * 12) * Math.sin((t - IN) * 30) : seg(t, OUT, OUT + 0.06) < 1 ? -3 * seg(t, OUT, OUT + 0.06) : -3 + 33 * ease.inQuad(seg(t, OUT + 0.06, OUT + 0.24)));
    const spot = (t) => {
      const m = xAt(t) * SLIDE;
      return [m * DIR[0], H3 + (t > IN ? 1.4 * Math.sin((t - IN) * 4.2) : 0), m * DIR[1]];
    };
    const medalAt = (V, Pt) => onToast(V, Pt, MX, MY, LIFT);
    return {
      update(dt) {
        t += dt;
        const V = frame3(o.camera);
        if (!popped && t >= MEDAL + 0.06) {
          popped = true;
          const M = medalAt(V, spot(t));
          lights.add(M[0], M[1], 36, G[5], 0.7, 0.4, M[2]);
          // sparkles burst from the medal in a full sphere, gold flecks fall to the floor
          for (let i = 0; i < 20; i++) {
            const [dx, dy, dz] = sphere(R), sp = R.range(50, 110);
            ps.spawn3(P.STAR, M[0] + dx * 12, M[1] + dy * 12, M[2] + dz * 12, dx * sp, dy * sp, dz * sp, R.range(0.3, 0.5), R.pick([G[7], G[6], G[5]]), i % 3 ? 1.3 : R.range(2, 2.8));
          }
          for (let i = 0; i < 12; i++) {
            const [dx, dy, dz] = sphere(R), sp = R.range(100, 200);
            ps.spawn3(P.SPARK, M[0] + dx * 10, M[1] + dy * 10, M[2] + dz * 10, dx * sp, dy * sp - 20, dz * sp, R.range(0.16, 0.3));
          }
          for (let i = 0; i < 10; i++) {
            const [dx, dy, dz] = sphere(R), sp = R.range(40, 100);
            bits.add({ kind: BIT.SHARD, x: M[0] + dx * 8, y: M[1] + dy * 8, z: M[2] + dz * 8, vx: dx * sp, vy: dy * sp - 40, vz: dz * sp, g: 0.4, drag: 1.1, bounce: 0.3, life: R.range(0.7, 1.1), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.4, 2.4), c: R.pick([G[7], G[6], G[5], G[4]]) });
          }
        }
        if (t > 0.5 && t < OUT && R.chance(0.05)) {
          const M = medalAt(V, spot(t)), [dx, dy, dz] = sphere(R);
          ps.spawn3(P.STAR, M[0] + dx * 13, M[1] + dy * 11, M[2] + dz * 13, 0, -R.range(4, 10), 0, Math.min(R.range(0.3, 0.5), end - t), G[6], R.chance(0.3) ? 1.4 : 0.6);
        }
        bits.update(dt);
        ps.update(dt);
        lights.update(dt);
      },

      draw(p) {
        const q = space(p, o), V = frame3(q.camera);
        const out = t > OUT + 0.06, a = t < 0.05 ? 0.5 : out ? 1 - seg(t, OUT + 0.12, OUT + 0.24) : 1;
        if (a <= 0) return;
        const Pt = spot(t), [px, py, pz] = Pt, M = medalAt(V, Pt);
        const sh = seg(t, SHINE, SHINE + 0.36), shine = sh > 0 && sh < 1 ? PX - 12 + (PW + 30) * ease.inOutSine(sh) : null;
        const mk = t - MEDAL;
        // the plate, its words and the medal, all on one billboard; the medal stands proud of the plate
        q.at(px, py, pz, (pp) => {
          // a dark card a little behind the plate, so it has an edge in depth
          pp.z += 4;
          panel(pp, PX + 2, PY + 3, PW, PH, { outline: INK.low, rim: INK.low, top: INK.low, body: INK.low, low: INK.low }, { r: 4, a: 0.55 * a });
          pp.z -= 4;
          panel(pp, PX, PY, PW, PH, INK, { r: 4, a, shine });
          pp.line(PX + 4, PY + 1, PX + PW - 5, PY + 1, G[4], a);
          pp.px(PX + 3, PY + 1, G[2]);
          const ti = title.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: TX + L.x * 2, y: PY + 5, sx: 2, sy: 2, a }));
          drawWord(pp, ti, { fill: [G[4], G[5], G[6]], edge: G[7], under: G[3], outline: INK.outline, shadow: 0, shine, shineY: PY, glint: G[7] });
          const si = sub.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: TX + L.x * 2, y: PY + 19, sx: 2, sy: 2, a }));
          drawWord(pp, si, { fill: [hex("#9a94b0"), hex("#d8d4e6"), WHITE], edge: WHITE, under: hex("#6e6886"), outline: INK.outline, shadow: 0, shine, shineY: PY });
          if (mk > 0) {
            const s = mk < 0.035 ? 1.5 : 1 + 0.35 * Math.exp(-mk * 16) * Math.cos(mk * 28);
            pp.z -= LIFT;
            medal(pp, G, Bn, MX, MY, s, mk < 0.07, shine === null ? null : shine - MX + 4);
            const g = ((t - 1.5) % 0.9) / 0.9;
            if (t > 1.5 && g < 0.25) sparkle(pp, MX - 4, MY - 4, 4 * Math.sin((g / 0.25) * Math.PI), G[7], G[6], 0.5);
            pp.z += LIFT;
          }
        });
        bits.draw(q);
        // speed lines are real lines through depth, trailing behind the toast's path
        const moving = t < IN * 0.8 || out, tr = out ? -1 : 1, side = (DIR[0] * V.rx + DIR[1] * V.rz) * tr >= 0 ? 1 : -1;
        if (moving)
          for (let i = 0; i < 9; i++) {
            const f = Math.floor(t * 30), v = PY + 3 + rand(f, i, 2) * (PH - 6), L = 10 + rand(f, i, 3) * 26, s0 = 1 + rand(i, 4) * 6;
            // they start at the edge of the plate it is moving away from, and stream on along the path
            const [x0, y0, z0] = onToast(V, Pt, side * (PW / 2 + 2 + rand(i, 5) * 8), v);
            q.line(x0 + DIR[0] * s0 * tr, y0, z0 + DIR[1] * s0 * tr, x0 + DIR[0] * (s0 + L) * tr, y0, z0 + DIR[1] * (s0 + L) * tr, (w) => (w < 0.3 ? WHITE : w < 0.6 ? G[6] : G[4]), (w) => a * (1.1 - w));
          }
        // under the toast: a soft shadow, a ring of gold dashes turning on the floor, and a ring that runs out when the medal lands
        q.plane(px, 0, pz, null, 46, (u, v, o2) => {
          const d = Math.hypot(u, v) / 46;
          if (d > 1) return;
          o2.c = INK.outline;
          o2.a = 0.55 * a * (1 - d * d);
          o2.blend = true;
        });
        q.ring(px, 0, pz, 40, 2.5, (v) => (v > 0.5 ? G[5] : G[3]), (v, g) => (((g + t * 0.9 + 20 * TAU) % (TAU / 9)) < (TAU / 9) * 0.55 ? a : 0));
        if (mk > 0.06 && mk < 0.5) {
          const rk = (mk - 0.06) / 0.44, r = 34 + 30 * ease.outCubic(rk);
          q.ring(px, 0, pz, r, 2.5 * (1 - rk) + 1, rk < 0.25 ? WHITE : G[5], (1.1 - rk) * a);
          q.ring(M[0], M[1], M[2], 8 + 18 * ease.outCubic(rk), 2 * (1 - rk) + 1, rk < 0.2 ? WHITE : G[6], (1.1 - rk) * a, [V.tx, V.ty, V.tz]);
        }
        // a halo turns round the medal: its far half goes behind the medal, its near half in front
        if (mk > 0.2 && t < OUT) {
          q.ring(M[0], M[1], M[2], 15, 1.5, G[5], 0.55 * a);
          for (let i = 0; i < 3; i++) {
            const ph = mk * 3.6 + (i * TAU) / 3;
            q.at(M[0] + Math.cos(ph) * 15, M[1], M[2] + Math.sin(ph) * 15, (pp) => sparkle(pp, 0, 0, 2.5, G[7], G[6], 0.5));
          }
        }
        ps.draw(q);
        if (mk > 0) q.glow(M[0], M[1], M[2], 20, G[5], 0.3 * a + (mk < 0.15 ? 0.5 * (1 - mk / 0.15) : 0));
        lights.draw(q);
      },
    };
  },
};
