<script lang="ts">
  import Comb from "./Comb.svelte";
  import Ease from "./Ease.svelte";
  import { Lab, setLab } from "./feel-state.svelte";
  import Spring from "./Spring.svelte";
  import Stage from "./Stage.svelte";
  import Sun from "./Sun.svelte";
  import Tempo from "./Tempo.svelte";

  setLab(new Lab());
</script>

<main class="lab-b">
  <div class="studio">
    <Stage />
    <section class="instruments" aria-label="Instruments">
      <Spring />
      <Ease />
      <Comb />
      <Tempo />
      <Sun />
    </section>
  </div>
</main>

<style>
  .lab-b {
    --hot: light-dark(oklch(62% 0.21 0), oklch(76% 0.17 0));
    --handle: light-dark(oklch(21% 0.005 270), oklch(96% 0.002 270));
    --wire: light-dark(oklch(45% 0.01 270), oklch(78% 0.01 270));
    --wood: light-dark(oklch(66% 0.09 55), oklch(48% 0.07 55));
    --wood-dark: light-dark(oklch(52% 0.08 50), oklch(38% 0.06 50));

    max-inline-size: 90rem;
    margin-inline: auto;
    padding: 1rem var(--gutter) 4rem;
  }

  .studio {
    display: grid;
    gap: 1rem;
    grid-template-areas: "stage" "inst";
  }

  .instruments {
    grid-area: inst;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
    gap: 0.75rem;
  }

  /* On a wide screen the stage takes the top left, two instruments stack beside it and three line up underneath, so
     everything fits in one screen. The cards join the studio's grid directly. */
  @media (width >= 70rem) {
    .studio {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-template-areas:
        "stage stage spring"
        "stage stage ease"
        "comb tempo sun";
    }

    .instruments {
      display: contents;
    }
  }
</style>
