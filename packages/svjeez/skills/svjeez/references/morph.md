# Morph

`morph(before, after, span, options?)` is one element that shows `before` until the span, then becomes `after` over it. `morph.between([a, b, c, a], [s1, s2, s3], options?)` goes through a chain of states, one span per transition. Each state is a whole picture, written by a function of your data; svjeez lays out each one, then matches nodes by `key`:

- a node in both states moves, resizes, reshapes and recolors;
- a node only in the later state enters, by `options.enter` (default `{ opacity: 0 }`, a fade);
- one only in the earlier leaves, by `options.exit`;
- a `<Text>` whose words change crossfades; one that keeps them moves.

```tsx
const Signups = ({ name, bars }: Quarter) => (
  <Group>
    <Text key="title" font={sans} size={16} at={[40, 28]} fill={theme.text}>{`Signups, ${name}`}</Text>
    <Stack key="bars" direction="row" gap={20} align="end" at={[40, 250]} anchor="bottom-left">
      {bars.map(({ region, value, color }) => (
        <Stack key={region} gap={6} align="center">
          <Shape key="bar" geometry={rect(56, value * 1.4, { radius: 6 })} fill={color} />
          <Text key="label" font={sans} size={12} fill={theme.text}>{region}</Text>
        </Stack>
      ))}
    </Stack>
  </Group>
);

morph.between([q1, q2, q3, q1].map((quarter) => <Signups {...quarter} />), [span(1.6, 1), span(4.2, 1), span(6.8, 1)], {
  stagger: 0.05,
  enter: { opacity: 0, scale: 0.8 },
  exit: { opacity: 0, scale: 0.8 },
});
```

The whole example is [`examples/chart.tsx`](../examples/chart.tsx).

- **Key every node that comes, goes or changes**, by what it is (`region`), never by index. Unkeyed siblings pair up by position, and a morph whose states have unkeyed nodes throws. A node's `key` is what matches; a `ref` matches nothing.
- **A key that changes containers travels.** A keyed node that is the only one of its key in each state, but sits in a different container in the next (a card from one `<Stack>` column to another), moves from its old box to its new one, drawn above both containers, while the cards around it reflow by moving. Key it by what it is (`audit`), and key the containers too. It is keyed by its path in the last state it is in. A key that repeats inside a state keeps matching per container, so `label` in every column never travels. Containers it leaves and enters must be still inside a state (no track on their `at` or motion) and must not clip or mask; two containers straight in the morph need a `<Group>` around them if the morph sits in a `<Stack>` or `<Align>`.
- **Containers reflow.** A `<Stack>` in each state, or a `<Stack>`, `<Grid>`, `<Center>` or `<Align>` around a morph, lays out each state on its own: each child moves from its slot in one state to its slot in the next, nodes that enter take room only once they are in, and a container's own fill grows with it. Morphs inside one container share their spans and options. A morph inside a `<Sequence>` inside the container can't reflow it, and says so.
- Options: `curve` (default `ease.inOut`; a spring moves numbers, points and geometry, colors take an ease), `enter`, `exit` (layer values, as `enter()` takes), `stagger` (seconds between each changing node's start, in paint order, or a function `(index, count) => seconds` for each node's start; all still end with the span).
- A node keeps its kind across states. A prop that a track moves inside a state must be the same in every state, or the morph can't blend it. Clip, effects, stroke style, `blend`, `scheme` and origin must have the same shape in every state.
- A counting `<Text>` keyed in every state keeps the same counted value in each (the `format` can differ).
- Spans must follow one another (span `i + 1` starts after span `i` ends). Paint order is the last state's, with each leaving node kept where it was.
- A loop that ends where it started: make the last state the first again.
- Charts, code and formulas morph the same way: write one `<Chart>`, `<Code key>` or `<Tex>` per state.
