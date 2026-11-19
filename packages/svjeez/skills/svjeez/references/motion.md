# Motion

Tracks are the only thing that moves. A prop takes a value or a track; a motion layer is a plain object of tracks; a morph moves what a state leaves free. Two movers on one prop throw.

| What | Write | For |
| --- | --- | --- |
| a prop's own value over time | `opacity={track(0).to(1, span(0.5, 0.3))}` | anything a node has: `at`, `fill`, `geometry`, `draw`, `trim`, `stroke.width`, `clip`, effects |
| a layer on top of the props | `motion={[enter(span(0, 0.4)), wiggle({ rotate: 3 }, { seed: 1 })]}` | entrances, exits, wobble, drift |
| a share of a bigger move | `progress.map((p) => rect(6 + p * 174, 6))` | one number driving many props |

## Tracks

```tsx
const fadeIn = span(1, 0.5);
const shrink = fadeIn.next(0.4, 2);            // 0.4s long, 2s after fadeIn ends

opacity={track(0).to(1, fadeIn).to(0, shrink, ease.in)}
scale={track(1).to(0.8, shrink, ease.in).set(1, span(shrink.end))}
```

- `track(initial)` holds `initial` until the first step. `.to(value, span, curve?)` moves during the span (default `ease.out`); between steps the value holds. `.set(value, when)` is a cut at the span's start: `.set(1, span(2))`.
- Every method returns a new track and leaves the receiver as it was, so one track can be the base of two chains and a component given a track can't schedule motion behind your back. `track.span` is the span of the last step (it throws on a track with no step), so `track(0).to(1, pos.span.next(0.3))` follows `pos`.
- `.loop(period)` repeats forever; `.repeat(n)` or `.repeat({ until })` plays the steps so far again. `.rewind(over, curve?)` glides back to the first value over the clock's last `over` seconds, which is how a loop closes; nothing can follow it.
- Two steps that overlap on one track throw, unless the first is a spring, which the next step cuts and hands its speed to.
- A track of geometry morphs: `track(rect(36, 36)).to(rect(96, 64, { radius: 20 }), span(0.4, 1))`. Rects stay rects, arcs stay arcs, any other pair is matched point for point.
- A track of paint blends colors, and gradients of one kind ([paint.md](paint.md)).
- A point track may go to an anchor: `track<Vec>([0, 0]).to(card.right, span(1, 0.5))` lands the node's own `anchor` point there, where the anchor is when the node is placed. Only `at` (or a group's `offset`) can follow such a track, and it can't loop.

## Layers

`motion` takes one layer or a list (`false` entries are skipped). A layer has the keys `offset`, `rotate`, `scale` and `opacity`, each a value or a track; a missing key rests. The first layer is outermost, the node's own `rotate`, `scale` and `opacity` innermost. Every layer turns and scales around the node's `origin`; opacities multiply; offsets add, and an outer offset is not rotated or scaled by inner layers. Tracks in a layer count on the node's clock like any prop.

```tsx
motion={[
  enter(span(0.3, 0.6), { from: { opacity: 0, offset: [0, 24], scale: 0.96 } }),
  { rotate: track(0).to(360, span(0, 3), ease.linear).loop(3) },
  exit(span(4.4, 0.4), { to: { opacity: 0 } }),
]}
```

- `enter(span, { from, curve })` arrives from `from` (default `{ opacity: 0 }`) to rest; `exit(span, { to, curve })` leaves rest for `to`. Both return a layer.
- `wiggle(amplitude, { seed, rate, period, curve })` is seeded noise around rest that loops seamlessly; change `seed` to reroll.
- `sampled(fn, span, { tolerance })` is a track, so a sampled layer is `{ offset: sampled((t): Vec => orbit(t), span(0, 4), { tolerance: 0.5 }) }`.

## Springs

```tsx
const pop = ease.spring({ stiffness: 260, damping: 14 });   // defaults: 170, 26 (just short of bouncing), mass 1

{ scale: track(0.2).to(1, span(0.5, pop.settle), pop) }
```

A spring is a curve that moves in real seconds from wherever the value is, at whatever speed it has. The span is the window it has and must be long enough for it to settle unless a later step cuts it: give it `pop.settle` seconds (the error names the time it needs). Springs move numbers, points and geometry, not colors. Lower `damping` bounces more; higher `stiffness` is faster.

## Derived values

```tsx
const progress = track(0).to(1, span(0.4, 2.8), ease.inOut).rewind(0.6);

draw={progress}
geometry={progress.map((p) => rect(6 + p * 174, 6, { radius: 3 }))}
at={angle.with(radius).map((a, r): Vec => [r * Math.cos(a), r * Math.sin(a)])}
```

`.map(fn)` makes a value that follows its source at every moment; `a.with(b).map((a, b) => …)` reads several; `through(value, fn)` does the same for a number or a track, so a component can take either. Sources are tracks of numbers or points; the result may be any prop's value. A mapping that is a straight scale and shift costs no more than the source; one that switches between a few values (`p > 0.5 ? on : off`) cuts at the moment it switches; any other is sampled and fitted to few keys within `{ tolerance }`. A derived value takes no steps of its own: move its source. `within(draw, from, to)` is a part's own 0-to-1 progress while the whole is between two shares of it.

## Sampled

`sampled((t) => value, span, { tolerance, step?, precision? })` turns any function of time (`t` from 0 to the span's `over`) into a track of numbers, points or geometry, keeping only the keys within `tolerance` of the curve; a jump becomes a cut. Prefer tracks, derived values and springs, which are smaller; use `sampled` for paths no ease describes (an orbit, a bounce with drag).
