import type { Compiled, SceneStats, SourceError } from "./core";
import { EditorView, editorState } from "./editor";
import { examples, type PlaygroundExample } from "./examples";

const DEBOUNCE_MS = 250;
const WATCHDOG_MS = 5000;

type Scheme = "light" | "dark";

/** Compiles in a worker. A scene that never returns costs the worker, not the page. */
const createCompiler = () => {
  let worker: Worker;
  let waiting = new Map<number, (result: Compiled) => void>();
  let next = 0;

  const start = () => {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }: MessageEvent<{ id: number } & Compiled>) => {
      waiting.get(data.id)?.(data);
      waiting.delete(data.id);
    };
  };

  start();

  const compile = (source: string) =>
    new Promise<Compiled & { id: number }>((resolve) => {
      const id = ++next;

      const timer = setTimeout(() => {
        worker.terminate();
        waiting = new Map();
        start();
        resolve({
          id,
          ok: false,
          error: {
            message:
              "The scene took more than 5 seconds to build, so the build was stopped. Check for a loop that never ends.",
          },
          ms: WATCHDOG_MS,
        });
      }, WATCHDOG_MS);

      waiting.set(id, (result) => {
        clearTimeout(timer);
        resolve({ ...result, id });
      });
      worker.postMessage({ id, source });
    });

  return { compile, stop: () => worker.terminate() };
};

const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  ...children: (Node | string)[]
) => {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) element.setAttribute(key, value);
  element.append(...children);

  return element;
};

const bytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10240 ? 2 : 1)} KB`);

const pageScheme = (): Scheme => {
  const set = document.documentElement.dataset.theme;

  return set === "light" || set === "dark"
    ? set
    : matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
};

const stat = (label: string, value: string) =>
  h("span", { class: "pg-stat" }, h("b", {}, value), ` ${label}`);

const describe = ({ message, line, column }: SourceError) =>
  line ? `Line ${line}, column ${column}. ${message}` : message;

/** Upgrades `host` into an editor beside a live preview. `initial` names the first example. */
export const mount = (host: HTMLElement, initial: string, only?: readonly string[]) => {
  const choices = only?.length ? examples.filter((e) => only.includes(e.id)) : examples;
  let current: PlaygroundExample = choices.find((e) => e.id === initial) ?? choices[0]!;
  const states = new Map<string, ReturnType<typeof editorState>>();
  const compiler = createCompiler();
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let svg = "";
  let url = "";

  const img = h("img", { class: "pg-img", alt: "Preview of the scene", decoding: "async" });
  const tools = h("div", { class: "pg-tools" });
  const stage = h("div", { class: "pg-stage" }, img);
  const stats = h("p", { class: "pg-stats", "aria-live": "off" });
  const error = h("p", { class: "pg-error", role: "status", hidden: "" });
  const editorHost = h("div", { class: "pg-editor" });

  const show = (nextSvg: string) => {
    const previous = url;
    svg = nextSvg;
    url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.src = url;

    if (previous) img.addEventListener("load", () => URL.revokeObjectURL(previous), { once: true });
  };

  const showStats = (s: SceneStats, ms: number) => {
    stats.replaceChildren(
      stat("raw", bytes(s.bytes)),
      stat("gzip", bytes(s.gzip)),
      stat("keyframes", String(s.keyframes)),
      stat("JS", s.scriptBytes === 0 ? "0 B" : bytes(s.scriptBytes)),
      stat("to build", `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`),
    );
  };

  const run = async () => {
    const id = ++latest;
    const result = await compiler.compile(view.state.doc.toString());

    if (id !== latest) return;
    host.dataset.state = "ready";

    if (result.ok) {
      error.hidden = true;
      host.classList.remove("has-error");
      show(result.svg);
      showStats(result.stats, result.ms);
    } else {
      error.textContent = describe(result.error);
      error.hidden = false;
      host.classList.add("has-error");
    }
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(run, DEBOUNCE_MS);
  };

  const view = new EditorView({ state: editorState(current.source, schedule), parent: editorHost });

  // One menu of examples, the core first and then one per package, so the title bar stays as quiet as a window's.
  const picker = h("select", { class: "pg-pick", "aria-label": "Example" });

  for (const from of new Set(choices.map((e) => e.from)))
    picker.append(
      h(
        "optgroup",
        { label: from },
        ...choices.filter((e) => e.from === from).map((e) => h("option", { value: e.id }, e.label)),
      ),
    );

  picker.value = current.id;
  picker.addEventListener("change", () => {
    const example = choices.find((e) => e.id === picker.value);

    if (!example || example === current) return;
    states.set(current.id, view.state);
    current = example;
    view.setState(states.get(example.id) ?? editorState(example.source, schedule));
    clearTimeout(timer);
    run();
  });

  const reset = h("button", { type: "button", class: "pg-quiet" }, "Reset");
  reset.addEventListener("click", () => {
    view.setState(editorState(current.source, schedule));
    states.delete(current.id);
    clearTimeout(timer);
    run();
  });

  const restart = h("button", { type: "button", class: "pg-quiet" }, "Restart");
  restart.addEventListener("click", () => svg && show(svg));

  let scheme: Scheme = pageScheme();

  const schemeButtons = (["light", "dark"] as const).map((value) => {
    const button = h(
      "button",
      { type: "button", class: "pg-seg" },
      value === "light" ? "Light" : "Dark",
    );

    button.addEventListener("click", () => {
      scheme = value;
      paintScheme();
    });

    return [value, button] as const;
  });

  const paintScheme = () => {
    stage.dataset.scheme = scheme;

    for (const [value, button] of schemeButtons)
      button.setAttribute("aria-pressed", String(value === scheme));
  };

  paintScheme();
  tools.append(
    restart,
    h(
      "div",
      { class: "pg-segs", role: "group", "aria-label": "Preview colors" },
      ...schemeButtons.map(([, b]) => b),
    ),
  );

  host.replaceChildren(
    h(
      "div",
      { class: "pg-tabs" },
      h("span", { class: "pg-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
      h("label", { class: "pg-picker" }, picker),
      tools,
      reset,
    ),
    h(
      "div",
      { class: "pg-split" },
      h("div", { class: "pg-code" }, editorHost, error),
      h("div", { class: "pg-out" }, stage, stats),
    ),
  );
  host.dataset.state = "building";
  run();
};
