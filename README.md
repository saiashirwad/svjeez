# svjeez

Animated SVGs, written in TSX.

![A black hole forms, ignites, and swallows the camera](dist/horizon.svg)

You describe what moves and when. `render()` compiles it into one standalone `.svg` made of CSS keyframes, with a little SMIL inside filters and no JavaScript. It plays anywhere an image does, including this README.

## Try it

```sh
bun install
bun test
bun run typecheck
```

The package is `svg-motion`. It is private and not on npm yet.

## A small scene

```tsx
import { draw, ease, enter, motion, render } from "svg-motion";

const svg = render(
	{ width: 200, height: 120, duration: 4, title: "Hello" },
	<>
		<path
			d="M20 100C60 20 140 20 180 100"
			fill="none"
			stroke="#FF5FA8"
			strokeWidth={4}
			strokeLinecap="round"
			animation={draw({ at: 0.2, over: 1.2 })}
		/>
		<circle
			cx={100}
			cy={40}
			r={8}
			fill="#3EE6D6"
			animation={[
				enter({ at: 1.2, over: 0.5 }, { scale: 0 }, ease.pop),
				motion({ scale: 1 }).to({ scale: 1.3 }, 0.5, ease.inOut).to({ scale: 1 }, 0.5, ease.inOut).loop(1),
			]}
		/>
	</>,
);

await Bun.write("hello.svg", svg);
```

The path strokes itself on, then the dot pops in and starts to pulse.

Time in a motion is a cursor. `.at(t)` moves it. `.to(values, over, ease)` transitions from the current values and moves the cursor to the end. `.set(values)` is a hard cut, and `.loop(period)` repeats. Between transitions, every value holds.
