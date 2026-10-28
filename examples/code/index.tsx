import { highlight } from "@svjeez/code";
import { ease, motion, rect, render } from "svjeez";
import { appWindow, code, morph } from "svjeez/extras";
import { css, mono, theme } from "../style";

const W = 960;
const H = 420;

// One function in four languages. @svjeez/code gives every token a role, so the colors below come from
// style.ts and the scene still follows the viewer between light and dark.
const SOURCES = [
  {
    label: "ts",
    lang: "ts",
    source: `function fib(n: number): number {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}`,
  },
  {
    label: "py",
    lang: "python",
    source: `def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)`,
  },
  {
    label: "rs",
    lang: "rust",
    source: `fn fib(n: u32) -> u32 {
    if n < 2 {
        return n;
    }
    fib(n - 1) + fib(n - 2)
}`,
  },
  {
    label: "go",
    lang: "go",
    source: `func fib(n int) int {
    if n < 2 {
        return n
    }
    return fib(n-1) + fib(n-2)
}`,
  },
] as const;

const win = appWindow(rect(40, 40, W - 80, H - 80), { theme, title: "fib", bar: 40 });

const CHIP = { w: 64, gap: 8, h: 28 };
const chipX = (i: number) => win.body.x + 28 + i * (CHIP.w + CHIP.gap);
const chipY = win.body.y + 22;

const settings = {
  x: win.body.x + 36,
  y: chipY + CHIP.h + 30,
  fontSize: 20,
  lineHeight: 1.7,
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
    chain
      .at(start)
      .to({ x: chipX(i + 1 === SOURCES.length ? 0 : i + 1) - chipX(0) }, OVER, ease.inOut),
  motion({ x: 0 }),
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      title: "One function, four languages",
      desc: "A Fibonacci function morphs between TypeScript, Python, Rust and Go, highlighted by role from the scene's theme.",
      duration: at[3]! + OVER + HOLD,
      css,
    },
    <>
      <g fontFamily={mono}>{win.node}</g>
      <rect
        x={chipX(0)}
        y={chipY}
        width={CHIP.w}
        height={CHIP.h}
        rx={8}
        fill={theme.base02}
        animation={slide}
      />
      {SOURCES.map(({ label }, i) => (
        <text
          x={chipX(i) + CHIP.w / 2}
          y={chipY + CHIP.h / 2 + 5}
          textAnchor="middle"
          fontFamily={mono}
          fontSize={15}
          fill={theme.base05}
        >
          {label}
        </text>
      ))}
      {m.node}
    </>,
  );
}
