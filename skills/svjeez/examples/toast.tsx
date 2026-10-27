/** @jsxImportSource svjeez */
import { draw, ease, enter, motion, render, shake } from "svjeez";

// A toast slides up, a check draws on, the badge shakes, then it all leaves and the loop restarts.
export default function build(): string {
  return render(
    { width: 320, height: 120, duration: 5, title: "Saved", desc: "A toast slides in, a check mark draws, then the toast leaves.", reducedMotion: { at: 2 } },
    <>
      <rect width={320} height={120} fill="#111318" />
      <g
        animation={motion({ opacity: 0, y: 24 })
          .at(0.3)
          .to({ opacity: 1, y: 0 }, 0.5, ease.pop)
          .at(4)
          .to({ opacity: 0, y: -12 }, 0.4, ease.in)}
      >
        <rect x={40} y={34} width={240} height={52} rx={12} fill="#1E2230" stroke="#3EE6D6" strokeOpacity={0.4} />
        <circle cx={68} cy={60} r={14} fill="#3EE6D6" animation={[enter({ at: 0.6, over: 0.3 }, { scale: 0 }, ease.pop), shake({ at: 1.6, over: 0.4 }, { rotate: 12 })]} />
        <path d="M61 60l5 5 9-10" fill="none" stroke="#111318" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" animation={draw({ at: 0.9, over: 0.4 })} />
        <text x={96} y={66} fontFamily="system-ui, sans-serif" fontSize={16} fill="#E6E8EE" animation={enter({ at: 0.9, over: 0.5 }, { x: -8 })}>
          Changes saved
        </text>
      </g>
    </>,
  );
}
