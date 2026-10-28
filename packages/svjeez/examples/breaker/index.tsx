import { def, ease, motion, rect, render } from "svjeez";
import {
  Callout,
  Focus,
  code,
  during,
  flow,
  flowchart,
  lanes,
  morph,
  sequence,
  stateMachine,
  timeline,
  reveal,
  visible,
  appWindow,
  type CodePiece,
  type CodeRole,
  type CodeTokens,
} from "svjeez/extras";
import { css, mono, theme } from "../style";

const W = 1280;
const H = 720;

/** Just enough TypeScript highlighting for the slides. `«id:text»` names a run. */
const highlight = (source: string): CodeTokens =>
  source.split("\n").map((line) =>
    [...line.matchAll(/«(\w[\w-]*):([^»]+)»|(\/\/.*)|("[^"]*")|\b(class|async|await|if|try|catch|throw|return|new|const|this)\b|\b(\d[\d_]*)\b|\b([A-Z]\w*)\b|(\w+)(?=\()|([{}()[\];:.,=<>+!&|]+)|([^«/"\w{}()[\];:.,=<>+!&|]+|\w+)/g)].map((m): CodePiece => {
      const [, id, named, comment, str, kw, num, type, fn, punct, rest] = m;
      const role: CodeRole | undefined = comment ? "comment" : str ? "string" : kw ? "keyword" : num ? "number" : type ? "type" : fn ? "fn" : punct ? "punct" : undefined;
      if (id) return ["fn", named!, id];
      return role ? [role, m[0]] : (rest ?? m[0]);
    }),
  );

const v1 = `class Breaker {
  state: State = "closed";
  failures = 0;

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() < this.retryAt) throw new OpenError();
      this.state = "half-open";
    }
    try {
      const result = await fn();
      this.state = "closed";
      this.failures = 0;
      return result;
    } catch (error) {
      if (++this.failures >= 3 || this.state === "half-open") this.«trip:trip»();
      throw error;
    }
  }

  trip() {
    this.state = "open";
    this.retryAt = Date.now() + «wait:30_000»;
  }
}`;

const v2 = v1
  .replace("failures = 0;\n\n", "failures = 0;\n  trips = 0;\n\n")
  .replace("this.failures = 0;\n", "this.failures = 0;\n      this.trips = 0;\n")
  .replace("«wait:30_000»", "«wait:backoff»(this.trips++)");

const scenes = {
  title: 5,
  code: 11,
  machine: 9,
  together: 15,
  timeline: 9,
  backoff: 8,
  recap: 8,
};
const tl = timeline(scenes, { gap: 0.6 });
const names = Object.keys(scenes) as (keyof typeof scenes)[];
const D = Math.ceil(tl.duration + 1);

const STAGE = rect(0, 0, W, H - 70);
/** Every slide's heading, in the same place. */
const Heading = ({ scene, children }: { readonly scene: keyof typeof scenes; readonly children: string }) => (
  <text x={64} y={78} class="sans" fontSize={30} fontWeight={600} fill={theme.base05} animation={tl.show(scene)}>
    {children}
  </text>
);

// --- code: the skeleton, then each member a block at a time, then its two halves called out
const TOP = 110;
const BAR_H = 40;
const listing = (source: string) => code(highlight(source), { x: 88, y: TOP + BAR_H + 14, fontSize: 13, lineHeight: 1.4, theme, font: mono, gutter: true });
const editorFor = (c: ReturnType<typeof code>) => appWindow(rect(64, TOP, 760, c.bounds.y + c.bounds.h + 16 - TOP), { theme, title: "breaker.ts", bar: BAR_H });
const source = listing(v1);
const editor = editorFor(source);
const beat = timeline({ build: 3.8, guard: 3, trip: 3 }, { at: tl.code.at + 0.6, gap: 0.2 });
const shown = reveal(source, { at: beat.build.at, blocks: [[2, 3], [5, 9], [10, 19], [21, 24]], step: 0.8 });

// --- machine: the four states, walked once
const machineSpec = {
  states: {
    closed: "Closed",
    open: "Open",
    half: "Half-open",
  },
  initial: "closed",
  transitions: [
    ["closed", "open", "3 failures"],
    ["open", "half", "retryAt passed"],
    ["half", "closed", "success"],
    ["half", "open", "failure"],
  ],
} as const;
const machine = stateMachine(machineSpec, { theme, fontSize: 15, font: mono, x: 820, y: 130, anchor: "top" });
const walk = machine.walk(["closed", "open", "half", "open", "half", "closed"], { at: tl.machine.at + 0.8, dwell: 0.9, token: { style: "comet" } });

