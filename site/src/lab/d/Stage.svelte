<script lang="ts">
  import type { Point } from "./outline";
  import { getLab } from "./fourier-lab.svelte";

  const lab = getLab();

  const toScene = (e: PointerEvent, box: DOMRect): Point => [
    ((e.clientX - box.left) / box.width) * 960,
    ((e.clientY - box.top) / box.height) * 540,
  ];

  const down = (e: PointerEvent & { currentTarget: SVGSVGElement }) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lab.beginStroke(toScene(e, e.currentTarget.getBoundingClientRect()));
  };

  const move = (e: PointerEvent & { currentTarget: SVGSVGElement }) => {
    const box = e.currentTarget.getBoundingClientRect();

    lab.extendStroke((e.getCoalescedEvents?.() ?? [e]).map((ev) => toScene(ev, box)));
  };
</script>

<div class="picture">
<figure>
  <div class="canvas" data-active={lab.drawing || lab.inking ? "" : undefined} data-landing={lab.landing ? "" : undefined}>
    <img
      src={lab.src || undefined}
      alt="Spinning circles trace the drawing beside the Fourier sum that draws it"
      width="960"
      height="540"
    />
    <svg
      class="ink"
      viewBox="0 0 960 540"
      aria-label="Draw a closed shape"
      role="img"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={() => lab.endStroke()}
      onpointercancel={() => lab.endStroke()}
    >
      <path d={lab.inkPath || undefined} />
    </svg>
  </div>
  <figcaption>
    <span class="file">fourier.svg</span>
    <span>{lab.gzip}</span>
    <span class="muted">{lab.ms}</span>
    <a href={lab.saveHref || undefined} download="fourier.svg">save</a>
  </figcaption>
</figure>
{#if lab.error}
  <p class="error">{lab.error}</p>
{/if}
</div>

<style>
  .picture {
    min-inline-size: 0;
  }

  figure {
    margin: 0;
  }

  .canvas {
    position: relative;
    border-radius: var(--radius);
    background: var(--board);
    box-shadow:
      0 0 0 1px var(--ring),
      0 18px 40px -20px var(--shadow);
    overflow: clip;
  }

  img {
    display: block;
    inline-size: 100%;
    block-size: auto;
    aspect-ratio: 16 / 9;
  }

  .ink {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    cursor: crosshair;
    touch-action: none;
  }

  .ink path {
    fill: none;
    stroke: var(--pen);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 6px var(--pen));
  }

  .canvas[data-active] {
    outline: 2px dashed color-mix(in oklch, var(--pen) 70%, transparent);
    outline-offset: -0.75rem;
  }

  .canvas[data-active] img {
    opacity: 0.18;
  }

  @media (prefers-reduced-motion: no-preference) {
    img {
      transition: opacity 0.25s ease-out;
    }

    .canvas[data-landing] .ink path {
      animation: land 0.9s ease-out forwards;
    }
  }

  @keyframes land {
    to {
      opacity: 0;
      stroke-width: 10;
    }
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    padding: 0.5rem 0.25rem 0;
    font: 0.8rem/1.4 var(--mono);
    font-variant-numeric: tabular-nums;
  }

  .file {
    font-weight: 600;
  }

  .muted {
    color: var(--muted);
  }

  figcaption a {
    margin-inline-start: auto;
    color: var(--accent);
  }

  .error {
    margin: 0.5rem 0 0;
    color: var(--warn);
    font: 0.8rem/1.4 var(--mono);
  }
</style>
