import { ease, enter, motion, render, wiggle } from "svg-motion";
import { CSS, theme } from "./kit";

export default function build(): string {
  return render(
    { width: 200, height: 120, duration: 4, title: "Loops and stacking", desc: "A ring spins on a two second loop beside a dot that fades in and then wanders.", css: CSS, reducedMotion: { at: 1 } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <g transform="translate(60 60)">
        <circle r={24} fill="none" stroke={theme.base0C} strokeWidth={5} strokeLinecap="round" strokeDasharray="50 101" animation={motion({ rotate: 0 }).to({ rotate: 360 }, 2, ease.linear).loop(2)} />
      </g>
      <circle cx={140} cy={60} r={10} fill={theme.base0E} animation={[enter({ at: 0, over: 0.6 }), wiggle({ x: 4, y: 4 }, { seed: "dot" })]} />
    </>,
  );
}
