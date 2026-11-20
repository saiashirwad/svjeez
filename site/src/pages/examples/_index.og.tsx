import { ogScene } from "@svjeez/og";
import { Align, Group, Shape, rect } from "svjeez";
import { theme } from "@examples/theme";
import { Backdrop, Copy, Timeline, Window } from "../../og/kit";

const [W, H] = [250, 170];

// A window of an example: a bar of its color, then two lines of text.
const Example = ({ color, wide }: { color: typeof theme.red; wide: number }) => (
  <Group at={[18, 20]}>
    <Shape geometry={rect(wide, 14, { radius: 7 })} fill={color} />
    <Shape geometry={rect(W - 36, 10, { radius: 5 })} at={[0, 36]} fill={theme.raised} />
    <Shape geometry={rect(W - 90, 10, { radius: 5 })} at={[0, 58]} fill={theme.raised} />
    <Shape geometry={rect(W - 36, 46, { radius: 8 })} at={[0, 84]} fill={color} opacity={0.15} />
  </Group>
);

// A fan of three windows, each a different example, leaning on each other.
export default ogScene(
  {
    theme,
    title: "Examples",
    desc: "Three small windows, fanned out, each holding an svjeez example.",
  },
  () => (
    <Group>
      <Backdrop />
      <Window size={[W, H]} at={[790, 310]} rotate={-9} title="charts.tsx">
        <Example color={theme.blue} wide={110} />
      </Window>
      <Window size={[W, H]} at={[1040, 335]} rotate={7} title="globe.tsx">
        <Example color={theme.green} wide={80} />
      </Window>
      <Window size={[W, H]} at={[915, 205]} rotate={-2} title="code.tsx">
        <Example color={theme.magenta} wide={140} />
      </Window>
      <Timeline active={2} accent={theme.magenta} />
      <Align place="left" inset={80}>
        <Copy
          title="Examples"
          titleSize={110}
          text="Charts, code, globes, math and more. Each one a single SVG."
          note="examples · all in TypeScript"
        />
      </Align>
    </Group>
  ),
);
