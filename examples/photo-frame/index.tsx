import { Group, Picture, Shape, Text, enter, picture, rect, scene, span } from "svjeez";
import { mono, theme } from "../theme";

const photo = await picture.load(new URL("./portrait.png", import.meta.url));

const frames = [
  { label: "cover, face kept", at: 20, fit: "cover", focus: [0.5, 0.3], radius: 16, h: 110 },
  { label: "contain", at: 140, fit: "contain", focus: [0.5, 0.5], radius: 0, h: 110 },
  { label: "arch", at: 260, fit: "cover", focus: [0.5, 0.3], radius: 55, h: 150 },
] as const;

export default scene(
  { size: [380, 220], duration: 3, title: "Photo frames", loop: false },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      {frames.map(({ label, at, fit, focus, radius, h }, i) => (
        <Group at={[at, 24]} motion={enter(span(0.2 + i * 0.2, 0.5))}>
          <Shape geometry={rect(110, h)} fill={theme.border} />
          <Picture
            src={photo}
            width={110}
            height={h}
            fit={fit}
            focus={focus}
            clip={(own) =>
              rect(own.width, own.height, {
                radius: radius === 55 ? [55, 55, 0, 0] : radius,
              })
            }
          />
          <Text font={mono} size={9} at={[0, 164]} fill={theme.text}>
            {label}
          </Text>
        </Group>
      ))}
    </Group>
  ),
);
