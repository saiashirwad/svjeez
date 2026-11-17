import { choice, defaults, list, text, type Json, type Values } from "svjeez/params";

import { place, renderSlides } from "../slides";
import { LANGUAGES } from "./code";

const KINDS = ["title", "bullets", "code", "diagram", "chart", "math", "plot", "terminal"] as const;

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

const lines = (body: string) =>
  body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

const CHART = /^(.+?):\s*(-?\d[\d,]*(?:\.\d+)?)$/;

const chartOf = (body: string) => {
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

const plotOf = (body: string) => {
  const [first = "", tex = ""] = lines(body);
  const [kind = "", expression = "", y = ""] = first.split(";").map((part) => part.trim());

  if (!expression)
    throw new Error(
      `the first line "${first}" is not "kind; expression". Write such as "function; sin(x)/x" or "parametric; 16*sin(t)^3; 13*cos(t)".`,
    );

  return { tex, kind, expression, y };
};

/** The values of the slide's kind, read from its body by the format its label describes. */
const valuesOf = ({ kind, heading, body, language }: Slide): Json => {
  switch (kind) {
    case "title":
      return { heading, subtitle: body.trim() };
    case "bullets":
      return { heading, bullets: lines(body) };
    case "code":
      return { heading, language, source: body };
    case "diagram":
      return { heading, source: body };
    case "chart":
      return { heading, ...chartOf(body) };
    case "math":
      return { heading, steps: lines(body) };
    case "plot":
      return { heading, ...plotOf(body) };
    case "terminal":
      return {
        heading,
        lines: lines(body).map((row) =>
          row.startsWith("$ ")
            ? { kind: "command", text: row.slice(2) }
            : { kind: "output", text: row },
        ),
      };
  }
};

const slideOf = (slide: Slide, n: number) => {
  let json: Json;

  try {
    json = valuesOf(slide);
  } catch (error) {
    throw new Error(
      `Slide ${n} (${slide.kind}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return place(slide.kind, json, n);
};

export default function build(p: Values<typeof params> = defaults(params)): string {
  return renderSlides(
    p.slides[0]?.heading ?? "Slides",
    p.slides.map((slide, i) => slideOf(slide, i + 1)),
  );
}
