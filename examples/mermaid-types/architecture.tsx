import { show } from "./show";

export default show(
  "Architecture diagram",
  `architecture-beta
  service users(internet)[Users]

  group edge(cloud)[Edge]
    service gateway(server)[Gateway] in edge
    service cdn(cloud)[CDN] in edge
  group core(cloud)[Core]
    service api(server)[API] in core
    junction fork in core
    service db(database)[Postgres] in core
    service files(disk)[Files] in core

  users:R --> L:gateway
  gateway:R -- L:cdn
  gateway:B --> T:api
  api:R -- L:fork
  fork:R --> L:db
  fork:B -[blobs]-> T:files`,
);
