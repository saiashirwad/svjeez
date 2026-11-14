<script lang="ts">
  import type { Snippet } from "svelte";
  import { frames } from "./attach";

  interface Props {
    name: string;
    title: string;
    hint: string;
    box: string;
    readout: string;
    tall?: boolean;
    clip?: boolean;
    keys?: Record<string, () => void>;
    frame?: (now: number, dt: number) => void;
    children: Snippet;
  }

  let { name, title, hint, box, readout, tall = false, clip = false, keys = {}, frame, children }: Props = $props();

  const onkeydown = (e: KeyboardEvent) => {
    const press = keys[e.key];

    if (press) {
      e.preventDefault();
      press();
    }
  };
</script>

<article class={["card", { tall }]} style:--area={name}>
  <h2>
    {title}
    <output data-readout={name}>{readout}</output>
  </h2>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
  <svg
    data-instrument={name}
    class={{ clip }}
    viewBox={box}
    tabindex="0"
    role="img"
    aria-label={hint}
    {onkeydown}
    {@attach frame ? frames(frame) : undefined}
  >
    {@render children()}
  </svg>
</article>

<style>
  .card {
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 0.25rem;
    padding: 0.75rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--ring);
  }

  h2 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.95rem;
  }

  output {
    font: 500 0.75rem var(--mono);
    font-variant-numeric: tabular-nums;
    color: var(--hot);
  }

  svg {
    display: block;
    inline-size: 100%;
    max-block-size: 15rem;
    overflow: visible;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    border-radius: 0.5rem;
  }

  svg:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  svg.clip {
    overflow: clip;
  }

  svg:global(.held),
  svg:global(.held) :global(*) {
    cursor: grabbing;
  }

  svg :global {
    text {
      fill: var(--muted);
    }

    .tiny {
      font: 9.5px var(--sans);
      font-variant-numeric: tabular-nums;
    }

    .ink-fill {
      fill: var(--ink);
    }

    .axis {
      stroke: var(--line);
      stroke-width: 1;
    }

    .trace {
      fill: none;
      stroke: var(--ink);
      stroke-width: 2;
      stroke-linecap: round;
    }

    .knob {
      fill: var(--bg);
      stroke: var(--handle);
      stroke-width: 2.5;
      cursor: grab;
    }

    .grab {
      cursor: grab;
    }

    .grab-x {
      cursor: ew-resize;
    }

    .knob,
    .grab {
      transition: stroke-width 0.12s;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    svg :global(.knob:hover) {
      stroke-width: 4;
    }
  }

  @media (width >= 70rem) {
    .card {
      grid-area: var(--area);
    }

    svg {
      inline-size: 100%;
      max-block-size: clamp(7rem, 16dvh, 11rem);
    }

    .tall svg {
      contain: size;
      block-size: 100%;
      max-block-size: none;
    }
  }
</style>
