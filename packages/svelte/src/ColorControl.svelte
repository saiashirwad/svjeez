<script lang="ts">
  import { rgbOf, withRgb, type ValueOf } from "@svjeez/live";
  import type { SceneEditor } from "./editor.js";
  import { selection } from "./selection.js";

  let { editor, value }: { editor: SceneEditor; value: ValueOf<"color"> } = $props();

  const selected = $derived(editor.state.selected === value.key);

  /** Whether the picker has sent a step already, so undo takes one pick whole. */
  let going = false;

  const pick = (e: Event & { currentTarget: HTMLInputElement }) => {
    editor.send({
      type: "set",
      key: value.key,
      value: withRgb(value.literal.value, e.currentTarget.value),
      continues: going,
    });
    going = true;
  };
</script>

<span
  class="sj-color"
  data-sj-key={value.key}
  data-selected={selected || undefined}
  {...selection(editor, () => value.key)}
  ><input
    class="sj-swatch"
    type="color"
    aria-label="{value.label || 'color'}, {value.literal.value}"
    value={rgbOf(value.literal.value)}
    oninput={pick}
    onchange={() => (going = false)}
  /><span class="sj-string">{value.literal.text}</span></span
>
