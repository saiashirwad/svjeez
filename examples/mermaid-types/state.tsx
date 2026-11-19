import { show } from "./show";

export default show(
  "State diagram",
  `stateDiagram-v2
  direction LR
  [*] --> Idle
  Idle --> Loading : fetch
  Loading --> Ready : ok
  Loading --> Failed : error
  Failed --> Loading : retry
  Ready --> [*]`,
);
