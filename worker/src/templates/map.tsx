import { arc, choropleth, legend, palettes, project, sequential } from "@svjeez/geo";
import { geoArea, geoCircle } from "d3-geo";
import { distance } from "fastest-levenshtein";
import { def, draw, enter, render, span, stagger, type Drawn, type Span } from "svjeez";
import { rect, type Rect } from "svjeez/geometry";
import { defaults, list, number, text, type Values } from "svjeez/params";
import world from "world-atlas/countries-110m.json";

import {
  HEIGHT,
  MARGIN,
  WIDTH,
  Title,
  color,
  css,
  geist,
  leave,
  theme,
} from "../../../examples/gallery-style";
import { block } from "../block";

const atlas = world;

const NAME = { maxLength: 40 };

export const params = {
  title: text("Three hubs, one network", {
    maxLength: 60,
    label: "The heading above the map. At most 60 characters.",
  }),
  measure: text("", {
    maxLength: 40,
    label:
      "What the countries' values measure, such as Population (millions). When given, the countries are shaded by value with a legend; empty to highlight them in one color.",
  }),
  countries: list(
    {
      name: text("", {
        ...NAME,
        label:
          "A country's name as Natural Earth writes it, such as United States of America, United Kingdom, Dem. Rep. Congo, Côte d'Ivoire.",
      }),
      value: number(0, {
        min: -1_000_000_000_000,
        max: 1_000_000_000_000,
        label: "Its value when measure is given; ignored otherwise.",
      }),
    },
    [],
    {
      max: 60,
      label:
        "Countries to highlight or shade, 0 to 60. The map zooms to them and the markers, so list only the countries the map is about: one large country such as Russia or the United States of America zooms it out to most of the world. With none and no markers it shows the world.",
    },
  ),
  markers: list(
    {
      label: text("", { maxLength: 40, label: "The place's name, at most 40 characters." }),
      lat: number(0, { min: -90, max: 90, label: "Latitude in degrees, north positive." }),
      lon: number(0, { min: -180, max: 180, label: "Longitude in degrees, east positive." }),
    },
    [
      { label: "London", lat: 51.5, lon: -0.13 },
      { label: "New York", lat: 40.71, lon: -74.01 },
      { label: "Singapore", lat: 1.35, lon: 103.82 },
      { label: "Tokyo", lat: 35.68, lon: 139.69 },
    ],
    { max: 16, label: "Places to mark with a dot and a label, 0 to 16." },
  ),
  routes: list(
    {
      from: text("", { maxLength: 40, label: "A marker's label, exactly as written in markers." }),
      to: text("", { maxLength: 40, label: "Another marker's label." }),
    },
    [
      { from: "London", to: "New York" },
      { from: "London", to: "Singapore" },
      { from: "Singapore", to: "Tokyo" },
    ],
    { max: 16, label: "Great-circle routes between markers, drawn in one after another, 0 to 16." },
  ),
};

type LonLat = readonly [number, number];

const AREA = rect(MARGIN, 104, WIDTH - 2 * MARGIN, HEIGHT - 104 - 56);

/** How much room is left around what the view fits, as a share of the area. */
const PAD = 0.1;
const LABEL = { size: 13, height: 16 };

const base = project(atlas, { frame: AREA });
const NAMES = base.parts.map((part) => String(part.properties?.name ?? part.id));

/** Atlas names that look like `name`: containing it, sharing its start or a word, or a few typos away. */
const nearest = (name: string): string[] => {
  const wanted = name.toLowerCase();
  const words = wanted.split(/\W+/).filter((word) => word.length > 2);

  const scored = NAMES.map((candidate) => {
    const lower = candidate.toLowerCase();

    const score =
      (lower.includes(wanted) || wanted.includes(lower) ? 3 : 0) +
      (lower.slice(0, 3) === wanted.slice(0, 3) ? 2 : 0) +
      words.filter((word) => lower.includes(word)).length +
      (distance(lower, wanted) <= Math.max(2, wanted.length / 4) ? 3 : 0);

    return { candidate, score };
  });

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ candidate }) => candidate);
};

/** The feature cut to its largest polygon, so France fits as France and not out to French Guiana. */
const mainland = <F extends ReturnType<typeof project>["parts"][number]["feature"]>(
  feature: F,
): F => {
  const { geometry } = feature;

  if (geometry?.type !== "MultiPolygon") return feature;

  const largest = geometry.coordinates
    .map((coordinates) => ({ type: "Polygon" as const, coordinates }))
    .reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));

  return { ...feature, geometry: largest };
};

