<script lang="ts">
  import { curvePath } from "./curves";
  import { getLab } from "./lab.svelte";

  const lab = getLab();
  const W = 1000;
  const RH = 22;

  const ticks = $derived(Array.from({ length: Math.floor(lab.duration) + 1 }, (_, s) => s));
  let ruler: HTMLDivElement;

  const seek = (e: PointerEvent) => {
    const b = ruler.getBoundingClientRect();
    lab.seek((e.clientX - b.left) / b.width);
  };

  const easePath = (from: number, to: number, ease: readonly number[]) => {
    const x0 = (from / lab.duration) * W;
    const x1 = (to / lab.duration) * W;

    return curvePath(
      ease,
      (u) => x0 + u * (x1 - x0),
      (v) => RH - 4 - v * (RH - 8),
    );
  };
</script>

<div class="la-timeline" role="presentation" onpointerleave={() => lab.leaveTimeline()}>
  <div class="la-tl-head">
    <button type="button" class="la-btn la-play" onclick={() => lab.setPaused(!lab.paused)}
      >{lab.paused ? "Play" : "Pause"}</button
    >
    <span class="la-time">{lab.t.toFixed(2)}s</span>
  </div>
  <div
    class="la-lanes"
    role="presentation"
    onpointerdown={(e) => {
      lab.seekStart();
      e.currentTarget.setPointerCapture(e.pointerId);
      seek(e);
    }}
    onpointermove={(e) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e);
    }}
    onpointerup={() => lab.seekEnd()}
  >
    <div class="la-ticks" bind:this={ruler}>
      {#each ticks as s (s)}
        <span style:--x={s / lab.duration}>{s}s</span>
      {/each}
    </div>
    <div class="la-rows">
      {#each lab.rows as r (r.cls)}
        <div
          class={["la-row", { "is-hot": r.keys.some((k) => lab.hot.keys.has(k)) }]}
          role="presentation"
          onpointerover={() => lab.hoverRow(r.keys)}
        >
          <span class="la-row-label">{r.label}</span>
          <svg viewBox="0 0 {W} {RH}" preserveAspectRatio="none" class="la-row-track">
            {#each r.bars as b (`${b.from}-${b.to}`)}
              <g
                class={["la-bar", { "is-step": b.at === lab.hot.step }]}
                role="presentation"
                onpointerover={(e) => {
                  e.stopPropagation();
                  lab.hoverRow(r.keys, b);
                }}
              >
                <rect
                  x={(b.from / lab.duration) * W}
                  y="3"
                  width={Math.max(1.5, ((b.to - b.from) / lab.duration) * W)}
                  height={RH - 6}
                  rx="3"
                />
                {#if b.ease}<path d={easePath(b.from, b.to, b.ease)} />{/if}
              </g>
            {/each}
          </svg>
        </div>
      {/each}
    </div>
    <div class="la-playhead" style:--x={lab.t / lab.duration}></div>
  </div>
</div>

<style>
  .la-timeline {
    margin-block-start: 0.85rem;
    font: 0.75rem var(--mono);
    color: var(--muted);
  }
  .la-tl-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-block-end: 0.4rem;
  }
  .la-time {
    min-inline-size: 4ch;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .la-lanes {
    position: relative;
    cursor: col-resize;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    padding-block-start: 1.1rem;
    overflow: clip;
  }
  .la-ticks {
    position: absolute;
    inset: 0 0 0 var(--la-label);
  }
  .la-ticks span {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: calc(var(--x) * 100%);
    translate: -50% 0;
    font-size: 0.68rem;
    opacity: 0.75;
  }
  .la-ticks span::after {
    content: "";
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: 1.1rem;
    block-size: 100vh;
    border-inline-start: 1px dashed var(--line);
  }
  .la-ticks span:first-child {
    translate: 0 0;
  }
  .la-ticks span:first-child::after {
    inset-inline-start: 0;
  }
  .la-ticks span:last-child {
    translate: -100% 0;
  }
  .la-rows {
    position: relative;
  }
  .la-row {
    display: grid;
    grid-template-columns: var(--la-label) minmax(0, 1fr);
    align-items: center;
    border-radius: 0.35rem;
  }
  .la-row.is-hot {
    background: var(--la-hot);
  }
  .la-row-label {
    padding-inline: 0.4rem;
    overflow: clip;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .la-row.is-hot .la-row-label {
    color: var(--ink);
  }
  .la-row-track {
    display: block;
    inline-size: 100%;
    block-size: 1.375rem;
    overflow: visible;
  }
  .la-bar rect {
    fill: color-mix(in oklch, var(--code-fn) 18%, transparent);
    stroke: color-mix(in oklch, var(--code-fn) 45%, transparent);
    vector-effect: non-scaling-stroke;
  }
  .la-bar path {
    fill: none;
    stroke: var(--code-fn);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .la-bar.is-step rect {
    fill: color-mix(in oklch, var(--accent) 40%, transparent);
    stroke: var(--accent);
  }
  .la-playhead {
    position: absolute;
    inset-block: 0;
    inset-inline-start: calc(var(--la-label) + var(--x, 0) * (100% - var(--la-label)));
    border-inline-start: 2px solid var(--code-tag);
    pointer-events: none;
  }
  .la-playhead::before {
    content: "";
    position: absolute;
    inset-block-start: 0.85rem;
    inset-inline-start: -5px;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--code-tag);
  }

  @media (max-width: 61.99rem) {
    .la-timeline {
      margin-block-start: 0.5rem;
    }
    .la-tl-head {
      margin-block-end: 0;
    }
    .la-row {
      grid-template-columns: minmax(0, 1fr);
    }
    .la-row-label {
      display: none;
    }
    .la-row-track {
      block-size: 0.6rem;
    }
  }
</style>
