<script lang="ts">
  import { getBench } from "./bench.svelte";
  import { flashOnChange } from "./flash";
  import { codeLines, legColor, type CodeLine } from "./view";

  // The scene source, with the values the lab edits flashing as they change.
  const bench = getBench();
  const lines = $derived(codeLines(bench.source));
</script>

{#snippet parts(line: CodeLine)}
  {#each line.pieces as piece, k (k)}
    {#if piece.kind === "literal"}
      <span class="val" {@attach flashOnChange(piece.text)}>{piece.text}</span>
    {:else if piece.kind === "plain"}
      {piece.text}
    {:else}
      <span class="c-{piece.kind}">{piece.text}</span>
    {/if}
  {/each}
{/snippet}

<div class="frame"><pre class="source"><code>{#each lines as line, i (i)}{#if i}{"\n"}{/if}{#if line.leg === undefined}{@render parts(line)}{:else}<span class={["leg", { hot: bench.hot === line.leg }]} style:--leg={legColor(line.leg)}>{@render parts(line)}</span>{/if}{/each}</code></pre></div>

<style>
  /* Long lines scroll sideways rather than wrap, so each leg's lines stay whole. An edge fades while there is more
     source past it, and the code box is as wide as its longest line so a leg's band spans every line it marks. */
  @property --lc-before {
    syntax: "<length>";
    inherits: false;
    initial-value: 0px;
  }
  @property --lc-after {
    syntax: "<length>";
    inherits: false;
    initial-value: 0px;
  }
  @keyframes lc-edges {
    from {
      --lc-before: 0px;
      --lc-after: 2rem;
    }
    10%,
    90% {
      --lc-before: 2rem;
      --lc-after: 2rem;
    }
    to {
      --lc-before: 2rem;
      --lc-after: 0px;
    }
  }
  .frame {
    flex: 1 1 24rem;
    min-inline-size: 0;
    display: flex;
    max-block-size: 44rem;
    background: var(--sunken);
    border-radius: var(--radius);
    box-shadow: inset 0 0 0 1px var(--ring);
  }
  .source {
    flex: 1;
    min-inline-size: 0;
    margin: 0;
    padding: 1rem 1.1rem;
    overflow: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
    animation: lc-edges linear;
    animation-timeline: scroll(self inline);
    mask-image: linear-gradient(
      to right,
      transparent,
      #000 var(--lc-before),
      #000 calc(100% - var(--lc-after)),
      transparent
    );
    font: 400 0.72rem / 1.6 var(--mono);
    color: var(--code-plain, var(--ink));
    tab-size: 2;
  }
  .source code {
    display: block;
    inline-size: max-content;
    min-inline-size: 100%;
  }
  .c-comment {
    color: var(--code-comment, var(--muted));
  }
  .c-string {
    color: var(--code-string, inherit);
  }
  .c-keyword {
    color: var(--code-keyword, inherit);
  }
  .c-number {
    color: var(--code-number, inherit);
  }
  .c-fn {
    color: var(--code-fn, inherit);
  }
  .c-tag {
    color: var(--code-tag, inherit);
  }
  .c-punct {
    color: var(--code-punct, inherit);
  }
  .val {
    color: var(--code-number, var(--accent));
    font-weight: 700;
    border-radius: 3px;
  }
  .leg {
    display: inline-block;
    min-inline-size: 100%;
    margin-inline: -1.1rem;
    padding-inline: calc(1.1rem - 3px) 1.1rem;
    border-inline-start: 3px solid var(--leg);
  }
  .leg.hot {
    background: color-mix(in oklch, var(--leg) 16%, transparent);
  }
</style>
