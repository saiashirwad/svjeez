import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { elementAt, locate } from "@svjeez/live";
import type { Edit, Json, JsonObject, Range, State } from "@svjeez/live";
import { ValueControl, PropField } from "./controls.tsx";
import { boot, colorsIn, freshId } from "./engine.ts";
import type { Engine, Outcome, Policy } from "./engine.ts";
import { isObject } from "./guards.ts";

interface Selection {
  readonly id: string;
  /** The `data-svz-id` that was clicked, if the selection came from the stage. */
  readonly svgId?: string;
}

/** The defaults a scene's params schema declares, which the stage renders with until a control changes one. */
const defaultsOf = (schema: JsonObject): JsonObject => {
  const properties = schema["properties"];

  if (!isObject(properties)) return {};

  return Object.fromEntries(
    Object.entries(properties).flatMap(([name, property]): [string, Json][] =>
      isObject(property) && property["default"] !== undefined ? [[name, property["default"]]] : [],
    ),
  );
};

const depthOf = (state: State, id: string): number => {
  const parent = state.parsed.elements[id]?.parent;

  return parent === undefined ? 0 : 1 + depthOf(state, parent);
};

const lineClass = (line: string): string =>
  line.startsWith("+") && !line.startsWith("+++")
    ? "add"
    : line.startsWith("-") && !line.startsWith("---")
      ? "del"
      : line.startsWith("@@")
        ? "hunk"
        : "";

