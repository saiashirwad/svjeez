import {
  Center,
  Group,
  Shape,
  Text,
  draw,
  enter,
  path,
  polygon,
  polyline,
  rect,
  ref,
  sampled,
  span,
  tokens,
  track,
  type Geometry,
  type Ref,
  type SceneElement,
  type Span,
  type Track,
  type Vec,
} from "svjeez";
import {
  SceneError,
  type Child,
  type Color,
  type Font,
  type FontValue,
  type Hex,
  type Layers,
  type PathBuilder,
  type Token,
} from "svjeez/tools";
import { curve, vec } from "./curve.ts";
import type { Box, Point, Size } from "./layout/box.ts";
import type { ArrowHead, Labelled, NodeRole } from "./types.ts";

export interface DiagramColors {
  readonly background: Color;
  readonly text: Color;
  readonly line: Color;
  readonly accent: Color;
  readonly muted?: Color;
  readonly highlight?: Color;
  readonly roles?: Readonly<Partial<Record<NodeRole, Color>>>;
}

export interface DiagramOptions {
  readonly font: FontValue;
  readonly size?: number;
  readonly weight?: number;
  readonly colors?: DiagramColors;
  readonly name?: string;
}

export interface Diagram<Id extends string> {
  readonly node: SceneElement;
  with(between: Child): SceneElement;
  readonly size: Vec;
  readonly ref: Ref;
  readonly span: Span | undefined;
  part(id: Id): Ref;
  when(id: Id): Span | undefined;
}

export type Reveal<Id extends string> = Span | Readonly<Partial<Record<Id, Span>>>;

const palette = tokens({
  light: {
    "diagram-background": "#FFFFFF",
    "diagram-text": "#1D1D1F",
    "diagram-line": "#8E8E93",
    "diagram-muted": "#6E6E73",
    "diagram-blue": "#0A6CFF",
    "diagram-green": "#2FA84F",
    "diagram-cyan": "#1B9AAA",
    "diagram-red": "#E5453B",
    "diagram-yellow": "#E5A50A",
    "diagram-magenta": "#9B51E0",
  },
  dark: {
    "diagram-background": "#090A0C",
    "diagram-text": "#E5E5EA",
    "diagram-line": "#7C7C82",
    "diagram-muted": "#A1A1A6",
    "diagram-blue": "#5EA0FF",
    "diagram-green": "#32D74B",
    "diagram-cyan": "#64D2FF",
    "diagram-red": "#FF6961",
    "diagram-yellow": "#FFD60A",
    "diagram-magenta": "#C58AFF",
  },
});

export const defaultColors: DiagramColors = {
  background: palette["diagram-background"],
  text: palette["diagram-text"],
  line: palette["diagram-line"],
  muted: palette["diagram-muted"],
  accent: palette["diagram-blue"],
  highlight: palette["diagram-red"],
  roles: {
    task: palette["diagram-blue"],
    input: palette["diagram-green"],
    output: palette["diagram-cyan"],
    tool: palette["diagram-red"],
    decision: palette["diagram-yellow"],
    store: palette["diagram-magenta"],
  },
};

const isToken = (color: Color): color is Token => typeof color !== "string";

const channels = (hex: Hex): readonly number[] =>
  [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));

const blend = (fg: Hex, bg: Hex, share: number): Hex => {
  const [a, b] = [channels(fg), channels(bg)];

  // SAFETY: six hex digits after a # is a Hex
  return `#${a
    .map((c, i) =>
      Math.round(c * share + b[i]! * (1 - share))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}` as Hex;
};

const nameOf = (color: Color): string => (isToken(color) ? color.name : `c${color.slice(1, 7)}`);

export const mix = (fg: Color, bg: Color, share: number): Color => {
  if (!isToken(fg) && !isToken(bg)) return blend(fg, bg, share);
  const name = `${nameOf(fg)}-${Math.round(share * 100)}-${nameOf(bg)}`;
  const light = (c: Color): Hex => (isToken(c) ? c.light : c);
  const dark = (c: Color): Hex => (isToken(c) ? c.dark : c);

  return tokens({
    light: { [name]: blend(light(fg), light(bg), share) },
    dark: { [name]: blend(dark(fg), dark(bg), share) },
  })[name]!;
};

const isFamily = (font: FontValue): font is Exclude<FontValue, Font> => "face" in font;

