import { render } from "svjeez";
import { adaptive, sequence, tomorrow, tomorrowNight, travel } from "svjeez/extras";
import { mono } from "../fonts/faces";

const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });
const M = 40;

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
  { theme, x: M, y: M, font: mono, play: { at: 0.6, step: 0.9 } },
);

const D = 10;
const last = login.message(7);

export default function build(): string {
  return render(
    {
      width: login.bounds.w + 2 * M,
      height: login.bounds.h + 2 * M,
      duration: D,
      title: "Login handshake",
      desc: "A sequence diagram of a login: the browser posts credentials, the API checks them against Postgres, has a token signed and returns it.",
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {login.node}
      <circle r={4} fill={theme.base09} animation={travel(last.points, { at: last.span.at, over: 0.5 })} />
    </>,
  );
}
