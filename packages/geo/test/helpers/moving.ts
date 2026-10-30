import { geoOrthographic } from "d3-geo";
import { rect } from "svjeez";
import { feature } from "topojson-client";
import type { LonLat } from "../../src/index.ts";
import { world } from "./geo-world.ts";

export const land = feature(world, world.objects.countries!);

export const commands = (d: string) =>
  d.replace(/-?\d*\.?\d+(e-?\d+)?/g, "#").replace(/[\s,]+/g, "");

export const rings = (d: string) =>
  d
    .split("M")
    .filter(Boolean)
    .map((ring) => {
      const n = ring.replace(/Z/g, "").trim().split(/\s+/).map(Number);

      return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i]!, n[2 * i + 1]!] as const);
    });

/** Nonzero winding of a point against every ring of a path. */
export const filled = (d: string, x: number, y: number) =>
  rings(d).reduce((w, ring) => {
    let sum = 0;

    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i]!;
      const [bx, by] = ring[(i + 1) % ring.length]!;
      const cross = (bx - ax) * (y - ay) - (x - ax) * (by - ay);

      if (ay <= y && by > y && cross > 0) sum++;
      else if (ay > y && by <= y && cross < 0) sum--;
    }

    return w + sum;
  }, 0) !== 0;

export const area = (d: string) =>
  rings(d).reduce(
    (sum, ring) =>
      sum +
      Math.abs(
        ring.reduce((s, [x, y], i) => {
          const [nx, ny] = ring[(i + 1) % ring.length]!;

          return s + x * ny - nx * y;
        }, 0) / 2,
      ),
    0,
  );

export const frame = rect(0, 0, 400, 400);

/** Share of a grid over the visible disk where `paths` agree with `truth` at the facing `middle`. */
export const agreement = (
  paths: readonly string[],
  middle: LonLat,
  truth: (at: [number, number]) => boolean,
) => {
  const ortho = geoOrthographic().rotate([-middle[0], -middle[1]]).scale(200).translate([200, 200]);

  let total = 0;
  let same = 0;

  for (let x = 4; x < 400; x += 8)
    for (let y = 4; y < 400; y += 8) {
      if (Math.hypot(x - 200, y - 200) > 196) continue;
      const at = ortho.invert!([x, y])!;
      total++;

      if (paths.some((d) => filled(d, x, y)) === truth(at)) same++;
    }

  return same / total;
};
