import type { ModelMessage } from "ai";
import { DurableObject } from "cloudflare:workers";

import { EMPTY, LIMITS, type Deck } from "./document";

export interface SessionEnv {
  readonly DEEPSEEK_API_KEY?: string;
}

/** One line of a turn's stream: a step's progress, with the deck's new version when it changed, or the ending. */
export interface Event {
  readonly type: "progress" | "done";
  readonly text: string;
  readonly version?: number;
}

/** A line of the conversation as the person sees it. */
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
  getByName(name: string): Remote<Pick<Session, "state" | "svg" | "undo" | "message">>;
}

/** A method's answer: its value, or an HTTP status with a message for the person. */
export type Outcome<T> =
  | { readonly status: 200; readonly value: T }
  | { readonly status: 400 | 409 | 429 | 501; readonly error: string };

/**
 * One session: a deck, every accepted version of it, and the conversation that edits it, in this object's SQLite
 * storage. The Worker calls its methods over RPC; a message runs one agent turn and streams its progress back.
 */
export class Session extends DurableObject<SessionEnv> {
  #busy = false;

  constructor(...args: ConstructorParameters<typeof DurableObject<SessionEnv>>) {
    super(...args);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS versions (n INTEGER PRIMARY KEY AUTOINCREMENT, deck TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history (n INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS log (n INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, text TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
    `);
  }

  #rows(query: string, ...bindings: (string | number)[]) {
    return this.ctx.storage.sql.exec(query, ...bindings).toArray();
  }

  #latest(): { readonly deck: Deck; readonly version: number } {
    const [row] = this.#rows("SELECT n, deck FROM versions ORDER BY n DESC LIMIT 1");

    // SAFETY: every stored deck was written by #save from a Deck.
    return row
      ? { deck: JSON.parse(String(row.deck)) as Deck, version: Number(row.n) }
      : { deck: EMPTY, version: 0 };
  }

  #save(deck: Deck) {
    this.ctx.storage.sql.exec("INSERT INTO versions (deck) VALUES (?)", JSON.stringify(deck));

    return this.#latest().version;
  }

  #say(role: Line["role"], text: string) {
    this.ctx.storage.sql.exec("INSERT INTO log (role, text) VALUES (?, ?)", role, text);
  }

  #calls() {
    return Number(this.#rows("SELECT value FROM meta WHERE key = 'calls'")[0]?.value ?? 0);
  }

  /** The deck, its version, the session's model calls and limits, and the conversation as the person sees it. */
  state() {
    const { deck, version } = this.#latest();

    return {
      deck,
      version,
      calls: this.#calls(),
      limits: LIMITS,
      log: this.#rows("SELECT role, text FROM log ORDER BY n").map((row): Line => ({
        // SAFETY: #say writes only Line roles.
        role: String(row.role) as Line["role"],
        text: String(row.text),
      })),
    };
  }

  /** The current deck as an SVG. The templates load on first use, as their fonts load inside a request. */
  async svg() {
    const { renderDeck } = await import("./slides");

    return renderDeck(this.#latest().deck);
  }

  /** Goes back one accepted change, or says there is nothing to undo. */
  undo(): Outcome<ReturnType<Session["state"]>> {
    const { version } = this.#latest();

    if (version === 0) return { status: 400, error: "There is nothing to undo." };

    this.ctx.storage.sql.exec("DELETE FROM versions WHERE n = ?", version);
    this.#say("progress", "undid the last change");

    return { status: 200, value: this.state() };
  }

  /**
   * Runs one agent turn for `text` and streams its progress as lines of JSON: `progress` for each step, with the new
   * version when the deck changed, then `done` with the turn's summary. Refuses when a turn is running or the
   * session's budget is spent.
   */
  async message(text: string): Promise<Outcome<ReadableStream<Uint8Array>>> {
    const key = this.env.DEEPSEEK_API_KEY;
    const used = this.#calls();

    if (!key)
      return { status: 501, error: "This server has no model key, so sessions are turned off." };

    if (this.#busy)
      return { status: 409, error: "A turn is already running. Wait for it to finish." };

    if (used >= LIMITS.calls)
      return {
        status: 429,
        error: `This session has used its ${LIMITS.calls} model calls. Start a new session.`,
      };

    if (!text.trim()) return { status: 400, error: "Write a message first." };

    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();
    const send = (event: Event) => writer.write(`${JSON.stringify(event)}\n`);

    this.#busy = true;
    this.#say("user", text);

    const { turn } = await import("./agent");

    const done = turn(this.#latest().deck, this.#history(), text, {
      key,
      used,
      progress: (line, deck) => {
        this.#say("progress", line);
        void send({ type: "progress", text: line, version: deck ? this.#save(deck) : undefined });
      },
    })
      .then(({ messages, summary, calls }) => {
        for (const message of messages)
          this.ctx.storage.sql.exec(
            "INSERT INTO history (message) VALUES (?)",
            JSON.stringify(message),
          );

        this.ctx.storage.sql.exec(
          "INSERT INTO meta (key, value) VALUES ('calls', ?) ON CONFLICT (key) DO UPDATE SET value = value + excluded.value",
          calls,
        );

        this.#say("assistant", summary);

        return send({ type: "done", text: summary, version: this.#latest().version });
      })
      .finally(() => {
        this.#busy = false;

        return writer.close();
      });

    this.ctx.waitUntil(done);

    return { status: 200, value: readable.pipeThrough(new TextEncoderStream()) };
  }

  #history(): ModelMessage[] {
    // SAFETY: every stored message was written from a ModelMessage the turn returned.
    return this.#rows("SELECT message FROM history ORDER BY n").map(
      (row) => JSON.parse(String(row.message)) as ModelMessage,
    );
  }
}