// --- together: a sequence on the left, the machine beside it lighting as messages land
const story = sequence(
  {
    actors: { client: { label: "Client", role: "input" }, breaker: { label: "Breaker", role: "tool" }, service: { label: "Quotes API", role: "store" } },
    messages: [
      ["client", "breaker", "call()"],
      ["breaker", "service", "GET /quote"],
      ["service", "breaker", "timeout", { reply: true }],
      { note: "breaker", text: "3rd failure: trip" },
      ["client", "breaker", "call()"],
      ["breaker", "client", "OpenError", { reply: true }],
      { note: "breaker", text: "30s later" },
      ["client", "breaker", "call()"],
      ["breaker", "service", "probe"],
      ["service", "breaker", "200", { reply: true }],
      ["breaker", "client", "quote", { reply: true }],
    ],
  },
  {
    theme,
    fontSize: 14,
    font: mono,
    x: 64,
    y: 120,
    /** The wait before the probe gets its own pause. */
    play: { at: [0, 1, 2, 3, 4.4, 5.4, 6.6, 8.6, 9.6, 10.6, 11.6].map((t) => tl.together.at + 0.6 + t) },
  },
);
const mini = stateMachine(machineSpec, { theme, fontSize: 14, font: mono, x: 760, y: 150 });
const msg = (i: number) => story.message(i).span.at;
const synced = mini.walk(["closed", "open", "half", "closed"], { at: [tl.together.at, msg(3), msg(7), msg(10)], dwell: tl.together.at + tl.together.over - msg(10) });

// --- timeline: the same story on a clock
const zero = tl.timeline.at + 0.5;
const clock = lanes(
  {
    lanes: { client: { label: "client", role: "input" }, breaker: { label: "breaker", role: "tool" }, service: { label: "service", role: "store" } },
    spans: [
      { lane: "breaker", from: 0, to: 3, label: "closed", role: "input" },
      { lane: "breaker", from: 3, to: 6, label: "open", role: "tool" },
      { lane: "breaker", from: 6, to: 6.8, label: "half", role: "decision" },
      { lane: "breaker", from: 6.8, to: 8, label: "closed", role: "input" },
      { lane: "service", from: 0.2, to: 3, label: "down", role: "tool" },
    ],
    events: [
      { lane: "service", at: 1, label: "timeout" },
      { lane: "service", at: 2, label: "timeout" },
      { lane: "service", at: 3, label: "timeout" },
      { lane: "client", at: 4, label: "OpenError" },
      { lane: "client", at: 5, label: "OpenError" },
      { lane: "service", at: 6.4 },
      { lane: "client", at: 6.9, label: "quote" },
    ],
    links: [
      { from: "client", to: "breaker", at: 0.5 },
      { from: "client", to: "breaker", at: 1.5 },
      { from: "client", to: "breaker", at: 2.5 },
      { from: "breaker", to: "client", at: 4 },
      { from: "breaker", to: "client", at: 5 },
      { from: "breaker", to: "service", at: 6.4 },
      { from: "breaker", to: "client", at: 6.9 },
    ],
  },
  { theme, fontSize: 14, font: mono, scale: 120, x: 64, y: 170, play: { at: zero } },
);
const captions = [
  [0, 3, "Closed: every call waits out the timeout."],
  [3, 6, "Open: calls fail at once, the service gets a rest."],
  [6, 8, "Half-open: one probe succeeds, and traffic flows again."],
] as const;

// --- backoff: v1 morphs into v2
const before = listing(v1);
const after = listing(v2);
const change = tl.backoff.at + 1.5;
const morphed = morph([before, after], { at: [change], over: 1, gutter: true });

// --- recap: what call() does, as a flowchart with a request traced through it
const recapSpec = {
    nodes: {
      call: { label: "call(fn)", role: "input" },
      open: { label: "open?", role: "decision" },
      due: { label: "retry due?", role: "decision" },
      fail: { label: "throw OpenError", role: "output" },
      run: { label: "await fn()", role: "tool" },
      ok: { label: "close, reset", role: "task" },
      count: { label: "count failure", role: "task" },
    },
    edges: [
      ["call", "open"],
      ["open", "run", { label: "no" }],
      ["open", "due", { label: "yes" }],
      ["due", "fail", { label: "no" }],
      ["due", "run", { label: "yes" }],
      ["run", "ok", { label: "ok" }],
      ["run", "count", { label: "threw" }],
    ],
} as const;
const decide = flowchart(recapSpec, { theme, fontSize: 14, font: mono, x: W / 2, y: (STAGE.h + 40) / 2, anchor: "center", direction: "LR", play: { at: tl.recap.at + 0.3, step: 0.25 } });
const trips = [
  flow(decide.route("call", "fail"), { at: tl.recap.at + 2.6, over: 1.8, style: "packet", label: "call()", color: theme.base08, arrive: true }),
  flow(decide.route("call", "ok"), { at: tl.recap.at + 4.8, over: 1.8, style: "trace", color: theme.base0B, arrive: true }),
];

// --- chrome: progress bar and slide counter
const BAR = rect(64, H - 40, W - 128, 4);
const segment = (name: keyof typeof scenes) => {
  const { at, over } = tl[name];
  return rect(BAR.x + (at / tl.duration) * BAR.w, BAR.y, (over / tl.duration) * BAR.w, BAR.h);
};

