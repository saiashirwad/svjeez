import {
  Clip,
  ease,
  motion,
  render,
  show,
  span,
  type Point,
  type Span,
  type SvgNode,
} from "svjeez";
import { css, mono, theme } from "../style";

const W = 640;
const H = 300;
const D = 9;

// One gesture, written from 0 on a clock of its own: the cursor reaches for the title bar, grabs the window and drags
// it while a key is held. Every part reads the same three spans, so moving a span moves all of them.
const reach = span(0, 0.7);
const grab = reach.then(1, 0.2);
const down = grab.pad(0.15);
const leave = span(down.end + 0.1, 0.5);

const IDLE: Point = { x: 244, y: 196 };

/** The title bar's middle, where the cursor takes hold. */
const grip = (window: Point): Point => ({ x: window.x + 52, y: window.y + 9 });

interface WindowProps {
  readonly from: Point;
  readonly to: Point;
  readonly drag: Span;
}

/** Drags from `from` to `to` during `drag`, and rewinds to `from` at the end of the clock, so the loop closes. */
const Window = ({ from, to, drag }: WindowProps): SvgNode => (
  <g
    animation={motion({ x: from.x, y: from.y })
      .to({ x: to.x, y: to.y }, drag, ease.inOut)
      .rewind(0.8)}
  >
    <rect
      width={104}
      height={72}
      rx={7}
      fill={theme.base01}
      stroke={theme.base03}
      strokeWidth={1.5}
    />
    <path d="M0 18V7a7 7 0 0 1 7-7h90a7 7 0 0 1 7 7v11Z" fill={theme.base02} />
    <circle cx={13} cy={9} r={3} fill={theme.base08} />
    <circle cx={24} cy={9} r={3} fill={theme.base0A} />
    <circle cx={35} cy={9} r={3} fill={theme.base0B} />
    <rect x={14} y={30} width={60} height={5} rx={2.5} fill={theme.base03} />
    <rect x={14} y={42} width={44} height={5} rx={2.5} fill={theme.base03} />
  </g>
);

interface KeyProps {
  readonly label: string;
  readonly held: readonly Span[];
}

/** A keycap that lights while any span in `held` runs. Spans that overlap merge, so the fades never collide. */
const Key = ({ label, held }: KeyProps): SvgNode => (
  <g>
    <rect
      width={48}
      height={40}
      rx={9}
      fill={theme.base01}
      stroke={theme.base03}
      strokeWidth={1.5}
    />
    <rect
      width={48}
      height={40}
      rx={9}
      fill={theme.base0D}
      animation={show(held, { fade: 0.08 })}
    />
    <text x={24} y={25} fontFamily={mono} fontSize={14} textAnchor="middle" fill={theme.base05}>
      {label}
    </text>
  </g>
);

interface CursorProps {
  readonly from: Point;
  readonly moves: readonly (readonly [Point, Span])[];
}

const Cursor = ({ from, moves }: CursorProps): SvgNode => {
  let track = motion({ x: from.x, y: from.y });

  for (const [to, when] of moves) track = track.to({ x: to.x, y: to.y }, when, ease.inOut);

  return (
    <path
      d="M0 0V16l4.2-3.8 3 6.8 2.8-1.2-3-6.6H12Z"
      fill={theme.base05}
      stroke={theme.base00}
      strokeWidth={1.2}
      strokeLinejoin="round"
      animation={track}
    />
  );
};

interface GestureProps {
  readonly x: number;
  readonly at: number;
  readonly from: Point;
  readonly to: Point;
}

/** A desktop with the gesture placed on it at `at`: the same clip, two places on the clock. */
const Desktop = ({ x, at, from, to }: GestureProps): SvgNode => (
  <g transform={`translate(${x} 30)`}>
    <rect
      width={290}
      height={240}
      rx={14}
      fill={theme.base00}
      stroke={theme.base02}
      strokeWidth={1.5}
    />
    <g transform="translate(16 184)">
      <Clip at={at}>
        <Key label="opt" held={[down]} />
      </Clip>
    </g>
    <Clip at={at}>
      <Window from={from} to={to} drag={grab} />
      <Cursor
        from={IDLE}
        moves={[
          [grip(from), reach],
          [grip(to), grab],
          [IDLE, leave],
        ]}
      />
    </Clip>
  </g>
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "A clip",
      desc: "Two desktops play one gesture a few seconds apart: a cursor takes a window by its title bar and drags it while a key is held, then the window goes back.",
      css,
      reducedMotion: { at: 2 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <Desktop x={20} at={1} from={{ x: 28, y: 36 }} to={{ x: 150, y: 110 }} />
      <Desktop x={330} at={4.4} from={{ x: 28, y: 96 }} to={{ x: 150, y: 36 }} />
    </>,
  );
}
