<script>
  import { Code, editor, Picture, Transport } from "@svjeez/svelte";
  import "@svjeez/live/editor.css";
  import { scene } from "./scene.js";

  const dot = editor(scene);
</script>

<Picture editor={dot} />
<Transport editor={dot} />
<Code editor={dot} file="dot.tsx" />
