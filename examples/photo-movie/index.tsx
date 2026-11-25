import { google } from "@svjeez/fonts";
import {
  Group,
  Picture,
  Sequence,
  Shape,
  Text,
  ease,
  enter,
  exit,
  picture,
  radial,
  rect,
  scene,
  span,
  track,
  type PictureData,
  type Vec,
} from "svjeez";
import { geist } from "../fonts/faces";

const serif = await google("Instrument Serif");
const load = (name: string) => picture.load(new URL(`./${name}.webp`, import.meta.url));

const [fjord, road, falls, river, camp, coast] = await Promise.all([
  load("fjord"),
  load("road"),
  load("falls"),
  load("river"),
  load("camp"),
  load("coast"),
]);

const frame = { width: 640, height: 268 };
const bar = (360 - frame.height) / 2;
const dissolve = 0.9;
const hold = 4;

interface Shot {
  readonly src: PictureData;
  readonly title: string;
  readonly focus: readonly [Vec, Vec];
  readonly zoom: readonly [number, number];
}

const shots: readonly Shot[] = [
  {
    src: fjord,
    title: "I. The edge",
    focus: [
      [0.3, 0.8],
      [0.38, 0.62],
    ],
    zoom: [1.05, 1.3],
  },
  {
    src: road,
    title: "II. The road north",
    focus: [
      [0.15, 0.7],
      [0.75, 0.45],
    ],
    zoom: [1.3, 1.3],
  },
  {
    src: falls,
    title: "III. Spray",
    focus: [
      [0.5, 0.88],
      [0.5, 0.6],
    ],
    zoom: [1.6, 1.05],
  },
  {
    src: river,
    title: "IV. Cold water",
    focus: [
      [0.75, 0.3],
      [0.45, 0.75],
    ],
    zoom: [1.25, 1.35],
  },
  {
    src: camp,
    title: "V. Snowline",
    focus: [
      [0.5, 0.5],
      [0.68, 0.72],
    ],
    zoom: [1, 1.35],
  },
  {
    src: coast,
    title: "VI. Last light",
    focus: [
      [0.3, 0.5],
      [0.6, 0.45],
    ],
    zoom: [1.2, 1.1],
  },
];

const opening = span(0, 3.2);
const cuts = span(opening.end - 0.6, hold).cascade(shots.length, hold - dissolve);
const closing = span(cuts.at(-1)!.end - 0.4, 3.6);
const duration = closing.end;

const Title = ({ size, sub }: { size: number; sub: string }) => (
  <Group>
    <Text
      font={serif}
      size={size}
      at={[320, 180]}
      anchor="center"
      fill="#f3ede2"
      letterSpacing={size / 12}
    >
      NORTHBOUND
    </Text>
    <Text
      font={geist}
      size={10}
      at={[320, 180 + size * 0.75]}
      anchor="center"
      fill="#f3ede299"
      letterSpacing={3}
    >
      {sub}
    </Text>
  </Group>
);

export default scene(
  {
    size: [640, 360],
    duration,
    title: "Northbound, a film in six stills",
    still: cuts[2]!.start + 2,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill="#000000" />
      <Sequence when={opening}>
        <Group motion={[enter(span(0.3, 1.2)), exit(span(2.2, 0.9))]}>
          <Title size={44} sub="A FILM IN SIX STILLS" />
        </Group>
      </Sequence>
      {shots.map(({ src, title, focus, zoom }, i) => (
        <Sequence when={cuts[i]!}>
          <Group
            motion={[
              enter(span(0, dissolve), { curve: ease.inOut }),
              i === shots.length - 1
                ? exit(span(hold - dissolve, dissolve), { curve: ease.inOut })
                : exit(span(hold - 0.1, 0.1)),
            ]}
          >
            <Picture
              src={src}
              at={[0, bar]}
              width={frame.width}
              height={frame.height}
              focus={track<Vec>(focus[0]).to(focus[1], span(0, hold), ease.inOut)}
              zoom={track(zoom[0]).to(zoom[1], span(0, hold), ease.linear)}
            />
            <Shape
              geometry={rect(frame.width, frame.height)}
              at={[0, bar]}
              fill={radial.across({
                stops: [
                  [0.55, "#00000000"],
                  [1, "#00000088"],
                ],
              })}
            />
            <Group
              motion={[
                enter(span(0.6, 0.8), { from: { opacity: 0, offset: [0, 6] } }),
                exit(span(hold - dissolve - 0.6, 0.6)),
              ]}
            >
              <Text
                font={serif}
                size={18}
                at={[320, bar + frame.height + bar / 2]}
                anchor="center"
                fill="#f3ede2"
              >
                {title}
              </Text>
            </Group>
          </Group>
        </Sequence>
      ))}
      <Sequence when={closing}>
        <Group motion={[enter(span(0.5, 1)), exit(span(2.4, 1))]}>
          <Title size={30} sub="PHOTOGRAPHS FROM UNSPLASH" />
        </Group>
      </Sequence>
    </Group>
  ),
);
