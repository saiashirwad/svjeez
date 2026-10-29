// The fix for a svjeez runtime error, from the "Errors and fixes" table in svjeez's scene-writing skill, so an editor
// only ever suggests a fix the skill itself gives. The table is the data: agents read it there, and `bun run generate`
// copies it into skill-errors.ts.
import table from "./skill-errors.ts";

export interface ErrorFix {
  /** The message, with each `…` (a value the message fills in) matching anything. */
  readonly pattern: RegExp;
  /** The fix, with `code` spans still in backticks. */
  readonly fix: string;
}

const ROW = /^\| (`+)(.+?)\1 \| (.+) \|$/;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The "Runtime errors." section of a skill file, or nothing when it has none. */
export const errorTable = (markdown: string): string => {
  const from = markdown.indexOf("Runtime errors.");

  return from < 0 ? "" : markdown.slice(from, markdown.indexOf("\n## ", from));
};

/** The rows of the "Runtime errors." table in a skill file. */
export const errorFixes = (markdown: string): ErrorFix[] =>
  errorTable(markdown)
    .split("\n")
    .flatMap((line) => {
      const row = ROW.exec(line.trim());

      return row
        ? [
            {
              pattern: new RegExp(row[2]!.trim().split("…").map(escape).join("[\\s\\S]*?")),
              fix: row[3]!.trim(),
            },
          ]
        : [];
    });

export const FIXES: readonly ErrorFix[] = errorFixes(table);

/** The skill's fix for an error message, or undefined when it has none. */
export const fixFor = (message: string) => FIXES.find(({ pattern }) => pattern.test(message))?.fix;
