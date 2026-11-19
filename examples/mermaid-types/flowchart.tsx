import { show } from "./show";

export default show(
  "Flowchart",
  `flowchart TD
    push([Push to main]) --> build[Build image]
    build --> test{Tests pass?}
    test -->|no| notify([Notify author])
    test -->|yes| scan[Scan image]
    registry[(Registry)] --> scan
    scan --> stage[Deploy to staging]

    subgraph release [Release]
      stage --> smoke{Smoke test?}
      smoke -->|yes| prod[Roll out to prod]
      smoke -->|no| rollback[[Roll back]]
    end

    prod --> done((Live))`,
);
