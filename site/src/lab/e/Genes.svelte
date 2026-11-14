<script lang="ts">
  import { drag } from "./drags";
  import { numberSpec, withChoice, withGene, type ChoiceKey, type NumericKey } from "./genome";
  import { getLab } from "./lab.svelte";
  import { readout, ROWS, scrubOff } from "./rows";

  const lab = getLab();

  const choose = (gene: ChoiceKey, value: string) => {
    lab.set(withChoice(lab.genome, gene, value));
    lab.restamp();
  };

  /** Drag a value sideways. */
  const scrub = (key: NumericKey) => (e: PointerEvent) => {
    if (scrubOff(key, lab.genome)) return;
    const { min, max } = numberSpec(key);
    const v0 = lab.genome[key];
    drag(e, {
      move: (m) => lab.set(withGene(lab.genome, key, v0 + ((m.clientX - e.clientX) / 160) * (max - min))),
    });
  };

  /** Arrow keys step a value. */
  const step = (key: NumericKey) => (e: KeyboardEvent) => {
    const d =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -1
          : 0;

    if (!d) return;
    e.preventDefault();
    const { min, max, step } = numberSpec(key);
    lab.set(withGene(lab.genome, key, lab.genome[key] + d * Math.max(step, (max - min) / 40)));
  };

  const progress = (key: NumericKey) => {
    const { min, max } = numberSpec(key);

    return (lab.genome[key] - min) / (max - min);
  };
</script>

<div class="le-genes">
  {#each ROWS as row (row.gene)}
    <div class="le-gene">
      <span class="le-gene-name">{row.label}</span>
      <div class="le-options" role="radiogroup" aria-label={row.gene}>
        {#each row.options as { value, face } (value)}
          <button
            type="button"
            role="radio"
            title={value}
            aria-label={value}
            aria-checked={lab.genome[row.gene] === value}
            onclick={() => choose(row.gene, value)}
          >
            {#if face.kind === "word"}
              {value}
            {:else if face.kind === "icon"}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={face.d} /></svg>
            {:else}
              <i style:background={face.background}></i>
            {/if}
          </button>
        {/each}
      </div>
      {#if row.scrub.length > 0}
        <div class="le-scrubs">
          {#each row.scrub as key (key)}
            <button
              type="button"
              class="le-scrub"
              style:--p={progress(key)}
              disabled={scrubOff(key, lab.genome)}
              onpointerdown={scrub(key)}
              onkeydown={step(key)}
            >
              {readout(key, lab.genome)}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .le-genes {
    display: grid;
    gap: 0.25rem;
  }

  .le-gene {
    display: grid;
    grid-template-columns: 4.6rem minmax(0, 1fr);
    align-items: center;
    gap: 0.25rem 0.4rem;
  }

  .le-gene-name {
    font: 0.72rem var(--mono);
    color: var(--muted);
  }

  .le-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
  }

  .le-options button {
    display: grid;
    place-items: center;
    min-inline-size: 1.9rem;
    block-size: 1.75rem;
    padding: 0 0.4rem;
    border: 0;
    border-radius: 0.4rem;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--ring);
    color: var(--ink);
    font: 0.75rem var(--sans);
    cursor: pointer;
  }

  .le-options button[aria-checked="true"] {
    background: var(--ink);
    color: var(--bg);
  }

  .le-options svg {
    inline-size: 1.1rem;
    block-size: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .le-options i {
    display: block;
    inline-size: 1rem;
    block-size: 1rem;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px oklch(0% 0 none / 0.25);
  }

  .le-scrub {
    --p: 0.5;
    flex: 1 1 7rem;
    max-inline-size: 10rem;
    padding: 0.2rem 0.5rem;
    border: 0;
    border-radius: 0.4rem;
    background:
      linear-gradient(
        to right,
        color-mix(in oklch, var(--hot) 22%, transparent) calc(var(--p) * 100%),
        transparent 0
      ),
      var(--sunken);
    box-shadow: 0 0 0 1px var(--ring);
    color: var(--ink);
    font: 0.72rem var(--mono);
    font-variant-numeric: tabular-nums;
    text-align: start;
    cursor: ew-resize;
    touch-action: none;
  }

  .le-scrub:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .le-scrubs {
    grid-column: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .le-options button:focus-visible,
  .le-scrub:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .le-options button:active {
    scale: 0.96;
  }

  @media (hover: hover) and (pointer: fine) {
    .le-options button:hover:not([aria-checked="true"]) {
      background: color-mix(in oklch, var(--ink) 8%, var(--surface));
    }
  }
</style>
