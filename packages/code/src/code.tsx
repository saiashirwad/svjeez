/** @jsxImportSource svjeez */
import { Group, Run, Text, ease, rect, track, type Span } from "svjeez";
import { SceneError, type Common, type FontValue } from "svjeez/tools";
import { highlight, type Lang, type Piece } from "./highlight.ts";
import { faceOf } from "./layout.ts";
import type { Palette } from "./roles.ts";
import { lines, type Split } from "./split.ts";

export interface CodeProps extends Common {
  readonly lang: Lang;
  readonly font: FontValue;
  readonly size: number;
  readonly palette: Palette;
  readonly lineHeight?: number;
  readonly tabSize?: number;
  /** How the code is cut into nodes and keyed: `lines` (the default), `codeTokens`, `codeTokens.across(a, b)` or your own split. */
  readonly by?: Split;
  /** Names the lines instead of `line-1`, `line-2`…, one per line, empty ones included. Only with `by={lines}`. */
  readonly keys?: readonly string[];
  readonly typing?: Span;
  readonly children: string;
}

const lengthOf = (pieces: readonly Piece[]): number =>
  [
    ...pieces
      .map(([, text]) => text)
      .join("")
      .trimEnd(),
  ].length;

const isSource = (value: string | readonly string[]): value is string => typeof value === "string";

export const Code = ({
  lang,
  font,
  size,
  palette,
  lineHeight = 1.5,
  tabSize,
  by = lines,
  keys,
  typing,
  children,
  ...common
}: CodeProps) => {
  if (!isSource(children))
    throw new SceneError(
      "<Code> holds something that is not one string of source code.",
      "Write the code as one string: <Code …>{`const x = 1;`}</Code>.",
    );

  if (!(size > 0 && Number.isFinite(size)))
    throw new SceneError(`<Code> needs a positive size, got ${size}.`);

  if (!(lineHeight > 0 && Number.isFinite(lineHeight)))
    throw new SceneError(`<Code> needs a positive lineHeight, got ${lineHeight}.`);

  const code = highlight(children, lang, { tabSize });

  if (keys && by !== lines)
    throw new SceneError(
      "keys names lines, but this <Code> is split another way.",
      "Leave out keys, or split by={lines}.",
    );

  if (keys && keys.length !== code.length)
    throw new SceneError(
      `keys names ${keys.length} lines, but the code has ${code.length}.`,
      "Give one key per line, empty lines included.",
    );

  const face = faceOf(font);
  const parts = by(code).map((part) => ({ ...part, chars: lengthOf(part.pieces) }));
  const total = parts.reduce((sum, { chars }) => sum + chars, 0);
  let typed = 0;

  return (
    <Group {...common}>
      {parts.map(({ key, line, col, pieces, chars }) => {
        if (chars === 0) return null;

        const when = typing && {
          start: typing.start + (typing.over * typed) / total,
          over: (typing.over * chars) / total,
        };

        const before = (code[line] ?? [])
          .map(([, text]) => text)
          .join("")
          .slice(0, col);

        typed += chars;

        return (
          <Text
            key={keys?.[line] ?? key}
            font={font}
            size={size}
            fill={palette.plain}
            at={[col === 0 ? 0 : face.measure(before, size), line * lineHeight * size]}
            clip={
              when &&
              ((own) =>
                track(rect(0, own.height)).to(rect(own.width, own.height), when, ease.steps(chars)))
            }
          >
            {pieces.map(([role, text]) => (
              <Run fill={palette[role]}>{text}</Run>
            ))}
          </Text>
        );
      })}
    </Group>
  );
};
