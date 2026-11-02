import { Particles, Lights, P, Rng, fit, space, sparkle, clamp, seg, ease, TAU, WHITE, scale } from "../../core/index.js";
import { spell, drawWord, dir3, up3, pool, shell } from "./_lib.js";

export const meta = {
  name: "Damage number",
  desc: "A red -27 punches out of a hit spark, white for a frame, arcs up, lands with a squash and a little hop, then fades as it lifts away.",
  tags: ["ui", "damage", "number", "combat", "text", "hit", "one-shot"],
  size: [76, 68],
  origin: [30, 52],
  duration: 1.05,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1a0508", "#4a0b12", "#8c1420", "#d42a2e", "#ff5a4a", "#ff9a86", "#ffd8cc", "#ffffff"], text: "-27", seed: 2 },
};

const LAND = -8, FADE = 0.84;

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), word = spell(o.text);
  const ps = new Particles({ rng: R, sparks: [C[7], C[6], C[4], C[2]] }), lights = new Lights();
  // the number is a little body: thrown up and out, it lands, hops once and settles
  const n = { x: 0, y: LAND, vx: 34, vy: -175, sq: 0, hops: 0 };
  const spikes = Array.from({ length: 9 }, (_, i) => [(i / 9) * TAU + R.range(-0.2, 0.2), R.range(8, 14)]);
  let t = 0, hit = false;
  return {
    update(dt) {
      t += dt;
      if (!hit) {
        hit = true;
        lights.add(0, -4, 30, C[5], 0.7, 0.25);
        lights.add(0, -4, 14, WHITE, 0.6, 0.08);
        for (let i = 0; i < 9; i++) {
          const an = R.range(-Math.PI * 0.95, -0.05) + (i % 2 ? Math.PI * 0.08 : 0), sp = R.range(90, 200);
          ps.spawn(P.SPARK, 0, -4, Math.cos(an) * sp, Math.sin(an) * sp, R.range(0.1, 0.25));
        }
      }
      if (n.hops < 2) {
        n.vy += 900 * dt;
        n.vx -= n.vx * 2 * dt;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.y >= LAND && n.vy > 0) {
          n.y = LAND;
          n.sq = 1;
          n.hops++;
          n.vy = n.hops < 2 ? -n.vy * 0.36 : 0;
          if (n.hops === 1) for (const s of [-1, 1]) ps.spawn(P.STAR, n.x + s * 14, LAND + R.range(-2, 1), s * R.range(15, 35), -R.range(5, 20), R.range(0.2, 0.35), C[6], R.range(0.5, 1.2));
        }
      }
      n.sq = Math.max(0, n.sq - dt / 0.09);
      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      // the hit: two frames of a spiky white-hot star, then a glint and a ring where the blow landed
      if (t < 0.07) {
        const big = t < 0.035;
        spikes.forEach(([an, L], i) => {
          const l = L * (big ? 1 : 1.3), ca = Math.cos(an), sa = Math.sin(an);
          if (big) {
            // a fat spike: a red rim either side of a white-hot core that narrows to the tip
            p.line(-sa, -4 + ca, ca * l * 0.7 - sa, -4 + sa * l * 0.7 + ca, C[4]);
            p.line(sa, -4 - ca, ca * l * 0.7 + sa, -4 + sa * l * 0.7 - ca, C[4]);
          }
          p.line(ca * (big ? 0 : l * 0.45), -4 + sa * (big ? 0 : l * 0.45), ca * l, -4 + sa * l, big ? WHITE : i % 2 ? C[6] : C[5]);
        });
        if (big) p.circle(0, -4, 3.2, WHITE);
      } else if (t < 0.16) sparkle(p, 0, -4, 5 * (1 - (t - 0.07) / 0.09), WHITE, C[5], 0.6);
      const rk = t / 0.22;
      if (rk < 1) p.ring(0, -4, 3 + 10 * ease.outCubic(rk), Math.max(1, 2 * (1 - rk)), rk < 0.4 ? WHITE : C[5], 1.2 - rk);
      ps.draw(p);
      // the number: punches out big and white, springs to size, squashes as it lands, then lifts and fades
      const out = seg(t, FADE, meta.duration - 0.04);
      if (out < 1) {
        let s = 2 + 1.4 * Math.exp(-t * 22) * Math.cos(t * 30), sx = s, sy = s;
        if (n.sq > 0) (sx = s * (1 + 0.18 * n.sq)), (sy = s * (1 - 0.2 * n.sq));
        else if (n.hops < 2 && Math.abs(n.vy) > 120) (sx = s * 0.92), (sy = s * 1.1);
        const W = word.w * sx, H = 7 * sy, x0 = n.x - W / 2, y0 = n.y - H - 6 * ease.inQuad(out);
        const flash = t < 0.035 ? 1 : t < 0.07 ? 0.4 : 0;
        const items = word.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: x0 + L.x * sx, y: y0, sx, sy, flash, a: 1 - out }));
        drawWord(p, items, { fill: [C[3], C[3], C[4], C[5]], edge: C[6], under: C[2], outline: C[0], shadow: scale(C[0], 0.5) });
        p.glow(n.x, y0 + H / 2, 18, C[4], 0.3 * (1 - out) + (t < 0.1 ? 0.4 * (1 - t / 0.1) : 0));
      }
      lights.draw(p);
    },
  };
}

