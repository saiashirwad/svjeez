/** @jsxImportSource react */
import { useState } from "react";
import { click, demo, snap } from "../../src/react.ts";

function Counter({ label = "Count" }: { label?: string }) {
  const [n, setN] = useState(0);

  return (
    <button
      data-part="add"
      onClick={() => setN(n + 1)}
      style={{ font: "16px sans-serif", padding: 8 }}
    >
      {label}: {n}
    </button>
  );
}

export const counter = demo(Counter, { width: 200 }, ({ props }) => [
  snap("zero"),
  click("add"),
  snap("one", { over: 0.2 }),
  props({ label: "Total" }),
  snap("renamed", { over: 0.2 }),
]);

// Type checks: props() takes only the component's props, with their types, and required props must be given.
function Labelled({ label }: { label: string }) {
  return <span>{label}</span>;
}

export const labelled = demo(Labelled, { props: { label: "a" } }, ({ props }) => [
  snap(),
  props({ label: "b" }),
  // @ts-expect-error: label is a string
  props({ label: 1 }),
  // @ts-expect-error: Labelled has no such prop
  props({ size: 2 }),
]);

// @ts-expect-error: label is required
demo(Labelled, {}, () => [snap()]);

export const notADemo = 1;
