# @svjeez/react

React components for editing a [svjeez](https://www.npmjs.com/package/svjeez) scene through its own source. `Code` shows the file with a control on every number, color and ease: drag a number sideways, pick a color, bend an ease's curve. `Picture` shows the scene as it compiles, with a handle to drag for the selected number, and `Transport` plays, pauses and scrubs it. Every change rewrites one literal in the file, so the code stays the code.

The store underneath is [`@svjeez/live`](https://www.npmjs.com/package/@svjeez/live); [`@svjeez/svelte`](https://www.npmjs.com/package/@svjeez/svelte) renders the same components for Svelte.

## Install

```sh
npm i @svjeez/react @svjeez/live svjeez
```

## Use

```tsx
import "@svjeez/live/editor.css";
import { Code, Picture, Transport, useEditor } from "@svjeez/react";

export const Lanterns = ({ source }: { source: string }) => {
  const scene = useEditor(source);

  return (
    <main>
      <Picture editor={scene} />
      <Transport editor={scene} />
      <Code editor={scene} file="lanterns.tsx" />
    </main>
  );
};
```

`useEditor(text, { first })` reads its arguments once. `first` is a picture to show until the first compile: with [`@svjeez/vite`](https://www.npmjs.com/package/@svjeez/vite), pass the module `import first from "./lanterns.tsx?svjeez"` gives. Add `duration` to `first` if the page knows it, and the transport works before the first compile. The editor compiles in a worker that starts when a component first reads it, so a server render starts none. It pauses whenever no component reads it, under a hidden `<Activity>` or after an unmount, and picks up again when one does; `scene.destroy()` frees its last picture for good.

`useEditorState(scene)` reads the `@svjeez/live` state and re-renders on each change, and `useEditorState(scene, (s) => s.selected)` reads one part of it. `scene.send(message)` changes it: the same messages a control sends, so a page or an agent can drive the editor too. To load a new file, send `{ type: "replace", text }`.

### Your own controls

`Code` takes a `control` render prop. It gets each value and the built-in control, already rendered:

```tsx
<Code editor={scene} control={(value, plain) => (value.label === "swing" ? <Knob value={value} editor={scene} /> : plain)} />
```

Send `{ type: "set", key: value.key, value: next }` from it, or use the gestures `@svjeez/live` exports, such as `scrubbing(scene, value, x)`, which make a whole drag one undo step.

### Styles

`@svjeez/live/editor.css` styles every component. Theme it with the `--sj-*` custom properties it lists at the top.
