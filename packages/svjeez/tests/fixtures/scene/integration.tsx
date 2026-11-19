import {
  type Vec,
  font,
  picture,
  Align,
  Arrow,
  Grid,
  Group,
  Image,
  Instance,
  Sequence,
  Shape,
  Stack,
  Text,
  arc,
  circle,
  ease,
  morph,
  rect,
  ref,
  scene,
  span,
  symbol,
  tokens,
  track,
} from "svjeez";

const mono = await font.load(new URL("../SpaceMono-Regular.ttf", import.meta.url));

const theme = tokens({
  light: { ink: "#14161A", paper: "#F4F1EA", accent: "#E0533D", cool: "#2F7FD0", soft: "#C9C2B4" },
  dark: { ink: "#EDEAE2", paper: "#16181C", accent: "#FF7A5C", cool: "#5AA8F0", soft: "#3A3D44" },
});

const badge = picture(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" rx="4" fill="#2F7FD0"/><circle cx="10" cy="10" r="5" fill="#F4F1EA"/></svg>',
);

const star = symbol(() => (
  <Shape
    geometry={rect(12, 12, { radius: 3 })}
    fill={theme.accent}
    rotate={track(0).to(360, span(0, 2), ease.linear).loop(2)}
  />
));

export default scene({ size: [320, 200], duration: 4, title: "Integration", theme }, () => {
  const grid = ref();
  const card = ref();
  const dot = ref();
  const angle = track(0).to(270, span(0.5, 2.5), ease.inOut);
  const dim = track(1).to(0.3, span(0, 0.6));
  const cardAt = track<Vec>([60, 110]);
  const turn = track(0);
  const lateAt = track<Vec>([90, 170]);

  cardAt.to([200, 110], span(0, 1.2), ease.spring({ stiffness: 120, damping: 14 }));
  turn.to(45, cardAt.span.next(0.8));
  lateAt.to([130, 170], span(0, 0.8), ease.inOut);

  return (
    <Group>
      <Shape geometry={rect(320, 200)} fill={theme.paper} />
      <Grid key="grid" ref={grid} columns={2} gap={4} at={[12, 12]}>
        <Shape key="a" geometry={rect(16, 16)} fill={theme.cool} />
        <Shape key="b" geometry={rect(16, 16)} fill={theme.accent} opacity={dim} />
        <Group rotate={turn}>
          <Shape geometry={rect(16, 16)} fill={theme.ink} />
        </Group>
        <Image src={badge} width={16} />
      </Grid>
      <Group key="card" ref={card} offset={cardAt}>
        <Shape geometry={rect(70, 40, { radius: 6 })} fill={theme.soft} />
        <Text font={mono} size={11} width={60} at={[6, 16]} anchor="baseline-left" fill={theme.ink}>
          {"a card that wraps"}
        </Text>
      </Group>
      <Arrow
        from={grid.right}
        to={card.left}
        stroke={{ color: theme.ink, width: 1.5 }}
        bend={0.2}
        inset={4}
      />
      <Group offset={[150, 20]}>
        {morph(
          <Stack key="row" direction="row" gap={6} align="center">
            <Shape key="x" geometry={rect(20, 20)} fill={theme.cool} />
            <Shape key="y" geometry={rect(20, 30)} fill={theme.accent} />
          </Stack>,
          <Stack key="row" direction="row" gap={6} align="center">
            <Shape key="x" geometry={rect(20, 20)} fill={theme.cool} />
            <Shape key="new" geometry={circle(12)} fill={theme.ink} />
            <Shape key="y" geometry={rect(40, 30)} fill={theme.accent} />
          </Stack>,
          span(1, 1),
        )}
      </Group>
      <Shape
        geometry={arc({ radius: 18, sweep: 270 })}
        at={[280, 140]}
        anchor="center"
        stroke={{ color: theme.accent, width: 4, cap: "round" }}
        trim={angle.map((a) => [0, a / 270] as const)}
      />
      <Shape
        key="dot"
        ref={dot}
        geometry={circle(3)}
        fill={theme.cool}
        anchor="center"
        at={angle.map((a) => [250 + a / 6, 186] as const)}
      />
      <Arrow head="none" from={[250, 160]} to={dot.top} stroke={{ color: theme.cool }} />
      <Instance of={star} offset={[20, 170]} />
      <Instance of={star} offset={[44, 170]} scale={1.5} />
      <Sequence when={span(1)}>
        <Sequence when={span(0.5)}>
          <Shape geometry={circle(6)} at={lateAt} anchor="center" fill={theme.accent} />
        </Sequence>
      </Sequence>
      <Align place="bottom-right" inset={6}>
        <Text font={mono} size={9} fill={theme.ink}>
          {"svjeez"}
        </Text>
      </Align>
    </Group>
  );
});
