import { Clip, render, show, span, type Drawn, type SvgNode } from "svjeez";
import { rect, type Rect } from "svjeez/geometry";
import { parse, text, type Json, type Schema, type Values } from "svjeez/params";

import {
  HEIGHT,
  MARGIN,
  TITLE,
  WIDTH,
  color,
  css,
  geist,
  motions,
  rise,
} from "../../examples/gallery-style";
import { block, fitSize } from "./block";
import type { Deck } from "./document";
import { cardBlock, params as card } from "./templates/card";
import { chartBlock, params as chart } from "./templates/chart";
import { codeBlock, params as code } from "./templates/code";
import { diagramBlock, params as diagram } from "./templates/diagram";
import { mapBlock, params as map } from "./templates/map";
import { mathBlock, params as math } from "./templates/math";
import { plotBlock, params as plot } from "./templates/plot";
import { terminalBlock, params as terminal } from "./templates/terminal";

const BODY = rect(MARGIN, 124, WIDTH - 2 * MARGIN, HEIGHT - 124 - 64);
const FULL = rect(MARGIN, MARGIN, WIDTH - 2 * MARGIN, HEIGHT - 2 * MARGIN - 24);
const HOLD = 2.5;
const FADE = 0.4;

/** Below this a slide's text gets too small to read. */
const SMALLEST = 0.65;

const heading = text("", {
  maxLength: 60,
  label: "The slide's heading. At most 60 characters; up to about 40 show at full size.",
});

