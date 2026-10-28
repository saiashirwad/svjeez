# Without JSX

`el` builds the same elements as JSX, with the same props and type checking. Each tag is a function of `(props, children)`. A scene built with `el` renders the same bytes as its JSX twin. `.ts` files work with no pragma and no `jsxImportSource`.

```ts
import { draw, ease, el, enter, render } from "svjeez";

const { circle, g, path } = el;

const svg = render({ width: 200, height: 120, duration: 4, title: "Hello" }, [
  path({ d: "M20 100C60 20 140 20 180 100", fill: "none", stroke: "#FF5FA8", strokeWidth: 4, animation: draw({ at: 0.2, over: 1.2 }) }),
  g({ opacity: 0.9 }, [circle({ cx: 100, cy: 40, r: 8, fill: "#3EE6D6", animation: enter({ at: 1.2, over: 0.5 }, { scale: 0 }, ease.pop) })]),
  el.text({ x: 4, y: 10 }, "hi"),
]);
```

- Children are one node, a string, or an array of them. An array is a fragment, so `render` takes an array as its content and a `map` result nests anywhere.
- Components are plain functions. Call them with `children` as a prop: `Callout({ target, during, children: "Click here" })`.
- `key` is accepted and ignored. Nothing diffs these trees.
- `null`, `undefined` and booleans are skipped, as children and as props.

## Embedding in a framework

`render` returns a string, so any view layer can show it. There are two ways in.

- **Inline the SVG as trusted HTML.** Pass `prefix` to `render`. Inlined scenes share one document, and every scene numbers its keyframes, classes and ids from 1, so two scenes without a prefix overwrite each other's animations.
- **Load it as an image.** An `<img src="data:image/svg+xml,...">` is its own document and needs no prefix. The scene plays, but its text cannot be selected and the page cannot style it.

```ts
const scene = el.rect({ width: 10, height: 10, fill: "#3EE6D6" });
const hello = render({ width: 200, height: 120, duration: 4, title: "Hello", prefix: "hello-" }, scene);
const saved = render({ width: 320, height: 120, duration: 5, title: "Saved", prefix: "saved-" }, scene);

// FoldKit builds snabbdom vnodes: h.div([attributes], [children]).
const banner = `<div class="banner">${hello}</div>`; // h.div([h.Class("banner"), h.InnerHTML(hello)], [])
const image = `<img src="data:image/svg+xml,${encodeURIComponent(saved)}" alt="Changes saved">`; // h.img([h.Src(...), h.Alt(...)])
```

Render once at module scope, or memoize it. A view function that runs on every update compiles the scene again each time.

`prefix` goes in front of every id, class, keyframe name, custom property and embedded font family the compiler generates, and in front of the title and description ids. It starts with a letter and holds only letters, digits, `_` and `-`, such as `"hello-"`. The default is none and the output is unchanged. Classes and ids you write yourself in `css` or props are not renamed.
