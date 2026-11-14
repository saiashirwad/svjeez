<script lang="ts">
  import type { Value } from "@svjeez/live";
  import ChoiceControl from "./ChoiceControl.svelte";
  import ColorControl from "./ColorControl.svelte";
  import EaseControl from "./EaseControl.svelte";
  import type { SceneEditor } from "./editor.js";
  import NumberControl from "./NumberControl.svelte";

  let { editor, value }: { editor: SceneEditor; value: Value } = $props();
</script>

{#if value.kind === "number"}
  <NumberControl {editor} {value} />
{:else if value.kind === "color"}
  <ColorControl {editor} {value} />
{:else if value.kind === "ease"}
  <EaseControl {editor} {value} />
{:else}
  <ChoiceControl {editor} {value} />
{/if}
