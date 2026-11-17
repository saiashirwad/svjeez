/** @jsxImportSource svjeez */
import {
  ease,
  motion,
  span as spanOf,
  type Color,
  type Drawn,
  type Ease,
  type Span,
  type Spanned,
} from "svjeez";
import type { GeoMap, Region } from "./index.ts";
import type { ColorScale, Hex } from "./scale.tsx";

/** A value per region, by `id` or `properties.name`. A list is the region's value at each time in `times`. */
export type RegionValues = Readonly<Record<string, number | readonly number[]>>;

export interface ChoroplethOptions {
  readonly scale: ColorScale;
  readonly ease?: Ease;
  readonly lines?: Color;
  /** Px. Default 0.4. */
  readonly lineWidth?: number;
  readonly class?: string;
}

/** A region `values` names, with when it fills: from the first span that changes its color to the end of the last. */
export interface ChoroplethRegion extends Region {
  readonly span: Spanned;
}

/**
 * The colored map. Its parts are the regions `values` names, found by id or `properties.name` as `map.part()` finds
 * them; `span` covers every span passed, and `bounds` every region drawn.
 */
export interface Choropleth extends Drawn<ChoroplethRegion> {
  readonly unmatched: readonly string[];
  readonly groups: number;
}

const isName = (name: unknown): name is string => typeof name === "string";

/** The regions `values` names, with each key resolved. Keys that match no region are returned apart. */
export const resolveRegions = (map: GeoMap, values: RegionValues) => {
  const byKey = new Map<string, Region>();

  for (const region of map.parts) {
    byKey.set(region.id, region);
    const name = region.properties?.name;

    if (isName(name) && !byKey.has(name)) byKey.set(name, region);
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

const spansOf = (when: Span | readonly Span[], frames: number): Span[] => {
  const list = [when].flat();

  if (list.length !== frames)
    throw new Error(
      `choropleth() has ${frames} value${frames === 1 ? "" : "s"} per region but ${list.length} span${list.length === 1 ? "" : "s"}. Pass one span per value.`,
    );

  list.forEach(({ at, over }, i) => {
    const before = list[i - 1];

    if (!(at >= 0) || !(over >= 0) || (over === 0 && i > 0))
      throw new Error(
        `choropleth() needs spans that start at 0 or later and last longer than 0, got at ${at} and over ${over}. Only the first may have no length, which cuts to its colors.`,
      );

    if (before && at < before.at + before.over - 1e-9)
      throw new Error(
        `choropleth() has a span at ${at}s that starts before the one before it ends.`,
      );
  });

  return list;
};

/**
 * Colors every region in `values` from `scale`; a list plays through `when`, one span per value. The first span fades in
 * from `empty`, or cuts if it has no length (`{ at: 0, over: 0 }` shows the colors from the start). Regions with no value take `empty`.
 */
export function choropleth(
  when: Span | readonly Span[],
  map: GeoMap,
  values: RegionValues,
  options: ChoroplethOptions,
): Choropleth {
  const { scale, ease: curve = ease.inOut } = options;
  const { found, unmatched } = resolveRegions(map, values);

  const series = found.map(([region, value]) => ({ region, list: [value].flat() }));
  const lengths = new Set(series.map(({ list }) => list.length));
  const frames = Math.max(1, ...lengths);

  if (lengths.size > 1 && !(lengths.size === 2 && lengths.has(1)))
    throw new Error(
      `choropleth() needs every region to have the same number of values, got lists of ${[...lengths].join(" and ")}.`,
    );
  const spans = spansOf(when, frames);

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
  const rest = map.parts.filter((region) => !named.has(region)).map((region) => region.d);

  const cut = spans[0]!.over === 0;
  const fromStart = cut && spans[0]!.at === 0;

  const track = (colors: readonly Hex[]) =>
    colors.length === 1 && fromStart
      ? undefined
      : colors.reduce(
          (m, color, i) => {
            if (i === 0 && fromStart) return m;

            return i === 0 && cut
              ? m.set({ fill: color }, spans[0]!.at)
              : m.to({ fill: color }, spanOf(spans[i]!.at, spans[i]!.over), curve);
          },
          motion({ fill: fromStart ? colors[0]! : scale.empty }),
        );

  const fills = (colors: readonly Hex[]): Spanned => {
    let shown: Hex = fromStart ? colors[0]! : scale.empty;

    const changes = spans.filter((_, i) => {
      const changed = colors[i] !== shown;
      shown = colors[i]!;

      return changed;
    });

    const [first, last] = [changes[0] ?? spans[0]!, changes.at(-1) ?? spans[0]!];

    return spanOf(first.at, last.at + last.over - first.at);
  };

  const parts = courses.map(({ region, colors }): ChoroplethRegion => ({
    ...region,
    span: fills(colors),
  }));

  const first = spans[0]!;
  const last = spans.at(-1)!;

  return {
    span: spanOf(first.at, last.at + last.over - first.at),
    bounds: map.bounds({ type: "FeatureCollection", features: map.parts.map((r) => r.feature) }),
    parts,
    part: (key) => {
      const found = parts.find((r) => r.id === String(key) || r.properties?.name === key);

      if (!found)
        throw new Error(
          `choropleth() has no value for ${JSON.stringify(key)}. Its regions are those \`values\` names, as in ${parts
            .slice(0, 3)
            .map((r) => JSON.stringify(r.properties?.name ?? r.id))
            .join(", ")}.`,
        );

      return found;
    },
    node: (
      <g class={options.class}>
        {[...groups.values()].map(({ colors, d }) => (
          <path d={d} fill={colors.at(-1)} animation={track(colors)} />
        ))}
        {rest.length > 0 && <path d={rest.join("")} fill={scale.empty} />}
        {options.lines !== undefined && (
          <path
            d={map.lines}
            fill="none"
            stroke={options.lines}
            strokeWidth={options.lineWidth ?? 0.4}
            strokeLinejoin="round"
          />
        )}
      </g>
    ),
    unmatched,
    groups: groups.size,
  };
}
