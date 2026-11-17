<script lang="ts">
  import "@svjeez/live/editor.css";
  import { onDestroy } from "svelte";
  import { Code, Picture, SceneEditor, Stats, Transport } from "../../src/index";
  import handled from "./handles.tsx?raw";
  import plain from "./scene.tsx?raw";
  import titled from "./text.tsx?raw";

  const scene = new URLSearchParams(location.search).get("scene");
  const ed = new SceneEditor(scene === "handles" ? handled : scene === "text" ? titled : plain);

  onDestroy(ed.destroy);
</script>

<main>
  <Picture editor={ed} />
  <Transport editor={ed} />
  <Stats editor={ed} />
  <Code editor={ed} file="scene.tsx" />
  <button type="button" onclick={() => ed.send({ type: "undo" })}>Undo</button>
  <button
    type="button"
    onclick={() => ed.send({ type: "replace", text: `${ed.state.text}\nexport const broken = ;` })}
    >Break</button
  >
</main>

<style>
  main {
    display: grid;
    gap: 1rem;
    max-inline-size: 48rem;
    margin: 1rem auto;
    color-scheme: dark;
  }
</style>
