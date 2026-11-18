import { Icon } from "@svjeez/icons";
import {
  bell,
  bolt,
  cloud,
  heartFilled,
  mail,
  moon,
  rocket,
  search,
  starFilled,
} from "@svjeez/icons/tabler";
import { Center, Grid, Shape, Stack, Group, canvas, draw, ease, enter, scene, span } from "svjeez";
import { theme } from "../theme";

const SIZE = 64;
const CELL = 128;
const STARS = 5;

const outlines = [rocket, bolt, bell, cloud, moon, search, mail];

const pop = span(3.2, 0.55);

export default scene(
  {
    size: [640, 360],
    duration: 5,
    title: "Icons",
    desc: "Seven Tabler outline icons draw themselves one stroke at a time, a filled heart pops into the last place in the grid, and five shared stars pop in below.",
    theme,
    loop: false,
    reducedMotion: 4.5,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Center width={640} height={360}>
        <Stack gap={12} align="center">
          <Grid
            columns={4}
            padding={8}
            fill={theme.surface}
            stroke={{ color: theme.raised, width: 1 }}
            radius={20}
          >
            {outlines.map((icon, index) => (
              <Center width={CELL} height={CELL - 12}>
                <Icon
                  icon={icon}
                  size={SIZE}
                  color={theme.text}
                  width={1.75}
                  trim={(piece) => draw(span(0.3, 0.7).shift(index * 0.3 + piece * 0.25))}
                />
              </Center>
            ))}
            <Center width={CELL} height={CELL - 12}>
              <Icon
                icon={heartFilled}
                size={SIZE}
                color={theme.red}
                motion={enter(pop, { from: { scale: 0.3, opacity: 0 }, curve: ease.pop })}
              />
            </Center>
          </Grid>
          <Stack direction="row" gap={6}>
            {Array.from({ length: STARS }, (_, i) => (
              <Icon
                icon={starFilled}
                size={24}
                color={theme.yellow}
                shared
                motion={enter(pop.shift(0.15 * (i + 1)), {
                  from: { scale: 0.3, opacity: 0 },
                  curve: ease.pop,
                })}
              />
            ))}
          </Stack>
        </Stack>
      </Center>
    </Group>
  ),
);
