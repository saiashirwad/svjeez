<script lang="ts">
  import { valueOf } from "@svjeez/live";
  import type { SceneEditor } from "./editor.js";
  import Grip from "./Grip.svelte";

  let { editor }: { editor: SceneEditor } = $props();

  const doc = $derived(editor.state);
  const picture = $derived(doc.picture);
</script>

<figure class="sj-picture">
  {#if picture}
    <img
      class="sj-img"
      src={picture.url}
      alt={picture.scene.title}
      width={picture.scene.width || undefined}
      height={picture.scene.height || undefined}
    />
    {#each Object.entries(doc.grips) as [key, grip] (key)}
      {@const value = valueOf(doc, key)}
      {#if value?.kind === "number"}
        <Grip {editor} {value} {grip} scene={picture.scene} />
      {/if}
    {/each}
  {/if}
</figure>
