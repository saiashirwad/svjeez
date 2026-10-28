import { draw, ease, enter, render, shake } from "svjeez";

export default () =>
  render(
    { width: 320, height: 120, duration: 5, title: "Saved" },
    <g animation={enter({ at: 0.3, over: 0.5 }, { opacity: 0, y: 24 }, ease.pop)}>
      <rect x={40} y={34} width={240} height={52} rx={12} fill="#1E2230" />
      <circle cx={68} cy={60} r={14} fill="#32D74B"
        animation={shake({ at: 1.6, over: 0.4 }, { rotate: 12 })} />
      <path d="M61 60l5 5 9-10" fill="none" stroke="#111318" strokeWidth={3}
        strokeLinecap="round" animation={draw({ at: 0.9, over: 0.4 })} />
      <text x={96} y={66} fill="#E6E8EE" fontSize={16} fontFamily="system-ui, sans-serif">Changes saved</text>
    </g>,
  );
