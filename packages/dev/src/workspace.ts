import {
  EASES,
  applySplices,
  assign,
  candidatesFor,
  discover,
  extract,
  importsOf,
  isSpan,
  valuesOf,
  view,
  writeAll,
} from "@svjeez/live";
import type {
  Control,
  ControlValue,
  ControlView,
  Controls,
  Files,
  InvalidValue,
  Signals,
  Splice,
  StaleSource,
} from "@svjeez/live";
import {
  Context,
  Data,
  Effect,
  FileSystem,
  Layer,
  Match,
  Path,
  PubSub,
  Ref,
  Result,
  Semaphore,
} from "effect";
import type { LaneReport } from "svjeez/tools";
import { BuildFailed, buildScene, forget } from "./builder.ts";
import type { Built } from "./builder.ts";
import { scenesIn } from "./scenes.ts";

/** A request the workspace cannot do as asked: no scene open, no such control, nothing to undo. Said to the person. */
export class Refused extends Data.TaggedError("Refused")<{
  readonly message: string;
}> {}

export type Failure = Refused | BuildFailed | InvalidValue | StaleSource;

export const messageOf = (failure: Failure): string =>
  Match.value(failure).pipe(
    Match.tagsExhaustive({
      Refused: (refused) => refused.message,
      BuildFailed: (failed) => failed.message,
      InvalidValue: (invalid) => invalid.target + ": " + invalid.issue,
      StaleSource: (stale) => stale.file + " changed on disk since this was planned. Try again.",
    }),
  );

/** One file of a kept change: the whole file before and after, so undo restores exactly what was there. */
export interface Change {
  readonly file: string;
  readonly before: string;
  readonly after: string;
}

/** One kept change: every file it wrote. A control that sets values in two files is one step to undo. */
export interface Entry {
  readonly label: string;
  readonly changes: readonly Change[];
}

interface History {
  readonly entries: readonly Entry[];
  /** How many entries are applied; the ones after it are there to redo. */
  readonly at: number;
}

interface Open {
  readonly file: string;
  readonly text: string;
  /** The scene and the local files it imports, by path, as they were read. */
  readonly files: Files;
  readonly signals: Signals;
  readonly controls: Controls;
  readonly controlsError?: string;
  readonly built?: Built;
  readonly error?: string;
}

/** A span of a lane, and the span signal it was written with when one matches it. */
export interface LaneSpan {
  readonly start: number;
  readonly over: number;
  /** The curve it moves along: a cubic bezier, a straight line, or steps. */
  readonly ease?: LaneEase;
  readonly signal?: string;
}

/** A curve as JSON: what svjeez's `Ease` is, without the brand only its constructors may add. */
export type LaneEase =
  | { readonly kind: "linear" }
  | { readonly kind: "bezier"; readonly points: readonly [number, number, number, number] }
  | { readonly kind: "steps"; readonly count: number };

export interface LaneView {
  readonly key: string;
  readonly lane: string;
  readonly backend: string;
  readonly file?: string;
  readonly line?: number;
  readonly period?: number;
  readonly spans: readonly LaneSpan[];
}

export type Group = "derived" | "const" | "field" | "param" | "span" | "prop" | "chain" | "literal";

export interface GroupedControl extends ControlView {
  readonly group: Group;
}

export interface Mark {
  readonly key: string;
  readonly from: number;
  readonly to: number;
}

/** Everything the page draws, as JSON. */
export interface StateView {
  readonly mode: "file" | "project";
  readonly root: string;
  readonly scenes: readonly string[];
  readonly version: number;
  readonly file?: string;
  readonly name?: string;
  readonly source?: string;
  readonly svg?: string;
  readonly warnings: readonly string[];
  readonly lanes: readonly LaneView[];
  readonly duration?: number;
  readonly loop?: boolean;
  readonly ms?: number;
  readonly error?: string;
  readonly controlsError?: string;
  readonly controls: readonly GroupedControl[];
  /** Where every signal is written, for the source pane to mark. */
  readonly marks: readonly Mark[];
  readonly log: { readonly labels: readonly string[]; readonly at: number };
}

