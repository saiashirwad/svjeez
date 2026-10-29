<script lang="ts">
  import { live, Picture, Source } from "@svjeez/live/svelte";
  import * as pendulum from "./pendulum";
  import text from "./pendulum.tsx?raw";
  import first from "./pendulum.tsx?svjeez";

  const scene = live(text, pendulum, { first });
</script>

<main class="live">
  <Picture {scene} />
  <Source {scene} file="pendulum.tsx" />
  <p class="error" role="status" hidden={!scene.error}>{scene.error}</p>
</main>

<style>
  .live {
    display: grid;
    gap: 1.25rem;
    inline-size: min(100% - 2 * var(--gutter), 76rem);
    margin-inline: auto;
    padding-block: 1rem 3rem;
  }
  @media (width >= 60rem) {
    .live {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      align-items: start;
    }
    .live > :global(.picture) {
      position: sticky;
      inset-block-start: 1rem;
    }
  }

  .error {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--warn);
    font: 0.85rem var(--mono);
  }
</style>
