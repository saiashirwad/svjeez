import { render } from "svjeez";
import { sequence } from "svjeez/extras";
import { CSS, theme, mono } from "./kit";

const M = 24;
const login = sequence(
  { actors: { user: "User", api: "API", db: { label: "Postgres", role: "store" } }, messages: [["user", "api", "POST /login"], ["api", "db", "select"], ["db", "api", "row", { reply: true }], { note: "api", text: "hash check" }] },
  { theme, x: M, y: M, font: mono, fontSize: 13, play: { at: 0.5, step: 0.8 } },
);

export default function build(): string {
  return render(
    { width: login.bounds.w + 2 * M, height: login.bounds.h + 2 * M, duration: 6, title: "Sequence", desc: "A login sequence: the user posts to the API, the API selects from Postgres and gets a row back, then checks the hash.", css: CSS, reducedMotion: { at: 5 } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {login.node}
    </>,
  );
}
