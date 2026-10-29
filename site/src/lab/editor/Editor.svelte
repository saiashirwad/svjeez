<script lang="ts">
  import { Code, editor, Picture, Transport } from "@svjeez/svelte";
  import { onDestroy } from "svelte";
  import "../sj.css";
  import text from "./lanterns.tsx?raw";
  import first from "./lanterns.tsx?svjeez";

  const scene = editor(text, { first });

  onDestroy(scene.destroy);
</script>

<main class="editor">
  <div class="side">
    <Picture editor={scene} />
    <Transport editor={scene} />
  </div>
  <Code editor={scene} file="lanterns.tsx" />
</main>

<style>
  .editor {
    display: grid;
    gap: 1.25rem;
    inline-size: min(100% - 2 * var(--gutter), 76rem);
    margin-inline: auto;
    padding-block: 1rem 3rem;
  }

  .side {
    display: grid;
    gap: 1rem;
    align-content: start;
  }

  @media (width >= 60rem) {
    .editor {
      grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      align-items: start;
    }

    .side {
      position: sticky;
      inset-block-start: 1rem;
    }
  }
</style>
