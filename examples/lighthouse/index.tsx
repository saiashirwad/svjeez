import {
  def,
  draw,
  ease,
  el,
  enter,
  motion,
  render,
  type Color,
  type Motion,
  type Point,
  type SvgNode,
} from "svjeez";
import { travel, visible } from "svjeez/extras";
import { SPEED, end, graph, messages, type Kind, type Thread } from "./data";

const W = 1280;
const H = 720;

const HOLD = 1.1;
const FADE = 0.35;
const GAP = (HOLD + FADE) / 3;

/** One loop: the story, then the last label's life and a breath. */
const D = Math.ceil(end + HOLD + FADE + 1);

/** Each color is a CSS variable, so the scene follows the viewer's light or dark mode. */
const PALETTE = {
  paper: ["#faf7ea", "#12151d"],
  ink: ["#181f2e", "#e6e1cf"],
  muted: ["#181f2e8c", "#e6e1cf8c"],
  faint: ["#181f2e29", "#e6e1cf29"],
  orange: ["#fa6e1d", "#ff8a3d"],
  claude: ["#fdccac", "#e8a57f"],
  gpt: ["#b6e8d1", "#7fc9a8"],
  read: ["#1467c2", "#5b9cf0"],
  edit: ["#763ebd", "#a77ff0"],
  test: ["#cf9c00", "#e8b923"],
  delegate: ["#db428c", "#f06aa8"],
  research: ["#008e82", "#2cc2b2"],
} as const satisfies Record<string, readonly [Color, Color]>;

type Swatch = keyof typeof PALETTE;

// SAFETY: the keys come from PALETTE, so every Swatch is present and maps to a var(--name) color
const C = Object.fromEntries(
  Object.keys(PALETTE).map((name) => [name, `var(--${name})`]),
) as Record<Swatch, Color>;

// SAFETY: entries(PALETTE) keeps each Swatch key with its [light, dark] pair
const scheme = (mode: 0 | 1) =>
  (Object.entries(PALETTE) as [Swatch, readonly [Color, Color]][])
    .map(([name, pair]) => `--${name}:${pair[mode]}`)
    .join(";");

const THEME = `svg{${scheme(0)}}@media (prefers-color-scheme:dark){svg{${scheme(1)}}}`;

const KINDS: Record<Kind, { readonly text: string; readonly color: Color }> = {
  read: { text: "READ", color: C.read },
  edit: { text: "EDIT", color: C.edit },
  test: { text: "TEST", color: C.test },
  delegate: { text: "DELEGATE", color: C.delegate },
  research: { text: "RESEARCH", color: C.research },
  msg: { text: "+MSG", color: C.orange },
  done: { text: "DONE", color: C.ink },
};

/** `.mono` advances 0.6em per character. */
const advance = (size: number) => size * 0.6;

// Layout: each child hangs off a 45° spine from its parent's junction, lanes alternating up and down.

const R = 18;
const STUB = 120;
const LANE = 100;

const position: Point[] = [];
const junction: Point[] = [];

for (const thread of graph) {
  if (thread.parent === undefined) {
    position[thread.index] = { x: 0, y: 0 };
    continue;
  }

  const parent = position[thread.parent]!;

  const k = graph.filter(
    (other) => other.parent === thread.parent && other.index < thread.index,
  ).length;

  const dy = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * LANE;
  junction[thread.index] = { x: parent.x + STUB + Math.abs(dy), y: parent.y + dy };
  position[thread.index] = { x: parent.x + 2 * STUB + Math.abs(dy), y: parent.y + dy };
}

/** Points from a thread up to the root, through each junction on the way. */
const route = (index: number): Point[] => {
  const thread = graph[index]!;

  if (thread.parent === undefined) return [position[index]!];
  const parent = position[thread.parent]!;

  return [
    position[index]!,
    junction[index]!,
    { x: parent.x + STUB, y: parent.y },
    ...route(thread.parent),
  ];
};

const between = (from: number, to: number): Point[] => {
  const up = route(from);
  const down = route(to).reverse();

  const meet = up.findIndex((point) =>
    down.some((other) => other.x === point.x && other.y === point.y),
  );

  const rest = down.findIndex((point) => point.x === up[meet]!.x && point.y === up[meet]!.y);

  return [...up.slice(0, meet + 1), ...down.slice(rest + 1)].filter(
    (point, i, all) => i === 0 || point.x !== all[i - 1]!.x || point.y !== all[i - 1]!.y,
  );
};

