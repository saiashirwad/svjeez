<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { getLab } from "./lab.svelte";

  const lab = getLab();
  let stage: HTMLDivElement | undefined = $state();

  /** A paused twin of the file in a shadow root: the hit test for hovers, and what the highlight boxes measure. */
  const ghost: Attachment<HTMLDivElement> = (host) => {
    const shadow = host.attachShadow({ mode: "open" });
    lab.ghost = shadow;

    $effect(() => {
      shadow.innerHTML = `<style>svg{display:block;inline-size:100%;block-size:auto}.a{animation-play-state:paused!important}</style>${lab.compiled.svg}`;
    });

    return () => (lab.ghost = undefined);
  };

  /** The boxes follow the twin, which sits paused at the same moment as the picture, so they are measured every frame. */
  const boxes = $derived.by(() => {
    void lab.t;

    if (!lab.hot.keys.size || !lab.ghost || !stage) return [];
    const sb = stage.getBoundingClientRect();
    const pad = 4;
    const out: { id: string; top: number; left: number; width: number; height: number }[] = [];

    for (const k of lab.hot.keys)
      lab.ghost.querySelectorAll(`[data-source="${k}"]`).forEach((el, j) => {
        const r = el.getBoundingClientRect();

        if (r.width * r.height > 0)
          out.push({
            id: `${k}/${j}`,
            top: r.top - sb.top - pad,
            left: r.left - sb.left - pad,
            width: r.width + pad * 2,
            height: r.height + pad * 2,
          });
      });

    return out;
  });
</script>

<div
  class="la-stage"
  bind:this={stage}
  role="presentation"
  onpointermove={(e) => lab.hoverStage(e.clientX, e.clientY)}
  onpointerleave={() => lab.clearHot()}
>
  <img class="la-img" alt="The compiled meadow scene" src={lab.imgSrc || undefined} />
  <div class="la-ghost" aria-hidden="true" {@attach ghost}></div>
  <div class="la-boxes" aria-hidden="true">
    {#each boxes as b (b.id)}
      <i
        style:inset="{b.top}px auto auto {b.left}px"
        style:inline-size="{b.width}px"
        style:block-size="{b.height}px"
      ></i>
    {/each}
  </div>
</div>

<style>
  .la-stage {
    position: relative;
    border-radius: var(--radius);
    overflow: clip;
    box-shadow:
      0 0 0 1px var(--ring),
      0 1.25rem 2.5rem -1.25rem var(--shadow);
    background: var(--surface);
  }
  .la-img {
    display: block;
    inline-size: 100%;
    block-size: auto;
    aspect-ratio: 480 / 300;
  }
  .la-ghost {
    position: absolute;
    inset: 0;
    opacity: 0;
  }
  .la-boxes {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .la-boxes i {
    position: absolute;
    border-radius: 0.6rem;
    outline: 2px solid oklch(100% none none);
    box-shadow:
      0 0 0 4px oklch(0% none none / 0.25),
      inset 0 0 0 999px oklch(100% none none / 0.12);
  }
  @media (max-width: 61.99rem) {
    .la-stage {
      inline-size: fit-content;
      margin-inline: auto;
      max-block-size: 30svh;
    }
    .la-img {
      max-block-size: 30svh;
      inline-size: auto;
      max-inline-size: 100%;
    }
  }
</style>
