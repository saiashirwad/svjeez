import { render } from "svg-motion";
import { island } from "./island";
import { W, H, D } from "./kit";
const svg = render({ width: W, height: H, duration: D, title: "island" }, <><rect width={W} height={H} fill="#1b3540" />{island()}</>);
await Bun.write("/private/var/folders/_f/yb2trsh50c1gv2dpybhtbw7r0000gn/T/opencode/preview/island.svg", svg);