// Camera: refit to the threads alive so far each time one is born.

const AREA = { x: 40, y: 80, w: 1200, h: 540 };

const fit = (born: number) => {
  const alive = graph
    .filter((thread) => thread.born <= born)
    .map((thread) => position[thread.index]!);

  const [left, right] = [
    Math.min(...alive.map((p) => p.x)) - 150,
    Math.max(...alive.map((p) => p.x)) + 170,
  ];

  const [top, bottom] = [
    Math.min(...alive.map((p) => p.y)) - 80,
    Math.max(...alive.map((p) => p.y)) + 80,
  ];

  const scale = Math.min(1.5, AREA.w / (right - left), AREA.h / (bottom - top));

  return {
    x: AREA.x + AREA.w / 2 - (scale * (left + right)) / 2,
    y: AREA.y + AREA.h / 2 - (scale * (top + bottom)) / 2,
    scale,
  };
};

const PAN = 0.9;

const shots: { at: number; view: ReturnType<typeof fit> }[] = [];

for (const thread of graph) {
  const last = shots.at(-1);
  const at = last ? Math.max(thread.born, last.at + PAN) : 0;

  shots.push({ at, view: fit(thread.born) });
}

const camera = shots
  .slice(1)
  .reduce<Motion<"x" | "y" | "scale">>(
    (track, shot) => track.at(shot.at).to(shot.view, PAN, ease.inOut),
    motion(shots[0]!.view),
  );

// Labels: a node takes its three slots in turn, skipping events inside GAP, so a slot is free when its turn returns.

type Slot = { readonly anchor: Point; readonly h: -1 | 1; readonly v: -1 | 0 | 1 };

const SLOT = {
  W: { anchor: { x: -58, y: 0 }, h: -1, v: 0 },
  NW: { anchor: { x: -34, y: -44 }, h: -1, v: -1 },
  SW: { anchor: { x: -34, y: 44 }, h: -1, v: 1 },
  NE: { anchor: { x: 34, y: -44 }, h: 1, v: -1 },
  E: { anchor: { x: 58, y: 0 }, h: 1, v: 0 },
  SE: { anchor: { x: 34, y: 44 }, h: 1, v: 1 },
} as const satisfies Record<string, Slot>;

/** Three slots per node, kept off the name of the lane above, which sits at the node's upper right. */
const slotsOf = (thread: Thread): readonly Slot[] =>
  thread.parent === undefined
    ? [SLOT.W, SLOT.NW, SLOT.SW]
    : position[thread.index]!.y > 0
      ? [SLOT.NE, SLOT.E, SLOT.SE]
      : [SLOT.E, SLOT.SE, SLOT.SW];

const LABEL = { size: 13, h: 22 };

/** Visible for HOLD after each start; a slot's turns come at least HOLD + FADE apart. */
const showing = (starts: readonly number[]) =>
  starts.reduce<Motion<"opacity">>(
    (track, t) =>
      track
        .at(t)
        .to({ opacity: 1 }, 0.1)
        .at(t + HOLD)
        .to({ opacity: 0 }, FADE),
    motion({ opacity: 0 }),
  );

function Label({
  at,
  slot,
  kind,
  starts,
}: {
  at: Point;
  slot: Slot;
  kind: Kind;
  starts: readonly number[];
}): SvgNode {
  const { text, color } = KINDS[kind];
  const w = 30 + text.length * advance(LABEL.size);
  const anchor = { x: at.x + slot.anchor.x, y: at.y + slot.anchor.y };
  const x = slot.h < 0 ? anchor.x - w : anchor.x;
  const y = anchor.y - (slot.v === 0 ? LABEL.h / 2 : slot.v < 0 ? LABEL.h : 0);
  const reach = Math.hypot(slot.anchor.x, slot.anchor.y);

  return (
    <g animation={showing(starts)}>
      <line
        x1={at.x + (slot.anchor.x / reach) * (R + 3)}
        y1={at.y + (slot.anchor.y / reach) * (R + 3)}
        x2={anchor.x}
        y2={anchor.y}
        stroke={C.ink}
        strokeWidth={1.25}
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={LABEL.h}
        fill={C.paper}
        stroke={C.ink}
        strokeWidth={1.5}
      />
      <rect x={x + 8} y={y + LABEL.h / 2 - 4} width={8} height={8} fill={color} />
      <text x={x + 22} y={y + LABEL.h / 2 + 4.5} fill={color}>
        {text}
      </text>
    </g>
  );
}

