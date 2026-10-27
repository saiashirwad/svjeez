import { def, draw, ease, el, enter, motion, render, type Color, type Motion, type Point, type SvgNode } from "svg-motion";
import { SPEED, end, graph, messages, type Kind, type Thread } from "./data";

const W = 1280;
const H = 720;
/** One loop, a whole number of 12s so the hour wheel turns cleanly (12s is one hour at 300×). */
const D = Math.ceil((end + 3) / 12) * 12;

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

const C = Object.fromEntries(Object.keys(PALETTE).map((name) => [name, `var(--${name})`])) as Record<Swatch, Color>;

const scheme = (mode: 0 | 1) => (Object.entries(PALETTE) as [Swatch, readonly [Color, Color]][]).map(([name, pair]) => `--${name}:${pair[mode]}`).join(";");

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
  const k = graph.filter((other) => other.parent === thread.parent && other.index < thread.index).length;
  const dy = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * LANE;
  junction[thread.index] = { x: parent.x + STUB + Math.abs(dy), y: parent.y + dy };
  position[thread.index] = { x: parent.x + 2 * STUB + Math.abs(dy), y: parent.y + dy };
}

/** Points from a thread up to the root, through each junction on the way. */
const route = (index: number): Point[] => {
  const thread = graph[index]!;
  if (thread.parent === undefined) return [position[index]!];
  const parent = position[thread.parent]!;
  return [position[index]!, junction[index]!, { x: parent.x + STUB, y: parent.y }, ...route(thread.parent)];
};

const between = (from: number, to: number): Point[] => {
  const up = route(from);
  const down = route(to).reverse();
  const meet = up.findIndex((point) => down.some((other) => other.x === point.x && other.y === point.y));
  const rest = down.findIndex((point) => point.x === up[meet]!.x && point.y === up[meet]!.y);
  return [...up.slice(0, meet + 1), ...down.slice(rest + 1)].filter((point, i, all) => i === 0 || point.x !== all[i - 1]!.x || point.y !== all[i - 1]!.y);
};

// Camera: refit to the threads alive so far each time one is born.

const AREA = { x: 40, y: 80, w: 1200, h: 540 };

const fit = (born: number) => {
  const alive = graph.filter((thread) => thread.born <= born).map((thread) => position[thread.index]!);
  const [left, right] = [Math.min(...alive.map((p) => p.x)) - 150, Math.max(...alive.map((p) => p.x)) + 170];
  const [top, bottom] = [Math.min(...alive.map((p) => p.y)) - 80, Math.max(...alive.map((p) => p.y)) + 80];
  const scale = Math.min(1.5, AREA.w / (right - left), AREA.h / (bottom - top));
  return {
    x: AREA.x + AREA.w / 2 - scale * (left + right) / 2,
    y: AREA.y + AREA.h / 2 - scale * (top + bottom) / 2,
    scale,
  };
};

const PAN = 0.9;
const shots = graph.reduce<{ at: number; view: ReturnType<typeof fit> }[]>((list, thread) => {
  const at = list.length === 0 ? 0 : Math.max(thread.born, list.at(-1)!.at + PAN);
  return [...list, { at, view: fit(thread.born) }];
}, []);

const camera = shots.slice(1).reduce<Motion<"x" | "y" | "scale">>((track, shot) => track.at(shot.at).to(shot.view, PAN, ease.inOut), motion(shots[0]!.view));

type Fade = Motion<"opacity">;

// Labels: five slots around each node. The stalest slot takes the next event, unless its box would cover
// another node or a label still showing there; with no slot clear, the event is skipped.

type Slot = { readonly anchor: Point; readonly h: -1 | 1; readonly v: -1 | 0 | 1 };
const SLOT = {
  W: { anchor: { x: -58, y: 0 }, h: -1, v: 0 },
  NW: { anchor: { x: -34, y: -44 }, h: -1, v: -1 },
  SW: { anchor: { x: -34, y: 44 }, h: -1, v: 1 },
  NE: { anchor: { x: 34, y: -44 }, h: 1, v: -1 },
  E: { anchor: { x: 58, y: 0 }, h: 1, v: 0 },
  SE: { anchor: { x: 34, y: 44 }, h: 1, v: 1 },
} as const satisfies Record<string, Slot>;

