<script lang="ts">
  import { ease, easeAt } from "svjeez";
  import { clamp } from "../util";
  import { drag } from "./attach";
  import { COLORS } from "./feel";
  import Instrument from "./Instrument.svelte";
  import { getLab } from "./feel-state.svelte";
  import { spring } from "./physics";

  const X0 = 22;
  const Y0 = 48;
  const S = 136;
  const LANE = 214;
  const STEPS = Array.from({ length: 11 }, (_, k) => k);

  const px = (x: number) => X0 + x * S;
  const py = (y: number) => Y0 + y * S;

  const lab = getLab();
  const feel = $derived(lab.feel);
  const fall = $derived(feel.fall);

  /** The fall's control points. A param of its own kind holds any ease, so a non-bezier one reads as linear. */
  const points = $derived(fall.kind === "bezier" ? fall.points : ([0, 0, 1, 1] as const));
  const [x1, y1, x2, y2] = $derived(points);

  let now = $state(0);

  const samples = $derived(STEPS.map((k) => ({ k, x: px(k / 10), y: py(easeAt(fall, k / 10)) })));

  const beat = $derived(60 / feel.bpm);
  const t = $derived(((now / 1000) % (beat + 0.7)) / beat);
  const p = $derived(Math.min(t, 1));
  const v = $derived(easeAt(fall, p));
  const landed = $derived(t >= 1 ? spring((t - 1) * beat, feel) : 0);
  const dropW = $derived(24 * (1 + 0.8 * landed));
  const dropH = $derived(22 * (1 - landed));

  const handle = (i: 0 | 1) =>
    drag({
      move: (pt) => {
        const next: [number, number, number, number] = [...points];
        next[i * 2] = Number(clamp((pt.x - X0) / S, 0, 1).toFixed(2));
        next[i * 2 + 1] = Number(clamp((pt.y - Y0) / S, -0.35, 1.35).toFixed(2));
        lab.update({ fall: ease.bezier(...next) });
      },
    });

  const nudge = (i: number, d: number) => () => {
    const next: [number, number, number, number] = [...points];
    next[i] = Number(clamp(next[i]! + d, i % 2 ? -0.35 : 0, i % 2 ? 1.35 : 1).toFixed(2));
    lab.update({ fall: ease.bezier(...next) });
  };

  const keys = {
    ArrowLeft: nudge(0, -0.02),
    ArrowRight: nudge(0, 0.02),
    ArrowUp: nudge(1, -0.02),
    ArrowDown: nudge(1, 0.02),
  };
</script>

<Instrument
  name="ease"
  title="Fall"
  hint="Drag the two handles. The dots are the fall sampled at even times: bunched means slow."
  box="0 0 260 210"
  readout="{x1}, {y1}, {x2}, {y2}"
  tall
  {keys}
  frame={(t) => (now = t)}
>
  <rect x={X0} y={Y0} width={S} height={S} class="pad" />
  <text x={X0} y={Y0 - 8} class="tiny">apex</text>
  <text x={X0} y={Y0 + S + 16} class="tiny">ground</text>
  <text x={X0 + S} y={Y0 + S + 16} class="tiny" text-anchor="end">time →</text>
  <path
    class="arm"
    d="M{px(0)} {py(0)}L{px(x1)} {py(y1)}M{px(1)} {py(1)}L{px(x2)} {py(y2)}"
  />
  <g>
    {#each samples as { k, x, y } (k)}
      <circle r="2.2" class="strobe" cx={x} cy={y} />
    {/each}
  </g>
  <path
    class="trace"
    d="M{px(0)} {py(0)}C{px(x1)} {py(y1)} {px(x2)} {py(y2)} {px(1)} {py(1)}"
  />
  <circle r="5.5" fill={COLORS[1]} cx={px(p)} cy={py(v)} />
  <line x1={LANE} x2={LANE} y1={Y0} y2={Y0 + S + 2} class="axis" />
  <g>
    {#each samples as { k, y } (k)}
      <line class="strobe-line" x1={LANE - 8} x2={LANE + 8} y1={y} y2={y} />
    {/each}
  </g>
  <rect fill={COLORS[1]} rx="7" x={LANE - dropW / 2} y={py(v) - dropH} width={dropW} height={dropH} />
  <circle r="9" class="knob" cx={px(x1)} cy={py(y1)} {@attach handle(0)} />
  <circle r="9" class="knob" cx={px(x2)} cy={py(y2)} {@attach handle(1)} />
</Instrument>

<style>
  .pad {
    fill: var(--sunken);
    stroke: var(--line);
  }

  .arm {
    stroke: var(--muted);
    stroke-width: 1.2;
  }

  .strobe {
    fill: var(--muted);
  }

  .strobe-line {
    stroke: var(--muted);
    stroke-width: 1.4;
  }
</style>
