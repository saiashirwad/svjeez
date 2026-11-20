import { ogScene } from "@svjeez/og";
import { Align, Group, Text } from "svjeez";
import { geist } from "@examples/fonts/faces";
import { theme } from "@examples/theme";
import { Backdrop, Copy, Mascot, Timeline } from "../og/kit";

export default ogScene(
  {
    theme,
    title: "Page not found",
    desc: "svjeez link preview: a lost light bulb mascot above a timeline with a missing frame.",
  },
  () => (
    <Group>
      <Backdrop />
      {/* A giant 404 behind the mascot, there but faded: the frame that is not on the timeline. */}
      <Text
        font={geist}
        weight={600}
        size={300}
        at={[905, 262]}
        anchor="center"
        fill={theme.raised}
        opacity={0.7}
      >
        404
      </Text>
      <Mascot mood="lost" at={[905, 245]} size={200} />
      {/* The timeline has a hole in it: the third keyframe is outlined in red and nothing is lit. */}
      <Timeline active={-1} missing={2} />
      <Align place="left" inset={80}>
        <Copy
          title="Page not found"
          text="This frame is not on the timeline. Head back to svjeez."
          note="404 · svjeez"
        />
      </Align>
    </Group>
  ),
);
