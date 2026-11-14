import { Dom, duration, size, snapshots } from "@svjeez/dom";
import { given, message, story, timed } from "@svjeez/dom/story";
import { init, update, type Cmd, type Msg, type State } from "@svjeez/live";
import { compileScene } from "@svjeez/live/compile";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { render, tint, variables, type CodeRole } from "svjeez";
import { restyle } from "svjeez/page";
import { mono, palette } from "../style.ts";
import { view } from "./view.tsx";

// The scene editor from @svjeez/live, driven by the messages a drag, a click or an agent would send, and drawn by
// @svjeez/react's own components. Each message runs through live's pure update, and every compile and picture it asks
// for is answered the way the runtime would answer it, so the code, the picture and the clock are the real ones.
const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));

const ball = `import { ease, motion, render } from "svjeez";

export default function build() {
  return render(
    { width: 240, height: 120, duration: 2 },
    <circle
      cx={40} cy={60} r={18} fill="#e8590c"
      animation={motion({ x: 0 })
        .to({ x: 160 }, 1.2, ease.inOut)}
    />,
  );
}`;

/** The key of the value whose literal reads `text`, the way a control knows its own. */
const key = (state: State, text: string) => state.values.find((v) => v.literal.text === text)!.key;

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// The clock never moves on its own here, so every message happens at page time 0.
const resolve = async (cmd: Cmd): Promise<Msg[]> => {
  if (cmd.type === "compile")
    return [{ type: "compiled", text: cmd.text, result: await compileScene(cmd.text), now: 0 }];

  if (cmd.type === "show") {
    const url = svgUri(restyle(cmd.svg, { at: cmd.at, paused: !cmd.playing }));

    return [{ type: "shown", picture: { ...cmd.picture, url }, now: 0 }];
  }

  // Measuring a grip needs the picture in a browser; the story leaves the handles out.
  return [];
};

const [start, cmds] = init({ text: ball, now: 0 });
const r = key(start, "18");
const far = key(start, "160");

const send = (msg: Msg) => message(msg);

const { html, flow } = await story(
  { update, view, resolve },
  [
    given(start, cmds),
    timed(send({ type: "pause", now: 0 }), { over: 0.3, hold: 0.3 }),
    timed(send({ type: "seek", at: 0.9, now: 0 }), { over: 0.8 }),
    send({ type: "select", key: r, now: 0 }),
    timed(send({ type: "set", key: r, value: 34 }), { over: 1 }),
    send({ type: "select", key: far, now: 0 }),
    timed(send({ type: "set", key: far, value: 100 }), { over: 1 }),
    send({ type: "undo" }),
    send({ type: "undo" }),
    send({ type: "select", key: null, now: 0 }),
  ],
  { hold: 0.6 },
);

/** Every `--sj-*` color the stylesheet reads, from the examples' one code palette. */
const ROLES = {
  fg: "plain",
  muted: "muted",
  keyword: "keyword",
  string: "string",
  number: "number",
  comment: "comment",
  fn: "fn",
  definition: "type",
  tag: "tag",
  attr: "muted",
  punct: "punct",
} satisfies Record<string, CodeRole>;

const sj = Object.entries(ROLES)
  .map(
    ([name, role]) =>
      `--sj-${name}: light-dark(${tint(palette.light, role)}, ${tint(palette.dark, role)});`,
  )
  .join("\n");

const editorCss = readFileSync(
  createRequire(import.meta.url).resolve("@svjeez/live/editor.css"),
  "utf8",
);

const css = `${editorCss}
:root {
  color-scheme: light dark;
  --sj-bg: light-dark(${palette.light.base00}, ${palette.dark.base00});
  --sj-mono: "${mono.family}";
  /* A wide, soft shadow draws as bands, so the panels keep only their ring. */
  --sj-shadow: transparent;
  ${sj}
}
.story { display: grid; grid-template-columns: 29rem 15rem; gap: 1rem; align-items: start; }
.side { display: grid; gap: 0.75rem; }
`;

const steps = await snapshots(here("snapshots.json"), { fonts: [mono], css }, (dom) =>
  dom.run(html, flow, { pad: 24 }),
);

const { vars, css: backdrop } = variables(
  { backdrop: palette.dark.base01 },
  { backdrop: palette.light.base01 },
);

const { width, height } = size(steps);

export default function build(): string {
  return render(
    {
      width,
      height,
      duration: duration(steps),
      css: backdrop,
      title: "The svjeez scene editor, driven by messages",
      desc: "The live editor pauses and seeks its ball scene, a number is selected and dragged so the ball grows, another shortens the ball's path, and two undos put both back.",
    },
    <>
      <rect width={width} height={height} fill={vars.backdrop} />
      <Dom states={steps} fonts={[mono]} />
    </>,
  );
}
