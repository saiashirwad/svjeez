# @svjeez/live

Build a source-based scene editor with a framework-free store. A change rewrites a literal in the TypeScript, compiles it in a worker and keeps the preview at its current time.

```sh
npm i @svjeez/live svjeez
```

```ts
import { createEditor } from "@svjeez/live";

const editor = createEditor({ text: sceneSource });
const unsubscribe = editor.subscribe((state) => {
  // Render state.text, state.values and state.picture.url.
});

editor.send({ type: "set", key: "default:circle.cx", value: 64 });
editor.send({ type: "undo" });

// When the view is disposed:
unsubscribe();
editor.destroy();
```

Read editable keys from `state.values`. Use `editor.send()` to replace source, select a control or move the clock. Compilation starts on subscription. To edit literals in a shell, use `svjeez values scene.tsx` and `svjeez set scene.tsx key=value`.

Use [@svjeez/react](https://www.npmjs.com/package/@svjeez/react) or [@svjeez/svelte](https://www.npmjs.com/package/@svjeez/svelte) for ready-made controls and `@svjeez/live/editor.css` for their styles.

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/edit.md)