// SAFETY: KINDS is a literal Record<Kind, ...>, so each of its keys is a Kind
const KIND_KEYS = Object.keys(KINDS) as Kind[];

function Labels({ thread }: { thread: Thread }): SvgNode {
  const slots = slotsOf(thread);
  const at = position[thread.index]!;
  let last = -Infinity;

  const shown = thread.labels.filter((label) => {
    if (label.t - last < GAP) return false;
    last = label.t;

    return true;
  });

  return (
    <>
      {slots.flatMap((slot, s) =>
        KIND_KEYS.map((kind) => {
          const starts = shown
            .filter((label, i) => i % slots.length === s && label.kind === kind)
            .map((label) => label.t);

          return starts.length > 0 && <Label at={at} slot={slot} kind={kind} starts={starts} />;
        }),
      )}
    </>
  );
}

// Nodes.

const arrivals = new Map<number, number[]>();

function Beacon({ thread }: { thread: Thread }): SvgNode {
  const rays = Array.from({ length: 6 }, (_, k) => {
    const angle = (k * Math.PI) / 3 + Math.PI / 6;
    const [inner, outer] = [R + 5, R + (k % 3 === 1 ? 11 : 17)];

    return el.line({
      x1: Math.cos(angle) * inner,
      y1: Math.sin(angle) * inner,
      x2: Math.cos(angle) * outer,
      y2: Math.sin(angle) * outer,
    });
  });

  return (
    <g
      animation={visible(
        thread.runs.map(([at, to]) => ({ at, over: to - at })),
        0.15,
      )}
    >
      <g
        stroke={C.ink}
        strokeWidth={1.5}
        strokeLinecap="square"
        animation={motion({ rotate: 0 }).to({ rotate: 360 }, 6, ease.linear).loop(6)}
      >
        {rays}
      </g>
    </g>
  );
}

function Node({ thread }: { thread: Thread }): SvgNode {
  const { x, y } = position[thread.index]!;
  const fades = thread.last < end - 10;
  const root = thread.parent === undefined;
  const flashes = (arrivals.get(thread.index) ?? []).map((t) => ({ at: t, over: 0.6 }));
  const tint = thread.family === "gpt" ? C.gpt : C.claude;

  /** A finished thread hollows out to a ring in its family's color, so it reads in either mode. */
  const retire = motion()
    .at(thread.last + 1)
    .to({ fill: C.paper, stroke: tint }, 1);

  return (
    <g>
      <g transform={`translate(${x} ${y})`}>
        <Beacon thread={thread} />
        <rect
          x={-R - 7}
          y={-R - 7}
          width={2 * R + 14}
          height={2 * R + 14}
          fill="none"
          stroke={C.orange}
          strokeWidth={1.5}
          animation={visible(flashes, 0.08)}
        />
        <circle
          r={R}
          fill={tint}
          stroke={C.ink}
          strokeWidth={2}
          animation={[
            !root && enter({ at: thread.born, over: 0.5 }, { scale: 0 }, ease.pop),
            fades && retire,
          ]}
        />
      </g>
      <text
        x={x}
        y={y + R + 30}
        class="mono"
        fontSize={13}
        fill={C.muted}
        textAnchor="middle"
        animation={[
          !root && enter({ at: thread.born + 0.2, over: 0.4 }),
          fades &&
            motion()
              .at(thread.last + 1)
              .to({ opacity: 0.5 }, 1),
        ]}
      >
        {thread.name}
      </text>
    </g>
  );
}

function Edge({ thread }: { thread: Thread }): SvgNode {
  const parent = position[thread.parent!]!;
  const [j, p] = [junction[thread.index]!, position[thread.index]!];
  const fork = { x: parent.x + STUB, y: parent.y };

  const dot = (at: Point) =>
    el.rect({
      x: at.x - 2.5,
      y: at.y - 2.5,
      width: 5,
      height: 5,
      fill: C.ink,
      animation: enter({ at: thread.born, over: 0.2 }),
    });

  return (
    <>
      <path
        d={`M${parent.x + R} ${parent.y}H${fork.x}L${j.x} ${j.y}H${p.x - R}`}
        fill="none"
        stroke={C.ink}
        strokeWidth={1.5}
        animation={draw({ at: thread.born - 0.3, over: 0.5 }, ease.inOut)}
      />
      {dot(fork)}
      {j.y !== fork.y && dot(j)}
    </>
  );
}

