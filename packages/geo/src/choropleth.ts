import { ease, el, motion, type Color, type Ease, type Seconds, type SvgNode } from "svjeez";
import type { GeoMap, Region } from "./index.ts";
import type { ColorScale, Hex } from "./scale.ts";

/** A value per region, by `id` or `properties.name`. A list is the region's value at each time in `at`. */
export type RegionValues = Readonly<Record<string, number | readonly number[]>>;

export interface ChoroplethOptions {
  readonly scale: ColorScale;
  /**
   * When each value takes hold: one time for single values, or one per entry of the lists, in order. The first time
   * fades the map in from the scale's `empty` color unless it is 0. Default 0.
   */
  readonly at?: Seconds | readonly Seconds[];
  /** Seconds a change of color takes, cut short to fit between two times. Default 0.8. */
  readonly over?: Seconds;
  readonly ease?: Ease;
  /** Draws the map's borders over the fill in this color. */
  readonly lines?: Color;
  /** Px. Default 0.4. */
  readonly lineWidth?: number;
  readonly class?: string;
}

export interface Choropleth {
  readonly node: SvgNode;
  /** The keys in `values` that no region answers to, so a mismatch between the data and the map is visible. */
  readonly unmatched: readonly string[];
  /** How many animated paths the map came to: regions whose colors follow the same course share one. */
  readonly groups: number;
}

/** The regions `values` names, with each key resolved. Keys that match no region are returned apart. */
export const resolveRegions = (
  map: GeoMap,
  values: RegionValues,
): { found: [Region, number | readonly number[]][]; unmatched: string[] } => {
  const byKey = new Map<string, Region>();

  for (const region of map.regions) {
    byKey.set(region.id, region);
    const name = region.properties?.name;

    if (typeof name === "string" && !byKey.has(name)) byKey.set(name, region);
  }

  const found = new Map<Region, number | readonly number[]>();
  const unmatched: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    const region = byKey.get(key);

    if (region) found.set(region, value);
    else unmatched.push(key);
  }

  return { found: [...found], unmatched };
};

const times = (at: ChoroplethOptions["at"], frames: number): Seconds[] => {
  const list = typeof at === "number" ? [at] : [...(at ?? [0])];

  if (list.length !== frames)
    throw new Error(
      `choropleth() has ${frames} value${frames === 1 ? "" : "s"} per region but ${list.length} time${list.length === 1 ? "" : "s"} in at. Pass one time per value.`,
    );

  if (list.some((t, i) => !(t >= 0) || (i > 0 && t <= list[i - 1]!)))
    throw new Error(`choropleth() needs times that rise from 0 or later, got ${list.join(", ")}.`);

  return list;
};

/**
 * Colors every region in `values` from `scale`, and plays a list of values through the times in `at`. Regions whose
 * colors follow the same course share one path, so a map of 180 countries with 9 classes stays small. Regions with no
 * value take the scale's `empty` color.
 */
export function choropleth(
  map: GeoMap,
  values: RegionValues,
  options: ChoroplethOptions,
): Choropleth {
  const { scale, over = 0.8, ease: curve = ease.inOut } = options;
  const { found, unmatched } = resolveRegions(map, values);

  const series = found.map(([region, value]) => ({ region, list: [value].flat() }));
  const lengths = new Set(series.map(({ list }) => list.length));
  const frames = Math.max(1, ...lengths);

  if (lengths.size > 1 && !(lengths.size === 2 && lengths.has(1)))
    throw new Error(
      `choropleth() needs every region to have the same number of values, got lists of ${[...lengths].join(" and ")}.`,
    );
  const at = times(options.at, frames);

  /** The region's color in each frame; a single number holds in all of them. */
  const courses = series.map(({ region, list }) => ({
    region,
    colors: Array.from({ length: frames }, (_, i) =>
      scale(list.length === 1 ? list[0]! : (list[i] ?? NaN)),
    ),
  }));

  const groups = new Map<string, { colors: Hex[]; d: string }>();

  for (const { region, colors } of courses) {
    const key = colors.join(",");
    const group = groups.get(key) ?? { colors, d: "" };
    group.d += region.d;
    groups.set(key, group);
  }

  const named = new Set(found.map(([region]) => region));
  const rest = map.regions.filter((region) => !named.has(region)).map((region) => region.d);

  const track = (colors: readonly Hex[]) =>
    colors.length === 1 && at[0] === 0
      ? undefined
      : colors.reduce(
          (m, color, i) => {
            if (i === 0 && at[0] === 0) return m;
            const into = i === 0 ? over : Math.min(over, at[i]! - at[i - 1]!);

            return m.at(at[i]!).to({ fill: color }, into, curve);
          },
          motion({ fill: at[0] === 0 ? colors[0]! : scale.empty }),
        );

  return {
    node: el.g({ class: options.class }, [
      [...groups.values()].map(({ colors, d }) =>
        el.path({ d, fill: colors.at(-1), animation: track(colors) }),
      ),
      rest.length > 0 && el.path({ d: rest.join(""), fill: scale.empty }),
      options.lines !== undefined &&
        el.path({
          d: map.lines,
          fill: "none",
          stroke: options.lines,
          strokeWidth: options.lineWidth ?? 0.4,
          strokeLinejoin: "round",
        }),
    ]),
    unmatched,
    groups: groups.size,
  };
}
