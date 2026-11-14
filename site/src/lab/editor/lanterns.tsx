import { draw, ease, enter, motion, render } from "svjeez";

const rise = motion({ y: 90, opacity: 0 })
  .at(0.3)
  .to({ y: 0, opacity: 1 }, 1.6, ease.bezier(0.2, 0.7, 0.2, 1));

const bob = (at: number) =>
  motion({ y: 0 }).at(at).to({ y: -14 }, 1.1, ease.inOut).to({ y: 0 }, 1.1, ease.inOut).loop(4);

const glow = (at: number) =>
  motion({ scale: 1, opacity: 0.45 })
    .at(at)
    .to({ scale: 1.5, opacity: 0.85 }, 0.5, ease.pop)
    .to({ scale: 1, opacity: 0.45 }, 0.9, ease.out)
    .loop(4);

const lanterns = [
  { x: 110, y: 170, light: "#FF9F5A", at: 0.2 },
  { x: 240, y: 140, light: "#FF5D8F", at: 0.8 },
  { x: 370, y: 180, light: "#FFD166", at: 1.4 },
] as const;

const stars = [
  { x: 60, y: 40, r: 1.5 },
  { x: 150, y: 70, r: 2 },
  { x: 330, y: 36, r: 1.5 },
  { x: 420, y: 80, r: 2 },
];

export default () =>
  render(
    {
      width: 480,
      height: 320,
      duration: 4,
      title: "Lanterns",
      desc: "Three lanterns bob over a harbour.",
    },
    <>
      <rect width={480} height={320} fill="#1B1633" />
      {stars.map((s, i) => (
        <circle
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#E8E1FF"
          animation={enter({ at: 0.2 + i * 0.25, over: 0.6 })}
        />
      ))}
      <circle cx={384} cy={88} r={28} fill="#F4EFD8" animation={rise} />
      <path d="M0 232Q120 204 240 232T480 232V320H0Z" fill="#2B2150" />
      {lanterns.map((l) => (
        <g animation={bob(l.at)}>
          <line x1={l.x} y1={l.y - 40} x2={l.x} y2={l.y - 18} stroke="#6D5FA8" strokeWidth={2} />
          <circle cx={l.x} cy={l.y} r={30} fill={l.light} animation={glow(l.at + 0.3)} />
          <rect x={l.x - 12} y={l.y - 18} width={24} height={36} rx={6} fill={l.light} />
          <rect x={l.x - 8} y={l.y - 22} width={16} height={5} rx={2} fill="#2B2150" />
        </g>
      ))}
      <path
        d="M60 268H420"
        fill="none"
        stroke="#4A3F7A"
        strokeWidth={2}
        strokeLinecap="round"
        animation={draw({ at: 1.6, over: 1.2 })}
      />
      <text
        x={240}
        y={296}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={13}
        fill="#CFC6F0"
        animation={enter({ at: 2.2, over: 0.8 }, { y: 8 })}
      >
        harbour lights
      </text>
    </>,
  );