const Source = ({ text, range }: { readonly text: string; readonly range?: Range | undefined }) => {
  const mark = useRef<HTMLElement>(null);

  useEffect(() => {
    mark.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [range?.file, range?.from, range?.to]);

  if (!range) return <pre className="code">{text}</pre>;

  return (
    <pre className="code">
      {text.slice(0, range.from)}
      <mark ref={mark}>{text.slice(range.from, range.to)}</mark>
      {text.slice(range.to)}
    </pre>
  );
};

export const App = () => {
  const policy = useRef<Policy>({ lockSeal: false });
  const [generation, setGeneration] = useState(0);
  const [engine, setEngine] = useState<Engine>();
  const [state, setState] = useState<State>();
  const [svg, setSvg] = useState("");
  const [replay, setReplay] = useState(0);
  const [params, setParams] = useState<JsonObject>({});
  const [selection, setSelection] = useState<Selection>();
  const [file, setFile] = useState("design.tsx");
  const [diff, setDiff] = useState("");
  const [locked, setLocked] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [renderProblem, setRenderProblem] = useState<string>();
  const [renameTo, setRenameTo] = useState("");
  const [recolorFrom, setRecolorFrom] = useState("");
  const [recolorTo, setRecolorTo] = useState("#ef4444");

  // One session per generation: Reset opens a fresh one on the sample files.
  useEffect(() => {
    let cancelled = false;
    let opened: Engine | undefined;

    boot(policy.current, setDiff).then(
      async (next) => {
        opened = next;

        if (cancelled) return next.dispose();
        setEngine(next);
        setState(await next.read());
      },
      (thrown) => setProblem(thrown instanceof Error ? thrown.message : String(thrown)),
    );

    return () => {
      cancelled = true;
      void opened?.dispose();
    };
  }, [generation]);

  const values = useMemo(
    () => ({ ...defaultsOf(state?.describe.params ?? {}), ...params }),
    [state, params],
  );

  // Draw the scene again whenever the source or a param changes.
  useEffect(() => {
    if (!engine || !state) return;
    let stale = false;

    engine.render(values).then((out) => {
      if (stale) return;

      if (out.ok) {
        setSvg(out.value);
        setRenderProblem(undefined);
      } else setRenderProblem(out.message);
    });

    return () => {
      stale = true;
    };
  }, [engine, state, values]);

  /** Runs an edit; a kept batch becomes the new state, a refused one becomes the banner and leaves the source alone. */
  const commit = async (pending: Promise<Outcome<State>> | undefined, after?: () => void) => {
    const out = await pending;

    if (!out) return;

    if (!out.ok) return setProblem(out.message);
    setProblem(undefined);
    setState(out.value);
    after?.();
  };

  const apply = (edits: readonly Edit[], after?: () => void) => commit(engine?.apply(edits), after);

  const node = state && selection ? state.describe.nodes[selection.id] : undefined;

  // `locate` maps a clicked `data-svz-id` to its source range; a node picked from the list uses its own range.
  const range =
    (state && selection?.svgId ? locate(state.parsed, selection.svgId) : undefined) ?? node?.range;

  const pick = (event: MouseEvent) => {
    if (!state || !(event.target instanceof Element)) return;
    const svgId = event.target.closest("[data-svz-id]")?.getAttribute("data-svz-id");

    if (!svgId) return;
    const where = locate(state.parsed, svgId);
    const id = where && elementAt(state.parsed, where.file, where.from);

    if (!where || !id) return setProblem(`Nothing in the source matches "${svgId}".`);
    setProblem(undefined);
    setSelection({ id, svgId });
    setFile(where.file);
  };

  const select = (id: string) => {
    setSelection({ id });
    const where = state?.describe.nodes[id]?.range;

    if (where) setFile(where.file);
  };

  const reset = () => {
    setEngine(undefined);
    setState(undefined);
    setSvg("");
    setParams({});
    setSelection(undefined);
    setDiff("");
    setProblem(undefined);
    setGeneration((n) => n + 1);
  };

  const insert = () => {
    if (!state) return;
    const root = state.describe.root;
    const id = freshId(state, "note");

    return apply(
      [
        {
          op: "insert",
          parent: root,
          at: state.describe.nodes[root]?.children.length ?? 0,
          element: {
            component: "NoteCard",
            id,
            props: { note: "A new note", width: 200, accent: "#10b981", reveal: "wipe" },
          },
        },
      ],
      () => setSelection({ id }),
    );
  };

  const rename = () => {
    const to = renameTo.trim();

    if (!node || to === "" || to === node.id) return;

    return apply([{ op: "rename", target: node.id, to }], () => {
      setSelection({ id: to });
      setRenameTo("");
    });
  };

  const colors = state ? colorsIn(state) : [];
  const from = colors.includes(recolorFrom) ? recolorFrom : (colors[0] ?? "");
  const paramProperties = state?.describe.params["properties"];
  const files = state ? Object.keys(state.files) : [];
  const banner = problem ?? renderProblem;

  return (
    <div className="app">
      <header className="bar">
        <h1>svjeez live</h1>
        <span className="muted">click the scene to find its source</span>
        <span className="spacer" />
        <label className="check">
          <input
            type="checkbox"
            checked={locked}
            onChange={(event) => {
              policy.current.lockSeal = event.target.checked;
              setLocked(event.target.checked);
            }}
          />
          Lock <code>seal</code>
        </label>
        <span className="rev">rev {state?.revision ?? 0}</span>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </header>

      {banner && (
        <div className="banner" role="alert">
          <span>{banner}</span>
          <button
            type="button"
            onClick={() => (setProblem(undefined), setRenderProblem(undefined))}
          >
            ×
          </button>
        </div>
      )}

      <main className="panes">
        <section className="pane stage">
          <h2>
            Stage
            <button type="button" onClick={() => setReplay((n) => n + 1)}>
              Replay
            </button>
          </h2>
          {selection?.svgId && (
            <style>{`.canvas [data-svz-id="${CSS.escape(selection.svgId)}"] { filter: drop-shadow(0 0 4px #38bdf8) drop-shadow(0 0 1px #38bdf8); }`}</style>
          )}
          <div
            key={replay}
            className="canvas"
            onClick={pick}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          {isObject(paramProperties) && Object.keys(paramProperties).length > 0 && (
            <div className="group">
              <h3>Scene params</h3>
              {Object.entries(paramProperties).map(([name, property]) => (
                <div className="field" key={name}>
                  <span className="field-name">{name}</span>
                  {isObject(property) && values[name] !== undefined && (
                    <ValueControl
                      value={values[name]}
                      schema={property}
                      onCommit={(value) => setParams({ ...params, [name]: value })}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pane inspector">
          <h2>Inspector</h2>
          <ul className="nodes">
            {state?.parsed.order.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className={id === selection?.id ? "on" : ""}
                  style={{ paddingLeft: 8 + depthOf(state, id) * 12 }}
                  onClick={() => select(id)}
                >
                  <span>{id}</span>
                  <em>{state.describe.nodes[id]?.component}</em>
                </button>
              </li>
            ))}
          </ul>

          {node && state ? (
            <div className="group">
              <h3>
                {node.id} <em>{node.component}</em>
              </h3>
              {Object.entries(node.props).map(([name, prop]) => (
                <PropField
                  key={name}
                  name={name}
                  prop={prop}
                  onCommit={(value) => apply([{ op: "set", target: node.id, prop: name, value }])}
                />
              ))}
            </div>
          ) : (
            <p className="muted">Pick an element, or click the scene.</p>
          )}

          <div className="group actions">
            <h3>Actions</h3>
            <div className="row">
              <input
                className="input"
                placeholder={node ? `rename ${node.id} to…` : "select an element"}
                value={renameTo}
                onChange={(event) => setRenameTo(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && rename()}
              />
              <button type="button" disabled={!node} onClick={rename}>
                Rename
              </button>
            </div>
            <p className="hint">
              Renaming rewrites every <code>ref("…")</code> that points at it.
            </p>
            <div className="row">
              <button type="button" disabled={!state} onClick={insert}>
                Insert NoteCard
              </button>
              <button
                type="button"
                disabled={!node}
                onClick={() =>
                  node && apply([{ op: "remove", target: node.id }], () => setSelection(undefined))
                }
              >
                Remove {node?.id ?? ""}
              </button>
            </div>
            <div className="row">
              <select
                className="input"
                value={from}
                onChange={(event) => setRecolorFrom(event.target.value)}
              >
                {colors.map((color) => (
                  <option key={color}>{color}</option>
                ))}
              </select>
              <span>→</span>
              <input
                type="color"
                value={recolorTo}
                onChange={(event) => setRecolorTo(event.target.value)}
              />
              <button
                type="button"
                disabled={!engine || from === ""}
                onClick={() => commit(engine?.recolor(from, recolorTo))}
              >
                Recolor
              </button>
            </div>
            <p className="hint">
              A custom edit made with <code>defineEdit</code>: one click, every matching color.
            </p>
          </div>
        </section>

        <section className="pane source">
          <h2>Source</h2>
          <div className="tabs">
            {files.map((name) => (
              <button
                key={name}
                type="button"
                className={name === file ? "on" : ""}
                onClick={() => setFile(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <Source
            text={state?.files[file] ?? ""}
            range={range?.file === file ? range : undefined}
          />
          <h2>Last diff</h2>
          {diff ? (
            <pre className="diff">
              {diff.split("\n").map((line, i) => (
                <div key={`${i}:${line}`} className={lineClass(line)}>
                  {line}
                </div>
              ))}
            </pre>
          ) : (
            <p className="muted">Edit something and the minimal diff shows here.</p>
          )}
        </section>
      </main>
    </div>
  );
};
