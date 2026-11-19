# Time: spans, clocks, sequences

A span is the only way to say when: `span(start, over)` is a stretch of seconds, `span(start)` runs to the end of its clock. A plain number is only ever a length (`.next(0.4)`, `rewind(0.6)`, `duration`).

```tsx
const arrive = span(0.3, 0.6);
const [header, body, footer] = arrive.next(0.45, -0.25).cascade(3, 0.15);
const [crouch, leap, land] = span(0.1, 0.3).chain(0.12, 0.25);
```

- `.end` is `start + over`. `.next(over, gap?)` starts where this one ends (a negative `gap` overlaps). `.shift(dt)` moves it.
- `.chain(...overs)` is this span then one more per length, end to end, as a tuple. `.cascade(count, step)` is `count` spans of the same length, `step` apart, typed as that many spans (so no `!` on a destructured literal count).
- Build each beat from the one before, so moving one moves the rest. A span inside another is arithmetic: `span(trip.start, 0.15)` begins with it, `span(trip.end - 0.2, 0.2)` ends with it.
- A span needs a start of 0 or later and a length of 0 or more; a `to()` step needs a length above 0 (use `set()` for a cut). Steps take spans, never bare numbers.

## Clocks

```tsx
<Sequence when={span(4, 3)}>
  <Toast />              {/* its tracks count from 0 = 4s into the scene */}
</Sequence>
```

`<Sequence when>` is a clock of its own: every track and recipe inside counts from the span's start, so a component is written from 0 and placed anywhere, and sequences inside sequences add up. With a length, everything inside must end by then; `when={span(4)}` runs to the end. A track is read on one clock: two nodes on different clocks reading one track throws, so make a track for each.
## Loops and seams

A scene loops every `duration` seconds unless `loop: false` (play once and hold the last frame). A looping scene must end where it began, or `check` reports a `loop-seam`:

- A value that ends elsewhere: finish with `.rewind(over)` on the track, or fade the node out before the end (`exit`).
- A node that enters and never leaves vanishes at the seam: `exit()` it, or have it on screen from 0s.
- `.loop(period)` snaps the period to divide `duration`; a looped track never seams. A steady spin is `track(0).to(360, span(0, 2), ease.linear).loop(2)`.
- A track that runs past the scene (`… runs until …s, past the …s scene`) throws: end it by `duration`.

## Reduced motion

`still` is the second shown to viewers who ask for less motion, held still: 85% of `duration` by default; give the moment the picture reads best (`still: 2.5`), or `false` to play the motion for them too.

## Scenes you build from data

Derive time from the data, never fixed seconds per item: `span(0.2, 0.4).cascade(items.length, 0.1)` (a non-literal count gives `Span[]`, so index with `!`), and a `duration` from the last span's `end` plus a rest.
