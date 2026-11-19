import { show } from "./show";

export default show(
  "Sequence diagram",
  `sequenceDiagram
  title Login with retries
  autonumber
  box Aqua Backend
    participant A as API
    participant D as Postgres
  end
  actor U as Browser
  U->>+A: POST /login
  A->>+D: select user
  D-->>-A: row
  loop up to 3 times
    A->>A: verify password
    alt valid
      Note over A: sign token
      A-->>U: 200 + Set-Cookie
    else locked
      A-->>U: 423 Locked
    end
  end
  A-->>-U: done`,
);
