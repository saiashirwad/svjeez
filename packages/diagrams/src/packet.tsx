/** @jsxImportSource svjeez */
import { Group, Shape, Text, rect, type SceneElement, type Span } from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import {
  checkIds,
  extent,
  look,
  mix,
  partsOf,
  pop,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Reveal,
} from "./kit.tsx";
import { series } from "./series.ts";

export interface PacketField {
  readonly label: string;
  /** First bit, counted from 0. */
  readonly from: number;
  /** Last bit, inclusive. Equal to `from` for a single bit. */
  readonly to: number;
}

export interface PacketOptions<Id extends string = string> extends DiagramOptions {
  readonly reveal?: Reveal<Id>;
}

export type Packet<Id extends string> = Diagram<Id>;

const WHAT = "packet()";
const PAD = 8;

interface Piece {
  readonly id: string;
  readonly label: string;
  readonly row: number;
  readonly from: number;
  readonly to: number;
  readonly color: number;
}

export function packet<const S extends Record<string, PacketField>>(
  spec: { readonly title?: string; readonly bitsPerRow?: number; readonly fields: S },
  options: PacketOptions<NoInfer<keyof S & string>>,
): Packet<keyof S & string> {
  type Id = keyof S & string;

  const l = look(options, WHAT);
  const ids = Object.keys(spec.fields);
  const per = spec.bitsPerRow ?? 32;
  checkIds(ids, WHAT, "field");

  if (!(Number.isInteger(per) && per > 0))
    throw new SceneError(
      `${WHAT} needs bitsPerRow to be a whole number above 0, got ${per}.`,
      "Leave it out for 32 bits a row.",
    );
  let last = -1;

  for (const id of ids) {
    const f = spec.fields[id]!;

    if (!(Number.isInteger(f.from) && Number.isInteger(f.to) && f.from >= 0 && f.to >= f.from))
      throw new SceneError(
        `${WHAT} field "${id}" runs from bit ${f.from} to bit ${f.to}.`,
        "A field needs whole bit numbers from 0 up, with `to` at or after `from`.",
      );

    if (f.from <= last)
      throw new SceneError(
        `${WHAT} field "${id}" starts at bit ${f.from}, but the field before it reaches bit ${last}.`,
        "List the fields in bit order, with none overlapping.",
      );
    last = f.to;
  }

  if (last >= per * 4096)
    throw new SceneError(
      `${WHAT} reaches bit ${last}, which is more than ${4096} rows.`,
      "Draw a smaller packet, or widen the row with bitsPerRow.",
    );
  const shown = schedule(options.reveal, ids, WHAT);
  const bitW = Math.round(l.size * 2);
  const rowH = Math.round(l.size * 2.4);
  const numH = Math.round(l.small * 1.5);
  const rowPitch = numH + rowH + 4;
  const rows = Math.floor(last / per) + 1;
  const head = spec.title === undefined ? 0 : Math.round(l.size * 2.2);
  const gridW = per * bitW;
  const titleW = spec.title === undefined ? 0 : l.measure(spec.title, l.size * 1.15, l.weight);
  const width = Math.max(gridW, titleW) + 2 * PAD;
  const left = (width - gridW) / 2;
  const height = head + rows * rowPitch + PAD * 2 - 4;
  const pieces = new Map<string, Piece[]>();

  ids.forEach((id, color) => {
    const f = spec.fields[id]!;
    pieces.set(id, []);

    for (let from = f.from; from <= f.to;) {
      const row = Math.floor(from / per);
      const to = Math.min(f.to, (row + 1) * per - 1);
      pieces.get(id)!.push({ id, label: f.label, row, from, to, color });
      from = to + 1;
    }
  });

  const fit = (text: string, room: number): string => {
    if (l.measure(text, l.small, l.weight) <= room) return text;
    let cut = text;

    while (cut.length > 0 && l.measure(`${cut}…`, l.small, l.weight) > room) cut = cut.slice(0, -1);

    return cut === "" ? "" : `${cut}…`;
  };

  const parts = new Map<string, Span | undefined>(ids.map((id) => [id, shown.get(id)]));
  const handle = partsOf<Id>(WHAT, parts);

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {spec.title !== undefined && (
        <Text
          key="title"
          font={l.font}
          size={l.size * 1.15}
          weight={l.weight}
          fill={l.colors.text}
          anchor="center"
          at={[width / 2, head / 2 + PAD / 2]}
        >
          {spec.title}
        </Text>
      )}
      {between}
      {ids.map((id) => (
        <Group key={id} motion={shown.get(id) && pop(shown.get(id)!)}>
          {pieces.get(id)!.map((p) => {
            const x = left + (p.from % per) * bitW;
            const y = head + PAD + p.row * rowPitch;
            const w = (p.to - p.from + 1) * bitW;
            const c = series(l, p.color);

            const nums =
              p.from === p.to
                ? [[p.from, x + w / 2]]
                : [
                    [p.from, x + bitW / 2],
                    [p.to, x + w - bitW / 2],
                  ];

            return (
              <Group key={`${p.from}`}>
                <Shape
                  key="box"
                  geometry={rect(w, rowH, { radius: 3 })}
                  at={[x, y + numH]}
                  fill={mix(c, l.colors.background, 0.2)}
                  stroke={{ color: c, width: 1.25 }}
                />
                <Text
                  key="label"
                  font={l.font}
                  size={l.small}
                  weight={l.weight}
                  fill={l.colors.text}
                  anchor="center"
                  at={[x + w / 2, y + numH + rowH / 2]}
                >
                  {fit(p.label, w - 6)}
                </Text>
                {nums.map(([n, nx]) => (
                  <Text
                    key={`bit-${n}`}
                    font={l.font}
                    size={l.small * 0.85}
                    weight={l.weight}
                    fill={l.colors.muted}
                    anchor="center"
                    at={[nx!, y + numH / 2]}
                  >
                    {`${n}`}
                  </Text>
                ))}
              </Group>
            );
          })}
        </Group>
      ))}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(width), Math.ceil(height)],
    span: extent([...parts.values()]),
    ...handle,
  };
}
