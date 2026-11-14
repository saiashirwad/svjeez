<script lang="ts">
  import { addPart, PARTS, removePart, type Part } from "./edit";
  import { getLab } from "./lab.svelte";
  import { PART_ICONS } from "./rows";

  const lab = getLab();

  const count = (part: Part) =>
    part === "eyes" && lab.genome.bodyEyes
      ? `${lab.genome.eyes}+${lab.genome.bodyEyes}`
      : String(lab.genome[part]);

  const add = (part: Part, vp?: { x: number; y: number }) =>
    lab.set(addPart(lab.genome, lab.lay, part, vp));

  const remove = (part: Part, eyeOnBody = false) => lab.set(removePart(lab.genome, part, eyeOnBody));

  /** Drag a part onto the stage, or click it to add one wherever it goes. */
  const grab = (part: Part) => (e: PointerEvent) => {
    e.preventDefault();
    lab.carry(
      e,
      { kind: "part", part },
      {
        slop: 6,
        over: (m) => lab.showDrop(m, part),
        end: (u, lifted) => {
          if (!lifted) return add(part);
          const vp = lab.viewPoint(u);

          if (vp.inside) add(part, vp);
        },
        clear: () => lab.showDrop(),
      },
    );
  };

  /** Enter or Space on a focused part adds one; -, Backspace or Delete takes one away. */
  const keys = (part: Part) => (e: KeyboardEvent) => {
    if (e.key === "-" || e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      remove(part);
    }
  };
</script>

<div class="le-bin" role="group" aria-label="Parts">
  {#each PARTS as part (part)}
    <div class="le-slot">
      <button
        type="button"
        class="le-part"
        aria-label="Add one of {part}"
        onpointerdown={grab(part)}
        onclick={(e) => e.detail === 0 && add(part)}
        onkeydown={keys(part)}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d={PART_ICONS[part]} /></svg>
        <output>{count(part)}</output>
      </button>
      <button
        type="button"
        class="le-less"
        aria-label="Remove one of {part}"
        disabled={lab.genome[part] === 0 && !(part === "eyes" && lab.genome.bodyEyes)}
        onclick={() => remove(part, part === "eyes" && lab.genome.eyes === 0)}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 6h6" /></svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .le-bin {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .le-slot {
    position: relative;
    display: grid;
  }

  .le-less {
    position: absolute;
    inset-block-start: 0.15rem;
    inset-inline-end: 0.15rem;
    display: grid;
    place-items: center;
    inline-size: 1.05rem;
    block-size: 1.05rem;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--ring);
    color: var(--ink);
    cursor: pointer;
  }

  .le-less svg {
    inline-size: 0.75rem;
    block-size: 0.75rem;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .le-less:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .le-part {
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    padding: 0.35rem 0.2rem 0.3rem;
    border: 0;
    border-radius: 0.5rem;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--ring);
    color: var(--ink);
    cursor: grab;
    touch-action: none;
  }

  .le-part svg {
    inline-size: 1.75rem;
    block-size: 1.75rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .le-part output {
    font: 600 0.8rem var(--mono);
    font-variant-numeric: tabular-nums;
  }

  .le-part:focus-visible,
  .le-less:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .le-part:active {
    scale: 0.96;
  }

  @media (hover: hover) and (pointer: fine) {
    .le-part:hover,
    .le-less:hover:not(:disabled) {
      background: color-mix(in oklch, var(--ink) 8%, var(--surface));
    }
  }
</style>