export interface Look {
  readonly font: FontValue;
  readonly size: number;
  readonly small: number;
  readonly weight: number | undefined;
  readonly colors: Required<Omit<DiagramColors, "roles">>;
  measure(text: string, size: number, weight?: number): number;
  tint(role: NodeRole): Color;
  wash(role: NodeRole, share?: number): Color;
}

export const look = (options: DiagramOptions | undefined, what: string): Look => {
  if (!options || options.font === undefined)
    throw new SceneError(
      `${what} needs a font to measure its labels with.`,
      `Pass one in its options, as in ${what.replace("()", "")}(spec, { font: sans }).`,
    );
  const { font, size = 14, weight, colors = defaultColors } = options;

  if (!(size > 0 && Number.isFinite(size)))
    throw new SceneError(`${what} needs a size above 0, got ${size}.`);
  const muted = colors.muted ?? colors.text;
  const washes = new Map<string, Color>();

  const tint = (role: NodeRole): Color => colors.roles?.[role] ?? colors.accent;

  return {
    font,
    size,
    small: Math.round(size * 0.85 * 100) / 100,
    weight,
    colors: {
      background: colors.background,
      text: colors.text,
      line: colors.line,
      accent: colors.accent,
      muted,
      highlight: colors.highlight ?? colors.accent,
    },
    measure: (text, at, w) => (isFamily(font) ? font.face(w ?? 400) : font).measure(text, at),
    tint,
    wash: (role, share = 0.22) => {
      const key = `${role} ${share}`;
      const known = washes.get(key);

      if (known) return known;
      const made = mix(tint(role), colors.background, share);
      washes.set(key, made);

      return made;
    },
  };
};

export const isBare = <T extends object>(spec: string | T): spec is string =>
  typeof spec === "string";

export const labelOf = (spec: Labelled): { readonly label: string; readonly role: NodeRole } =>
  isBare(spec) ? { label: spec, role: "task" } : { label: spec.label, role: spec.role ?? "task" };

export const sizeOf = (l: Look, role: NodeRole, label: string): Size => {
  const text = l.measure(label, l.size, l.weight);
  const [w, h] = [text + l.size * 2.2, Math.round(l.size * 2.8)];

  switch (role) {
    case "input":
      return { w: w + h * 0.7, h };
    case "output":
      return { w: w + h * 0.4, h };
    case "tool":
      return { w: w + 16, h };
    case "decision":
      return { w: text * 1.45 + l.size * 4, h: Math.round(l.size * 4.4) };
    case "store":
      return { w, h: h + 10 };
    case "task":
      return { w, h };
  }
};

export const labelSize = (l: Look, text: string): Size => ({
  w: l.measure(text, l.small) + 10,
  h: Math.round(l.small * 1.5),
});

const SKEW = 0.35;
const LID = 5;
const K = 0.5523;

export const onOutline = (role: NodeRole, b: Box, end: Point, toward: Point): Point => {
  const [cx, cy] = [b.x + b.w / 2, b.y + b.h / 2];
  const vertical = end.x === toward.x;

  switch (role) {
    case "decision": {
      if (vertical)
        return {
          x: end.x,
          y:
            cy +
            Math.sign(end.y - cy) * (b.h / 2) * (1 - Math.min(1, Math.abs(end.x - cx) / (b.w / 2))),
        };

      return {
        x:
          cx +
          Math.sign(end.x - cx) * (b.w / 2) * (1 - Math.min(1, Math.abs(end.y - cy) / (b.h / 2))),
        y: end.y,
      };
    }

    case "input": {
      if (vertical) return end;
      const s = b.h * SKEW * (1 - (end.y - b.y) / b.h);

      return { x: end.x < cx ? b.x + s : b.x + b.w - b.h * SKEW + s, y: end.y };
    }

    case "output": {
      const r = b.h / 2;

      if (vertical) {
        const dx = Math.max(0, Math.abs(end.x - cx) - (b.w / 2 - r));

        return {
          x: end.x,
          y: cy + Math.sign(end.y - cy) * Math.sqrt(Math.max(0, r * r - dx * dx)),
        };
      }

      return {
        x:
          cx +
          Math.sign(end.x - cx) * (b.w / 2 - r + Math.sqrt(Math.max(0, r * r - (end.y - cy) ** 2))),
        y: end.y,
      };
    }

    case "store": {
      if (!vertical) return end;
      const bulge = LID * Math.sqrt(Math.max(0, 1 - ((end.x - cx) / (b.w / 2)) ** 2));

      return { x: end.x, y: end.y < cy ? b.y + LID - bulge : b.y + b.h - LID + bulge };
    }

    case "task":
    case "tool":
      return end;
  }
};

const halfEllipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: -1 | 1,
  down: -1 | 1,
) => {
  const [a, b] = [rx * K, ry * K];

  return [
    [
      [cx + from * rx, cy + down * b],
      [cx + from * a, cy + down * ry],
      [cx, cy + down * ry],
    ],
    [
      [cx - from * a, cy + down * ry],
      [cx - from * rx, cy + down * b],
      [cx - from * rx, cy],
    ],
  ] as const satisfies readonly (readonly [Vec, Vec, Vec])[];
};

export const outline = (role: NodeRole, w: number, h: number): Geometry => {
  switch (role) {
    case "input": {
      const s = h * SKEW;

      return polygon([
        [s, 0],
        [w, 0],
        [w - s, h],
        [0, h],
      ]);
    }

    case "output":
      return rect(w, h, { radius: h / 2 });
    case "decision":
      return polygon([
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2],
      ]);
    case "store": {
      const [top, bottom] = [
        halfEllipse(w / 2, LID, w / 2, LID, -1, -1),
        halfEllipse(w / 2, h - LID, w / 2, LID, 1, 1),
      ];

      return [...top, ...bottom]
        .reduce(
          (p, [c1, c2, to], i) => (i === 2 ? p.lineTo([w, h - LID]) : p).curveTo(c1, c2, to),
          path().moveTo([0, LID]),
        )
        .close();
    }

    case "tool":
      return rect(w, h, { radius: 3 });
    case "task":
      return rect(w, h, { radius: 8 });
  }
};

const detailOf = (role: NodeRole, w: number, h: number): Geometry | undefined => {
  if (role === "tool")
    return path()
      .moveTo([8, 0])
      .lineTo([8, h])
      .moveTo([w - 8, 0])
      .lineTo([w - 8, h]);

  if (role !== "store") return undefined;

  return halfEllipse(w / 2, LID, w / 2, LID, -1, 1).reduce(
    (p, [c1, c2, to]) => p.curveTo(c1, c2, to),
    path().moveTo([0, LID]),
  );
};

const round = (value: number): number => Math.round(value * 100) / 100;

export const pop = (when: Span): Layers => enter(when, { from: { opacity: 0, offset: [0, 6] } });

export const fade = (when: Span): Track<number> => track(0).to(1, when);

export interface NodeDraw {
  readonly key: string;
  readonly role: NodeRole;
  readonly label: string;
  readonly box: Box;
  readonly motion?: Layers;
}

export const drawNode = (l: Look, n: NodeDraw): SceneElement => {
  const tint = l.tint(n.role);
  const [w, h] = [round(n.box.w), round(n.box.h)];
  const detail = detailOf(n.role, w, h);

  return (
    <Group key={n.key} at={[round(n.box.x), round(n.box.y)]} motion={n.motion}>
      <Shape
        key="shape"
        geometry={outline(n.role, w, h)}
        fill={l.wash(n.role)}
        stroke={{ color: tint, width: 1.5 }}
      />
      {detail && <Shape key="detail" geometry={detail} stroke={{ color: tint, width: 1.5 }} />}
      <Text
        key="label"
        font={l.font}
        size={l.size}
        weight={l.weight}
        fill={l.colors.text}
        anchor="center"
        at={[w / 2, round(h / 2 + (n.role === "store" ? LID / 2 : 0))]}
      >
        {n.label}
      </Text>
    </Group>
  );
};

const HEAD = 8;

export interface EdgeDraw {
  readonly key: string;
  readonly points: readonly Point[];
  readonly color?: Color;
  readonly width?: number;
  readonly dash?: readonly number[];
  readonly head?: ArrowHead;
  readonly drawn?: Span;
}