export type Event =
  | { readonly type: "build"; readonly version: number }
  | { readonly type: "scenes" };

export interface Preview {
  readonly svg: string;
  readonly ms: number;
  readonly duration?: number;
  readonly lanes: readonly LaneView[];
  readonly warnings: readonly string[];
}

export interface Variant {
  readonly value: ControlValue;
  readonly svg?: string;
  readonly error?: string;
}

const refuse = (message: string) => Effect.fail(new Refused({ message }));

const GROUPS: readonly Group[] = [
  "derived",
  "const",
  "field",
  "param",
  "span",
  "prop",
  "chain",
  "literal",
];

const groupOf = (control: Control): Group =>
  control.origin === "pad" || control.origin === "derived" ? "derived" : control.origin;

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/**
 * A lane's spans, each with the span signal it was written with: one whose start and length are the span's, in the
 * file the lane was written in, the nearest one below the lane's line when several match.
 */
const lanesOf = (lanes: readonly LaneReport[], signals: Signals): LaneView[] => {
  const spans = Object.values(signals).filter((signal) => signal.kind === "span");

  return lanes.map((lane) => ({
    key: lane.key,
    lane: lane.lane,
    backend: lane.backend,
    ...(lane.source && { file: lane.source.file, line: lane.source.line }),
    ...(lane.period !== undefined && { period: lane.period }),
    spans: lane.spans.map((span) => {
      const line = lane.source?.line ?? 0;

      const matches = spans
        .filter(
          (signal) =>
            isSpan(signal.value) &&
            near(signal.value.start, span.start) &&
            near(signal.value.over, span.over) &&
            (lane.source === undefined || signal.file === lane.source.file),
        )
        .sort((a, b) => Math.abs(a.line - line) - Math.abs(b.line - line));

      const signal = matches[0]?.key;

      return {
        start: span.start,
        over: span.over,
        ...(span.ease && { ease: span.ease }),
        ...(signal !== undefined && { signal }),
      };
    }),
  }));
};

const isNumberValue = (value: ControlValue): value is number => typeof value === "number";

const round = (value: number, step: number) => {
  const places = Math.max(0, Math.ceil(-Math.log10(step)));

  return Number((Math.round(value / step) * step).toFixed(places));
};

/** `count` values across a control's whole range, for small multiples. */
export const sweep = (
  control: ControlView,
  signals: Signals,
  count = 5,
): readonly ControlValue[] => {
  const { value, range } = control;

  if (control.kind === "ease") return EASES;

  if (control.kind === "boolean") return [false, true];

  if (control.options) return control.options;

  if (control.kind === "color")
    return [
      ...new Set([
        value,
        ...Object.values(signals).flatMap((signal) =>
          signal.kind === "color" ? [signal.value] : [],
        ),
      ]),
    ].slice(0, count);

  if (control.kind === "span" && isSpan(value)) {
    const last = Math.max(value.start * 2, (range?.max ?? 1) - value.over, 0.5);

    return Array.from({ length: count }, (_, i) => ({
      start: round((last * i) / (count - 1), 0.01),
      over: value.over,
    }));
  }

  if (isNumberValue(value) && range)
    return [
      ...new Set(
        Array.from({ length: count }, (_, i) =>
          round(range.min + ((range.max - range.min) * i) / (count - 1), range.step),
        ),
      ),
    ];

  return [];
};

const viewsOf = (open: Open): GroupedControl[] => {
  const values = valuesOf(open.signals);

  return Object.entries(open.controls)
    .map(([key, control]) => ({
      ...view(key, control, open.signals, values),
      group: groupOf(control),
    }))
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
};

