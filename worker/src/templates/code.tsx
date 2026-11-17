import { highlight } from "@svjeez/code";
import { appWindow, code, render, typewriter, type Drawn } from "svjeez";
import { rect, type Rect } from "svjeez/geometry";
import { choice, defaults, text, type Values } from "svjeez/params";

import { HEIGHT, MARGIN, WIDTH, color, css, mono, theme } from "../../../examples/gallery-style";
import { block } from "../block";

export const LANGUAGES = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "python",
  "rust",
  "go",
  "sql",
  "bash",
  "json",
  "yaml",
  "css",
  "html",
  "markdown",
  "diff",
] as const;

const MAX_LINES = 80;
const MAX_COLUMNS = 120;

export const params = {
  title: text("fib.ts", {
    maxLength: 40,
    label:
      "The window title above the code, usually a file name such as main.rs. At most 40 characters.",
  }),
  language: choice("typescript", LANGUAGES, {
    label: `The language to highlight the code as. One of ${LANGUAGES.join(", ")}; pick the closest.`,
  }),
  source: text(
    `function fib(n: number): number {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}`,
    {
      maxLength: 8000,
      label: `The code itself, with real newlines and spaces for indentation. Aim for 50 lines or fewer: more than ${MAX_LINES} lines, or a line over ${MAX_COLUMNS} characters, is rejected. Cut comments and blank lines before cutting code.`,
    },
  ),
};

const PAD = { x: 32, y: 24 };
const LINE_HEIGHT = 1.5;
const LARGEST = 22;
const SMALLEST = 14;
const BAR = appWindow(rect(0, 0, 100, 100), { theme }).body.y;

/** The code typed into a window that fills `box`, growing past it when the code needs more room. */
export const codeBlock = (p: Values<typeof params>, box: Rect): Drawn => {
  const source = p.source.replaceAll("\t", "  ").trimEnd();
  const lines = source.split("\n");
  const columns = Math.max(1, ...lines.map((line) => line.length));

  if (lines.length > MAX_LINES || columns > MAX_COLUMNS)
    throw new Error(
      `source is ${lines.length} lines of up to ${columns} characters. Keep it to ${MAX_LINES} lines of ${MAX_COLUMNS} characters.`,
    );

  const room = box.w - 2 * PAD.x;
  const tall = (box.h - BAR - 2 * PAD.y) / (lines.length * LINE_HEIGHT);

  const fontSize = Math.max(
    SMALLEST,
    Math.min(LARGEST, Math.floor(Math.min(room / (columns * 0.6), tall))),
  );

  const width = Math.max(box.w, Math.ceil(columns * 0.6 * fontSize + 2 * PAD.x));

  const height = Math.max(
    box.h,
    Math.ceil(BAR + lines.length * fontSize * LINE_HEIGHT + 2 * PAD.y),
  );

  const frame = rect(box.x, box.y, width, height);
  const shell = appWindow(frame, { theme, title: p.title, dots: "traffic" });

  const listing = code(highlight(source, p.language), {
    x: shell.body.x + PAD.x,
    y: shell.body.y + PAD.y,
    fontSize,
    lineHeight: LINE_HEIGHT,
    theme,
    font: mono,
  });

  const typed = typewriter(listing, {
    at: 0.5,
    cps: Math.max(30, source.length / 4),
    cursor: color.accent,
  });

  return block(
    <>
      <g fontFamily={mono}>{shell.node}</g>
      {typed.node}
    </>,
    typed.span,
    frame,
  );
};

export default function build(p: Values<typeof params> = defaults(params)): string {
  const drawn = codeBlock(p, rect(MARGIN, MARGIN, WIDTH - 2 * MARGIN, HEIGHT - 2 * MARGIN));
  const width = drawn.bounds.w + 2 * MARGIN;
  const height = drawn.bounds.h + 2 * MARGIN;
  const D = drawn.span.end + 4;

  return render(
    {
      width,
      height,
      duration: D,
      title: p.title,
      desc: `${p.language} code in a window titled ${p.title}, typed out: ${p.source.replaceAll("\t", "  ").trimEnd()}`,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {drawn.node}
    </>,
  );
}
