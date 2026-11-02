// The flames that cool into smoke, the embers and the smouldering glow are adapted from Sprite Fusion's
// open-source fire (https://www.spritefusion.com/pixel-art-vfx/fire), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, PF, Rng, fit, clamp, smooth, ease, rand, noise, space, TAU, WHITE, hex, mix, READY } from "../../core/index.js";
import { bodyOf } from "./_lib.js";

export const meta = {
  name: "Dissolve burn",
  desc: "An ember seam lights at the feet and climbs the body: above it the body scorches and smoulders, at it flames lick up, below it there's only falling ash, embers and smoke.",
  tags: ["spawn", "death", "burn", "fire", "ash", "dissolve", "embers", "one-shot"],
  size: [96, 112],
  origin: [48, 100],
  duration: 3.6,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#2a0e08", "#5a1a0c", "#a8320f", "#e8601a", "#ff9a2e", "#ffd25a", "#fff3c0", "#ffffff"],
    ash: ["#2a2428", "#4a4248", "#6e6670"],
    seed: 16,
  },
};

const WRITHE = { turn: 1, crouch: 2, fx: -13, fy: -35, bx: 13, by: -26, ffx: -3, fbx: 4 };
export const act = {
  onBody: true,
  poses: [
    [-0.16, READY],
    [0.4, { turn: 1, crouch: 2, fx: -9, fy: -22, bx: 10, by: -22, ffx: -3, fbx: 4 }],
    [0.8, WRITHE],
    [1.2, { ...WRITHE, lean: 2, fy: -26, by: -36 }],
    [1.6, { ...WRITHE, lean: -2, fy: -36, by: -26 }],
    [2.1, { ...WRITHE, crouch: 5, lean: 2, fx: -8, fy: -38, bx: 9, by: -38 }],
    [3.6, { ...WRITHE, crouch: 6, lean: 2, fx: -8, fy: -36, bx: 9, by: -36 }],
  ],
};

const IGNITE = 0.15, BURN = 1.9, CHAR = [hex("#100908"), hex("#22130e"), hex("#3a2016")];
export const actorAlpha = () => 0;