const featureOf = (name: string, i: number) => {
  const found = base.parts.find((part) => part.properties?.name === name);

  if (!found) {
    const close = nearest(name);

    throw new Error(
      `countries[${i}].name "${name}" is not a country in the atlas. ${close.length ? `Did you mean ${close.map((c) => `"${c}"`).join(", ")}?` : "Use the country's Natural Earth name, such as United States of America."}`,
    );
  }

  return mainland(found.feature);
};

/** Where the label goes beside a dot, trying right, left, above and below for one that overlaps nothing placed. */
const placeLabels = (points: readonly { x: number; y: number; label: string }[]) => {
  const placed: Rect[] = points.map(({ x, y }) => rect(x - 4, y - 4, 8, 8));

  return points.map(({ x, y, label }) => {
    const w = geist.face(600).measure(label, LABEL.size);

    const options = [
      { box: rect(x + 8, y - 11, w, LABEL.height), at: [x + 8, y + 4], anchor: "start" },
      { box: rect(x - 8 - w, y - 11, w, LABEL.height), at: [x - 8, y + 4], anchor: "end" },
      { box: rect(x - w / 2, y - 26, w, LABEL.height), at: [x, y - 11], anchor: "middle" },
      { box: rect(x - w / 2, y + 7, w, LABEL.height), at: [x, y + 20], anchor: "middle" },
    ] as const;

    const overlap = (box: Rect) =>
      placed.reduce(
        (sum, o) =>
          sum +
          Math.max(0, Math.min(box.x + box.w, o.x + o.w) - Math.max(box.x, o.x)) *
            Math.max(0, Math.min(box.y + box.h, o.y + o.h) - Math.max(box.y, o.y)),
        0,
      );

    // The first side that overlaps nothing, or else the one that overlaps least.
    const chosen = options.reduce((best, option) =>
      overlap(option.box) < overlap(best.box) ? option : best,
    );

    placed.push(chosen.box);

    return chosen;
  });
};

/** The countries colored by value on a seven-step blue scale over their range. */
const shade = (
  map: ReturnType<typeof project>,
  countries: Values<typeof params>["countries"],
  when: Span,
) => {
  const values = countries.map((c) => c.value);
  const [low, high] = [Math.min(...values), Math.max(...values)];

  const scale = sequential(palettes.blues, {
    domain: high > low ? [low, high] : [low - 1, low + 1],
    steps: 7,
  });

  return {
    scale,
    drawn: choropleth(when, map, Object.fromEntries(countries.map((c) => [c.name, c.value])), {
      scale,
    }),
  };
};

