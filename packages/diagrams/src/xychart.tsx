/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Text,
  circle,
  enter,
  line,
  path,
  rect,
  through,
  track,
  type Span,
  type Vec,
} from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import {
  extent,
  look,
  mix,
  partsOf,
  pop,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Reveal,
} from "./kit.tsx";
import { series as tint } from "./series.ts";

/** How a series is drawn. Make a series with `xyBar` or `xyLine`. */
export interface XyMark {
  readonly name: "bar" | "line";
}

const BAR: XyMark = { name: "bar" };
const LINE: XyMark = { name: "line" };

export interface XySeries {
  readonly mark: XyMark;
  /** Shown in a legend when any series has one. */
  readonly label?: string;
  readonly values: readonly number[];
}

export interface XySeriesOptions {
  /** Shown in a legend when any series has one. */
  readonly label?: string;
}

/** A series drawn as bars, one per value. */
export const xyBar = (values: readonly number[], { label }: XySeriesOptions = {}): XySeries => ({
  mark: BAR,
  ...(label !== undefined && { label }),
  values,
});

/** A series drawn as a line through its values. */
export const xyLine = (values: readonly number[], { label }: XySeriesOptions = {}): XySeries => ({
  mark: LINE,
  ...(label !== undefined && { label }),
  values,
});

export interface XyCategories {
  readonly title?: string;
  readonly categories: readonly string[];
}

export interface XyRange {
  readonly title?: string;
  readonly min: number;
  readonly max: number;
}

export interface XyValues {
  readonly title?: string;
  /** Without both limits the axis fits the data, bars standing on zero. */
  readonly min?: number;
  readonly max?: number;
}

export interface XyChartSpec {
  readonly title?: string;
  /** Draws categories down the left and values along the bottom. */
  readonly horizontal?: boolean;
  /** Without an x axis the points are numbered 1, 2, 3 and so on. */
  readonly x?: XyCategories | XyRange;
  readonly y?: XyValues;
  readonly series: readonly XySeries[];
}

export interface XyChartOptions extends DiagramOptions {
  /** Series appear one after another, named `series-1`, `series-2`, and so on. A span gives each series one beat. */
  readonly reveal?: Reveal<string>;
}

export type XyChart = Diagram<string>;

const WHAT = "xyChart()";
const PAD = 14;
const TICK = 4;
const LONG = 320;
const ROW = 30;
const SLOT = 52;
const DOT = 3.5;

const step = (span: number, count: number): number => {
  const raw = span / Math.max(count, 1);
  const power = Math.floor(Math.log10(raw));
  const unit = raw / 10 ** power;
  const factor = unit >= 7.07 ? 10 : unit >= 3.16 ? 5 : unit >= 1.41 ? 2 : 1;

  return factor * 10 ** power;
};

const num = (v: number): string => String(Number(v.toPrecision(12)));

const ticksOf = (lo: number, hi: number, by: number): number[] => {
  const out: number[] = [];

  for (let i = Math.ceil(lo / by - 1e-9); i * by <= hi + by * 1e-9 && out.length < 100; i++)
    out.push(Number((i * by).toPrecision(12)));

  return out;
};

