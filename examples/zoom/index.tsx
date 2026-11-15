import { google } from "@svjeez/fonts";
import { Dom, duration, shots, size } from "@svjeez/dom";
import { recordings } from "@svjeez/dom/vite";
import { fileURLToPath } from "node:url";
import { Camera, def, rect, render, variables } from "svjeez";

// The sign-in demo from examples/demos, filmed like a screen recording: a camera follows whatever is changing. It
// frames the email field while it's typed, then the password, the button, and the error when it comes back.
const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const geist = await google.family("Geist", [400, 500, 600]);

const { signIn } = await recordings<typeof import("../demos/cards.demo.tsx")>(here("../demos/cards.demo.tsx"), {
  cache: here("../demos/snapshots.json"),
  fonts: [geist],
});

const card = size(signIn);
const frame = rect(0, 0, card.width, 300);
const { vars, css } = variables({ backdrop: "#09090b" }, { backdrop: "#f4f4f5" });

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
