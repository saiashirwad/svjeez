/** @jsxImportSource react */
export interface Row {
  readonly id: number;
  readonly text: string;
}

/** A list whose rows are keyed by React `key` only: no `data-key` anywhere. */
export default function List({ rows }: { rows: readonly Row[] }) {
  return (
    <ul id="list" style={{ margin: 0, padding: 0, listStyle: "none", width: 200 }}>
      {rows.map((row) => (
        <li key={row.id} style={{ height: 24, marginBottom: 6, background: "#cde" }}>
          {row.text}
        </li>
      ))}
    </ul>
  );
}
