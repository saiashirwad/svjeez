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

<pre class="source"><code>{#each lines as line, i (i)}{#if i}{"\n"}{/if}{#if line.leg === undefined}{@render parts(line)}{:else}<span class={["leg", { hot: bench.hot === line.leg }]} style:--leg={legColor(line.leg)}>{@render parts(line)}</span>{/if}{/each}</code></pre>

<style>
  .source {
    flex: 1 1 24rem;
    min-inline-size: 0;
    margin: 0;
    padding: 1rem 1.1rem;
    max-block-size: 44rem;
    overflow: auto;
    background: var(--sunken);
    border-radius: var(--radius);
    box-shadow: inset 0 0 0 1px var(--ring);
    font: 400 0.72rem / 1.6 var(--mono);
    color: var(--code-plain, var(--ink));
    tab-size: 2;
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
