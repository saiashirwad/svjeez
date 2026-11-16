<script>
  import { Code, Picture, SceneEditor, Transport } from "@svjeez/svelte";
  import "@svjeez/live/editor.css";
  import { scene } from "./scene.js";

  const dot = new SceneEditor(scene);
</script>

<Picture editor={dot} />
<Transport editor={dot} />
<Code editor={dot} file="dot.tsx" />
