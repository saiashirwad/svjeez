import { highlight } from "@svjeez/code";
import { ease, motion, render, code, morph, span } from "svjeez";
import { choice, defaults, list, text, type Values } from "svjeez/params";

import { HEIGHT, MARGIN, WIDTH, RADIUS, boxed, css, hue, mono, theme } from "../gallery-style";

const W = WIDTH;
const H = HEIGHT;

const LANGUAGES = [
  "ts",
  "tsx",
  "js",
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
] as const;

export const params = {
  title: text("Fibonacci in four languages", { maxLength: 60 }),
  desc: text(
    "A Fibonacci function morphs between TypeScript, Python, Rust and Go, highlighted by role from the scene's theme.",
    { maxLength: 300, label: "What the code shows, for screen readers" },
  ),
  versions: list(
    {
      label: text("", { maxLength: 8 }),
      language: choice("ts", LANGUAGES),
      source: text("", {
        maxLength: 600,
        label: "The code, with newlines. At most about 14 lines of 70 columns.",
      }),
    },
    [
      {
        label: "TS",
        language: "ts",
        source: `function fib(n: number): number {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}`,
      },
      {
        label: "Python",
        language: "python",
        source: `def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)`,
      },
      {
        label: "Rust",
        language: "rust",
        source: `fn fib(n: u32) -> u32 {
    if n < 2 {
        return n;
    }
    fib(n - 1) + fib(n - 2)
}`,
      },
      {
        label: "Go",
        language: "go",
        source: `func fib(n int) int {
    if n < 2 {
        return n
    }
    return fib(n-1) + fib(n-2)
}`,
      },
    ],
    { min: 1, max: 6, label: "Each version morphs into the next, then back to the first." },
  ),
};

const CHIP = { w: 108, gap: 10, h: 36 };
const chipX = (i: number) => MARGIN + i * (CHIP.w + CHIP.gap);
const chipY = MARGIN;
const TOP = chipY + CHIP.h + 40;
const LINE_HEIGHT = 1.5;
const LARGEST = 40;
const SMALLEST = 14;

const HOLD = 2.6;
const OVER = 0.9;

export default function build(p: Values<typeof params> = defaults(params)): string {
  const lines = p.versions.map(({ source }) => source.trimEnd().split("\n"));
  const rows = Math.max(...lines.map((version) => version.length));
  const columns = Math.max(...lines.flat().map((line) => line.length));

  const fontSize = Math.floor(
    Math.min(
      LARGEST,
      (H - MARGIN - TOP) / (rows * LINE_HEIGHT),
      (W - 2 * MARGIN) / (columns * 0.6),
    ),
  );

  if (fontSize < SMALLEST)
    throw new Error(
      `The longest version is ${rows} lines of up to ${columns} columns, too much to read at ${W} by ${H}. Keep each to about 14 lines of 70 columns.`,
    );

  const settings = { x: MARGIN, y: TOP, fontSize, lineHeight: LINE_HEIGHT, theme, font: mono };

  const versions = p.versions.map(({ language, source }) =>
    code(highlight(source.trimEnd(), language), settings),
  );

  const at = versions.map((_, i) => HOLD * (i + 1) + OVER * i);
  const m = morph([...versions, versions[0]!], { at, over: OVER });

  const slide = at.reduce(
    (chain, start, i) =>
      chain.to(
        { x: chipX(i + 1 === versions.length ? 0 : i + 1) - chipX(0) },
        span(start, OVER),
        ease.inOut,
      ),
    motion({ x: 0 }),
  );

  return render(
    {
      width: W,
      height: H,
      title: p.title,
      desc: p.desc,
      duration: at.at(-1)! + OVER + HOLD,
      css,
    },
    <>
      <rect width={W} height={H} fill={theme.base01} />
      <rect
        x={chipX(0)}
        y={chipY}
        width={CHIP.w}
        height={CHIP.h}
        rx={RADIUS}
        {...boxed(hue.blue, 0.2)}
        animation={slide}
      />
      {p.versions.map(({ label }, i) => (
        <text
          x={chipX(i) + CHIP.w / 2}
          y={chipY + CHIP.h / 2 + 6}
          textAnchor="middle"
          fontFamily={mono}
          fontSize={18}
          fill={theme.base05}
        >
          {label}
        </text>
      ))}
      {m.node}
    </>,
  );
}
