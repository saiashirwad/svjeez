import { draw, enter, exit, render, shake, wiggle, type Child } from "svjeez";
import { css, mono, theme } from "../style";

const W = 600;
const D = 5;
const tiles: [string, (cx: number) => Child][] = [
  ["enter", (cx) => <circle cx={cx} cy={50} r={18} fill={theme.base0D} animation={enter({ at: 0.5, over: 0.8 })} />],
  ["enter blur", (cx) => <circle cx={cx} cy={50} r={18} fill={theme.base0C} animation={enter({ at: 0.5, over: 0.8 }, { y: 20, blur: 6 })} />],
  ["exit", (cx) => <circle cx={cx} cy={50} r={18} fill={theme.base0B} animation={exit({ at: 3, over: 0.4 })} />],
  ["draw", (cx) => <path d={`M${cx - 22} 64L${cx} 30L${cx + 22} 64Z`} fill="none" stroke={theme.base0A} strokeWidth={3} strokeLinejoin="round" animation={draw({ at: 0.5, over: 1.2 })} />],
  ["shake", (cx) => <rect x={cx - 16} y={34} width={32} height={32} rx={6} fill={theme.base08} animation={shake({ at: 2, over: 0.5 }, { x: 6 })} />],
  ["wiggle", (cx) => <rect x={cx - 16} y={34} width={32} height={32} rx={6} fill={theme.base0E} animation={wiggle({ rotate: 8 }, { seed: "leaf", rate: 6 })} />],
];

export default function build(): string {
  return render(
    { width: W, height: 110, duration: D, title: "Recipes", desc: "Six shapes showing enter, enter from a blur, exit, draw, shake and wiggle.", css, reducedMotion: { at: 2.5 } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {tiles.map(([label, shape], i) => {
        const cx = 50 + i * 100;
        return (
          <>
            {shape(cx)}
            <text x={cx} y={98} fontFamily={mono} fontSize={11} fill={theme.base04} textAnchor="middle">
              {label}
            </text>
          </>
        );
      })}
    </>,
  );
}
