import {
  Group,
  Sequence,
  Shape,
  Text,
  clock,
  ease,
  polygon,
  rect,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { geist } from "../fonts/faces";
import { theme } from "../theme";

// The pill slides in half a second a tab; the panel takes longer, so it settles after.
const pill = clock("pill", span(0.6, 1));
const panel = clock("panel", span(0.6, 1.6));

const tabs = [
  {
    name: "Overview",
    title: "Everything at a glance",
    body: "Projects, activity and health.",
    color: theme.blue,
  },
  {
    name: "Usage",
    title: "Usage this month",
    body: "Requests and storage, by day.",
    color: theme.orange,
  },
  {
    name: "Billing",
    title: "Plan and invoices",
    body: "Payment, receipts and seats.",
    color: theme.magenta,
  },
] as const;

const CELL = 120;

// Twelve points each, so the outlines blend into one another.
const outline = (reach: (point: number) => number) =>
  polygon(
    ...Array.from({ length: 12 }, (_, k): Vec => {
      const angle = (k * Math.PI) / 6 - Math.PI / 2;

      return [reach(k) * Math.cos(angle), reach(k) * Math.sin(angle)];
    }),
  );

const shapes = [
  outline(() => 28),
  outline((k) => (k % 2 === 0 ? 32 : 15)),
  outline((k) => (k % 4 === 0 ? 34 : 16)),
];

const half = panel.over / 2;
const [first, second, third] = shapes;

// The machines page inlines several scenes, so each keeps its ids to itself.
export const prefix = "tabs-";

export default scene(
  {
    size: [480, 280],
    duration: 3,
    title: "Tabs",
    desc: "A segmented control with three tabs on two clocks: a pill slides under the chosen tab while the panel below crossfades its text and morphs its shape and color. Page code rests both clocks at a tab's place and goes to the tab that is clicked.",
    theme,
    loop: false,
    states: {
      overview: { pill: 0, panel: 0 },
      usage: { pill: 0.5, panel: 0.5 },
      billing: { pill: 1, panel: 1 },
    },
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      {tabs.map(({ name }, index) => {
        const end = index === 0 ? 12 : 0;
        const last = index === tabs.length - 1 ? 12 : 0;

        return (
          <Shape
            key={`cell-${name}`}
            hit={`tab-${name.toLowerCase()}`}
            geometry={rect(CELL, 40, { radius: [end, last, last, end] })}
            at={[60 + index * CELL, 24]}
            fill={theme.raised}
          />
        );
      })}
      <Sequence clock={pill}>
        <Shape
          geometry={rect(112, 32, { radius: 9 })}
          at={track<Vec>([64, 28])
            .to([64 + CELL, 28], span(0, 0.5), ease.inOut)
            .to([64 + 2 * CELL, 28], span(0.5, 0.5), ease.inOut)}
          fill={theme.background}
        />
      </Sequence>
      {tabs.map(({ name }, index) => (
        <Text
          key={`label-${name}`}
          hit={`tab-${name.toLowerCase()}`}
          font={geist}
          weight={600}
          size={14}
          at={[60 + CELL / 2 + index * CELL, 49]}
          anchor="baseline"
          fill={theme.text}
        >
          {name}
        </Text>
      ))}
      <Shape
        geometry={rect(360, 170, { radius: 16 })}
        at={[60, 84]}
        fill={theme.surface}
        stroke={{ color: theme.raised, width: 1.5 }}
      />
      <Sequence clock={panel}>
        <Shape
          geometry={track(first!)
            .to(second!, span(0, half), ease.inOut)
            .to(third!, span(half, half), ease.inOut)}
          at={[120, 169]}
          anchor="center"
          fill={track(tabs[0].color)
            .to(tabs[1].color, span(0, half))
            .to(tabs[2].color, span(half, half))}
        />
        {tabs.map(({ title, body }, index) => {
          const hold = index * half;
          const fade = 0.3 * half;
          const arrive = index === 0 ? track(1) : track(0).to(1, span(hold - fade, fade));

          return (
            <Group
              key={title}
              opacity={index === tabs.length - 1 ? arrive : arrive.to(0, span(hold, fade))}
            >
              <Text
                font={geist}
                weight={600}
                size={17}
                at={[180, 164]}
                anchor="baseline-left"
                fill={theme.text}
              >
                {title}
              </Text>
              <Text
                font={geist}
                size={13}
                at={[180, 188]}
                anchor="baseline-left"
                fill={theme.muted}
              >
                {body}
              </Text>
            </Group>
          );
        })}
      </Sequence>
    </Group>
  ),
);
