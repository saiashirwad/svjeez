import { css, ease, motion, Pivot, render, show, type Color } from "svjeez";
import { sequence } from "@svjeez/diagrams";
import { CSS, chrome, outro } from "./lib/kit";
import { mono, theme } from "../style";
import { GROUND, SQUASH, chick, jumps } from "./lib/chick";

// A sequence diagram on one side, and on the other the svjeez chick acting it out: it opens a README, asks a sleepy
// CDN cloud for hello.svg, catches the file as it drops, watches it play, and cheers. `tall` stacks the two.

const BAR = 40;
const STEP = 1.25;
const AT = 0.6;

/** When the diagram plays its `i`th message or note. */
const beat = (i: number) => AT + i * STEP;

const D = Math.ceil(beat(4) + 3);

/** The stage, in its own coordinates: 440 wide, 280 tall, with the floor at 250. */
const FLOOR = 250;
const PAGE = { x: 150, y: 96, w: 150, h: 154 };
const FRAME = { x: 166, y: 150, w: 118, h: 80 };
const SLOT = { x: FRAME.x + FRAME.w / 2, y: FRAME.y + FRAME.h / 2 };
const CDN = { x: 360, y: 64 };

const CLOUD =
  "M-60 18C-80 18 -80 -10 -60 -13C-60 -36 -29 -44 -16 -26C-5 -49 34 -47 36 -18C60 -23 72 6 52 18Z";

const arc = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  at: number,
  over: number,
  lift: number,
) => [
  motion({ x: from.x, y: from.y }).at(at).to({ x: to.x, y: to.y }, over, ease.inOut),
  motion({ y: 0 })
    .at(at)
    .to({ y: -lift }, over / 2, ease.out)
    .to({ y: 0 }, over / 2, ease.in),
];

const stage = () => {
  const hops = jumps([
    { land: beat(0) - 0.05, height: 24 },
    { land: beat(1) + 0.15, height: 30 },
    { land: beat(4) + 0.35, height: 70 },
    { land: beat(4) + 1.4, height: 50 },
  ]);

  const look = motion({ x: 0, y: 0 })
    .at(beat(0) + 0.1)
    .to({ x: 6, y: 2 }, 0.25)
    .at(beat(1))
    .to({ x: 6, y: -6 }, 0.25)
    .at(beat(2) + 0.3)
    .to({ x: 6, y: 2 }, 0.25)
    .at(beat(4))
    .to({ x: 0, y: 0 }, 0.25);

  const glow = motion({ fill: "#FFC21A" })
    .at(beat(3) + 0.2)
    .to({ fill: "#FFF3B0" }, 0.15)
    .wait(0.6)
    .to({ fill: "#FFC21A" }, 0.4);

  // The README unfolds from the floor.
  const unfold = motion({ scale: 0 })
    .at(beat(0) + 0.05)
    .to({ scale: 1 }, 0.45, ease.pop);

  // The cloud dozes until it is asked, then wakes.
  const asleep = motion({ opacity: 1 })
    .at(beat(1) + 0.75)
    .to({ opacity: 0 }, 0.1);

  const awake = motion({ opacity: 0 })
    .at(beat(1) + 0.75)
    .to({ opacity: 1 }, 0.1);

  const startle = motion({ y: 0 })
    .at(beat(1) + 0.75)
    .to({ y: -8 }, 0.12, ease.out)
    .to({ y: 0 }, 0.35, ease.pop);

  const request = [
    show({ at: beat(1) + 0.1, over: 0.75 }, { fade: 0.1 }),
    ...arc(SLOT, CDN, beat(1) + 0.1, 0.7, 50),
  ];

  const reply = [
    show({ at: beat(2) + 0.1, over: 1.05 }, { fade: 0.15 }),
    ...arc(CDN, SLOT, beat(2) + 0.1, 0.8, 30),
  ];

  // Once the file lands it plays: a sun turns and a ball bounces inside the frame.
  const playing = show({ at: beat(3) + 0.1, over: D - beat(3) - 0.6 }, { fade: 0.2 });

  const spin = motion({ rotate: 0 })
    .at(beat(3) + 0.1)
    .to({ rotate: 180 }, D - beat(3) - 0.7, ease.linear);

  const ball = [0, 1, 2, 3].reduce(
    (m, i) =>
      m
        .at(beat(3) + 0.2 + i * 0.6)
        .to({ y: -26 }, 0.3, ease.out)
        .to({ y: 0 }, 0.3, ease.in),
    motion({ y: 0 }),
  );

  // Sparks when it cheers.
  const sparks = [-150, -110, -70, -30].map((deg, i) => {
    const a = (deg * Math.PI) / 180;

    return (
      <circle
        cx={80}
        cy={FLOOR - 70}
        r={4}
        fill={i % 2 ? theme.base0A : theme.base0B}
        animation={motion({ x: 0, y: 0, opacity: 0 })
          .at(beat(4) + 0.4)
          .set({ opacity: 1 })
          .to(
            { x: +(44 * Math.cos(a)).toFixed(1), y: +(44 * Math.sin(a)).toFixed(1), opacity: 0 },
            0.5,
            ease.out,
          )}
      />
    );
  });

  const chip = (text: string, fill: Color, w: number) => (
    <>
      <rect x={-w / 2} y={-13} width={w} height={26} rx={8} fill={fill} />
      <text
        y={4.5}
        textAnchor="middle"
        fontFamily={mono}
        fontSize={12}
        fontWeight={600}
        fill={theme.base00}
      >
        {text}
      </text>
    </>
  );

  return (
    <>
      {/* The CDN, a cloud that naps until it is asked for a file. */}
      <g transform={`translate(${CDN.x} ${CDN.y})`}>
        <g animation={startle}>
          <path d={CLOUD} fill={theme.base0C} fillOpacity={0.22} />
          <g animation={asleep}>
            <path
              d="M-14 0Q-10 3 -6 0M6 0Q10 3 14 0"
              stroke={theme.base04}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
          </g>
          <g animation={awake}>
            <circle cx={-10} cy={-1} r={2.5} fill={theme.base05} />
            <circle cx={10} cy={-1} r={2.5} fill={theme.base05} />
          </g>
          <text y={34} textAnchor="middle" fontFamily={mono} fontSize={12} fill={theme.base04}>
            CDN
          </text>
        </g>
      </g>

      {/* The README, unfolding with an empty image frame in it. */}
      <Pivot origin={{ x: PAGE.x + PAGE.w / 2, y: FLOOR }} animation={unfold}>
        <rect x={PAGE.x} y={PAGE.y} width={PAGE.w} height={PAGE.h} rx={10} fill={theme.base01} />
        <text x={PAGE.x + 14} y={PAGE.y + 22} fontFamily={mono} fontSize={11} fill={theme.base04}>
          README.md
        </text>
        <rect
          x={PAGE.x + 14}
          y={PAGE.y + 34}
          width={90}
          height={5}
          rx={2.5}
          fill={theme.base03}
          opacity={0.5}
        />
        <rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} rx={6} fill={theme.base02} />
        <g animation={playing}>
          <g transform={`translate(${FRAME.x + 34} ${FRAME.y + 30})`}>
            <g animation={spin}>
              {[0, 45, 90, 135].map((r) => (
                <rect
                  x={-2}
                  y={-17}
                  width={4}
                  height={34}
                  rx={2}
                  fill={theme.base0A}
                  transform={`rotate(${r})`}
                />
              ))}
            </g>
            <circle r={9} fill={theme.base0A} />
          </g>
          <g transform={`translate(${FRAME.x + 84} ${FRAME.y + 64})`}>
            <circle r={7} fill={theme.base08} animation={ball} />
          </g>
        </g>
      </Pivot>

      {/* The request flies up to the cloud, and the file drops back down into the frame. */}
      <g animation={request}>{chip("GET", theme.base0D, 46)}</g>
      <g animation={reply}>{chip("hello.svg", theme.base0B, 88)}</g>

      {sparks}
      <g transform={`translate(80 ${FLOOR}) scale(0.5) translate(${-GROUND.x} ${-GROUND.y})`}>
        {chick({
          blinks: [beat(0) + 0.6, beat(2) + 0.9, beat(4) + 0.9],
          body: hops.body,
          stretch: hops.stretch,
          bulb: hops.bulb,
          glow,
          look,
          feet: {},
        })}
      </g>
    </>
  );
};

