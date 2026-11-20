import { ogScene } from "@svjeez/og";
import { Align, Group, Shape, rect } from "svjeez";
import { theme } from "@examples/theme";
import { Backdrop, Copy, Timeline, Window } from "../../og/kit";

const [W, H] = [250, 170];

const PAD = 18;

// A window of an example, inset from its edges: a bar of its color, two lines of text, then a block of its color.
const Example = ({ color, wide }: { color: typeof theme.red; wide: number }) => (
  <Group>
    <Shape geometry={rect(wide, 14, { radius: 7 })} at={[PAD, PAD]} fill={color} />
    <Shape
      geometry={rect(W - 2 * PAD, 10, { radius: 5 })}
      at={[PAD, PAD + 30]}
      fill={theme.raised}
    />
    <Shape
      geometry={rect(W - 2 * PAD - 54, 10, { radius: 5 })}
      at={[PAD, PAD + 50]}
      fill={theme.raised}
    />
    <Shape
      geometry={rect(W - 2 * PAD, 40, { radius: 8 })}
      at={[PAD, PAD + 74]}
      fill={color}
      opacity={0.15}
    />
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
