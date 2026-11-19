import { SceneError } from "./scene-error";

const round = (n: number, places = 3): number => {
  const factor = 10 ** places;
  const value = Math.round((n + Number.EPSILON) * factor) / factor;

  return Object.is(value, -0) ? 0 : value;
};

export const num = (value: number, places = 3): string => {
  if (!Number.isFinite(value)) throw new SceneError(`Expected a finite number, received ${value}`);

  return String(round(value, places));
};

export const escapeText = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const escapeAttr = (value: string): string => escapeText(value).replaceAll('"', "&quot;");
