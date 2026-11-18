import { Code } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import {
  Center,
  Group,
  Shape,
  Stack,
  Text,
  canvas,
  ease,
  morph,
  rect,
  ref,
  scene,
  span,
  track,
  type SceneElement,
} from "svjeez";
import { geist } from "../fonts/faces";
import { mono, theme } from "../theme";

const sans = geist.face(600);

const palette = tomorrow;

const FIB = [
  {
    label: "TS",
    lang: "ts",
    keys: ["sig", "base", "rec", "end"],
    source: `function fib(n: number): number {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}`,
  },
  {
    label: "Python",
    lang: "python",
    keys: ["sig", "base", "then", "rec"],
    source: `def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)`,
  },
  {
    label: "Rust",
    lang: "rust",
    keys: ["sig", "base", "then", "close", "rec", "end"],
    source: `fn fib(n: u32) -> u32 {
    if n < 2 {
        return n;
    }
    fib(n - 1) + fib(n - 2)
}`,
  },
  {
    label: "Go",
    lang: "go",
    keys: ["sig", "base", "then", "close", "rec", "end"],
    source: `func fib(n int) int {
    if n < 2 {
        return n
    }
    return fib(n-1) + fib(n-2)
}`,
  },
] as const;

const CHIP = { width: 84, gap: 8, height: 32 };
const LEFT = 40;
const chipX = (index: number) => LEFT + index * (CHIP.width + CHIP.gap);

const HOLD = 2.4;
const OVER = 0.9;
const moves = FIB.slice(1).map((_, i) => span(HOLD * (i + 1) + OVER * i, OVER));

const fib = ref("fib");

const Version = ({ lang, keys, source }: (typeof FIB)[number]): SceneElement => (
  <Code
    key="code"
    ref={fib}
    lang={lang}
    keys={keys}
    font={mono}
    size={18}
    lineHeight={1.5}
    palette={palette}
    at={[LEFT + 20, 108]}
  >
    {source}
  </Code>
);

const slide = moves.reduce(
  (path, move, i) => path.to([chipX(i + 1), 28], move, ease.inOut),
  track<readonly [number, number]>([chipX(0), 28]),
);

export default scene(
  {
    size: [480, 340],
    duration: HOLD * 4 + OVER * 3,
    title: "Fibonacci in four languages",
    desc: "A Fibonacci function morphs between TypeScript, Python, Rust and Go, colored by role from the scene's palette, while a bar follows its recursive line and a shell command types itself.",
    theme,
    loop: false,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.surface} />
      <Shape at={[24, 16]} geometry={rect(432, 264, { radius: 12 })} fill={theme.background} />
      <Shape
        at={slide}
        geometry={rect(CHIP.width, CHIP.height, { radius: 8 })}
        fill={theme.raised}
      />
      <Group offset={[0, 28]}>
        {FIB.map(({ label }, i) => (
          <Center key={label} at={[chipX(i), 0]} width={CHIP.width} height={CHIP.height}>
            <Text font={sans} size={14} fill={theme.text}>
              {label}
            </Text>
          </Center>
        ))}
      </Group>
      <Shape
        geometry={rect(400, 28, { radius: 4 })}
        at={fib.part("rec").topLeft.map(([x, y]) => [x - 10, y - 2])}
        fill={theme.blue}
        opacity={track(0).to(0.18, span(0.8, 0.4))}
      />
      {morph.between(
        FIB.map((version) => <Version {...version} />),
        moves,
        { stagger: 0.04 },
      )}
      <Stack direction="row" gap={8} at={[LEFT, 292]}>
        <Text font={mono} size={14} fill={theme.muted}>
          $
        </Text>
        <Code lang="bash" font={mono} size={14} palette={palette} typing={span(0.3, 1.4)}>
          bunx svjeez svg fib.tsx
        </Code>
      </Stack>
    </Group>
  ),
);