const headOf = (head: ArrowHead, tip: Point, ux: number, uy: number): Geometry => {
  const p = (x: number, y: number): Vec => vec({ x, y });
  const tipAt = p(tip.x, tip.y);
  const left = p(tip.x - ux * HEAD - uy * HEAD * 0.5, tip.y - uy * HEAD + ux * HEAD * 0.5);
  const right = p(tip.x - ux * HEAD + uy * HEAD * 0.5, tip.y - uy * HEAD - ux * HEAD * 0.5);

  switch (head) {
    case "filled":
      return polygon([tipAt, left, right]);
    case "async":
      return polyline([left, tipAt, right]);
    default:
      return path()
        .moveTo(left)
        .lineTo(p(tip.x + uy * HEAD * 0.5, tip.y - ux * HEAD * 0.5))
        .moveTo(right)
        .lineTo(p(tip.x - uy * HEAD * 0.5, tip.y + ux * HEAD * 0.5));
  }
};

export const drawEdge = (l: Look, e: EdgeDraw): SceneElement => {
  const color = e.color ?? l.colors.line;
  const head = e.head ?? "filled";
  const [a, b] = [e.points.at(-2)!, e.points.at(-1)!];
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const [ux, uy] = [(b.x - a.x) / length, (b.y - a.y) / length];

  const points =
    head === "filled"
      ? [...e.points.slice(0, -1), { x: b.x - ux * (HEAD - 1), y: b.y - uy * (HEAD - 1) }]
      : e.points;

  const width = e.width ?? 1.5;

  const stroke = {
    color,
    width,
    cap: "round",
    join: "round",
    ...(e.dash && { dash: e.dash }),
  } as const;

  const { drawn } = e;

  const tip = drawn && span(drawn.start + drawn.over * 0.85, drawn.over * 0.15);

  return (
    <Group key={e.key}>
      <Shape
        key="line"
        geometry={curve(points).geometry}
        stroke={stroke}
        trim={drawn && !e.dash ? draw(drawn) : undefined}
        opacity={drawn && e.dash ? fade(drawn) : undefined}
      />
      {head !== "none" && (
        <Shape
          key="head"
          geometry={headOf(head, b, ux, uy)}
          fill={head === "filled" ? color : undefined}
          stroke={
            head === "filled" ? undefined : { color, width: 1.5, cap: "round", join: "round" }
          }
          opacity={tip && fade(tip)}
        />
      )}
    </Group>
  );
};

export interface ChipDraw {
  readonly key: string;
  readonly box: Box;
  readonly text: string;
  readonly fill?: Color;
  readonly ground?: Color | "none";
  readonly motion?: Layers;
}

export const drawChip = (l: Look, c: ChipDraw): SceneElement => (
  <Center
    key={c.key}
    at={[round(c.box.x), round(c.box.y)]}
    width={round(c.box.w)}
    height={round(c.box.h)}
    radius={3}
    fill={c.ground === "none" ? undefined : (c.ground ?? l.colors.background)}
    motion={c.motion}
  >
    <Text font={l.font} size={l.small} fill={c.fill ?? l.colors.muted}>
      {c.text}
    </Text>
  </Center>
);

const isSpan = (value: Reveal<string>): value is Span =>
  typeof value.start === "number" && typeof value.over === "number";

const given = (value: Span | undefined): value is Span =>
  typeof value === "object" && value !== null && isSpan(value);

export const spanOf = (value: Span | undefined, what: string): Span => {
  if (!given(value))
    throw new SceneError(`${what} needs a span, got ${String(value)}.`, "Write span(start, over).");

  if (!(value.start >= 0 && value.over > 0 && Number.isFinite(value.start + value.over)))
    throw new SceneError(
      `${what} needs a span that starts at 0 or later and lasts longer than 0, got span(${value.start}, ${value.over}).`,
    );

  return span(value.start, value.over);
};

const quoted = (ids: readonly string[]): string =>
  ids.length > 8
    ? `${ids
        .slice(0, 8)
        .map((id) => `"${id}"`)
        .join(", ")}, …`
    : ids.map((id) => `"${id}"`).join(", ");

export const beatOf = (beat: Span, i: number): Span =>
  span(Math.round((beat.start + i * beat.over) * 1e6) / 1e6, beat.over);

export const schedule = (
  reveal: Reveal<string> | undefined,
  order: readonly string[],
  what: string,
): Map<string, Span | undefined> => {
  const shown = new Map<string, Span | undefined>(order.map((id) => [id, undefined]));

  if (reveal === undefined) return shown;

  if (isSpan(reveal)) {
    const beat = spanOf(reveal, `${what} reveal`);
    order.forEach((id, i) => shown.set(id, beatOf(beat, i)));

    return shown;
  }

  for (const [id, when] of Object.entries(reveal)) {
    if (!shown.has(id))
      throw new SceneError(
        `${what} reveal names "${id}", which is not one of its nodes.`,
        `Its nodes are ${quoted(order)}.`,
      );

    if (when !== undefined) shown.set(id, spanOf(when, `${what} reveal for "${id}"`));
  }

  return shown;
};

