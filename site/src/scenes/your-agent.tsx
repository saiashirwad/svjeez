import { Lettering, handwrite } from "@svjeez/fonts/handwriting";
import { Group, scene, tokens } from "svjeez";
import { hand } from "./cue";

const W = 200;
const H = 60;
const DELAY = 1.05;

const page = tokens({
  light: { ink: "#1c1c1f" },
  dark: { ink: "#f4f4f5" },
});

const { end } = handwrite(hand, "your agent", { width: W, y: 38, from: DELAY });

/** "your agent", handwritten above the struck-out "you" in the examples heading. */
export default scene(
  {
    size: [W, H],
    duration: end + 0.3,
    title: "your agent",
    desc: "The words your agent, handwritten.",
    theme: page,
    still: end + 0.3,
    loop: false,
  },
  () => (
    <Group>
      <Lettering font={hand} text="your agent" width={W} y={38} from={DELAY} ink={page.ink} />
    </Group>
  ),
);
