<script lang="ts">
  import { rgbOf, stroke, withRgb, type ValueOf } from "@svjeez/live";
  import type { SceneEditor } from "./editor.js";
  import { focusing } from "./selection.js";

  let { editor, value }: { editor: SceneEditor; value: ValueOf<"color"> } = $props();

  const selected = $derived(editor.state.selected === value.key);

  /** The pick under way, so undo takes it whole. */
  let pick: ReturnType<typeof stroke<"color">> | null = null;

  const picked = (e: Event & { currentTarget: HTMLInputElement }) =>
    (pick ??= stroke<"color">(editor, value.key))(withRgb(value.literal.value, e.currentTarget.value));
</script>

<span
  class="sj-color"
  data-sj-key={value.key}
  data-selected={selected || undefined}
  {...focusing(editor, () => value.key)}
  ><input
    class="sj-swatch"
    type="color"
    aria-label="{value.label || 'color'}, {value.literal.value}"
    value={rgbOf(value.literal.value)}
    oninput={picked}
    onchange={() => (pick = null)}
  /><span class="sj-string">{value.literal.text}</span></span
>
