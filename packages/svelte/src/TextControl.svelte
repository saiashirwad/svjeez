<script lang="ts">
  import type { ValueOf } from "@svjeez/live";
  import type { SceneEditor } from "./editor.js";
  import { focusing } from "./selection.js";

  let { editor, value }: { editor: SceneEditor; value: ValueOf<"text"> } = $props();

  const selected = $derived(editor.state.selected === value.key);
</script>

<input
  class="sj-text"
  type="text"
  data-sj-key={value.key}
  data-selected={selected || undefined}
  aria-label={value.label || "text"}
  maxlength={value.maxLength}
  value={value.literal.value}
  oninput={(e) => editor.send({ type: "set", key: value.key, value: e.currentTarget.value })}
  {...focusing(editor, () => value.key)}
/>
