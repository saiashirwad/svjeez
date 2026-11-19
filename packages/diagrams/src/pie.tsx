/** @jsxImportSource svjeez */
import { Group, Shape, Text, circle, path, rect, type SceneElement, type Span } from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import {
  checkIds,
  extent,
  look,
  partsOf,
  pop,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Reveal,
} from "./kit.tsx";
import { series } from "./series.ts";

export interface PieSlice {
  readonly label: string;
  readonly value: number;
}

export interface PieOptions<Id extends string = string> extends DiagramOptions {
  readonly reveal?: Reveal<Id>;
}

export type Pie<Id extends string> = Diagram<Id>;

const WHAT = "pie()";
const GAP = 36;
const HIDDEN = 0.01;
const OUTSIDE = 0.06;

const isValue = (slice: number | PieSlice): slice is number => typeof slice === "number";

const point = (r: number, turn: number): [number, number] => [
  Math.round(r * Math.sin(turn) * 100) / 100,
  Math.round(-r * Math.cos(turn) * 100) / 100,
];

const wedge = (r: number, from: number, to: number) => {
  const pieces = Math.max(1, Math.ceil((to - from) / (Math.PI / 2) - 1e-9));
  const step = (to - from) / pieces;
  const k = (4 / 3) * Math.tan(step / 4);
  let shape = path().moveTo([0, 0]).lineTo(point(r, from));

  for (let i = 0; i < pieces; i++) {
    const [a, b] = [from + i * step, from + (i + 1) * step];
    const [p, q] = [point(r, a), point(r, b)];

    shape = shape.curveTo(
      [p[0] + k * r * Math.cos(a), p[1] + k * r * Math.sin(a)],
      [q[0] - k * r * Math.cos(b), q[1] - k * r * Math.sin(b)],
      q,
    );
  }

  return shape.close();
};

export function pie<const S extends Record<string, number | PieSlice>>(
  spec: { readonly title?: string; readonly showData?: boolean; readonly slices: S },
  options: PieOptions<NoInfer<keyof S & string>>,
): Pie<keyof S & string> {
  type Id = keyof S & string;

  const l = look(options, WHAT);

  const items = Object.entries<number | PieSlice>(spec.slices).map(([id, s]) => ({
    id,
    label: isValue(s) ? id : s.label,
    value: isValue(s) ? s : s.value,
  }));

  const ids = items.map((s) => s.id);
  checkIds(ids, WHAT, "slice");

  for (const s of items)
    if (!(s.value >= 0 && Number.isFinite(s.value)))
      throw new SceneError(
        `${WHAT} slice "${s.id}" needs a value of 0 or more, got ${s.value}.`,
        "Slices share the circle by value, so a value cannot be negative.",
      );
  const total = items.reduce((sum, s) => sum + s.value, 0);

  if (!(total > 0))
    throw new SceneError(
      `${WHAT} needs a slice above 0, but its values add up to 0.`,
      "Give at least one slice a positive value.",
    );
  const shown = schedule(options.reveal, ids, WHAT);
  const R = Math.round(l.size * 8.5);
  const rowH = Math.round(l.size * 1.9);

  const rows = items.map((s) => ({
    ...s,
    text: spec.showData ? `${s.label} [${s.value}]` : s.label,
  }));

  const legendW = 20 + Math.max(...rows.map((r) => l.measure(r.text, l.size, l.weight)));
  const legendH = rows.length * rowH;

  const [titleW, titleH] =
    spec.title === undefined
      ? [0, 0]
      : [l.measure(spec.title, l.size * 1.15, l.weight), l.size * 2.4];

  const outer = items.some((s) => s.value / total < OUTSIDE && s.value / total >= HIDDEN) ? 26 : 4;
  const content = outer * 2 + R * 2 + GAP + legendW;
  const width = Math.max(content, titleW);
  const body = Math.max(R * 2 + outer * 2, legendH);
  const height = titleH + body;
  const [cx, cy] = [(width - content) / 2 + outer + R, titleH + body / 2];
  const lx = cx + R + outer + GAP;
  const ly = cy - legendH / 2;
  let turn = 0;

  const slices = items.map((s, i) => {
    const share = s.value / total;
    const [from, to] = [turn, turn + share * Math.PI * 2];
    turn = to;

    return { ...s, share, from, to, color: series(l, i) };
  });

  const parts = new Map<string, Span | undefined>(ids.map((id) => [id, shown.get(id)]));
  const handle = partsOf<Id>(WHAT, parts);
  const lonely = slices.filter((s) => s.share >= HIDDEN).length === 1;

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
          at={[width / 2, titleH / 2]}
        >
          {spec.title}
        </Text>
      )}
      {slices.map((s) => {
        const at = shown.get(s.id);
        const mid = (s.from + s.to) / 2;
        const inside = s.share >= OUTSIDE;
        const [tx, ty] = point(inside ? R * 0.65 : R + 14, mid);

        return (
          <Group key={s.id} offset={[cx, cy]} motion={at && pop(at)}>
            {s.share >= HIDDEN && (
              <Shape
                key="slice"
                geometry={lonely ? circle(R) : wedge(R, s.from, s.to)}
                fill={s.color}
                stroke={{ color: l.colors.background, width: 2, join: "round" }}
              />
            )}
            {s.share >= HIDDEN && (
              <Text
                key="share"
                font={l.font}
                size={l.small}
                weight={l.weight}
                fill={inside ? l.colors.background : l.colors.text}
                anchor="center"
                at={[tx, ty]}
              >
                {`${Math.round(s.share * 100)}%`}
              </Text>
            )}
          </Group>
        );
      })}
      {between}
      {slices.map((s, i) => {
        const at = shown.get(s.id);
        const y = ly + i * rowH + rowH / 2;

        return (
          <Group key={`legend-${s.id}`} motion={at && pop(at)}>
            <Shape
              key="swatch"
              geometry={rect(12, 12, { radius: 2 })}
              anchor="center"
              at={[lx + 6, y]}
              fill={s.color}
            />
            <Text
              key="label"
              font={l.font}
              size={l.size}
              weight={l.weight}
              fill={l.colors.text}
              anchor="left"
              at={[lx + 20, y]}
            >
              {rows[i]!.text}
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
