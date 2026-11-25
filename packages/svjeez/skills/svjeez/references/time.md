# Time: spans, clocks, sequences

A span is the only way to say when: `span(start, over)` is a stretch of seconds, `span(start)` runs to the end of its clock. A plain number is only ever a length (`.next(0.4)`, `rewind(0.6)`, `duration`).

```tsx
const arrive = span(0.3, 0.6);
const [header, body, footer] = arrive.next(0.45, -0.25).cascade(3, 0.15);
const [crouch, leap, land] = span(0.1, 0.3).chain(0.12, 0.25);
```

- `.end` is `start + over`. `.next(over, gap?)` starts where this one ends (a negative `gap` overlaps). `.shift(dt)` moves it.
- `.chain(...overs)` is this span then one more per length, end to end, as a tuple. `.cascade(count, step)` is `count` spans of the same length, `step` apart, typed as that many spans (so no `!` on a destructured literal count). `.distribute(count, over)` fits `count` spans of length `over` evenly within this span; `.pace(weights, { gap? })` splits this span proportionally across `weights` with optional gaps.
- Build each beat from the one before, so moving one moves the rest. A span inside another is arithmetic: `span(trip.start, 0.15)` begins with it, `span(trip.end - 0.2, 0.2)` ends with it.
- A span needs a start of 0 or later and a length of 0 or more; a `to()` step needs a length above 0 (use `set()` for a cut). Steps take spans, never bare numbers.

## Clocks

```tsx
<Sequence when={span(4, 3)}>
  <Toast />              {/* its tracks count from 0 = 4s into the scene */}
</Sequence>
```

`<Sequence when>` is a clock of its own: every track and recipe inside counts from the span's start, so a component is written from 0 and placed anywhere, and sequences inside sequences add up. With a length, everything inside must end by then; `when={span(4)}` runs to the end. A track is read on one clock: two nodes on different clocks reading one track throws, so make a track for each.

## One after another, and values from above

```tsx
const Accent = context("#3ddc97");           // Accent.read() is the nearest <Accent value> above, else this

<Accent value="#ff6b6b">
  <Series><Beat /><Beat /></Series>          {/* each starts where the one before ends */}
</Accent>
```

`<Series gap={-0.4}>` starts each child 0.4s before the one before it ends, so shots that fade in and out over 0.4s crossfade with no start times worked out; a positive `gap` leaves a pause. A gap that would start a child before the series throws.

```tsx
const Shot = ({ over, children }: { over: number; children: Child }) => (
  <Sequence when={span(0, over)}>
    <Group motion={[enter(span(0, 0.4)), exit(span(over - 0.4, 0.4))]}>{children}</Group>
  </Sequence>
);

<Series gap={-0.4}>
  <Shot over={4.4}><Intro /></Shot>
  <Shot over={9}><Demo /></Shot>
</Series>
```

JSX runs top-down when the scene is built, so a component sees the contexts around it, and `propsOf(el, Card)` (from `svjeez/tools`) reads the props an unbuilt `<Card>` was written with. A node's length is where its last `<Sequence>` ends, seen through fragments and groups; a `<Series>` child needs one (`<Sequence when={span(0, n)}>` at its root). Leave `duration` out and the scene is as long as its root. See `examples/series.tsx`.

## Clocks the page drives

`clock(name, span)` makes a clock that page code can play, reverse or scrub. `<Sequence clock={c}>` runs its children on it, and tracks inside count from 0 as in any `<Sequence>`. The span is where the clock plays in the plain `.svg`, so `<img>` embeds, `frames` and `check` show it there.

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

- A clock has `seek(seconds)`, `progress(amount)` (0 to 1), `to(seconds)`, `play()` and `reverse()` (promises that run in real time and resolve false when something else moves the clock first), `pause()`, `time`, `over` and `follow(driver)`. A driver is a function `(progress) => stop`; `scrolled(el)` and `pointer(el, { axis })` are built in. Under reduced motion, `to()`, `play()` and `reverse()` jump straight to where they're going. Animations on the scene's own clock keep playing.
- Everything animates on a clock. Mounting also takes over the SMIL inside it (a morph, a moving gradient, an animated effect, a text-path start), replacing it with attributes the clock sets; the `.svg` on its own still plays it.
- Clocks nest as layers: a node belongs to its nearest clocked `<Sequence>`. The outer clock moves the outer nodes' own props (a group's transform or opacity), the inner clock moves the nodes inside, and transforms compose because they sit on different elements. The inner span starts at the outer start plus its own and must end inside the outer span. Two `clock()` values can't share a name, and a track belongs to one clock.

## Loops and seams

A scene loops every `duration` seconds unless `loop: false` (play once and hold the last frame). A looping scene must end where it began, or `check` reports a `loop-seam`:

- A value that ends elsewhere: finish with `.rewind(over)` on the track, or fade the node out before the end (`exit`). The check adds a node's layers up, so `enter()` and `exit()` on the same value are a loop that ends where it began.
- A node that enters and never leaves vanishes at the seam: `exit()` it, or have it on screen from 0s.
- `.loop(period)` snaps the period to divide `duration`; a looped track never seams. A steady spin is `track(0).to(360, span(0, 2), ease.linear).loop(2)`. `.loop(2, { phase })` starts it `phase` seconds into the cycle (the track at t shows the plain loop at t + phase), so each of many streaks or fireflies gets its own offset and the seam still closes.
- A track that runs past the scene (`… runs until …s, past the …s scene`) throws: end it by `duration`.

## Reduced motion

`still` is the second shown to viewers who ask for less motion, held still: 85% of `duration` by default; give the moment the picture reads best (`still: 2.5`), or `false` to play the motion for them too.

## Scenes you build from data

Derive time from the data, never fixed seconds per item: `span(0.2, 0.4).cascade(items.length, 0.1)` (a non-literal count gives `Span[]`, so index with `!`), and a `duration` from the last span's `end` plus a rest.
