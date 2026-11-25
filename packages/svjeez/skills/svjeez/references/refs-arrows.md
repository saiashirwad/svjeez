# Refs, anchors, parts and arrows

A ref is a handle: make it with `ref()`, give it to one node with `ref={card}`, and use it anywhere in the scene, before or after that node. It has no name and moves nothing. A node's own `key` is what a morph and a part path match.

```tsx
const [card, label] = [ref(), ref()];

<Stack ref={card} key="card">…</Stack>
<Arrow from={card.right} to={label.left} inset={6} stroke={{ color: theme.muted }} draw={track(0).to(1, span(1, 0.5))} />
```

## Anchors

`card.center`, `.left`, `.right`, `.top`, `.bottom`, `.topLeft`, `.topRight`, `.bottomLeft`, `.bottomRight`, `.side("left", 0.25)` (a fraction along an edge), and `.map(([x, y]) => [x + 8, y])` for a point beside one. They are points on the node's box wherever it ends up, however it moves. Anchors feed:

- `at` (and a group's `offset`): `<Shape at={card.bottomRight} anchor="center" />` follows the node; a point track may go to one (`track<Vec>(p).to(card.right, span)`, [motion.md](motion.md)).
- `<Arrow from to>` and `<Align to={card}>`, which places its children against the ref's box.
- An anchor of a ref that is on no node throws at layout, with the ref's source. A node a container places can't follow an anchor: wrap it in a `<Group>`.

## Parts

`card.part("title")` is the node keyed `title` inside the card; `"body/title"` goes deeper. It is a ref too, with the same anchors. A component can key its insides and hand out parts, so the scene needs one ref per component. Container backgrounds are the part `"background"`. A part that does not exist throws and lists the parts right inside the node.

## `<Arrow>`

```tsx
<Arrow from={a.right} to={b.left} stroke={{ color: theme.muted, width: 2 }} inset={6} bend={0.2} head={8} draw={t} />
```

- `from` and `to` are points or anchors; the arrow follows them when their nodes move. `inset` pulls both ends in (default 0); `bend` bows the shaft sideways as a fraction of its length (0, straight, by default); `head` is the head's length in units (default 8), or `"none"` for a plain line. `stroke` is required.
- `draw` is 0 to 1, a number or a track: the shaft is trimmed to `[0, draw]` and the head rides the tip.
- **A head shows only while the drawn shaft reaches its base.** Drawing from 0 starts without a head; it appears on the tip once about one head length of shaft is drawn, and leaves the same way when un-drawn. An arrow shorter than its head shows the head only at `draw = 1`. There is no look-ahead.
- It takes the common props except `at`, `anchor`, `origin`, `rotate` and `scale`: `key ref opacity motion clip mask effects blend scheme`. Its parts, for a morph, are `shaft` and `head`.
- An arrow's ends that follow a node which scales or moves in at the loop seam are a `loop-seam`: bring the arrow in after its ends settle and take it out before the end.

## A token along anchors

```tsx
const [first, second] = when.chain(0.35);
const at = track<Vec>([0, 0])
  .set(source.right, span(when.start))
  .to(model.left, first, ease.in)
  .set(model.right, second)
  .to(target.left, second, ease.out);

<Shape geometry={circle(5)} offset={at} fill={theme.blue} />
```

`.set(anchor, when)` cuts to an anchor, `.to(anchor, span)` moves to it; the node's `anchor` point lands there. The first value is a plain point, because a track starts at a value. See [`examples/pipeline.tsx`](../examples/pipeline.tsx).
