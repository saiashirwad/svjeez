# Motion

Three ways to move a node, each for its own job. Mixing two on one prop is an error that says so.

| What | Write | For |
| --- | --- | --- |
| a prop's own value over time | `opacity={track(0).to(1, span(0.5, 0.3))}` | anything a node has: `at`, `fill`, `geometry`, `trim`, `stroke.width`, `clip`, effects |
| layers around the node | `motion={[enter(span(0, 0.4)), wiggle({ rotate: 3 }, { seed: 1 })]}` | entrances, exits, wobble, drift; they compose with the props |
| verbs on refs | `timeline(card.move([40, 0], 0.5))` | choreography: see [timeline.md](timeline.md) |

## Tracks

```tsx
const fadeIn = span(1, 0.5);
const shrink = fadeIn.next(0.4, 2);            // 0.4s long, 2s after fadeIn ends

opacity={track(0).to(1, fadeIn).to(0, shrink, ease.in)}
scale={track(1).to(0.8, shrink, ease.in).set(1, shrink.end)}
```

- `track(initial)` holds `initial` until the first step. `.to(value, span, curve?)` moves during the span (default `ease.out`); between steps the value holds. `.set(value, time)` is a cut.
- `.loop(period)` repeats forever; the period is snapped to divide `duration`. `.repeat(n)` or `.repeat({ until })` plays the passage so far again. `.rewind(over, curve?)` glides back to the first value over the clock's last `over` seconds, which is how a loop closes; nothing can follow it.
- Steps may be written in any order; two that overlap on one track throw, unless the first is a spring, which the next step cuts and hands its speed to.
- A track of geometry morphs: `track(rect(36, 36)).to(rect(96, 64, { radius: 20 }), span(0.4, 1))`. Rects stay rects, arcs stay arcs (`sweep` opens an arc), and any other pair is matched point for point.
- A track of paint blends colors, and gradients of one kind (see [paint.md](paint.md)).

Spans: `span(start, over)`; `span(start)` runs to the end of the clock. `.end`, `.next(over, gap?)`, `.shift(dt)`, `.pad(before, after?)`, `.until(end)`, `.first(over)`, `.last(over)`, `.chain(...overs)` (end to end: `const [crouch, leap, land] = span(0.1, 0.3).chain(0.12, 0.25)`), and `.cascade(count, step)` (the same length, `step` apart: entrances; `const [a, b, c] = s.cascade(3, 0.1)` is typed as three spans, so no `!`). Build each beat from the one before, so moving one moves the rest.

## Layers

`motion` takes one layer or a list, the first outermost. A layer moves `offset` (from where `at` put the node), `rotate`, `scale` and `opacity`, all around the node's `origin`; layers multiply opacity and add offsets on top of the node's own props.

- `enter(span, { from, curve })` arrives from `from` (default `{ opacity: 0 }`) to rest; `exit(span, { to, curve })` leaves rest for `to`.
- `wiggle(amplitude, { seed, rate, period, curve })`: seeded noise around rest that loops seamlessly. Change `seed` to reroll.
- `shake({ offset, rotate }, span, { rate })`: a damped swing that settles by the span's end.
- `motion(initial).to(values, span, curve).set(…).loop(…).repeat(…).rewind(…)`: a layer of your own.
- `sampled.motion((t) => values, span, { tolerance: { offset: 0.5, rotate: 1 } })`: a layer from any function of time.

Recipes that return tracks: `draw(span)` for `trim` (strokes the outline on), `spin({ every })` for `rotate`.

## Springs

```tsx
const pop = ease.spring({ stiffness: 260, damping: 14 });   // defaults: 170, 26 (just short of bouncing), mass 1

motion={motion({ scale: 0.2 }).to({ scale: 1 }, span(0.5, pop.settle), pop)}
```

A spring is a curve like an ease, but it moves in real seconds from wherever the value is, at whatever speed it has: a spring step that a later step cuts hands its speed on, and a spring that cuts in keeps the motion continuous. The span is the window it has; it must settle inside it unless a later step cuts it, so give it `pop.settle` seconds (the error names the time it needs). Springs move numbers, points and geometry, not colors. Lower `damping` bounces more; higher `stiffness` is faster.

## Derived values

```tsx
const progress = track(0).to(1, span(0.4, 2.8), ease.inOut).rewind(0.6);

trim={progress.map((p): Vec => [0, p])}
geometry={progress.map((p) => rect(6 + p * 174, 6, { radius: 3 }))}
at={angle.with(radius).map((a, r): Vec => [r * Math.cos(a), r * Math.sin(a)])}
```

`.map(fn)` makes a value that follows its source at every moment; `a.with(b).map((a, b) => …)` reads several. Sources are tracks of numbers or points; the result may be any prop's value. A mapping that is a straight scale and shift of its source costs no more than the source; one that switches between a few values, such as `p > 0.5 ? theme.on : theme.off`, holds each value and cuts at the moment it switches; any other is sampled and fitted to few keys within `{ tolerance }` (default a thousandth of the move, at most 0.05). A derived value takes no steps of its own, and a timeline can't move a prop one writes: move its source.

## Sampled

`sampled((t) => value, span, { tolerance, step?, precision? })` turns any function of time (`t` from 0 to the span's `over`) into a track of numbers, points or geometry, keeping only the keys within `tolerance` of the curve; a jump becomes a cut. Prefer tracks, derived values and springs, which are smaller; use `sampled` for paths no ease describes (an orbit, a bounce with drag).
