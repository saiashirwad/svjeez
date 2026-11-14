<script lang="ts">
  import { getBench } from "./bench.svelte";
  import Overlay from "./Overlay.svelte";

  const bench = getBench();
</script>

<div class="scene">
  <div class="frame">
    <img
      alt="A paper plane flies over green hills, leaving puffs behind it."
      decoding="async"
      src={bench.imgUrl}
    />
  </div>
  <Overlay />
</div>

<style>
  .scene {
    position: relative;
    aspect-ratio: 736 / 316;
    border-radius: var(--radius);
    background:
      repeating-linear-gradient(
        135deg,
        transparent 0 6px,
        color-mix(in oklch, var(--ink) 5%, transparent) 6px 7px
      ),
      var(--sunken);
    box-shadow: inset 0 0 0 1px var(--ring);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .frame {
    position: absolute;
    inset-inline-start: calc(48 / 736 * 100%);
    inset-block-start: calc(8 / 316 * 100%);
    inline-size: calc(640 / 736 * 100%);
    block-size: calc(300 / 316 * 100%);
    display: grid;
    overflow: clip;
    border-radius: 6px;
    box-shadow: 0 10px 30px -12px var(--shadow);
  }
  img {
    grid-area: 1 / 1;
    inline-size: 100%;
    block-size: 100%;
    border: 0;
  }
</style>
