import { flowchart, stateMachine, type DiagramColors } from "@svjeez/diagrams";
import { Group, font, scene, span } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";

const sans = await font.load(
  new URL("./node_modules/svjeez/skills/svjeez/examples/fonts/Geist-400.ttf", import.meta.url),
);

const colors: DiagramColors = {
  background: "#FFFFFF",
  text: "#111111",
  line: "#666666",
  accent: "#2255FF",
};

const chart = flowchart(
  { nodes: { a: "A", b: "B" }, edges: [["a", "b"]] },
  { font: sans, colors, reveal: span(0, 0.4) },
);

// @ts-expect-error "c" is not a node id
chart.route("a", "c");

// @ts-expect-error "c" is not a state
stateMachine({ states: { a: "A" }, initial: "a", transitions: [["a", "c"]] }, { font: sans });

export const built = scene({ size: [400, 300], duration: 2, title: "Diagrams" }, () =>
  jsx(Group, { children: chart.node }),
);