export const extent = (spans: readonly (Span | undefined)[]): Span | undefined => {
  const known = spans.filter((s): s is Span => s !== undefined);

  if (known.length === 0) return undefined;
  const first = Math.min(...known.map((s) => s.start));

  return span(first, Math.max(...known.map((s) => s.start + s.over)) - first);
};

export const checkIds = (ids: readonly string[], what: string, kind: string): void => {
  if (ids.length === 0) throw new SceneError(`${what} needs at least one ${kind}, got none.`);

  for (const id of ids)
    if (id === "" || id.includes("/"))
      throw new SceneError(
        `${what} has a ${kind} named "${id}".`,
        'Name it with no "/", so its part can be found.',
      );
};

export const known = (
  id: string,
  ids: ReadonlySet<string> | readonly string[],
  what: string,
  kind: string,
  where: string,
): string => {
  const all = [...ids];

  if (!all.includes(id))
    throw new SceneError(
      `${what} ${where} names "${id}", which is not one of its ${kind}s.`,
      `Its ${kind}s are ${quoted(all)}.`,
    );

  return id;
};

export const edgeKey = (from: string, to: string): string => `${from}->${to}`;

export type EdgeId<E> = E extends readonly [
  infer F extends string,
  infer T extends string,
  ...unknown[],
]
  ? `${F}->${T}`
  : never;

export const keyed = (ids: readonly string[]): string[] => {
  const seen = new Map<string, number>();

  return ids.map((id) => {
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);

    return n === 1 ? id : `${id}#${n}`;
  });
};

export interface Parts<Id extends string> {
  readonly ref: Ref;
  part(id: Id): Ref;
  when(id: Id): Span | undefined;
}

export const partsOf = <Id extends string>(
  what: string,
  name: string,
  parts: ReadonlyMap<string, Span | undefined>,
): Parts<Id> => {
  const handle = ref(name);

  const find = (id: string): string => {
    if (!parts.has(id))
      throw new SceneError(
        `${what} has no part "${id}".`,
        `Its parts are ${quoted([...parts.keys()])}.`,
      );

    return id;
  };

  return {
    ref: handle,
    part: (id) => handle.part(find(id)),
    when: (id) => parts.get(find(id)),
  };
};

export class Route {
  readonly points: readonly Vec[];
  readonly geometry: Geometry;
  readonly length: number;
  readonly #lengths: readonly number[];

  constructor(hops: readonly (readonly Point[])[]) {
    const curves = hops.map(curve);
    this.points = curves.flatMap((c) => c.samples);
    let geometry: PathBuilder = path();

    for (const c of curves)
      for (const contour of c.geometry.contours) {
        geometry = geometry.moveTo(contour.start);

        for (const [c1, c2, to] of contour.curves) geometry = geometry.curveTo(c1, c2, to);
      }

    this.geometry = geometry;
    const lengths = [0];

    for (let i = 1; i < this.points.length; i++) {
      const [a, b] = [this.points[i - 1]!, this.points[i]!];
      lengths.push(lengths[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }

    this.#lengths = lengths;
    this.length = lengths.at(-1)!;
  }

  at(fraction: number): Vec {
    const goal = Math.min(1, Math.max(0, fraction)) * this.length;

    const i = Math.max(
      1,
      this.#lengths.findIndex((l) => l >= goal),
    );

    if (this.points.length === 1) return this.points[0]!;
    const [a, b] = [this.points[i - 1]!, this.points[i]!];
    const piece = this.#lengths[i]! - this.#lengths[i - 1]!;
    const share = piece > 0 ? (goal - this.#lengths[i - 1]!) / piece : 1;

    return [round(a[0] + (b[0] - a[0]) * share), round(a[1] + (b[1] - a[1]) * share)];
  }

  travel(when: Span): Track<Vec> {
    const s = spanOf(when, "travel()");

    return sampled((t: number): Vec => this.at(t / s.over), s, { tolerance: 0.5 });
  }
}