const HOLD = 1.6;
const LINGER = 3;
const FADE = 0.35;
const GHOST = 0.3;
const SCRAMBLE = 0.16;
const GAP = 0.3;
/** Longest a label shows, ghost included. */
const LIFE = HOLD + LINGER + 2 * FADE;

const LABEL = { size: 13, h: 22 };

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const boxOf = (at: Point, slot: Slot, kind: Kind): Box => {
  const w = 30 + KINDS[kind].text.length * advance(LABEL.size);
  const anchor = { x: at.x + slot.anchor.x, y: at.y + slot.anchor.y };
  return { x: slot.h < 0 ? anchor.x - w : anchor.x, y: anchor.y - (slot.v === 0 ? LABEL.h / 2 : slot.v < 0 ? LABEL.h : 0), w, h: LABEL.h };
};

const hits = (a: Box, b: Box, pad = 4) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

const slotsOf = (thread: Thread): Slot[] =>
  thread.parent === undefined ? [SLOT.W, SLOT.NW, SLOT.SW, SLOT.NE, SLOT.SE] : [SLOT.NE, SLOT.E, SLOT.SE, SLOT.SW, SLOT.NW];

/** Each node's circle, rays and name. */
const bodies: Box[] = graph.map((thread) => {
  const { x, y } = position[thread.index]!;
  return { x: x - 36, y: y - 36, w: 72, h: R + 70 };
});

interface Shown {
  readonly t: number;
  readonly kind: Kind;
  readonly next: number;
}

const schedules: Shown[][][] = (() => {
  const slots = graph.map(slotsOf);
  const taken = graph.map((thread) => slots[thread.index]!.map((): { t: number; kind: Kind }[] => []));
  const events = graph.flatMap((thread) => thread.labels.map((label) => ({ ...label, n: thread.index }))).sort((a, b) => a.t - b.t);
  for (const { t, kind, n } of events) {
    const showing = taken.flatMap((mine, other) =>
      other === n
        ? []
        : mine.flatMap((slot, s) => {
            const last = slot.at(-1);
            return last && t < last.t + LIFE ? [boxOf(position[other]!, slots[other]![s]!, last.kind)] : [];
          }),
    );
    const blocked = [...showing, ...bodies.filter((_, other) => other !== n && graph[other]!.born < t + LIFE)];
    const pick = taken[n]!
      .map((slot, s) => ({ s, last: slot.at(-1)?.t ?? -Infinity }))
      .sort((a, b) => a.last - b.last)
      .find(({ s, last }) => last + GAP <= t && !blocked.some((box) => hits(boxOf(position[n]!, slots[n]![s]!, kind), box)));
    if (pick) taken[n]![pick.s]!.push({ t, kind });
  }
  return taken.map((mine) => mine.map((slot) => slot.map((label, i) => ({ ...label, next: slot[i + 1]?.t ?? Infinity }))));
})();

/** Full for HOLD, then a ghost for LINGER, cut short by whatever takes the slot next. */
const presence = (shown: readonly Shown[]): Fade => {
  let track: Fade = motion({ opacity: 0 });
  for (const { t, next } of shown) {
    track = track.at(t).set({ opacity: 1 });
    const stale = t + HOLD;
    if (next < stale + FADE + 0.05) {
      track = track.at(next).set({ opacity: 0 });
      continue;
    }
    if (stale + FADE > D) continue;
    track = track.at(stale).to({ opacity: GHOST }, FADE, ease.inOut);
    const gone = stale + LINGER;
    if (next < gone + FADE + 0.05) track = track.at(next).set({ opacity: 0 });
    else if (gone + FADE <= D) track = track.at(gone).to({ opacity: 0 }, FADE);
  }
  return track;
};

/** Visible from `from` to `to` after each start, hidden otherwise. */
const blink = (starts: readonly number[], from: number, to: number): Fade =>
  starts.reduce<Fade>((track, t) => track.at(t + from).set({ opacity: 1 }).at(t + to).set({ opacity: 0 }), motion({ opacity: 0 }));

