/** @jsxImportSource svjeez */
import { Group, Run, Text, ease, rect, track, type Span } from "svjeez";
import { SceneError, type Common, type FontValue } from "svjeez/tools";
import { highlight, type Highlighted, type Lang } from "./highlight.ts";
import type { Palette } from "./roles.ts";

export interface CodeProps extends Common {
  readonly lang: Lang;
  readonly font: FontValue;
  readonly size: number;
  readonly palette: Palette;
  readonly lineHeight?: number;
  readonly tabSize?: number;
  readonly keys?: readonly string[];
  readonly typing?: Span;
  readonly children: string;
}

const lengthOf = (line: Highlighted[number]): number =>
  [
    ...line
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

  const lines = highlight(children, lang, { tabSize });

  if (keys && keys.length !== lines.length)
    throw new SceneError(
      `keys names ${keys.length} lines, but the code has ${lines.length}.`,
      "Give one key per line, empty lines included.",
    );

  const rows = lines.map((line) => ({ line, chars: lengthOf(line) }));
  const total = rows.reduce((sum, { chars }) => sum + chars, 0);
  let typed = 0;

  return (
    <Group {...common}>
      {rows.map(({ line, chars }, index) => {
        if (chars === 0) return null;

        const when = typing && {
          start: typing.start + (typing.over * typed) / total,
          over: (typing.over * chars) / total,
        };

        typed += chars;

        return (
          <Text
            key={keys?.[index] ?? `line-${index + 1}`}
            font={font}
            size={size}
            fill={palette.plain}
            at={[0, index * lineHeight * size]}
            clip={
              when &&
              ((own) =>
                track(rect(0, own.height)).to(rect(own.width, own.height), when, ease.steps(chars)))
            }
          >
            {line.map(([role, text]) => (
              <Run fill={palette[role]}>{text}</Run>
            ))}
          </Text>
        );
      })}
    </Group>
  );
};
