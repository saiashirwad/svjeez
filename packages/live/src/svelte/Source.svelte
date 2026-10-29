<!--
  The scene's source as it now stands, highlighted, with each param's value marked and the active one marked more.
  Long lines scroll sideways. Colours come from the page: --win-bg, --line, --muted, --mono, --radius, --ring, --shadow,
  --out, and --code-plain, -keyword, -string, -number, -fn, -tag, -punct, -comment and -muted.
-->
<script lang="ts">
  import { linesOf, parse } from "../source";

  let {
    scene,
    file,
  }: { scene: { readonly source: string; readonly active: string | null }; file: string } =
    $props();

  /** The file as highlighted lines, with each param's value a piece of its own. */
  const lines = $derived(
    linesOf(parse(scene.source.trimEnd()), (l) => !!l.param && !l.param.option),
  );
</script>

<section class="window" aria-label="Scene source">
  <header>{file}</header>
  <pre class="code"><code
      >{#each lines as line (line.n)}<span class="line"
          >{#each line.pieces as piece (piece.start)}{#if piece.kind === "literal"}<mark
                class={{ active: piece.literal.param?.key === scene.active }}>{piece.text}</mark
              >{:else}<span class="c-{piece.kind}">{piece.text}</span>{/if}{/each}</span
        >{/each}</code
    ></pre>
</section>

<style>
  .window {
    min-inline-size: 0;
    background: var(--win-bg);
    border-radius: var(--radius);
    box-shadow:
      0 0 0 1px var(--ring),
      0 1.25rem 2.5rem -1.25rem var(--shadow);
    overflow: clip;
  }
  header {
    padding: 0.6rem 1rem;
    border-block-end: 1px solid var(--line);
    font: 0.8rem var(--mono);
    color: var(--muted);
  }

  /* Long lines scroll sideways rather than wrap, and the right edge fades while there is more to the right. */
  @property --more {
    syntax: "<length>";
    inherits: false;
    initial-value: 0px;
  }
  @keyframes more {
    from,
    90% {
      --more: 2.5rem;
    }
    to {
      --more: 0px;
    }
  }
  .code {
    margin: 0;
    padding-block: 0.75rem;
    font: 0.78rem/1.7 var(--mono);
    color: var(--code-plain);
    tab-size: 2;
    font-variant-ligatures: none;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
    animation: more linear;
    animation-timeline: scroll(self inline);
    mask-image: linear-gradient(to left, transparent, #000 var(--more));
    counter-reset: line;
  }
  code {
    display: grid;
    grid-template-columns: minmax(100%, max-content);
  }
  .line {
    padding-inline-end: 1rem;
    white-space: pre;
  }
  .line::before {
    counter-increment: line;
    content: counter(line);
    display: inline-block;
    inline-size: 2.25rem;
    margin-inline-end: 1rem;
    text-align: end;
    color: color-mix(in oklch, var(--code-comment) 60%, transparent);
    user-select: none;
  }

  mark {
    padding-inline: 0.15em;
    margin-inline: -0.15em;
    border-radius: 0.25rem;
    background: color-mix(in oklch, var(--code-number) 12%, transparent);
    color: var(--code-number);
    transition: background-color 0.15s var(--out);
  }
  mark.active {
    background: color-mix(in oklch, var(--code-number) 30%, transparent);
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--code-number) 60%, transparent);
  }

  .c-keyword {
    color: var(--code-keyword);
  }
  .c-string {
    color: var(--code-string);
  }
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
</style>
