<script lang="ts">
  import { drag } from "./attach";
  import Instrument from "./Instrument.svelte";
  import { getLab } from "./feel-state.svelte";

  const PX = 90;
  const PY = 196;
  const BPMS = [60, 80, 100, 120, 140, 160, 180, 200];

  const rOf = (bpm: number) => 150 - ((bpm - 50) / 150) * 100;

  const lab = getLab();
  const feel = $derived(lab.feel);

  let holding = $state(false);
  let angle = $state(0);
  let phase = 0;
  let pulses = $state(0);

  const flash = (el: SVGElement) => {
    if (pulses > 0)
      el.animate(
        [
          { opacity: 1, r: 9 },
          { opacity: 0, r: 4 },
        ],
        { duration: 260 },
      );
  };

  const y = $derived(PY - rOf(feel.bpm));

  const frame = (_: number, dt: number) => {
    const before = Math.floor(phase);
    phase += (dt / 1000) * (feel.bpm / 60);

    if (Math.floor(phase) !== before && !holding) pulses++;
    const target = holding ? 0 : 24 * Math.sin(Math.PI * phase);
    angle += (target - angle) * (holding ? 0.2 : 1);
  };

  const bob = drag({
    start: () => (holding = true),
    move: (p) => {
      lab.update({ bpm: 50 + ((150 - (PY - p.y)) / 100) * 150 });
    },
    end: () => (holding = false),
  });

  const keys = {
    ArrowUp: () => lab.update({ bpm: feel.bpm - 2 }),
    ArrowDown: () => lab.update({ bpm: feel.bpm + 2 }),
  };
</script>

<Instrument
  name="tempo"
  title="Tempo"
  hint="Slide the weight. Higher on the rod swings slower, as on a real metronome."
  box="0 0 180 220"
  readout="{feel.bpm} bpm"
  {keys}
  {frame}
>
  <path d="M26 214L154 214L118 12L62 12Z" class="case" />
  <path d="M62 214L118 214L110 172L70 172Z" class="case-dark" />
  {#each BPMS as bpm (bpm)}
    <line x1={PX + 9} x2={PX + 15} y1={PY - rOf(bpm)} y2={PY - rOf(bpm)} class="scale" />
    <text x={PX + 18} y={PY - rOf(bpm) + 3} class="tiny scale-text">{bpm}</text>
  {/each}
  <g transform="rotate({angle.toFixed(2)} {PX} {PY})">
    <line x1={PX} y1={PY} x2={PX} y2={PY - 172} class="rod" />
    <path
      class="bob grab"
      d="M{PX - 13} {y - 8}L{PX + 13} {y - 8}L{PX + 9} {y + 8}L{PX - 9} {y + 8}Z"
      {@attach bob}
    />
  </g>
  <circle cx={PX} cy={PY} r="4" class="ink-fill" />
  <circle cx={PX} cy="26" r="6" class="tick" {@attach flash} />
</Instrument>

<style>
  .case {
    fill: var(--wood);
  }

  .case-dark {
    fill: var(--wood-dark);
  }

  .scale {
    stroke: oklch(100% 0 none / 0.7);
  }

  .scale-text {
    fill: oklch(100% 0 none / 0.85);
    font-size: 8.5px;
  }

  .rod {
    stroke: var(--ink);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .bob {
    fill: var(--ink);
  }

  .tick {
    fill: var(--hot);
    opacity: 0;
  }
</style>
