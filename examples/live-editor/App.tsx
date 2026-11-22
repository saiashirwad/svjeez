import { useContext, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { RegistryContext, useAtom, useAtomValue } from "@effect/atom-react";
import { locate } from "@svjeez/live";
import type { Range, State } from "@svjeez/live";
import {
  apply,
  bannerAtom,
  dismissBanner,
  diffAtom,
  fileAtom,
  insertNote,
  lockedAtom,
  paramsAtom,
  pick,
  recolor,
  recolorFromAtom,
  recolorToAtom,
  renameToAtom,
  replayAtom,
  reset,
  select,
  selectionAtom,
  stateAtom,
  svgTextAtom,
  valuesAtom,
} from "./atoms.ts";
import { ValueControl, PropField } from "./controls.tsx";
import { colorsIn } from "./engine.ts";
import { isObject } from "./guards.ts";

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
  const registry = useContext(RegistryContext);
  const state = useAtomValue(stateAtom);
  const svg = useAtomValue(svgTextAtom);
  const values = useAtomValue(valuesAtom);
  const banner = useAtomValue(bannerAtom);
  const diff = useAtomValue(diffAtom);
  const selection = useAtomValue(selectionAtom);
  const [params, setParams] = useAtom(paramsAtom);
  const [file, setFile] = useAtom(fileAtom);
  const [locked, setLocked] = useAtom(lockedAtom);
  const [replay, setReplay] = useAtom(replayAtom);
  const [renameTo, setRenameTo] = useAtom(renameToAtom);
  const [recolorFrom, setRecolorFrom] = useAtom(recolorFromAtom);
  const [recolorTo, setRecolorTo] = useAtom(recolorToAtom);

  const node = state && selection ? state.describe.nodes[selection.id] : undefined;

  // `locate` maps a clicked `data-svz-id` to its source range; a node picked from the list uses its own range.
  const range =
    (state && selection?.svgId ? locate(state.parsed, selection.svgId) : undefined) ?? node?.range;

  const onStageClick = (event: MouseEvent) => {
    if (!state || !(event.target instanceof Element)) return;
    const svgId = event.target.closest("[data-svz-id]")?.getAttribute("data-svz-id");

    if (svgId) pick(registry, state, svgId);
  };

  const rename = () => {
    const to = renameTo.trim();

    if (!node || to === "" || to === node.id) return;

    return apply(registry, [{ op: "rename", target: node.id, to }], () => {
      registry.set(selectionAtom, { id: to });
      setRenameTo("");
    });
  };

  const colors = state ? colorsIn(state) : [];
  const from = colors.includes(recolorFrom) ? recolorFrom : (colors[0] ?? "");
  const paramProperties = state?.describe.params["properties"];
  const files = state ? Object.keys(state.files) : [];

  return (
    <div className="app">
      <header className="bar">
        <h1>svjeez live</h1>
        <span className="spacer" />
        <label className="switch">
          <input
            type="checkbox"
            checked={locked}
            onChange={(event) => setLocked(event.target.checked)}
          />
          <span className="switch-track" aria-hidden="true" />
          Lock <code>seal</code>
        </label>
        <span className="rev" title="Session revision">
          rev {state?.revision ?? 0}
        </span>
        <button type="button" className="secondary" onClick={() => reset(registry)}>
          Reset
        </button>
      </header>

      {banner && (
        <div className="banner" role="alert">
          <span className="banner-text">{banner}</span>
          <button
            type="button"
            className="ghost icon"
            aria-label="Dismiss"
            onClick={() => dismissBanner(registry)}
          >
            ×
          </button>
        </div>
      )}

      <main className="panes">
        <section className="pane stage">
          <div className="pane-head">
            <h2>Stage</h2>
            <button type="button" className="ghost small" onClick={() => setReplay(replay + 1)}>
              Replay
            </button>
          </div>
          {selection?.svgId && (
            <style>{`.canvas [data-svz-id="${CSS.escape(selection.svgId)}"] { outline: 1.5px solid var(--accent); outline-offset: 2px; }`}</style>
          )}
          <div
            key={replay}
            className="canvas"
            onClick={onStageClick}
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
          <div className="pane-head">
            <h2>Inspector</h2>
          </div>
          <ul className="nodes">
            {state?.parsed.order.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className={id === selection?.id ? "on" : ""}
                  style={{ paddingLeft: 8 + depthOf(state, id) * 14 }}
                  onClick={() => select(registry, state, id)}
                >
                  <span className="node-id">{id}</span>
                  <em>{state.describe.nodes[id]?.component}</em>
                </button>
              </li>
            ))}
          </ul>

          {node && state ? (
            <div className="group">
              <h3>
                <span>{node.id}</span> <em>{node.component}</em>
              </h3>
              {Object.entries(node.props).map(([name, prop]) => (
                <PropField
                  key={name}
                  name={name}
                  prop={prop}
                  onCommit={(value) =>
                    apply(registry, [{ op: "set", target: node.id, prop: name, value }])
                  }
                />
              ))}
            </div>
          ) : (
            <p className="empty">Select an element.</p>
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
              <button type="button" className="secondary" disabled={!node} onClick={rename}>
                Rename
              </button>
            </div>
            <div className="row">
              <button
                type="button"
                className="primary"
                disabled={!state}
                onClick={() => state && insertNote(registry, state)}
              >
                Insert NoteCard
              </button>
              <button
                type="button"
                className="danger"
                disabled={!node}
                onClick={() =>
                  node &&
                  apply(registry, [{ op: "remove", target: node.id }], () =>
                    registry.set(selectionAtom, undefined),
                  )
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
              <span aria-hidden="true">→</span>
              <input
                type="color"
                className="swatch"
                value={recolorTo}
                onChange={(event) => setRecolorTo(event.target.value)}
              />
              <button
                type="button"
                className="secondary"
                disabled={!state || from === ""}
                onClick={() => recolor(registry, from, recolorTo)}
              >
                Recolor
              </button>
            </div>
          </div>
        </section>

        <section className="pane source">
          <div className="pane-head">
            <h2>Source</h2>
          </div>
          <div className="tabs" role="tablist">
            {files.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={name === file}
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
          <div className="pane-head">
            <h2>Last diff</h2>
          </div>
          {diff ? (
            <pre className="diff">
              {diff.split("\n").map((line, i) => (
                <div key={`${i}:${line}`} className={lineClass(line)}>
                  {line}
                </div>
              ))}
            </pre>
          ) : (
            <p className="empty">No edits yet.</p>
          )}
        </section>
      </main>
    </div>
  );
};