const GLYPHS = "#%&*<>?/[]=+-@$\\";

const scrambled = (text: string, seed: number, keep: number): string =>
  [...text]
    .map((char, i) => {
      const roll = Math.abs(Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1;
      return roll < keep ? char : GLYPHS[Math.floor(roll * GLYPHS.length)]!;
    })
    .join("");

function Label({ at, slot, kind, shown, seed }: { at: Point; slot: Slot; kind: Kind; shown: readonly Shown[]; seed: number }): SvgNode {
  const { text, color } = KINDS[kind];
  const { x, y, w } = boxOf(at, slot, kind);
  const box = { x, y };
  const anchor = { x: at.x + slot.anchor.x, y: at.y + slot.anchor.y };
  const reach = Math.hypot(slot.anchor.x, slot.anchor.y);
  const base = { x: box.x + 22, y: box.y + LABEL.h / 2 + 4.5, fill: color };
  const starts = shown.map((s) => s.t);
  return (
    <g animation={presence(shown)}>
      <line
        x1={at.x + (slot.anchor.x / reach) * (R + 3)}
        y1={at.y + (slot.anchor.y / reach) * (R + 3)}
        x2={anchor.x}
        y2={anchor.y}
        stroke={C.ink}
        strokeWidth={1.25}
      />
      <rect x={box.x} y={box.y} width={w} height={LABEL.h} fill={C.paper} stroke={C.ink} strokeWidth={1.5} />
      <rect x={box.x + 8} y={box.y + LABEL.h / 2 - 4} width={8} height={8} fill={color} />
      {el.text({ ...base, animation: blink(starts, 0, SCRAMBLE / 2) }, scrambled(text, seed, 0.15))}
      {el.text({ ...base, animation: blink(starts, SCRAMBLE / 2, SCRAMBLE) }, scrambled(text, seed + 1, 0.6))}
      {el.text({ ...base, animation: starts.reduce<Fade>((track, t) => track.at(t).set({ opacity: 0 }).at(t + SCRAMBLE).set({ opacity: 1 }), motion({ opacity: 0 })) }, text)}
    </g>
  );
}

function Labels({ thread }: { thread: Thread }): SvgNode {
  const slots = slotsOf(thread);
  const at = position[thread.index]!;
  return (
    <>
      {schedules[thread.index]!.flatMap((shown, s) =>
        (Object.keys(KINDS) as Kind[]).map((kind) => {
          const mine = shown.filter((label) => label.kind === kind);
          return mine.length > 0 && <Label at={at} slot={slots[s]!} kind={kind} shown={mine} seed={thread.index * 31 + s * 7} />;
        }),
      )}
    </>
  );
}

// Nodes.

/** Spans merged when they nearly touch, so fades never overlap. */
const merge = (spans: readonly (readonly [number, number])[], gap: number): [number, number][] =>
  spans.reduce<[number, number][]>((out, [a, b]) => {
    const last = out.at(-1);
    if (last && a - last[1] < gap) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
    return out;
  }, []);

const pulse = (spans: readonly (readonly [number, number])[], fade: number): Fade =>
  merge(spans, fade * 2).reduce<Fade>((track, [a, b]) => {
    const over = Math.min(fade, (b - a) / 2);
    track = track.at(a).to({ opacity: 1 }, over);
    return b + fade <= D ? track.at(b).to({ opacity: 0 }, fade) : track;
  }, motion({ opacity: 0 }));

const arrivals = new Map<number, number[]>();

function Beacon({ thread }: { thread: Thread }): SvgNode {
  const rays = Array.from({ length: 6 }, (_, k) => {
    const angle = (k * Math.PI) / 3 + Math.PI / 6;
    const [inner, outer] = [R + 5, R + (k % 3 === 1 ? 11 : 17)];
    return el.line({ x1: Math.cos(angle) * inner, y1: Math.sin(angle) * inner, x2: Math.cos(angle) * outer, y2: Math.sin(angle) * outer });
  });
  return (
    <g animation={pulse(thread.runs, 0.15)}>
      <g stroke={C.ink} strokeWidth={1.5} strokeLinecap="square" animation={motion({ rotate: 0 }).to({ rotate: 360 }, 6, ease.linear).loop(6)}>
        {rays}
      </g>
    </g>
  );
}

function Node({ thread }: { thread: Thread }): SvgNode {
  const { x, y } = position[thread.index]!;
  const fades = thread.last < end - 10;
  const flashes = (arrivals.get(thread.index) ?? []).map((t) => [t, t + 0.6] as const);
  const tint = thread.family === "gpt" ? C.gpt : C.claude;
  /** A finished thread hollows out to a ring in its family's color, so it reads in either mode. */
  const retire = motion().at(thread.last + 1).to({ fill: C.paper, stroke: tint }, 1);
  return (
    <g>
      <g transform={`translate(${x} ${y})`}>
        <Beacon thread={thread} />
        <rect x={-R - 7} y={-R - 7} width={2 * R + 14} height={2 * R + 14} fill="none" stroke={C.orange} strokeWidth={1.5} animation={pulse(flashes, 0.08)} />
        <circle
          r={R}
          fill={tint}
          stroke={C.ink}
          strokeWidth={2}
          animation={[enter({ at: thread.born, over: 0.5 }, { scale: 0 }, ease.pop), fades && retire]}
        />
      </g>
      <text x={x} y={y + R + 30} class="mono" fontSize={13} fill={C.muted} textAnchor="middle" animation={[enter({ at: thread.born + 0.2, over: 0.4 }), fades && motion().at(thread.last + 1).to({ opacity: 0.5 }, 1)]}>
        {thread.name}
      </text>
    </g>
  );
}

function Edge({ thread }: { thread: Thread }): SvgNode {
  const parent = position[thread.parent!]!;
  const [j, p] = [junction[thread.index]!, position[thread.index]!];
  const fork = { x: parent.x + STUB, y: parent.y };
  const dot = (at: Point) => el.rect({ x: at.x - 2.5, y: at.y - 2.5, width: 5, height: 5, fill: C.ink, animation: enter({ at: thread.born, over: 0.2 }) });
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

// Messages: a square runs the tree from sender to recipient, a fainter one on its heels.

const PACE = 420;

const flights = messages.map((message) => {
  const path = between(message.from, message.to);
  const legs = path.slice(1).map((point, i) => ({ point, length: Math.hypot(point.x - path[i]!.x, point.y - path[i]!.y) }));
  const total = legs.reduce((sum, leg) => sum + leg.length, 0);
  const over = Math.min(0.9, Math.max(0.35, total / PACE));
  const list = arrivals.get(message.to) ?? [];
  list.push(message.t + over);
  arrivals.set(message.to, list);
  return { ...message, path, legs, total, over };
});

const fly = (flight: (typeof flights)[number], delay: number): Motion<"opacity" | "x" | "y"> => {
  const [start] = flight.path;
  const track = flight.legs.reduce<Motion<"opacity" | "x" | "y">>(
    (track, leg) => track.to({ x: leg.point.x, y: leg.point.y }, (flight.over * leg.length) / flight.total, ease.linear),
    motion({ opacity: 0, x: start!.x, y: start!.y }).at(flight.t + delay).set({ opacity: 1 }),
  );
  return track.set({ opacity: 0 });
};

function Messages(): SvgNode {
  return (
    <g fill={C.orange}>
      {flights.map((flight) => [
        el.rect({ x: -2.5, y: -2.5, width: 5, height: 5, opacity: 0.45, animation: fly(flight, 0.07) }),
        el.rect({ x: -4, y: -4, width: 8, height: 8, animation: fly(flight, 0) }),
      ])}
    </g>
  );
}

// HUD.

/** Swaps text at each time; consecutive repeats collapse. */
function Ticker({ x, y, values }: { x: number; y: number; values: readonly (readonly [number, string])[] }): SvgNode {
  const steps = values.filter(([t, text], i) => (values[i + 1]?.[0] ?? Infinity) > t && text !== values[i - 1]?.[1]);
  return (
    <g class="mono hud" fill={C.muted}>
      {steps.map(([t, text], i) => {
        const next = steps[i + 1]?.[0];
        let track: Fade = t <= 0 ? motion({ opacity: 1 }) : motion({ opacity: 0 }).at(t).set({ opacity: 1 });
        if (next !== undefined) track = track.at(next).set({ opacity: 0 });
        return el.text({ x, y, animation: track }, text);
      })}
    </g>
  );
}

const two = (n: number) => String(n).padStart(2, "0");

const counted = (pick: (thread: Thread) => boolean) =>
  [[0, "00"] as const, ...graph.map((thread) => [thread.born, two(graph.filter((other) => other.born <= thread.born && pick(other)).length)] as const)];

const active = (() => {
  const edges = graph.flatMap((thread) => merge(thread.runs, 0.3).flatMap(([a, b]) => [[a, 1], ...(b < end ? [[b, -1]] : [])] as [number, number][]));
  edges.sort((a, b) => a[0] - b[0]);
  let count = 0;
  return [[0, "00"] as const, ...edges.map(([t, delta]) => [t, two((count += delta))] as const)];
})();

const ADV = advance(11);
const LINE = 14;

function Wheel({ x, y, labels, period }: { x: number; y: number; labels: readonly string[]; period: number }): SvgNode {
  const window = def.clipPath({}, el.rect({ x, y: y - LINE + 3, width: ADV * labels[0]!.length, height: LINE }));
  return el.g(
    { clipPath: window },
    el.g(
      { animation: motion({ y: 0 }).to({ y: -labels.length * LINE }, period, ease.steps(labels.length)).loop(period) },
      [...labels, labels[0]!].map((label, k) => el.text({ x, y: y + k * LINE }, label)),
    ),
  );
}

const digits = (count: number) => Array.from({ length: count }, (_, k) => String(k));

/** Scene seconds times SPEED, as T+HH:MM:SS. */
function Clock({ x, y }: { x: number; y: number }): SvgNode {
  const hour = 3600 / SPEED;
  const cells: [string, number, string[] | string][] = [
    ["T+0", 0, "T+0"],
    ["h", 3, digits(Math.round(D / hour))],
    [":", 4, ":"],
    ["m10", 5, digits(6)],
    ["m1", 6, digits(10)],
    [":", 7, ":"],
    ["s10", 8, digits(6)],
    ["s1", 9, digits(10)],
  ];
  const periods: Record<string, number> = { h: D, m10: hour, m1: hour / 6, s10: hour / 60, s1: hour / 360 };
  return (
    <g class="mono hud" fill={C.muted}>
      {cells.map(([key, column, labels]) =>
        typeof labels === "string" ? el.text({ x: x + column * ADV, y }, labels) : <Wheel x={x + column * ADV} y={y} labels={labels} period={periods[key]!} />,
      )}
    </g>
  );
}

function Corners(): SvgNode {
  const [m, s] = [12, 12];
  const corners = [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - 60, 1, -1],
    [W - m, H - 60, -1, -1],
  ] as const;
  return (
    <g fill="none" stroke={C.ink} strokeWidth={1}>
      {corners.map(([x, y, h, v]) => el.path({ d: `M${x} ${y + v * s}V${y}H${x + h * s}` }))}
    </g>
  );
}

function Ruler(): SvgNode {
  const ticks = Array.from({ length: Math.floor((W - 48) / 30) + 1 }, (_, i) => 24 + i * 30);
  return <g stroke={C.faint}>{ticks.map((x, i) => el.line({ x1: x, y1: 38, x2: x, y2: i % 6 === 0 ? 46 : 41 }))}</g>;
}

function Barcode({ x, y }: { x: number; y: number }): SvgNode {
  let cursor = x;
  const bars: SvgNode[] = [];
  for (let i = 0; cursor < x + 96; i++) {
    const width = 1 + (Math.floor(Math.abs(Math.sin(i * 7.3) * 10)) % 2);
    bars.push(el.rect({ x: cursor, y, width, height: 10 }));
    cursor += width + 2 + (Math.floor(Math.abs(Math.cos(i * 3.1) * 10)) % 2);
  }
  return <g fill={C.ink}>{bars}</g>;
}

function Hud(): SvgNode {
  const stats = H - 72;
  const bar = H - 25;
  const track = { x: 180, w: W - 270 };
  const families = (family: Thread["family"]) => counted((thread) => thread.family === family);
  return (
    <>
      <Corners />
      <Ruler />
      <rect x={24} y={17} width={9} height={9} fill={C.orange} />
      <text x={40} y={26} class="mono" fontSize={11} fontWeight={600} fill={C.ink}>
        LIGHTHOUSE
      </text>
      <text x={40 + 11 * ADV + 10} y={26} class="mono" fontSize={11} fill={C.muted}>
        {`// TIMELAPSE ${SPEED}×`}
      </text>
      <Clock x={W - 24 - 11 * ADV} y={26} />

      <g class="mono hud" fill={C.muted}>
        <text x={24} y={stats}>NODES</text>
        <text x={110} y={stats}>ACTIVE</text>
        <text x={204} y={stats}>LINKS</text>
        <text x={290} y={stats}>ZOOM</text>
      </g>
      <Ticker x={24 + 6 * ADV} y={stats} values={counted(() => true)} />
      <Ticker x={110 + 7 * ADV} y={stats} values={active} />
      <Ticker x={204 + 6 * ADV} y={stats} values={counted((thread) => thread.parent !== undefined)} />
      <Ticker x={290 + 5 * ADV} y={stats} values={shots.map(({ at, view }) => [at, `${Math.round(view.scale * 100)}%`] as const)} />

      <circle cx={W - 300} cy={stats - 4} r={5} fill={C.claude} stroke={C.ink} />
      <text x={W - 288} y={stats} class="mono" fontSize={11} fill={C.muted}>CLAUDE</text>
      <Ticker x={W - 288 + 7 * ADV} y={stats} values={families("claude")} />
      <circle cx={W - 210} cy={stats - 4} r={5} fill={C.gpt} stroke={C.ink} />
      <text x={W - 198} y={stats} class="mono" fontSize={11} fill={C.muted}>GPT</text>
      <Ticker x={W - 198 + 4 * ADV} y={stats} values={families("gpt")} />
      <Barcode x={W - 120} y={stats - 9} />

      <line x1={0} y1={H - 48} x2={W} y2={H - 48} stroke={C.ink} />
      <rect x={24} y={bar - 11} width={58} height={22} fill="none" stroke={C.ink} />
      <text x={53} y={bar + 4} class="mono" fontSize={11} fontWeight={600} fill={C.ink} textAnchor="middle">
        PLAY
      </text>
      <rect x={92} y={bar - 11} width={62} height={22} fill="none" stroke={C.ink} />
      <text x={123} y={bar + 4} class="mono" fontSize={11} fontWeight={600} fill={C.ink} textAnchor="middle">
        {`${SPEED}×`}
      </text>
      <line x1={track.x} y1={bar} x2={track.x + track.w} y2={bar} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
      <line x1={track.x} y1={bar} x2={track.x + track.w} y2={bar} stroke={C.orange} strokeWidth={6} strokeLinecap="round" animation={draw({ at: 0, over: D }, ease.linear)} />
      <circle cx={track.x} cy={bar} r={7} fill={C.orange} animation={motion({ x: 0 }).to({ x: track.w }, D, ease.linear)} />
      <text x={W - 24} y={bar + 4} class="mono" fontSize={11} fill={C.ink} textAnchor="end">
        {`${D} s`}
      </text>
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
      return el.rect({ x: r(1) * 97, y: r(2) * 97, width: 1, height: 1, opacity: 0.04 + r(3) * 0.08 });
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
      css: `${THEME}\n.mono{font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace}.hud{font-size:11px}.label{font-size:${LABEL.size}px;font-weight:600}`,
      comment: "Generated by svjeez. Edit examples/lighthouse/index.tsx instead of this file.",
    },
    <>
      <rect width={W} height={H} fill={C.paper} />
      <rect width={W} height={H} fill={grain} />
      <g style="transform-box:view-box;transform-origin:0 0" animation={camera}>
        <g animation={motion().at(D - 0.6).to({ opacity: 0 }, 0.5)}>
          {graph.filter((thread) => thread.parent !== undefined).map((thread) => (
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
