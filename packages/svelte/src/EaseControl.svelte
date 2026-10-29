<script lang="ts">
  import { curveOf, type ValueOf } from "@svjeez/live";
  import type { SceneEditor } from "./editor.js";
  import EasePop from "./EasePop.svelte";
  import { selection } from "./selection.js";

  let { editor, value }: { editor: SceneEditor; value: ValueOf<"ease"> } = $props();

  const selected = $derived(editor.state.selected === value.key);
  let open = $state(false);
  let glyph: HTMLButtonElement | undefined = $state();

  const d = $derived(
    curveOf(value.literal.value)
      .map((p, k) => `${k ? "L" : "M"}${(p.x * 24).toFixed(2)} ${(18 - p.y * 18).toFixed(2)}`)
      .join(""),
  );
</script>

<span
  class="sj-ease"
  data-sj-key={value.key}
  data-selected={selected || undefined}
  {...selection(editor, () => value.key)}
  ><button
    bind:this={glyph}
    class="sj-glyph"
    type="button"
    aria-label="Bend {value.label || 'ease'}"
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={() => (open = !open)}
    ><svg viewBox="-2 -8 28 28" aria-hidden="true"
      ><rect class="sj-box" x="0" y="0" width="24" height="18" rx="2" /><path
        class="sj-path"
        {d}
      /></svg
    ></button
  ><span class="sj-ease-text">{value.literal.text}</span
  >{#if open && glyph}<EasePop
      {editor}
      {value}
      anchor={glyph}
      onclose={() => (open = false)}
    />{/if}</span
>
