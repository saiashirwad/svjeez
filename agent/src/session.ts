import type { WorkerLoader } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";

import type { Said } from "./agent";
import { LIMITS } from "./limits";

export interface SessionEnv {
  readonly DEEPSEEK_API_KEY?: string;
  readonly LOADER: WorkerLoader;
}

/** How often a watched turn sends an empty line while the model thinks. */
const HEARTBEAT = 15_000;

/** One line of a turn's stream: a step's progress, or the ending with the scene's version after it. */
export type Event =
  | { readonly type: "progress"; readonly text: string }
  | { readonly type: "done"; readonly text: string; readonly version: number };

/** A line of the session as the person sees it. */
export interface Line {
  readonly role: "user" | "progress" | "assistant";
  readonly text: string;
}

/** A session's methods as the Worker calls them over RPC, each answering with a promise. */
export type Remote<T> = {
  readonly [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};

/** The SESSIONS binding: one Session per name. */
export interface Sessions {
  getByName(name: string): Remote<Pick<Session, "state" | "scene" | "undo" | "message" | "watch">>;
}

/** A method's answer: its value, or an HTTP status with a sentence for the person. */
export type Outcome<T> =
  | { readonly status: 200; readonly value: T }
  | { readonly status: 400 | 409 | 429 | 501; readonly error: string };

/**
 * One session: every version of its scene (the source and its SVG), so undo goes back one, and the conversation, in
 * this object's SQLite storage. A message starts one agent turn, which runs here whether or not anyone watches it;
 * `watch` streams the turn's progress from its start, so a page that reloads picks it up again.
 */
export class Session extends DurableObject<SessionEnv> {
  /** The running turn's events so far, the streams following it, and the timer that keeps them open. */
  #turn?: {
    readonly events: Event[];
    readonly watchers: Set<WritableStreamDefaultWriter<string>>;
    readonly heartbeat: ReturnType<typeof setInterval>;
  };

  constructor(...args: ConstructorParameters<typeof DurableObject<SessionEnv>>) {
    super(...args);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS versions (n INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, svg TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS log (n INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, text TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
    `);
  }

  #rows(query: string, ...bindings: (string | number)[]) {
    return this.ctx.storage.sql.exec(query, ...bindings).toArray();
  }

  #version() {
    return Number(this.#rows("SELECT max(n) AS n FROM versions")[0]?.n ?? 0);
  }

  #say(role: Line["role"], text: string) {
    this.ctx.storage.sql.exec("INSERT INTO log (role, text) VALUES (?, ?)", role, text);
  }

  #count(key: string) {
    return Number(this.#rows("SELECT value FROM meta WHERE key = ?", key)[0]?.value ?? 0);
  }

  #add(key: string, value: number) {
    this.ctx.storage.sql.exec(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = value + excluded.value",
      key,
      value,
    );
  }

  #emit(event: Event) {
    const turn = this.#turn;

    if (!turn) return;

    turn.events.push(event);

    for (const writer of turn.watchers)
      writer.write(`${JSON.stringify(event)}\n`).catch(() => turn.watchers.delete(writer));

    if (event.type === "done") {
      clearInterval(turn.heartbeat);

      for (const writer of turn.watchers) writer.close().catch(() => {});
      this.#turn = undefined;
    }
  }

  /** The scene's version, whether a turn is running, the session's model calls and tokens, and the conversation. */
  state() {
    return {
      version: this.#version(),
      busy: this.#turn !== undefined,
      calls: this.#count("calls"),
      tokens: { input: this.#count("input"), output: this.#count("output") },
      log: this.#rows("SELECT role, text FROM log ORDER BY n").map(
        // SAFETY: #say writes only Line roles.
        (row): Line => ({ role: String(row.role) as Line["role"], text: String(row.text) }),
      ),
    };
  }

  /** The current scene's source and SVG, or undefined before anything compiled. */
  scene() {
    const [row] = this.#rows("SELECT source, svg FROM versions ORDER BY n DESC LIMIT 1");

    return row ? { source: String(row.source), svg: String(row.svg) } : undefined;
  }

  /** Goes back one version, or says there is nothing to go back to. */
  undo(): Outcome<ReturnType<Session["state"]>> {
    if (this.#turn) return { status: 409, error: "Wait for the change in progress to finish." };

    const version = this.#version();

    if (version <= 1) return { status: 400, error: "There is no earlier version to go back to." };

    this.ctx.storage.sql.exec("DELETE FROM versions WHERE n = ?", version);
    this.#say("progress", "undid the last change");

    return { status: 200, value: this.state() };
  }

  /** The running turn's progress as lines of JSON, from its start to its `done`; empty when no turn runs. */
  watch(): ReadableStream<Uint8Array> {
    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();

    for (const event of this.#turn?.events ?? []) void writer.write(`${JSON.stringify(event)}\n`);

    if (this.#turn) this.#turn.watchers.add(writer);
    else void writer.close();

    return readable.pipeThrough(new TextEncoderStream());
  }

  /**
   * Starts one agent turn for `text`; its progress goes to `watch`. Refuses when a turn is running, the message is
   * empty or too long, or the session's model calls are spent.
   */
  async message(text: string): Promise<Outcome<null>> {
    const key = this.env.DEEPSEEK_API_KEY;
    const used = this.#count("calls");

    if (!key)
      return { status: 501, error: "This server has no model key, so the agent is turned off." };

    if (this.#turn)
      return { status: 409, error: "A change is already in progress. Wait for it to finish." };

    if (used >= LIMITS.calls)
      return {
        status: 429,
        error: `This session has used its ${LIMITS.calls} model calls. Start a new one.`,
      };

    if (!text.trim()) return { status: 400, error: "Describe what you want first." };

    if (text.length > LIMITS.message)
      return {
        status: 400,
        error: `Your message is ${text.length} characters, and the limit is ${LIMITS.message}. Shorten it.`,
      };

    const said = this.#rows("SELECT role, text FROM log WHERE role != 'progress' ORDER BY n").map(
      // SAFETY: the query keeps only the user and assistant roles.
      (row): Said => ({ role: String(row.role) as Said["role"], text: String(row.text) }),
    );

    // The model can think for minutes between steps; an empty line now and then keeps every watching connection open.
    const watchers = new Set<WritableStreamDefaultWriter<string>>();

    const heartbeat = setInterval(() => {
      for (const writer of watchers) writer.write("\n").catch(() => watchers.delete(writer));
    }, HEARTBEAT);

    this.#turn = { events: [], watchers, heartbeat };
    this.#say("user", text);

    const { turn } = await import("./agent");

    const done = turn(this.scene()?.source, said, text, {
      key,
      loader: this.env.LOADER,
      used,
      progress: (line) => {
        this.#say("progress", line);
        this.#emit({ type: "progress", text: line });
      },
    })
      .then(({ scene, summary, calls, tokens }) => {
        if (scene)
          this.ctx.storage.sql.exec(
            "INSERT INTO versions (source, svg) VALUES (?, ?)",
            scene.source,
            scene.svg,
          );

        this.#add("calls", calls);
        this.#add("input", tokens.input);
        this.#add("output", tokens.output);
        this.#say("assistant", summary);
        this.#emit({ type: "done", text: summary, version: this.#version() });
      })
      .catch((error) => {
        const summary = `Something went wrong on our side: ${error instanceof Error ? error.message : String(error)}. Try again.`;

        this.#say("assistant", summary);
        this.#emit({ type: "done", text: summary, version: this.#version() });
      });

    this.ctx.waitUntil(done);

    return { status: 200, value: null };
  }
}
