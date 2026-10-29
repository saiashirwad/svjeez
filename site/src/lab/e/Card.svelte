<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { certificate, mutate, random, taxon } from "./genome";
  import { getLab } from "./lab.svelte";

  const lab = getLab();
  const cert = $derived(certificate(lab.genome));

  /** The certificate stamps itself down again whenever the lab asks. */
  const stamp: Attachment<HTMLElement> = (el) => {
    if (lab.stamps)
      el.animate(
        [
          { transform: "rotate(-8deg) scale(1.6)", opacity: 0 },
          { transform: "rotate(-4deg) scale(1)", opacity: 1 },
        ],
        { duration: 260, easing: "cubic-bezier(.3,1.6,.5,1)" },
      );
  };

  const onmutate = () => {
    const m = mutate(lab.genome);
    lab.set(m.genome, { shelve: true, lineage: m.tooFar ? "mutated too far" : "" });
    lab.restamp();

    if (m.tooFar) lab.shakes++;
  };

  const ondice = () => {
    lab.set(random(), { shelve: true });
    lab.restamp();
  };
</script>

<header class="le-card">
  <p class="le-no">No. {lab.no} <span class="muted">{lab.staged.lineage}</span></p>
  <h1>{taxon(lab.genome)}</h1>
  <p class="le-stamp" data-grade={cert.grade} {@attach stamp}>
    <span>ISO 1-CAT:2026</span>
    <b>{cert.verdict}</b>
  </p>
  <div class="le-actions">
    <button type="button" onclick={onmutate}>Mutate</button>
    <button type="button" onclick={() => lab.breedAny()}>Breed</button>
    <button type="button" class="le-dice" aria-label="Random specimen" onclick={ondice}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4"></rect>
        <circle cx="8" cy="8" r="1.6"></circle>
        <circle cx="16" cy="8" r="1.6"></circle>
        <circle cx="12" cy="12" r="1.6"></circle>
        <circle cx="8" cy="16" r="1.6"></circle>
        <circle cx="16" cy="16" r="1.6"></circle>
      </svg>
    </button>
  </div>
  <p class="le-meta">
    <span class="file">{lab.drawn?.file ?? "compiling…"}</span>
    <span>{lab.drawn?.gzip}</span>
    <span class="muted">{lab.drawn?.ms}</span>
    <a href={lab.drawn?.href} download={lab.drawn?.download ?? "catoid.svg"}>save .svg</a>
  </p>
</header>

<style>
  .le-card {
    position: relative;
    padding: 0.75rem 0.9rem 0.8rem;
    border-radius: 0.5rem;
    background: var(--label);
    color: var(--label-ink);
    box-shadow:
      0 0 0 1px var(--ring),
      0 1px 0 var(--ring);
    font-family: var(--mono);
  }

  .muted {
    color: var(--muted);
  }

  .le-no {
    margin: 0;
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }

  h1 {
    margin: 0.15rem 0 0.45rem;
    min-block-size: 2.5em;
    font:
      italic 600 1.05rem/1.25 Georgia,
      "Iowan Old Style",
      "Times New Roman",
      serif;
    letter-spacing: -0.01em;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  .le-stamp {
    --grade: var(--grade-1);
    display: inline-grid;
    margin: 0 0 0.55rem;
    padding: 0.15rem 0.5rem;
    border: 2px solid var(--grade);
    border-radius: 0.3rem;
    color: var(--grade);
    font-size: 0.68rem;
    line-height: 1.3;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    rotate: -4deg;
    mix-blend-mode: multiply;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme="light"])) .le-stamp {
      mix-blend-mode: normal;
    }
  }
  :global(:root[data-theme="dark"]) .le-stamp {
    mix-blend-mode: normal;
  }

  .le-stamp[data-grade="0"] {
    --grade: var(--grade-0);
  }
  .le-stamp[data-grade="2"] {
    --grade: var(--grade-2);
  }
  .le-stamp[data-grade="3"] {
    --grade: var(--grade-3);
  }

  .le-stamp b {
    font-size: 0.82rem;
  }

  .le-actions {
    display: flex;
    gap: 0.5rem;
  }

  .le-actions button {
    flex: 1;
    padding: 0.45rem 0.6rem;
    border: 0;
    border-radius: 0.45rem;
    background: var(--ink);
    color: var(--bg);
    font: 600 0.85rem var(--sans);
    cursor: pointer;
  }

  .le-actions button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .le-actions button:active {
    scale: 0.96;
  }

  @media (hover: hover) and (pointer: fine) {
    .le-actions button:hover {
      background: color-mix(in oklch, var(--ink) 82%, var(--hot));
    }
  }

  .le-actions .le-dice {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    padding-inline: 0.5rem;
  }

  .le-dice svg {
    inline-size: 1.3rem;
    block-size: 1.3rem;
  }

  .le-dice rect {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
  }

  .le-dice circle {
    fill: currentColor;
  }

  .le-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.75rem;
    margin: 0.6rem 0 0;
    font: 0.72rem/1.4 var(--mono);
    font-variant-numeric: tabular-nums;
  }

  .le-meta .file {
    font-weight: 600;
  }

  .le-meta a {
    margin-inline-start: auto;
    color: var(--accent);
  }
</style>
