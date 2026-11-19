import { show } from "./show";

export default show(
  "State diagram",
  `stateDiagram-v2
  [*] --> Idle
  Idle --> Check : submit
  state Check <<choice>>
  Check --> Fork : valid
  Check --> Failed : invalid
  state Fork <<fork>>
  state Join <<join>>
  Fork --> Charge
  Fork --> Reserve
  Charge --> Join
  Reserve --> Join
  Join --> Done
  Failed --> Idle : retry
  Done --> [*]
  note right of Reserve : hold the stock for 10 minutes`,
);
