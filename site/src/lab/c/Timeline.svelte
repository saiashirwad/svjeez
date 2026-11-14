<script lang="ts">
  import { getBench } from "./bench.svelte";
  import { DURATION, end, starts } from "./flight";
  import { legColor, pct, speedHills } from "./view";

  // The legs as blocks on a time ruler, each with a hill for how fast the plane goes through it.
  const bench = getBench();
  const flight = $derived(bench.flight);
  const legStarts = $derived(starts(flight));
  const hills = $derived(speedHills(flight));
  const landing = $derived(end(flight));
</script>

<div class="timeline">
  <div class="ruler" role="presentation" onpointerdown={bench.pressScrub}>
    {#each { length: DURATION + 1 }, s (s)}
      <span class="tick" style:inset-inline-start={pct(s)}>{s}s</span>
    {/each}
  </div>
  <div class="track" bind:this={bench.track}>
    <div class="block wait" style:inset-inline-start="0" style:inline-size={pct(flight.launch)}></div>
    {#each flight.legs as leg, i (i)}
      <div
        class={["block", { hot: bench.hot === i }]}
        role="presentation"
        style:--leg={legColor(i)}
        style:inset-inline-start={pct(legStarts[i]!)}
        style:inline-size={pct(leg.over)}
        onpointerdown={(event) => bench.pressBlock(event, i)}
        onpointerenter={() => bench.hoverBlock(i)}
        onpointerleave={bench.leaveLeg}
      >
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <path d={hills[i]} />
        </svg>
        <span class="label">{leg.over.toFixed(2)}s</span>
        <span
          class="edge"
          aria-hidden="true"
          onpointerdown={(event) => {
            event.stopPropagation();
            bench.pressBlock(event, i, true);
          }}
        ></span>
      </div>
    {/each}
    <div
      class="block wait"
      style:inset-inline-start={pct(landing)}
      style:inline-size={pct(DURATION - landing)}
    ></div>
    <div
      class="playhead"
      role="presentation"
      style:inset-inline-start={pct(bench.time)}
      onpointerdown={(event) => bench.pressScrub(event, false)}
    ></div>
  </div>
</div>

<style>
  .timeline {
    display: grid;
    gap: 0.25rem;
    padding-inline: calc(48 / 736 * 100%);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .ruler {
    position: relative;
    block-size: 1.4rem;
    cursor: ew-resize;
    border-block-end: 1px solid var(--line);
  }
  .tick {
    position: absolute;
    inset-block-end: 0;
    translate: -50% 0;
    padding-block-end: 0.2rem;
    font: 500 0.68rem / 1 var(--mono);
    color: var(--muted);
  }
  .tick::after {
    content: "";
    position: absolute;
    inset-inline-start: 50%;
    inset-block-end: -1px;
    block-size: 4px;
    border-inline-start: 1px solid var(--line);
  }
  .track {
    position: relative;
    block-size: 3.25rem;
    border-radius: 8px;
    background: var(--sunken);
    box-shadow: inset 0 0 0 1px var(--ring);
  }
  .block {
    position: absolute;
    inset-block: 3px;
    border-radius: 6px;
    background: color-mix(in oklch, var(--leg) 22%, var(--bg));
    box-shadow: inset 0 0 0 1.5px color-mix(in oklch, var(--leg) 70%, transparent);
    cursor: grab;
    overflow: clip;
  }
  .block.hot {
    background: color-mix(in oklch, var(--leg) 34%, var(--bg));
    box-shadow: inset 0 0 0 2px var(--leg);
  }
  .block svg {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
  }
  .block svg path {
    fill: color-mix(in oklch, var(--leg) 60%, transparent);
  }
  .label {
    position: absolute;
    inset-block-start: 3px;
    inset-inline-start: 6px;
    font: 600 0.66rem / 1 var(--mono);
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .edge {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    inline-size: 12px;
    cursor: ew-resize;
  }
  .edge::before {
    content: "";
    position: absolute;
    inset-block: 9px;
    inset-inline-end: 3px;
    inline-size: 3px;
    border-radius: 2px;
    background: var(--leg);
  }
  .wait {
    --leg: var(--muted);
    background: repeating-linear-gradient(
      135deg,
      transparent 0 5px,
      color-mix(in oklch, var(--ink) 7%, transparent) 5px 6px
    );
    box-shadow: none;
    cursor: default;
  }
  .playhead {
    position: absolute;
    inset-block: -1.9rem -4px;
    inline-size: 2px;
    translate: -1px 0;
    background: var(--ink);
    cursor: ew-resize;
  }
  .playhead::before {
    content: "";
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 50%;
    translate: -50% 0;
    inline-size: 12px;
    block-size: 12px;
    border-radius: 3px 3px 50% 50%;
    background: var(--ink);
  }
  .playhead::after {
    content: "";
    position: absolute;
    inset: 0 -10px;
  }
</style>
