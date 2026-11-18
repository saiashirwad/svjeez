/** @jsxImportSource svjeez/scene */
import { font, picture } from "svjeez";
import {
  Align,
  Arrow,
  Grid,
  Group,
  Image,
  Instance,
  Line,
  Sequence,
  Shape,
  Stack,
  Text,
  circle,
  derive,
  ease,
  morph,
  par,
  rect,
  ref,
  scene,
  seq,
  span,
  spin,
  symbol,
  timeline,
  tokens,
  track,
  arc,
} from "svjeez/scene";

/**
 * Every node kind and every slice at once: a timeline moving a node inside a Grid and a nested Sequence, a morph
 * between two Stacks, a spring, a derived track, an arrow on a moving ref, an image and two instances.
 */
const mono = await font.load(new URL("../SpaceMono-Regular.ttf", import.meta.url));

const theme = tokens({
  light: { ink: "#14161A", paper: "#F4F1EA", accent: "#E0533D", cool: "#2F7FD0", soft: "#C9C2B4" },
  dark: { ink: "#EDEAE2", paper: "#16181C", accent: "#FF7A5C", cool: "#5AA8F0", soft: "#3A3D44" },
});

const badge = picture(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" rx="4" fill="#2F7FD0"/><circle cx="10" cy="10" r="5" fill="#F4F1EA"/></svg>',
);

const star = symbol("star", () => (
  <Shape geometry={rect(12, 12, { radius: 3 })} fill={theme.accent} rotate={spin({ every: 2 })} />
));

export default scene({ size: [320, 200], duration: 4, title: "Integration", theme }, () => {
  const grid = ref("grid");
  const card = ref("card");
  const mover = ref("mover");
  const late = ref("late");
  const dot = ref("dot");
  const angle = track(0).to(270, span(0.5, 2.5), ease.inOut);

  timeline(
    seq(
      par(
        grid.part("b").fade(0.3, 0.6),
        card.move([200, 110], 1.2, ease.spring({ stiffness: 120, damping: 14 })),
      ),
      mover.rotate(45, 0.8),
    ),
  );

  const nested = timeline(late.moveBy([40, 0], 0.8, ease.inOut));

  return (
    <Group>
      <Shape geometry={rect(320, 200)} fill={theme.paper} />
      <Grid ref={grid} columns={2} gap={4} at={[12, 12]}>
        <Shape key="a" geometry={rect(16, 16)} fill={theme.cool} />
        <Shape key="b" geometry={rect(16, 16)} fill={theme.accent} />
        <Group ref={mover}>
          <Shape geometry={rect(16, 16)} fill={theme.ink} />
        </Group>
        <Image src={badge} width={16} />
      </Grid>
      <Group ref={card} at={[60, 110]}>
        <Shape geometry={rect(70, 40, { radius: 6 })} fill={theme.soft} />
        <Text font={mono} size={11} width={60} at={[6, 16]} anchor="baseline-left" fill={theme.ink}>
          {"a card that wraps"}
        </Text>
      </Group>
      <Arrow from={grid.right} to={card.left} color={theme.ink} width={1.5} bend={0.2} gap={4} />
      <Group at={[150, 20]}>
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
        ref={dot}
        geometry={circle(3)}
        fill={theme.cool}
        anchor="center"
        at={derive([angle], (a) => [250 + a / 6, 186] as const)}
      />
      <Line from={[250, 160]} to={dot.top} color={theme.cool} />
      <Instance of={star} at={[20, 170]} />
      <Instance of={star} at={[44, 170]} scale={1.5} />
      <Sequence at={1}>
        <Sequence at={0.5} timeline={nested}>
          <Shape
            ref={late}
            geometry={circle(6)}
            at={[90, 170]}
            anchor="center"
            fill={theme.accent}
          />
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
