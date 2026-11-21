# @svjeez/react

Draw a component's animated visuals with `svjeez` while React owns its state, events and accessibility.

```sh
npm i @svjeez/react@next svjeez@next
```

The scene file declares its states, so the component only passes the current one. Import it with `?svjeez&inline` from [`@svjeez/vite`](../vite/README.md):

```tsx
import { Scene } from "@svjeez/react";
import mascot from "./mascot.tsx?svjeez&inline";

// A real form keeps its inputs, focus and errors; the robot above it draws whichever state it is in.
const SignIn = () => {
  const [field, setField] = useState<"email" | "password" | undefined>();

  return (
    <form>
      <Scene scene={mascot} state={field ?? "idle"} />
      <input type="email" aria-label="Email" onFocus={() => setField("email")} onBlur={() => setField(undefined)} />
      <input type="password" aria-label="Password" onFocus={() => setField("password")} onBlur={() => setField(undefined)} />
    </form>
  );
};
```

```ts
// mascot.tsx: where each named clock rests in each state
export default scene({ size: [360, 220], duration: 14, title: "Robot mascot", states: { idle: { … }, email: { … }, password: { … } } }, …);
```

## `<Scene>`

```tsx
<Scene scene={art} state={value} />            // decorative: aria-hidden, inside an accessible control
<Scene scene={art} label />                    // an image named by the scene's title and description
<Scene scene={art} label="Build status" />     // an image with your own name
<Scene scene={art} state={value} places={…} onMount={(scene) => scene.clock("grow").follow(scrolled(el))} />
```

- `scene`: the `?svjeez&inline` import (`{ svg, width, height, title, desc }`).
- `state`: a string, or an XState `snapshot.value`. The first one shows at once, each change after it animates; a value with the same contents does nothing.
- `places`: where each state rests the clocks, for a scene that declares no `states`. A new one attaches afresh.
- `onMount`: gets the mounted scene once; what it returns runs when the scene goes.
- `label`: `true` leaves the SVG as the one image, named by its title and description; a string puts `role="img"` and that `aria-label` on the wrapper.
- One `<span>` wraps the scene, sized from the scene and scaled by `style={{ width }}`. It forwards its ref and takes `className` and the other span props.

`useScene(art, { state, places, onMount })` is what `<Scene>` is built from: put its ref on any element whose markup is `art.svg`.

## Design

React owns the state, the events and the accessibility: a Radix or React Aria control brings its role, keyboard and focus, and the state can come from `useState`, Zustand, XState or anything else. svjeez only draws, and moves each clock between the places the scene declared. React never renders inside the SVG: the markup is set once and `attach()` from `svjeez/page` takes it from there, so the animation runs outside React's renders. The server renders the SVG, the client attaches in a layout effect, and `StrictMode`'s second mount attaches again.

`attach(element, { state, places, onMount })` is the port every framework wraps, and it returns `{ scene, update, destroy }`. A Svelte action is that shape already:

```ts
import { attach } from "svjeez/page";

export const scene = (element: HTMLElement, options: AttachOptions) => {
  const attached = attach(element, options);

  return { update: attached.update, destroy: attached.destroy };
};
```

```svelte
<span use:scene={{ state }}>{@html art.svg}</span>
```

A Vue directive is the same three calls: `mounted` attaches and keeps the result on the element, `updated` calls `update({ state: binding.value })`, and `unmounted` calls `destroy()`. Solid does it in `onMount`, `createEffect` and `onCleanup`.

Demos: a [sign-in form with a robot](https://github.com/saiashirwad/svjeez/blob/next/examples/react-widgets/Mascot.tsx), an [XState deploy pipeline](https://github.com/saiashirwad/svjeez/blob/next/examples/react-widgets/Deploy.tsx) and a [watch you can scrub](https://github.com/saiashirwad/svjeez/blob/next/examples/react-widgets/Watch.tsx) · [Example app](https://github.com/saiashirwad/svjeez/tree/next/examples/react-widgets) · [API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/web.md)
