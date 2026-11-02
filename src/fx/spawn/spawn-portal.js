// The streaks pulled in, the rings and lights at the burst and the collapse pop are adapted from Sprite
// Fusion's open-source black-hole (https://www.spritefusion.com/pixel-art-vfx/black-hole),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, band, sparkle, flare, clamp, smooth, ease, noise, space, TAU, WHITE, hex, mix } from "../../core/index.js";
import { floorBand, toward } from "./_lib.js";

export const meta = {
  name: "Spawn portal",
  desc: "A rift tears open on the floor and swirls, belches violet smoke and sparks, spits a fountain of wisps up out of itself, then twists shut with a pop.",
  tags: ["spawn", "portal", "summon", "rift", "arcane", "smoke", "ground", "one-shot"],
  size: [208, 150],
  origin: [104, 122],
  duration: 3.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#12081f", "#2a0f4d", "#481b8c", "#7330d0", "#a35cff", "#cf9bff", "#f1dcff", "#ffffff"],
    width: 28,
    seed: 6,
  },
};

const OPEN = 0.3, BELCH = [0.52, 0.76], BURST = 1.0, SHUT = 1.9, POP = 2.22, SY = 0.34;
const VOID = hex("#06030b"), FUME = hex("#3a3046"), STONE = ["#1a1424", "#2b2639", "#4a4263", "#6c6488", "#9a91b4"].map(hex), DUST = hex("#5a5070");

// the rift's size over its life: a tear that snaps open past round, breathes, swells as it shuts, then collapses
function radius(t, RX) {
  if (t < OPEN) return RX * ease.outBack(clamp(t / OPEN), 2.2);
  if (t < SHUT) return RX * (1 + 0.035 * Math.sin(t * 9) + 0.1 * Math.exp(-((t - BURST - 0.05) ** 2) / 0.006));
  const k = clamp((t - SHUT) / (POP - SHUT));
  return RX * (k < 0.35 ? 1 + 0.1 * Math.sin((k / 0.35) * Math.PI * 0.5) : 1.1 * (1 - Math.pow((k - 0.35) / 0.65, 1.6)));
}
// how far the swirl has turned: lazy, then whipping round as it shuts
const spinAt = (t) => t * 2.4 + 1.5 * smooth(BURST - 0.1, BURST + 0.3, t) + 10 * Math.pow(clamp((t - SHUT) / (POP - SHUT)), 2.2);
const lipAt = (th, spin) => 1 + 0.05 * noise(th * 3 + spin * 0.6, 5) + 0.035 * noise(th * 8 - spin * 1.3, 9);

// the hole: a void, a lit far wall, three arms of light spiralling down into it
function hole(p, C, rx, spin, heat, wind = 2.3) {
  if (rx < 1) return;
  const ry = rx * SY;
  p.shade(-rx - 2, -ry - 2, rx + 2, ry + 2, (x, y, out) => {
    const u = x / rx, v = y / ry, q = Math.hypot(u, v), th = Math.atan2(v, u), lip = lipAt(th, spin);
    if (q > lip) return;
    const w = q / lip;
    // the far inner wall catches the glow from below; the near one is hidden
    out.c = v < 0 && w > 0.72 ? (w > 0.86 ? C[2] : C[1]) : w > 0.55 ? C[0] : VOID;
  });
  const n = Math.max(40, Math.round(rx * 5));
  for (let i = 0; i < 3; i++)
    for (let j = 0; j <= n; j++) {
      const q = 0.14 + 0.82 * (j / n), th = spin + (i * TAU) / 3 - wind * Math.log(q), lip = lipAt(th, spin);
      const x = Math.cos(th) * q * lip * rx, y = Math.sin(th) * q * lip * ry;
      const c = q > 0.8 ? (heat > 1.1 ? WHITE : C[6]) : q > 0.55 ? C[5] : q > 0.32 ? C[4] : C[3];
      p.dot(x, y, c, q > 0.3 ? 1 : q / 0.3);
      // a fainter strand riding just inside each arm
      if (q > 0.4 && j % 2 === 0) {
        const t2 = th - 0.32, x2 = Math.cos(t2) * q * 0.94 * lip * rx, y2 = Math.sin(t2) * q * 0.94 * lip * ry;
        p.dot(x2, y2, q > 0.7 ? C[4] : C[3], 0.85);
      }
    }
  p.glow(0, 0, rx * 0.45, C[3], 0.35 * heat);
}

// the lip: a ragged ring of white-hot light, a dark cut outside it; far half behind, near half in front
function lip(p, C, rx, spin, heat, near) {
  if (rx < 1) return;
  const ry = rx * SY, n = Math.ceil(rx * 7);
  for (let j = 0; j < n; j++) {
    const th = (j / n) * TAU, s = Math.sin(th);
    if ((s >= 0) !== near) continue;
    const l = lipAt(th, spin), x = Math.cos(th) * rx * l, y = s * ry * l, f = noise(th * 9 + spin * 3, 13);
    p.dot(Math.cos(th) * (rx * l + 1.2), s * (ry * l + 1), C[1]);
    p.dot(x, y, near ? (f > -0.3 || heat > 1.1 ? WHITE : C[6]) : f > 0.2 ? C[6] : C[5]);
    if (j % 6 === 0) p.glow(x, y, 7, C[5], (near ? 0.3 : 0.2) * Math.min(1.4, heat));
  }
}

