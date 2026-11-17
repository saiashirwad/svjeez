import { highlight } from "@svjeez/code";
import { ease, motion, render, code, morph, span } from "svjeez";

import { HEIGHT, MARGIN, WIDTH, RADIUS, boxed, css, hue, mono, theme } from "../gallery-style";

const W = WIDTH;
const H = HEIGHT;

// One function in four languages. @svjeez/code gives every token a role, so the colors below come from
// style.ts and the scene still follows the viewer between light and dark.
const SOURCES = [
  {
    label: "TS",
    lang: "ts",
    source: `function fib(n: number): number {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}`,
  },
  {
    label: "Python",
    lang: "python",
    source: `def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)`,
  },
  {
    label: "Rust",
    lang: "rust",
    source: `fn fib(n: u32) -> u32 {
    if n < 2 {
        return n;
    }
    fib(n - 1) + fib(n - 2)
}`,
  },
  {
    label: "Go",
    lang: "go",
    source: `func fib(n int) int {
    if n < 2 {
        return n
    }
    return fib(n-1) + fib(n-2)
}`,
  },
] as const;

// The code block is the whole canvas: tabs on the top margin, then the code at a large size.
const CHIP = { w: 108, gap: 10, h: 36 };
const chipX = (i: number) => MARGIN + i * (CHIP.w + CHIP.gap);
const chipY = MARGIN;

const settings = {
  x: MARGIN,
  y: chipY + CHIP.h + 40,
  fontSize: 40,
  lineHeight: 1.5,
  theme,
  font: mono,
};

const versions = SOURCES.map(({ lang, source }) => code(highlight(source, lang), settings));

const HOLD = 2.6;
const OVER = 0.9;
const at = [HOLD, HOLD * 2 + OVER, HOLD * 3 + OVER * 2, HOLD * 4 + OVER * 3];
const m = morph([...versions, versions[0]!], { at, over: OVER });

/** The active chip's background, sliding to each language as its code morphs in. */
const slide = at.reduce(
  (chain, start, i) =>
    chain.to(
      { x: chipX(i + 1 === SOURCES.length ? 0 : i + 1) - chipX(0) },
      span(start, OVER),
      ease.inOut,
    ),
  motion({ x: 0 }),
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      title: "Fibonacci in four languages",
      desc: "A Fibonacci function morphs between TypeScript, Python, Rust and Go, highlighted by role from the scene's theme.",
      duration: at[3]! + OVER + HOLD,
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
      {SOURCES.map(({ label }, i) => (
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