// ---- 3D: the number is a billboard that really flies: thrown out across the floor, it lands in depth on its own
// shadow, hops and settles; the hit is a ball of spikes in every direction, the rings are true circles.
const LIFT = 14;
export const three = {
  meta: { size: [112, 96], origin: [56, 76], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed), word = spell(o.text);
    const ps = new Particles({ rng: R, sparks: [C[7], C[6], C[4], C[2]] }), lights = new Lights();
    const n = { x: 0, y: LAND, z: 0, vx: 26, vy: -175, vz: 22, sq: 0, hops: 0, ring: -1, rx: 0, rz: 0 };
    const spikes = Array.from({ length: 11 }, () => [dir3(R), R.range(8, 14)]);
    let t = 0, hit = false;
    return {
      update(dt) {
        t += dt;
        if (!hit) {
          hit = true;
          lights.add(0, -4, 30, C[5], 0.7, 0.25, 0);
          lights.add(0, -4, 14, WHITE, 0.6, 0.08, 0);
          for (let i = 0; i < 14; i++) {
            const [dx, dy, dz] = up3(R), sp = R.range(90, 200);
            ps.spawn3(P.SPARK, 0, -4, 0, dx * sp, dy * sp, dz * sp, R.range(0.1, 0.25));
          }
        }
        if (n.hops < 2) {
          n.vy += 900 * dt;
          n.vx -= n.vx * 2 * dt;
          n.vz -= n.vz * 2 * dt;
          n.x += n.vx * dt;
          n.y += n.vy * dt;
          n.z += n.vz * dt;
          if (n.y >= LAND && n.vy > 0) {
            n.y = LAND;
            n.sq = 1;
            n.hops++;
            n.vy = n.hops < 2 ? -n.vy * 0.36 : 0;
            if (n.hops === 1) {
              n.ring = t;
              n.rx = n.x;
              n.rz = n.z;
              // the landing kicks stars out all round on the floor
              for (let i = 0; i < 7; i++) {
                const a = (i / 7) * TAU + R.range(-0.3, 0.3), sp = R.range(15, 38);
                ps.spawn3(P.STAR, n.x + Math.cos(a) * 9, LAND + R.range(-2, 1), n.z + Math.sin(a) * 9, Math.cos(a) * sp, -R.range(5, 20), Math.sin(a) * sp, R.range(0.2, 0.35), C[6], R.range(0.5, 1.2));
              }
            }
          }
        }
        n.sq = Math.max(0, n.sq - dt / 0.09);
        ps.update(dt);
        lights.update(dt);
      },

      draw(p) {
        const q = space(p, o), out = seg(t, FADE, meta.duration - 0.04);
        // the shadow it casts on the floor: tighter and darker the lower it flies
        const h = clamp((-n.y - 8) / 50);
        pool(q, n.x, n.z, 12 * (1 - 0.35 * h), 0.8 * (1 - out));
        // the hit: two frames of a spiky white-hot star flung in every direction, then a glint and a shell of light
        if (t < 0.07) {
          const big = t < 0.035;
          spikes.forEach(([[dx, dy, dz], L], i) => {
            const l = L * (big ? 1 : 1.3);
            if (big) q.beam(0, -4, 0, dx * l * 0.7, -4 + dy * l * 0.7, dz * l * 0.7, 2.6, (u, v) => (v > 0.45 ? C[4] : WHITE));
            q.line(dx * (big ? 0 : l * 0.45), -4 + dy * (big ? 0 : l * 0.45), dz * (big ? 0 : l * 0.45), dx * l, -4 + dy * l, dz * l, big ? WHITE : i % 2 ? C[6] : C[5]);
          });
          if (big) q.ball(0, -4, 0, 3.2, WHITE);
        } else if (t < 0.16) q.at(0, -4, 0, (pp) => sparkle(pp, 0, 0, 5 * (1 - (t - 0.07) / 0.09), WHITE, C[5], 0.6));
        const rk = t / 0.22;
        if (rk < 1) shell(q, 0, -4, 0, 3 + 10 * ease.outCubic(rk), Math.max(1, 2 * (1 - rk)), rk < 0.4 ? WHITE : C[5], 1.2 - rk);
        // the landing: a ring races out along the floor from where it touched down
        if (n.ring >= 0) {
          const lk = (t - n.ring) / 0.28;
          if (lk < 1) {
            q.ring(n.rx, 0, n.rz, 4 + 20 * ease.outCubic(lk), Math.max(1, 2.4 * (1 - lk)), lk < 0.35 ? WHITE : C[5], 1.3 - lk);
            q.ring(n.rx, 0, n.rz, 2 + 11 * ease.outCubic(lk), 1, C[4], 1.1 - lk);
          }
        }
        // the number: punches out big and white, springs to size, squashes as it lands, then lifts and fades
        if (out < 1) {
          let s = 2 + 1.4 * Math.exp(-t * 22) * Math.cos(t * 30), sx = s, sy = s;
          if (n.sq > 0) (sx = s * (1 + 0.18 * n.sq)), (sy = s * (1 - 0.2 * n.sq));
          else if (n.hops < 2 && Math.abs(n.vy) > 120) (sx = s * 0.92), (sy = s * 1.1);
          const W = word.w * sx, H = 7 * sy, yc = n.y - H / 2 - LIFT * ease.inQuad(out) * 0.45;
          const flash = t < 0.035 ? 1 : t < 0.07 ? 0.4 : 0;
          q.at(n.x, yc, n.z, (pp) => {
            const items = word.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: -W / 2 + L.x * sx, y: -H / 2, sx, sy, flash, a: 1 - out }));
            drawWord(pp, items, { fill: [C[3], C[3], C[4], C[5]], edge: C[6], under: C[2], outline: C[0], shadow: scale(C[0], 0.5) });
          });
          q.glow(n.x, yc, n.z, 18, C[4], 0.3 * (1 - out) + (t < 0.1 ? 0.4 * (1 - t / 0.1) : 0));
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
