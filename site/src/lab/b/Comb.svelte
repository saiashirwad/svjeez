<script lang="ts">
  import { fit } from "svjeez/params";
  import { drag } from "./attach";
  import { COLORS } from "./feel";
  import Instrument from "./Instrument.svelte";
  import { params } from "./scene";
  import { getLab } from "./feel-state.svelte";

  const X0 = 16;
  const BEAT = 29;
  const TOP = 22;
  const ROW = 24;
  const GRID = Array.from({ length: 9 }, (_, b) => b);

  const bx = (b: number) => X0 + b * BEAT;

  const lab = getLab();
  const feel = $derived(lab.feel);

  let beats = $state(0);
  let anchor = 0;

  const launches = $derived(
    COLORS.map((_, i) => 0.75 + (feel.stagger < 0 ? COLORS.length - 1 - i : i) * Math.abs(feel.stagger)),
  );

  const readout = $derived(
    feel.stagger === 0
      ? "all at once"
      : `${Math.abs(feel.stagger).toFixed(2)} beat ${feel.stagger < 0 ? "←" : "→"}`,
  );

  const shift = (d: number) => () =>
    lab.update({ stagger: feel.stagger + d });

  const grip = drag({
    start: () => (anchor = feel.stagger),
    move: (p, from) => {
      const s = fit(params.stagger, anchor + (p.x - from.x) / (BEAT * 4));

      // Near zero snaps to all at once.
      lab.update({ stagger: Math.abs(s) < 0.02 ? 0 : s });
    },
  });
</script>

<Instrument
  name="comb"
  title="Rhythm"
  hint="Drag sideways to fan the hops out. Drag past straight and they run the other way."
  box="0 0 260 162"
  {readout}
  keys={{ ArrowLeft: shift(-0.05), ArrowRight: shift(0.05) }}
  frame={(_, dt) => (beats = (beats + (dt / 1000) * (feel.bpm / 60)) % 8)}
>
  {#each GRID as b (b)}
    <line
      x1={bx(b)}
      x2={bx(b)}
      y1={TOP - 10}
      y2={TOP + ROW * 5}
      class={b % 4 ? "beat" : "bar"}
    />
    {#if b < 8}
      <text x={bx(b) + 3} y={TOP + ROW * 5 + 12} class="tiny">{b + 1}</text>
    {/if}
  {/each}
  <line
    class="spine"
    x1={bx(launches[0]!)}
    y1={TOP + ROW / 2}
    x2={bx(launches[4]!)}
    y2={TOP + ROW * 4.5}
  />
  {#each COLORS as fill, i (fill)}
    {@const b = launches[i]!}
    {@const air = beats >= b && beats < b + 2 ? Math.sin(((beats - b) / 2) * Math.PI) : 0}
    <g>
      <rect
        x={bx(b)}
        width={2 * BEAT}
        y={TOP + i * ROW + 3}
        height={ROW - 6}
        rx={(ROW - 6) / 2}
        {fill}
        opacity="0.28"
      />
      <circle cx={bx(b)} cy={TOP + i * ROW + ROW / 2 - air * 7} r={6.5 + air * 2} {fill} />
    </g>
  {/each}
  <line class="playhead" x1={bx(beats)} x2={bx(beats)} y1={TOP - 10} y2={TOP + ROW * 5} />
  <rect x="0" y="0" width="260" height="170" fill="transparent" class="grab-x" {@attach grip} />
</Instrument>

<style>
  .beat,
  .bar {
    stroke: var(--line);
    stroke-width: 1;
  }

  .bar {
    stroke: var(--muted);
    stroke-dasharray: 2 3;
  }

  .spine {
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }

  .playhead {
    stroke: var(--hot);
    stroke-width: 1.5;
  }
</style>
