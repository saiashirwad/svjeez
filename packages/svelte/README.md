# @svjeez/svelte

Svelte components for editing a [svjeez](https://www.npmjs.com/package/svjeez) scene through its own source. `Code` shows the file with a control on every number, color and ease: drag a number sideways, pick a color, bend an ease's curve. `Picture` shows the scene as it compiles, with a handle to drag for the selected number, and `Transport` plays, pauses and scrubs it. Every change rewrites one literal in the file, so the code stays the code.

The store underneath is [`@svjeez/live`](https://www.npmjs.com/package/@svjeez/live); [`@svjeez/react`](https://www.npmjs.com/package/@svjeez/react) renders the same components for React.

## Install

```sh
npm i @svjeez/svelte @svjeez/live svjeez
```

## Use

```svelte
<script lang="ts">
  import { Code, editor, Picture, Transport } from "@svjeez/svelte";
  import "@svjeez/live/editor.css";
  import { onDestroy } from "svelte";
  import text from "./lanterns.tsx?raw";

  const scene = editor(text);
  onDestroy(scene.destroy);
</script>

<Picture editor={scene} />
<Transport editor={scene} />
<Code editor={scene} file="lanterns.tsx" />
```

`editor(text, { first })` takes a picture to show until the first compile: with [`@svjeez/vite`](https://www.npmjs.com/package/@svjeez/vite), pass the module `import first from "./lanterns.tsx?svjeez"` gives. The editor compiles in a worker, which starts the first time a component reads its state in the browser, so a server render starts none. Add `duration` to `first` if the page knows it, and the transport works before the first compile. The editor pauses, its worker stopped, whenever no component reads its state.

`scene.state` is the `@svjeez/live` state, reactive, and `scene.send(message)` changes it: the same messages a control sends, so a page or an agent can drive the editor too.

### Your own controls

`Code` takes a `control` snippet. It gets each value and a `plain` snippet that renders the built-in control:

```svelte
<Code editor={scene}>
  {#snippet control(value, plain)}
    {#if value.label === "swing"}<Knob {value} editor={scene} />{:else}{@render plain()}{/if}
  {/snippet}
</Code>
```

Send `{ type: "set", key: value.key, value: next }` from it, with `continues: true` on every step of a drag after the first so undo takes the drag whole.

### Styles

`@svjeez/live/editor.css` styles every component. Theme it with the `--sj-*` custom properties it lists at the top.
