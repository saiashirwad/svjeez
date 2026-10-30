import { css, def, render, type Css } from "svjeez";

export const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
export const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });
export const py = def.property("py", { syntax: "number", inherits: false, initial: 0 });

export const style = (rule: Css) => {
  const svg = render({ width: 10, height: 10, duration: 1, title: "T", css: rule }, <g />);

  return svg.slice(svg.indexOf("<![CDATA[") + 9, svg.indexOf("]]>"));
};

export const value = (expression: Css) =>
  style(css`.d{v:${expression}}`).match(/\.d\{v:(.*)\}/)![1];
