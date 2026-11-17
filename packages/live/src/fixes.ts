import table from "./skill-errors.ts";

export interface ErrorFix {
  readonly pattern: RegExp;
  readonly fix: string;
}

const ROW = /^\| (`+)(.+?)\1 \| (.+) \|$/;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const errorTable = (markdown: string): string => {
  const from = markdown.indexOf("Runtime errors.");

  return from < 0 ? "" : markdown.slice(from, markdown.indexOf("\n## ", from));
};

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

export const fixFor = (message: string) => FIXES.find(({ pattern }) => pattern.test(message))?.fix;
