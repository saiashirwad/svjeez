<script lang="ts">
  import { Code, editor, Picture, Transport } from "@svjeez/svelte";
  import { onDestroy } from "svelte";
  import "../sj.css";
  import text from "./pendulum.tsx?raw";
  import first from "./pendulum.tsx?svjeez";

  const scene = editor(text, { first });

  onDestroy(scene.destroy);
</script>

<main class="live">
  <div class="side">
    <Picture editor={scene} />
    <Transport editor={scene} />
  </div>
  <Code editor={scene} file="pendulum.tsx" />
</main>

<style>
  .live {
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
    .live {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      align-items: start;
    }

    .side {
      position: sticky;
      inset-block-start: 1rem;
    }
  }
</style>
