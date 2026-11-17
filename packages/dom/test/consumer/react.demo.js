import { click, demo, snap } from "@svjeez/dom/react";
import { createElement, useState } from "react";

const Counter = ({ label = "Count" }) => {
  const [n, setN] = useState(0);

  return createElement(
    "button",
    {
      "data-part": "add",
      onClick: () => setN(n + 1),
      style: { font: "16px sans-serif", padding: 8 },
    },
    `${label}: ${n}`,
  );
};

export const counter = demo(Counter, { width: 200 }, ({ props }) => [
  snap("zero"),
  click("add"),
  snap("one", { over: 0.2 }),
  props({ label: "Total" }),
  snap("renamed", { over: 0.2 }),
]);
