import {
  Group,
  Shape,
  Text,
  circle,
  ease,
  enter,
  font,
  path,
  scene,
  span,
  tokens,
  track,
} from "svjeez";

const theme = tokens({
  light: { background: "#F6F7F9", text: "#161A21", blue: "#2F6FEB" },
  dark: { background: "#0E1116", text: "#EEF1F5", blue: "#6EA2FF" },
});

const face = (file: string) => font.load(new URL(`./fonts/${file}`, import.meta.url));

const sans = font.family(await face("Geist-400.ttf"), await face("Geist-600.ttf"));

export default scene(
  {
    size: [240, 140],
    duration: 4,
    loop: false,
    title: "Hello",
    desc: "A curve draws itself, a dot pops in on top of it, and the word hello sits below.",
    theme,
    still: 2.5,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={path().moveTo([20, 110]).curveTo([80, 20], [160, 20], [220, 110])}
        stroke={{ color: theme.blue, width: 4, cap: "round" }}
        draw={track(0).to(1, span(0.2, 1.2))}
      />
      <Shape
        geometry={circle(8)}
        at={[120, 44]}
        anchor="center"
        fill={theme.text}
        motion={enter(span(1.2, 0.5), { from: { scale: 0 }, curve: ease.pop })}
      />
      <Text font={sans} size={14} at={[120, 132]} anchor="baseline" fill={theme.text}>
        hello
      </Text>
    </Group>
  ),
);
