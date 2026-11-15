/** @jsxImportSource react */
import { useState } from "react";
import { click, demo, props, snap } from "../../src/react.ts";

function Counter({ label = "Count" }: { label?: string }) {
  const [n, setN] = useState(0);

  return (
    <button data-part="add" onClick={() => setN(n + 1)} style={{ font: "16px sans-serif", padding: 8 }}>
      {label}: {n}
    </button>
  );
}

export const counter = demo(<Counter />, { width: 200 }, [
  snap("zero"),
  click("add"),
  snap("one", { over: 0.2 }),
  props({ label: "Total" }),
  snap("renamed", { over: 0.2 }),
]);

export const notADemo = 1;
