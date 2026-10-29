<script lang="ts">
  import { fit } from "svjeez/params";
  import { clamp } from "../util";
  import { drag } from "./attach";
  import { COLORS } from "./feel";
  import Instrument from "./Instrument.svelte";
  import { getLab } from "./feel-state.svelte";
  import { spring } from "./physics";
  import { params } from "./scene";

  const AX = 58;
  const REST = 104;
  const PX = 70;
  const T0 = 124;
  const T1 = 252;
  const SPAN = 1.6;
  const MID = 96;
  const AMP = 95;
  const SAMPLES = Array.from({ length: 161 }, (_, i) => (i / 160) * SPAN);

  const lab = getLab();
  const feel = $derived(lab.feel);

  let now = $state(0);
  let plucked = $state(0);
  let held = $state<number>();

  const tx = (s: number) => T0 + (s / SPAN) * (T1 - T0);
  const line = (points: string[]) => points.map((p, i) => `${i ? "L" : "M"}${p}`).join("");

  const tau = $derived((now - plucked) / 1000);
  const s = $derived(held ?? (tau < SPAN + 0.6 ? spring(Math.min(tau, SPAN), feel) : 0));
  const cy = $derived(REST + s * PX);
  const w = $derived(40 * (1 + 0.8 * s));
  const h = $derived(32 * (1 - s));

  const coil = $derived.by(() => {
    const loops = Math.round(5 + feel.hz * 1.4);
    const top = 14;
    const bottom = cy - h / 2;
    const pts = [`${AX},${top}`];

    for (let i = 1; i < loops * 2; i++)
      pts.push(`${AX + (i % 2 ? 13 : -13)},${top + ((bottom - top) * i) / (loops * 2)}`);
    pts.push(`${AX},${bottom}`);

    return pts.join(" ");
  });

  const trace = $derived(
    line(SAMPLES.map((t) => `${tx(t).toFixed(1)} ${(MID + spring(t, feel) * AMP).toFixed(1)}`)),
  );

  const envelope = $derived.by(() => {
    const e = (t: number) =>
      feel.squash * Math.exp(-feel.damping * 2 * Math.PI * feel.hz * t) * AMP;

    return (
      line(SAMPLES.map((t) => `${tx(t).toFixed(1)} ${(MID - e(t)).toFixed(1)}`)) +
      line(SAMPLES.map((t) => `${tx(t).toFixed(1)} ${(MID + e(t)).toFixed(1)}`))
    );
  });

  const w0 = $derived(2 * Math.PI * feel.hz);
  const half = $derived(Math.PI / (w0 * Math.sqrt(1 - feel.damping ** 2)));
  const periodX = $derived(tx(Math.min(half, SPAN)));
  const periodY = $derived(MID + spring(half, feel) * AMP);
  const decayY = $derived(MID + feel.squash * Math.exp(-feel.damping * w0 * 0.5) * AMP);
  const penning = $derived(held === undefined && tau < SPAN);

  const pluck = () => (plucked = performance.now());

  const frame = (t: number) => {
    now = t;

    if ((t - plucked) / 1000 > 3.2 && held === undefined) plucked = t;
  };

  const weight = drag({
    move: (p) => {
      held = fit(params.squash, (p.y - REST) / PX);
      lab.update({ squash: held });
    },
    end: () => {
      held = undefined;
      pluck();
    },
  });

  const period = drag({
    move: (p) => {
      const half = clamp((p.x - T0) / (T1 - T0), 0.04, 0.7) * SPAN;
      lab.update({ hz: 1 / (2 * half * Math.sqrt(1 - feel.damping ** 2)) });
      pluck();
    },
  });

  const decay = drag({
    move: (p) => {
      const e = clamp((p.y - MID) / AMP, feel.squash * 0.002, feel.squash * 0.97);
      lab.update({ damping: -Math.log(e / feel.squash) / (2 * Math.PI * feel.hz * 0.5) });
      pluck();
    },
  });

  const nudge = (patch: () => Partial<typeof feel>) => () => {
    lab.update(patch());
    pluck();
  };

  const keys = {
    ArrowUp: nudge(() => ({ squash: feel.squash - 0.02 })),
    ArrowDown: nudge(() => ({ squash: feel.squash + 0.02 })),
    ArrowLeft: nudge(() => ({ hz: feel.hz - 0.2 })),
    ArrowRight: nudge(() => ({ hz: feel.hz + 0.2 })),
  };
</script>

<Instrument
  name="spring"
  title="Landing"
  hint="Pull the gummy down to set the squash. Drag the wave’s first dip for stiffness, its tail for damping."
  box="0 0 260 190"
  readout="squash {feel.squash.toFixed(2)}"
  tall
  {keys}
  {frame}
>
  <rect x={AX - 26} y="8" width="52" height="6" rx="3" class="ink-fill" />
  <polyline class="coil" points={coil} />
  <g class="grab" {@attach weight}>
    <rect fill={COLORS[0]} rx="12" x={AX - w / 2} y={cy - h / 2} width={w} height={h} />
    <circle r="2.6" class="eye" cx={AX - 7} cy={cy - h * 0.12} />
    <circle r="2.6" class="eye" cx={AX + 7} cy={cy - h * 0.12} />
  </g>
  <line x1={T0} x2={T1} y1={MID} y2={MID} class="axis" />
  <path class="envelope" d={envelope} />
  <path class="trace" d={trace} />
  <circle r="4" fill={COLORS[0]} cx={tx(tau)} cy={MID + s * AMP} opacity={penning ? 1 : 0} />
  <circle r="9" class="knob" cx={periodX} cy={periodY} {@attach period} />
  <circle r="9" class="knob" cx={tx(0.5)} cy={decayY} {@attach decay} />
  <text class="tiny" text-anchor="middle" x={periodX} y={periodY - 14}>{feel.hz.toFixed(1)} Hz</text>
  <text class="tiny" text-anchor="middle" x={tx(0.5)} y={decayY + 22}>damping {feel.damping.toFixed(2)}</text>
</Instrument>

<style>
  .coil {
    fill: none;
    stroke: var(--wire);
    stroke-width: 2.2;
    stroke-linejoin: round;
  }

  .eye {
    fill: #1b1b2f;
  }

  .envelope {
    fill: none;
    stroke: var(--muted);
    stroke-dasharray: 3 3;
    stroke-width: 1;
  }
</style>
