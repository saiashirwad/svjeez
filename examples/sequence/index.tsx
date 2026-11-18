import { sequence } from "@svjeez/diagrams";
import { Align, Group, Shape, canvas, circle, exit, scene, span, track } from "svjeez";
import { mono, theme } from "../theme";

const login = sequence(
  {
    actors: {
      user: { label: "Browser", role: "input" },
      gateway: { label: "Gateway", role: "task" },
      api: "API",
      cache: { label: "Redis", role: "store" },
      auth: { label: "Auth", role: "tool" },
      db: { label: "Postgres", role: "store" },
    },
    messages: [
      ["user", "gateway", "POST /login"],
      ["gateway", "api", "forward"],
      ["api", "cache", "get session"],
      ["cache", "api", "miss", { reply: true }],
      ["api", "db", "select user"],
      ["db", "api", "row", { reply: true }],
      ["api", "auth", "sign token"],
      ["auth", "api", "jwt", { reply: true }],
      ["api", "user", "200 + Set-Cookie", { reply: true }],
    ],
  },
  {
    font: mono,
    size: 16,
    reveal: span(0.2, 0.8),
    colors: {
      background: theme.background,
      text: theme.text,
      line: theme.border,
      muted: theme.muted,
      accent: theme.blue,
      highlight: theme.orange,
      roles: { tool: theme.magenta, store: theme.magenta },
    },
  },
);

const last = login.message(8);
const home = span(last.span!.start, 0.5);
const LEAVE = span(9.2, 0.6);

export default scene(
  {
    size: [960, 540],
    duration: 10,
    title: "Login request sequence",
    desc: "A sequence diagram of a login: the browser posts credentials, the API checks them against Postgres, has a token signed and returns it.",
    theme,
    reducedMotion: 9,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align motion={exit(LEAVE)}>
        <Group>
          {login.node}
          <Shape
            geometry={circle(4)}
            anchor="center"
            fill={theme.orange}
            at={last.route.travel(home)}
            opacity={track(0).set(1, home.start).to(0, home.next(0.2))}
          />
        </Group>
      </Align>
    </Group>
  ),
);
