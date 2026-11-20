import { Code } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import { Group, Shape, rect, ref, scene, span, track } from "svjeez";
import { mono, theme } from "../theme";

const fib = ref();

export default scene(
  {
    size: [480, 340],
    duration: 4,
    title: "A function, typed out",
    desc: "A TypeScript Fibonacci function types itself, colored by role from the scene's palette, then a bar marks its recursive line.",
    theme,
    loop: false,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={rect(400, 36, { radius: 6 })}
        at={fib.part("rec").topLeft.map(([x, y]) => [x - 12, y - 4])}
        fill={theme.blue}
        opacity={track(0).to(0.18, span(2.4, 0.4))}
      />
      <Code
        ref={fib}
        lang="ts"
        keys={["sig", "base", "rec", "end"]}
        font={mono}
        size={20}
        lineHeight={1.6}
        palette={tomorrow}
        at={[48, 112]}
        typing={span(0.3, 1.8)}
      >
        {`function fib(n: number): number {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}`}
      </Code>
    </Group>
  ),
);
