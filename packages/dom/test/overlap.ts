import { valuesAt, type SvgNode } from "svjeez";

/** Opacity above which a text counts as seen. */
const SEEN = 0.1;

/** A glyph's estimated width, per em. */
const WIDTH = 0.6;

const STEP = 0.02;

/** A text drawn at one moment: what it says, how visible it is and the box it covers. */
interface Seen {
  readonly text: string;
  readonly opacity: number;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** A pair of different texts whose boxes overlap while both show. */
interface Clash {
  readonly t: number;
  readonly a: Seen;
  readonly b: Seen;
}

const attr = (node: SvgNode & { kind: "element" }, name: string): number =>
  Number(node.attrs[name] ?? 0) || 0;

/** Every text drawn at `t` with its opacity and box, after every ancestor's slide and fade. */
const textsAt = (node: SvgNode, t: number, duration: number): Seen[] => {
  const walk = (n: SvgNode, dx: number, dy: number, o: number): Seen[] => {
    if (n.kind !== "element")
      // SAFETY: a node with children that is not an element is a fragment, whose children are SvgNodes.
      return "children" in n ? (n.children as SvgNode[]).flatMap((c) => walk(c, dx, dy, o)) : [];

    // SAFETY: the motions here animate numeric channels only, so every value at t is a number.
    const at = n.motions.map(
      (m) => valuesAt(m, t, { duration }) as Record<string, number | undefined>,
    );

    // SAFETY: the merge of those records has the same value type.
    const v = Object.assign({}, ...at) as Record<string, number | undefined>;

    const opacity = at.reduce(
      (p, values) => p * (values.opacity ?? 1),
      o * Number(n.attrs.opacity ?? 1),
    );

    if (n.tag === "text") {
      const value = n.children.map((c) => (c.kind === "text" ? c.value : "")).join("");
      const size = attr(n, "fontSize") || attr(n, "font-size") || 16;
      const x = dx + attr(n, "x") + (v.x ?? 0);
      const y = dy + attr(n, "y") + (v.y ?? 0);

      return value
        ? [
            {
              text: value,
              opacity,
              x0: x,
              x1: x + value.length * size * WIDTH,
              y0: y - size * 0.8,
              y1: y + size * 0.2,
            },
          ]
        : [];
    }

    return n.children.flatMap((c) => walk(c, dx + (v.x ?? 0), dy + (v.y ?? 0), opacity));
  };

  return walk(node, 0, 0, 1);
};

/** Moments in `[from, to]` where two different texts that both show cover the same ground. */
export const clashes = (node: SvgNode, duration: number, from = 0, to = duration): Clash[] => {
  const found: Clash[] = [];

  for (let t = from; t <= to + 1e-9; t += STEP) {
    const shown = textsAt(node, t, duration).filter((s) => s.opacity > SEEN);

    for (let i = 0; i < shown.length; i++)
      for (let j = i + 1; j < shown.length; j++) {
        const a = shown[i]!;
        const b = shown[j]!;

        if (a.text !== b.text && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1)
          found.push({ t, a, b });
      }
  }

  return found;
};
