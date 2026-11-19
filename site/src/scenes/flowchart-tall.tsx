import { show } from "../../../examples/mermaid-types/show";
import { source } from "../../../examples/mermaid-types/flowchart";

// The home page's flowchart for a phone: the same diagram, laid out top to bottom.
export default show("Flowchart", source.replace("flowchart RL", "flowchart TB"));
