import { flowchart, stateMachine } from "@svjeez/diagrams";
import { render } from "svjeez";

const chart = flowchart({ nodes: { a: "A", b: "B" }, edges: [["a", "b"]] });

// @ts-expect-error "c" is not a node id
chart.route("a", "c");

// @ts-expect-error "c" is not a state
stateMachine({ states: { a: "A" }, initial: "a", transitions: [["a", "c"]] });

export const svg: string = render({ width: 400, height: 300, duration: 4, title: "Diagrams" }, [
  chart.node,
]);