const path = (points: readonly { x: number; y: number }[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");

/** The map's values: everything but the heading above it. */
export type MapValues = Omit<Values<typeof params>, "title">;

/** The map filling `box` above a strip for its legend: the base map, the countries, the routes and the labelled places. */
export const mapBlock = (p: MapValues, box: Rect): Drawn => {
  const AREA = rect(box.x, box.y, box.w, box.h - 56);
  const features = p.countries.map(({ name }, i) => featureOf(name, i));
  const places = p.markers.map(({ lat, lon }): LonLat => [lon, lat]);

  const target = {
    type: "FeatureCollection" as const,
    features: [
      ...features,
      ...places.map((at) => ({
        type: "Feature" as const,
        properties: {},
        geometry: geoCircle().center([at[0], at[1]]).radius(4)(),
      })),
    ],
  };

  const zoomed = target.features.length > 0;

  const inset = rect(
    AREA.x + AREA.w * PAD,
    AREA.y + AREA.h * PAD,
    AREA.w * (1 - 2 * PAD),
    AREA.h * (1 - 2 * PAD),
  );

  const map = zoomed
    ? project(atlas, { frame: inset, fit: target })
    : project(atlas, { frame: AREA, filter: (f) => f.properties?.name !== "Antarctica" });

  const named = new Set(p.countries.map((c) => c.name));
  const byLabel = new Map(p.markers.map((marker, i) => [marker.label, places[i]!]));

  const endOf = (label: string, path: string): LonLat => {
    const found = byLabel.get(label);

    if (!found)
      throw new Error(
        `${path} "${label}" is not a marker's label. Use one of: ${p.markers.map((m) => `"${m.label}"`).join(", ") || "none, so add markers first"}.`,
      );

    return found;
  };

  const lines = p.routes.map(({ from, to }, i) => {
    const [a, b] = [endOf(from, `routes[${i}].from`), endOf(to, `routes[${i}].to`)];

    try {
      return map.route(a, b);
    } catch {
      return arc(map, a, b);
    }
  });

  const points = places.map((at, i) => ({ ...map.point(at), label: p.markers[i]!.label }));
  const labels = placeLabels(points);
  const shading = span(0.6, 1);
  const pops = stagger(span(1.2, 0.4), points.length, 0.15);
  const routeAt = (pops.at(-1)?.end ?? shading.end) + 0.2;
  const drawn = stagger(span(routeAt, 1.2), lines.length, 0.4);

  // The shaded countries alone, on the same projection, so the scale's empty color fills nothing else.
  const shaded =
    p.measure && zoomed && p.countries.length
      ? shade(
          project(atlas, {
            frame: inset,
            fit: target,
            filter: (f) => named.has(String(f.properties?.name)),
          }),
          p.countries,
          { at: 0, over: 0 },
        )
      : undefined;

  const key =
    shaded &&
    legend(shaded.scale, {
      frame: rect(box.x, box.y + box.h - 40, 320, 10),
      title: p.measure,
      theme,
      font: geist,
      fontSize: 12,
      color: color.dim,
    });

  return block(
    <>
      <g
        clipPath={def.clipPath(
          {},
          <rect x={AREA.x} y={AREA.y} width={AREA.w} height={AREA.h} rx={8} />,
        )}
      >
        <g animation={enter(span(0.2, 0.6))}>
          <rect x={AREA.x} y={AREA.y} width={AREA.w} height={AREA.h} rx={8} fill={color.panel} />
          <path d={map.land} fill={color.edge} />
          <path d={map.lines} fill="none" stroke={color.bg} strokeWidth={0.6} />
        </g>
        {shaded && <g animation={enter(shading)}>{shaded.drawn.node}</g>}
        {!p.measure &&
          p.countries.map(({ name }) => (
            <path
              d={map.part(name).d}
              fill={color.accent}
              fillOpacity={0.45}
              animation={enter(shading)}
            />
          ))}
        <g fill="none" stroke={color.series[1]} strokeWidth={2} strokeLinecap="round">
          {lines.map((line, i) => (
            <path d={path(line)} animation={draw(drawn[i]!)} />
          ))}
        </g>
      </g>
      {key && <g animation={enter(shading.next(0.5))}>{key.node}</g>}
      <g fontFamily={geist} fontSize={LABEL.size} fontWeight={600} fill={color.ink}>
        {points.map(({ x, y, label }, i) => (
          <g animation={enter(pops[i]!, { opacity: 0, scale: 0.6 })}>
            <circle cx={x} cy={y} r={4.5} fill={color.accent} stroke={color.bg} strokeWidth={1.5} />
            <text
              x={labels[i]!.at[0]}
              y={labels[i]!.at[1]}
              textAnchor={labels[i]!.anchor}
              style={{ paintOrder: "stroke" }}
              stroke={color.bg}
              strokeWidth={3}
            >
              {label}
            </text>
          </g>
        ))}
      </g>
    </>,
    span(0.2, (drawn.at(-1)?.end ?? routeAt) - 0.2),
    box,
  );
};

export default function build(p: Values<typeof params> = defaults(params)): string {
  const drawn = mapBlock(p, rect(MARGIN, 104, WIDTH - 2 * MARGIN, HEIGHT - 104));
  const D = Math.max(6, drawn.span.end + 3);

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: p.title,
      desc: `${p.title}. A map${p.countries.length ? ` of ${p.countries.map((c) => (p.measure ? `${c.name} (${c.value})` : c.name)).join(", ")}` : ""}${p.markers.length ? `, marking ${p.markers.map((m) => m.label).join(", ")}` : ""}${p.routes.length ? `, with routes ${p.routes.map((r) => `${r.from} to ${r.to}`).join(", ")}` : ""}.`,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={color.bg} />
      <g animation={leave(D)}>
        <Title title={p.title} />
        {drawn.node}
      </g>
    </>,
  );
}
