import {
  Group,
  Picture,
  Shape,
  Text,
  ease,
  enter,
  exit,
  linear,
  picture,
  rect,
  scene,
  shadow,
  span,
  track,
} from "svjeez";
import { mono } from "../theme";

// Photos from Unsplash via picsum.photos, under the Unsplash License: Alexey Topolyanskiy (fjord),
// Andrew Ridley (road), Matthew Wiebe (pug), Wolfgang Lutz (camp).
const load = (name: string) => picture.load(new URL(`./${name}`, import.meta.url));

const [fjord, road, pug, camp] = await Promise.all([
  load("fjord.webp"),
  load("road.jpg"),
  load("pug.jpg"),
  load("camp.jpg"),
]);

const pop = ease.spring({ stiffness: 180, damping: 15 });
const deal = span(0.7, pop.settle).cascade(3, 0.35);
const leave = span(6.1, 0.5);

const cards = [
  { src: road, caption: "the Quiraing", focus: [0.45, 0.75], at: [150, 52], tilt: -7 },
  { src: pug, caption: "camp mascot", focus: [0.5, 0.15], at: [252, 40], tilt: 4 },
  { src: camp, caption: "Ama Dablam base", focus: [0.7, 0.6], at: [352, 60], tilt: -3 },
] as const;

export default scene(
  { size: [480, 300], duration: 7, title: "Photo collage", still: 4 },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill="#0b1016" />
      <Group motion={[enter(span(0, 0.6)), exit(span(6.4, 0.6))]}>
        <Picture
          src={fjord}
          width={480}
          height={300}
          focus={[0.6, 0.5]}
          origin="center"
          scale={track(1).to(1.14, span(0, 6.4), ease.linear).rewind(0.6)}
        />
        <Shape
          geometry={canvas.rect}
          fill={linear.across({
            angle: 90,
            stops: [
              [0.4, "#0b101600"],
              [1, "#0b1016d0"],
            ],
          })}
        />
      </Group>
      {cards.map(({ src, caption, focus, at, tilt }, i) => (
        <Group
          at={at}
          origin="center"
          rotate={tilt}
          motion={[
            enter(deal[i]!, {
              from: { offset: [40 - i * 30, 340], rotate: tilt * -3 },
              curve: pop,
            }),
            exit(leave.shift(i * 0.08), { to: { opacity: 0, offset: [0, -16] } }),
          ]}
        >
          <Shape
            geometry={rect(108, 128, { radius: 2 })}
            fill="#f7f4ee"
            effects={[shadow({ color: "#000000", opacity: 0.4, offset: [0, 5], blur: 7 })]}
          />
          <Picture src={src} at={[6, 6]} width={96} height={94} focus={focus} />
          <Text font={mono} size={8} at={[6, 108]} fill="#3a3530">
            {caption}
          </Text>
        </Group>
      ))}
      <Group
        motion={[
          enter(span(1.9, 0.6), { from: { opacity: 0, offset: [0, 8] } }),
          exit(span(6.2, 0.5)),
        ]}
      >
        <Text font={mono} size={9} letterSpacing={2} at={[24, 238]} fill="#ffffffb0">
          FIELD NOTES · 2026
        </Text>
        <Text font={mono} size={18} at={[24, 254]} fill="#ffffff">
          Norway · Skye · Khumbu
        </Text>
      </Group>
    </Group>
  ),
);
