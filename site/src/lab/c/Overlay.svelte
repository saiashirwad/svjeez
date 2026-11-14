<script lang="ts">
  import { clamp } from "../util";
  import { getBench } from "./bench.svelte";
  import { end, fly, HEIGHT, points, route, WIDTH } from "./flight";
  import { fmt, ghostTimes, legColor, trailPath } from "./view";

  // The whole flight at once: a trail per leg, a dot every twelfth of a second, a handle on each point.
  const bench = getBench();

  // Overlay units per CSS pixel, so handles and labels keep their size on a phone.
  let width = $state(736);
  const scale = $derived(Math.max(1, 736 / Math.max(1, width)));

  const pts = $derived(points(bench.flight));
  const path = $derived(route(bench.flight));
  const ghosts = $derived(ghostTimes(bench.flight).map((t) => fly(bench.flight, t)));
  const plane = $derived(fly(bench.flight, bench.time));
  const flying = $derived(bench.time >= bench.flight.launch && bench.time <= end(bench.flight));
</script>

<svg
  class="over"
  viewBox="-48 -8 736 316"
  aria-hidden="true"
  style:--k={scale}
  bind:clientWidth={width}
  bind:this={bench.over}
>
  <rect class="wing" x={-48} y={-8} width={48} height={316} />
  <rect class="wing" x={WIDTH} y={-8} width={48} height={316} />
  <g>
    {#each bench.flight.legs as _, i (i)}
      {@const d = trailPath(path, i)}
      <g class={["leg", { hot: bench.hot === i }]} style:--leg={legColor(i)}>
        <path class="trail" {d} />
        <path
          class="hit"
          role="presentation"
          {d}
          onpointerdown={(event) => bench.pressTrail(event, i)}
          onpointerenter={() => bench.hoverTrail(i)}
          onpointerleave={bench.leaveLeg}
        />
      </g>
    {/each}
  </g>
  <g class="onion">
    {#each ghosts as f, k (k)}
      {#if k % 6 === 3}
        <path
          d="M-19 -12L22 0L-19 12L-11 0Z"
          transform="translate({f.x.toFixed(1)} {f.y.toFixed(1)}) rotate({f.rotate.toFixed(1)})"
        />
      {/if}
    {/each}
  </g>
  <g class="ghosts">
    {#each ghosts as f, k (k)}
      <circle
        cx={f.x.toFixed(1)}
        cy={f.y.toFixed(1)}
        r={bench.hot === f.leg ? 3.6 : 2.8}
        fill={legColor(f.leg)}
        class={{ dim: bench.hot !== undefined && bench.hot !== f.leg }}
      />
    {/each}
  </g>
  <circle class={["now", { off: !flying }]} cx={plane.x.toFixed(1)} cy={plane.y.toFixed(1)} />
  <g>
    {#each pts as p, index (index)}
      <g
        class="point"
        tabindex="0"
        role="slider"
        aria-label="Point {index}"
        aria-valuemin={0}
        aria-valuemax={8}
        aria-valuenow={bench.arrival(index)}
        transform="translate({p[0].toFixed(1)} {p[1].toFixed(1)})"
        onpointerdown={(event) => bench.pressPoint(event, index)}
        onpointerenter={() => bench.hoverPoint(index)}
        onpointerleave={bench.leavePoint}
      >
        <circle class="grip" />
        <circle class="handle" />
        <text text-anchor="middle" y={(p[1] < 30 ? 26 : -14) * scale}>
          {fmt(bench.arrival(index))}
        </text>
      </g>
    {/each}
  </g>
  {#if bench.label}
    <text
      class="label"
      x={clamp(bench.label.at[0], 30, WIDTH - 30)}
      y={clamp(bench.label.at[1] - 34 * scale, 14 * scale, HEIGHT - 6)}
    >
      {bench.label.text}
    </text>
  {/if}
</svg>

<style>
  .over {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
    font: 600 calc(var(--k, 1) * 11px) / 1 var(--sans);
  }
  .over :global(*) {
    vector-effect: non-scaling-stroke;
  }
  :global([data-dragging]) .over {
    cursor: grabbing;
  }
  .wing {
    fill: transparent;
  }
  .trail {
    fill: none;
    stroke: oklch(100% 0 none / 0.75);
    stroke-width: 1.5;
    stroke-dasharray: 2 5;
    stroke-linecap: round;
    pointer-events: none;
  }
  .leg.hot .trail {
    stroke: var(--leg);
    stroke-dasharray: none;
    stroke-width: 2.5;
  }
  .hit {
    fill: none;
    stroke: transparent;
    stroke-width: 26;
    stroke-linecap: round;
    cursor: grab;
    pointer-events: stroke;
  }
  :global([data-dragging]) .hit {
    cursor: grabbing;
  }
  .ghosts circle {
    stroke: oklch(100% 0 none);
    stroke-width: 1;
    pointer-events: none;
  }
  .ghosts circle.dim {
    opacity: 0.35;
  }
  .onion path {
    fill: none;
    stroke: oklch(28% 0.04 260 / 0.3);
    stroke-width: 1;
    stroke-dasharray: 2 2;
    pointer-events: none;
  }
  .now {
    r: calc(var(--k, 1) * 11px);
    fill: none;
    stroke: oklch(28% 0.04 260 / 0.7);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
    pointer-events: none;
  }
  .now.off {
    opacity: 0;
  }

  .point {
    cursor: grab;
    outline: none;
  }
  .grip {
    fill: transparent;
    r: calc(var(--k, 1) * 18px);
  }
  .handle {
    r: calc(var(--k, 1) * 7px);
    fill: oklch(100% 0 none);
    stroke: oklch(28% 0.04 260);
    stroke-width: 2;
    filter: drop-shadow(0 1px 2px oklch(0% 0 none / 0.35));
  }
  .point text,
  .label {
    fill: oklch(24% 0.04 260);
    paint-order: stroke;
    stroke: oklch(100% 0 none / 0.85);
    stroke-width: 3px;
    stroke-linejoin: round;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .label {
    text-anchor: middle;
    font-size: calc(var(--k, 1) * 12px);
  }
  .point:focus-visible .handle {
    stroke: var(--accent);
    stroke-width: 3;
  }
  @media (hover: hover) and (pointer: fine) {
    .point:hover .handle {
      stroke-width: 3;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .handle {
      transition: r 160ms var(--out);
    }
  }
  .point:active .handle,
  :global([data-dragging="point"]) .point:active .handle {
    r: calc(var(--k, 1) * 9px);
  }
</style>
