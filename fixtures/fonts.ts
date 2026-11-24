/**
 * The font files tests load. They are the only font files in the repo: scenes, examples, templates and docs load fonts
 * by name through `@svjeez/fonts`, and `tests/fonts.test.ts` fails when a font file appears anywhere else.
 */
export type FixtureFont =
  | "ABeeZee-Italic"
  | "ABeeZee-Regular"
  | "ArchivoBlack-Regular"
  | "JetBrainsMono"
  | "NotoSansBidi-Subset"
  | "SpaceMono-Bold"
  | "SpaceMono-Regular";

export const fontFixture = (name: FixtureFont): URL =>
  new URL(`./fonts/${name}.ttf`, import.meta.url);
