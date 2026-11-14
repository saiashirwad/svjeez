<script lang="ts">
  import type { Value } from "@svjeez/live";
  import type { Snippet } from "svelte";
  import Control from "./Control.svelte";
  import type { SceneEditor } from "./editor.js";

  let {
    editor,
    file,
    control,
  }: {
    editor: SceneEditor;
    /** A file name for the header. */
    file?: string;
    /** Draws a value's control in place of the built-in one. Render `plain` to keep the built-in one. */
    control?: Snippet<[value: Value, plain: Snippet]>;
  } = $props();

  const doc = $derived(editor.state);
  const values = $derived(new Map(doc.values.map((v) => [v.key, v])));
  const error = $derived(doc.error);

  const history = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
    e.preventDefault();
    editor.send({ type: e.shiftKey ? "redo" : "undo" });
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="sj-code" aria-label="Scene source" onkeydown={history}>
  {#if file}<header class="sj-file">{file}</header>{/if}
  <pre class="sj-source"><code
      >{#each doc.lines as line (line.n)}<span class="sj-line"
          >{#each line.pieces as piece (piece.kind === "literal" ? piece.literal.key : piece.start)}{#if piece.kind === "literal"}{@const value = values.get(piece.literal.key)}{#if value}{#snippet plain()}<Control
                  {editor}
                  {value}
                />{/snippet}{#if control}{@render control(value, plain)}{:else}{@render plain()}{/if}{/if}{:else}<span class="sj-{piece.kind}">{piece.text}</span>{/if}{/each}</span
        >{/each}</code
    ></pre>
  <p class="sj-error" role="status" hidden={!error}>
    {#if error}{error.line ? `Line ${error.line}: ` : ""}{error.message}{/if}
  </p>
</section>
