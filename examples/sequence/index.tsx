import { render, travel } from "svjeez";
import { sequence } from "@svjeez/diagrams";
import { HEIGHT, WIDTH, css, fit, mono, theme } from "../gallery-style";

const login = sequence(
  {
    actors: {
      user: { label: "Browser", role: "input" },
      api: "API",
      auth: { label: "Auth", role: "tool" },
      db: { label: "Postgres", role: "store" },
    },
    messages: [
      ["user", "api", "POST /login"],
      ["api", "db", "select user"],
      ["db", "api", "row", { reply: true }],
      ["api", "api", "hash check"],
      { note: "api", text: "password matches" },
      ["api", "auth", "sign token"],
      ["auth", "api", "jwt", { reply: true }],
      ["api", "user", "200 + Set-Cookie", { reply: true }],
    ],
  },
  { theme, x: 0, y: 0, font: mono, play: { at: 0.2, step: 0.8 } },
);

const D = 10;
const last = login.message(7);

export default function build(): string {
  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: "Login request sequence",
      desc: "A sequence diagram of a login: the browser posts credentials, the API checks them against Postgres, has a token signed and returns it.",
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width={WIDTH} height={HEIGHT} fill={theme.base00} />
      <g transform={fit(login.bounds.w, login.bounds.h)}>
        {login.node}
        <circle
          r={4}
          fill={theme.base09}
          animation={travel(last.points, { at: last.span.at, over: 0.5 })}
        />
      </g>
    </>,
  );
}
