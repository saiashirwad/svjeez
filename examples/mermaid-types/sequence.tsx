import { show } from "./show";

export default show(
  "Sequence diagram",
  `sequenceDiagram
  actor U as Browser
  participant A as API
  participant D as Postgres
  U->>A: POST /login
  A->>D: select user
  D-->>A: row
  Note over A: sign token
  A-->>U: 200 + Set-Cookie`,
);
