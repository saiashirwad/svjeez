# Refs and verbs

A ref is how code holds a node: make it with `ref("name")`, give it to one node with `ref={…}`, and use it anywhere in the scene, before or after that node.

- Anchors: `card.center`, `.left`, `.right`, `.top`, `.bottom`, `.topLeft`, `.topRight`, `.bottomLeft`, `.bottomRight`, `.side("left", 0.25)`, and `.map(([x, y]) => [x + 8, y])` for a point beside one. They are points on the node's box, wherever it ends up and however it moves.
- Parts: `card.part("title")` is the node keyed `title` inside the card; `"body/title"` goes deeper. A component can key its insides and hand out parts, so the scene needs one ref per component.
- Anchors feed `at`, `<Arrow from to>`, `<Align to>` and `move`. A ref on an `<Arrow>` takes `to({ trim })` and `to({ stroke })` like a shape's.

## Verbs on refs

```tsx
export default scene({ size: [480, 280], duration: 6, title: "Click", theme }, () => {
  const cursor = ref("cursor");
  const button = ref("button");

  const reach = cursor.move(button.center, span(0.4, 0.8), ease.inOut);
  const down = cursor.to({ scale: 0.85 }, reach.next(0.08));

  cursor.to({ scale: 1 }, down.next(0.12));
  button.part("face").to({ fill: theme.blue }, down.next(0.2));
  button.to({ scale: 1.04 }, down.next(0.3));

  return <Group>{/* nodes with ref={cursor} and ref={button} */}</Group>;
});
```

A verb moves a node from outside it, at a span, like a track step does. Call verbs inside `scene()`'s callback or a component it renders; each one takes effect as it is called and returns the span it ran in, so the next beat is built from it (`reach.next(0.08)`), and a track or a motion layer can line up with it too. A component can take a span and return one: `toggle.on(after)`.

| Verb | Moves |
| --- | --- |
| `to({ at, rotate, scale, opacity, fill, stroke, trim, geometry }, span, curve?)` | any of the node's props, from wherever it was; `curve` defaults to `ease.out`, and a spring works with `span(start, spring.settle)` |
| `set({ … }, span)` | a cut at the span's start |
| `move(to, span, curve?, { point })` | `at` to a point, or onto an anchor (a ref means its center) where that anchor is when the move ends, even while it moves; `point` says which point of the node lands there, by default the one its `at` places; a node with no `at` starts from where its box is |

Every verb writes the node's own prop track, starting from the node's own value, so a node a container places can't `move`: wrap it in a `<Group>` and move what is inside. A prop has one writer: a track, verbs, a derived value or a morph. Two verbs moving one prop at once throw, naming both calls, when each runs, and when the second may start. A verb's span counts on the clock of the node it moves, so a node inside `<Sequence when={span(4)}>` is moved with spans from 0.

To close a loop, move the node back yourself before the end: `win.move(home, span(duration - 0.8, 0.8))`.

## Sequences

`<Sequence when={span(4, 3)}>…</Sequence>` is a clock of its own: every track, verb and recipe inside counts from the span's start, so a component is written from 0 and placed anywhere, and sequences inside sequences add up. With a length, everything inside must end by then; `when={span(4)}` runs to the end. A symbol's tracks run on the scene's clock, so a moving symbol can't sit in a sequence that starts later.
