<script lang="ts">
  import { DEFAULT_FEEL, getLab, Stage } from "./feel-state.svelte";

  const lab = getLab();
  const stage = new Stage();

  // The page arrives with the default feel already drawn, so only an edit compiles.
  $effect(() => {
    if (lab.feel !== DEFAULT_FEEL) stage.build(lab.feel);
  });

  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

  const flash = (el: HTMLElement) => {
    if (stage.files > 0)
      el.animate([{ color: "var(--hot)" }, { color: "inherit" }], { duration: 500 });
  };
</script>

<div class="stage">
<figure>
  <img
    src={stage.url}
    alt="Five gummies hop in a rhythm, squashing as they land"
    width="640"
    height="360"
  />
  <figcaption>
    <span class="file" {@attach flash}>
      {stage.files ? `gummies-${String(stage.files).padStart(3, "0")}.svg` : "gummies.svg"}
    </span>
    <span {@attach flash}>{stage.files ? `${kb(stage.gzip)} gzip` : ""}</span>
    <span class="muted">{stage.files ? `built in ${stage.ms} ms` : "built with the page"}</span>
    <a href={stage.url} download="gummies.svg">save</a>
  </figcaption>
</figure>
  {#if stage.error}
    <p class="error">{stage.error}</p>
  {/if}
</div>

<style>
  .stage {
    grid-area: stage;
    position: sticky;
    inset-block-start: 0.5rem;
    z-index: 1;
  }

  figure {
    margin: 0;
  }

  img {
    display: block;
    inline-size: 100%;
    block-size: auto;
    aspect-ratio: 16 / 9;
    border-radius: var(--radius);
    background: var(--sunken);
    box-shadow:
      0 0 0 1px var(--ring),
      0 12px 32px -16px var(--shadow);
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    padding: 0.5rem 0.25rem 0;
    font: 0.8rem/1.4 var(--mono);
    font-variant-numeric: tabular-nums;
    background: var(--bg);
  }

  a {
    margin-inline-start: auto;
    color: var(--accent);
  }

  .file {
    font-weight: 600;
  }

  .muted {
    color: var(--muted);
  }

  .error {
    margin: 0.5rem 0 0;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    font: 0.8rem/1.4 var(--mono);
    color: var(--hot);
    background: color-mix(in oklch, var(--hot) 10%, transparent);
  }

  @media (width >= 70rem) {
    .stage {
      position: static;
    }

    img {
      inline-size: min(100%, (100dvh - 24rem) * 16 / 9);
    }
  }
</style>