/** `tall` stacks the diagram over the stage for a phone. */
export const make = (tall = false): string => {
  const W = tall ? 358 : 1032;
  const H = tall ? 640 : 360;
  const SPLIT = 500;
  const win = chrome(W, H, "sequence.tsx");

  const login = sequence(
    {
      actors: { you: "You", img: "<img>", cdn: { label: "CDN", role: "store" } },
      messages: [
        ["you", "img", "open README"],
        ["img", "cdn", "GET hello.svg"],
        ["cdn", "img", "1 file, 955 B", { reply: true }],
        { note: "img", text: "plays CSS keyframes" },
        ["img", "you", "animation", { reply: true }],
      ],
    },
    {
      theme,
      x: tall ? W / 2 : SPLIT / 2,
      y: tall ? BAR + 150 : BAR + (H - BAR) / 2,
      anchor: "center",
      fontSize: tall ? 12 : 13,
      class: "sans",
      play: { at: AT, step: STEP },
    },
  );

  const place = tall
    ? "translate(-30 352) scale(0.9)"
    : `translate(${SPLIT + 22} ${BAR + 6}) scale(1.1)`;

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "A sequence diagram, acted out",
      desc: "A sequence diagram plays message by message while the svjeez chick acts it out beside it: it opens a README, sends GET hello.svg up to a sleepy CDN cloud that wakes up, catches the file as it drops into the README, watches it play, and cheers.",
      css: css(Object.assign([CSS, ""], { raw: [CSS, ""] }), SQUASH),
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <path d={tall ? `M0 ${BAR + 300}H${W}` : `M${SPLIT} ${BAR}V${H}`} stroke={theme.base02} />
      <g animation={outro(D)}>
        {login.node}
        <g transform={place}>{stage()}</g>
      </g>
    </>,
  );
};

export default () => make();
