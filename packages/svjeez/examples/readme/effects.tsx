import { draw, fx, render } from "svjeez";
import { css, mono, theme } from "../style";

export default function build(): string {
  return render(
    { width: 320, height: 120, duration: 4, title: "Effects", desc: "A glowing word beside a hand-drawn house that boils.", css, reducedMotion: { at: 2 } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <text x={90} y={74} fontFamily={mono} fontSize={36} fontWeight={700} fill="#FF4FA3" textAnchor="middle" filter={fx.glow({ blur: 4 })}>
        OPEN
      </text>
      <g filter={fx.boil({ strength: 2 })} fill="none" stroke={theme.base0C} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M200 100V60L240 30L280 60V100Z" animation={draw({ at: 0.3, over: 1.2 })} />
        <path d="M230 100V80H250V100" animation={draw({ at: 1.2, over: 0.6 })} />
      </g>
    </>,
  );
}