export function create(o) {
  const C = fit(o.palette, 8), A = fit(o.ash, 3), R = new Rng(o.seed), floor = () => 0;
  const body = bodyOf(o.actor, C), H = body.h, cx = 0;
  // when each pixel catches: row by row from the feet, a ragged, licking front; the rim a beat early
  for (const b of body.list) {
    b.key = (body.h - 1 - b.my) / H + 0.08 * (rand(b.mx, b.my, 3) - 0.5) + 0.06 * noise(b.mx * 0.35, 4) - (b.edge ? 0.02 : 0);
    b.gone = false;
  }
  const front = (t) => -0.04 + 1.1 * ease.inOutSine(clamp((t - IGNITE) / BURN));
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[3]] }), lights = new Lights();
  let t = 0;
  // a life that ends before the effect does
  const left = (a, b) => Math.max(0.05, Math.min(R.range(a, b), meta.duration - 0.1 - t));
  // tongues of flame along the seam, licking up the body still standing: layered, flickering, swaying
  const tongues = Array.from({ length: 6 }, (_, i) => ({ x: -9 + i * 3.6 + rand(i, 1) * 1.5, h: 6 + rand(i, 2) * 6, s: i * 13 }));
  function tongue(p, x, y, h, n) {
    for (const [lw, lh, c] of [[1, 1, C[3]], [0.7, 0.8, C[4]], [0.45, 0.6, C[5]], [0.25, 0.35, C[6]]]) {
      const Hh = h * lh;
      for (let r = 0; r <= Hh; r++) {
        const u = r / Math.max(1, Hh), half = 1.8 * lw * Math.pow(1 - u, 0.9) + noise(t * 9 + r * 0.5, n) * 0.4;
        const cxr = x + noise(t * 4 + r * 0.25, n + 7) * u * 1.6;
        if (half < 0.3) continue;
        for (let px = Math.round(cxr - half); px <= Math.round(cxr + half); px++) p.px(px, Math.round(y - r), c);
      }
    }
  }

  return {
    update(dt) {
      t += dt;
      const f = front(t);
      for (const b of body.list) {
        if (b.gone || b.key >= f) continue;
        b.gone = true;
        // a burnt pixel goes to ash that sifts down, an ember that rises, or a lick of flame
        const r = R.next();
        if (r < 0.2) {
          // ash: low down it drops and settles, higher up it sifts down slowly (and is gone before the floor)
          if (b.y > -7) ps.spawn(P.GRIT, b.x, b.y, R.range(-12, 12), R.range(-20, 0), left(0.6, 1.2), R.pick(A), 1);
          else ps.spawn(P.FLAKE, b.x, b.y, R.range(-10, 10), R.range(-8, 4), left(0.5, Math.min(1.5, -b.y / 18)), R.pick(A), R.chance(0.2) ? 1.4 : 1);
        } else if (r < 0.32) ps.spawn(P.EMBER, b.x, b.y, R.range(-12, 12), -R.range(15, 45), left(0.6, 1.4), C[5], R.range(1, 1.6));
        else if (r < 0.46) ps.spawn(P.FIRE, b.x, b.y, R.range(-6, 6), -R.range(14, 30), R.range(0.2, 0.42), 0, R.range(1.2, 2.2), 0, R.chance(0.5) ? PF.SMOKES : 0);
        else if (r < 0.5) ps.spawn(P.SMOKE, b.x, b.y - 2, R.range(-5, 5), -R.range(14, 26), left(1.2, 2), mix(A[1], C[1], 0.3), R.range(2, 3.4));
      }
      // the feet catch with a spit of sparks and a puff of light
      if (t >= IGNITE && t - dt < IGNITE) {
        lights.add(0, -4, 34, C[4], 0.8, 0.4);
        for (let i = 0; i < 10; i++) ps.spawn(P.SPARK, R.range(-8, 8), -1, R.range(-80, 80), -R.range(40, 150), R.range(0.2, 0.5));
      }
      // while it burns: steady embers and smoke off the front
      if (f > 0 && f < 1.02) {
        const fy = body.y + (1 - clamp(f)) * H;
        if (R.chance(0.34)) ps.spawn(P.SMOKE, R.range(-7, 7), fy - 5, R.range(-6, 6), -R.range(16, 30), left(1.4, 2.4), mix(A[1], C[3], 0.35), R.range(2.6, 4.2));
        if (R.chance(0.5)) ps.spawn(P.FIRE, R.range(-9, 9), fy, R.range(-6, 6), -R.range(18, 34), R.range(0.18, 0.36), 0, R.range(1.2, 2.4), 0, R.chance(0.35) ? PF.SMOKES : 0);
        if (R.chance(0.15)) ps.spawn(P.EMBER, R.range(-9, 9), fy, R.range(-15, 15), -R.range(30, 70), left(0.8, 1.6), C[5], 1.4);
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // warm light on the floor while the body burns down to it
      const k = smooth(0, IGNITE + 0.2, t) * (1 - smooth(IGNITE + BURN * 0.6, IGNITE + BURN + 0.4, t));
      if (k > 0) p.glow(0, -1, 30, C[4], 0.3 * k);
      ps.draw(p, "back");
    },
    draw(p) {
      const f = front(t), fr = Math.floor(t * 30);
      for (const b of body.list) {
        if (b.gone) continue;
        const d = b.key - f;
        let c;
        // the seam: white-hot at the very edge, flickering through yellow and orange
        if (d < 0.025) c = rand(b.mx, b.my, fr) < 0.35 ? WHITE : C[6];
        else if (d < 0.05) c = rand(b.mx, b.my, fr + 7) < 0.5 ? C[5] : C[4];
        // just above it the body is charred, with live sparks in the char
        else if (d < 0.11) c = rand(b.mx, b.my, 13) < 0.15 && rand(b.mx, fr, 2) < 0.6 ? C[3] : CHAR[d < 0.075 ? 0 : 1];
        else if (d < 0.16) c = mix(b.c, CHAR[2], 0.6);
        // above that the heat browns it
        else if (d < 0.26) c = mix(b.c, C[2], 0.18);
        else c = b.c;
        p.px(b.x, b.y, c);
      }
      // light along the seam, and flames licking up from it while there's body left to burn
      if (f > -0.02 && f < 1.05) {
        const fy = body.y + (1 - clamp(f)) * H, k = 1 - smooth(0.95, 1.05, f);
        for (const g of tongues) {
          const row = Math.round(fy - body.y), mx = Math.round(g.x - body.x);
          if (!body.on(mx, Math.min(H - 1, Math.max(0, row)))) continue;
          const h = g.h * k * (0.6 + 0.6 * (noise(t * 2.6 + g.s, g.s) * 0.5 + 0.5)) * smooth(-0.02, 0.06, f);
          if (h >= 1) tongue(p, g.x, fy + 1, h, g.s);
        }
        const fl = 0.85 + 0.15 * noise(t * 11, 9);
        p.glowLine(-11, fy, 11, fy, 9, C[4], 0.45 * k);
        p.glow(0, fy - 6, 56, C[4], 0.38 * k * fl);
        p.glow(0, fy - 2, 18, C[5], 0.28 * k * fl);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// 3D: the body is the stock character's flat sprite, charred and burnt row by row exactly as in 2D. The fire is
// built round it: a ring of flame tongues stands on the seam and climbs the body with it, the seam is a true ring of
// light, and ash, embers, flame and smoke come off the whole disc of the body, so the heat column reads from every
// side. A scorch grows on the floor under it.
export const three = {
  meta: { size: [112, 118], origin: [56, 106], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), A = fit(o.ash, 3), R = new Rng(o.seed), floor = () => 0;
    const body = bodyOf(o.actor, C), H = body.h;
    for (const b of body.list) {
      b.key = (body.h - 1 - b.my) / H + 0.08 * (rand(b.mx, b.my, 3) - 0.5) + 0.06 * noise(b.mx * 0.35, 4) - (b.edge ? 0.02 : 0);
      b.gone = false;
    }
    // how wide the body is at each row: the ring of fire stands just outside it
    const rowL = new Array(H).fill(Infinity), rowR = new Array(H).fill(-Infinity);
    for (const b of body.list) (rowL[b.my] = Math.min(rowL[b.my], b.mx)), (rowR[b.my] = Math.max(rowR[b.my], b.mx));
    const front = (t) => -0.04 + 1.1 * ease.inOutSine(clamp((t - IGNITE) / BURN));
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[3]] }), lights = new Lights();
    let t = 0;
    const left = (a, b) => Math.max(0.05, Math.min(R.range(a, b), meta.duration - 0.1 - t));
    // a point somewhere in the body's thickness at column x
    const thick = (x) => R.range(-1, 1) * 4.5 * Math.sqrt(Math.max(0, 1 - (x / 13) ** 2));
    // a point on the heat column round the seam: a disc across the body
    const disc = (r) => {
      const a = R.range(0, TAU), d = Math.sqrt(R.next()) * r;
      return [Math.cos(a) * d, Math.sin(a) * d];
    };
    const tongues = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * TAU + 0.4, h: 6 + rand(i, 2) * 6, s: i * 13 }));
    function tongue(p, x, y, h, n) {
      for (const [lw, lh, c] of [[1, 1, C[3]], [0.7, 0.8, C[4]], [0.45, 0.6, C[5]], [0.25, 0.35, C[6]]]) {
        const Hh = h * lh;
        for (let r = 0; r <= Hh; r++) {
          const u = r / Math.max(1, Hh), half = 1.8 * lw * Math.pow(1 - u, 0.9) + noise(t * 9 + r * 0.5, n) * 0.4;
          const cxr = x + noise(t * 4 + r * 0.25, n + 7) * u * 1.6;
          if (half < 0.3) continue;
          for (let px = Math.round(cxr - half); px <= Math.round(cxr + half); px++) p.px(px, Math.round(y - r), c);
        }
      }
    }

    return {
      update(dt) {
        t += dt;
        const f = front(t);
        for (const b of body.list) {
          if (b.gone || b.key >= f) continue;
          b.gone = true;
          // a burnt pixel goes to ash that sifts down, an ember that rises, or a lick of flame
          const r = R.next(), z = thick(b.x);
          if (r < 0.2) {
            if (b.y > -7) ps.spawn3(P.GRIT, b.x, b.y, z, R.range(-12, 12), R.range(-20, 0), R.range(-12, 12), left(0.6, 1.2), R.pick(A), 1);
            else ps.spawn3(P.FLAKE, b.x, b.y, z, R.range(-10, 10), R.range(-8, 4), R.range(-10, 10), left(0.5, Math.min(1.5, -b.y / 18)), R.pick(A), R.chance(0.2) ? 1.4 : 1);
          } else if (r < 0.32) ps.spawn3(P.EMBER, b.x, b.y, z, R.range(-12, 12), -R.range(15, 45), R.range(-12, 12), left(0.6, 1.4), C[5], R.range(1, 1.6));
          else if (r < 0.46) ps.spawn3(P.FIRE, b.x, b.y, z, R.range(-6, 6), -R.range(14, 30), R.range(-6, 6), R.range(0.2, 0.42), 0, R.range(1.2, 2.2), 0, R.chance(0.5) ? PF.SMOKES : 0);
          else if (r < 0.5) ps.spawn3(P.SMOKE, b.x, b.y - 2, z, R.range(-5, 5), -R.range(14, 26), R.range(-5, 5), left(1.2, 2), mix(A[1], C[1], 0.3), R.range(2, 3.4));
        }
        // the feet catch with a spit of sparks, all round, and a puff of light
        if (t >= IGNITE && t - dt < IGNITE) {
          lights.add(0, -4, 34, C[4], 0.8, 0.4, 0);
          for (let i = 0; i < 14; i++) {
            const a = R.range(0, TAU), sp = R.range(30, 90);
            ps.spawn3(P.SPARK, Math.cos(a) * R.range(0, 8), -1, Math.sin(a) * R.range(0, 8), Math.cos(a) * sp, -R.range(40, 150), Math.sin(a) * sp, R.range(0.2, 0.5));
          }
        }
        // while it burns: steady embers and smoke off the front, from the whole disc of the seam
        if (f > 0 && f < 1.02) {
          const fy = body.y + (1 - clamp(f)) * H;
          if (R.chance(0.34)) {
            const [x, z] = disc(8);
            ps.spawn3(P.SMOKE, x, fy - 5, z, R.range(-6, 6), -R.range(16, 30), R.range(-6, 6), left(1.4, 2.4), mix(A[1], C[3], 0.35), R.range(2.6, 4.2));
          }
          if (R.chance(0.5)) {
            const [x, z] = disc(10);
            ps.spawn3(P.FIRE, x, fy, z, R.range(-6, 6), -R.range(18, 34), R.range(-6, 6), R.range(0.18, 0.36), 0, R.range(1.2, 2.4), 0, R.chance(0.35) ? PF.SMOKES : 0);
          }
          if (R.chance(0.15)) {
            const [x, z] = disc(10);
            ps.spawn3(P.EMBER, x, fy, z, R.range(-15, 15), -R.range(30, 70), R.range(-15, 15), left(0.8, 1.6), C[5], 1.4);
          }
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), f = front(t), fr = Math.floor(t * 30);
        for (const b of body.list) {
          if (b.gone) continue;
          const d = b.key - f;
          let c;
          if (d < 0.025) c = rand(b.mx, b.my, fr) < 0.35 ? WHITE : C[6];
          else if (d < 0.05) c = rand(b.mx, b.my, fr + 7) < 0.5 ? C[5] : C[4];
          else if (d < 0.11) c = rand(b.mx, b.my, 13) < 0.15 && rand(b.mx, fr, 2) < 0.6 ? C[3] : CHAR[d < 0.075 ? 0 : 1];
          else if (d < 0.16) c = mix(b.c, CHAR[2], 0.6);
          else if (d < 0.26) c = mix(b.c, C[2], 0.18);
          else c = b.c;
          p.px(b.x, b.y, c);
        }
        // the floor: a scorch that grows as the body burns down to it, ember specks glowing in it
        const burnt = smooth(IGNITE, IGNITE + BURN, t), warm = smooth(0, IGNITE + 0.2, t) * (1 - smooth(IGNITE + BURN * 0.6, IGNITE + BURN + 0.4, t));
        if (burnt > 0) {
          const rs = 8 + 8 * burnt, fade = 1 - smooth(meta.duration - 1, meta.duration - 0.2, t);
          q.plane(0, 0, 0, null, rs, (u, v, out) => {
            const d = Math.hypot(u, v) / rs, ragged = 1 - 0.22 * rand(Math.round(u), Math.round(v), 5);
            if (d > ragged) return;
            out.c = d > 0.8 * ragged ? CHAR[1] : CHAR[0];
            out.a = 0.55 * fade * (1 - d * 0.5);
            out.blend = true;
            if (rand(Math.round(u), Math.round(v), 11) < 0.07 * (1 - d) * Math.min(1, fade * 2)) {
              out.c = C[3];
              out.a = 1;
              out.blend = false;
              out.l = C[4];
              out.k = 0.25 * warm;
            }
          });
        }
        // the flames stand round the seam and climb with it; the seam itself is a ring of light
        if (f > -0.02 && f < 1.05) {
          const fy = body.y + (1 - clamp(f)) * H, k = 1 - smooth(0.95, 1.05, f), row = Math.min(H - 1, Math.max(0, Math.round(fy - body.y)));
          if (rowR[row] >= rowL[row]) {
            const cx = body.x + (rowL[row] + rowR[row] + 1) / 2, hw = (rowR[row] - rowL[row] + 1) / 2 + 1;
            for (const g of tongues) {
              const h = g.h * k * (0.6 + 0.6 * (noise(t * 2.6 + g.s, g.s) * 0.5 + 0.5)) * smooth(-0.02, 0.06, f);
              if (h >= 1) q.at(cx + Math.cos(g.a) * hw, fy + 1, Math.sin(g.a) * hw * 0.8, (pp) => tongue(pp, 0, 0, h, g.s));
            }
            q.ring(cx, fy, 0, hw + 1.5, 1.6, (v) => (v > 0.5 ? C[5] : C[4]), 0.6 * k);
          }
          const fl = 0.85 + 0.15 * noise(t * 11, 9);
          q.glow(0, fy, 0, 12, C[4], 0.45 * k);
          q.glow(0, fy - 6, 0, 56, C[4], 0.38 * k * fl);
          q.glow(0, fy - 2, 0, 18, C[5], 0.28 * k * fl);
        }
        // warm light on the floor while the body burns down to it
        if (warm > 0) q.glow(0, -1, 0, 30, C[4], 0.3 * warm);
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
