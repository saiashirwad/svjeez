// Parses a Claude Code `--output-format stream-json` transcript into the metrics the benchmark compares.

import { isAbsolute, join, relative } from "node:path";

export interface ToolInput {
  file_path?: string;
  path?: string;
  pattern?: string;
  command?: string;
}

export interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: ToolInput;
  is_error?: boolean;
  text?: string;
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface StreamEvent {
  type: string;
  subtype?: string;
  message?: { id?: string; content?: ContentBlock[] | string };
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  total_cost_usd?: number;
  usage?: Usage;
  is_error?: boolean;
  terminal_reason?: string;
  result?: string;
  permission_denials?: unknown[];
}

export interface Metrics {
  finished: boolean;
  isError: boolean;
  stopReason: string;
  durationMs: number;
  apiMs: number;
  turns: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  toolCalls: number;
  tools: Record<string, number>;
  toolErrors: number;
  permissionDenials: number;
  checkRuns: number;
  frameRuns: number;
  svgRuns: number;
  frameLooks: number;
  sourceLookups: number;
  report: string;
}

export interface RunContext {
  /** Repo root the agent ran in. */
  root: string;
  /** The agent's own scene directory, relative to the root. */
  dir: string;
}

export const parseStream = (text: string): StreamEvent[] =>
  text.split("\n").flatMap((line) => {
    try {
      const event: StreamEvent = JSON.parse(line);

      return event !== null && event.type !== undefined ? [event] : [];
    } catch {
      return [];
    }
  });

const blocksOf = (event: StreamEvent): ContentBlock[] => {
  const content = event.message?.content;

  return Array.isArray(content) ? content : [];
};

const READ_ONLY = new Set(["cat", "head", "tail", "wc", "find", "grep", "rg", "ls"]);
const LIBRARY_ROOTS = ["packages", "examples", "site", "scripts", "tools"];

/** Which svjeez command a Bash line runs: `bun run scene check x`, `svjeez frames x`, `cli.ts svg x`. */
export const svjeezCommand = (command: string): "check" | "frames" | "svg" | undefined => {
  const match = /(?:\bscene|\bsvjeez|cli\.ts)\s+(check|frames|svg)\b/.exec(command);
  const name = match?.[1];

  return name === "check" || name === "frames" || name === "svg" ? name : undefined;
};

/** True for a path inside the library, the examples or the site, but not the agent's own directory or the skill. */
export const isSourceLookup = (path: string, ctx: RunContext): boolean => {
  const rel = relative(ctx.root, isAbsolute(path) ? path : join(ctx.root, path));

  if (rel.startsWith("..") || rel.includes("/skills/") || rel.startsWith(".claude/")) return false;

  if (rel === ctx.dir || rel.startsWith(`${ctx.dir}/`)) return false;

  // The repo root itself (a bare grep) searches the whole library.
  return rel === "" || LIBRARY_ROOTS.includes(rel.split("/")[0] ?? "");
};

const bashPaths = (command: string): string[] =>
  command.split(/\s*(?:\||;|&&)\s*/).flatMap((part) => {
    const [head, ...args] = part.trim().split(/\s+/);

    if (head === undefined || !READ_ONLY.has(head)) return [];

    const paths = args.filter(
      (arg) => !arg.startsWith("-") && (arg.includes("/") || LIBRARY_ROOTS.includes(arg)),
    );

    // `ls`, `grep -r foo` with no path look in the working directory.
    return paths.length > 0 || head === "ls" || head === "cat" ? paths : ["."];
  });

const lookedUp = (call: ContentBlock, ctx: RunContext): boolean => {
  const input = call.input ?? {};

  if (call.name === "Read")
    return input.file_path !== undefined && isSourceLookup(input.file_path, ctx);

  if (call.name === "Grep") return isSourceLookup(input.path ?? ".", ctx);

  if (call.name === "Glob")
    return isSourceLookup(join(input.path ?? ".", input.pattern ?? ""), ctx);

  if (call.name === "Bash")
    return bashPaths(input.command ?? "").some((path) => isSourceLookup(path, ctx));

  return false;
};

const isFrameLook = (call: ContentBlock): boolean =>
  call.name === "Read" && /\.(png|jpe?g|webp)$/i.test(call.input?.file_path ?? "");

export const metrics = (events: StreamEvent[], ctx: RunContext): Metrics => {
  // Each content block arrives as its own assistant event, so count calls by id.
  const calls = new Map<string, ContentBlock>();
  const turnIds = new Set<string>();

  for (const event of events) {
    if (event.type !== "assistant") continue;

    if (event.message?.id !== undefined) turnIds.add(event.message.id);

    for (const block of blocksOf(event))
      if (block.type === "tool_use" && block.id !== undefined) calls.set(block.id, block);
  }

  const results = events.filter((event) => event.type === "result").at(-1);

  const toolErrors = events
    .filter((event) => event.type === "user")
    .flatMap(blocksOf)
    .filter((block) => block.type === "tool_result" && block.is_error === true).length;

  const tools: Record<string, number> = {};
  const runs = { check: 0, frames: 0, svg: 0 };
  let frameLooks = 0;
  let sourceLookups = 0;

  for (const call of calls.values()) {
    tools[call.name ?? "?"] = (tools[call.name ?? "?"] ?? 0) + 1;

    const command = call.name === "Bash" ? svjeezCommand(call.input?.command ?? "") : undefined;

    if (command !== undefined) runs[command]++;

    if (isFrameLook(call)) frameLooks++;

    if (lookedUp(call, ctx)) sourceLookups++;
  }

  const usage = results?.usage ?? {};

  return {
    finished: results !== undefined,
    isError: results?.is_error ?? true,
    stopReason: results?.terminal_reason ?? "no result event",
    durationMs: results?.duration_ms ?? 0,
    apiMs: results?.duration_api_ms ?? 0,
    turns: results?.num_turns ?? turnIds.size,
    costUsd: results?.total_cost_usd ?? 0,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    toolCalls: calls.size,
    tools,
    toolErrors,
    permissionDenials: results?.permission_denials?.length ?? 0,
    checkRuns: runs.check,
    frameRuns: runs.frames,
    svgRuns: runs.svg,
    frameLooks,
    sourceLookups,
    report: results?.result ?? "",
  };
};