/** The title slide: the heading large and centered with a line under it, both set smaller when they are long. */
const titleBlock = (title: string, subtitle: string, box: Rect): Drawn => {
  const big = fitSize(geist.face(600), [title], 52, box.w, 28);
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
        {title}
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

/** A kind of slide: its params, what it says about itself, and how it draws. */
export interface Kind {
  readonly params: Schema;
  readonly about: string;
  /** What to try when the slide is too big. */
  readonly hint: string;
  /** Whether the block draws its own heading and takes the whole slide. */
  readonly full: boolean;
  /** How far the block may grow past its own size to fill the slide. */
  readonly grow: number;
  /** The slide's heading and its block laid out one or more ways, from values `parse` checks. */
  draw(json: Json, box: Rect): { readonly heading: string; readonly candidates: readonly Drawn[] };
}

const kind = <S extends Schema & { readonly heading: typeof heading }>(
  params: S,
  about: string,
  hint: string,
  blocks: (values: Values<S>, box: Rect) => Drawn[],
  { full = false, grow = 1 } = {},
): Kind => ({
  params,
  about,
  hint,
  full,
  grow,
  draw: (json, box) => {
    const values = parse(params, json);

    return { heading: values.heading, candidates: blocks(values, box) };
  },
});

/** Every kind of slide, each one of the templates' blocks. */
export const kinds = {
  title: kind(
    {
      heading,
      subtitle: text("", { maxLength: 120, label: "One line under the heading, or empty." }),
    },
    "a title slide: a large heading and a line under it",
    "Shorten it",
    (v, box) => [titleBlock(v.heading, v.subtitle, box)],
    { full: true },
  ),
  bullets: kind(
    { heading, bullets: card.bullets },
    "a heading over 1 to 6 short points that rise in",
    "Use fewer or shorter points",
    (v, box) => [cardBlock({ tag: "", title: v.heading, bullets: v.bullets }, box)],
    { full: true },
  ),
  code: kind(
    {
      heading,
      language: code.language,
      source: text("", {
        maxLength: 4000,
        label:
          "The code, with real newlines and spaces for indentation. About 15 lines of 70 characters fit a slide; split longer code across slides.",
      }),
    },
    "source code typed into a window, highlighted",
    "Show about 15 lines or fewer, or split it across two slides",
    (v, box) => [codeBlock({ title: "", language: v.language, source: v.source }, box)],
  ),
  terminal: kind(
    { heading, lines: terminal.lines },
    "a terminal session typed out: commands and what they print",
    "Show about 10 lines or fewer, or split it across two slides",
    (v, box) => [terminalBlock({ title: "", lines: v.lines }, box)],
  ),
  diagram: kind(
    { heading, source: diagram.source },
    "a flowchart, sequence diagram or state diagram from Mermaid source",
    "Use fewer nodes or shorter labels, or split it across two slides",
    (v, box) => [diagramBlock(v, box, "TB"), diagramBlock(v, box, "LR")],
    { grow: 1.6 },
  ),
  chart: kind(
    { heading, kind: chart.kind, series: chart.series, compare: chart.compare, data: chart.data },
    "a bar, line or area chart of one or two series",
    "Use fewer points",
    (v, box) => [chartBlock(v, box)],
  ),
  math: kind(
    { heading, steps: math.steps },
    "TeX steps written out one under another, a derivation",
    "Use fewer steps, or split them across two slides",
    (v, box) => [mathBlock(v.steps, box)],
  ),
  plot: kind(
    {
      heading,
      tex: plot.tex,
      kind: plot.kind,
      expression: plot.expression,
      y: plot.y,
      from: plot.from,
      to: plot.to,
      xMin: plot.xMin,
      xMax: plot.xMax,
      yMin: plot.yMin,
      yMax: plot.yMax,
    },
    "the graph of a formula drawing itself on a plane, with its equation typeset",
    "Shorten the TeX",
    (v, box) => [plotBlock(v, box)],
  ),
  map: kind(
    {
      heading,
      measure: map.measure,
      countries: map.countries,
      markers: map.markers,
      routes: map.routes,
    },
    "a world or regional map: highlighted or value-shaded countries, labelled places and great-circle routes",
    "Use fewer countries or places",
    (v, box) => [mapBlock(v, box)],
  ),
} satisfies Readonly<Record<string, Kind>>;

export type KindName = keyof typeof kinds;

export const isKind = (name: string): name is KindName => Object.hasOwn(kinds, name);

/** A slide ready to play: its heading and block placed and scaled on the slide, and how long it lasts. */
export interface Placed {
  readonly heading: string;
  readonly duration: number;
  readonly node: SvgNode;
}

/** The slide's heading in the place and style of the gallery's titles, set smaller when it is long. */
const Heading = ({ text: words, n }: { text: string; n: number }) => {
  const size = fitSize(geist.face(TITLE.weight), [words], TITLE.size, WIDTH - 2 * MARGIN, 18);

  if (size === undefined)
    throw new Error(`Slide ${n}'s heading is too long to fit; keep it to about 60 characters.`);

  return (
    <g animation={rise(motions.lead)} fontFamily={geist}>
      <text x={TITLE.x} y={TITLE.y} fontSize={size} fontWeight={TITLE.weight} fill={color.ink}>
        {words}
      </text>
    </g>
  );
};

/**
 * Slide `n` of kind `name` from `json`: checked by its kind's params, drawn, and scaled to fill its area, up to the
 * kind's `grow`. A slide whose values do not parse or build, or that would shrink past reading size, throws a message
 * naming the slide and what to change.
 */
export const place = (name: KindName, json: Json, n: number): Placed => {
  const { draw, full, grow, hint } = kinds[name];
  const box = full ? FULL : BODY;
  let drawn: ReturnType<Kind["draw"]>;

  try {
    drawn = draw(json, box);
  } catch (error) {
    throw new Error(
      `Slide ${n} (${name}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const scaleOf = ({ bounds }: Drawn) => Math.min(grow, box.w / bounds.w, box.h / bounds.h);
  const best = drawn.candidates.reduce((a, b) => (scaleOf(b) > scaleOf(a) ? b : a));
  const scale = scaleOf(best);

  if (scale < SMALLEST)
    throw new Error(
      `Slide ${n} (${name}) is too big for a slide: it would shrink to ${Math.round(scale * 100)}% and be hard to read. ${hint}.`,
    );

  const { bounds } = best;
  const x = box.x + (box.w - scale * bounds.w) / 2 - scale * bounds.x;
  const y = box.y + (box.h - scale * bounds.h) / 2 - scale * bounds.y;
  const duration = Math.max(4, best.span.end + HOLD);

  return {
    heading: drawn.heading,
    duration,
    node: (
      <g animation={show(span(0, duration), { fade: FADE })}>
        {!full && <Heading text={drawn.heading} n={n} />}
        <g transform={`translate(${x} ${y}) scale(${scale})`}>{best.node}</g>
      </g>
    ),
  };
};

const DOT = { gap: 16, r: 4, y: HEIGHT - 28 };

/** Placed slides as one SVG: each in its own clip, cross-fading into the next, with dots that follow along. */
export const renderSlides = (title: string, slides: readonly Placed[]): string => {
  if (slides.length === 0) throw new Error("A deck needs at least one slide.");

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
      title,
      desc: `A deck of ${slides.length} slides: ${slides.map((slide) => slide.heading).join("; ")}.`,
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
};

/** A deck as one SVG. An empty deck is a title slide that says how to start. */
export const renderDeck = (deck: Deck): string =>
  renderSlides(
    deck.title,
    deck.slides.length
      ? deck.slides.map((slide, i) => {
          if (!isKind(slide.kind))
            throw new Error(`Slide ${i + 1} has an unknown kind, "${slide.kind}".`);

          return place(slide.kind, slide.values, i + 1);
        })
      : [place("title", { heading: deck.title, subtitle: "Ask for slides to begin" }, 1)],
  );
