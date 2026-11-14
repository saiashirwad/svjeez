/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import { Clip, ease, motion, render, show, span, type Point, type SvgNode } from "svjeez";

// One gesture written from 0: a cursor reaches a card, drags it while a key is held, and the card rewinds at the end.
// Every part reads the same spans, so moving a span moves all of them, and the clip places the whole gesture.
const reach = span(0, 0.7);
const grab = reach.next(1, 0.2);
const down = grab.pad(0.15);

const HOME: Point = { x: 30, y: 30 };
const DROP: Point = { x: 150, y: 70 };
const IDLE: Point = { x: 230, y: 150 };

const Card = (): SvgNode => (
  <g
    animation={motion({ x: HOME.x, y: HOME.y })
      .to({ x: DROP.x, y: DROP.y }, grab, ease.inOut)
      .rewind(0.6)}
  >
    <rect width={90} height={56} rx={8} fill="#1E2230" stroke="#3EE6D6" strokeOpacity={0.5} />
    <rect x={12} y={14} width={50} height={5} rx={2.5} fill="#3EE6D6" opacity={0.6} />
    <rect x={12} y={28} width={36} height={5} rx={2.5} fill="#3EE6D6" opacity={0.3} />
  </g>
);

const Key = (): SvgNode => (
  <g transform="translate(18 120)">
    <rect width={44} height={34} rx={8} fill="#1E2230" stroke="#3EE6D6" strokeOpacity={0.4} />
    <rect width={44} height={34} rx={8} fill="#3EE6D6" animation={show([down], { fade: 0.08 })} />
    <text
      x={22}
      y={22}
      textAnchor="middle"
      fontFamily="system-ui, sans-serif"
      fontSize={13}
      fill="#E6E8EE"
    >
      opt
    </text>
  </g>
);

const Cursor = (): SvgNode => (
  <path
    d="M0 0V16l4.2-3.8 3 6.8 2.8-1.2-3-6.6H12Z"
    fill="#E6E8EE"
    stroke="#111318"
    animation={motion({ x: IDLE.x, y: IDLE.y })
      .to({ x: HOME.x + 45, y: HOME.y + 8 }, reach, ease.inOut)
      .to({ x: DROP.x + 45, y: DROP.y + 8 }, grab, ease.inOut)
      .to({ x: IDLE.x, y: IDLE.y }, span(down.end + 0.1, 0.5), ease.inOut)}
  />
);

export default function build(): string {
  return render(
    {
      width: 320,
      height: 180,
      duration: 8,
      title: "A clip",
      desc: "A cursor drags a card while a key is held, then the card goes back.",
      reducedMotion: { at: 2 },
    },
    <>
      <rect width={320} height={180} fill="#111318" />
      <Clip at={1}>
        <Card />
        <Key />
        <Cursor />
      </Clip>
    </>,
  );
}
