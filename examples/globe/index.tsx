import { createRequire } from "node:module";
import { GlobeShape, globe, sun, type LonLat, type Topology } from "@svjeez/geo";
import { Group, Shape, Text, blur, canvas, circle, scene, span } from "svjeez";
import { mono, theme } from "../theme";

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const DAY = 24;
const RADIUS = 226;
const SOLSTICE = Date.UTC(2026, 5, 21);
const hour = (t: number) => new Date(SOLSTICE + t * 3_600_000);

const earth = globe(world, {
  radius: RADIUS,
  facing: [sun(hour(0))[0] + 72, 22],
  turn: { by: -360, over: span(0, DAY) },
  simplify: 0.8,
});

const CITIES: readonly { readonly name: string; readonly at: LonLat }[] = [
  { name: "London", at: [-0.13, 51.51] },
  { name: "Cairo", at: [31.24, 30.04] },
  { name: "Delhi", at: [77.21, 28.61] },
  { name: "Tokyo", at: [139.69, 35.69] },
  { name: "Sydney", at: [151.21, -33.87] },
  { name: "São Paulo", at: [-46.63, -23.55] },
  { name: "New York", at: [-74.0, 40.71] },
  { name: "Los Angeles", at: [-118.24, 34.05] },
];

const label = { font: mono, fill: theme.text } as const;

export default scene(
  {
    size: [960, 540],
    duration: DAY,
    title: "A day on a turning globe",
    desc: "A globe with real country outlines turns once through the 24 hours of the June solstice. Night covers the right side and its edge glows orange, and eight cities ride the globe with their names, fading out as they pass behind it.",
    theme,
    reducedMotion: 12,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group offset={[656, 270]}>
        <Shape
          geometry={circle(RADIUS + 14)}
          at={[0, 0]}
          anchor="center"
          fill={theme.cyan}
          opacity={0.08}
          effects={[blur(10)]}
        />
        <Shape geometry={earth.sphere} fill={theme.raised} />
        <GlobeShape of={earth.land} fill={theme.cyan} />
        <GlobeShape of={earth.night(hour)} fill="#000000" opacity={0.5} />
        <GlobeShape
          of={earth.terminator(hour)}
          stroke={{ color: theme.orange, width: 10 }}
          opacity={0.35}
          effects={[blur(6)]}
        />
        <Shape geometry={earth.sphere} stroke={{ color: theme.cyan, width: 1 }} opacity={0.3} />
        {CITIES.map((city) => (
          <Group key={city.name} {...earth.place(city.at)}>
            <Shape geometry={circle(3)} fill={theme.orange} />
            <Text {...label} size={11} at={[6, -6]} anchor="baseline-left">
              {city.name}
            </Text>
          </Group>
        ))}
      </Group>
      <Group offset={[64, 200]}>
        <Text {...label} size={11} fill={theme.orange} at={[0, 10]} anchor="baseline-left">
          21 JUNE 2026
        </Text>
        <Text {...label} size={32} at={[0, 54]} anchor="baseline-left">
          A day, turning
        </Text>
        <Text
          {...label}
          size={13}
          fill={theme.muted}
          at={[0, 84]}
          anchor="baseline-left"
          width={260}
        >
          Real coastlines on a globe that turns once, with night on the right.
        </Text>
      </Group>
    </Group>
  ),
);
