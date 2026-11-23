import {
  Group,
  Picture,
  Shape,
  Text,
  ease,
  linear,
  pattern,
  picture,
  rect,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { mono } from "../theme";

// Photos from Unsplash via picsum.photos, under the Unsplash License: Joseph Barrientos (coast),
// Christian Joudrey (Yosemite), Samuel Scrimshaw (lioness), Andrew Coelho (waterfall), Rachel Davis (castle),
// Jay Ruzesky (walrus).
const load = (name: string) => picture.load(new URL(`./${name}.webp`, import.meta.url));

const photos = await Promise.all(
  ["coast", "yosemite", "lioness", "falls", "castle", "walrus"].map(load),
);

const pitch = 216;
const roll = photos.length * pitch;

export default scene({ size: [480, 300], duration: 8, title: "Film strip" }, (canvas) => (
  <Group>
    <Shape geometry={canvas.rect} fill="#16130f" />
    <Group offset={track<Vec>([0, 40]).to([-roll, 40], span(0, 8), ease.linear).loop(8)}>
      <Shape geometry={rect(roll + 480, 200)} fill="#050505" />
      {[2, 178].map((y) => (
        <Shape
          geometry={rect(roll + 480, 20)}
          at={[0, y]}
          fill={pattern({
            size: [22, 20],
            tile: <Shape geometry={rect(12, 9, { radius: 2 })} at={[5, 5]} fill="#e9dfc9" />,
          })}
        />
      ))}
      {[...photos, ...photos.slice(0, 3)].map((src, i) => (
        <Picture src={src} at={[8 + i * pitch, 27]} width={200} height={146} />
      ))}
    </Group>
    <Shape
      geometry={canvas.rect}
      fill={linear.across({
        angle: 0,
        stops: [
          [0, "#16130f"],
          [0.14, "#16130f00"],
          [0.86, "#16130f00"],
          [1, "#16130f"],
        ],
      })}
    />
    <Text font={mono} size={9} letterSpacing={2} at={[24, 266]} fill="#e9dfc9b0">
      ROLL 07 · 36 EXP · 2026
    </Text>
  </Group>
));
