import { Group, Text, font, scene, span, track } from "svjeez";
import { fontFixture } from "../../../../../fixtures/fonts";

const sans = await font.load(fontFixture("ABeeZee-Regular"));

export default scene({ size: [200, 100], duration: 4, title: "Cue" }, () => (
  <Group>
    <Text key="first" font={sans} size={16} fill="#38BDF8" at={[20, 40]}>
      first label
    </Text>
    <Text
      key="caption"
      font={sans}
      size={16}
      fill="#F472B6"
      at={[20, 40]}
      opacity={track(0).set(1, span(0.213)).set(0, span(0.413))}
    >
      second label
    </Text>
  </Group>
));
