// Not part of the public API. The @svjeez packages build elements with `el`; scenes write JSX, and without JSX they
// call `jsx` from "svjeez/jsx-runtime". It can change in any release.
export { el, type ElementProps } from "./el";
