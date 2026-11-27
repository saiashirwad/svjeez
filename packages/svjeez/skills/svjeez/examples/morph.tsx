/** @jsxImportSource svjeez */
import {
  Align,
  Arrow,
  Group,
  Shape,
  Stack,
  circle,
  enter,
  morph,
  rect,
  ref,
  scene,
  span,
  tokens,
  track,
} from "svjeez";

const theme = tokens({
  light: {
    background: "#FFFFFF",
    surface: "#F4F6F9",
    border: "#6B7280",
    blue: "#0A6CFF",
    green: "#1A7F37",
    orange: "#D95D00",
  },
  dark: {
    background: "#090A0C",
    surface: "#161920",
    border: "#8B949E",
    blue: "#64D2FF",
    green: "#3FB950",
    orange: "#FF9F43",
  },
});

const state = (wide: boolean, showDot: boolean) => (
  <Group key="stage">
    <Shape
      key="box"
      geometry={rect(wide ? 110 : 50, 36, { radius: 8 })}
      at={[wide ? 24 : 54, 42]}
      fill={wide ? theme.green : theme.blue}
    />
    {showDot && <Shape key="dot" geometry={circle(8)} offset={[156, 60]} fill={theme.orange} />}
  </Group>
);

export default scene(
  {
    size: [320, 120],
    duration: 3,
    title: "Morph and refs",
    desc: "A keyed box morphs wider as a dot enters, joined by a ref arrow.",
    theme,
    still: 2.8,
    loop: false,
  },
  (canvas) => {
    const [left, right] = [ref(), ref()];

    return (
      <Group>
        <Shape geometry={canvas.rect} fill={theme.background} />
        <Group motion={enter(span(0, 0.3))}>
          {morph(state(false, false), state(true, true), span(0.8, 1.0), {
            enter: { opacity: 0, scale: 0.4 },
          })}
        </Group>
        <Align place="right" inset={24}>
          <Stack direction="row" gap={28} align="center">
            <Shape
              ref={left}
              geometry={rect(24, 24, { radius: 6 })}
              fill={theme.surface}
              stroke={{ color: theme.border, width: 2 }}
            />
            <Shape ref={right} geometry={circle(12)} fill={theme.blue} />
          </Stack>
        </Align>
        <Arrow
          from={left.right}
          to={right.left}
          inset={4}
          stroke={{ color: theme.border, width: 2 }}
          draw={track(0).to(1, span(1.4, 0.8))}
        />
      </Group>
    );
  },
);
