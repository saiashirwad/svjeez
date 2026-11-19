/** @jsxImportSource svjeez */
import { Group, Shape, Text, circle, rect, type Span } from "svjeez";
import { SceneError, type Child, type Color } from "svjeez/tools";
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

export interface QuadrantPoint {
  readonly label: string;
  /** From 0 (left) to 1 (right). */
  readonly x: number;
  /** From 0 (bottom) to 1 (top). */
  readonly y: number;
  readonly radius?: number;
  readonly color?: Color;
}

export interface QuadrantAxis {
  readonly low: string;
  /** Without a high label the axis shows one label, centered. */
  readonly high?: string;
}

export interface QuadrantChartSpec {
  readonly title?: string;
  readonly xAxis?: QuadrantAxis;
  readonly yAxis?: QuadrantAxis;
  readonly quadrants?: {
    readonly topRight?: string;
    readonly topLeft?: string;
    readonly bottomLeft?: string;
    readonly bottomRight?: string;
  };
  readonly points: readonly QuadrantPoint[];
}

export interface QuadrantChartOptions extends DiagramOptions {
  /** Points pop in one after another, named `point-1`, `point-2`, and so on. A span gives each point one beat. */
  readonly reveal?: Reveal<string>;
}

export type QuadrantChart = Diagram<string>;

const WHAT = "quadrantChart()";
const PAD = 12;
const PLOT = 440;
const GAP = 4;
const RADIUS = 6;
const AWAY = 5;

type Box = readonly [x0: number, y0: number, x1: number, y1: number];

const hits = (a: Box, b: Box): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

