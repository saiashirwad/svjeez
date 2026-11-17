import { render, travel } from "svjeez";
import { sequence } from "@svjeez/diagrams";
import { choice, defaults, list, text, type Values } from "svjeez/params";
import { HEIGHT, WIDTH, css, fit, hue, mono, theme } from "../gallery-style";

export const params = {
  title: text("Login request sequence", { maxLength: 60 }),
  desc: text(
    "A sequence diagram of a login: the browser posts credentials, the API checks them against Postgres, has a token signed and returns it.",
    { maxLength: 300, label: "What the diagram shows, for screen readers" },
  ),
  actors: list(
    {
      id: text("", { maxLength: 24 }),
      label: text("", { maxLength: 16 }),
      role: choice("task", ["task", "input", "tool", "store"]),
    },
    [
      { id: "user", label: "Browser", role: "input" },
      { id: "gateway", label: "Gateway", role: "task" },
      { id: "api", label: "API", role: "task" },
      { id: "cache", label: "Redis", role: "store" },
      { id: "auth", label: "Auth", role: "tool" },
      { id: "db", label: "Postgres", role: "store" },
    ],
    { min: 2, max: 7 },
  ),
  messages: list(
    {
      from: text("", { maxLength: 24 }),
      to: text("", { maxLength: 24 }),
      text: text("", { maxLength: 24 }),
      reply: choice("no", ["no", "yes"]),
    },
    [
      { from: "user", to: "gateway", text: "POST /login", reply: "no" },
      { from: "gateway", to: "api", text: "forward", reply: "no" },
      { from: "api", to: "cache", text: "get session", reply: "no" },
      { from: "cache", to: "api", text: "miss", reply: "yes" },
      { from: "api", to: "db", text: "select user", reply: "no" },
      { from: "db", to: "api", text: "row", reply: "yes" },
      { from: "api", to: "auth", text: "sign token", reply: "no" },
      { from: "auth", to: "api", text: "jwt", reply: "yes" },
      { from: "api", to: "user", text: "200 + Set-Cookie", reply: "yes" },
    ],
    { min: 1, max: 12, label: "In order. A reply draws dashed." },
  ),
};

export default function build(p: Values<typeof params> = defaults(params)): string {
  const login = sequence(
    {
      actors: Object.fromEntries(p.actors.map(({ id, label, role }) => [id, { label, role }])),
      messages: p.messages.map(({ from, to, text, reply }) =>
        reply === "yes" ? [from, to, text, { reply: true }] : [from, to, text],
      ),
    },
    {
      theme,
      x: 0,
      y: 0,
      font: mono,
      fontSize: 16,
      play: { at: 0.2, step: 0.8 },
      tints: { task: hue.blue, input: hue.blue, tool: hue.purple, store: hue.purple },
    },
  );

  const last = login.message(p.messages.length - 1);
  const D = Math.max(10, Math.ceil(last.span.at + 1.5));

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: p.title,
      desc: p.desc,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width={WIDTH} height={HEIGHT} fill={theme.base00} />
      <g transform={fit(login.bounds.w, login.bounds.h)}>
        {login}
        <circle
          r={4}
          fill={theme.base09}
          animation={travel(last.points, { at: last.span.at, over: 0.5 })}
        />
      </g>
    </>,
  );
}
