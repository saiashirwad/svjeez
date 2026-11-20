import {
  Align,
  Group,
  Shape,
  Stack,
  Text,
  count,
  numeral,
  ease,
  enter,
  exit,
  scene,
  span,
  track,
  type Span,
} from "svjeez";
import type { TextProps } from "svjeez/tools";
import { geist } from "../fonts/faces";
import { theme } from "../theme";

interface StatProps {
  readonly label: string;
  readonly at: Span;
  readonly children: TextProps["children"];
}

const leave = span(5.4, 0.4);

const Stat = ({ label, at, children }: StatProps) => (
  <Stack
    gap={6}
    padding={16}
    width={196}
    radius={12}
    fill={theme.surface}
    motion={[enter(at, { from: { opacity: 0, offset: [0, 8] } }), exit(leave)]}
  >
    <Text font={geist} size={12} fill={theme.muted}>
      {label}
    </Text>
    <Text font={geist} weight={600} size={26} fill={theme.text}>
      {children}
    </Text>
  </Stack>
);

const climb = (from: number, to: number, start: number) =>
  track(from).to(to, span(start, 2.2), ease.out);

export default scene(
  {
    size: [660, 150],
    duration: 6,
    title: "Numbers that count",
    desc: "Three cards fade in and their numbers count up to revenue, signups and uptime, then the cards fade out.",
    theme,
    still: 4,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align>
        <Stack direction="row" gap={16}>
          <Stat label="Revenue" at={span(0.2, 0.4)}>
            ${count(climb(0, 1284500, 0.5))}
          </Stat>
          <Stat label="Signups" at={span(0.35, 0.4)}>
            {count(climb(0, 48213, 0.65))}
          </Stat>
          <Stat label="Uptime" at={span(0.5, 0.4)}>
            {count(climb(90, 99.98, 0.8), { format: numeral({ decimals: 2 }) })}%
          </Stat>
        </Stack>
      </Align>
    </Group>
  ),
);
