import { show } from "./show";

export default show(
  "Block diagram",
  `block-beta
  columns 3
  Client["Client"] space:2
  down<[" "]>(down) space:2
  block:app:3
    columns 3
    Api["API"] Auth("Auth") Cache[("Cache")]
  end
  Gate{"Allowed?"} space Queue(["Queue"])
  Api --> Gate
  Auth -- "token" --> Queue
  Cache --> Queue`,
);
