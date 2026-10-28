import { def, rect, render } from "svjeez";
import {
  Arrow,
  Callout,
  Camera,
  Focus,
  code,
  during,
  readingTime,
  timeline,
  appWindow,
  type CodeRun,
  type CodeTokens,
} from "svjeez/extras";
import { css, mono, theme } from "../style";

const W = 1000;
const H = 620;

const kw = (text: string): CodeRun => ["keyword", text];
const fn = (text: string, id?: string): CodeRun => ["fn", text, id];
const ty = (text: string): CodeRun => ["type", text];
const str = (text: string): CodeRun => ["string", text];
const p = (text: string): CodeRun => ["punct", text];

const source: CodeTokens = [
  [kw("import"), " ", p("{"), " serve ", p("}"), " ", kw("from"), " ", str('"bun"'), p(";")],
  [],
  [
    fn("serve"),
    p("({"),
    " port",
    p(":"),
    " ",
    ["number", "3000"],
    p(","),
    " fetch",
    p(":"),
    " ",
    fn("handle", "entry"),
    " ",
    p("});"),
  ],
  [],
  [
    kw("async function"),
    " ",
    fn("handle"),
    p("("),
    "req",
    p(":"),
    " ",
    ty("Request"),
    p(")"),
    " ",
    p("{"),
  ],
  [
    "  ",
    kw("const"),
    " body ",
    p("="),
    " ",
    kw("await"),
    " ",
    fn("parse", "parse-call"),
    p("("),
    "req",
    p(");"),
  ],
  [
    "  ",
    kw("const"),
    " user ",
    p("="),
    " ",
    kw("await"),
    " ",
    fn("auth", "auth-call"),
    p("("),
    "req",
    p(");"),
  ],
  [
    "  ",
    kw("return"),
    " ",
    fn("respond", "respond-call"),
    p("("),
    "user",
    p(","),
    " body",
    p(");"),
  ],
  [p("}")],
  [],
  [
    kw("async function"),
    " ",
    fn("parse", "parse-def"),
    p("("),
    "req",
    p(":"),
    " ",
    ty("Request"),
    p(")"),
    " ",
    p("{"),
  ],
  [
    "  ",
    kw("return"),
    " ",
    ty("JSON"),
    p("."),
    fn("parse"),
    p("("),
    kw("await"),
    " req",
    p("."),
    fn("text"),
    p("());"),
  ],
  [p("}")],
  [],
  [
    kw("async function"),
    " ",
    fn("auth", "auth-def"),
    p("("),
    "req",
    p(":"),
    " ",
    ty("Request"),
    p(")"),
    " ",
    p("{"),
  ],
  [
    "  ",
    kw("const"),
    " token ",
    p("="),
    " req",
    p("."),
    "headers",
    p("."),
    fn("get"),
    p("("),
    str('"authorization"'),
    p(");"),
  ],
  [
    "  ",
    kw("if"),
    " ",
    p("(!"),
    "token",
    p(")"),
    " ",
    kw("throw"),
    " ",
    ["red", "new Response(401)", "reject"],
    p(";"),
  ],
  ["  ", kw("return"), " db", p("."), "users", p("."), fn("find"), p("("), "token", p(");")],
  [p("}")],
  [],
  [
    kw("function"),
    " ",
    fn("respond", "respond-def"),
    p("("),
    "user",
    p(":"),
    " ",
    ty("User"),
    p(","),
    " body",
    p(":"),
    " ",
    ty("Body"),
    p(")"),
    " ",
    p("{"),
  ],
  [
    "  ",
    kw("return"),
    " ",
    ty("Response"),
    p("."),
    fn("json"),
    p("({"),
    " id",
    p(":"),
    " user",
    p("."),
    "id",
    p(","),
    " body ",
    p("});"),
  ],
  [p("}")],
];

const captions = {
  overview: "One request, from the server to the response.",
  handle: "handle() runs three steps in order.",
  parse: "parse() turns the raw body into JSON.",
  auth: "auth() fails fast when the token is missing.",
  respond: "respond() shapes what the client sees.",
};

