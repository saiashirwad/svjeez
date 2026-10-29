<script lang="ts">
  import type { ValueOf } from "@svjeez/live";
  import type { SceneEditor } from "./editor.js";
  import { selection } from "./selection.js";

  let { editor, value }: { editor: SceneEditor; value: ValueOf<"choice"> } = $props();

  const selected = $derived(editor.state.selected === value.key);
</script>

<select
  class="sj-choice"
  data-sj-key={value.key}
  data-selected={selected || undefined}
  aria-label={value.label || "choice"}
  value={value.literal.value}
  onchange={(e) =>
    editor.send({ type: "set", key: value.key, value: e.currentTarget.value })}
  {...selection(editor, () => value.key)}
>
  {#each value.options as option (option)}
    <option value={option}>{option}</option>
  {/each}
</select>
