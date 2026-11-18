# Refs and timelines

A ref is how code holds a node: make it with `ref("name")`, give it to one node with `ref={…}`, and use it anywhere in the scene, before or after that node.

- Anchors: `card.center`, `.left`, `.right`, `.top`, `.bottom`, `.topLeft`, `.topRight`, `.bottomLeft`, `.bottomRight`, `.side("left", 0.25)`, and `.map(([x, y]) => [x + 8, y])` for a point beside one. They are points on the node's box, wherever it ends up and however it moves.
- Parts: `card.part("title")` is the node keyed `title` inside the card; `"body/title"` goes deeper. A component can key its insides and hand out parts, so the scene needs one ref per component.
- Anchors feed `at`, `<Arrow from to>`, `<Align to>` and the timeline's `move`. A ref on an `<Arrow>` takes `draw` and `stroke` like a shape's.

## Timelines

```tsx
export default scene({ size: [480, 280], duration: 6, title: "Click", theme }, () => {
  const cursor = ref("cursor");
  const button = ref("button");

  timeline(
    wait(0.4),
    cursor.move(button.center, 0.8, ease.inOut),
    seq(cursor.scale(0.85, 0.08), cursor.scale(1, 0.12)),
    par(button.part("face").fill(theme.blue, 0.2), button.scale(1.04, 0.3)),
    cursor.rewind(0.6),
    button.rewind(0.6),
  );

  return <Group>{/* nodes with ref={cursor} and ref={button} */}</Group>;
});
```

Call `timeline(...)` inside `scene()`'s callback or a component it renders. Combinators: `seq(...)` plays end to end, `par(...)` starts together and lasts as long as the longest, `stagger(step, ...)` starts each `step` after the one before, `wait(seconds)` pauses. Actions are values: a component can return them (`toggle.on`, `key.press(1.2)`), so the scene's timeline reads as a script.

Verbs take what, then how long, then the curve (default `ease.out`). A spring in place of the length sets both: `knob.moveBy([20, 0], flick)` lasts `flick.settle`.

| Verb | Moves |
| --- | --- |
| `move(to, over, curve?, { point })` | `at` to a point, or onto an anchor (a ref means its center) where it is when the move ends; `point` says which point of the node lands there, by default the one its `at` places |
| `moveBy([dx, dy], over)` | `at` by an amount from where it was |
| `rotate(deg, over)`, `scale(s, over)` | the node's own `rotate` and `scale` |
| `show(over)`, `hide(over)` | `opacity` to 1 or 0; a node that starts hidden needs `opacity={0}` |
| `fill(paint, over)`, `stroke({ color, width }, over)`, `draw(over)` | the fill of a shape, a text or a container that draws itself; the stroke of a shape or such a container; trims a shape's or an `<Arrow>`'s stroke on from nothing |
| `to({ at, rotate, scale, opacity, fill, stroke, trim, geometry }, over)`, `set({ … })` | several props at once; `set` is a cut |
| `rewind(over)` | everything the timeline moved on the node and on every part inside it glides back over the clock's last seconds; it always runs at the end |

Every verb writes the node's own prop track, starting from the node's own value, so a node a container places can't `move`: wrap it in a `<Group>` and move what is inside. A prop has one writer: a track, a timeline, a derived value or a morph. Two actions moving one prop at once throw, naming both.

`action.as("name")` names an action's span, and `const t = timeline(…)` gives it back as `t.span("name")` on the timeline's clock, to line a track or a motion layer up with it. `t.end` is when the last action ends.

## Sequences

`<Sequence start={4} over={3} timeline={gesture}>…</Sequence>` is a clock of its own: every track and recipe inside counts from `start`, so a component is written from 0 and placed anywhere, and sequences inside sequences add up. With `over`, the tracks inside must end by then. A timeline given to a sequence runs on its clock and moves only nodes inside it. A symbol's tracks run on the scene's clock, so a moving symbol can't sit in a sequence that starts later.