export function xyChart(spec: XyChartSpec, options: XyChartOptions): XyChart {
  const l = look(options, WHAT);
  const all = spec.series;

  if (all.length === 0) throw new SceneError(`${WHAT} needs at least one series, got none.`);
  const count = all[0]!.values.length;

  if (count === 0) throw new SceneError(`${WHAT} series 1 needs at least one value, got none.`);

  all.forEach((s, i) => {
    if (s.values.length !== count)
      throw new SceneError(
        `${WHAT} series ${i + 1} has ${s.values.length} values, but series 1 has ${count}.`,
        "Give every series one value per category.",
      );

    if (!s.values.every(Number.isFinite))
      throw new SceneError(`${WHAT} series ${i + 1} needs plain numbers, got NaN or Infinity.`);
  });
  const x = spec.x;

  const categories: string[] =
    x === undefined
      ? Array.from({ length: count }, (_, i) => String(i + 1))
      : "categories" in x
        ? [...x.categories]
        : Array.from({ length: count }, (_, i) =>
            num(count === 1 ? x.min : x.min + (i * (x.max - x.min)) / (count - 1)),
          );

  if (categories.length !== count)
    throw new SceneError(
      `${WHAT} has ${categories.length} categories but its series have ${count} values.`,
      "Give every series one value per category.",
    );

  if (x && "min" in x && !(x.min < x.max))
    throw new SceneError(`${WHAT} x range needs min below max, got ${x.min} to ${x.max}.`);
  const y = spec.y ?? {};

  if (y.min !== undefined && y.max !== undefined && !(y.min < y.max))
    throw new SceneError(`${WHAT} y range needs min below max, got ${y.min} to ${y.max}.`);
  const ids = all.map((_, i) => `series-${i + 1}`);
  const beats = schedule(options.reveal, ids, WHAT);
  const horizontal = spec.horizontal === true;
  const hasBars = all.some((s) => s.mark === BAR);

  const data = all.flatMap((s) => s.values);

  let [lo, hi] = [
    Math.min(...data, ...(hasBars ? [0] : [])),
    Math.max(...data, ...(hasBars ? [0] : [])),
  ];

  if (lo === hi) [lo, hi] = lo === 0 ? [0, 1] : [lo - Math.abs(lo) / 2, hi + Math.abs(hi) / 2];
  const exact = y.min !== undefined && y.max !== undefined;

  if (exact) [lo, hi] = [y.min!, y.max!];
  else {
    if (y.min !== undefined) lo = y.min;

    if (y.max !== undefined) hi = y.max;
  }

  const valueLong = horizontal ? 440 : LONG;

  const by = step(
    hi - lo,
    Math.max(2, Math.min(10, Math.floor(valueLong / (horizontal ? 70 : 48)))),
  );

  if (!exact) {
    if (y.min === undefined) lo = Math.floor(lo / by + 1e-9) * by;

    if (y.max === undefined) hi = Math.ceil(hi / by - 1e-9) * by;
  }

  const ticks = ticksOf(lo, hi, by);

  const small = l.small;
  const titleSize = Math.round(l.size * 1.2);
  const lineH = Math.round(small * 1.4);
  const widest = Math.max(...categories.map((c) => l.measure(c, small)));
  const tickW = Math.max(...ticks.map((t) => l.measure(num(t), small)));

  const titleW = spec.title === undefined ? 0 : l.measure(spec.title, titleSize, l.weight);
  const head = spec.title === undefined ? 0 : Math.round(l.size * 1.6) + 6;

  const legend = all.flatMap((s, i) => (s.label === undefined ? [] : [{ label: s.label, i }]));
  const legendW = legend.reduce((w, e) => w + 20 + l.measure(e.label, small) + 18, 0);
  const legendH = legend.length > 0 ? lineH + 8 : 0;

  const catTitle = x?.title;
  const valTitle = y.title;
  const leftTitle = (horizontal ? catTitle : valTitle) || undefined;
  const bottomTitle = (horizontal ? valTitle : catTitle) || undefined;

  const plotW = horizontal
    ? 440
    : Math.max(LONG + 40, Math.min(720, count * Math.max(SLOT, Math.ceil(widest) + 14)));

  const plotH = horizontal ? Math.max(200, count * ROW) : LONG;
  const slot = (horizontal ? plotH : plotW) / count;

  const left =
    PAD + (leftTitle ? lineH + 4 : 0) + Math.ceil(horizontal ? widest : tickW) + TICK + 6;

  const top = PAD + head + legendH + 8;
  const bottom = top + plotH;
  const right = left + plotW;
  const width = Math.ceil(Math.max(right + PAD, titleW + 2 * PAD, legendW + 2 * PAD));
  const height = Math.ceil(bottom + TICK + 6 + lineH + (bottomTitle ? lineH + 4 : 0) + PAD);

  const along = (v: number): number => (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo);
  const catAt = (i: number): number => (i + 0.5) * slot;

  const at = (i: number, v: number): Vec =>
    horizontal
      ? [left + along(v) * plotW, top + catAt(i)]
      : [left + catAt(i), bottom - along(v) * plotH];

  const grid = mix(l.colors.line, l.colors.background, 0.25);
  const axis = mix(l.colors.line, l.colors.background, 0.7);
  const every = Math.max(1, Math.ceil((horizontal ? lineH : Math.ceil(widest) + 12) / slot));
  const bars = all.map((s, i) => [s, i] as const).filter(([s]) => s.mark === BAR);
  const lane = Math.min((slot * 0.72) / Math.max(bars.length, 1), 40);

  const label = (
    key: string,
    text: string,
    p: Vec,
    anchor: "right" | "top" | "center",
    turn = false,
  ) => (
    <Text
      key={key}
      font={l.font}
      size={small}
      fill={l.colors.muted}
      anchor={anchor}
      at={p}
      rotate={turn ? -90 : undefined}
    >
      {text}
    </Text>
  );

  const frame = (
    <Group key="~frame">
      {spec.title !== undefined && (
        <Text
          key="title"
          font={l.font}
          size={titleSize}
          weight={l.weight}
          fill={l.colors.text}
          anchor="top"
          at={[width / 2, PAD]}
        >
          {spec.title}
        </Text>
      )}
      {legend.map((e, n) => {
        const before = legend
          .slice(0, n)
          .reduce((w, p) => w + 20 + l.measure(p.label, small) + 18, 0);

        const x0 = (width - legendW) / 2 + before;
        const y0 = PAD + head + lineH / 2;

        return (
          <Group key={`legend-${n}`}>
            <Shape
              key="swatch"
              geometry={rect(12, 12, { radius: 3 })}
              at={[x0, y0 - 6]}
              fill={tint(l, e.i)}
            />
            <Text
              key="name"
              font={l.font}
              size={small}
              fill={l.colors.text}
              anchor="left"
              at={[x0 + 18, y0]}
            >
              {e.label}
            </Text>
          </Group>
        );
      })}
      {ticks.map((t, n) => {
        const p = at(0, t);
        const [px, py] = horizontal ? [p[0], bottom] : [left, p[1]];

        return (
          <Group key={`tick-${n}`}>
            <Shape
              key="grid"
              geometry={horizontal ? line([px, top], [px, bottom]) : line([left, py], [right, py])}
              stroke={{ color: grid, width: 1, dash: [1, 4] }}
            />
            {horizontal
              ? label("value", num(t), [px, py + TICK + 4], "top")
              : label("value", num(t), [left - TICK - 5, py], "right")}
          </Group>
        );
      })}
      {categories.map((c, i) =>
        i % every === 0
          ? horizontal
            ? label(`category-${i}`, c, [left - TICK - 5, top + catAt(i)], "right")
            : label(`category-${i}`, c, [left + catAt(i), bottom + TICK + 4], "top")
          : null,
      )}
      <Shape
        key="axis-x"
        geometry={line([left, bottom], [right, bottom])}
        stroke={{ color: axis, width: 1.2 }}
      />
      <Shape
        key="axis-y"
        geometry={line([left, top], [left, bottom])}
        stroke={{ color: axis, width: 1.2 }}
      />
      {leftTitle !== undefined &&
        label("left-title", leftTitle, [PAD + lineH / 2, top + plotH / 2], "center", true)}
      {bottomTitle !== undefined &&
        label("bottom-title", bottomTitle, [left + plotW / 2, height - PAD - lineH / 2], "center")}
    </Group>
  );

  const seriesNode = (s: XySeries, k: number) => {
    const when: Span | undefined = beats.get(ids[k]!);
    const color = tint(l, k);
    const pts = s.values.map((v, i) => at(i, v));
    const nth = bars.findIndex(([, j]) => j === k);

    if (s.mark === BAR) {
      return (
        <Group key={ids[k]} motion={when && pop(when)}>
          {s.values.map((v, i) => {
            const shift = (nth - (bars.length - 1) / 2) * lane;
            const [cx, cy] = pts[i]!;
            const [bx, by0] = at(i, Math.min(Math.max(0, lo), hi));
            const long = Math.abs(horizontal ? cx - bx : cy - by0);

            return (
              <Shape
                key={`bar-${i}`}
                geometry={
                  horizontal
                    ? rect(Math.max(long, 0.5), lane - 2)
                    : rect(lane - 2, Math.max(long, 0.5))
                }
                at={
                  horizontal
                    ? [Math.min(cx, bx), cy + shift - (lane - 2) / 2]
                    : [cx + shift - (lane - 2) / 2, Math.min(cy, by0)]
                }
                fill={color}
              />
            );
          })}
        </Group>
      );
    }

    const shape = pts.slice(1).reduce((p, pt) => p.lineTo(pt), path().moveTo(pts[0]!));
    const draw = when && track(0).to(1, when);

    return (
      <Group key={ids[k]}>
        {pts.length > 1 && (
          <Shape
            key="line"
            geometry={shape}
            stroke={{ color, width: 2.5, cap: "round", join: "round" }}
            trim={draw && through(draw, (d): Vec => [0, d])}
          />
        )}
        {pts.map((p, i) => (
          <Shape
            key={`dot-${i}`}
            geometry={circle(DOT)}
            anchor="center"
            at={p}
            fill={color}
            stroke={{ color: l.colors.background, width: 1.5 }}
            motion={when && enter(when, { from: { opacity: 0 } })}
          />
        ))}
      </Group>
    );
  };

  const handle = partsOf<string>(WHAT, new Map(ids.map((id) => [id, beats.get(id)])));

  const draw = (between?: Child) => (
    <Group ref={handle.ref}>
      {frame}
      {between}
      {all.map(seriesNode)}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [width, height],
    span: extent([...beats.values()]),
    ...handle,
  };
}