export function create(o) {
  const C = fit(o.palette, 8), RX = o.width, R = new Rng(o.seed), floor = () => 0;
  // violet smoke, dulled toward a smoky grey so it reads as smoke and not as glass
  const SM = [mix(C[4], FUME, 0.4), mix(C[3], FUME, 0.3), mix(C[5], FUME, 0.55)];
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[3]] });
  const rocks = new Bits({ ground: floor }), lights = new Lights();
  const swirl = [], wisps = [], rings = [];
  const done = {};
  let t = 0;

  // a mote riding the swirl on the floor plane, spiralling in
  const addSwirl = (r0) => swirl.push({ a: R.range(0, TAU), r: r0, w: R.range(2.2, 4), in: R.range(0.3, 0.7), c: R.pick([WHITE, C[6], C[6], C[5]]) });
  // a streak of light sucked in from the air round the rift
  const pull = () => {
    const a = R.range(Math.PI * 1.03, Math.PI * 1.97), D = R.range(40, 86), T = R.range(0.24, 0.42);
    const x = Math.cos(a) * D * 1.08, y = Math.sin(a) * D * 0.85, l = Math.hypot(x, y), v = (0.6 * l) / (1 - Math.exp(-0.6 * T));
    ps.spawn(P.MOTE, x, y, (-x / l) * v, (-y / l) * v, T, R.pick([WHITE, C[6], C[5], C[5], C[4]]), R.range(1, 1.7));
  };
  const puff = (n, big, sp) => {
    for (let i = 0; i < n; i++) {
      const a = R.range(0, TAU), d = R.range(0, 0.55) * RX;
      ps.spawn(P.SMOKE, Math.cos(a) * d, Math.sin(a) * d * SY - 2, R.range(-1, 1) * sp * 0.6, -R.range(0.4, 1) * sp, R.range(1.2, 2.2) * (big ? 1.15 : 0.8), R.pick(SM), R.range(2.8, 4.6) * (big ? 1.15 : 0.9), big ? R.range(0, 0.3) : R.range(0, 0.1), big ? PF.BIG : 0);
    }
  };
  const sparks = (n, up, spread) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + R.range(-spread, spread), sp = R.range(0.5, 1) * up;
      ps.spawn(P.SPARK, R.range(-0.5, 0.5) * RX, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.35, 0.8));
    }
  };
  const once = (k, at) => !done[k] && t >= at && (done[k] = true);

  return {
    update(dt) {
      t += dt;
      // the tear pulls dust and light in while it opens, while it's open, and hard while it shuts
      const shutting = t > SHUT && t < POP;
      if ((t < OPEN + 0.15 || shutting) && R.chance(0.55)) {
        const s = R.sign(), D = R.range(RX * 1.3, RX * 2.4), T = R.range(0.18, 0.3), v = (D * 3) / (Math.exp(3 * T) - 1);
        ps.spawn(P.STREAK, s * D, -R.range(0, 3), -s * v, R.range(-2, 2), T, R.chance(0.5) ? C[6] : C[5]);
      }
      if (t > 0.1 && t < POP - 0.1 && R.chance(shutting ? 0.85 : t < BURST ? 0.55 : 0.1)) pull();
      if (t < POP && t > 0.12 && R.chance(shutting ? 0.5 : 0.25)) addSwirl(R.range(1.1, 1.5));
      if (once("open", OPEN * 0.7)) {
        lights.add(0, -8, 50, C[4], 0.75, 0.45);
        rings.push({ t0: t, life: 0.42, r0: RX * 0.8, r1: RX * 1.9, th: 2.5, hot: true });
        for (let i = 0; i < 8; i++) ps.spawn(P.DUST, R.sign() * R.range(0.7, 1.1) * RX, -1, R.sign() * R.range(10, 45), -R.range(4, 14), R.range(0.4, 0.7), DUST, R.range(1.5, 3));
      }
      // two small belches before the big one: a burp of smoke and a few sparks
      if (once("b0", BELCH[0])) puff(6, false, 34), sparks(8, 210, 0.55), lights.add(0, -6, 44, C[4], 0.6, 0.3);
      if (once("b1", BELCH[1])) puff(8, false, 40), sparks(12, 240, 0.6), lights.add(0, -6, 48, C[4], 0.65, 0.3);
      // the burst: something comes up through it
      if (once("burst", BURST)) {
        lights.add(0, -26, 74, C[4], 1, 0.75);
        lights.add(0, -10, 40, WHITE, 0.85, 0.14);
        rings.push({ t0: t, life: 0.55, r0: RX * 1.0, r1: RX * 2.5, th: 3.5, hot: true }, { t0: t + 0.06, life: 0.45, r0: RX * 0.8, r1: RX * 1.8, th: 2, hot: false });
        puff(18, true, 70);
        sparks(34, 400, 0.8);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.27 + R.range(-0.08, 0.08), sp = R.range(185, 235);
          wisps.push({ x: R.range(-4, 4), y: -2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: R.range(0.75, 1.0), max: 1, tr: [], acc: 0, ph: R.range(0, TAU) });
        }
        for (let i = 0; i < 12; i++)
          rocks.add({ kind: B.CHUNK, x: R.sign() * R.range(0.75, 1.05) * RX, y: -1, vx: R.range(-100, 100), vy: -R.range(150, 280), g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.3, 1.9), a: R.range(0, TAU), va: R.range(-14, 14), s: R.range(1, 2.4), ramp: STONE });
        for (let i = 0; i < 14; i++) ps.spawn(P.STAR, R.range(-0.8, 0.8) * RX, -R.range(4, 34), R.range(-30, 30), -R.range(10, 60), R.range(0.5, 1.1), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 2));
      }
      // while it's open it keeps venting thin smoke and the odd spark
      if (t > OPEN && t < SHUT && R.chance(0.16)) puff(1, false, 22);
      if (t > OPEN && t < SHUT + 0.1 && R.chance(0.06)) sparks(1, 160, 0.4);
      // the pop when it closes
      if (once("pop", POP)) {
        lights.add(0, -4, 50, C[4], 0.95, 0.5);
        lights.add(0, -2, 28, WHITE, 0.9, 0.12);
        rings.push({ t0: t, life: 0.35, r0: 2, r1: RX * 1.9, th: 2.5, hot: true });
        for (let i = 0; i < 18; i++) {
          const a = R.range(-Math.PI, 0), sp = R.range(90, 270);
          ps.spawn(P.SPARK, 0, -1, Math.cos(a) * sp, Math.sin(a) * sp * 0.8, R.range(0.25, 0.6));
        }
        for (let i = 0; i < 9; i++) {
          const a = R.range(0, TAU), sp = R.range(30, 95);
          ps.spawn(P.STAR, 0, -2, Math.cos(a) * sp, Math.sin(a) * sp * 0.5 - 20, R.range(0.4, 0.9), R.pick([WHITE, C[6]]), R.range(0.8, 1.8));
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.SMOKE, R.range(-6, 6), -R.range(1, 4), R.range(-34, 34), -R.range(10, 30), R.range(0.8, 1.3), SM[2], R.range(2.5, 4.5));
        // what's left on the floor: specks of light that twinkle out where the rift was
        for (let i = 0; i < 14; i++) ps.spawn(P.STAR, R.range(-1, 1) * RX * 0.9, -R.range(0.5, 2), R.range(-4, 4), -R.range(0, 4), R.range(0.6, 1.4), R.pick([C[6], C[5], C[5]]), R.range(0.4, 0.9), R.range(0, 0.25));
      }
      for (let i = swirl.length - 1; i >= 0; i--) {
        const s = swirl[i], k = shutting ? 2.4 : 1;
        s.a += s.w * k * dt * (1.4 / Math.max(0.3, s.r));
        s.r -= s.in * k * dt;
        if (s.r < 0.25 || t > POP) swirl.splice(i, 1);
      }
      // the wisps: comets with smoky tails that arc up and out, then burst
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i];
        w.tr.unshift([w.x, w.y]);
        if (w.tr.length > 12) w.tr.pop();
        // a wisp bursts when it runs out or comes down on the floor
        if ((w.life -= dt) <= 0 || (w.vy > 0 && w.y > -2)) {
          for (let j = 0; j < 8; j++) {
            const a = R.range(0, TAU), sp = R.range(30, 120);
            ps.spawn(P.SPARK, w.x, w.y, Math.cos(a) * sp + w.vx * 0.2, Math.sin(a) * sp + w.vy * 0.2, R.range(0.2, 0.5));
          }
          ps.spawn(P.STAR, w.x, w.y, 0, -6, 0.45, WHITE, 2.4);
          lights.add(w.x, w.y, 24, C[5], 0.65, 0.25);
          wisps.splice(i, 1);
          continue;
        }
        w.vy += 360 * dt;
        w.vx += Math.sin((w.max - w.life) * 16 + w.ph) * 160 * dt;
        w.vx -= w.vx * 1.1 * dt;
        w.vy -= w.vy * 1.1 * dt;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        for (w.acc += dt; w.acc > 0.03; w.acc -= 0.03) ps.spawn(P.SMOKE, w.x, w.y, w.vx * 0.05, w.vy * 0.05 - 4, R.range(0.6, 1), SM[0], R.range(1.5, 2.4));
        if (R.chance(0.3)) ps.spawn(P.MOTE, w.x, w.y, -w.vx * 0.2 + R.range(-15, 15), -w.vy * 0.2 + R.range(-15, 15), R.range(0.2, 0.4), C[6], 0.6);
      }
      for (let i = rings.length - 1; i >= 0; i--) if (t - rings[i].t0 > rings[i].life) rings.splice(i, 1);
      rocks.update(dt);
      for (const b of rocks.list)
        if (b.rest && !b.dusted) {
          b.dusted = true;
          for (let i = 0; i < 2; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(6, 30), -R.range(2, 12), R.range(0.3, 0.6), DUST, R.range(1.2, 2.4));
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const rx = radius(t, RX), spin = spinAt(t), heat = 0.85 + 0.15 * Math.sin(t * 7) + 0.6 * Math.exp(-((t - BURST) ** 2) / 0.01);
      // the floor glows violet round the hole
      if (t < POP) {
        p.glow(0, -4, rx * 1.8 + 10, C[4], 0.32 * clamp(rx / RX));
        // and light wells up out of it into the air
        p.glowLine(0, -2, 0, -44, rx * 0.7 + 6, C[4], 0.16 * clamp(rx / RX));
      }
      // the slit it tears open from
      if (t < OPEN * 0.6) {
        const k = t / (OPEN * 0.6), L = RX * 1.1 * ease.outCubic(k);
        p.line(-L, 0, L, 0, (u) => (Math.abs(u - 0.5) < 0.3 ? WHITE : C[6]));
        p.glowLine(-L, 0, L, 0, 7, C[5], 0.6);
      }
      if (t > OPEN * 0.35 && t < POP) {
        // the arms wind tighter as it twists shut
        hole(p, C, rx, spin, heat + 0.4 * smooth(SHUT, POP, t), 2.3 + 2.6 * smooth(SHUT, POP - 0.05, t));
        lip(p, C, rx, spin, heat, false);
      }
      for (const r of rings) ring(p, C, r, t, false);
      drawSwirl(p, false);
      ps.draw(p, "back");
    },
    draw(p) {
      const rx = radius(t, RX), spin = spinAt(t), heat = 0.85 + 0.15 * Math.sin(t * 7) + 0.6 * Math.exp(-((t - BURST) ** 2) / 0.01);
      if (t > OPEN * 0.35 && t < POP) lip(p, C, rx, spin, heat, true);
      for (const r of rings) ring(p, C, r, t, true);
      drawSwirl(p, true);
      // the burst: a column of light shoots up out of the hole, thins and lifts away
      const b = t - BURST;
      if (b > 0 && b < 0.45) {
        const k = b / 0.45, top = -84 * ease.outExpo(clamp(b / 0.14)), bot = -1 - 60 * ease.inQuad(k), w0 = RX * 0.55 * (1 - k * 0.8);
        p.shade(-w0 - 1, top, w0 + 1, bot, (x, y, out) => {
          const u = (y - bot) / (top - bot), half = w0 * Math.pow(1 - u, 0.8) * (0.85 + 0.15 * Math.sin(y * 0.7 + t * 40));
          const d = Math.abs(x) / Math.max(0.5, half);
          if (d > 1) return;
          out.c = d < 0.35 ? WHITE : d < 0.7 ? C[6] : C[5];
        });
        p.glowLine(0, bot, 0, top, w0 + 12, C[5], 0.55 * (1 - k));
        if (b < 0.14) flare(p, 0, -4, 36 * (1 - b / 0.14), 1 - b / 0.14, C);
      }
      // the collapse: a white point that pops
      const q = t - POP;
      if (q > -0.08 && q < 0.25) sparkle(p, 0, -1, Math.round((q < 0 ? 4 : 12) * (1 - clamp(q / 0.25))), WHITE, C[5], 0.7 * (1 - clamp(q / 0.25)));
      rocks.draw(p);
      for (const w of wisps) {
        const k = w.life / w.max;
        for (let i = 1; i < w.tr.length; i++) {
          const [x0, y0] = w.tr[i - 1], [x1, y1] = w.tr[i], u = i / w.tr.length;
          p.line(x0, y0, x1, y1, u < 0.25 ? WHITE : u < 0.55 ? C[6] : C[4], 1.15 - u);
          if (u < 0.35) p.line(x0 + 1, y0, x1 + 1, y1, C[5], 1);
        }
        p.circle(w.x, w.y, 2, C[5]);
        p.circle(w.x, w.y, 1.2, C[6]);
        p.px(w.x, w.y, WHITE);
        p.glow(w.x, w.y, 12, C[5], 0.5 * k + 0.2);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };

  function drawSwirl(p, near) {
    const rx = radius(t, RX);
    for (const s of swirl) {
      for (let j = 0; j < 3; j++) {
        const a = s.a - j * 0.08 * (1.4 / Math.max(0.3, s.r)), x = Math.cos(a) * s.r * rx, y = Math.sin(a) * s.r * rx * SY;
        if ((Math.sin(a) >= 0) !== near) continue;
        p.dot(x, y - 0.5, j ? C[5] : s.c, j ? 0.9 - j * 0.3 : 1);
        if (!j) p.glow(x, y, 3, C[5], 0.35);
      }
    }
  }
}

