<script lang="ts">
  import { statsOf } from "@svjeez/live";
  import type { SceneEditor } from "./editor.js";

  let { editor }: { editor: SceneEditor } = $props();

  const stats = $derived(editor.state.stats);
</script>

<p class="sj-stats">
  {#if stats}{#each statsOf(stats) as stat (stat.label)}<span class="sj-stat"
        ><b>{stat.value}</b> {stat.label}</span
      >{/each}{/if}
</p>
