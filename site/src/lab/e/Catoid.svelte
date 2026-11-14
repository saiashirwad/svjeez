<script lang="ts">
  import { untrack } from "svelte";
  import Bin from "./Bin.svelte";
  import Card from "./Card.svelte";
  import Genes from "./Genes.svelte";
  import { Lab, setLab } from "./lab.svelte";
  import { PART_ICONS } from "./rows";
  import Shelf from "./Shelf.svelte";
  import Stage from "./Stage.svelte";

  const lab = new Lab();

  setLab(lab);

  $effect(() => lab.compileStaged(lab.staged));

  $effect(() => {
    untrack(() => void lab.restoreShelf());

    return () => lab.dispose();
  });
</script>

<main class="lab-e">
  <Stage />

  <aside class="le-side">
    <Card />
    <Bin />
    <Genes />
  </aside>

  <Shelf />
</main>

{#if lab.carried}
  {@const { ghost, at } = lab.carried}
  <div class="le-ghost" style:translate="{at.x}px {at.y}px">
    {#if ghost.kind === "part"}
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d={PART_ICONS[ghost.part]} /></svg>
    {:else}
      <img src={ghost.thumb} alt="" />
    {/if}
  </div>
{/if}

<style>
  .lab-e {
    --hot: light-dark(oklch(58% 0.2 25), oklch(74% 0.17 25));
    --label: light-dark(oklch(97% 0.02 85), oklch(23% 0.012 85));
    --label-ink: light-dark(oklch(28% 0.02 60), oklch(92% 0.02 85));
    --grade-0: light-dark(oklch(52% 0.14 150), oklch(78% 0.15 150));
    --grade-1: light-dark(oklch(58% 0.14 70), oklch(80% 0.14 75));
    --grade-2: light-dark(oklch(55% 0.2 25), oklch(72% 0.17 25));
    --grade-3: light-dark(oklch(50% 0.2 300), oklch(74% 0.15 300));

    display: grid;
    gap: 0.75rem;
    padding: 0.75rem var(--gutter) 1.5rem;
    grid-template-areas: "stage" "side" "shelf";
    max-inline-size: 120rem;
    margin-inline: auto;
  }

  .le-side {
    grid-area: side;
    display: grid;
    align-content: start;
    gap: 0.75rem;
    min-block-size: 0;
  }

  /* One screen on a desktop: the stage takes whatever height the shelf and the header leave, and keeps 16:10 inside it. */
  @media (width >= 64rem) {
    .lab-e {
      block-size: calc(100dvh - 78px);
      padding-block-end: 0.75rem;
      grid-template-columns: minmax(0, 1fr) clamp(19rem, 24vw, 23rem);
      grid-template-rows: minmax(0, 1fr) auto;
      grid-template-areas:
        "stage side"
        "shelf side";
    }
    .le-side {
      overflow: auto;
    }
  }

  .le-ghost {
    position: fixed;
    inset: 0 auto auto 0;
    z-index: 10;
    pointer-events: none;
    color: var(--hot);
  }

  .le-ghost > * {
    display: block;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    translate: -50% -50%;
  }

  .le-ghost svg {
    inline-size: 1.75rem;
    block-size: 1.75rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .le-ghost img {
    inline-size: 6rem;
    block-size: auto;
    border-radius: 0.4rem;
    box-shadow: 0 8px 24px -8px var(--shadow);
  }

  /* While anything is carried, the whole page shows the closed hand. */
  :global(body:has(.le-ghost), body:has(.le-ghost) *) {
    cursor: grabbing;
  }
</style>
