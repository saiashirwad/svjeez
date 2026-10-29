<script lang="ts">
  import ColorToken from "./ColorToken.svelte";
  import EaseToken from "./EaseToken.svelte";
  import { getLab } from "./lab.svelte";
  import NumToken from "./NumToken.svelte";

  const lab = getLab();
</script>

<section class="la-win la-codewin" aria-label="Scene source">
  <div class="la-bar-top">
    <span class="la-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="la-file">meadow.tsx</span>
    <button type="button" class="la-btn la-reset" onclick={() => lab.reset()}>Reset</button>
  </div>
  <div class="la-code" spellcheck="false" role="presentation" onpointerleave={() => lab.leaveCode()}>
    {#each lab.lines as line (line.n)}
      <div
        class={[
          "la-line",
          {
            "is-hot": lab.hot.lines.has(line.n),
            "is-live": lab.live.has(line.n),
          },
        ]}
        data-line={line.n}
        role="presentation"
        onpointerover={() => lab.hoverLine(line.n)}
      >
        <span class="la-no">{line.n}</span><span class="la-tx"
          >{#each line.pieces as t (t.start)}{#if t.kind !== "literal"}<span class="c-{t.kind}">{t.text}</span
              >{:else if t.literal.kind === "number"}<NumToken literal={t.literal} />{:else if t.literal.kind === "color"}<ColorToken
                literal={t.literal}
              />{:else if t.literal.kind === "ease"}<EaseToken literal={t.literal} />{/if}{/each}</span
        >
      </div>
    {/each}
  </div>
</section>

<style>
  .la-win {
    background: var(--win-bg);
    border-radius: var(--radius);
    box-shadow:
      0 0 0 1px var(--ring),
      0 1.25rem 2.5rem -1.25rem var(--shadow);
    overflow: clip;
  }
  .la-bar-top {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
    border-block-end: 1px solid var(--line);
    font: 0.8rem var(--mono);
    color: var(--muted);
  }
  .la-dots {
    display: inline-flex;
    gap: 0.35rem;
  }
  .la-dots i {
    inline-size: 0.65rem;
    block-size: 0.65rem;
    border-radius: 50%;
    background: var(--line);
  }
  .la-file {
    flex: 1;
  }

  /* Long lines scroll sideways rather than wrap, so each row stays one source line for the line-linked highlights. The
     numbers stay put while the text scrolls under them, and the right edge fades while there is more to the right. */
  @property --la-more {
    syntax: "<length>";
    inherits: false;
    initial-value: 0px;
  }
  @keyframes la-more {
    from,
    90% {
      --la-more: 2.5rem;
    }
    to {
      --la-more: 0px;
    }
  }
  .la-code {
    display: grid;
    grid-template-columns: minmax(100%, max-content);
    padding-block: 0.75rem;
    font: 0.82rem/1.75 var(--mono);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
    --la-more: 0px;
    animation: la-more linear;
    animation-timeline: scroll(self inline);
    mask-image: linear-gradient(to left, transparent, #000 var(--la-more));
    color: var(--code-plain);
    tab-size: 2;
    font-variant-ligatures: none;
  }
  .la-line {
    --la-row: transparent;
    display: flex;
    padding-inline-end: 1rem;
    white-space: pre;
    background: var(--la-row);
  }
  .la-no {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    flex: none;
    inline-size: 3rem;
    padding-inline-end: 1rem;
    text-align: end;
    background: linear-gradient(var(--la-row), var(--la-row)) var(--win-bg);
    color: color-mix(in oklch, var(--code-comment) 60%, transparent);
    user-select: none;
    -webkit-user-select: none;
  }
  .la-no::before {
    content: "";
    position: absolute;
    inset-block: 0.3em;
    inset-inline-start: 0;
    inline-size: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--la-live);
    opacity: 0;
  }
  .la-line.is-live .la-no::before {
    opacity: 1;
  }
  .la-line.is-live .la-no {
    color: var(--la-live);
  }
  .la-line.is-hot {
    --la-row: var(--la-hot);
  }
  @media (prefers-reduced-motion: no-preference) {
    .la-no::before {
      transition: opacity 120ms var(--out);
    }
  }

  .la-code :global {
    .c-keyword {
      color: var(--code-keyword);
    }
    .c-string {
      color: var(--code-string);
    }
    .c-num,
    .c-number {
      color: var(--code-number);
    }
    .c-fn {
      color: var(--code-fn);
    }
    .c-tag {
      color: var(--code-tag);
    }
    .c-attr {
      color: var(--code-muted, var(--code-plain));
    }
    .c-punct {
      color: var(--code-punct);
    }
    .c-comment {
      color: var(--code-comment);
    }
  }
</style>
