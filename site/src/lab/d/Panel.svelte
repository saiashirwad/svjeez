<script lang="ts">
  import ParamPanel from "../ParamPanel.svelte";
  import { getLab, PEN } from "./fourier-lab.svelte";
  import { params, PRESETS } from "./shapes";
  import Tile from "./Tile.svelte";

  const lab = getLab();
</script>

<section aria-label="Controls">
  <ParamPanel
    --param-output-size="clamp(2.5rem, 2rem + 2vw, 3.5rem)"
    --param-track="linear-gradient(to right in oklch longer hue, oklch(72% 0.17 25), oklch(72% 0.17 340))"
    schema={params}
    values={{ circles: lab.count }}
    onchange={({ circles }) => circles !== undefined && lab.setCount(circles)}
  />

  <div class="tiles" role="radiogroup" aria-label="Shape">
    <Tile
      label="Draw your own"
      pencil
      thumb={lab.doodleThumb}
      checked={lab.picked === PEN}
      onclick={() => lab.togglePen()}
    />
    {#each PRESETS as { name } (name)}
      <Tile
        label={name}
        thumb={lab.thumbs.get(name)}
        checked={lab.picked === name}
        onclick={() => lab.pickPreset(name)}
      />
    {/each}
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1.5rem;
    align-content: start;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  @media (width < 60rem) {
    .tiles {
      grid-template-columns: repeat(6, 1fr);
    }
  }
</style>