const clip = def.clipPath({}, <rect x={editor.body.x} y={editor.body.y} width={editor.body.w} height={editor.body.h} />);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Circuit breakers",
      desc: "A seven-slide explainer: a circuit breaker's code shown block by block, its state machine walked, a sequence diagram synced to the machine, the story on a time axis, a refactor to backoff, and a flowchart traced.",
      reducedMotion: { at: tl.together.at + tl.together.over - 1 },
      css: [
        css,
        ".sans,.sans text{font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}",
      ].join("\n"),
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />

      <g animation={tl.show("title")} class="sans">
        <text x={W / 2} y={300} fontSize={64} fontWeight={700} textAnchor="middle" fill={theme.base05}>
          Circuit breakers
        </text>
        <text x={W / 2} y={350} fontSize={22} textAnchor="middle" fill={theme.base04}>
          Fail fast while a dependency is down, then check if it's back.
        </text>
        <path d={`M${W / 2 - 120} 390h240`} stroke={theme.base0A} strokeWidth={2} animation={motion({ draw: 0 }).at(0.6).to({ draw: 1 }, 1.2)} />
      </g>

      <Heading scene="code">The whole thing is one class</Heading>
      <g animation={tl.show("code")}>
        <g fontFamily={mono}>{editor.node}</g>
        <g clipPath={clip}>
          <Focus
            dim={0.3}
            stops={[
              { during: beat.guard, target: source.lines(6, 9).pad(2) },
              { during: beat.trip, target: [source.lines(15, 18).pad(2), source.lines(21, 24).pad(2)] },
            ]}
          >
            {shown.node}
          </Focus>
        </g>
        <g class="sans">
          <Callout target={source.lines(6, 9)} side="right" during={beat.guard} color={theme.base0A} fontSize={14} columns={22}>
            While open, refuse until retryAt, then let one call through.
          </Callout>
          <Callout target={source.get("trip")} side="right" during={beat.trip} color={theme.base08} fontSize={14} columns={22}>
            Three strikes, or any failure while half-open, trips it.
          </Callout>
        </g>
      </g>

      <Heading scene="machine">Three states, four transitions</Heading>
      <g animation={tl.show("machine")}>
        {machine.node}
        {walk.node}
        <g class="sans">
          {(["closed", "open", "half"] as const).map((s, i) => (
            <text x={96} y={220 + i * 60} fontSize={18} fill={theme.base04} animation={visible(walk.spans[s])}>
              {{ closed: "Calls pass through.", open: "Calls fail instantly.", half: "One probe decides." }[s]}
            </text>
          ))}
        </g>
      </g>

      <Heading scene="together">The same story, message by message</Heading>
      <g animation={tl.show("together")}>
        {story.node}
        {mini.node}
        {synced.node}
      </g>

      <Heading scene="timeline">Eight seconds, on a clock</Heading>
      <g animation={tl.show("timeline")}>
        {clock.node}
        {captions.map(([from, to, text]) => (
          <text x={clock.x(from)} y={clock.bounds.y + clock.bounds.h + 40} class="sans" fontSize={18} fill={theme.base05} animation={visible([{ at: zero + from, over: to - from }])}>
            {text}
          </text>
        ))}
      </g>

      <Heading scene="backoff">Backoff is a two-line change</Heading>
      <g animation={tl.show("backoff")}>
        <g fontFamily={mono}>{editorFor(after).node}</g>
        {morphed.node}
        <g class="sans">
          <Callout target={after.get("wait")} side="right" during={{ at: change + 1.3, over: 4 }} color={theme.base0B} fontSize={14} columns={22}>
            Each trip waits longer than the last.
          </Callout>
        </g>
      </g>

      <Heading scene="recap">call(), end to end</Heading>
      <g animation={tl.show("recap")}>
        {decide.layers.under}
        {trips.map((t) => t.node)}
        {decide.layers.over}
      </g>

      <g class="sans">
        <rect x={BAR.x} y={BAR.y} width={BAR.w} height={BAR.h} rx={2} fill={theme.base02} />
        <rect x={BAR.x} y={BAR.y} width={BAR.w} height={BAR.h} rx={2} fill={theme.base0A} animation={motion({ width: 0 }).to({ width: BAR.w }, tl.duration, ease.linear)} />
        {names.map((name, i) => {
          const s = segment(name);
          return (
            <>
              {i > 0 && <rect x={s.x - 1} y={BAR.y - 3} width={2} height={BAR.h + 6} fill={theme.base00} />}
              <text x={s.x + 2} y={BAR.y + 22} fontSize={12} fill={theme.base03}>
                {name}
              </text>
              <text x={s.x + 2} y={BAR.y + 22} fontSize={12} fill={theme.base05} animation={during(tl[name], 0.2)}>
                {name}
              </text>
              <text x={W - 64} y={BAR.y - 14} fontSize={12} textAnchor="end" fill={theme.base04} animation={during(tl[name], 0.2)}>
                {`${i + 1} / ${names.length}`}
              </text>
            </>
          );
        })}
      </g>
    </>,
  );
}
