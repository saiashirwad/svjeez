<script lang="ts">
  import { statsOf, type First } from "@svjeez/live";
  import { Code, editor, Picture, Transport } from "@svjeez/svelte";
  import { onDestroy } from "svelte";
  import "../lab/sj.css";
  import text from "./firework.tsx?raw";

  let { first }: { first: First } = $props();

  // The editor reads its first picture once, when the page makes it.
  // svelte-ignore state_referenced_locally
  const scene = editor(text, { first });

  // The readout's numbers.
  const stats = $derived(scene.state.stats ? statsOf(scene.state.stats) : []);

  onDestroy(scene.destroy);
</script>

<div class="editor">
  <div class="side">
    <Picture editor={scene} />
    <Transport editor={scene} />
    <p class="sj-stats">
      {#each stats as stat (stat.label)}<span class="sj-stat"><b>{stat.value}</b> {stat.label}</span>{/each}
    </p>
  </div>
  <div class="codebox"><Code editor={scene} file="firework.tsx" /></div>
</div>

<style>
  .editor {
    display: grid;
    gap: 1.25rem;
  }

  .side {
    display: grid;
    gap: 0.875rem;
    align-content: start;
    min-inline-size: 0;
  }

  .sj-stats {
    gap: 0.2rem 0.6rem;
    font-size: 0.74rem;
  }

  .sj-stat {
    white-space: nowrap;
  }

  .sj-stat + .sj-stat::before {
    content: "·";
    margin-inline-end: 0.6rem;
    color: var(--muted);
  }

  .codebox {
    min-inline-size: 0;
  }

  @media (width >= 56rem) {
    .editor {
      grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
      align-items: start;
      gap: var(--gap);
    }

    /* The whole source shows; the picture stays in view beside it while the page scrolls. */
    .side {
      position: sticky;
      inset-block-start: 1rem;
    }
  }
</style>
