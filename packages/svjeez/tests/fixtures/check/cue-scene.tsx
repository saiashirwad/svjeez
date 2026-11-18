/** @jsxImportSource svjeez/scene */
import { Group, Text, font, scene, track } from "svjeez/scene";

const sans = await font.load(new URL("../ABeeZee-Regular.ttf", import.meta.url));

// Two labels in one place that overlap only for 0.2s, between uniform samples: `svjeez check` finds it at the cue.
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
      opacity={track(0).set(1, 0.213).set(0, 0.413)}
    >
      second label
    </Text>
  </Group>
));
