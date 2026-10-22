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

## What you get

- `render(options, content)` compiles, serializes, and validates. It throws on invalid output. `duration` is one loop in seconds, and every motion lives on that timeline.
- `motion(initial)` starts a motion. It can move `opacity`, `x`, `y`, `scale`, `rotate`, `blur`, `draw`, `fill`, `stroke`, `color`, gradient stops, and filter attributes such as `stdDeviation` and `seed`.
- `animation={[outer, inner]}` stacks motions on one element. Index 0 is the outermost, as if it were a wrapper `<g>`.
- `enter`, `exit`, `draw`, `shake`, and `wiggle` are recipes for common motions. `wiggle` is seeded noise that loops cleanly.
- `ease` has `linear`, `in`, `out`, `inOut`, `pop`, `hold`, `steps(n)`, and `bezier(...)`.
- `def.linearGradient(...)`, `def.filter(...)`, and the other `def` helpers return refs. Pass a ref as the attribute value, as in `fill={bg}`. A def is emitted only if something uses it.
- `fx.glow()` and `fx.boil()` are ready-made filters.
- `validateSvg(source)` checks ids, refs, and keyframes, and warns about patterns that render slowly.

Attributes are typed per tag, and `animation` accepts only the channels a tag can animate. Each of these fails `bun run typecheck`:

```tsx
<g animation={draw({ at: 0, over: 1 })} /> // a <g> has no stroke to draw
<g clipPath={gradient} />                   // a gradient is not a clip path
motion().to({ opcity: 1 }, 1)               // misspelled channel
```

## Good to know

- A `.loop(period)` snaps so that it divides `duration`, so every loop stays in step with the scene.
- Under `prefers-reduced-motion`, the scene freezes 85% of the way through. Pass `reducedMotion: { at }` to pick the frame, or `false` to turn it off.
- A filter over moving content reruns every frame, and Safari slows down sharply under one. Paint glows with gradients where you can. `validateSvg` warns when a filter sits over 40 or more animated elements.
