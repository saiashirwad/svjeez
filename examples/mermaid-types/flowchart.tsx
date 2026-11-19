import { show } from "./show";

/** The diagram's Mermaid source, laid out right to left. */
export const source = `flowchart RL
    classDef hot fill:#3a1d1d,stroke:#ff6b6b,color:#ffd6d6,stroke-width:2px
    classDef cool stroke:#5ac8fa,stroke-dasharray: 4 3

    push([Push to main]) --> build{{Build image}}
    build --> test{Tests pass?}
    test -.->|no| notify[/Notify author/]:::hot
    test ==>|yes| scan[\\Scan image/]
    registry[(Registry)] <--> scan
    scan --> stage>Deploy to staging]
    stage --o smoke(((Smoke test)))

    subgraph release [Release]
      direction TB
      prod[Roll out to prod]:::cool
      rollback[[Roll back]]
    end

    smoke --> prod
    smoke --x rollback
    prod ~~~ rollback
    prod --> done((Live))
    linkStyle 3 stroke:#ff6b6b,stroke-width:2px`;

export default show("Flowchart", source);
