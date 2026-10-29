# @svjeez/live

Edit a [svjeez](https://www.npmjs.com/package/svjeez) scene through its own source. Every number, color and ease in the file becomes a control: drag a number sideways, pick a color, bend an ease. Each change rewrites only that literal, compiles the file in a worker, and swaps in the new picture at the moment the old one had reached. The file stays the one its author, or an AI, wrote.

This package is the store and the control math, with no framework in it. [`@svjeez/svelte`](https://www.npmjs.com/package/@svjeez/svelte) and [`@svjeez/react`](https://www.npmjs.com/package/@svjeez/react) render it.

## Install

```sh
npm i @svjeez/live svjeez
```

## Use

```ts
import { createEditor } from "@svjeez/live";

const editor = createEditor({ text: sceneSource });

editor.subscribe((state) => {
  // state.text is the file, state.values its controls, state.picture.url the picture to show
});

editor.send({ type: "set", key: "default#0", value: 64 }); // a dial, a drag or an agent
editor.send({ type: "replace", text: rewritten }); // typing, or an AI rewrite
editor.send({ type: "undo" });
```

The editor compiles nothing until something subscribes, so a server can render the code panel from `getState()` without starting a worker.

### Values

`state.values` lists every literal a control can edit, in source order. Each has a `key` that stays with its literal as other values change: `params.swing` for a param, `legs.1.over` for a literal inside a const, else its top-level declaration and its place there, as in `default#3`.

A number's `param` gives the range a drag moves it through. A scene can declare it with `export const params` from `svjeez/params`; otherwise it is read from where the number sits, so `opacity` runs 0 to 1, `rotate` −360 to 360, and an `at`, an `over` or the length passed to `.to()` is in seconds.

### Messages

| Message | What it does |
| --- | --- |
| `{ type: "set", key, value, continues? }` | Writes a value into its literal. `continues` marks a step of a drag already under way, so undo takes the whole drag. |
| `{ type: "replace", text }` | Replaces the file. The selected value stays selected when its key survives. |
| `{ type: "undo" }`, `{ type: "redo" }` | Steps through the file's history. |
| `{ type: "select", key }` | Marks the value a control has focus on, or `null`. |
| `{ type: "play" }`, `{ type: "pause" }`, `{ type: "seek", at }` | Moves the picture's clock. The picture is shown again from that moment. |

`update(state, msg)` is the same logic as a pure function, returning the next state and the commands it asks for.

### Handles

A scene that exports `handles` from `svjeez/params` gets a handle on its picture for each number param. `handleOf(state, key)` says where it sits and which way it moves, and `follow` from `svjeez/params` turns a drag into a value.

### Styles

`@svjeez/live/editor.css` styles the components both framework packages render. Theme it with the `--sj-*` custom properties it lists at the top.
