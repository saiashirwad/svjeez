import { draw, ease, enter, render } from "svjeez";
import { css, theme } from "../style";

export default function build(): string {
  return render(
    {
      width: 200,
      height: 120,
      duration: 4,
      title: "Hello",
      desc: "A curve draws itself, then a dot pops in above it.",
      css,
      reducedMotion: { at: 3 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <path
        d="M20 100C60 20 140 20 180 100"
        fill="none"
        stroke="#FF5FA8"
        strokeWidth={4}
        animation={draw({ at: 0.2, over: 1.2 })}
      />
      <circle
        cx={100}
        cy={40}
        r={8}
        fill="#3EE6D6"
        animation={enter({ at: 1.2, over: 0.5 }, { scale: 0 }, ease.pop)}
      />
    </>,
  );
}
