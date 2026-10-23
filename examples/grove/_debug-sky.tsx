import { render } from "svg-motion";
import { W, H, D } from "./kit";
import { FarIsles } from "./sky";
const svg = render({ width: W, height: H, duration: D, title: "sky" }, <><rect width={W} height={H} fill="#1b3540" /><FarIsles /></>);
await Bun.write("/private/var/folders/_f/yb2trsh50c1gv2dpybhtbw7r0000gn/T/opencode/preview/fardebug.svg", svg);