// Messages: a square runs the tree from sender to recipient.

const PACE = 420;

const flights = messages.map((message) => {
  const path = between(message.from, message.to);

  const total = path
    .slice(1)
    .reduce((sum, point, i) => sum + Math.hypot(point.x - path[i]!.x, point.y - path[i]!.y), 0);

  const over = Math.min(0.9, Math.max(0.35, total / PACE));
  const list = arrivals.get(message.to) ?? [];
  list.push(message.t + over);
  arrivals.set(message.to, list);

  return { ...message, path, over };
});

function Messages(): SvgNode {
  return (
    <g fill={C.orange}>
      {flights.map((flight) =>
        el.rect({
          x: -4,
          y: -4,
          width: 8,
          height: 8,
          animation: travel(flight.path, { at: flight.t, over: flight.over }),
        }),
      )}
    </g>
  );
}

// HUD.

function Hud(): SvgNode {
  const bar = H - 26;

  return (
    <>
      <rect x={24} y={17} width={9} height={9} fill={C.orange} />
      <text x={40} y={26} class="mono" fontSize={11} fontWeight={600} fill={C.ink}>
        LIGHTHOUSE
      </text>
      <text x={40 + 11 * advance(11) + 10} y={26} class="mono" fontSize={11} fill={C.muted}>
        {`// TIMELAPSE ${SPEED}×`}
      </text>

      <circle cx={30} cy={bar - 4} r={5} fill={C.claude} stroke={C.ink} />
      <text x={42} y={bar} class="mono" fontSize={11} fill={C.muted}>
        CLAUDE
      </text>
      <circle cx={130} cy={bar - 4} r={5} fill={C.gpt} stroke={C.ink} />
      <text x={142} y={bar} class="mono" fontSize={11} fill={C.muted}>
        GPT
      </text>

      <g strokeWidth={3} strokeLinecap="round">
        <line x1={240} y1={bar} x2={W - 24} y2={bar} stroke={C.faint} />
        <line
          x1={240}
          y1={bar}
          x2={W - 24}
          y2={bar}
          stroke={C.orange}
          animation={draw({ at: 0, over: D }, ease.linear)}
        />
      </g>
    </>
  );
}

/** Paper grain: a tile of faint specks. */
const grain = def.pattern(
  { width: 97, height: 97, patternUnits: "userSpaceOnUse" },
  el.g(
    { fill: C.ink },
    Array.from({ length: 90 }, (_, i) => {
      const r = (k: number) => Math.abs(Math.sin(i * 91.7 + k * 47.3) * 9631.1) % 1;

      return el.rect({
        x: r(1) * 97,
        y: r(2) * 97,
        width: 1,
        height: 1,
        opacity: 0.04 + r(3) * 0.08,
      });
    }),
  ),
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Lighthouse",
      desc: "A timelapse of eight agent threads: a root delegates to children, each node beams while it runs, tool calls flicker out as labels, and messages travel the tree.",
      reducedMotion: { at: end },
      css: `${THEME}\n.mono{font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace}.label{font-size:${LABEL.size}px;font-weight:600}`,
      comment: "Generated by svjeez. Edit examples/lighthouse/index.tsx instead of this file.",
    },
    <>
      <rect width={W} height={H} fill={C.paper} />
      <rect width={W} height={H} fill={grain} />
      <g style="transform-box:view-box;transform-origin:0 0" animation={camera}>
        <g
          animation={motion()
            .at(D - 0.6)
            .to({ opacity: 0 }, 0.5)}
        >
          {graph
            .filter((thread) => thread.parent !== undefined)
            .map((thread) => (
              <Edge thread={thread} />
            ))}
          <Messages />
          {graph.map((thread) => (
            <Node thread={thread} />
          ))}
          <g class="mono label">
            {graph.map((thread) => (
              <Labels thread={thread} />
            ))}
          </g>
        </g>
      </g>
      <Hud />
    </>,
  );
}
