import { theme } from "@examples/theme";
import { ogScene } from "@svjeez/og";
import { Align, Group } from "svjeez";
import { Backdrop, Copy, Glow, Mascot, Timeline } from "../og/kit";

const HERO = [920, 255] as const;

export default ogScene(
  {
    theme,
    title: "svjeez",
    desc: "svjeez link preview: a yellow light bulb mascot above a timeline.",
  },
  () => (
    <Group>
      <Backdrop />
      <Glow at={HERO} />
      <Mascot mood="happy" at={HERO} />
      <Timeline />
      <Align place="left" inset={80}>
        <Copy
          title="svjeez"
          titleSize={132}
          text={"Write motion in TypeScript.\nShip it as one SVG."}
          note="zero-JS · CSS + SMIL · one file"
        />
      </Align>
    </Group>
  ),
);
