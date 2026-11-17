import { google } from "@svjeez/fonts";
import { Dom, duration, loop, shots, size } from "@svjeez/dom";
import { recordings } from "@svjeez/dom/vite";
import { fileURLToPath } from "node:url";
import { Camera, def, render, variables } from "svjeez";
import { rect } from "svjeez/geometry";

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const geist = await google.family("Geist", [{ weight: 400 }, { weight: 500 }, { weight: 600 }]);

const demos = await recordings<typeof import("../demos/cards.demo.tsx")>(
  here("../demos/cards.demo.tsx"),
  {
    cache: here("snapshots.json"),
    fonts: [geist],
  },
);

const signIn = loop(demos.signIn, { over: 0.8 });
const card = size(signIn);
const frame = rect(0, 0, card.width, 300);
const { vars, css } = variables({ dark: { backdrop: "#09090b" }, light: { backdrop: "#f4f4f5" } });

const camera = shots(
  signIn,
  { idle: "all", email: "email-field", password: "password-field", hover: "submit", failed: "all" },
  { frame, zoom: 1.6, over: 0.45 },
);

export default function build(): string {
  return render(
    {
      width: frame.w,
      height: frame.h,
      duration: duration(signIn),
      css,
      title: "A sign-in form, filmed with a camera that follows the action",
      desc: "The camera zooms into the email field as it's typed, moves to the password and the sign-in button, then pulls back to show the error from the server.",
    },
    <g clipPath={def.clipPath({}, <rect width={frame.w} height={frame.h} />)}>
      <rect width={frame.w} height={frame.h} fill={vars.backdrop} />
      <Camera {...camera}>
        <Dom states={signIn} fonts={[geist]} />
      </Camera>
    </g>,
  );
}
