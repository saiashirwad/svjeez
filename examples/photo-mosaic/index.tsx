import {
  Group,
  Picture,
  Shape,
  Text,
  ease,
  enter,
  exit,
  moved,
  picture,
  rect,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { mono } from "../theme";

// Photos from Unsplash via picsum.photos, under the Unsplash License: Rachel Davis (castle), sergee bee (alley),
// Marat Gilyadzinov (jellyfish), veeterzy (strawberries), Jay Ruzesky (walrus), Jared Erondu (waterfall).
const load = (name: string) => picture.load(new URL(`./${name}.webp`, import.meta.url));

const [castle, alley, jelly, berries, walrus, falls] = await Promise.all([
  load("castle"),
  load("alley"),
  load("jelly"),
  load("berries"),
  load("walrus"),
  load("falls"),
]);

const tile = { width: 144, height: 130 };
const cell = (i: number): Vec => [16 + (i % 3) * 152, 16 + Math.floor(i / 3) * 138];
const window = moved(rect(tile.width, tile.height, { radius: 8 }), cell(1));
const full = rect(480, 300, { radius: 0 });

const arrive = span(0.2, 0.5).cascade(6, 0.1);
const open = span(1.8, 0.9);
const close = span(5, 0.8);
const leave = span(6.3, 0.5);

const tiles = [
  { src: castle, focus: [0.35, 0.45] },
  undefined,
  { src: alley, focus: [0.5, 0.5] },
  { src: berries, focus: [0.5, 0.5] },
  { src: walrus, focus: [0.8, 0.5] },
  { src: falls, focus: [0.5, 0.6] },
] as const;

export default scene(
  { size: [480, 300], duration: 7, title: "Photo mosaic", still: 3.5 },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill="#101214" />
      {tiles.map(
        (t, i) =>
          t && (
            <Group
              at={cell(i)}
              origin="center"
              motion={[
                enter(arrive[i]!, { from: { opacity: 0, scale: 0.9 } }),
                exit(leave, { to: { opacity: 0 } }),
              ]}
            >
              <Picture
                src={t.src}
                width={tile.width}
                height={tile.height}
                focus={t.focus}
                clip={(own) => rect(own.width, own.height, { radius: 8 })}
              />
            </Group>
          ),
      )}
      <Group
        motion={[enter(arrive[1]!, { from: { opacity: 0 } }), exit(leave, { to: { opacity: 0 } })]}
      >
        <Picture
          src={jelly}
          width={480}
          height={300}
          focus={[0.55, 0.4]}
          clip={track(window).to(full, open, ease.inOut).to(window, close, ease.inOut)}
        />
      </Group>
      <Group
        motion={[
          enter(span(open.end, 0.5), { from: { opacity: 0, offset: [0, 8] } }),
          exit(span(close.start - 0.5, 0.4)),
        ]}
      >
        <Text font={mono} size={9} letterSpacing={2} at={[24, 244]} fill="#ffffffb0">
          MONTEREY BAY AQUARIUM
        </Text>
        <Text font={mono} size={18} at={[24, 260]} fill="#ffffff">
          Pacific sea nettle
        </Text>
      </Group>
    </Group>
  ),
);
