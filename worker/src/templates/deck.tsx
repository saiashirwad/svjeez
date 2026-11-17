import { Clip, render, show, span, type Drawn } from "svjeez";
import { rect, type Rect } from "svjeez/geometry";
import { choice, defaults, list, parse, text, type Json, type Values } from "svjeez/params";

import {
  HEIGHT,
  MARGIN,
  WIDTH,
  TITLE,
  color,
  css,
  geist,
  motions,
  rise,
} from "../../../examples/gallery-style";
import { block, fitSize } from "../block";
import { cardBlock, params as cardParams } from "./card";
import { chartBlock, params as chartParams } from "./chart";
import { codeBlock, LANGUAGES, params as codeParams } from "./code";
import { diagramBlock, params as diagramParams } from "./diagram";
import { mathBlock, params as mathParams } from "./math";
import { plotBlock, params as plotParams } from "./plot";
import { terminalBlock, params as terminalParams } from "./terminal";

const KINDS = ["title", "bullets", "code", "diagram", "chart", "math", "plot", "terminal"] as const;

type Kind = (typeof KINDS)[number];

export const params = {
  slides: list(
    {
      kind: choice("bullets", KINDS, {
        label:
          "What the slide shows, which decides how body is read: title, bullets, code, diagram, chart, math, plot or terminal.",
      }),
      heading: text("", {
        maxLength: 60,
        label: "The slide's heading. At most 60 characters; up to about 40 show at full size.",
      }),
      body: text("", {
        maxLength: 3000,
        label: [
          "The slide's content as text, read by kind. At most 3000 characters.",
          "title: one line under the heading, or empty.",
          "bullets: 1 to 6 points, one per line, each at most 110 characters (up to about 60 show at full size).",
          "code: the source, with real newlines; at most about 15 lines of 60 characters fit on a slide.",
          "diagram: Mermaid source, a flowchart TD or LR, a sequenceDiagram or a stateDiagram-v2, about 10 nodes at most.",
          'chart: one "label: value" per line, such as "Q1: 42" or "JavaScript: 3", 2 to 16 lines; each label at most 20 characters, and shorter with many points (about 13 with 8 points, 6 with 16); the first line may be just bar, line or area (bar when left out).',
          "math: one TeX step per line, without dollar signs, 1 to 6 steps.",
          'plot: a first line "kind; expression" or, for parametric, "parametric; x(t); y(t)", where kind is function (in x), parametric (in t), polar (in theta) or implicit (F(x, y) = 0), in plain math syntax such as sin(x)/x; an optional second line is TeX to typeset above the graph.',
          'terminal: one line per row; a command starts with "$ ", output does not. The first line is a command. At most 10 lines of up to about 70 characters.',
        ].join(" "),
      }),
      language: choice("typescript", LANGUAGES, {
        label: "code slides only: the language to highlight. Ignored on other slides.",
      }),
    },
    [
      {
        kind: "title",
        heading: "Animated SVG, from code",
        body: "svjeez in four slides",
        language: "typescript",
      },
      {
        kind: "bullets",
        heading: "Why svjeez",
        body: "Scenes are TypeScript\nOne self-contained SVG\nNothing runs in the viewer's browser",
        language: "typescript",
      },
      {
        kind: "chart",
        heading: "Scenes rendered per week",
        body: "line\nW1: 120\nW2: 180\nW3: 260\nW4: 410",
        language: "typescript",
      },
      {
        kind: "code",
        heading: "A scene is a function",
        body: "export default () =>\n  render({ width: 480, height: 270, duration: 4 }, <Hello />);",
        language: "tsx",
      },
    ],
    { min: 2, max: 8, label: "The slides in order, 2 to 8. They play one after another." },
  ),
};

type Slide = Values<typeof params>["slides"][number];

const BODY = rect(MARGIN, 124, WIDTH - 2 * MARGIN, HEIGHT - 124 - 64);
const FULL = rect(MARGIN, MARGIN, WIDTH - 2 * MARGIN, HEIGHT - 2 * MARGIN - 24);
const HOLD = 2.5;
const FADE = 0.4;

