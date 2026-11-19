/** @jsxImportSource react */
import type { Row } from "./List.tsx";

/** Two side-by-side lists whose rows are keyed 1 to 3 in both: React keys are per list. */
export default function Lists({ left, right }: { left: readonly Row[]; right: readonly Row[] }) {
  const column = (rows: readonly Row[]) => (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", width: 120 }}>
      {rows.map((row) => (
        <li key={row.id} style={{ height: 24, marginBottom: 6, background: "#cde" }}>
          {row.text}
        </li>
      ))}
    </ul>
  );

  return (
    <div style={{ display: "flex", gap: 30 }}>
      {column(left)}
      {column(right)}
    </div>
  );
}
