# Interactive scenes: clocks, hit names and state machines

The page code moves parts of a scene; every animation inside is authored once, in the scene. The `.svg` still plays on its own, so `<img>` embeds, `frames` and `check` show it.

## Clocks the page drives

`clock(name, span)` makes a clock that page code can play, reverse or scrub. `<Sequence clock={c}>` runs its children on it, and tracks inside count from 0 as in any `<Sequence>`. The span is where the clock plays in the plain `.svg`.

```tsx
const open = clock("open", span(1, 0.5));

<Sequence clock={open}>
  <Panel />              {/* its tracks run from 0 to 0.5s on "open" */}
</Sequence>
```

```ts
import { mount, scrolled } from "svjeez/page";

const scene = mount(document.querySelector("#card svg")!); // an inline <svg>, not an <img>
const open = scene.clock("open");

card.addEventListener("click", () => (open.time > 0 ? open.reverse() : open.play()));
scene.clock("grow").follow(scrolled(card));
```

- A clock has `seek(seconds)`, `progress(amount)` (0 to 1), `to(seconds)`, `play()` and `reverse()`, `pause()`, `time`, `over` and `follow(driver)`. `to`, `play` and `reverse` run at real speed, so the scene's own easing plays, forward or back; they resolve false when something else moves the clock first. A driver is a function `(progress) => stop`; `scrolled(el)` and `pointer(el, { axis })` are built in. Under reduced motion they jump to where they are going. Animations on the scene's own clock keep playing.
- Everything animates on a clock. Mounting also takes over the SMIL inside it (a morph, a moving gradient, an animated effect, a text-path start), replacing it with attributes the clock sets; the `.svg` on its own still plays it.
- Clocks don't nest, two `clock()` values can't share a name, and a track belongs to one clock.

## Finding shapes: `hit`

Every node takes `hit="name"`: its outermost SVG element gets `data-hit="name"`, and several nodes may share a name. `scene.hit(name)` (from `mount()`) returns those elements, and throws, listing the names the SVG has, when there are none. Events are plain DOM events on them (`addEventListener`); give them `[data-hit] { cursor: pointer }` in the page's CSS. A shape needs a paint to catch the pointer: a fully transparent fill is flagged `never-visible`, so use a visible fill.

## State machines

`machine(scene, { initial, states, on })` from `svjeez/page`. A state says where each clock rests, as progress 0 to 1; moving to it runs those clocks from where they are to their places.

```ts
import { machine, mount } from "svjeez/page";

const scene = mount(document.querySelector("#toggle svg")!);
const power = machine(scene, {
  initial: "off",
  states: { off: { flip: 0 }, on: { flip: 1 } },
  on: { press: { off: "on", on: "off" } }, // or a function: (state) => next state
});

scene.hit("switch").forEach((el) => el.addEventListener("click", () => power.send("press")));
power.subscribe((state, from) => (card.dataset.state = state));
```

- `send(event)` follows `on`; `go(state)` goes straight to a state. Both resolve true when every clock has arrived. `state` is the current state, `subscribe` hears each change at the start of its move, `stop()` halts where the clocks are.
- An event leads from each state to another; a state it doesn't name ignores it, and `send` resolves false. A function `(state) => next` decides from the state: clamp at the ends of a stepper by returning the same state.
- A clock a state doesn't name stays where it is. Clocks with several stops are rested at fractions: four stops 0.5s apart on a 1.5s clock rest at 0, 1/3, 2/3 and 1.
- Moving again mid-way retargets from the current time, so two quick clicks on a toggle reverse smoothly; the earlier move resolves false.
- `initial` shows its state at once, with no animation. Under reduced motion every move jumps.
- A machine throws, saying what to change, for an `initial` that is not a state, a clock the SVG doesn't have, a place outside 0 to 1, or an event that leads to an unknown state.
- Scenes inlined on one page need an `svg.emit` `prefix` each (see [`render.md`](render.md)), or their classes and keyframes collide.