/** What the source says, rendered: the signals and controls it declares, and what it builds to. */
const read = (file: string, text: string, built: Built | BuildFailed, others: Files): Open => {
  const files = { ...others, [file]: text };
  const signals = discover(files, file);
  const failed = built instanceof BuildFailed ? built : undefined;
  const made = built instanceof BuildFailed ? undefined : built;
  let controls: Controls = signals;
  let controlsError: string | undefined;

  if (made?.controls)
    try {
      controls = made.controls(signals);
    } catch (error) {
      controlsError =
        "export const controls threw, so the signals are shown as they are: " +
        (error instanceof Error ? error.message : String(error));
    }

  return {
    file,
    text,
    files,
    signals,
    controls,
    ...(controlsError !== undefined && { controlsError }),
    ...(made && { built: made }),
    ...(failed && { error: failed.message }),
  };
};

export interface WorkspaceShape {
  readonly events: PubSub.PubSub<Event>;
  readonly state: Effect.Effect<StateView>;
  readonly svg: Effect.Effect<string>;
  readonly open: (file: string) => Effect.Effect<StateView, Failure>;
  readonly preview: (
    key: string,
    value: ControlValue,
  ) => Effect.Effect<Preview | { readonly stale: true }, Failure>;
  readonly commit: (key: string, value: ControlValue) => Effect.Effect<StateView, Failure>;
  /** Turns a literal into a constant named `name`: both edits are one entry in the log. */
  readonly extract: (key: string, name: string) => Effect.Effect<StateView, Failure>;
  readonly variants: (key: string) => Effect.Effect<readonly Variant[], Failure>;
  readonly undo: Effect.Effect<StateView, Failure>;
  readonly redo: Effect.Effect<StateView, Failure>;
  /** Files under the root changed on disk: rebuild, unless the only change is a write this workspace made itself. */
  readonly changed: (paths: readonly string[]) => Effect.Effect<void>;
}

export interface WorkspaceOptions {
  readonly root: string;
  readonly mode: "file" | "project";
  /** The scene to open first. */
  readonly file?: string;
  /** Modules under this directory are never re-imported: the svjeez checkout the server itself runs on. */
  readonly keep?: string;
}

/**
 * The open scene, its edit history and the builds that draw it. Every build goes through one permit, so at most one is
 * in flight; a preview that waited behind a newer one is dropped without building.
 */
