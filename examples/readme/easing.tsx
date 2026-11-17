import { ease, motion, render, span, type Ease } from "svjeez";
import { css, mono, theme } from "../style";

const curves: [string, Ease][] = [
  ["linear", ease.linear],
  ["in", ease.in],
  ["out", ease.out],
  ["inOut", ease.inOut],
  ["pop", ease.pop],
  ["hold", ease.hold],
  ["steps(4)", ease.steps(4)],
  ["bezier", ease.bezier(0.2, 0.8, 0.2, 1)],
];

const ROW = 26;
const X0 = 110;
const X1 = 380;

/** Every dot crosses in the same span, then cuts back home after a beat. */
const CROSS = span(0.4, 1.6);

export default function build(): string {
  return render(
    {
      width: 420,
      height: curves.length * ROW + 24,
      duration: 3,
      title: "Easing",
      desc: "Eight dots cross the same track, each with a different easing curve.",
      css,
      reducedMotion: { at: 2 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {curves.map(([label, curve], i) => {
        const y = 24 + i * ROW;

        return (
          <>
            <text x={20} y={y + 4} fontFamily={mono} fontSize={11} fill={theme.base04}>
              {label}
            </text>
            <line
              x1={X0}
              x2={X1}
              y1={y}
              y2={y}
              stroke={theme.base02}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle
              cx={X0}
              cy={y}
              r={6}
              fill={theme.base09}
              animation={motion({ x: 0 })
                .to({ x: X1 - X0 }, CROSS, curve)
                .set({ x: 0 }, CROSS.end + 0.6)}
            />
          </>
        );
      })}
    </>,
  );
}
