/** @jsxImportSource svjeez */
import {
  Center,
  Group,
  Align,
  Shape,
  Stack,
  Text,
  canvas,
  circle,
  count,
  draw,
  ease,
  exit,
  motion,
  path,
  rect,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { sans, theme } from "./style";

const RADIUS = 26;
const BAR = 180;
const pop = ease.spring({ stiffness: 260, damping: 12 });

const upload = span(0.4, 2.8);
const done = upload.next(0.4);
const reset = span(5.2, 0.6);

const progress = track(0).to(1, upload, ease.inOut).rewind(reset.over, ease.inOut);

const swap = (from: number) =>
  track(from)
    .to(1 - from, done.first(0.3))
    .to(from, reset.first(0.3));

export default scene(
  {
    size: [420, 180],
    duration: 6,
    title: "Uploading",
    desc: "A ring, a bar and a percentage fill together as a file uploads, then a check mark springs into the ring and the label turns to Uploaded, before everything winds back.",
    theme,
    reducedMotion: 4.4,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align>
        <Stack direction="row" gap={22} align="center">
          <Center>
            <Shape geometry={circle(RADIUS)} stroke={{ color: theme.raised, width: 6 }} />
            <Shape
              key="progress"
              geometry={circle(RADIUS)}
              rotate={-90}
              stroke={{ color: theme.blue, width: 6, cap: "round" }}
              trim={progress.map((p): Vec => [0, p])}
            />
            <Shape
              key="check"
              geometry={path().moveTo([0, 7]).lineTo([7, 14]).lineTo([20, 0])}
              stroke={{ color: theme.green, width: 4, cap: "round", join: "round" }}
              trim={draw(done.first(0.3))}
              motion={[
                motion({ scale: 0.4 }).to({ scale: 1 }, done.first(pop.settle), pop),
                exit(reset.first(0.3)),
              ]}
            />
          </Center>
          <Stack gap={10}>
            <Stack direction="row" justify="space-between" align="end" width={BAR}>
              <Text font={sans} weight={600} size={15} fill={theme.text}>
                scene.svg
              </Text>
              <Text font={sans} size={12} fill={theme.muted} align="end">
                {count(progress.map((p) => p * 100))}%
              </Text>
            </Stack>
            <Group>
              <Text key="busy" font={sans} size={12} fill={theme.muted} opacity={swap(1)}>
                Uploading…
              </Text>
              <Text key="done" font={sans} size={12} fill={theme.green} opacity={swap(0)}>
                Uploaded
              </Text>
            </Group>
            <Stack width={BAR} radius={3} fill={theme.raised}>
              <Shape
                key="bar"
                geometry={progress.map((p) => rect(6 + p * (BAR - 6), 6, { radius: 3 }))}
                fill={theme.blue}
              />
            </Stack>
          </Stack>
        </Stack>
      </Align>
    </Group>
  ),
);
