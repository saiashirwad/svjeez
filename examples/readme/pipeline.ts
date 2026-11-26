// The README's build diagram, drawn by @svjeez/mermaid.
import { show } from "../mermaid-types/show";

export default show(
  "How svjeez builds a scene",
  `flowchart LR
  A["scene.tsx / scene.ts"] --> B["build: measure text and layout, diff morphs, validate"]
  B --> C["scene.svg"]
  C --> D["CSS keyframes + SMIL"]
  C --> E["light + dark tokens"]
  C --> F["reduced-motion still"]
  C --> G["subsetted fonts"]`,
);
