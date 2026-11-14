<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { svgUrl } from "../util";
  import CodeWindow from "./CodeWindow.svelte";
  import EasePop from "./EasePop.svelte";
  import { Lab, setLab } from "./lab.svelte";
  import Stage from "./Stage.svelte";
  import Timeline from "./Timeline.svelte";

  const lab = setLab(new Lab());

  const bytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(2)} KB`);

  /** The download link points at the newest file, and lets go of the one before. */
  const fileLink: Attachment<HTMLAnchorElement> = (a) => {
    if (!lab.svg) return;
    const url = svgUrl(lab.svg);
    a.href = url;

    return () => URL.revokeObjectURL(url);
  };
</script>

<main
  class={[
    "la",
    {
      "is-scrubbing": lab.scrubbing,
      "has-error": lab.error !== null,
      "is-linking": lab.hot.keys.size > 0,
      "is-paused": lab.paused,
    },
  ]}
  {@attach lab.start}
>
  <div class="la-grid">
    <CodeWindow />

    <section class="la-out" aria-label="The compiled SVG">
      <Stage />
      <Timeline />

      <p class="la-error" role="status" hidden={lab.error === null}>{lab.error}</p>
      <p class="la-stats" aria-live="off">
        {#if lab.stats}
          <span><b>{bytes(lab.stats.gzip)}</b> gzip</span>
          <span><b>{bytes(lab.stats.raw)}</b> raw</span>
          <span><b>{lab.stats.ms.toFixed(1)} ms</b> to compile</span>
          <span><b>{lab.stats.avg.toFixed(0)} ms</b> drag to picture</span>
          <span><b>{lab.stats.files}</b> {lab.stats.files === 1 ? "file" : "files"} written</span>
        {/if}
      </p>
      <!-- svelte-ignore a11y_missing_attribute (fileLink sets the href once a file has compiled) -->
      <a class="la-download" download="meadow.svg" {@attach fileLink}>Download this file</a>
    </section>
  </div>

  {#if lab.hud}
    <div
      class="la-hud"
      style:left="{lab.hud.left}px"
      style:top="{lab.hud.top}px"
      style:--p={lab.hud.p}
    >
      <span class="la-hud-track"><i></i></span><span class="la-hud-label">{lab.hud.label}</span>
    </div>
  {/if}

  {#if lab.ease}
    <EasePop editor={lab.ease} />
  {/if}
</main>

<style>
  .la {
    --la-num: var(--code-number);
    --la-hot: color-mix(in oklch, var(--accent) 16%, transparent);
    --la-live: var(--accent);
    --la-label: 4.75rem;
    inline-size: min(100% - 2 * var(--gutter), 84rem);
    margin-inline: auto;
    padding-block: clamp(1.25rem, 3vw, 2.5rem) 4rem;
    position: relative;
  }

  .is-scrubbing,
  .is-scrubbing :global(*) {
    cursor: ew-resize !important;
  }

  .la :global(.la-btn) {
    font: 500 0.78rem var(--sans);
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 0.3rem 0.8rem;
    cursor: pointer;
  }
  .la :global(.la-btn:active) {
    transform: scale(0.97);
  }
  @media (hover: hover) and (pointer: fine) {
    .la :global(.la-btn:hover) {
      background: color-mix(in oklch, var(--surface), var(--ink) 6%);
    }
  }

  .la-grid {
    display: grid;
    gap: clamp(1rem, 2.5vw, 2rem);
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  @media (min-width: 62rem) {
    .la-grid {
      grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
    }
    .la-out {
      position: sticky;
      inset-block-start: 1rem;
    }
  }

  .la-error {
    margin: 0.75rem 0 0;
    padding: 0.6rem 0.8rem;
    border-radius: 0.5rem;
    font: 0.78rem/1.5 var(--mono);
    color: var(--code-tag);
    background: color-mix(in oklch, var(--code-tag) 10%, transparent);
  }
  .la-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1.1rem;
    margin: 0.85rem 0 0.4rem;
    font: 0.75rem var(--mono);
    color: var(--muted);
  }
  .la-stats b {
    color: var(--ink);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .la-download {
    font-size: 0.8rem;
    color: var(--accent);
  }

  .la-hud {
    position: absolute;
    z-index: 10;
    translate: -50% calc(-100% - 0.5rem);
    display: grid;
    gap: 0.25rem;
    justify-items: center;
    padding: 0.35rem 0.55rem;
    border-radius: 0.5rem;
    background: var(--ink);
    color: var(--bg);
    font: 0.68rem var(--mono);
    pointer-events: none;
    white-space: nowrap;
  }
  .la-hud-track {
    position: relative;
    inline-size: 6rem;
    block-size: 3px;
    border-radius: 3px;
    background: color-mix(in oklch, var(--bg) 35%, transparent);
  }
  .la-hud-track i {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: calc(var(--p, 0) * 100%);
    translate: -50% -50%;
    inline-size: 9px;
    block-size: 9px;
    border-radius: 50%;
    background: var(--la-num);
  }

  @media (max-width: 61.99rem) {
    .la {
      --la-label: 0rem;
    }
    .la-out {
      order: -1;
      position: sticky;
      inset-block-start: 0;
      z-index: 2;
      background: var(--bg);
      padding-block: 0.5rem;
      margin-inline: calc(-1 * var(--gutter));
      padding-inline: var(--gutter);
    }
    .la-stats,
    .la-download {
      display: none;
    }
  }
</style>