/** Below this a slide's text gets too small to read. */
const SMALLEST = 0.65;

const lines = (body: string) =>
  body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

const CHART = /^(.+?):\s*(-?\d[\d,]*(?:\.\d+)?)$/;

const chartOf = (body: string): Json => {
  const rows = lines(body);
  const kind = ["bar", "line", "area"].includes(rows[0] ?? "") ? rows.shift()! : "bar";

  const data = rows.map((row, i) => {
    const [, label = "", value = ""] = CHART.exec(row) ?? [];

    if (!label)
      throw new Error(
        `line ${i + 1} "${row}" is not "label: value". Write one per line, such as "Q1: 42", after an optional first line bar, line or area.`,
      );

    return { label: label.trim(), value: Number(value.replaceAll(",", "")), other: 0 };
  });

  return { kind, series: "", compare: "", data };
};

const plotOf = (heading: string, body: string): Json => {
  const [first = "", tex = ""] = lines(body);
  const [kind = "", expression = "", y = ""] = first.split(";").map((part) => part.trim());

  if (!expression)
    throw new Error(
      `the first line "${first}" is not "kind; expression". Write such as "function; sin(x)/x" or "parametric; 16*sin(t)^3; 13*cos(t)".`,
    );

  return { title: heading, tex, kind, expression, y };
};

const terminalOf = (body: string): Json => ({
  title: "",
  lines: lines(body).map((row) =>
    row.startsWith("$ ") ? { kind: "command", text: row.slice(2) } : { kind: "output", text: row },
  ),
});

/** The title slide: the heading large and centered with a line under it, both set smaller when they are long. */
const titleOf = (heading: string, subtitle: string, box: Rect): Drawn => {
  const big = fitSize(geist.face(600), [heading], 52, box.w, 28);
  const small = fitSize(geist.face(400), [subtitle], 24, box.w, 16);

  if (big === undefined || small === undefined)
    throw new Error(
      `the ${big === undefined ? "heading" : "line under it"} is too long to fit; keep the heading to about 45 characters and the line to about 90.`,
    );

  return block(
    <g animation={rise(0.2)}>
      <text
        x={WIDTH / 2}
        y={HEIGHT / 2 - 10}
        textAnchor="middle"
        fontFamily={geist}
        fontSize={big}
        fontWeight={600}
        fill={color.ink}
      >
        {heading}
      </text>
      <text
        x={WIDTH / 2}
        y={HEIGHT / 2 + 40}
        textAnchor="middle"
        fontFamily={geist}
        fontSize={small}
        fill={color.dim}
      >
        {subtitle}
      </text>
    </g>,
    span(0.2, 0.5),
    box,
  );
};

/** The slide's block laid out in `box` at its own size: one way, or for a diagram both ways, to pick the larger. */
const blocksOf = ({ kind, heading, body, language }: Slide, box: Rect): Drawn[] => {
  switch (kind) {
    case "title":
      return [titleOf(heading, body.trim(), box)];
    case "bullets":
      return [cardBlock(parse(cardParams, { tag: "", title: heading, bullets: lines(body) }), box)];
    case "code":
      return [codeBlock(parse(codeParams, { title: "", language, source: body }), box)];
    case "diagram": {
      const values = parse(diagramParams, { source: body });

      return [diagramBlock(values, box, "TB"), diagramBlock(values, box, "LR")];
    }

    case "chart":
      return [chartBlock(parse(chartParams, chartOf(body)), box)];
    case "math":
      return [mathBlock(parse(mathParams, { title: heading, steps: lines(body) }).steps, box)];
    case "plot":
      return [plotBlock(parse(plotParams, plotOf(heading, body)), box)];
    case "terminal":
      return [terminalBlock(parse(terminalParams, terminalOf(body)), box)];
  }
};

