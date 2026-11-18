# @svjeez/svelte

Svelte 5 components for editing svjeez scene source with a preview, playback controls and controls for editable literals.

```sh
npm i @svjeez/svelte @svjeez/live svjeez
```

```svelte
<script lang="ts">
  import { Code, Picture, SceneEditor, Transport } from "@svjeez/svelte";
  import "@svjeez/live/editor.css";
  import { onDestroy } from "svelte";
  import text from "./lanterns.tsx?raw";

  const scene = new SceneEditor(text);
  onDestroy(scene.destroy);
</script>

<Picture editor={scene} />
<Transport editor={scene} />
<Code editor={scene} file="lanterns.tsx" />
```

Create a `SceneEditor` for the source and destroy it when the component unmounts. Read custom state from `scene.state`. Pass `first` when you have a prebuilt preview from [@svjeez/vite](https://www.npmjs.com/package/@svjeez/vite). Use the shared stylesheet’s `--sj-*` custom properties to theme the components.

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/edit.md)
