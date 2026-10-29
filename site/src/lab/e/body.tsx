import { clamp } from "../util";
import { add } from "./geometry";
import { polyline, r1, type Cx } from "./look";
import { meltBy, meltMotion, partMotion } from "./motions";
import { PALETTES } from "./palette";

type Layer = "co" | "cf" | "ct";

type Cap = "round" | "butt";

/** Melting moves the body in short segments, each to where its middle melts. */
const SEGMENT = 6;

/** The body: one outline and one fill, then the pieces that cross over themselves drawn again on top. */
export const body = (cx: Cx) => {
  const { g, f, lay, pal, ink } = cx;
  const { G, spine } = lay;
  const over: [number, number][] = [];
  const gapIdx = Math.ceil((G * 2.2) / (lay.L / spine.length));

  for (let j = 0; j < spine.length; j++)
    for (let i = 0; i < j - gapIdx; i++)
      if (Math.hypot(spine[i]!.x - spine[j]!.x, spine[i]!.y - spine[j]!.y) < G * 1.1) {
        const last = over.at(-1);

        if (last && j - last[1] <= 3) last[1] = j;
        else over.push([j, j]);
        break;
      }

  const crossings = f.liquid
    ? []
    : over.map(([a, b]) => [Math.max(0, a - 4), Math.min(spine.length - 1, b + 4)] as const);

  const step = lay.L / (spine.length - 1);
  const stripes = g.pattern === "tabby" ? `${r1(G * 0.22)} ${r1(G * 0.4)}` : undefined;

  const layer = (kind: Layer, from: number, to: number, cap: Cap) => {
    const d = polyline(spine.slice(from, to + 1));

    if (kind === "co")
      return (
        <path
          d={d}
          class="co"
          fill="none"
          stroke={ink}
          strokeLinecap={cap}
          strokeLinejoin="round"
        />
      );

    if (kind === "cf")
      return (
        <path
          d={d}
          class="cf"
          fill="none"
          stroke={pal.base}
          strokeLinecap={cap}
          strokeLinejoin="round"
        />
      );

    return (
      stripes && (
        <path
          d={d}
          class="ct"
          fill="none"
          stroke={pal.dark}
          strokeDasharray={stripes}
          strokeDashoffset={r1(-from * step)}
          strokeLinecap="butt"
          opacity={0.8}
        />
      )
    );
  };

  const stretch = (from: number, to: number, cap: Cap) => (
    <>
      {layer("co", from, to, cap)}
      {layer("cf", from, to, cap)}
      {layer("ct", from, to, cap)}
    </>
  );

  const segments = Array.from(
    { length: Math.ceil((spine.length - 1) / SEGMENT) },
    (_, k) => [k * SEGMENT, Math.min(spine.length - 1, (k + 1) * SEGMENT)] as const,
  );

  const melted = (["co", "cf", "ct"] as const).map((kind) =>
    segments.map(([a, b]) => (
      <g animation={meltMotion(meltBy(cx, spine[Math.round((a + b) / 2)]!))}>
        {layer(kind, a, b, "round")}
      </g>
    )),
  );

  return {
    /** The outline as path data, for the 4D ghost. */
    d: polyline(spine),
    /** The whole body. Built on each call because the file may hold it twice. */
    whole: () => (f.liquid ? melted : stretch(0, spine.length - 1, "round")),
    /** The stretches that cross over themselves, drawn again on top. */
    crossings: () => crossings.map(([a, b]) => stretch(a, b, "butt")),
  };
};

/** Spots on the coat, drawn after the body so they sit on it. */
export const spots = (cx: Cx) => {
  const { g, lay, pal, rand } = cx;
  const { G, frames } = lay;

  const colors =
    g.fur === "calico"
      ? [PALETTES.calico.light, PALETTES.calico.dark]
      : g.fur === "cosmic"
        ? [pal.light]
        : [pal.dark];

  const count =
    g.pattern === "spots" || g.fur === "calico" || g.fur === "cosmic"
      ? Math.round(clamp(lay.L / 28, 4, 40))
      : 0;

  return Array.from({ length: count }, (_, i) => {
    const fr = frames[Math.floor(rand() * frames.length)]!;
    const p = add(fr.p, fr.n, (rand() - 0.5) * G * 0.45);

    const r =
      g.fur === "cosmic"
        ? 1.2 + rand() * 1.8
        : G * (0.1 + rand() * (g.fur === "calico" ? 0.22 : 0.1));

    return (
      <circle
        cx={r1(p.x)}
        cy={r1(p.y)}
        r={r1(r)}
        fill={colors[i % colors.length]}
        animation={partMotion(cx, p, 0)}
      />
    );
  });
};
