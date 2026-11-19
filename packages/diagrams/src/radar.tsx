/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Text,
  circle,
  ease,
  enter,
  path,
  polygon,
  rect,
  type Geometry,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import {
  checkIds,
  extent,
  look,
  partsOf,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Reveal,
} from "./kit.tsx";
import { series } from "./series.ts";

export interface RadarCurve {
  readonly label?: string;
  /** One value per axis, in axis order. */
  readonly values: readonly number[];
}

export interface RadarSpec<C extends Record<string, readonly number[] | RadarCurve>> {
  readonly title?: string;
  /** The label of each axis, at least three, clockwise from the top. */
  readonly axes: readonly string[];
  readonly curves: C;
  /** The value at the rim. Defaults to the largest value. */
  readonly max?: number;
  /** The value at the centre. Defaults to 0. */
  readonly min?: number;
  /** Graticule rings, defaults to 5. */
  readonly ticks?: number;
  /** Round curves on circular rings (the default), or straight edges on polygonal ones. */
  readonly graticule?: "circle" | "polygon";
  /** Defaults to true. */
  readonly showLegend?: boolean;
}

export interface RadarOptions<Id extends string = string> extends DiagramOptions {
  readonly reveal?: Reveal<Id>;
}

export type Radar<Id extends string> = Diagram<Id>;

const WHAT = "radar()";
const PAD = 12;
const TENSION = 0.17;
const MAX_TICKS = 32;

const isValues = (c: readonly number[] | RadarCurve): c is readonly number[] => Array.isArray(c);

const round = (n: number): number => Math.round(n * 100) / 100;

const smooth = (points: readonly Vec[]): Geometry => {
  const n = points.length;
  const at = (k: number): Vec => points[(k + n) % n]!;
  let shape = path().moveTo(points[0]!);

  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];

    shape = shape.curveTo(
      [p1[0] + (p2[0] - p0[0]) * TENSION, p1[1] + (p2[1] - p0[1]) * TENSION],
      [p2[0] - (p3[0] - p1[0]) * TENSION, p2[1] - (p3[1] - p1[1]) * TENSION],
      p2,
    );
  }

  return shape.close();
};