// a shock ring on the floor plane: far half behind, near half in front
function ring(p, C, r, t, near) {
  const k = (t - r.t0) / r.life;
  if (k < 0 || k >= 1) return;
  band(p, 0, 0, r.r0 + (r.r1 - r.r0) * ease.outCubic(k), SY * 0.62, Math.max(1, r.th * (1 - k)), 1.15 - k, C, (g) => (Math.sin(g) >= 0) === near, r.hot && k < 0.15);
}

// 3D: the rift is a true circular hole in the floor. Its void, the lit far wall (the side away from the camera) and
// three arms of light spiralling down into it are shaded on the floor plane; its lip is a ragged ring in space with
// the far half behind and the near half in front. The shock rings are true circles, the swirl and the dust ride the
// floor, smoke and sparks come up round the whole mouth, the pillar of light is a real column, and the wisps are
// comets that arc up and out each its own way before they burst.
export const three = {
  meta: { size: [208, 150], origin: [104, 122], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), RX = o.width, R = new Rng(o.seed), floor = () => 0;
    const SM = [mix(C[4], FUME, 0.4), mix(C[3], FUME, 0.3), mix(C[5], FUME, 0.55)];
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[3]] });
    const rocks = new Bits({ ground: floor }), lights = new Lights();
    const swirl = [], wisps = [], rings = [];
    const done = {};
    let t = 0;

    // a point on the floor round the mouth: [x, z] at radius r, angle a
    const onRim = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
    const addSwirl = (r0) => swirl.push({ a: R.range(0, TAU), r: r0, w: R.range(2.2, 4), in: R.range(0.3, 0.7), c: R.pick([WHITE, C[6], C[6], C[5]]) });
    // a streak of light sucked in from the air round the rift, from anywhere over it
    const pull = () => {
      const az = R.range(0, TAU), el = R.range(0.1, 1.45), D = R.range(40, 86), T = R.range(0.24, 0.42);
      const x = Math.cos(az) * Math.cos(el) * D * 1.08, y = -Math.sin(el) * D * 0.85, z = Math.sin(az) * Math.cos(el) * D * 1.08, l = Math.hypot(x, y, z), v = (0.6 * l) / (1 - Math.exp(-0.6 * T));
      ps.spawn3(P.MOTE, x, y, z, (-x / l) * v, (-y / l) * v, (-z / l) * v, T, R.pick([WHITE, C[6], C[5], C[5], C[4]]), R.range(1, 1.7));
    };
    const puff = (n, big, sp) => {
      for (let i = 0; i < n; i++) {
        const a = R.range(0, TAU), d = R.range(0, 0.55) * RX, [x, z] = onRim(a, d), h = R.range(0, TAU), hs = R.range(0, 0.6) * sp;
        ps.spawn3(P.SMOKE, x, -2, z, Math.cos(h) * hs, -R.range(0.4, 1) * sp, Math.sin(h) * hs, R.range(1.2, 2.2) * (big ? 1.15 : 0.8), R.pick(SM), R.range(2.8, 4.6) * (big ? 1.15 : 0.9), big ? R.range(0, 0.3) : R.range(0, 0.1), big ? PF.BIG : 0);
      }
    };
    const sparks = (n, up, spread) => {
      for (let i = 0; i < n; i++) {
        const tilt = R.range(0, spread), az = R.range(0, TAU), sp = R.range(0.5, 1) * up, [x, z] = onRim(R.range(0, TAU), R.range(0, 0.5) * RX);
        ps.spawn3(P.SPARK, x, -1, z, Math.sin(tilt) * Math.cos(az) * sp, -Math.cos(tilt) * sp, Math.sin(tilt) * Math.sin(az) * sp, R.range(0.35, 0.8));
      }
    };
    const once = (k, at) => !done[k] && t >= at && (done[k] = true);
    // a direction over the upper half of the sphere, [x, y, z] unit, y up negative
    const dome = (lo = 0.05, hi = 1.5) => {
      const az = R.range(0, TAU), el = R.range(lo, hi);
      return [Math.cos(az) * Math.cos(el), -Math.sin(el), Math.sin(az) * Math.cos(el)];
    };

    return {
      update(dt) {
        t += dt;
        const shutting = t > SHUT && t < POP;
        // the tear pulls dust and light in while it opens, while it's open, and hard while it shuts, from every side along the floor
        if ((t < OPEN + 0.15 || shutting) && R.chance(0.55)) {
          const a = R.range(0, TAU), D = R.range(RX * 1.3, RX * 2.4), T = R.range(0.18, 0.3), v = (D * 3) / (Math.exp(3 * T) - 1);
          ps.spawn3(P.STREAK, Math.cos(a) * D, -R.range(0, 3), Math.sin(a) * D, -Math.cos(a) * v, R.range(-2, 2), -Math.sin(a) * v, T, R.chance(0.5) ? C[6] : C[5]);
        }
        if (t > 0.1 && t < POP - 0.1 && R.chance(shutting ? 0.85 : t < BURST ? 0.55 : 0.1)) pull();
        if (t < POP && t > 0.12 && R.chance(shutting ? 0.5 : 0.25)) addSwirl(R.range(1.1, 1.5));
        if (once("open", OPEN * 0.7)) {
          lights.add(0, -8, 50, C[4], 0.75, 0.45, 0);
          rings.push({ t0: t, life: 0.42, r0: RX * 0.8, r1: RX * 1.9, th: 2.5, hot: true });
          for (let i = 0; i < 8; i++) {
            const a = R.range(0, TAU), [x, z] = onRim(a, R.range(0.7, 1.1) * RX), sp = R.range(10, 45);
            ps.spawn3(P.DUST, x, -1, z, Math.cos(a) * sp, -R.range(4, 14), Math.sin(a) * sp, R.range(0.4, 0.7), DUST, R.range(1.5, 3));
          }
        }
        // two small belches before the big one: a burp of smoke and a few sparks
        if (once("b0", BELCH[0])) puff(6, false, 34), sparks(8, 210, 0.55), lights.add(0, -6, 44, C[4], 0.6, 0.3, 0);
        if (once("b1", BELCH[1])) puff(8, false, 40), sparks(12, 240, 0.6), lights.add(0, -6, 48, C[4], 0.65, 0.3, 0);
        // the burst: something comes up through it
        if (once("burst", BURST)) {
          lights.add(0, -26, 74, C[4], 1, 0.75, 0);
          lights.add(0, -10, 40, WHITE, 0.85, 0.14, 0);
          rings.push({ t0: t, life: 0.55, r0: RX * 1.0, r1: RX * 2.5, th: 3.5, hot: true }, { t0: t + 0.06, life: 0.45, r0: RX * 0.8, r1: RX * 1.8, th: 2, hot: false });
          puff(18, true, 70);
          sparks(34, 400, 0.8);
          // five comets, fanned out round the mouth, each arcing up and out its own way
          for (let i = 0; i < 5; i++) {
            const az = (i / 5) * TAU + R.range(-0.25, 0.25), tilt = R.range(0.1, 0.55), sp = R.range(185, 235);
            wisps.push({ x: Math.cos(az) * 3, y: -2, z: Math.sin(az) * 3, vx: Math.sin(tilt) * Math.cos(az) * sp, vy: -Math.cos(tilt) * sp, vz: Math.sin(tilt) * Math.sin(az) * sp, az, life: R.range(0.75, 1.0), max: 1, tr: [], acc: 0, ph: R.range(0, TAU) });
          }
          for (let i = 0; i < 12; i++) {
            const a = R.range(0, TAU), [x, z] = onRim(a, R.range(0.75, 1.05) * RX), sp = R.range(20, 100);
            rocks.add({ kind: B.CHUNK, x, y: -1, z, vx: Math.cos(a) * sp + R.range(-30, 30), vz: Math.sin(a) * sp + R.range(-30, 30), vy: -R.range(150, 280), g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.3, 1.9), a: R.range(0, TAU), va: R.range(-14, 14), s: R.range(1, 2.4), ramp: STONE });
          }
          for (let i = 0; i < 14; i++) {
            const [x, z] = onRim(R.range(0, TAU), Math.sqrt(R.next()) * 0.8 * RX);
            ps.spawn3(P.STAR, x, -R.range(4, 34), z, R.range(-30, 30), -R.range(10, 60), R.range(-30, 30), R.range(0.5, 1.1), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 2));
          }
        }
        // while it's open it keeps venting thin smoke and the odd spark
        if (t > OPEN && t < SHUT && R.chance(0.16)) puff(1, false, 22);
        if (t > OPEN && t < SHUT + 0.1 && R.chance(0.06)) sparks(1, 160, 0.4);
        // the pop when it closes
        if (once("pop", POP)) {
          lights.add(0, -4, 50, C[4], 0.95, 0.5, 0);
          lights.add(0, -2, 28, WHITE, 0.9, 0.12, 0);
          rings.push({ t0: t, life: 0.35, r0: 2, r1: RX * 1.9, th: 2.5, hot: true });
          for (let i = 0; i < 18; i++) {
            const [dx, dy, dz] = dome(0.05, 1.5), sp = R.range(90, 270);
            ps.spawn3(P.SPARK, 0, -1, 0, dx * sp, dy * sp * 0.8, dz * sp, R.range(0.25, 0.6));
          }
          for (let i = 0; i < 9; i++) {
            const [dx, dy, dz] = dome(-0.1, 1.2), sp = R.range(30, 95);
            ps.spawn3(P.STAR, 0, -2, 0, dx * sp, dy * sp * 0.5 - 20, dz * sp, R.range(0.4, 0.9), R.pick([WHITE, C[6]]), R.range(0.8, 1.8));
          }
          for (let i = 0; i < 6; i++) {
            const h = R.range(0, TAU), sp = R.range(0, 34);
            ps.spawn3(P.SMOKE, R.range(-6, 6), -R.range(1, 4), R.range(-6, 6), Math.cos(h) * sp, -R.range(10, 30), Math.sin(h) * sp, R.range(0.8, 1.3), SM[2], R.range(2.5, 4.5));
          }
          // what's left on the floor: specks of light that twinkle out where the rift was
          for (let i = 0; i < 14; i++) {
            const [x, z] = onRim(R.range(0, TAU), Math.sqrt(R.next()) * RX * 0.9);
            ps.spawn3(P.STAR, x, -R.range(0.5, 2), z, R.range(-4, 4), -R.range(0, 4), R.range(-4, 4), R.range(0.6, 1.4), R.pick([C[6], C[5], C[5]]), R.range(0.4, 0.9), R.range(0, 0.25));
          }
        }
        for (let i = swirl.length - 1; i >= 0; i--) {
          const s = swirl[i], k = shutting ? 2.4 : 1;
          s.a += s.w * k * dt * (1.4 / Math.max(0.3, s.r));
          s.r -= s.in * k * dt;
          if (s.r < 0.25 || t > POP) swirl.splice(i, 1);
        }
        // the wisps: comets with smoky tails that arc up and out, then burst
        for (let i = wisps.length - 1; i >= 0; i--) {
          const w = wisps[i];
          w.tr.unshift([w.x, w.y, w.z]);
          if (w.tr.length > 12) w.tr.pop();
          if ((w.life -= dt) <= 0 || (w.vy > 0 && w.y > -2)) {
            for (let j = 0; j < 8; j++) {
              const [dx, dy, dz] = dome(-0.6, 1.5), sp = R.range(30, 120);
              ps.spawn3(P.SPARK, w.x, w.y, w.z, dx * sp + w.vx * 0.2, dy * sp + w.vy * 0.2, dz * sp + w.vz * 0.2, R.range(0.2, 0.5));
            }
            ps.spawn3(P.STAR, w.x, w.y, w.z, 0, -6, 0, 0.45, WHITE, 2.4);
            lights.add(w.x, w.y, 24, C[5], 0.65, 0.25, w.z);
            wisps.splice(i, 1);
            continue;
          }
          w.vy += 360 * dt;
          const wig = Math.sin((w.max - w.life) * 16 + w.ph) * 160 * dt;
          w.vx += -Math.sin(w.az) * wig;
          w.vz += Math.cos(w.az) * wig;
          w.vx -= w.vx * 1.1 * dt;
          w.vz -= w.vz * 1.1 * dt;
          w.vy -= w.vy * 1.1 * dt;
          w.x += w.vx * dt;
          w.y += w.vy * dt;
          w.z += w.vz * dt;
          for (w.acc += dt; w.acc > 0.03; w.acc -= 0.03) ps.spawn3(P.SMOKE, w.x, w.y, w.z, w.vx * 0.05, w.vy * 0.05 - 4, w.vz * 0.05, R.range(0.6, 1), SM[0], R.range(1.5, 2.4));
          if (R.chance(0.3)) ps.spawn3(P.MOTE, w.x, w.y, w.z, -w.vx * 0.2 + R.range(-15, 15), -w.vy * 0.2 + R.range(-15, 15), -w.vz * 0.2 + R.range(-15, 15), R.range(0.2, 0.4), C[6], 0.6);
        }
        for (let i = rings.length - 1; i >= 0; i--) if (t - rings[i].t0 > rings[i].life) rings.splice(i, 1);
        rocks.update(dt);
        for (const b of rocks.list)
          if (b.rest && !b.dusted) {
            b.dusted = true;
            for (let i = 0; i < 2; i++) {
              const a = R.range(0, TAU), sp = R.range(6, 30);
              ps.spawn3(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, b.z + R.range(-1.5, 1.5), Math.cos(a) * sp, -R.range(2, 12), Math.sin(a) * sp, R.range(0.3, 0.6), DUST, R.range(1.2, 2.4));
            }
          }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), rx = radius(t, RX), spin = spinAt(t), heat = 0.85 + 0.15 * Math.sin(t * 7) + 0.6 * Math.exp(-((t - BURST) ** 2) / 0.01);
        const shut = smooth(SHUT, POP, t);
        // the hole: a void, a lit far wall, three arms of light spiralling down; the arms wind tighter as it twists shut
        if (t > OPEN * 0.35 && t < POP) {
          const h = heat + 0.4 * shut, wind = 2.3 + 2.6 * smooth(SHUT, POP - 0.05, t);
          if (rx >= 1)
            q.plane(0, 0, 0, null, rx * 1.12, (u, v, out) => {
              const r = Math.hypot(u, v), th = Math.atan2(v, u), qq = r / (rx * lipAt(th, spin));
              if (qq > 1) return;
              const far = -(u * q.sy + v * q.cy) / (r || 1);
              out.c = far > 0 && qq > 0.72 ? (qq > 0.86 ? C[2] : C[1]) : qq > 0.55 ? C[0] : VOID;
              // the arms and the fainter strand riding inside each
              if (qq > 0.14 && qq < 0.97)
                for (let i = 0; i < 3; i++) {
                  let d = th - (spin + (i * TAU) / 3 - wind * Math.log(qq));
                  d -= Math.round(d / TAU) * TAU;
                  if (Math.abs(d) * r < 0.7 * Math.sqrt(1 + wind * wind)) {
                    out.c = qq > 0.8 ? (h > 1.1 ? WHITE : C[6]) : qq > 0.55 ? C[5] : qq > 0.32 ? C[4] : C[3];
                    out.a = qq > 0.3 ? 1 : qq / 0.3;
                    break;
                  }
                  if (qq > 0.376 && (Math.round(r) & 1) === 0) {
                    let d2 = th - (spin + (i * TAU) / 3 - wind * Math.log(qq / 0.94) - 0.32);
                    d2 -= Math.round(d2 / TAU) * TAU;
                    if (Math.abs(d2) * r < 0.6 * Math.sqrt(1 + wind * wind)) {
                      out.c = qq > 0.66 ? C[4] : C[3];
                      out.a = 0.85;
                      break;
                    }
                  }
                }
            });
          q.glow(0, 0, 0, rx * 0.45, C[3], 0.35 * h);
        }
        // the slit it tears open from: a bright line across the floor
        if (t < OPEN * 0.6) {
          const k = t / (OPEN * 0.6), L = RX * 1.1 * ease.outCubic(k);
          q.line(-L, -0.3, 0, L, -0.3, 0, (u) => (Math.abs(u - 0.5) < 0.3 ? WHITE : C[6]));
          q.glowLine(-L, -0.3, 0, L, -0.3, 0, 7, C[5], 0.6);
        }
        for (const r of rings) {
          const k = (t - r.t0) / r.life;
          if (k >= 0 && k < 1) floorBand(q, r.r0 + (r.r1 - r.r0) * ease.outCubic(k), r.th * (1 - k), 1.15 - k, C, r.hot && k < 0.15);
        }
        // the swirl: motes riding the floor, spiralling in
        for (const s of swirl)
          for (let j = 0; j < 3; j++) {
            const a = s.a - j * 0.08 * (1.4 / Math.max(0.3, s.r)), x = Math.cos(a) * s.r * rx, z = Math.sin(a) * s.r * rx;
            q.dot(x, -0.5, z, j ? C[5] : s.c, j ? 0.9 - j * 0.3 : 1);
            if (!j) q.glow(x, -0.5, z, 3, C[5], 0.35);
          }
        // the lip: a ragged ring of white-hot light, a dark cut outside it; the far half behind, the near half in front
        if (t > OPEN * 0.35 && t < POP && rx >= 1) {
          const n = Math.ceil(rx * 7);
          for (let j = 0; j < n; j++) {
            const th = (j / n) * TAU, ca = Math.cos(th), sa = Math.sin(th), near = ca * q.sy + sa * q.cy >= 0;
            const l = lipAt(th, spin), f = noise(th * 9 + spin * 3, 13);
            q.px(ca * (rx * l + 1.2), -0.3, sa * (rx * l + 1.2), C[1]);
            q.px(ca * rx * l, -0.4, sa * rx * l, near ? (f > -0.3 || heat > 1.1 ? WHITE : C[6]) : f > 0.2 ? C[6] : C[5]);
            if (j % 6 === 0) q.glow(ca * rx * l, -0.4, sa * rx * l, 7, C[5], (near ? 0.3 : 0.2) * Math.min(1.4, heat));
          }
        }
        // the burst: a column of light shoots up out of the hole, thins and lifts away
        const b = t - BURST;
        if (b > 0 && b < 0.45) {
          const k = b / 0.45, top = -84 * ease.outExpo(clamp(b / 0.14)), bot = -1 - 60 * ease.inQuad(k), w0 = RX * 0.55 * (1 - k * 0.8);
          const half = (y) => w0 * Math.pow(1 - (y - bot) / (top - bot), 0.8) * (0.85 + 0.15 * Math.sin(y * 0.7 + t * 40));
          const segs = Math.max(6, Math.ceil((bot - top) / 3));
          for (let i = 0; i < segs; i++) {
            const y0 = bot + ((top - bot) * i) / segs, y1 = bot + ((top - bot) * (i + 1)) / segs, hw = Math.max(0.5, half((y0 + y1) / 2));
            q.beam(0, y0, 0, 0, y1, 0, hw * 2, (u, v) => (v < 0.35 ? WHITE : v < 0.7 ? C[6] : C[5]));
          }
          q.glowLine(0, bot, 0, 0, top, 0, w0 + 12, C[5], 0.55 * (1 - k));
          if (b < 0.14) q.at(...toward(q, 20), (pp, kk) => flare(pp, 0, -4 * q.cp, 36 * (1 - b / 0.14) * kk, 1 - b / 0.14, C));
        }
        // the collapse: a white point that pops
        const pq = t - POP;
        if (pq > -0.08 && pq < 0.25) q.at(...toward(q, 4), (pp) => sparkle(pp, 0, -1, Math.round((pq < 0 ? 4 : 12) * (1 - clamp(pq / 0.25))), WHITE, C[5], 0.7 * (1 - clamp(pq / 0.25))));
        rocks.draw(q);
        for (const w of wisps) {
          const k = w.life / w.max;
          for (let i = 1; i < w.tr.length; i++) {
            const [x0, y0, z0] = w.tr[i - 1], [x1, y1, z1] = w.tr[i], u = i / w.tr.length;
            q.line(x0, y0, z0, x1, y1, z1, u < 0.25 ? WHITE : u < 0.55 ? C[6] : C[4], 1.15 - u);
            if (u < 0.35) q.line(x0 + 1, y0, z0, x1 + 1, y1, z1, C[5], 1);
          }
          q.ball(w.x, w.y, w.z, 2.2, (nx, ny, nz) => (nz > 0.6 ? WHITE : nz > 0.25 ? C[6] : C[5]));
          q.glow(w.x, w.y, w.z, 12, C[5], 0.5 * k + 0.2);
        }
        // light: the floor glows violet round the hole, and light wells up out of it into the air
        if (t < POP) {
          q.glow(0, -4, 0, rx * 1.8 + 10, C[4], 0.32 * clamp(rx / RX));
          q.glowLine(0, -2, 0, 0, -44, 0, rx * 0.7 + 6, C[4], 0.16 * clamp(rx / RX));
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