const tl = timeline(
  Object.fromEntries(
    Object.entries(captions).map(([name, text]) => [
      name,
      readingTime(text, { settle: name === "overview" ? 0.5 : 2 }),
    ]),
  ) as Record<keyof typeof captions, number>,
  { gap: 0.15, pace: 0.7 },
);

const frame = rect(60, 40, 880, 500);
const editor = appWindow(frame, { theme, title: "server.ts" });
const view = rect(editor.body.x, editor.body.y, editor.body.w, editor.body.h);

const src = code(source, {
  x: view.x + 24,
  y: view.y + 16,
  fontSize: 13,
  lineHeight: 1.55,
  theme,
  font: mono,
  gutter: true,
});

/** A view as wide as the code plus margins, so every stop zooms the same and only the pan changes. */
const lines = (a: number, b: number) =>
  rect(src.bounds.x - 110, src.lines(a, b).y, src.bounds.w + 220, src.lines(a, b).h);

/** Out past the end of a line, so call-to-definition arrows bow through the margin. */
const margin = (line: number) => ({ x: src.lines(line).right.x + 12, y: src.lines(line).center.y });

const clip = def.clipPath(
  {},
  <rect x={view.x} y={view.y} width={view.w} height={view.h} rx={12} />,
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      title: "Request walkthrough",
      desc: "A camera walks through a Bun server: handle, then parse, auth and respond, each zoomed in turn.",
      duration: tl.duration,
      reducedMotion: { at: tl.auth.at + 2 },
      css: [
        css,
        ".sans,.note text{font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}",
      ].join("\n"),
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />
      <g fontFamily={mono}>{editor.node}</g>
      <g clipPath={clip}>
        <Camera
          frame={view}
          over={0.7}
          stops={[
            { during: tl.handle, target: lines(1, 9) },
            { during: tl.parse, target: lines(5, 12) },
            { during: tl.auth, target: lines(6, 18) },
            { during: tl.respond, target: lines(8, 22) },
          ]}
        >
          <Focus
            dim={0.25}
            stops={[
              { during: tl.handle, target: src.lines(5, 9).pad(2) },
              { during: tl.parse, target: [src.lines(6).pad(2), src.lines(11, 13).pad(2)] },
              { during: tl.auth, target: [src.lines(7).pad(2), src.lines(15, 19).pad(2)] },
              { during: tl.respond, target: [src.lines(8).pad(2), src.lines(21, 23).pad(2)] },
            ]}
          >
            {src.node}
          </Focus>
          <g class="note">
            <Arrow
              from={src.get("entry").bottom}
              to={src.lines(5).top}
              bend={0.4}
              during={tl.handle}
              color={theme.base0A}
            />
            <Arrow
              from={margin(6)}
              to={margin(11)}
              bend={-0.45}
              during={tl.parse}
              color={theme.base0A}
            />
            <Arrow
              from={margin(7)}
              to={margin(15)}
              bend={-0.35}
              during={tl.auth}
              color={theme.base0A}
            />
            <Callout
              target={src.get("reject")}
              side="right"
              during={tl.auth}
              color={theme.base08}
              fontSize={10}
              columns={20}
            >
              no token, no entry
            </Callout>
            <Arrow
              from={margin(8)}
              to={margin(21)}
              bend={-0.3}
              during={tl.respond}
              color={theme.base0A}
            />
          </g>
        </Camera>
      </g>
      {Object.entries(captions).map(([name, text]) => (
        <text
          x={W / 2}
          y={584}
          class="sans"
          fontSize={17}
          textAnchor="middle"
          fill={theme.base05}
          animation={during(tl[name as keyof typeof captions], 0.35)}
        >
          {text}
        </text>
      ))}
      <g>
        {Object.keys(captions).map((_, i) => (
          <circle cx={W / 2 + (i - 2) * 14} cy={604} r={2.5} fill={theme.base03} />
        ))}
        {Object.keys(captions).map((name, i) => (
          <circle
            cx={W / 2 + (i - 2) * 14}
            cy={604}
            r={2.5}
            fill={theme.base0A}
            animation={during(tl[name as keyof typeof captions], 0.2)}
          />
        ))}
      </g>
    </>,
  );
}