const hint: Record<Kind, string> = {
  title: "Shorten it",
  bullets: "Use fewer or shorter points",
  code: "Show about 15 lines or fewer, or split it across two slides",
  diagram: "Use fewer nodes, or split it across two slides",
  chart: "Use fewer points",
  math: "Use fewer steps, or split them across two slides",
  plot: "Shorten the TeX line",
  terminal: "Show about 10 lines or fewer, or split it across two slides",
};

/** The slide drawn and scaled to fit its area; a slide that would shrink past reading size throws. */
const slideOf = (slide: Slide, n: number) => {
  const fills = slide.kind === "title" || slide.kind === "bullets";
  const box = fills ? FULL : BODY;
  let candidates: Drawn[];

  try {
    candidates = blocksOf(slide, box);
  } catch (error) {
    throw new Error(
      `Slide ${n} (${slide.kind}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const scaleOf = ({ bounds }: Drawn) =>
    Math.min(slide.kind === "diagram" ? 1.5 : 1, box.w / bounds.w, box.h / bounds.h);

  const drawn = candidates.reduce((a, b) => (scaleOf(b) > scaleOf(a) ? b : a));
  const { bounds } = drawn;
  const scale = scaleOf(drawn);

  if (scale < SMALLEST)
    throw new Error(
      `Slide ${n} (${slide.kind}) is too big for a slide: it would shrink to ${Math.round(scale * 100)}% and be hard to read. ${hint[slide.kind]}.`,
    );

  const x = box.x + (box.w - scale * bounds.w) / 2 - scale * bounds.x;
  const y = box.y + (box.h - scale * bounds.h) / 2 - scale * bounds.y;
  const duration = Math.max(4, drawn.span.end + HOLD);

  return {
    duration,
    node: (
      <g animation={show(span(0, duration), { fade: FADE })}>
        {!fills && <Heading text={slide.heading} n={n} />}
        <g transform={`translate(${x} ${y}) scale(${scale})`}>{drawn.node}</g>
      </g>
    ),
  };
};

/** The slide's heading in the place and style of the gallery's titles, set smaller when it is long. */
const Heading = ({ text: heading, n }: { text: string; n: number }) => {
  const size = fitSize(geist.face(TITLE.weight), [heading], TITLE.size, WIDTH - 2 * MARGIN, 18);

  if (size === undefined)
    throw new Error(`Slide ${n}'s heading is too long to fit; keep it to about 60 characters.`);

  return (
    <g animation={rise(motions.lead)} fontFamily={geist}>
      <text x={TITLE.x} y={TITLE.y} fontSize={size} fontWeight={TITLE.weight} fill={color.ink}>
        {heading}
      </text>
    </g>
  );
};

const DOT = { gap: 16, r: 4, y: HEIGHT - 28 };

export default function build(p: Values<typeof params> = defaults(params)): string {
  const slides = p.slides.map((slide, i) => slideOf(slide, i + 1));

  // Each slide starts as the one before fades out, so they cross-fade.
  const starts = slides.map((_, i) =>
    slides.slice(0, i).reduce((sum, s) => sum + s.duration - FADE, 0),
  );

  const D = starts.at(-1)! + slides.at(-1)!.duration;
  const dot = (i: number) => WIDTH / 2 + (i - (slides.length - 1) / 2) * DOT.gap;

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: p.slides[0]?.heading ?? "Slides",
      desc: `A deck of ${p.slides.length} slides: ${p.slides.map((slide) => slide.heading).join("; ")}.`,
      reducedMotion: { at: slides[0]!.duration - FADE - 0.1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={color.bg} />
      {slides.map((slide, i) => (
        <Clip at={starts[i]!} over={slide.duration}>
          {slide.node}
        </Clip>
      ))}
      {slides.map((slide, i) => (
        <>
          <circle cx={dot(i)} cy={DOT.y} r={DOT.r} fill={color.edge} />
          <circle
            cx={dot(i)}
            cy={DOT.y}
            r={DOT.r}
            fill={color.accent}
            animation={show(span(starts[i]!, slide.duration), { fade: 0.2 })}
          />
        </>
      ))}
    </>,
  );
}