const makeWorkspace = (
  options: WorkspaceOptions,
): Effect.Effect<WorkspaceShape, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const services = Effect.provideService(FileSystem.FileSystem, fs);
    const permit = yield* Semaphore.make(1);
    const events = yield* PubSub.unbounded<Event>();
    const current = yield* Ref.make<Open | undefined>(undefined);
    const histories = yield* Ref.make(new Map<string, History>());
    const version = yield* Ref.make(0);
    const scenes = yield* Ref.make<readonly string[]>([]);
    let previews = 0;
    let sweeps = 0;

    /** The modules a rebuild must read afresh: everything under the root but node_modules and svjeez itself, and the scene's own files. */
    const dropping = (files: Files) => (key: string) =>
      Object.hasOwn(files, key) ||
      (key.startsWith(options.root + "/") &&
        !key.includes("/node_modules/") &&
        (options.keep === undefined || !key.startsWith(options.keep + "/")));

    const built = (file: string, text?: string, others?: Files, files: Files = {}) =>
      buildScene(file, text, others, dropping(files)).pipe(
        Effect.provideService(Path.Path, path),
        services,
        permit.withPermits(1),
      );

    /** The local files a scene imports, one level, and what those re-export: `import { theme } from "../theme"` reads colors.ts. */
    const localFiles = (file: string, text: string): Effect.Effect<Files> =>
      Effect.gen(function* () {
        const found: Record<string, string> = {};

        const visit = (from: string, source: string, imports: boolean): Effect.Effect<void> =>
          Effect.gen(function* () {
            const listed = importsOf(source);

            for (const specifier of imports
              ? [...listed.imports, ...listed.reexports]
              : listed.reexports) {
              for (const candidate of candidatesFor(from, specifier)) {
                if (candidate === file || Object.hasOwn(found, candidate)) break;

                const contents = yield* fs
                  .readFileString(candidate)
                  .pipe(Effect.orElseSucceed(() => undefined));

                if (contents === undefined) continue;
                found[candidate] = contents;

                if (Object.keys(found).length < 64) yield* visit(candidate, contents, false);
                break;
              }
            }
          });

        yield* visit(file, text, true);

        return found;
      });

    /** What a set of splices changes: the files that read differently after them, by path. */
    const changesOf = (open: Open, splices: readonly Splice[]) =>
      Effect.map(applySplices(open.files, splices), (next) =>
        Object.fromEntries(
          Object.entries(next).filter(([name, text]) => text !== open.files[name]),
        ),
      );

    /** The files of a change other than the scene itself. */
    const othersOf = (open: Open, changes: Files): Files =>
      Object.fromEntries(Object.entries(changes).filter(([name]) => name !== open.file));

    const historyOf = (file: string) =>
      Effect.map(Ref.get(histories), (all) => all.get(file) ?? { entries: [], at: 0 });

    const state: Effect.Effect<StateView> = Effect.gen(function* () {
      const open = yield* Ref.get(current);
      const history = open ? yield* historyOf(open.file) : { entries: [], at: 0 };
      const made = open?.built;

      return {
        mode: options.mode,
        root: options.root,
        scenes: yield* Ref.get(scenes),
        version: yield* Ref.get(version),
        ...(open && {
          file: path.relative(options.root, open.file) || path.basename(open.file),
          name: path.basename(open.file),
          source: open.text,
          ...(open.error !== undefined && { error: open.error }),
          ...(open.controlsError !== undefined && { controlsError: open.controlsError }),
        }),
        ...(made && {
          svg: made.svg,
          ms: Math.round(made.ms),
          ...(made.duration !== undefined && { duration: made.duration }),
          ...(made.loop !== undefined && { loop: made.loop }),
        }),
        warnings: made?.warnings ?? [],
        lanes: made && open ? lanesOf(made.lanes, open.signals) : [],
        controls: open ? viewsOf(open) : [],
        marks: open
          ? Object.values(open.signals).flatMap((signal) =>
              signal.sites.flatMap((site) =>
                site.file === open.file ? [{ key: signal.key, from: site.from, to: site.to }] : [],
              ),
            )
          : [],
        log: { labels: history.entries.map((entry) => entry.label), at: history.at },
      };
    });

    const publish = (event: Event) => PubSub.publish(events, event).pipe(Effect.asVoid);

    /** Reads the file, builds it, and keeps the last good drawing when the new build fails. */
    const reload = (file: string) =>
      Effect.gen(function* () {
        const text = yield* fs
          .readFileString(file)
          .pipe(
            Effect.mapError(
              (error) => new Refused({ message: "Cannot read " + file + ": " + error.message }),
            ),
          );

        const others = yield* localFiles(file, text);
        const result = yield* built(file, text).pipe(Effect.result);

        const next = read(
          file,
          text,
          Result.isSuccess(result) ? result.success : result.failure,
          others,
        );

        const before = yield* Ref.get(current);
        const kept = next.built ?? (before?.file === file ? before.built : undefined);

        yield* Ref.set(current, { ...next, ...(kept && { built: kept }) });
        const at = yield* Ref.updateAndGet(version, (n) => n + 1);

        yield* Effect.log(
          next.error === undefined
            ? "built " + path.basename(file) + " in " + Math.round(next.built?.ms ?? 0) + " ms"
            : "failed " + path.basename(file) + ": " + next.error.split("\n")[0],
        );
        yield* publish({ type: "build", version: at });
      });

    const opened = Effect.flatMap(Ref.get(current), (open) =>
      open ? Effect.succeed(open) : refuse("No scene is open. Pick one."),
    );

    const controlOf = (open: Open, key: string) =>
      Object.hasOwn(open.controls, key) && open.controls[key]
        ? Effect.succeed(open.controls[key])
        : refuse("The scene has no control " + key + " now. It may have been renamed.");

    /** The files a control set to `value` would change, by path, with the text each would have. */
    const changesFor = (open: Open, key: string, value: ControlValue) =>
      Effect.gen(function* () {
        const control = yield* controlOf(open, key);

        const updates = yield* Effect.try({
          try: () => assign(control, value, valuesOf(open.signals)),
          catch: (error) =>
            new Refused({
              message:
                key +
                ": its set threw: " +
                (error instanceof Error ? error.message : String(error)),
            }),
        });

        const splices = yield* writeAll(open.signals, updates);

        return yield* changesOf(open, splices);
      });

    const write = (file: string, text: string) =>
      fs
        .writeFileString(file, text)
        .pipe(
          Effect.mapError(
            (error) => new Refused({ message: "Cannot write " + file + ": " + error.message }),
          ),
        );

    /** Forgets what other modules loaded from a file that is not the scene, so the next build reads the new one. */
    const refreshed = (open: Open, files: Files) => {
      if (Object.keys(files).some((name) => name !== open.file)) forget(dropping(open.files));
    };

    const keep = (open: Open, label: string, changes: Files) =>
      Effect.gen(function* () {
        for (const [file, after] of Object.entries(changes)) yield* write(file, after);
        refreshed(open, changes);
        yield* Ref.update(histories, (all) => {
          const history = all.get(open.file) ?? { entries: [], at: 0 };

          const entries = [
            ...history.entries.slice(0, history.at),
            {
              label,
              changes: Object.entries(changes).map(([file, after]) => ({
                file,
                before: open.files[file] ?? "",
                after,
              })),
            },
          ];

          return new Map(all).set(open.file, { entries, at: entries.length });
        });
      });

    const shown = (value: ControlValue): string =>
      isSpan(value)
        ? "span(" + value.start + ", " + value.over + ")"
        : Array.isArray(value)
          ? "[" + value.join(", ") + "]"
          : String(value);

    const step = (by: 1 | -1) =>
      Effect.gen(function* () {
        const open = yield* opened;
        const history = yield* historyOf(open.file);
        const entry = history.entries[by === -1 ? history.at - 1 : history.at];

        if (!entry) return yield* refuse(by === -1 ? "Nothing to undo." : "Nothing to redo.");

        for (const change of entry.changes) {
          const disk = yield* fs.readFileString(change.file).pipe(Effect.orElseSucceed(() => ""));

          if (disk !== (by === -1 ? change.after : change.before))
            return yield* refuse(
              path.basename(change.file) +
                " changed on disk since that edit, so " +
                (by === -1 ? "undo" : "redo") +
                " would lose the change. Edit it by hand.",
            );
        }

        const restored = Object.fromEntries(
          entry.changes.map((change) => [change.file, by === -1 ? change.before : change.after]),
        );

        for (const [file, text] of Object.entries(restored)) yield* write(file, text);
        refreshed(open, restored);
        yield* Ref.update(histories, (all) =>
          new Map(all).set(open.file, { ...history, at: history.at + by }),
        );
        yield* reload(open.file);

        return yield* state;
      });

    const rescan = Effect.gen(function* () {
      if (options.mode !== "project") return;

      const found = yield* scenesIn(options.root).pipe(
        services,
        Effect.provideService(Path.Path, path),
        Effect.orElseSucceed(() => []),
      );

      const before = yield* Ref.get(scenes);

      yield* Ref.set(scenes, found);

      if (found.join("\n") !== before.join("\n")) yield* publish({ type: "scenes" });
    });

    yield* rescan;

    if (options.file !== undefined) yield* reload(options.file).pipe(Effect.ignore);

    const workspace: WorkspaceShape = {
      events,
      state,
      svg: Effect.map(Ref.get(current), (open) => open?.built?.svg ?? ""),
      open: (file) =>
        Effect.gen(function* () {
          const target = path.resolve(options.root, file);
          const known = yield* Ref.get(scenes);

          if (options.mode === "project" && !known.includes(path.relative(options.root, target)))
            return yield* refuse(file + " is not one of the scenes under " + options.root + ".");
          yield* reload(target);

          return yield* state;
        }),
      preview: (key, value) =>
        Effect.gen(function* () {
          const open = yield* opened;
          const changes = yield* changesFor(open, key, value);
          const mine = ++previews;

          sweeps++;
          const started = performance.now();

          const build = buildScene(
            open.file,
            changes[open.file] ?? open.text,
            othersOf(open, changes),
            dropping(open.files),
          ).pipe(
            Effect.provideService(Path.Path, path),
            services,
            Effect.map((made): Built | undefined => made),
          );

          const made = yield* permit.withPermits(1)(
            Effect.suspend(() => (mine === previews ? build : Effect.succeed(undefined))),
          );

          if (!made) return { stale: true } as const;
          const signals = discover({ ...open.files, ...changes }, open.file);

          return {
            svg: made.svg,
            ms: Math.round(performance.now() - started),
            warnings: made.warnings,
            lanes: lanesOf(made.lanes, signals),
            ...(made.duration !== undefined && { duration: made.duration }),
          };
        }),
      commit: (key, value) =>
        Effect.gen(function* () {
          const open = yield* opened;
          const changes = yield* changesFor(open, key, value);

          if (Object.keys(changes).length > 0) {
            const control = yield* controlOf(open, key);
            const was = view(key, control, open.signals, valuesOf(open.signals)).value;

            yield* keep(
              open,
              (control.label || key) + ": " + shown(was) + " → " + shown(value),
              changes,
            );
          }

          yield* reload(open.file);

          return yield* state;
        }),
      extract: (key, name) =>
        Effect.gen(function* () {
          const open = yield* opened;
          const signal = Object.hasOwn(open.signals, key) ? open.signals[key] : undefined;

          if (!signal) return yield* refuse("The scene has no literal " + key + " now.");
          const splices = yield* extract(open.files, signal, name);

          yield* keep(
            open,
            "extract " + name + " from " + signal.label,
            yield* changesOf(open, splices),
          );
          yield* reload(open.file);

          return yield* state;
        }),
      variants: (key) =>
        Effect.gen(function* () {
          const open = yield* opened;
          const control = yield* controlOf(open, key);

          const values = sweep(
            view(key, control, open.signals, valuesOf(open.signals)),
            open.signals,
          );

          const mine = ++sweeps;

          return yield* Effect.forEach(values, (value) =>
            mine !== sweeps
              ? Effect.succeed<Variant>({ value, error: "superseded" })
              : changesFor(open, key, value).pipe(
                  Effect.flatMap((changes) =>
                    built(open.file, changes[open.file], othersOf(open, changes), open.files),
                  ),
                  Effect.map((made): Variant => ({ value, svg: made.svg })),
                  Effect.catch((failure) =>
                    Effect.succeed<Variant>({ value, error: messageOf(failure) }),
                  ),
                ),
          );
        }),
      undo: step(-1),
      redo: step(1),
      changed: (paths) =>
        Effect.gen(function* () {
          yield* rescan;
          const open = yield* Ref.get(current);

          if (!open) return;

          const unchanged = yield* Effect.forEach(Object.entries(open.files), ([file, text]) =>
            Effect.map(
              fs.readFileString(file).pipe(Effect.orElseSucceed(() => text)),
              (disk) => disk === text,
            ),
          );

          if (
            paths.every((changed) => Object.hasOwn(open.files, changed)) &&
            unchanged.every(Boolean) &&
            open.error === undefined
          )
            return;
          forget(dropping(open.files));
          yield* reload(open.file).pipe(Effect.ignore);
        }),
    };

    return workspace;
  });

/** The workspace a dev server serves. */
export class Workspace extends Context.Service<Workspace, WorkspaceShape>()(
  "@svjeez/dev/Workspace",
) {
  static layer = (
    options: WorkspaceOptions,
  ): Layer.Layer<Workspace, never, FileSystem.FileSystem | Path.Path> =>
    Layer.effect(Workspace, makeWorkspace(options));
}
