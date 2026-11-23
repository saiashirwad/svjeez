import {
  Group,
  Picture,
  Shape,
  Text,
  adjust,
  circle,
  ease,
  picture,
  rect,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { mono } from "../theme";

// Photo from Unsplash via picsum.photos, under the Unsplash License: Steve Carter.
const river = await picture.load(new URL("./river.webp", import.meta.url));

const split = track(150)
  .to(380, span(0.4, 2), ease.inOut)
  .to(100, span(3, 2.2), ease.inOut)
  .rewind(1.4);

export default scene(
  { size: [480, 300], duration: 7, title: "Photo compare", still: 1.5 },
  (canvas) => (
    <Group>
      <Picture
        src={river}
        width={480}
        height={300}
        effects={[adjust({ saturate: 0, contrast: 1.2, brightness: 0.95 })]}
      />
      <Picture src={river} width={480} height={300} clip={split.map((w) => rect(w, 300))} />
      <Group at={split.map((w): Vec => [w, 0])}>
        <Shape geometry={rect(2, 300)} at={[-1, 0]} fill="#ffffff" />
        <Shape
          geometry={circle(12)}
          at={[0, 150]}
          fill="#10121480"
          stroke={{ color: "#ffffff", width: 2 }}
        />
      </Group>
      <Group>
        <Shape geometry={rect(56, 20, { radius: 10 })} at={[16, 16]} fill="#00000080" />
        <Text font={mono} size={9} letterSpacing={1.5} at={[44, 26]} anchor="center" fill="#ffffff">
          COLOR
        </Text>
        <Shape
          geometry={rect(56, 20, { radius: 10 })}
          at={[canvas.width - 72, 16]}
          fill="#00000080"
        />
        <Text
          font={mono}
          size={9}
          letterSpacing={1.5}
          at={[canvas.width - 44, 26]}
          anchor="center"
          fill="#ffffff"
        >
          MONO
        </Text>
      </Group>
    </Group>
  ),
);
