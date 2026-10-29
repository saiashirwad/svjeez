// The fix for a svjeez runtime error, read from the "Errors and fixes" table in the scene-writing skill, so the
// playground only ever suggests a fix the skill itself gives. `…` in a message stands for a value it fills in.
import skill from "../../../packages/svjeez/skills/svjeez/SKILL.md?raw";

const ROW = /^\| (`+)(.+?)\1 \| (.+) \|$/;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const table = skill
  .slice(skill.indexOf("Runtime errors."), skill.indexOf("\n## ", skill.indexOf("Runtime errors.")))
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

/** The skill's fix for an error message, with `code` spans still in backticks, or undefined when it has none. */
export const fixFor = (message: string) => table.find(({ pattern }) => pattern.test(message))?.fix;

export const FIXES = table.length;
