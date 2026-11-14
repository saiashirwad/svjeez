<script lang="ts">
  import { Lab, setLab } from "./fourier-lab.svelte";
  import Panel from "./Panel.svelte";
  import Stage from "./Stage.svelte";

  const lab = new Lab();

  setLab(lab);
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && (lab.drawing = false)} />

<main {@attach lab.start}>
  <Stage />
  <Panel />
</main>

<style>
  main {
    --board: oklch(16.5% 0.012 300);
    --pen: oklch(87% 0.13 85);

    display: grid;
    gap: 1.25rem;
    inline-size: min(100% - 2 * var(--gutter), 90rem);
    margin-inline: auto;
    padding-block: 0.25rem 2rem;
  }

  /* Wide screens: the picture as large as the screen's height allows, the controls in a column beside it. */
  @media (width >= 60rem) {
    main {
      grid-template-columns: minmax(0, calc((100dvh - 8.5rem) * 16 / 9)) 15rem;
      justify-content: center;
      align-items: start;
    }
  }
</style>
