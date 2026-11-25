import { show } from "../../../examples/mermaid-types/show";
import { source } from "../../../examples/mermaid-types/flowchart";

export default show("Flowchart", source.replace("flowchart RL", "flowchart TB"));
