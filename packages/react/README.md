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

`useEditor(text, { first })` reads its arguments once. `first` is a picture to show until the first compile: with [`@svjeez/vite`](https://www.npmjs.com/package/@svjeez/vite), pass the module `import first from "./lanterns.tsx?svjeez"` gives. The editor compiles in a worker that starts when the component mounts, so a server render starts none, and it stops when the component unmounts.

`scene.state` is the `@svjeez/live` state and `scene.send(message)` changes it: the same messages a control sends, so a page or an agent can drive the editor too. To load a new file, send `{ type: "replace", text }`.

### Your own controls

`Code` takes a `control` render prop. It gets each value and the built-in control, already rendered:

```tsx
<Code editor={scene} control={(value, plain) => (value.label === "swing" ? <Knob value={value} editor={scene} /> : plain)} />
```

Send `{ type: "set", key: value.key, value: next }` from it, with `continues: true` on every step of a drag after the first so undo takes the drag whole.

### Styles

`@svjeez/live/editor.css` styles every component. Theme it with the `--sj-*` custom properties it lists at the top.