export function quadrantChart(
  spec: QuadrantChartSpec,
  options: QuadrantChartOptions,
): QuadrantChart {
  const l = look(options, WHAT);
  const ids = spec.points.map((_, i) => `point-${i + 1}`);

  spec.points.forEach((p, i) => {
    if (!(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))
      throw new SceneError(
        `${WHAT} point ${i + 1} ("${p.label}") needs x and y from 0 to 1, got [${p.x}, ${p.y}].`,
      );

    if (p.radius !== undefined && !(p.radius > 0))
      throw new SceneError(`${WHAT} point ${i + 1} ("${p.label}") needs a radius above 0.`);
  });
  const beats = schedule(options.reveal, ids, WHAT);

  const titleSize = Math.round(l.size * 1.2);
  const titleW = spec.title === undefined ? 0 : l.measure(spec.title, titleSize, l.weight);
  const head = spec.title === undefined ? 0 : Math.round(l.size * 1.6) + 10;
  const axisH = Math.round(l.small * 1.4);
  const left = PAD + (spec.yAxis ? axisH + 6 : 0);
  const top = PAD + head;
  const bottom = top + PLOT;
  const width = Math.ceil(Math.max(left + PLOT + PAD, titleW + 2 * PAD));
  const height = Math.ceil(bottom + (spec.xAxis ? 6 + axisH : 0) + PAD);
  const tile = (PLOT - GAP) / 2;
  const q = spec.quadrants ?? {};

  const tiles = [
    { text: q.topRight, x: left + tile + GAP, y: top },
    { text: q.topLeft, x: left, y: top },
    { text: q.bottomLeft, x: left, y: top + tile + GAP },
    { text: q.bottomRight, x: left + tile + GAP, y: top + tile + GAP },
  ];

  const fills = [0.1, 0.07, 0.04, 0.07].map((share) =>
    mix(l.colors.line, l.colors.background, share),
  );

  const labelH = Math.round(l.small * 1.3);

  const labelAt = (x: number, y: number, text: string): Box => {
    const half = l.measure(text, l.small) / 2;

    return [x - half, y - labelH / 2, x + half, y + labelH / 2];
  };

  const taken: Box[] = tiles.flatMap((t) =>
    t.text === undefined ? [] : [labelAt(t.x + tile / 2, t.y + 8 + labelH / 2, t.text)],
  );

  const gaps: Box[] = [
    [left + tile, top, left + tile + GAP, bottom],
    [left, top + tile, left + PLOT, top + tile + GAP],
  ];

  const dots = spec.points.map((p, i) => ({
    x: left + p.x * PLOT,
    y: bottom - p.y * PLOT,
    r: p.radius ?? RADIUS,
    color: p.color ?? l.colors.accent,
    text: p.label,
    id: ids[i]!,
  }));

  for (const d of dots) taken.push([d.x - d.r, d.y - d.r, d.x + d.r, d.y + d.r]);
  const inside: Box = [left, top, left + PLOT, bottom];

  const places = dots.map((d) => {
    const half = l.measure(d.text, l.small) / 2;
    const clamp = (x: number): number => Math.min(Math.max(x, left + half), left + PLOT - half);
    const away = d.r + AWAY + labelH / 2;

    const spots: readonly (readonly [number, number])[] = [
      [clamp(d.x), d.y + away],
      [clamp(d.x), d.y - away],
      [d.x + d.r + AWAY + half, d.y],
      [d.x - d.r - AWAY - half, d.y],
    ];

    const fits = spots.filter(([x, y]) => {
      const b = labelAt(x, y, d.text);

      return b[0] >= inside[0] && b[2] <= inside[2] && b[1] >= inside[1] && b[3] <= inside[3];
    });

    const free = (c: readonly [number, number], blockers: readonly Box[]): boolean =>
      blockers.every((b) => !hits(b, labelAt(c[0], c[1], d.text)));

    const [x, y] = fits.find((c) => free(c, [...taken, ...gaps])) ??
      fits.find((c) => free(c, taken)) ??
      fits[0] ?? [clamp(d.x), Math.min(d.y + away, bottom - labelH / 2)];

    taken.push(labelAt(x, y, d.text));

    return [x, y] as const;
  });

  const axisText = (key: string, text: string, x: number, y: number, turn: boolean) => (
    <Text
      key={key}
      font={l.font}
      size={l.small}
      fill={l.colors.muted}
      anchor="center"
      at={[x, y]}
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
      {tiles.map((t, i) => (
        <Group key={`quadrant-${i + 1}`}>
          <Shape
            key="tile"
            geometry={rect(tile, tile, { radius: 4 })}
            at={[t.x, t.y]}
            fill={fills[i]}
          />
          {t.text !== undefined && (
            <Text
              key="label"
              font={l.font}
              size={l.small}
              weight={l.weight}
              fill={l.colors.muted}
              anchor="top"
              at={[t.x + tile / 2, t.y + 8]}
            >
              {t.text}
            </Text>
          )}
        </Group>
      ))}
      {spec.xAxis && (
        <Group key="x-axis">
          {spec.xAxis.high === undefined
            ? axisText("low", spec.xAxis.low, left + PLOT / 2, bottom + 6 + axisH / 2, false)
            : [
                axisText("low", spec.xAxis.low, left + PLOT / 4, bottom + 6 + axisH / 2, false),
                axisText(
                  "high",
                  spec.xAxis.high,
                  left + (PLOT * 3) / 4,
                  bottom + 6 + axisH / 2,
                  false,
                ),
              ]}
        </Group>
      )}
      {spec.yAxis && (
        <Group key="y-axis">
          {spec.yAxis.high === undefined
            ? axisText("low", spec.yAxis.low, PAD + axisH / 2, top + PLOT / 2, true)
            : [
                axisText("low", spec.yAxis.low, PAD + axisH / 2, top + (PLOT * 3) / 4, true),
                axisText("high", spec.yAxis.high, PAD + axisH / 2, top + PLOT / 4, true),
              ]}
        </Group>
      )}
    </Group>
  );

  const pointNode = (d: (typeof dots)[number], i: number) => {
    const when: Span | undefined = beats.get(d.id);
    const [tx, ty] = places[i]!;

    return (
      <Group key={d.id} motion={when && pop(when)}>
        <Shape
          key="dot"
          geometry={circle(d.r)}
          anchor="center"
          at={[d.x, d.y]}
          fill={d.color}
          stroke={{ color: l.colors.background, width: 1.5 }}
        />
        <Text
          key="label"
          font={l.font}
          size={l.small}
          fill={l.colors.text}
          anchor="center"
          at={[tx, ty]}
        >
          {d.text}
        </Text>
      </Group>
    );
  };

  const handle = partsOf<string>(WHAT, new Map(ids.map((id) => [id, beats.get(id)])));

  const draw = (between?: Child) => (
    <Group ref={handle.ref}>
      {frame}
      {between}
      {dots.map(pointNode)}
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
