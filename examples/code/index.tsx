import { Code } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import { Group, Shape, linear, rect, ref, scene, span, track } from "svjeez";
import { mono, theme } from "../theme";

const LEFT = 32;
const fib = ref();

export default scene(
  {
    size: [480, 270],
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
        geometry={rect(canvas.width, 35)}
        at={fib.part("rec").topLeft.map(([, y]) => [-LEFT, y - 2])}
        fill={linear.across({ stops: [theme.blue, theme.background] })}
        opacity={track(0).to(0.3, span(2.4, 0.4))}
      />
      <Code
        ref={fib}
        lang="ts"
        keys={["sig", "base", "rec", "end"]}
        font={mono}
        size={21}
        lineHeight={1.5}
        palette={tomorrow}
        at={[LEFT, 72]}
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
