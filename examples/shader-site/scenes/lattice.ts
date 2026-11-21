import { d, std } from "typegpu";

const hash = (p: d.v2f): d.v2f => {
  "use gpu";

  return std.fract(
    std.mul(
      std.sin(d.vec2f(std.dot(p, d.vec2f(127.1, 311.7)), std.dot(p, d.vec2f(269.5, 183.3)))),
      43758.5453,
    ),
  );
};

/** A random 0 to 1 for a lattice point. */
export const noise = (id: d.v2f): number => {
  "use gpu";

  return hash(std.add(id, 17)).x;
};

/** How a facet lattice is cut: its cell size, how far each corner strays (0 to 0.8 of a cell), and how it sways. */
export const Lattice = d.struct({ cell: d.vec2f, loose: d.f32, time: d.f32, sway: d.f32 });

/**
 * Lattice point `id` of a triangle lattice, each row shifted half a cell, moved by chance up to half of `loose` of a
 * cell, and swaying by up to `sway` of a cell over `time`.
 */
export const corner = (id: d.v2f, lattice: d.Infer<typeof Lattice>): d.v2f => {
  "use gpu";
  const jitter = std.sub(hash(id), 0.5);
  const drift = std.mul(std.sin(std.add(std.mul(jitter, 9), lattice.time * 0.35)), lattice.sway);
  const moved = std.add(std.mul(jitter, lattice.loose), drift);

  return std.mul(std.add(d.vec2f(id.x + id.y * 0.5, id.y), moved), lattice.cell);
};

/** How far inside triangle abc the point p is: the smallest of its barycentric weights, below 0 outside. */
const inside = (p: d.v2f, a: d.v2f, b: d.v2f, c: d.v2f): number => {
  "use gpu";
  const u = std.sub(b, a);
  const v = std.sub(c, a);
  const w = std.sub(p, a);
  const area = u.x * v.y - v.x * u.y;
  const s = (w.x * v.y - v.x * w.y) / area;
  const t = (u.x * w.y - w.x * u.y) / area;

  return std.min(std.min(s, t), 1 - s - t);
};

/**
 * The irregular triangle that holds `p`: its lattice cell, then 0 or 1 for the cell's lower or upper half. Its
 * corners are `corner(cell + (half, 0))`, `corner(cell + (1, half))` and `corner(cell + (0, 1))`.
 */
export const facet = (p: d.v2f, lattice: d.Infer<typeof Lattice>): d.v3f => {
  "use gpu";
  const row = p.y / lattice.cell.y;
  const base = d.vec2f(std.floor(p.x / lattice.cell.x - row * 0.5), std.floor(row));
  let found = d.vec3f(base.x, base.y, 0);
  let best = d.f32(-1000);

  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      for (let half = 0; half < 2; half++) {
        const id = std.add(base, d.vec2f(d.f32(i), d.f32(j)));
        const h = d.f32(half);
        const a = corner(std.add(id, d.vec2f(h, 0)), lattice);
        const b = corner(std.add(id, d.vec2f(1, h)), lattice);
        const c = corner(std.add(id, d.vec2f(0, 1)), lattice);
        const depth = inside(p, a, b, c);

        if (depth > best) {
          best = depth;
          found = d.vec3f(id.x, id.y, h);
        }
      }
    }
  }

  return found;
};