export function radar<const C extends Record<string, readonly number[] | RadarCurve>>(
  spec: RadarSpec<C>,
  options: RadarOptions<NoInfer<keyof C & string>>,
): Radar<keyof C & string> {
  type Id = keyof C & string;

  const l = look(options, WHAT);
  const n = spec.axes.length;
  const ticks = spec.ticks ?? 5;
  const min = spec.min ?? 0;
  const graticule = spec.graticule ?? "circle";

  const items = Object.entries<readonly number[] | RadarCurve>(spec.curves).map(([id, c]) => ({
    id,
    label: isValues(c) ? id : (c.label ?? id),
    values: isValues(c) ? c : c.values,
  }));

  const ids = items.map((c) => c.id);
  checkIds(ids, WHAT, "curve");

  if (n < 3)
    throw new SceneError(
      `${WHAT} has ${n} axes, and a radar needs at least 3.`,
      "Add axes so the curves enclose an area.",
    );

  if (!(Number.isInteger(ticks) && ticks >= 1 && ticks <= MAX_TICKS))
    throw new SceneError(
      `${WHAT} needs ticks to be a whole number from 1 to ${MAX_TICKS}, got ${ticks}.`,
      "Leave it out for 5 rings.",
    );

  if (graticule !== "circle" && graticule !== "polygon")
    throw new SceneError(
      `${WHAT} graticule must be "circle" or "polygon", got ${JSON.stringify(graticule)}.`,
    );

  for (const c of items) {
    if (c.values.length !== n)
      throw new SceneError(
        `${WHAT} curve "${c.id}" has ${c.values.length} values for ${n} axes.`,
        "Give each curve one value per axis.",
      );

    if (!c.values.every(Number.isFinite))
      throw new SceneError(`${WHAT} curve "${c.id}" has a value that is not a finite number.`);
  }

  const max = spec.max ?? Math.max(...items.flatMap((c) => c.values));

  if (!(Number.isFinite(max) && max > min))
    throw new SceneError(
      `${WHAT} needs max above min, got max ${max} and min ${min}.`,
      "Set max higher than min, or give a curve a value above min.",
    );
  const shown = schedule(options.reveal, ids, WHAT);
  const R = Math.round(l.size * 11);
  const at = R * 1.05 + 8;

  const unit = spec.axes.map((_, i): Vec => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;

    return [Math.cos(a), Math.sin(a)];
  });

  const labels = spec.axes.map((label, i) => {
    const [ux, uy] = unit[i]!;
    const w = l.measure(label, l.small, l.weight);
    const h = l.small * 1.4;

    return {
      label,
      x: ux * at + (ux > 0.01 ? w / 2 : ux < -0.01 ? -w / 2 : 0),
      y: uy * at + (uy > 0.01 ? h / 2 : uy < -0.01 ? -h / 2 : 0),
      w,
      h,
    };
  });

  const [titleW, titleH] =
    spec.title === undefined
      ? [0, 0]
      : [l.measure(spec.title, l.size * 1.15, l.weight), l.size * 2.4];

  const rowH = Math.round(l.size * 1.7);

  const legendW =
    spec.showLegend === false
      ? 0
      : 20 + Math.max(...items.map((c) => l.measure(c.label, l.small, l.weight)));

  const legendH = spec.showLegend === false ? 0 : items.length * rowH;
  const x0 = Math.min(-R, ...labels.map((b) => b.x - b.w / 2));
  const x1 = Math.max(R, ...labels.map((b) => b.x + b.w / 2));
  const y0 = Math.min(-R, -legendH / 2, ...labels.map((b) => b.y - b.h / 2));
  const y1 = Math.max(R, legendH / 2, ...labels.map((b) => b.y + b.h / 2));
  const gap = legendW === 0 ? 0 : 28;
  const bodyW = x1 - x0 + gap + legendW;
  const width = Math.max(bodyW, titleW) + 2 * PAD;
  const [cx, cy] = [PAD + (width - 2 * PAD - bodyW) / 2 - x0, PAD + titleH - y0];
  const lx = cx + x1 + gap;
  const ly = cy - legendH / 2;
  const height = PAD * 2 + titleH + (y1 - y0);

  const ring = (r: number): Geometry =>
    graticule === "circle" ? circle(r) : polygon(...unit.map(([ux, uy]): Vec => [ux * r, uy * r]));

  const spokes = unit.reduce(
    (p, [ux, uy]) => p.moveTo([0, 0]).lineTo([round(ux * R), round(uy * R)]),
    path(),
  );

  const outline = (values: readonly number[]): Geometry => {
    const points = values.map((v, i): Vec => {
      const r = (R * (Math.min(Math.max(v, min), max) - min)) / (max - min);

      return [round(unit[i]![0] * r), round(unit[i]![1] * r)];
    });

    return graticule === "circle" ? smooth(points) : polygon(...points);
  };

  const parts = new Map<string, Span | undefined>(ids.map((id) => [id, shown.get(id)]));
  const handle = partsOf<Id>(WHAT, parts);
  const grid = l.colors.line;

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {spec.title !== undefined && (
        <Text
          key="title"
          font={l.font}
          size={l.size * 1.15}
          weight={l.weight}
          fill={l.colors.text}
          anchor="center"
          at={[width / 2, PAD + titleH / 2]}
        >
          {spec.title}
        </Text>
      )}
      <Group key="grid" offset={[cx, cy]}>
        {Array.from({ length: ticks }, (_, i) => (
          <Shape
            key={`ring-${i + 1}`}
            geometry={ring((R * (i + 1)) / ticks)}
            stroke={{ color: grid, width: 1 }}
            opacity={0.45}
          />
        ))}
        <Shape key="spokes" geometry={spokes} stroke={{ color: grid, width: 1 }} opacity={0.7} />
      </Group>
      {labels.map((b) => (
        <Text
          key={`axis-${b.label}`}
          font={l.font}
          size={l.small}
          weight={l.weight}
          fill={l.colors.muted}
          anchor="center"
          at={[cx + b.x, cy + b.y]}
        >
          {b.label}
        </Text>
      ))}
      {between}
      {items.map((c, i) => {
        const when = shown.get(c.id);
        const color = series(l, i);
        const geometry = outline(c.values);

        return (
          <Group
            key={c.id}
            offset={[cx, cy]}
            motion={when && enter(when, { from: { opacity: 0, scale: 0.6 }, curve: ease.pop })}
          >
            <Shape key="fill" geometry={geometry} fill={color} opacity={0.2} />
            <Shape key="line" geometry={geometry} stroke={{ color, width: 2, join: "round" }} />
          </Group>
        );
      })}
      {legendW > 0 &&
        items.map((c, i) => {
          const when = shown.get(c.id);
          const y = ly + i * rowH + rowH / 2;
          const color = series(l, i);

          return (
            <Group key={`legend-${c.id}`} motion={when && enter(when)}>
              <Shape
                key="swatch"
                geometry={rect(12, 12, { radius: 2 })}
                anchor="center"
                at={[lx + 6, y]}
                fill={color}
                opacity={0.55}
                stroke={{ color, width: 1 }}
              />
              <Text
                key="label"
                font={l.font}
                size={l.small}
                weight={l.weight}
                fill={l.colors.text}
                anchor="left"
                at={[lx + 20, y]}
              >
                {c.label}
              </Text>
            </Group>
          );
        })}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(width), Math.ceil(height)],
    span: extent([...parts.values()]),
    ...handle,
  };
}
