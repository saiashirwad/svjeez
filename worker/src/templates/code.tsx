import { highlight } from "@svjeez/code";
import { appWindow, code, render, typewriter } from "svjeez";
import { rect } from "svjeez/geometry";
import { choice, defaults, text, type Values } from "svjeez/params";

import { HEIGHT, MARGIN, WIDTH, color, css, mono, theme } from "../../../examples/gallery-style";

const LANGUAGES = [
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

export default function build(p: Values<typeof params> = defaults(params)): string {
  const source = p.source.replaceAll("\t", "  ").trimEnd();
  const lines = source.split("\n");
  const columns = Math.max(1, ...lines.map((line) => line.length));

  if (lines.length > MAX_LINES || columns > MAX_COLUMNS)
    throw new Error(
      `source is ${lines.length} lines of up to ${columns} characters. Keep it to ${MAX_LINES} lines of ${MAX_COLUMNS} characters.`,
    );

  const room = WIDTH - 2 * MARGIN - 2 * PAD.x;
  const fontSize = Math.max(SMALLEST, Math.min(LARGEST, Math.floor(room / (columns * 0.6))));
  const width = Math.max(WIDTH, Math.ceil(columns * 0.6 * fontSize + 2 * MARGIN + 2 * PAD.x));
  const body = lines.length * fontSize * LINE_HEIGHT + 2 * PAD.y;
  const height = Math.max(HEIGHT, Math.ceil(2 * MARGIN + BAR + body));

  const shell = appWindow(rect(MARGIN, MARGIN, width - 2 * MARGIN, height - 2 * MARGIN), {
    theme,
    title: p.title,
    dots: "traffic",
  });

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

  const D = typed.span.end + 4;

  return render(
    {
      width,
      height,
      duration: D,
      title: p.title,
      desc: `${p.language} code in a window titled ${p.title}, typed out: ${source}`,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <g fontFamily={mono}>{shell.node}</g>
      {typed.node}
    </>,
  );
}
